"""
Builds the Captain (cat) and the boat, exports public/models/captain.raw.glb and boat.raw.glb.
The Captain is one rig: expressions come from moving named parts (eyelids, mouths, ears,
arms, tail) in the game, so every pose is the same character.
Blender space: the Captain faces -Y (glTF +Z, towards the camera), Z up, sits at z = 0.
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402
from lib import (reset, paint, join, export, smooth, mesh_object, material, apply_mods, subdivide,  # noqa: E402
                 catmull, sweep, uv_sphere, fin, loft, keyed, lerp)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')


def apply_transform(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.select_set(False)


def set_origin(ob, point):
    """Move the object's origin to `point` without moving the geometry (for rotation pivots)."""
    p = Vector(point)
    ob.data.transform(Matrix.Translation(-p))
    ob.location = p


def metaball_mesh(name, balls, resolution=.022, mat='Fur'):
    """Organic union of spheres/ellipsoids, converted to a smooth mesh."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    ob = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(ob)
    for (co, r, scale) in balls:
        el = mb.elements.new()
        el.co = co
        el.radius = r
        if scale != (1, 1, 1):
            el.type = 'ELLIPSOID'
            el.size_x, el.size_y, el.size_z = scale
            el.radius = r
        el.stiffness = 2.0
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    m = bpy.context.view_layer.objects.active
    m.name = name
    m.data.materials.clear()
    m.data.materials.append(material(mat))
    for p in m.data.polygons:
        p.use_smooth = True
    return m


def deform_sphere(name, centre, radii, fn=None, segs=40, rings=28, mat='Coat'):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1)
    for v in bm.verts:
        p = v.co.copy()
        if fn:
            p = fn(p)
        v.co = Vector((centre[0] + p.x * radii[0], centre[1] + p.y * radii[1], centre[2] + p.z * radii[2]))
    return mesh_object(name, bm, mat)


def flat(ob, rgba=(0, 0, 0, 0)):
    paint(ob, lambda co, n: rgba)
    return ob


# ── The Captain ────────────────────────────────────────────────────────
def captain():
    reset()
    out = []
    HZ = 1.0  # head centre height

    # Head: one organic shape with cheek fluff and muzzle pads
    head = metaball_mesh('Head', [
        ((0, 0, HZ), .45, (1.12, 1.0, .95)),
        ((-.26, -.08, HZ - .12), .2, (1, 1, 1)),
        ((.26, -.08, HZ - .12), .2, (1, 1, 1)),
        ((-.32, -.02, HZ - .2), .12, (1, 1, 1)),
        ((.32, -.02, HZ - .2), .12, (1, 1, 1)),
        ((-.075, -.36, HZ - .13), .1, (1, .9, .85)),
        ((.075, -.36, HZ - .13), .1, (1, .9, .85)),
        ((0, -.3, HZ - .23), .09, (1, .9, .8)),
    ], mat='Fur')

    def head_mask(co, n):
        x, y, z = co
        muzzle = smooth((-.26 - y) / .08) * smooth((HZ - .02 - z) / .06)
        chin = smooth((HZ - .2 - z) / .06) * smooth((-.1 - y) / .1)
        return (max(muzzle, chin) * .95, 0, 0, 0)
    paint(head, head_mask)
    out.append(head)

    # Ears (separate, so they can twitch). Pivot at the base.
    for s, nm in ((-1, 'EarL'), (1, 'EarR')):
        bm = bmesh.new()
        base = [Vector((-.11, .0, 0)), Vector((.11, 0, 0)), Vector((0, .09, 0)), Vector((0, -.06, 0))]
        tip = Vector((0, .01, .26))
        vb = [bm.verts.new(v) for v in base]
        vt = bm.verts.new(tip)
        for i in range(4):
            bm.faces.new((vb[i], vb[(i + 1) % 4], vt))
        bm.faces.new(list(reversed(vb)))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ear = mesh_object(nm, bm, 'Fur')
        subdivide(ear, 2)
        inner = fin(nm + 'In', [(-.07, .01), (.07, .01), (0, .2)], .01, offset=(0, -.045, .02), plane='XZ', smooth_iters=1)
        inner.data.materials[0] = material('EarInner')
        flat(inner)
        flat(ear, (0, 0, 0, 0))
        e = join([ear, inner], nm)
        e.rotation_euler = (math.radians(-8), math.radians(s * 50), 0)
        e.location = (s * .3, .0, HZ + .07)
        apply_transform(e)
        set_origin(e, (s * .3, .0, HZ + .07))
        out.append(e)

    # Eyes (look slightly forward-down), with upper lids that can blink or narrow.
    for s, nm in ((-1, 'L'), (1, 'R')):
        c = Vector((s * .175, -.37, HZ + .04))
        eye = uv_sphere('Eye' + nm, .105, c, 'CatEye', segs=32, rings=22, scale=(1, .62, 1.06))

        def col(co, n, c=c):
            d = co - c
            dd = Vector((d.x / 1, d.y / .62, d.z / 1.06)).normalized()
            f = -dd.y
            ang = math.hypot(dd.x, dd.z)
            if f > .55 and abs(dd.x) < .1 and abs(dd.z) < .62:
                return (.02, .02, .03, 1)            # vertical slit pupil
            if f > .38:
                t = smooth((f - .38) / .5)
                return (.62 + .2 * t, .74 + .1 * t, .22, 1)  # amber-green iris
            return (.95, .93, .86, 1)
        paint(eye, col)
        eye.name = 'Eye' + nm
        out.append(eye)
        # Upper lid: a shell slightly larger than the eye, top half only. Pivot at eye centre.
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=22, radius=1)
        dele = [v for v in bm.verts if v.co.z < -.05]
        bmesh.ops.delete(bm, geom=dele, context='VERTS')
        for v in bm.verts:
            v.co = Vector((c.x + v.co.x * .118, c.y + v.co.y * .085, c.z + v.co.z * .125))
        lid = mesh_object('Lid' + nm, bm, 'Fur')
        sol = lid.modifiers.new('s', 'SOLIDIFY')
        sol.thickness = .012
        apply_mods(lid)
        paint(lid, lambda co, n: (0, 0, 0, 0))
        set_origin(lid, c)
        out.append(lid)

    # Nose
    nose = uv_sphere('Nose', .042, (0, -.47, HZ - .07), 'Nose', segs=20, rings=14, scale=(1.35, .8, .75))
    flat(nose)
    out.append(nose)

    # Mouths (one visible at a time)
    my = -.455
    frown = sweep('MouthFrown', catmull([(-.07, my, HZ - .19), (-.035, my - .01, HZ - .165), (0, my - .012, HZ - .16), (.035, my - .01, HZ - .165), (.07, my, HZ - .19)], 24),
                  lambda t: .009, segs=8, mat='Mouth')
    flat(frown)
    smile = fin('MouthSmile', [(-.075, -.0), (.075, 0), (.05, -.06), (0, -.08), (-.05, -.06)], .02, offset=(0, my + .01, HZ - .15), plane='XZ', smooth_iters=2)
    smile.data.materials[0] = material('Mouth')
    flat(smile)
    tongue = uv_sphere('Tongue', .03, (0, my - .006, HZ - .205), 'Tongue', segs=14, rings=10, scale=(1.2, .5, .7))
    flat(tongue)
    smile = join([smile, tongue], 'MouthSmile')
    oh = uv_sphere('MouthO', .035, (0, my + .005, HZ - .19), 'Mouth', segs=16, rings=12, scale=(.9, .4, 1.15))
    flat(oh)
    out += [frown, smile, oh]

    # Whiskers
    wh = []
    for s in (-1, 1):
        for k, (dz, spread) in enumerate(((.02, .1), (-.02, 0), (-.06, -.1))):
            st = Vector((s * .12, -.42, HZ - .12 + dz))
            pts = [st, st + Vector((s * .18, .03, spread * .5)), st + Vector((s * .36, .1, spread))]
            w = sweep(f'wh{s}{k}', catmull(pts, 12), lambda t: .005 * (1 - t * .7), segs=5, mat='Whisker')
            flat(w)
            wh.append(w)
    out.append(join(wh, 'Whiskers'))

    # Captain's hat
    def crown_ring(t):
        r = lerp(.35, .43, smooth(t))
        return (lerp(0, .24, t), 0, r * .96, r, 2.0, 0)
    crown = loft('Crown', 18, crown_ring, segs=40, cap_front=False)
    crown.rotation_euler = (0, math.radians(-90), 0)
    apply_transform(crown)
    top = deform_sphere('Top', (0, 0, .235), (.43, .41, .07), segs=40, rings=16, mat='Hat')
    crown.data.materials[0] = material('Hat')
    band = loft('Band', 6, lambda t: (lerp(-.005, .08, t), 0, .358 * .96, .358, 2.0, 0), segs=40, cap_front=False, cap_back=False)
    band.rotation_euler = (0, math.radians(-90), 0)
    apply_transform(band)
    band.data.materials[0] = material('HatBand')
    for o in (crown, top, band):
        flat(o)
    visor = fin('Visor', [(-.3, 0), (-.22, -.12), (0, -.2), (.22, -.12), (.3, 0)], .018, offset=(0, -.18, .01), plane='XY', smooth_iters=2, cup=-.12)
    visor.data.materials[0] = material('Visor')
    flat(visor)
    badge_ring = sweep('BadgeRing', catmull([(.032 * math.cos(a), -.36, .16 + .032 * math.sin(a)) for a in [i / 14 * 2 * math.pi for i in range(15)]], 30), lambda t: .007, segs=6, mat='Gold')
    shank = sweep('Shank', [Vector((0, -.37, .22)), Vector((0, -.37, .19)), Vector((0, -.37, .12))], lambda t: .007, segs=6, mat='Gold')
    for o in (badge_ring, shank):
        flat(o)
    hat = join([crown, top, band, visor, badge_ring, shank], 'Hat')
    hat.rotation_euler = (math.radians(-9), 0, 0)
    hat.scale = (.94, .94, .94)
    hat.location = (0, .03, HZ + .1)
    apply_transform(hat)
    set_origin(hat, (0, .03, HZ + .1))
    out.append(hat)

    # Body in a navy coat, cream chest, gold buttons
    def pear(p):
        if p.z < 0:
            p = Vector((p.x * (1 + .22 * -p.z), p.y * (1 + .18 * -p.z), p.z))
        return p
    coat = deform_sphere('Coat', (0, .02, .4), (.36, .32, .42), pear, mat='Coat')
    flat(coat)
    chest = metaball_mesh('Chest', [((0, -.24, .62), .16, (1, .7, 1.1)), ((0, -.27, .5), .11, (1, .6, 1))], resolution=.02, mat='Fur')
    paint(chest, lambda co, n: (1, 0, 0, 0))
    buttons = []
    for i in range(3):
        for s in (-1, 1):
            b = uv_sphere(f'btn{i}{s}', .026, (s * .1, -.315 + i * .012, .5 - i * .11), 'Gold', segs=12, rings=8, scale=(1, .55, 1))
            flat(b)
            buttons.append(b)
    out.append(join([coat] + buttons, 'Body'))
    out.append(chest)

    # Arms (pivot at the shoulder) with paws resting on the lap
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        sh = Vector((s * .31, -.04, .62))
        path = catmull([sh, sh + Vector((s * .06, -.1, -.14)), Vector((s * .22, -.28, .3))], 20)
        sleeve = sweep(nm + 'Sleeve', path, lambda t: .095 - .02 * t, segs=16, mat='Coat')
        flat(sleeve)
        paw = metaball_mesh(nm + 'Paw', [((s * .22, -.33, .28), .09, (1, 1.2, .8)), ((s * .2, -.38, .27), .05, (1, 1, .8))], resolution=.018, mat='Fur')
        paint(paw, lambda co, n: (.35, 0, 0, 0))
        arm = join([sleeve, paw], nm)
        set_origin(arm, sh)
        out.append(arm)

    # Tail curling round the front (pivot at its base)
    tp = catmull([(.18, .3, .1), (.4, .2, .06), (.46, -.1, .06), (.34, -.34, .08), (.12, -.42, .1)], 40)
    tail = sweep('Tail', tp, lambda t: .075 * (1 - t * .35), segs=14, mat='Fur')
    paint(tail, lambda co, n: (0, 0, 0, 0))
    set_origin(tail, (.18, .3, .1))
    out.append(tail)
    return out


# ── The boat ───────────────────────────────────────────────────────────
def boat():
    reset()
    L0, L1 = 1.35, -1.15

    def hull_shape(t):
        # t: 0 bow → 1 stern
        w = keyed([(0, .02), (.12, .3), (.35, .5), (.65, .52), (.9, .44), (1, .38)], t)
        depth = keyed([(0, .3), (.2, .4), (.6, .42), (1, .36)], t)
        sheer = keyed([(0, .58), (.15, .5), (.5, .44), (.85, .47), (1, .52)], t)
        return w, depth, sheer
    bm = bmesh.new()
    rings = []
    N, M = 40, 16
    for i in range(N):
        t = i / (N - 1)
        x = lerp(L0, L1, t)
        w, depth, sheer = hull_shape(t)
        ring = []
        for j in range(M + 1):
            a = math.pi * j / M  # 0..pi: left gunwale → keel → right gunwale
            yy = -math.cos(a) * w
            zz = sheer - math.sin(a) ** .8 * (sheer - (sheer - depth - .02)) - (sheer - .02) * 0
            zz = sheer - (math.sin(a) ** .75) * depth - .0
            ring.append(bm.verts.new((x, yy, zz)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(M):
            bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
    # transom (stern board)
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    hull = mesh_object('Hull', bm, 'Wood')
    sol = hull.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = .035
    apply_mods(hull)
    subdivide(hull, 1)

    def hull_mask(co, n):
        x, y, z = co
        under = smooth((.22 - z) / .14)
        return (under * .8, 0, 0, 0)
    paint(hull, hull_mask)
    parts = [hull]
    # gunwales
    for s in (-1, 1):
        pts = []
        for i in range(N):
            t = i / (N - 1)
            w, depth, sheer = hull_shape(t)
            pts.append(Vector((lerp(L0, L1, t), s * (w + .01), sheer + .01)))
        g = sweep(f'gun{s}', pts, lambda t: .03, segs=8, flat=1.4, mat='Trim')
        flat(g)
        parts.append(g)
    # seats
    for xs in (.45, -.45):
        t = (L0 - xs) / (L0 - L1)
        w, depth, sheer = hull_shape(t)
        seat = fin(f'seat{xs}', [(xs - .12, -w + .03), (xs + .12, -w + .03), (xs + .12, w - .03), (xs - .12, w - .03)], .045, offset=(0, 0, sheer - .12), plane='XY', smooth_iters=0)
        seat.data.materials[0] = material('Trim')
        flat(seat)
        parts.append(seat)
    # lantern post at the bow
    post = sweep('post', [Vector((1.02, 0, .3)), Vector((1.02, 0, 1.05)), Vector((1.02, 0, 1.38))], lambda t: .028, segs=10, mat='Trim')
    arm = sweep('arm', [Vector((1.02, 0, 1.36)), Vector((1.15, 0, 1.36)), Vector((1.28, 0, 1.34))], lambda t: .018, segs=8, mat='Trim')
    for o in (post, arm):
        flat(o)
    parts += [post, arm]
    hull_all = join(parts, 'Boat')
    # lantern (separate so it can sway)
    lp = Vector((1.28, 0, 1.2))
    frame_parts = []
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        bar = sweep(f'bar{dx}{dy}', [lp + Vector((dx * .07, dy * .07, -.11)), lp + Vector((dx * .07, dy * .07, .11))], lambda t: .01, segs=6, mat='Metal')
        flat(bar)
        frame_parts.append(bar)
    cap = deform_sphere('cap', (lp.x, lp.y, lp.z + .14), (.1, .1, .05), segs=16, rings=10, mat='Metal')
    base = deform_sphere('base', (lp.x, lp.y, lp.z - .13), (.095, .095, .03), segs=16, rings=10, mat='Metal')
    hook = sweep('hook', catmull([lp + Vector((0, 0, .19)), lp + Vector((0, 0, .15)), Vector((1.28, 0, 1.33))], 8), lambda t: .008, segs=6, mat='Metal')
    for o in (cap, base, hook):
        flat(o)
    glass = deform_sphere('glass', (lp.x, lp.y, lp.z), (.068, .068, .11), segs=20, rings=12, mat='Glass')
    flame = deform_sphere('flame', (lp.x, lp.y, lp.z - .02), (.028, .028, .05), segs=12, rings=8, mat='Flame')
    for o in (glass, flame):
        flat(o)
    lantern = join(frame_parts + [cap, base, hook], 'Lantern')
    glow = join([glass, flame], 'LanternGlow')
    set_origin(lantern, (1.28, 0, 1.34))
    set_origin(glow, (1.28, 0, 1.34))
    return [hull_all, lantern, glow]


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    which = argv or ['captain', 'boat']
    if 'captain' in which:
        objs = captain()
        export(os.path.join(OUT, 'captain.raw.glb'), objs)
        print('exported captain', sum(len(o.data.polygons) for o in objs), 'faces')
    if 'boat' in which:
        objs = boat()
        export(os.path.join(OUT, 'boat.raw.glb'), objs)
        print('exported boat', sum(len(o.data.polygons) for o in objs), 'faces')
