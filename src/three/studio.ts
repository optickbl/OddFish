import * as THREE from 'three';
import { speciesById } from '../content/creatures';
import { has3D, makeCreature, type Creature } from './creatures';
import { lightRig, makeRenderer, nightEnvironment } from './env';
import { clock, tickMaterials } from './materials';

/**
 * A small light-box for single creatures: Logbook thumbnails (rendered once, kept as
 * images) and the drag-to-turn inspector. One WebGL context, shared by both.
 */

const TW = 240, TH = 160;

let studio: Promise<Studio> | null = null;

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
}

function makeBox(): Studio {
  const canvas = document.createElement('canvas');
  const renderer = makeRenderer(canvas, true);
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.environment = nightEnvironment(renderer);
  scene.environmentIntensity = 0.85;
  lightRig(scene);
  const camera = new THREE.PerspectiveCamera(26, TW / TH, 0.1, 50);
  return { renderer, scene, camera, canvas };
}

/** The thumbnail box lives for the session; the inspector gets its own while open. */
function getStudio(): Promise<Studio> {
  if (!studio) studio = Promise.resolve().then(makeBox);
  return studio;
}

/** Fit the camera to a creature, three-quarter view. */
function frame(s: Studio, c: Creature, aspect: number, margin = 1.12) {
  const box = new THREE.Box3().setFromObject(c.root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const t = Math.tan(THREE.MathUtils.degToRad(s.camera.fov / 2));
  const d = Math.max(size.y / 2 / t, size.x / 2 / (t * aspect)) * margin + size.z / 2;
  s.camera.aspect = aspect;
  s.camera.updateProjectionMatrix();
  s.camera.position.set(centre.x, centre.y + d * 0.12, centre.z + d);
  s.camera.lookAt(centre);
}

const thumbs = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

const artOf = (species: string) => speciesById(species)?.art ?? species;
export const hasModel = (species: string) => has3D(artOf(species));

/**
 * A still image of a species (or its shadowy silhouette), as an object URL. Renders
 * one at a time so the page stays responsive; repeated requests share the result.
 */
export function thumbnail(species: string, silhouette: boolean): Promise<string | null> {
  if (!hasModel(species)) return Promise.resolve(null);
  // Every variant of a creature shares one silhouette.
  const key = silhouette ? `sil:${artOf(species)}` : species;
  let p = thumbs.get(key);
  if (p) return p;
  p = (chain = chain.then(async () => {
    const s = await getStudio();
    const c = await makeCreature(species);
    c.root.rotation.y = -0.55;
    c.root.rotation.x = 0.06;
    c.setSilhouette(silhouette);
    s.scene.add(c.root);
    s.renderer.setSize(TW * 2, TH * 2, false);
    frame(s, c, TW / TH, artOf(species) === 'octopus' ? 1.0 : 1.08);
    tickMaterials(c.root, 1.3);
    s.renderer.render(s.scene, s.camera);
    const blob = await new Promise<Blob | null>((r) => s.canvas.toBlob(r, 'image/png'));
    s.scene.remove(c.root);
    c.dispose();
    await new Promise((r) => setTimeout(r, 0));
    return blob ? URL.createObjectURL(blob) : null;
  }).catch((e) => {
    console.warn('thumbnail failed', species, e);
    return null;
  })) as Promise<string | null>;
  thumbs.set(key, p);
  return p;
}

/**
 * A live, rotatable view inside `host`. Drag (or use arrow keys on the host) to turn it.
 * Returns a function that stops it.
 */
export async function inspect(host: HTMLElement, species: string, reduced: boolean): Promise<() => void> {
  const s = makeBox();
  const c = await makeCreature(species);
  s.scene.add(c.root);
  host.appendChild(s.canvas);
  let yaw = -0.55, pitch = 0.06, vy = reduced ? 0 : 0.35, dragging = false, lastX = 0, lastY = 0, stopped = false;
  // Frame the bounding sphere, so it never clips whichever way it's turned.
  const sphere = new THREE.Box3().setFromObject(c.root).getBoundingSphere(new THREE.Sphere());
  const size = () => {
    const w = host.clientWidth || 280, h = host.clientHeight || 200;
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    s.renderer.setSize(w, h, false);
    const aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(s.camera.fov / 2));
    const d = (sphere.radius * 0.92) / Math.min(t, t * aspect) + sphere.radius * 0.2;
    s.camera.aspect = aspect;
    s.camera.updateProjectionMatrix();
    s.camera.position.set(sphere.center.x, sphere.center.y + d * 0.1, sphere.center.z + d);
    s.camera.lookAt(sphere.center);
  };
  size();
  const down = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    host.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.012;
    pitch = Math.max(-0.6, Math.min(0.6, pitch + dy * 0.008));
    vy = dx * 0.6;
  };
  const up = () => (dragging = false);
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { yaw -= 0.3; e.preventDefault(); }
    if (e.key === 'ArrowRight') { yaw += 0.3; e.preventDefault(); }
  };
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('keydown', key);
  window.addEventListener('resize', size);
  let last = performance.now();
  const loop = (now: number) => {
    if (stopped) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;
    if (!dragging) {
      vy += ((reduced ? 0 : 0.35) - vy) * Math.min(1, dt * 1.5);
      yaw += vy * dt;
    }
    c.root.rotation.set(pitch, yaw, 0);
    tickMaterials(c.root, clock.t);
    s.renderer.render(s.scene, s.camera);
  };
  requestAnimationFrame(loop);
  return () => {
    stopped = true;
    host.removeEventListener('pointerdown', down);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', up);
    host.removeEventListener('pointercancel', up);
    host.removeEventListener('keydown', key);
    window.removeEventListener('resize', size);
    s.scene.remove(c.root);
    c.dispose();
    s.canvas.remove();
    s.renderer.dispose();
    s.renderer.forceContextLoss();
  };
}
