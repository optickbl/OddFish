"""
Oddfish art pipeline: shared Blender helpers.

All models are built procedurally so they stay consistent and can be rebuilt.
Conventions (Blender space): length along +X (head at +X), up = +Z, width = Y.
glTF export converts to Y-up, so in Three.js: +X forward, +Y up, Z lateral.

Creature colours are not painted directly. The body carries a mask in COLOR_0:
  R = main/back zone, G = belly/light zone, B = accent (stripes, spots, fin edges),
  A = bend weight for the swim animation (0 rigid head, 1 free tail/tentacle tip).
The game's shader turns masks into colours, so one model serves every palette variant.
(Mask layout, final: R = belly/underside amount, G = light marking, B = dark marking,
 A = bend weight. Light and dark live in separate channels so soft edges never pass
 through the other colour.)
Eyes and other fixed details use literal vertex colours on their own material.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for x in list(c):
            c.remove(x)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def keyed(keys, t):
    """Smoothly interpolate a list of (t, value) keys (values may be tuples)."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            u = smooth((t - t0) / (t1 - t0))
            if isinstance(v0, tuple):
                return tuple(lerp(a, b, u) for a, b in zip(v0, v1))
            return lerp(v0, v1, u)
    return keys[-1][1]


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    return m


def mesh_object(name, bm, mat_name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(material(mat_name))
    for p in me.polygons:
        p.use_smooth = True
    return ob


def loft(name, n_rings, ring_fn, segs=32, mat='Body', cap_front=True, cap_back=True):
    """Build a closed tube from cross-sections. ring_fn(t) -> (x, zc, h, w, exp, yc)."""
    bm = bmesh.new()
    rings = []
    for i in range(n_rings):
        t = i / (n_rings - 1)
        x, zc, h, w, n, yc = ring_fn(t)
        ring = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            c, s = math.cos(a), math.sin(a)
            y = yc + w * math.copysign(abs(c) ** (2 / n), c)
            z = zc + h * math.copysign(abs(s) ** (2 / n), s)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(segs):
            k = (j + 1) % segs
            bm.faces.new((r0[j], r0[k], r1[k], r1[j]))
    if cap_front:
        x, zc, _, _, _, yc = ring_fn(0)
        c = bm.verts.new((x + 0.004, yc, zc))
        for j in range(segs):
            bm.faces.new((rings[0][(j + 1) % segs], rings[0][j], c))
    if cap_back:
        x, zc, _, _, _, yc = ring_fn(1)
        c = bm.verts.new((x - 0.004, yc, zc))
        for j in range(segs):
            bm.faces.new((rings[-1][j], rings[-1][(j + 1) % segs], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def plate(name, outline, thickness, mat='Body', plane='XZ', offset=(0, 0, 0)):
    """A thin fin or flap from a 2D outline, extruded and rounded later by subdivision."""
    bm = bmesh.new()
    vs = []
    for (u, v) in outline:
        if plane == 'XZ':
            vs.append(bm.verts.new((u + offset[0], offset[1] - thickness / 2, v + offset[2])))
        else:  # XY: lies flat
            vs.append(bm.verts.new((u + offset[0], v + offset[1], offset[2] - thickness / 2)))
    f = bm.faces.new(vs)
    d = Vector((0, thickness, 0)) if plane == 'XZ' else Vector((0, 0, thickness))
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=d)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def uv_sphere(name, radius, loc, mat, segs=24, rings=16, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0] + loc[0], v.co.y * scale[1] + loc[1], v.co.z * scale[2] + loc[2]))
    return mesh_object(name, bm, mat)


def subdivide(ob, levels=2):
    m = ob.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    apply_mods(ob)


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def paint(ob, fn, attr='Col'):
    """fn(world_co, normal) -> (r, g, b, a). Writes a per-corner colour attribute."""
    me = ob.data
    if attr in me.color_attributes:
        me.color_attributes.remove(me.color_attributes[attr])
    ca = me.color_attributes.new(name=attr, type='FLOAT_COLOR', domain='CORNER')
    mw = ob.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            v = me.vertices[vi]
            ca.data[li].color = fn(mw @ v.co, v.normal)
    me.color_attributes.active_color = ca


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def bend_weight(x, x_rigid, x_tip):
    """0 in front of x_rigid, rising to 1 at x_tip (x decreases toward the tail)."""
    return smooth((x_rigid - x) / (x_rigid - x_tip))


def export(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_normals=True, export_texcoords=False, export_materials='EXPORT',
        export_yup=True, export_extras=True,
    )


def chaikin(pts, iters=2, closed=True):
    """Round off a polygon outline."""
    for _ in range(iters):
        out = []
        n = len(pts)
        for i in range(n if closed else n - 1):
            a, b = pts[i], pts[(i + 1) % n]
            out.append((a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25))
            out.append((a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75))
        pts = out
    return pts


def fin(name, outline, thickness, offset=(0, 0, 0), rot=(0, 0, 0), plane='XZ', smooth_iters=2, cup=0.0):
    """A thin fin membrane: smoothed outline, rounded rim, optional cupping. Material 'Fin'."""
    pts = chaikin(outline, smooth_iters)
    bm = bmesh.new()
    vs = []
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    for (u, v) in pts:
        bend = cup * ((u - cx) ** 2 + (v - cy) ** 2)
        if plane == 'XZ':
            vs.append(bm.verts.new((u, bend, v)))
        else:
            vs.append(bm.verts.new((u, v, bend)))
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    ob = mesh_object(name, bm, 'Fin')
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = 0
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width = thickness * .45
    bev.segments = 2
    bev.limit_method = 'ANGLE'
    apply_mods(ob)
    ob.location = offset
    ob.rotation_euler = rot
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.select_set(False)
    return ob


def catmull(points, samples):
    """Smooth path through control points (Catmull-Rom), returns `samples` points."""
    pts = [Vector(p) for p in points]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    segs = len(pts) - 3
    for i in range(samples):
        u = i / (samples - 1) * segs
        k = min(int(u), segs - 1)
        t = u - k
        p0, p1, p2, p3 = pts[k], pts[k + 1], pts[k + 2], pts[k + 3]
        t2, t3 = t * t, t * t * t
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return out


def sweep(name, path, radius_fn, segs=12, mat='Body', flat=1.0, up=(0, 0, 1)):
    """Tube along a path with rotation-minimising frames. radius_fn(t) -> r. Returns object and per-vertex t."""
    bm = bmesh.new()
    n = len(path)
    tangents = []
    for i in range(n):
        a = path[max(0, i - 1)]
        b = path[min(n - 1, i + 1)]
        tangents.append((b - a).normalized())
    normal = Vector(up).cross(tangents[0])
    if normal.length < 1e-4:
        normal = Vector((1, 0, 0)).cross(tangents[0])
    normal.normalize()
    rings = []
    tvals = {}
    for i, p in enumerate(path):
        t = i / (n - 1)
        if i > 0:
            # parallel transport
            axis = tangents[i - 1].cross(tangents[i])
            if axis.length > 1e-6:
                ang = tangents[i - 1].angle(tangents[i])
                from mathutils import Matrix
                normal = Matrix.Rotation(ang, 3, axis.normalized()) @ normal
        binormal = tangents[i].cross(normal).normalized()
        r = radius_fn(t)
        ring = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            v = bm.verts.new(p + normal * (math.cos(a) * r) + binormal * (math.sin(a) * r * flat))
            tvals[v] = t
            ring.append(v)
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(segs):
            k = (j + 1) % segs
            bm.faces.new((r0[j], r0[k], r1[k], r1[j]))
    tip = bm.verts.new(path[-1] + tangents[-1] * radius_fn(1) * 0.8)
    tvals[tip] = 1.0
    for j in range(segs):
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % segs], tip))
    base = bm.verts.new(path[0] - tangents[0] * radius_fn(0) * 0.5)
    tvals[base] = 0.0
    for j in range(segs):
        bm.faces.new((rings[0][(j + 1) % segs], rings[0][j], base))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    order = [tvals[v] for v in bm.verts]
    ob = mesh_object(name, bm, mat)
    ob['tvals'] = order
    return ob
