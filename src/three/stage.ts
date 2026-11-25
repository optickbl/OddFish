import * as THREE from 'three';
import type { TierId } from '../config';
import { speciesById } from '../content/creatures';
import { makeCaptain, type Captain, type Mood } from './captain';
import { has3D, loadModel, makeCreature, type Creature } from './creatures';
import { lightRig, makeRenderer, nightEnvironment } from './env';
import { clock, creatureMaterial, tickMaterials } from './materials';
import { makeOcean, makeSky, SEA_LEVEL } from './ocean';

/**
 * The one 3D scene behind the interface: a night sea, the Captain's boat, and whatever
 * the player just caught. Screens don't place the camera; they hand over a DOM element
 * and the stage frames its subject inside that element's box. So layouts, phones,
 * keyboards and scrolling all stay in charge of where things appear.
 */

export type StageMode = 'home' | 'question' | 'reveal' | 'results' | 'off';

export interface Stage {
  setMode(m: StageMode, anchor?: HTMLElement | null): void;
  /** The catch sequence. Resolves once the creature is fully out of the water. */
  reveal(species: string, tier: TierId, anchor: HTMLElement, instant?: boolean): Promise<void>;
  /** The day's haul floating in a row. */
  haul(species: string[], anchor: HTMLElement, mood: Mood): Promise<void>;
  /** The line went taut: the bobber dips. */
  bite(): void;
  mood(m: Mood): void;
  setReduced(r: boolean): void;
  dispose(): void;
}

interface Framing { look: THREE.Vector3; dir: THREE.Vector3; w: number; h: number }

const CATCH_SPOT = new THREE.Vector3(0.85, SEA_LEVEL, 2.1);
/** World length of each catch, so a Leviathan dwarfs the boat and a Sardine doesn't. */
const WORLD_LEN: Record<TierId, number> = { boot: 0.6, sardine: 0.85, clownfish: 0.8, octopus: 1.05, swordfish: 1.75, leviathan: 3.1 };
const RISE: Record<TierId, number> = { boot: 1.25, sardine: 0.75, clownfish: 0.85, octopus: 1.05, swordfish: 1.25, leviathan: 2.1 };
const STIR: Record<TierId, number> = { boot: 0.35, sardine: 0.25, clownfish: 0.3, octopus: 0.45, swordfish: 0.6, leviathan: 1.2 };

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeOutBack = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

function softDot(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small pool of points: splash droplets or rising sparkles. */
class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private mat: THREE.PointsMaterial;
  constructor(private n: number, color: number, size: number, tex: THREE.Texture, private gravity: number, additive: boolean) {
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, opacity: 1, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }
  emit(at: THREE.Vector3, count: number, spread: number, up: [number, number], radius = 0.25) {
    let k = 0;
    for (let i = 0; i < this.n && k < count; i++) {
      if (this.life[i] > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.pos.set([at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r], i * 3);
      const s = spread * (0.4 + Math.random() * 0.6);
      this.vel.set([Math.cos(a) * s, up[0] + Math.random() * (up[1] - up[0]), Math.sin(a) * s], i * 3);
      this.life[i] = 0.7 + Math.random() * 0.9;
      k++;
    }
    this.points.visible = true;
  }
  update(dt: number) {
    if (!this.points.visible) return;
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -50; continue; }
      alive++;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.gravity > 0 && this.pos[i * 3 + 1] < SEA_LEVEL) this.life[i] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    if (!alive) this.points.visible = false;
  }
  clear() {
    this.life.fill(0);
    this.points.visible = false;
  }
}

/** A soft column of gold light for a Leviathan. */
function lightBeam(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.55, 1.5, 9, 40, 1, true);
  geo.translate(0, 4.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uA, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float face = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float h = pow(1.0 - vUv.y, 3.2) * smoothstep(0.0, 0.05, vUv.y);
        float streak = 0.75 + 0.25 * sin(vUv.x * 60.0 + uTime * 0.8) * sin(vUv.x * 23.0 - uTime * 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * face * h * streak * uA, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  m.renderOrder = 5;
  return m;
}

function makeBobber(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xd8553f, roughness: 0.35, clearcoat: 0.8 }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xf4eee2, roughness: 0.4, clearcoat: 0.6 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b2b }));
  stem.position.y = 0.1;
  g.add(top, bot, stem);
  return g;
}

export async function createStage(canvas: HTMLCanvasElement): Promise<Stage> {
  const renderer = makeRenderer(canvas, false);
  renderer.setClearColor(0x10243a, 1);
  const scene = new THREE.Scene();
  scene.environment = nightEnvironment(renderer);
  scene.environmentIntensity = 0.7;
  const rig = lightRig(scene);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const sky = makeSky();
  const ocean = makeOcean();
  scene.add(sky, ocean.mesh);

  // ── Boat and Captain ──
  const boat = (await loadModel('boat.glb')).clone(true);
  const wood = creatureMaterial({ main: '#8a5636', belly: '#5a3622', light: '#efe2c6', dark: '#3c2414', roughness: 0.6 }, { style: 'none', speed: 0, freq: 0, amp: 0 }, false, 'wood');
  wood.clearcoat = 0.3;
  const boatMats: Record<string, THREE.Material> = {
    Trim: new THREE.MeshPhysicalMaterial({ color: 0xa8774a, roughness: 0.55, clearcoat: 0.3 }),
    Metal: new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.85, roughness: 0.35 }),
    Glass: new THREE.MeshPhysicalMaterial({ color: 0xffd49a, emissive: 0xffa850, emissiveIntensity: 2.2, roughness: 0.1, transparent: true, opacity: 0.7 }),
    Flame: new THREE.MeshBasicMaterial({ color: 0xfff3d0 }),
  };
  boat.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name;
    m.material = name === 'Wood' ? wood : boatMats[name] ?? m.material;
    m.frustumCulled = false;
  });
  const boatRig = new THREE.Group();
  boatRig.add(boat);
  const captain: Captain = await makeCaptain();
  captain.root.scale.setScalar(0.5);
  captain.root.position.set(-0.52, 0.3, 0.02);
  captain.root.rotation.y = 0.32;
  boatRig.add(captain.root);
  scene.add(boatRig);
  const lanternNode = boat.getObjectByName('Lantern');
  const glowNode = boat.getObjectByName('LanternGlow');
  rig.lantern.distance = 6;

  const bobber = makeBobber();
  scene.add(bobber);

  // Catch lighting and effects
  const spot = new THREE.PointLight(0xffe4c0, 0, 7, 1.3);
  scene.add(spot);
  const dot = softDot();
  const splash = new Particles(140, 0xe9f4ff, 0.04, dot, 6.5, false);
  const sparkle = new Particles(90, 0xffd889, 0.075, dot, -0.25, true);
  scene.add(splash.points, sparkle.points);
  const beam = lightBeam();
  scene.add(beam);

  // ── Camera framing ──
  const BOAT_SHOT: Framing = { look: new THREE.Vector3(0.12, 0.72, 0), dir: new THREE.Vector3(0.3, 0.13, 1).normalize(), w: 3.25, h: 1.85 };
  let framing: Framing = BOAT_SHOT;
  let anchor: HTMLElement | null = null;
  const cam = { look: BOAT_SHOT.look.clone(), dir: BOAT_SHOT.dir.clone(), d: 8, ox: 0, oy: 0, fov: 34 };
  let snap = true;
  /** Seconds left of easing toward a new shot; after that the camera tracks its box exactly (scrolling). */
  let settle = 0;
  let W = 1, H = 1;

  function target() {
    const aspect = W / H;
    // ~28° across on a phone; never narrower than 34° tall on wide screens.
    const fov = Math.max(34, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(14)) / aspect)));
    const r = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
    const box = r && r.width > 10 && r.height > 10 ? r : { left: 0, top: H * 0.15, width: W, height: H * 0.45 };
    const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const d = Math.max((framing.w * H) / (box.width * 2 * t), (framing.h * H) / (box.height * 2 * t));
    return { fov, d, ox: W / 2 - (box.left + box.width / 2), oy: H / 2 - (box.top + box.height / 2) };
  }

  function placeCamera(dt: number) {
    const tg = target();
    settle = Math.max(0, settle - dt);
    const k = snap || reduced || settle <= 0 ? 1 : 1 - Math.exp(-dt * 3.2);
    snap = false;
    cam.look.lerp(framing.look, k);
    cam.dir.lerp(framing.dir, k).normalize();
    cam.d += (tg.d - cam.d) * k;
    cam.ox += (tg.ox - cam.ox) * k;
    cam.oy += (tg.oy - cam.oy) * k;
    cam.fov += (tg.fov - cam.fov) * k;
    const t = clock.t;
    const sway = reduced ? 0 : 1;
    camera.position.copy(cam.look).addScaledVector(cam.dir, cam.d);
    camera.position.x += Math.sin(t * 0.21) * 0.05 * sway;
    camera.position.y += Math.sin(t * 0.33) * 0.03 * sway;
    camera.fov = cam.fov;
    camera.setViewOffset(W, H, cam.ox, cam.oy, W, H);
    camera.lookAt(cam.look);
  }

  // ── State ──
  let mode: StageMode = 'off';
  let reduced = false;
  interface Shown { c: Creature; tier: TierId; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; yaw: number; slot?: number }
  let shown: Shown[] = [];
  let bobState: 'hidden' | 'float' | 'dip' = 'hidden';
  let bobT = 0;
  let legend = 0;
  let legendTarget = 0;
  let token = 0;

  function clearCatch() {
    token++;
    for (const s of shown) {
      scene.remove(s.c.root);
      s.c.dispose();
    }
    shown = [];
    spot.intensity = 0;
    legendTarget = 0;
    splash.clear();
    sparkle.clear();
  }

  async function build(species: string, len: number): Promise<Creature | null> {
    const art = speciesById(species)?.art ?? species;
    if (!has3D(art)) return null;
    const c = await makeCreature(species);
    const box = new THREE.Box3().setFromObject(c.root);
    const size = box.getSize(new THREE.Vector3());
    c.root.scale.setScalar(len / Math.max(size.x, size.z));
    return c;
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

  async function reveal(species: string, tier: TierId, el: HTMLElement, instant = false) {
    clearCatch();
    const quick = instant || reduced;
    const my = token;
    const c = await build(species, WORLD_LEN[tier]);
    if (my !== token) { c?.dispose(); return; }
    const len = WORLD_LEN[tier];
    const box = c ? new THREE.Box3().setFromObject(c.root).getSize(new THREE.Vector3()) : new THREE.Vector3(len, len * 0.5, len * 0.3);
    const hover = new THREE.Vector3(CATCH_SPOT.x + (tier === 'leviathan' ? 0.35 : 0), SEA_LEVEL + 0.32 + box.y * 0.5, CATCH_SPOT.z + (tier === 'leviathan' ? 0.6 : 0));
    // Frame the catch in the reveal box, the boat behind it for scale.
    framing = { look: hover.clone().add(new THREE.Vector3(0, -0.03, 0)), dir: new THREE.Vector3(tier === 'leviathan' ? 0.05 : 0.1, 0.16, 1).normalize(), w: Math.max(tier === 'boot' ? 1.7 : 1.3, len * 1.3), h: Math.max(1.0, box.y * 2.3) };
    anchor = el;
    mode = 'reveal';
    settle = instant ? 0 : 1.6;
    if (instant) snap = true;
    kick();

    // 1. The water stirs where the line went down.
    if (instant) bobState = 'hidden';
    else if (bobState === 'float') { bobState = 'dip'; bobT = 0; }
    if (!instant) ocean.ripple(CATCH_SPOT.x, CATCH_SPOT.z, clock.t, tier === 'leviathan' ? 1.8 : tier === 'boot' ? 0.5 : 1);
    if (tier === 'leviathan') { legendTarget = 1; captain.setMood(instant ? 'excited' : 'shocked'); }
    else if (tier === 'swordfish' && !instant) captain.setMood('thinking');
    if (!quick) await wait(STIR[tier] * 1000);
    if (my !== token) return;

    // 2. It breaks the surface.
    if (c) {
      const from = hover.clone();
      from.y = SEA_LEVEL - box.y * 0.9 - 0.2;
      c.root.position.copy(from);
      scene.add(c.root);
      shown = [{ c, tier, from, to: hover, t0: clock.t, dur: quick ? 0.01 : RISE[tier], yaw: tier === 'boot' ? 0.2 : -0.45 }];
    }
    spot.position.set(hover.x + 1.2, hover.y + 1.6, hover.z + 2.2);
    spot.color.set(tier === 'leviathan' ? 0xffd28a : 0xffe6c6);
    const mood: Mood = tier === 'boot' ? 'disappointed' : tier === 'sardine' ? 'idle' : tier === 'clownfish' || tier === 'octopus' ? 'happy' : 'excited';
    if (instant) {
      if (tier !== 'leviathan') captain.setMood(mood);
      return;
    }
    const spray = tier === 'leviathan' ? 140 : tier === 'boot' ? 18 : tier === 'swordfish' ? 70 : 40;
    splash.emit(new THREE.Vector3(hover.x, SEA_LEVEL, hover.z), spray, tier === 'leviathan' ? 2.4 : 1.3, tier === 'leviathan' ? [2.8, 5.2] : [1.6, 3.4], tier === 'leviathan' ? 0.9 : 0.25);
    ocean.ripple(hover.x, hover.z, clock.t, tier === 'leviathan' ? 2 : 1.1);

    // 3. Rarer catches get light, sparkle and a bigger reaction.
    if (tier !== 'leviathan') captain.setMood(mood);
    const sparkles = { boot: 0, sardine: 0, clownfish: 10, octopus: 26, swordfish: 50, leviathan: 90 }[tier];
    if (sparkles) setTimeout(() => my === token && sparkle.emit(hover.clone().setY(hover.y - box.y * 0.2), sparkles, 0.55, [0.25, 0.9], len * 0.45), reduced ? 0 : RISE[tier] * 450);
    if (tier === 'leviathan') setTimeout(() => my === token && captain.setMood('excited'), reduced ? 0 : 1500);
    await wait(RISE[tier] * 800);
  }

  async function haul(list: string[], el: HTMLElement, m: Mood) {
    clearCatch();
    const my = token;
    const n = list.length;
    const slot = 0.82;
    const cs = await Promise.all(list.map((s) => {
      const tier = (speciesById(s)?.tier ?? 'boot') as TierId;
      return build(s, tier === 'leviathan' ? 1.05 : tier === 'boot' ? 0.42 : 0.72);
    }));
    if (my !== token) { cs.forEach((c) => c?.dispose()); return; }
    // One row on wide screens; on phones two staggered rows so each catch stays readable.
    const rows = W / H < 0.9 && n > 4 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const width = perRow * slot;
    const centre = new THREE.Vector3(0.15, SEA_LEVEL + 0.48, 1.75);
    framing = { look: centre.clone().add(new THREE.Vector3(0, rows === 2 ? 0.05 : 0.2, rows === 2 ? -0.1 : -0.6)), dir: new THREE.Vector3(0.04, 0.3, 1).normalize(), w: Math.max(rows === 2 ? 2.6 : 3.0, width + 0.35), h: rows === 2 ? 1.7 : 1.9 };
    anchor = el;
    const wasOff = mode === 'off';
    mode = 'results';
    settle = 1.6;
    if (wasOff) snap = true;
    kick();
    cs.forEach((c, i) => {
      if (!c) return;
      const tier = (speciesById(list[i])?.tier ?? 'boot') as TierId;
      const row = rows === 2 && i >= perRow ? 1 : 0;
      const j = row ? i - perRow : i;
      const inRow = row ? n - perRow : perRow;
      const x = -((inRow - 1) * slot) / 2 + slot * j;
      const to = centre.clone().add(new THREE.Vector3(x, (row ? -0.34 : 0) + Math.sin((j / Math.max(1, inRow - 1)) * Math.PI) * 0.05, row ? 0.55 : 0));
      const from = to.clone();
      from.y = SEA_LEVEL - 0.5;
      c.root.position.copy(from);
      scene.add(c.root);
      shown.push({ c, tier, from, to, t0: clock.t + (reduced ? 0 : 0.25 + i * 0.13), dur: reduced ? 0.01 : 0.7, yaw: -0.5, slot: i });
    });
    captain.setMood(m);
  }

  // ── Frame loop ──
  let last = performance.now() / 1000;
  let visible = document.visibilityState === 'visible';
  let raf = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let slowFrames = 0;
  let maxDpr = dpr;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, true);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  let lastDrawn = 0;
  function frame() {
    raf = 0;
    if (mode === 'off' || !visible) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    // Home is calm: 30 fps there saves battery. Game moments run at full rate.
    if (mode === 'home' && now - lastDrawn < 1 / 32) return;
    lastDrawn = now;
    const dt = Math.min(0.1, now - last);
    last = now;
    // Keep phones smooth: step resolution down if frames run long.
    if (dt > (mode === 'home' ? 0.045 : 0.026)) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 40 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.25);
      slowFrames = 0;
      resize();
    }
    clock.t += dt;
    const t = clock.t;
    placeCamera(dt);
    sky.position.copy(camera.position);
    (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    ocean.uniforms.uTime.value = t;

    // boat rides the swell
    const motion = reduced ? 0.25 : 1;
    const h = ocean.heightAt(0.1, 0, t);
    const hb = ocean.heightAt(1.2, 0, t), hs = ocean.heightAt(-1.0, 0, t);
    const hf = ocean.heightAt(0.1, 0.5, t), hk = ocean.heightAt(0.1, -0.5, t);
    boatRig.position.y = SEA_LEVEL + (h - SEA_LEVEL) * motion - 0.25;
    boatRig.rotation.z = Math.atan2(hb - hs, 2.2) * motion;
    boatRig.rotation.x = -Math.atan2(hf - hk, 1.0) * 0.6 * motion;
    const swing = Math.sin(t * 1.4) * 0.07 * motion;
    if (lanternNode) lanternNode.rotation.x = swing;
    if (glowNode) glowNode.rotation.x = swing;
    const flicker = 0.92 + Math.sin(t * 13.0) * 0.03 + Math.sin(t * 7.3 + 1.0) * 0.05;
    const lp = new THREE.Vector3(1.28, 1.16, 0);
    boatRig.localToWorld(lp);
    rig.lantern.position.copy(lp);
    rig.lantern.intensity = 2.6 * flicker;
    (ocean.uniforms.uLantern.value as THREE.Vector3).copy(lp);
    ocean.uniforms.uLanternI.value = flicker;
    captain.update(t, dt);

    // bobber
    if (bobState !== 'hidden') {
      bobT += dt;
      const wy = ocean.heightAt(CATCH_SPOT.x, CATCH_SPOT.z, t);
      const dip = bobState === 'dip' ? Math.min(1, bobT / 0.25) : 0;
      bobber.visible = dip < 1;
      bobber.position.set(CATCH_SPOT.x, wy + 0.02 - dip * 0.3 + (bobState === 'float' ? Math.sin(t * 2.3) * 0.012 : 0), CATCH_SPOT.z);
      bobber.rotation.z = Math.sin(t * 1.7) * 0.15 * motion;
    } else bobber.visible = false;

    // catches
    for (const s of shown) {
      const u = (t - s.t0) / s.dur;
      const leviathan = s.tier === 'leviathan';
      const e = s.slot !== undefined ? easeOutBack(u) : leviathan ? ease(u) : easeOutBack(u);
      s.c.root.position.lerpVectors(s.from, s.to, Math.max(0, e));
      const idle = Math.max(0, t - s.t0 - s.dur) * motion;
      const ph = (s.slot ?? 0) * 1.3;
      s.c.root.position.y += Math.sin(idle * 1.5 + ph) * (s.tier === 'boot' ? 0.05 : 0.035);
      const spin = (1 - Math.min(1, Math.max(0, u))) * (leviathan ? 0.6 : s.tier === 'boot' ? 0.3 : 1.4);
      s.c.root.rotation.y = s.yaw + spin + Math.sin(idle * 0.45 + ph) * (s.tier === 'boot' ? 0.1 : 0.32);
      s.c.root.rotation.z = s.tier === 'boot' ? Math.sin(idle * 1.2) * 0.1 : (1 - Math.min(1, Math.max(0, u))) * (leviathan ? -0.35 : 0.5);
      s.c.root.rotation.x = s.tier === 'boot' ? 0.15 + Math.sin(idle * 0.8) * 0.06 : 0;
      s.c.setExcite(u < 1.4 ? Math.max(0, 1.4 - u) / 1.4 : 0);
      tickMaterials(s.c.root, t);
    }
    if (shown.length === 1 && shown[0].slot === undefined) {
      const tier = shown[0].tier;
      const want = tier === 'leviathan' ? 4.5 : tier === 'swordfish' ? 6 : tier === 'boot' ? 2.5 : 5;
      spot.intensity += (want * ease((t - shown[0].t0) / 0.8) - spot.intensity) * Math.min(1, dt * 6);
    }
    // a Leviathan: the sea brightens, the moonlight warms, a column of light comes down
    legend += (legendTarget - legend) * Math.min(1, dt * 1.6);
    scene.environmentIntensity = 0.7 + legend * 0.45;
    rig.key.intensity = 2.1 + legend * 0.4;
    beam.visible = legend > 0.01;
    if (beam.visible && shown[0]) {
      beam.position.set(shown[0].to.x, SEA_LEVEL - 0.1, shown[0].to.z - 0.2);
      const m = beam.material as THREE.ShaderMaterial;
      m.uniforms.uA.value = legend * 0.6;
      m.uniforms.uTime.value = t;
    }
    splash.update(dt);
    sparkle.update(dt);
    renderer.render(scene, camera);
  }

  function kick() {
    if (!raf && mode !== 'off' && visible) {
      last = performance.now() / 1000;
      raf = requestAnimationFrame(frame);
    }
  }

  const onVis = () => {
    visible = document.visibilityState === 'visible';
    kick();
  };
  const onResize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    resize();
    // render immediately so the canvas never shows a stretched frame
    if (mode !== 'off') { placeCamera(1); renderer.render(scene, camera); }
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', onResize);
  resize();
  maxDpr = dpr;

  return {
    setMode(m, el = null) {
      if (m !== 'reveal' && m !== 'results') clearCatch();
      const wasOff = mode === 'off';
      mode = m;
      anchor = el;
      if (m === 'home' || m === 'question') {
        framing = m === 'question'
          ? { look: new THREE.Vector3(0.45, 0.5, 1.0), dir: new THREE.Vector3(0.22, 0.2, 1).normalize(), w: 3.4, h: 2.0 }
          : BOAT_SHOT;
        bobState = m === 'question' ? 'float' : 'hidden';
        bobT = 0;
        captain.setMood(m === 'question' ? 'thinking' : 'idle');
      }
      if (wasOff) snap = true;
      settle = 1.6;
      kick();
    },
    reveal,
    haul,
    bite() {
      bobState = 'dip';
      bobT = 0;
      ocean.ripple(CATCH_SPOT.x, CATCH_SPOT.z, clock.t, 0.7);
    },
    mood: (m) => captain.setMood(m),
    setReduced(r) {
      reduced = r;
    },
    dispose() {
      mode = 'off';
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
