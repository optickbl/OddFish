"""
Builds the Oddfish creatures and exports them to public/models/*.raw.glb
(compressed to *.glb by art/build.sh).
Run:  python3 art/creatures.py [names...]
"""
import math
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
from lib import (reset, keyed, loft, uv_sphere, subdivide, paint, join, bend_weight,  # noqa: E402
                 export, smooth, lerp, fin, mesh_object, apply_mods, catmull, sweep, material)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')
os.makedirs(OUT, exist_ok=True)


# ── shared pieces ──────────────────────────────────────────────────────
def fish_eye(name, center, r, side, iris=(0.78, 0.63, 0.32), scale=(1, 0.55, 1), pupil=0.9):
    """A glossy fish eye: black pupil, metallic iris ring, pale surround."""
    ob = uv_sphere(name, r, center, 'Eye', segs=20, rings=14, scale=scale)
    c = Vector(center)

    def col(co, n):
        d = co - c
        d = Vector((d.x / scale[0], d.y / scale[1], d.z / scale[2])).normalized()
        f = d.y * side
        if f > pupil:
            return (0.01, 0.012, 0.018, 1)
        if f > pupil - 0.2:
            return (*iris, 1)
        return (0.5, 0.55, 0.6, 1)
    paint(ob, col)
    return ob


def ray_mask(base, n_rays, strength=0.62):
    """Faint fin rays radiating from a base point (x, z)."""
    bx, bz = base

    def f(x, z):
        a = math.atan2(z - bz, x - bx)
        return strength if abs(math.sin(a * n_rays)) > 0.93 else 0.0
    return f


def fin_part(name, spec, bend, colour):
    """spec: outline, t (thickness), offset, rot, plane, cup, base, rays, colour."""
    ob = fin(name, spec['outline'], spec.get('t', .012), spec.get('offset', (0, 0, 0)), spec.get('rot', (0, 0, 0)),
             spec.get('plane', 'XZ'), cup=spec.get('cup', 0))
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    bx, bz = spec.get('base', (0, 0))
    rmax = max(math.hypot(p.x - bx, p.z - bz) for p in pts) or 1

    def m(co, n):
        r = math.hypot(co.x - bx, co.z - bz) / rmax
        light, dark = colour(co, r)
        edge = smooth((r - .15) / .85)
        return (edge, light, dark, bend_weight(co.x, *bend))
    paint(ob, m)
    return ob


def build_fish(spec):
    X0, X1 = spec['x']
    keys = spec['keys']

    def ring(t):
        h, w, zc = keyed(keys, t)
        return (lerp(X0, X1, t), zc, h, w, spec.get('exp', 2.2), 0)
    body = loft('body', spec.get('rings', 46), ring, segs=spec.get('segs', 32))
    subdivide(body, 1)
    bend = spec['bend']

    def bm(co, n):
        x = co.x
        t = min(1, max(0, (X0 - x) / (X0 - X1)))
        h, w, zc = keyed(keys, t)
        r, g, b = spec['body_mask'](co, n, h, w, zc)
        return (r, g, b, bend_weight(x, *bend))
    paint(body, bm)
    parts = [body]
    for i, f in enumerate(spec['fins']):
        parts.append(fin_part(f'fin{i}', f, bend, f.get('colour', spec['fin_colour'])))
    parts += spec.get('extra', lambda: [])()
    fish = join(parts, spec['name'])
    e = spec['eye']
    eyes = [fish_eye(f'eye{s}', (e[0], s * e[1], e[2]), e[3], s, iris=spec.get('iris', (.78, .63, .32))) for s in (1, -1)]
    eye = join(eyes, spec['name'] + 'Eyes')
    return [fish, eye]


# ── Sardine: slender, silver-bellied, a row of dark spots ──────────────
def sardine():
    reset()
    keys = [(0, (.022, .016, -.008)), (.05, (.09, .066, -.002)), (.16, (.165, .102, .01)), (.34, (.2, .116, .02)),
            (.55, (.188, .102, .016)), (.78, (.118, .066, .01)), (.92, (.06, .034, .004)), (1, (.044, .022, 0))]
    spots = [(.52, .075), (.41, .08), (.3, .082), (.19, .08), (.08, .076), (-.03, .07)]

    def body_mask(co, n, h, w, zc):
        return 1 - smooth((co.z - zc) / .09), 0.0, 0.0

    def fin_colour(co, r):
        return 0, 0
    spec = dict(
        name='Sardine', x=(1.0, -.6), keys=keys, exp=2.3, bend=(.35, -1.0), body_mask=body_mask, fin_colour=fin_colour,
        eye=(.83, .058, .028, .06), iris=(.8, .7, .45),
        fins=[
            dict(outline=[(-.5, .05), (-.66, .16), (-.9, .36), (-1.0, .41), (-.9, .22), (-.79, .02), (-.9, -.22), (-1.0, -.41), (-.9, -.36), (-.66, -.16), (-.5, -.05)], t=.009, base=(-.52, 0)),
            dict(outline=[(.24, .12), (.13, .35), (.07, .38), (-.03, .25), (-.12, .12)], t=.007, base=(.06, .13)),
            dict(outline=[(-.2, -.1), (-.29, -.21), (-.44, -.2), (-.44, -.09)], t=.007, base=(-.3, -.09)),
            dict(outline=[(.12, -.13), (.06, -.25), (-.04, -.23), (-.02, -.12)], t=.007, base=(.05, -.13)),
            dict(outline=[(.64, -.02), (.54, -.07), (.34, -.13), (.3, -.1), (.46, -.02)], t=.006, offset=(0, .1, 0), rot=(.5, 0, 0), base=(.62, -.02)),
            dict(outline=[(.64, -.02), (.54, -.07), (.34, -.13), (.3, -.1), (.46, -.02)], t=.006, offset=(0, -.1, 0), rot=(-.5, 0, 0), base=(.62, -.02)),
        ],
    )
    return build_fish(spec), 'sardine'


# ── Clownfish: round, orange, three white bands with black margins ─────
def clownfish():
    reset()
    keys = [(0, (.04, .034, -.035)), (.08, (.2, .12, -.014)), (.25, (.35, .168, 0)), (.45, (.375, .17, .01)),
            (.68, (.3, .13, .01)), (.88, (.165, .072, .0)), (1, (.11, .046, 0))]
    bands = [(.5, .056), (.03, .072), (-.43, .036)]

    def band_at(x, z, zc):
        curve = 1.6 * (z - zc) ** 2
        light = dark = 0.0
        for i, (bx, bw) in enumerate(bands):
            d = abs(x - (bx + (curve if i < 2 else -curve * .5)))
            light = max(light, 1 - smooth((d - bw + .004) / .008))
            dark = max(dark, (1 - smooth((d - bw - .016) / .018)) * smooth((d - bw + .004) / .008))
        return light, dark

    def body_mask(co, n, h, w, zc):
        return smooth((zc - co.z - .06) / .22) * .55, 0.0, 0.0

    def fin_colour(co, r):
        return 0, smooth((r - .72) / .14)

    def tail_colour(co, r):
        return fin_colour(co, r)
    spec = dict(
        name='Clownfish', x=(.78, -.5), keys=keys, exp=2.0, rings=70, segs=36, bend=(.25, -.9), body_mask=body_mask, fin_colour=fin_colour,
        eye=(.58, .095, .07, .066), iris=(.96, .52, .12),
        fins=[
            dict(outline=[(-.4, .08), (-.55, .2), (-.76, .27), (-.87, .15), (-.9, 0), (-.87, -.15), (-.76, -.27), (-.55, -.2), (-.4, -.08)], t=.01, base=(-.44, 0), colour=tail_colour),
            dict(outline=[(.44, .2), (.36, .4), (.24, .46), (.12, .44), (.02, .37), (-.02, .25)], t=.009, base=(.22, .26)),
            dict(outline=[(.04, .26), (-.04, .46), (-.2, .53), (-.36, .45), (-.47, .25), (-.4, .17)], t=.009, base=(-.18, .26)),
            dict(outline=[(-.04, -.24), (-.14, -.45), (-.32, -.45), (-.43, -.22)], t=.009, base=(-.22, -.24)),
            dict(outline=[(.32, -.26), (.26, -.45), (.13, -.44), (.14, -.26)], t=.008, base=(.22, -.27)),
            dict(outline=[(.37, -.01), (.25, -.12), (.08, -.18), (.08, -.07), (.24, .03)], t=.008, offset=(0, .155, 0), rot=(.6, 0, .1), base=(.34, -.01)),
            dict(outline=[(.37, -.01), (.25, -.12), (.08, -.18), (.08, -.07), (.24, .03)], t=.008, offset=(0, -.155, 0), rot=(-.6, 0, -.1), base=(.34, -.01)),
        ],
    )
    return build_fish(spec), 'clownfish'


# ── Swordfish: torpedo body, tall sickle dorsal, long flat bill ─────────
def swordfish():
    reset()
    keys = [(0, (.06, .055, -.02)), (.1, (.15, .12, -.005)), (.3, (.215, .15, .02)), (.55, (.2, .13, .02)),
            (.8, (.1, .066, .01)), (.94, (.05, .034, .004)), (1, (.042, .028, 0))]
    X0, X1 = .62, -.92

    def body_mask(co, n, h, w, zc):
        return 1 - smooth((co.z - zc + .02) / .1), 0.0, 0.0

    def extra():
        def ring(t):
            return (lerp(.56, 1.42, t), lerp(-.02, -.005, t), lerp(.05, .004, t ** .8), lerp(.035, .004, t ** .8), 2.6, 0)
        bill = loft('bill', 30, ring, segs=14)
        paint(bill, lambda co, n: (.35, 0, 0, 0))
        return [bill]
    spec = dict(
        name='Swordfish', x=(X0, X1), keys=keys, exp=2.15, bend=(.2, -1.3), body_mask=body_mask,
        fin_colour=lambda co, r: (0, 0), extra=extra, eye=(.5, .085, .025, .05), iris=(.55, .75, .9),
        fins=[
            dict(outline=[(-.86, .03), (-.97, .26), (-1.13, .52), (-1.09, .27), (-1.03, 0), (-1.09, -.27), (-1.13, -.52), (-.97, -.26), (-.86, -.03)], t=.01, base=(-.9, 0)),
            dict(outline=[(.36, .16), (.3, .5), (.22, .62), (.16, .52), (.12, .3), (.02, .17)], t=.009, base=(.2, .18)),
            dict(outline=[(-.62, .06), (-.66, .14), (-.74, .13), (-.72, .05)], t=.007, base=(-.67, .06)),
            dict(outline=[(-.6, -.06), (-.66, -.14), (-.74, -.12), (-.72, -.04)], t=.007, base=(-.66, -.06)),
            dict(outline=[(.44, -.06), (.3, -.22), (.08, -.4), (.02, -.4), (.16, -.2), (.3, -.06)], t=.008, offset=(0, .13, 0), rot=(.7, 0, 0), base=(.4, -.06)),
            dict(outline=[(.44, -.06), (.3, -.22), (.08, -.4), (.02, -.4), (.16, -.2), (.3, -.06)], t=.008, offset=(0, -.13, 0), rot=(-.7, 0, 0), base=(.4, -.06)),
        ],
    )
    return build_fish(spec), 'swordfish'


# ── Leviathan: a great, gentle whale of the deep, with glowing gold markings ─
def leviathan():
    reset()
    keys = [(0, (.09, .09, -.03)), (.06, (.2, .19, -.01)), (.22, (.3, .27, .01)), (.42, (.29, .25, .02)),
            (.62, (.2, .17, .015)), (.8, (.11, .095, .01)), (.93, (.062, .05, .005)), (1, (.05, .036, 0))]
    X0, X1 = 1.2, -1.05
    spots = []
    for i in range(9):
        x = .7 - i * .17
        spots.append((x, .13 - i * .01, .018 + .004 * math.sin(i)))
        spots.append((x - .08, .05 - i * .008, .013))

    def body_mask(co, n, h, w, zc):
        return 1 - smooth((co.z - zc + .06) / .14), 0.0, 0.0

    def fin_colour(co, r):
        return (smooth((r - .82) / .12) * .8, 0)
    spec = dict(
        name='Leviathan', x=(X0, X1), keys=keys, exp=2.05, rings=54, segs=34, bend=(.6, -1.45), body_mask=body_mask,
        fin_colour=fin_colour, eye=(1.0, .135, .02, .04), iris=(1.0, .78, .3),
        fins=[
            dict(outline=[(-.98, .05), (-1.1, .28), (-1.28, .56), (-1.38, .6), (-1.3, .3), (-1.22, 0), (-1.3, -.3), (-1.38, -.6), (-1.28, -.56), (-1.1, -.28), (-.98, -.05)], plane='XY', t=.024, base=(-1.02, 0)),
            dict(outline=[(.66, -.02), (.56, -.15), (.34, -.31), (.06, -.45), (-.18, -.52), (-.14, -.42), (.12, -.29), (.36, -.12), (.46, .02)], t=.02, offset=(0, .21, 0), rot=(.95, 0, .18), base=(.56, -.02)),
            dict(outline=[(.66, -.02), (.56, -.15), (.34, -.31), (.06, -.45), (-.18, -.52), (-.14, -.42), (.12, -.29), (.36, -.12), (.46, .02)], t=.02, offset=(0, -.21, 0), rot=(-.95, 0, -.18), base=(.56, -.02)),
            dict(outline=[(-.26, .12), (-.34, .3), (-.46, .34), (-.5, .26), (-.48, .1)], t=.016, base=(-.38, .12)),
        ],
    )
    objs = build_fish(spec)
    return objs, 'leviathan'


# ── Octopus: soft mantle, eight curling arms with sucker rows ───────────
def octopus():
    reset()
    me_bm = bmesh.new()
    bmesh.ops.create_uvsphere(me_bm, u_segments=40, v_segments=28, radius=1)
    D = Vector((-.55, 0, .84)).normalized()
    for v in me_bm.verts:
        p = v.co.copy()
        k = p.dot(D)
        stretch = 1 + .75 * max(0, k) ** 1.6
        q = p + D * (k * (stretch - 1))
        q.z *= .92 if q.z > 0 else .62
        q *= .34
        q.z += .2
        q.x -= .05
        v.co = q
    mantle = mesh_object('mantle', me_bm, 'Body')
    subdivide(mantle, 1)

    def mantle_mask(co, n):
        return (smooth((.2 - co.z) / .4) * .6, 0, 0, 0)
    paint(mantle, mantle_mask)
    arms = []
    for i in range(8):
        a = (i + .5) / 8 * 2 * math.pi
        dx, dy = math.cos(a), math.sin(a)
        curl = 1 if i % 2 else -1
        ctrl = [(dx * .16, dy * .16, -.06), (dx * .4, dy * .4, -.2), (dx * .7, dy * .72, -.24),
                (dx * .92, dy * .95, -.16), (dx * 1.0 - dy * .12 * curl, dy * 1.03 + dx * .12 * curl, -.04),
                (dx * .9 - dy * .22 * curl, dy * .93 + dx * .22 * curl, .02)]
        path = catmull(ctrl, 46)
        arm = sweep(f'arm{i}', path, lambda t: .085 * (1 - t) ** .9 + .006, segs=12, flat=.85)
        tv = arm['tvals']
        me = arm.data
        ca = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                t = tv[vi]
                v = me.vertices[vi]
                under = v.normal.z < -.35
                sucker = 0.0
                if under and t > .05:
                    s = abs(math.sin(t * 46))
                    sucker = (1 - smooth((s - .2) / .4)) * .95
                belly = .85 if under else .1
                ca.data[li].color = (belly, sucker, 0, min(1, t * 1.3))
        me.color_attributes.active_color = ca
        arms.append(arm)
    body = join([mantle] + arms, 'Octopus')
    eyes = []
    for s in (1, -1):
        c = Vector((.17, s * .25, .2))
        e = uv_sphere(f'eye{s}', .085, c, 'Eye', segs=24, rings=16, scale=(1, .75, 1))

        def col(co, n, c=c, s=s):
            d = (co - c).normalized()
            f = d.y * s
            if f > .84 and abs(d.z) < .2:
                return (.01, .012, .02, 1)
            if f > .5:
                return (.9, .7, .3, 1)
            return (.88, .55, .5, 1)
        paint(e, col)
        eyes.append(e)
    eye = join(eyes, 'OctopusEyes')
    return [body, eye], 'octopus'


# ── Old Boot: waterlogged leather, brass eyelets, a strand of seaweed ───
def boot():
    reset()
    parts = []
    # vamp (foot), along X from heel to toe
    vk = [(0, (.2, .17, .2)), (.25, (.22, .19, .21)), (.55, (.16, .19, .16)), (.8, (.1, .17, .11)), (1, (.06, .1, .07))]

    def vring(t):
        h, w, zc = keyed(vk, t)
        return (lerp(-.32, .58, t), zc, h, w, 3.0, 0)
    vamp = loft('vamp', 36, vring, segs=28)
    # shaft, vertical: loft along X then stand it up
    sk = [(0, (.2, .19)), (.5, (.19, .18)), (1, (.22, .2))]

    def sring(t):
        h, w = keyed(sk, t)
        return (lerp(0, .62, t), 0, h, w, 2.4, 0)
    shaft = loft('shaft', 26, sring, segs=28, cap_back=False)
    shaft.rotation_euler = (0, math.radians(-96), 0)
    shaft.location = (-.16, 0, .24)
    for o in (shaft,):
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        o.select_set(False)
    for p in (vamp, shaft):
        subdivide(p, 1)

    def leather(co, n):
        return (smooth((.12 - co.z) / .1) * .5, 0, 0, 0)
    for p in (vamp, shaft):
        paint(p, leather)
    parts += [vamp, shaft]
    # sole + heel
    sole_pts = [(-.36, 0), (-.34, .17), (-.1, .2), (.3, .21), (.56, .15), (.66, 0), (.56, -.15), (.3, -.21), (-.1, -.2), (-.34, -.17)]
    sole = fin('sole', sole_pts, .07, offset=(0, 0, .005), plane='XY')
    sole.data.materials[0] = material('Sole')
    heel = fin('heel', [(-.36, 0), (-.34, .16), (-.12, .17), (-.12, -.17), (-.34, -.16)], .07, offset=(0, 0, -.05), plane='XY')
    heel.data.materials[0] = material('Sole')
    for p in (sole, heel):
        paint(p, lambda co, n: (0, 0, 0, 0))
    parts += [sole, heel]
    # collar roll at the top of the shaft
    collar = sweep('collar', catmull([(-.2 + .2 * math.cos(a), .19 * math.sin(a), .86) for a in [i / 12 * 2 * math.pi for i in range(13)]], 40), lambda t: .028, segs=10)
    paint(collar, lambda co, n: (.6, 0, .2, 0))
    parts.append(collar)
    # eyelets and laces up the front of the shaft
    metal = []
    lace_pts_l, lace_pts_r = [], []
    for k in range(5):
        z = .34 + k * .1
        for s in (1, -1):
            c = (-.01 + k * .004, s * .07, z)
            ring_pts = [(c[0] + .012 * math.cos(a) * 0, c[1] + .016 * math.cos(a), c[2] + .016 * math.sin(a)) for a in [i / 10 * 2 * math.pi for i in range(11)]]
            e = sweep(f'eyelet{k}{s}', catmull([(c[0] + .035, p[1], p[2]) for p in ring_pts], 20), lambda t: .006, segs=6, mat='Metal')
            paint(e, lambda co, n: (0, 0, 0, 0))
            metal.append(e)
        lace_pts_l.append((.03 + k * .004, .07, .34 + k * .1))
        lace_pts_r.append((.03 + k * .004, -.07, .34 + k * .1))
    laces = []
    zig = []
    for k in range(5):
        a, b = (lace_pts_l, lace_pts_r) if k % 2 == 0 else (lace_pts_r, lace_pts_l)
        zig += [a[k], b[k]]
    zig += [(.06, .03, .84), (.14, .1, .9), (.18, .16, .8)]
    lace = sweep('lace', catmull(zig, 90), lambda t: .011, segs=8, mat='Lace')
    paint(lace, lambda co, n: (0, 0, 0, 0))
    laces.append(lace)
    # seaweed strand draped over the top
    weed = sweep('weed', catmull([(-.34, .05, .9), (-.2, .12, .98), (-.02, .16, .9), (.06, .22, .7), (.04, .26, .52), (.1, .27, .4)], 60),
                 lambda t: .03 * (1 - t * .6), segs=8, flat=.25, mat='Weed')
    paint(weed, lambda co, n: (0, 0, 0, 0))
    leather_obj = join(parts, 'Boot')
    trim = join(metal + laces + [weed], 'BootTrim')
    return [leather_obj, trim], 'boot'


BUILDERS = {'sardine': sardine, 'clownfish': clownfish, 'swordfish': swordfish, 'leviathan': leviathan, 'octopus': octopus, 'boot': boot}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    names = argv or list(BUILDERS)
    for nm in names:
        objs, file = BUILDERS[nm]()
        export(os.path.join(OUT, f'{file}.raw.glb'), objs)
        print('exported', nm, sum(len(o.data.polygons) for o in objs), 'faces')
