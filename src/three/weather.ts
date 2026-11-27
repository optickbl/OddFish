import * as THREE from 'three';

/**
 * The sea changes with the player: a storm after a missed day, golden water on a long
 * streak, buoys that multiply as the Logbook fills, and a boat that dresses up for
 * streak milestones.
 */

export type Weather = 'calm' | 'storm' | 'golden';

export interface SeaLook {
  weather: Weather;
  buoys: number;
  boat: { pennant: boolean; lanterns: boolean; gold: boolean };
  outfit: { coat: string; band: string };
}

export interface WeatherPreset {
  calm: number;
  deep: THREE.Color;
  shallow: THREE.Color;
  sky: THREE.Color;
  horizon: THREE.Color;
  zenith: THREE.Color;
  moon: number;
  env: number;
  rain: number;
  key: number;
}

const C = (h: string) => new THREE.Color(h);

export const PRESETS: Record<Weather, WeatherPreset> = {
  calm: { calm: 0.75, deep: C('#0a2031'), shallow: C('#1f4a63'), sky: C('#2c5170'), horizon: C('#24465e'), zenith: C('#0a1828'), moon: 1, env: 0.7, rain: 0, key: 2.1 },
  storm: { calm: 1.45, deep: C('#06161c'), shallow: C('#183740'), sky: C('#2b3e46'), horizon: C('#1f2d33'), zenith: C('#070d10'), moon: 0.08, env: 0.45, rain: 1, key: 1.5 },
  golden: { calm: 0.6, deep: C('#1a2433'), shallow: C('#6b5330'), sky: C('#a67c3f'), horizon: C('#5c4630'), zenith: C('#141a2c'), moon: 1.25, env: 0.9, rain: 0, key: 2.4 },
};

/** Rain streaks in a box around the boat; they fall and wrap. */
export class Rain {
  lines: THREE.LineSegments;
  private pos: Float32Array;
  private mat: THREE.LineBasicMaterial;
  private n = 700;
  constructor() {
    this.pos = new Float32Array(this.n * 6);
    for (let i = 0; i < this.n; i++) this.place(i, Math.random() * 7);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xb8d4e6, transparent: true, opacity: 0, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
  }
  private place(i: number, y: number) {
    const x = -7 + Math.random() * 14;
    const z = -5 + Math.random() * 11;
    this.pos.set([x, y, z, x + 0.05, y + 0.32, z + 0.02], i * 6);
  }
  update(dt: number, amount: number) {
    this.mat.opacity = 0.42 * amount;
    this.lines.visible = amount > 0.02;
    if (!this.lines.visible) return;
    const fall = 9 * dt;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      this.pos[o + 1] -= fall;
      this.pos[o + 4] -= fall;
      this.pos[o] -= fall * 0.12;
      this.pos[o + 3] -= fall * 0.12;
      if (this.pos[o + 1] < 0) this.place(i, 6 + Math.random() * 1.5);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

/** Where buoys float: behind and beside the boat, clear of the catch spot and the camera. */
const BUOY_SPOTS: [number, number][] = [
  [-2.6, -1.4], [2.9, -1.8], [-3.6, 0.6], [3.9, 0.3], [-1.2, -2.9], [1.6, -3.3], [-4.6, -2.3], [4.8, -2.7], [0.2, -4.4], [-5.4, 0.9],
];

export function makeBuoys(): { group: THREE.Group; items: THREE.Group[] } {
  const group = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc8453a, roughness: 0.45, clearcoat: 0.6 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf1ebe0, roughness: 0.5, clearcoat: 0.4 });
  const light = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const items: THREE.Group[] = [];
  for (let i = 0; i < BUOY_SPOTS.length; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.22, 18), i % 2 ? white : red);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.125, 0.06, 18), i % 2 ? red : white);
    band.position.y = 0.06;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 16), i % 2 ? red : white);
    top.position.y = 0.2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), light);
    lamp.position.y = 0.31;
    b.add(body, band, top, lamp);
    b.position.set(BUOY_SPOTS[i][0], 0, BUOY_SPOTS[i][1]);
    b.userData.phase = i * 1.7;
    b.visible = false;
    group.add(b);
    items.push(b);
  }
  return { group, items };
}

/** Streak rewards on the boat: a pennant at the stern and a string of lanterns to the bow. */
export function makeDressing(): { pole: THREE.Object3D; flag: THREE.Mesh; string: THREE.Group } {
  const wood = new THREE.MeshPhysicalMaterial({ color: 0xa8774a, roughness: 0.55, clearcoat: 0.3 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.86, 8), wood);
  pole.position.set(-1.0, 0.86, 0);
  const geo = new THREE.BufferGeometry();
  // a long triangle, subdivided so it can ripple
  const segs = 10;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const h = 0.11 * (1 - u);
    verts.push(-u * 0.46, h, 0, -u * 0.46, -h, 0);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe7ad58, roughness: 0.6, side: THREE.DoubleSide }));
  flag.position.set(-1.0, 1.18, 0);
  flag.userData.base = new Float32Array(verts);
  const string = new THREE.Group();
  const a = new THREE.Vector3(1.02, 1.36, 0), b = new THREE.Vector3(-1.0, 1.26, 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * 0.22;
    pts.push(p);
  }
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2a1c }));
  string.add(rope);
  const colors = [0xffd38a, 0xff9a7a, 0xa8f0e0, 0xffe6a8];
  for (let i = 1; i < 10; i++) {
    const p = pts[i * 2];
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    bulb.position.copy(p).add(new THREE.Vector3(0, -0.035, 0));
    string.add(bulb);
  }
  pole.visible = flag.visible = string.visible = false;
  return { pole, flag, string };
}

/** Ripple the pennant in the wind. */
export function waveFlag(flag: THREE.Mesh, t: number, wind: number) {
  const base = flag.userData.base as Float32Array;
  const pos = flag.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const u = -x / 0.46;
    pos.setZ(i, Math.sin(t * (3 + wind * 3) + u * 6) * 0.05 * u * (1 + wind));
  }
  pos.needsUpdate = true;
}
