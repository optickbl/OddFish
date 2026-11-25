"""
The Logbook's oddities (besides the Old Boot): small props that mark achievements.
Same conventions as creatures.py: 'Body' parts carry the mask in COLOR_0
(R underside, G light, B dark); other materials are named trims.
Run:  python3 art/props.py [names...]
"""
import math
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402,F401
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
from lib import (reset, loft, uv_sphere, subdivide, paint, join, export, smooth, lerp,  # noqa: E402
                 mesh_object, apply_mods, catmull, sweep, keyed)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')
NONE = (0, 0, 0, 0)


def flat(ob, rgba=NONE):
    paint(ob, lambda co, n: rgba)
    return ob


def lathe(name, profile, mat, segs=40, n=60, cap_front=True, cap_back=True):
    """Round section along X; profile is [(t, radius)] keyed over x in [x0, x1]."""
    (x0, x1), keys = profile

    def ring(t):
        r = keyed(keys, t)
        r = r[0] if isinstance(r, tuple) else r
        return (lerp(x0, x1, t), 0, r, r, 2.0, 0)
    return loft(name, n, ring, segs=segs, mat=mat, cap_front=cap_front, cap_back=cap_back)


def solidify(ob, thickness):
    m = ob.modifiers.new('solid', 'SOLIDIFY')
    m.thickness = thickness
    m.offset = 0
    apply_mods(ob)


# ── Message in a Bottle ────────────────────────────────────────────────
def bottle():
    reset()
    glass = lathe('glass', ((0, .78), [(0, (.13,)), (.04, (.16,)), (.5, (.16,)), (.62, (.13,)), (.72, (.065,)), (.86, (.058,)), (.9, (.07,)), (.95, (.07,)), (1, (.06,))]), 'Glass', n=70)
    subdivide(glass, 1)
    flat(glass)
    cork = lathe('cork', ((.7, .86), [(0, (.05,)), (.8, (.055,)), (1, (.052,))]), 'Cork', segs=20, n=10)
    flat(cork)
    paper = lathe('paper', ((.1, .5), [(0, (.055,)), (1, (.055,))]), 'Paper', segs=24, n=6)
    flat(paper)
    paper.location.z = -.07
    twine = sweep('twine', catmull([(.3, .058 * math.cos(a), -.07 + .058 * math.sin(a)) for a in [i / 12 * 2 * math.pi for i in range(13)]], 30), lambda t: .008, segs=6, mat='Twine')
    flat(twine)
    for o in (paper, twine):
        o.select_set(True)
    return [glass, join([cork], 'Cork'), join([paper, twine], 'Scroll')], 'bottle'


# ── Perfect Pearl ──────────────────────────────────────────────────────
def shell_half(name, up):
    """A scallop: a ribbed fan, cupped, hinged at the origin."""
    bm = bmesh.new()
    nu, nv = 18, 48
    grid = []
    for i in range(nu + 1):
        u = i / nu
        row = []
        for j in range(nv + 1):
            v = lerp(-1.25, 1.25, j / nv)
            r = .05 + .34 * u
            rib = abs(math.sin(v * 7.5)) * .022 * u
            x = r * math.cos(v) * 1.0
            y = r * math.sin(v) * 1.08
            z = up * (.16 * u * u * (1 - .35 * abs(v)) + rib)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            a, b, c, d = grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]
            bm.faces.new((a, b, c, d) if up > 0 else (a, d, c, b))
    ob = mesh_object(name, bm, 'Body')
    solidify(ob, .018)
    subdivide(ob, 1)
    # ribs read lighter, the hinge darker
    paint(ob, lambda co, n: (.6 if up < 0 else 0, smooth((abs(math.sin(math.atan2(co.y, max(co.x, 1e-4)) * 7.5)) - .55) / .4) * .5, smooth((.12 - math.hypot(co.x, co.y)) / .08) * .6, 0))
    return ob


def pearl():
    reset()
    bottom = shell_half('bottom', -1)
    top = shell_half('top', 1)
    top.rotation_euler = (0, math.radians(-38), 0)
    top.location = (0, 0, .02)
    bpy.context.view_layer.objects.active = top
    top.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    top.select_set(False)
    gem = uv_sphere('pearl', .085, (.2, 0, .015), 'Pearl', segs=32, rings=20)
    flat(gem)
    return [join([bottom, top], 'Shell'), gem], 'pearl'


# ── Lucky Horseshoe ────────────────────────────────────────────────────
def horseshoe():
    reset()
    # Standing up, open end on top: the lucky way round.
    pts = []
    for i in range(25):
        a = lerp(-1.18, 1.18, i / 24) * math.pi * .62
        r = .3
        pts.append((r * math.sin(a) * 1.05, 0, -r * math.cos(a)))
    pts = [(pts[0][0] - .02, 0, pts[0][2] + .12)] + pts + [(pts[-1][0] + .02, 0, pts[-1][2] + .12)]
    path = catmull(pts, 90)
    shoe = sweep('shoe', path, lambda t: .052 * (1 - .15 * abs(t - .5)), segs=14, mat='Gold', flat=.45, up=(0, 1, 0))
    flat(shoe)
    nails = []
    for k in range(8):
        t = .14 + k * (.72 / 7)
        p = path[int(t * (len(path) - 1))]
        nails.append(uv_sphere(f'nail{k}', .013, (p.x, -.024, p.z), 'Iron', segs=10, rings=6, scale=(1, .5, 1)))
    for o in nails:
        flat(o)
    return [shoe, join(nails, 'Nails')], 'horseshoe'


# ── Treasure Chest ─────────────────────────────────────────────────────
def chest():
    reset()
    box = loft('box', 30, lambda t: (lerp(-.36, .36, t), .15, .15, .23, 7.0, 0), segs=40)
    lid = loft('lid', 30, lambda t: (lerp(-.37, .37, t), .3, .1, .235, 2.0, 0), segs=40)
    # flatten the lid's underside so it reads as a curved top
    for v in lid.data.vertices:
        if v.co.z < .3:
            v.co.z = .3 + (v.co.z - .3) * .15
    for o in (box, lid):
        subdivide(o, 1)

    def planks(co, n):
        groove = smooth((abs(math.sin(co.z * 34)) - .9) / .1) * smooth((.345 - abs(co.x)) / .01) if co.z < .29 else smooth((abs(math.sin(math.atan2(co.z - .3, co.y) * 5)) - .9) / .1) * smooth((.355 - abs(co.x)) / .01)
        return (smooth((.06 - co.z) / .06) * .6, 0, groove * .7, 0)
    paint(box, planks)
    paint(lid, planks)
    bands = []
    for x in (-.25, .25):
        ring = [(x, .24 * math.cos(a) if a < math.pi else .24 * math.cos(a), 0) for a in []]
        prof = [(x, -.242, -.003), (x, -.242, .3), (x, -.2, .37), (x, 0, .405), (x, .2, .37), (x, .242, .3), (x, .242, -.003)]
        bands.append(sweep(f'band{x}', catmull(prof, 40), lambda t: .02, segs=8, mat='Gold', flat=.35, up=(1, 0, 0)))
    lock = loft('lock', 8, lambda t: (lerp(-.05, .05, t), .27, .06, .02, 4.0, -.245), segs=16, mat='Gold')
    keyhole = uv_sphere('keyhole', .012, (0, -.266, .28), 'Iron', segs=10, rings=6)
    coins = []
    for k, (x, y, rot) in enumerate([(.2, -.34, .3), (.29, -.3, -.4), (.12, -.37, 1.1)]):
        c = lathe(f'coin{k}', ((-.006, .006), [(0, (.045,)), (1, (.045,))]), 'Gold', segs=24, n=3)
        c.rotation_euler = (0, math.radians(90), rot)
        c.location = (x, y, .007 + k * .004)
        bpy.context.view_layer.objects.active = c
        c.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        c.select_set(False)
        coins.append(c)
    for o in bands + [lock, keyhole] + coins:
        flat(o)
    return [join([box, lid], 'Chest'), join(bands + [lock] + coins, 'ChestGold'), keyhole], 'chest'


# ── Ship's Anchor ──────────────────────────────────────────────────────
def anchor():
    reset()
    shank = sweep('shank', [Vector((0, 0, -.42)), Vector((0, 0, .1)), Vector((0, 0, .44))], lambda t: .032 * (1.15 - .25 * t), segs=14, mat='Iron')
    ring = sweep('ring', catmull([(0, .06 * math.cos(a), .52 + .07 * math.sin(a)) for a in [i / 14 * 2 * math.pi for i in range(15)]], 36), lambda t: .014, segs=8, mat='Iron')
    stock = sweep('stock', [Vector((-.26, 0, .36)), Vector((0, 0, .36)), Vector((.26, 0, .36))], lambda t: .02 + .012 * (1 - abs(t - .5) * 2), segs=12, mat='Iron')
    arm_pts = [(-.34, 0, -.18), (-.3, 0, -.32), (-.16, 0, -.44), (0, 0, -.47), (.16, 0, -.44), (.3, 0, -.32), (.34, 0, -.18)]
    arms = sweep('arms', catmull(arm_pts, 50), lambda t: .03 * (1 - .35 * abs(t - .5) * 2), segs=12, mat='Iron')
    flukes = []
    for s in (-1, 1):
        bm = bmesh.new()
        tip = Vector((s * .34, 0, -.16))
        pts = [tip + Vector((0, 0, .1)), tip + Vector((s * .09, 0, -.06)), tip + Vector((-s * .03, 0, -.12))]
        vs = [bm.verts.new(p) for p in pts]
        bm.faces.new(vs if s > 0 else list(reversed(vs)))
        f = mesh_object(f'fluke{s}', bm, 'Iron')
        solidify(f, .035)
        subdivide(f, 1)
        flukes.append(f)
    rope = sweep('rope', catmull([(.05, .08, .5), (.1, .12, .3), (.02, .1, .1), (-.06, .08, -.1), (.02, .1, -.3), (.14, .14, -.4), (.24, .16, -.44)], 120),
                 lambda t: .016, segs=8, mat='Rope')
    for o in (shank, ring, stock, arms, rope, *flukes):
        flat(o)
    return [join([shank, ring, stock, arms] + flukes, 'Anchor'), rope], 'anchor'


BUILDERS = {'bottle': bottle, 'pearl': pearl, 'horseshoe': horseshoe, 'chest': chest, 'anchor': anchor}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    for nm in argv or list(BUILDERS):
        objs, file = BUILDERS[nm]()
        export(os.path.join(OUT, f'{file}.raw.glb'), objs)
        print('exported', nm, sum(len(o.data.polygons) for o in objs), 'faces')
