import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { creatureMaterial } from './materials';
import { loadModel } from './creatures';

/*
 * The Captain.
 *
 * public/models/captain.glb is a STAND-IN built procedurally in art/world.py and posed
 * by the code below. It's meant to be replaced by an artist's model: drop in a GLB
 * with animation clips named after the moods (idle, happy, shocked, disappointed,
 * thinking, excited) and it is played as-is, with its own materials. See art/CAPTAIN.md.
 */

export type Mood = 'idle' | 'happy' | 'shocked' | 'disappointed' | 'thinking' | 'excited';

const MATS: Record<string, () => THREE.Material> = {
  Coat: () => new THREE.MeshPhysicalMaterial({ color: 0x1c3452, roughness: 0.72, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x5b7ea3) }),
  Hat: () => new THREE.MeshPhysicalMaterial({ color: 0xf3ede1, roughness: 0.55, clearcoat: 0.15, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) }),
  HatBand: () => new THREE.MeshPhysicalMaterial({ color: 0x14283f, roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0x4a6a8a) }),
  Visor: () => new THREE.MeshPhysicalMaterial({ color: 0x0b1420, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
  Gold: () => new THREE.MeshStandardMaterial({ color: 0xe2ad55, metalness: 1, roughness: 0.28 }),
  CatEye: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }),
  Nose: () => new THREE.MeshPhysicalMaterial({ color: 0xd9837a, roughness: 0.38, clearcoat: 0.6 }),
  Mouth: () => new THREE.MeshStandardMaterial({ color: 0x3a1514, roughness: 0.6 }),
  Tongue: () => new THREE.MeshPhysicalMaterial({ color: 0xe0857a, roughness: 0.35, clearcoat: 0.5 }),
  Whisker: () => new THREE.MeshStandardMaterial({ color: 0xf7f1e6, roughness: 0.5 }),
  EarInner: () => new THREE.MeshStandardMaterial({ color: 0xeaa293, roughness: 0.75 }),
};

export interface Captain {
  root: THREE.Group;
  setMood(m: Mood): void;
  update(t: number, dt: number): void;
}

/** A pivot group at `centre` (model space) that holds `obj`, so rotations happen around that point. */
function pivot(obj: THREE.Object3D, centre: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const parent = obj.parent!;
  parent.updateMatrixWorld(true);
  parent.add(g);
  g.position.copy(parent.worldToLocal(centre.clone()));
  g.attach(obj);
  return g;
}

const MOODS: Mood[] = ['idle', 'happy', 'shocked', 'disappointed', 'thinking', 'excited'];

/** An artist's rigged Captain: play its clips, cross-fading between moods. */
function clipCaptain(src: THREE.Group): Captain {
  const model = cloneSkinned(src) as THREE.Group;
  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map(src.animations.map((c) => [c.name.toLowerCase(), mixer.clipAction(c)]));
  let current: THREE.AnimationAction | undefined;
  const play = (m: Mood) => {
    const next = actions.get(m) ?? actions.get('idle');
    if (!next || next === current) return;
    next.reset().fadeIn(0.35).play();
    current?.fadeOut(0.35);
    current = next;
  };
  play('idle');
  return { root, setMood: play, update: (_t, dt) => mixer.update(dt) };
}

export async function makeCaptain(): Promise<Captain> {
  const src = await loadModel('captain.glb');
  if (src.animations.some((c) => MOODS.includes(c.name.toLowerCase() as Mood))) return clipCaptain(src);
  const model = src.clone(true);
  const fur = creatureMaterial({ main: '#e3873f', belly: '#f7e7d0', light: '#fff6e8', dark: '#a8521f', roughness: 0.62 }, { style: 'none', speed: 0, freq: 0, amp: 0 }, false, 'cat');
  fur.clearcoat = 0;
  fur.sheen = 0.8;
  fur.sheenRoughness = 0.45;
  fur.sheenColor = new THREE.Color('#ffd9b0');
  const cache = new Map<string, THREE.Material>();
  const find = (n: string) => model.getObjectByName(n)!;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name;
    if (name === 'Fur') m.material = fur;
    else if (MATS[name]) {
      let mat = cache.get(name);
      if (!mat) { mat = MATS[name](); cache.set(name, mat); }
      m.material = mat;
    }
    m.castShadow = false;
  });
  const root = new THREE.Group();
  root.add(model);

  // Head rig: everything above the neck turns together.
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0);
  model.add(head);
  for (const n of ['Head', 'EyeL', 'EyeR', 'LidL', 'LidR', 'Nose', 'MouthFrown', 'MouthSmile', 'MouthO', 'Whiskers', 'EarL', 'EarR', 'Hat']) {
    const o = model.getObjectByName(n);
    if (o) head.attach(o);
  }
  const eyeL = pivot(find('EyeL'), new THREE.Vector3(-0.175, 1.04, 0.37));
  const eyeR = pivot(find('EyeR'), new THREE.Vector3(0.175, 1.04, 0.37));
  const lidL = find('LidL'), lidR = find('LidR');
  const earL = find('EarL'), earR = find('EarR');
  const armL = find('ArmL'), armR = find('ArmR');
  const tail = find('Tail');
  const body = find('Body');
  const mouths = { frown: find('MouthFrown'), smile: find('MouthSmile'), o: find('MouthO') };
  const hat = find('Hat');

  let mood: Mood = 'idle';
  let moodT = 0;
  let nextBlink = 2;
  let blink = 0;
  const cur = { lid: 0.18, head: 0, tilt: 0, aLx: 0, aLz: 0, aRx: 0, aRz: 0, earL: 0, earR: 0, look: 0, bounce: 0, hat: 0 };
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  return {
    root,
    setMood(m) {
      mood = m;
      moodT = 0;
    },
    update(t, dt) {
      moodT += dt;
      const k = 1 - Math.exp(-dt * 9);
      void moodT;
      // Target pose per mood
      // Arms hang from the shoulder; z swings them out/up to the side, x forward.
      const tg = { lid: 0.18, head: 0, tilt: 0, aLx: 0, aLz: 0, aRx: 0, aRz: 0, earL: 0, earR: 0, look: 0, bounce: 0, hat: 0 };
      let mouth: keyof typeof mouths = 'frown';
      switch (mood) {
        case 'happy':
          tg.lid = 0.45; tg.tilt = 0.1; mouth = 'smile'; tg.bounce = 0.02 * Math.abs(Math.sin(t * 7));
          tg.aRz = 2.8 + Math.sin(t * 9) * 0.3; tg.aRx = -0.4;
          break;
        case 'excited':
          tg.lid = -0.35; mouth = 'smile';
          tg.aRz = 3.0 + Math.sin(t * 11) * 0.25; tg.aLz = -3.0 - Math.sin(t * 11 + 1) * 0.25; tg.aRx = tg.aLx = -0.5;
          tg.bounce = 0.05 * Math.abs(Math.sin(t * 8)); tg.hat = Math.sin(t * 8) * 0.06; tg.earL = -0.2; tg.earR = 0.2;
          break;
        case 'shocked':
          tg.lid = -0.75; tg.head = -0.08; mouth = 'o'; tg.earL = -0.25; tg.earR = 0.25; tg.hat = -0.12;
          tg.aRx = -2.3; tg.aRz = -0.3; tg.aLx = -2.3; tg.aLz = 0.3;
          tg.bounce = moodT < 0.25 ? 0.06 : 0;
          break;
        case 'disappointed':
          tg.lid = 0.55; tg.head = 0.18; tg.tilt = -0.06; tg.earL = 0.35; tg.earR = -0.35;
          tg.aLz = -0.1; tg.aRz = 0.1; tg.aLx = 0.15; tg.aRx = 0.15;
          break;
        case 'thinking':
          tg.lid = 0.3; tg.tilt = 0.14; tg.look = -0.25; tg.head = -0.06;
          tg.aRx = -1.95; tg.aRz = -0.4;
          break;
        default:
          tg.tilt = Math.sin(t * 0.45) * 0.04;
          tg.look = Math.sin(t * 0.3) * 0.06;
      }
      for (const key of Object.keys(cur) as (keyof typeof cur)[]) cur[key] = lerp(cur[key], tg[key], k);
      // Blinks: brief, natural, more frequent when idle
      nextBlink -= dt;
      if (nextBlink <= 0) { blink = 1; nextBlink = 2.2 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt * 7);
      const b = Math.sin(blink * Math.PI);
      const lid = lerp(cur.lid, 1.25, b);
      lidL.rotation.x = lid;
      lidR.rotation.x = lid;
      head.rotation.x = cur.head;
      head.rotation.z = cur.tilt;
      head.rotation.y = cur.look;
      eyeL.rotation.y = eyeR.rotation.y = cur.look * 0.8;
      eyeL.rotation.x = eyeR.rotation.x = mood === 'thinking' ? -0.25 : 0;
      armL.rotation.set(cur.aLx, 0, cur.aLz);
      armR.rotation.set(cur.aRx, 0, cur.aRz);
      earL.rotation.z = cur.earL + Math.max(0, Math.sin(t * 0.7) - 0.97) * 6;
      earR.rotation.z = cur.earR;
      hat.rotation.x = cur.hat;
      tail.rotation.y = Math.sin(t * 1.3) * 0.18;
      tail.rotation.z = Math.sin(t * 0.9) * 0.05;
      const breathe = 1 + Math.sin(t * 2.1) * 0.012;
      body.scale.set(breathe, 1 + Math.sin(t * 2.1) * 0.008, breathe);
      model.position.y = cur.bounce;
      mouths.frown.visible = mouth === 'frown';
      mouths.smile.visible = mouth === 'smile';
      mouths.o.visible = mouth === 'o';
    },
  };
}
