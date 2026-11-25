// Developer view for art review.
//   ?c=sardine,clownfish&t=1.2   creatures under the game lighting
//   ?scene=home|question          the full world
import * as THREE from 'three';
import { makeRenderer, nightEnvironment, lightRig } from './env';
import { makeCreature } from './creatures';
import { tickMaterials } from './materials';
import { createStage } from './stage';
import { makeCaptain } from './captain';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
if (q.get('scene')) {
  const stage = await createStage(canvas);
  // a stand-in for the screen's anchor box
  const box = document.createElement('div');
  const [top, height] = (q.get('box') ?? '90,330').split(',').map(Number);
  box.style.cssText = `position:fixed;left:0;right:0;top:${top}px;height:${height}px;${q.get('show') ? 'outline:1px dashed #f0c;' : ''}pointer-events:none`;
  document.body.appendChild(box);
  const mode = q.get('scene') as any;
  if (mode === 'reveal') {
    stage.setMode('question', box);
    setTimeout(() => stage.reveal(q.get('species') ?? 'octopus:nature', (q.get('tier') ?? 'octopus') as any, box), 300);
  } else if (mode === 'results') {
    stage.setMode('home', box);
    void stage.haul((q.get('list') ?? 'sardine:geography,clownfish:food,boot,octopus:nature,swordfish:geography,leviathan:history,sardine:animals').split(','), box, (q.get('mood') ?? 'happy') as any);
  } else stage.setMode(mode, box);
  if (q.get('mood')) setTimeout(() => stage.mood(q.get('mood') as any), 100);
  setTimeout(() => ((window as any).__ready = true), Number(q.get('wait') ?? 2500));
} else {
  const list = (q.get('c') ?? 'sardine').split(',');
  const yaw = Number(q.get('yaw') ?? 0.5);
  const r = makeRenderer(canvas, false);
  r.setClearColor(0x10243a, 1);
  const scene = new THREE.Scene();
  scene.environment = nightEnvironment(r);
  scene.environmentIntensity = 0.8;
  lightRig(scene);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const cols = Math.ceil(Math.sqrt(list.length));
  const rows = Math.ceil(list.length / cols);
  const caps: any[] = [];
  const items = await Promise.all(list.map(async (s) => {
    if (s.startsWith('captain')) {
      const c = await makeCaptain();
      c.setMood((s.split('-')[1] ?? 'idle') as any);
      caps.push(c);
      if (q.get('dbg')) { c.root.updateMatrixWorld(true); c.root.traverse((o: any) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); console.log('DBG', o.name, o.parent?.name, b.min.y.toFixed(2), b.max.y.toFixed(2)); } }); }
      c.root.scale.setScalar(1.6);
      const g = new THREE.Group(); g.add(c.root); c.root.position.y = -0.9;
      return { root: g, setSilhouette() {} };
    }
    return makeCreature(s);
  }));
  items.forEach((it, i) => {
    it.root.position.set((i % cols - (cols - 1) / 2) * 3.2, -(Math.floor(i / cols) - (rows - 1) / 2) * 2.4, 0);
    it.root.rotation.y = yaw;
    if (q.get('sil')) (it as any).setSilhouette(true);
    scene.add(it.root);
  });
  cam.position.set(0, 0.5, Math.max(cols * 3.2, rows * 2.4) * Number(q.get('z') ?? 1.15));
  cam.lookAt(0, 0, 0);
  const t = Number(q.get('t') ?? -1);
  let last = 0;
  const frame = (ms: number) => {
    const w = innerWidth, h = innerHeight;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const tt = t >= 0 ? t : ms / 1000;
    for (let k = 0; k < (t >= 0 ? 40 : 1); k++) caps.forEach((c) => c.update(tt + k * 0.03, t >= 0 ? 0.03 : (ms - last) / 1000));
    last = ms;
    tickMaterials(scene, tt);
    r.render(scene, cam);
    (window as any).__ready = true;
    if (t < 0) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
