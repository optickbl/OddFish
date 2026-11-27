import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { topicById, type TierId, type TopicId } from '../config';
import { speciesById } from '../content/creatures';
import { creatureMaterial, eyeMaterial, type CreaturePalette, type Pattern, type SwimParams } from './materials';

export type Art = TierId | 'bottle' | 'pearl' | 'horseshoe' | 'chest' | 'anchor';

interface ArtDef {
  file: string;
  swim: SwimParams;
  palette: CreaturePalette;
  /** Display length in world units after normalising. */
  size: number;
}

const BASE = `${import.meta.env.BASE_URL}models/`;
const STILL: SwimParams = { style: 'none', speed: 0, freq: 0, amp: 0 };

export const ART: Partial<Record<Art, ArtDef>> = {
  sardine: { file: 'sardine.glb', size: 2.2, swim: { style: 'fish', speed: 7, freq: 3.2, amp: 0.09 },
    palette: { main: '#3d7d9e', belly: '#e2eaf0', light: '#f5f8fa', dark: '#17303f', bellyMetal: 0.6, iridescence: 0.55, roughness: 0.28 } },
  clownfish: { file: 'clownfish.glb', size: 1.9, swim: { style: 'fish', speed: 6, freq: 2.6, amp: 0.07 },
    palette: { main: '#f2741f', belly: '#f8a24c', light: '#fbf6ee', dark: '#141419', roughness: 0.38 } },
  octopus: { file: 'octopus.glb', size: 1.9, swim: { style: 'tentacle', speed: 2.2, freq: 1, amp: 0.12 },
    palette: { main: '#de6a5c', belly: '#f4b4a4', light: '#fff1e8', dark: '#8e3532', roughness: 0.5 } },
  swordfish: { file: 'swordfish.glb', size: 2.6, swim: { style: 'fish', speed: 4.2, freq: 1.9, amp: 0.07 },
    palette: { main: '#25588c', belly: '#e1e9ef', light: '#a7d6ff', dark: '#11273d', bellyMetal: 0.55, iridescence: 0.35, roughness: 0.3 } },
  leviathan: { file: 'leviathan.glb', size: 2.9, swim: { style: 'serpent', speed: 1.4, freq: 1.6, amp: 0.09 },
    palette: { main: '#2b5a80', belly: '#b5cfdf', light: '#ffd27a', dark: '#11253a', glow: 1.8, roughness: 0.36, iridescence: 0.25 } },
  boot: { file: 'boot.glb', size: 1.6, swim: { style: 'none', speed: 0, freq: 0, amp: 0 },
    palette: { main: '#7b4b2c', belly: '#5a351e', light: '#e9d8b8', dark: '#2a1a10', roughness: 0.62 } },
  // Oddities: Logbook trophies, mostly trim materials.
  bottle: { file: 'bottle.glb', size: 1.5, swim: STILL, palette: { main: '#9fd8c0', belly: '#9fd8c0', light: '#ffffff', dark: '#000000' } },
  pearl: { file: 'pearl.glb', size: 1.3, swim: STILL, palette: { main: '#e7b3a3', belly: '#f6e2d4', light: '#fff4ec', dark: '#a8695c', roughness: 0.42 } },
  horseshoe: { file: 'horseshoe.glb', size: 1.3, swim: STILL, palette: { main: '#e2ad55', belly: '#e2ad55', light: '#ffffff', dark: '#000000' } },
  chest: { file: 'chest.glb', size: 1.35, swim: STILL, palette: { main: '#8a5634', belly: '#5e3a22', light: '#d9b98a', dark: '#3a2416', roughness: 0.66, clearcoat: 0.08 } },
  anchor: { file: 'anchor.glb', size: 1.55, swim: STILL, palette: { main: '#3b4450', belly: '#3b4450', light: '#ffffff', dark: '#000000' } },
};

/** Topic variants keep each creature's signature pattern and swap its colours. */
export function paletteFor(art: Art, topic: TopicId | null): CreaturePalette {
  const def = ART[art];
  if (!def) throw new Error(`No 3D art for ${art}`);
  const p = def.palette;
  if (!topic || art === 'boot') return p;
  const t = topicById(topic).palette;
  switch (art) {
    case 'clownfish': return { ...p, main: t.base, belly: t.light };
    case 'leviathan': return { ...p, main: t.shade, belly: t.light, light: t.accent };
    case 'octopus': return { ...p, main: t.base, belly: t.light, dark: t.shade };
    default: return { ...p, main: t.shade, light: t.light, dark: t.shade };
  }
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();

/** Loads a model once; every creature instance shares its geometry. */
export function loadModel(file: string): Promise<THREE.Group> {
  let p = cache.get(file);
  if (!p) {
    p = loader.loadAsync(BASE + file).then((g) => {
      // keep clips with the scene (an artist's Captain may bring its own)
      g.scene.animations = g.animations;
      return g.scene;
    });
    cache.set(file, p);
    p.catch(() => cache.delete(file));
  }
  return p;
}

const TRIM: Record<string, () => THREE.Material> = {
  Sole: () => new THREE.MeshStandardMaterial({ color: 0x2a1d15, roughness: 0.85 }),
  Lace: () => new THREE.MeshStandardMaterial({ color: 0xd9c8a5, roughness: 0.9 }),
  Metal: () => new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.32 }),
  Weed: () => new THREE.MeshPhysicalMaterial({ color: 0x4f8a5c, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
  Glass: () => new THREE.MeshPhysicalMaterial({ color: 0xa9dcc6, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.34, depthWrite: false, envMapIntensity: 1.6 }),
  Cork: () => new THREE.MeshStandardMaterial({ color: 0xb48c5c, roughness: 0.92 }),
  Paper: () => new THREE.MeshStandardMaterial({ color: 0xf1e4c4, roughness: 0.85 }),
  Twine: () => new THREE.MeshStandardMaterial({ color: 0xb8463a, roughness: 0.8 }),
  Pearl: () => new THREE.MeshPhysicalMaterial({ color: 0xf7f2ea, roughness: 0.16, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, sheen: 0.6, sheenColor: new THREE.Color(0xffe6f0) }),
  Gold: () => new THREE.MeshStandardMaterial({ color: 0xe2ad55, metalness: 1, roughness: 0.24 }),
  Iron: () => new THREE.MeshStandardMaterial({ color: 0x46505c, metalness: 0.75, roughness: 0.48 }),
  Rope: () => new THREE.MeshStandardMaterial({ color: 0xc9a56b, roughness: 0.9 }),
};
/** Undiscovered things are drawn as shadows, trims included. */
const SILHOUETTE = new THREE.MeshStandardMaterial({ color: 0x21425a, roughness: 0.7 });
const trimCache = new Map<string, THREE.Material>();
function trimMaterial(name: string): THREE.Material | null {
  const make = TRIM[name];
  if (!make) return null;
  let m = trimCache.get(name);
  if (!m) { m = make(); trimCache.set(name, m); }
  return m;
}

export const has3D = (art: string): art is Art => !!ART[art as Art];

export interface Creature {
  root: THREE.Group;
  art: Art;
  setSilhouette(on: boolean): void;
  setExcite(v: number): void;
  dispose(): void;
}

/** Build a creature for a species id ("octopus:science", "boot") or a bare tier. */
export async function makeCreature(species: string): Promise<Creature> {
  const s = speciesById(species);
  const art = (s ? s.art : species) as Art;
  const def = ART[art];
  if (!def) throw new Error(`No 3D art for ${species}`);
  const src = await loadModel(def.file);
  const root = new THREE.Group();
  const model = src.clone(true);
  const mats: THREE.MeshPhysicalMaterial[] = [];
  const pal = s?.look ? { ...def.palette, ...s.look.gl } : paletteFor(art, s?.topic ?? null);
  const pattern = (['sardine', 'clownfish', 'octopus', 'swordfish', 'leviathan', 'boot'].includes(art) ? art : 'none') as Pattern;
  // Mutants swim with a wobble.
  const swim = s?.variant === 'mutant' ? { ...def.swim, amp: def.swim.amp * 1.9, freq: def.swim.freq * 1.4 } : def.swim;
  const bodyMat = creatureMaterial(pal, swim, false, pattern);
  const finMat = creatureMaterial(pal, swim, true);
  const eyeMat = eyeMaterial();
  mats.push(bodyMat, finMat, eyeMat);
  const trims: { mesh: THREE.Mesh; mat: THREE.Material }[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    const trim = trimMaterial(name);
    mesh.material = name === 'Eye' ? eyeMat : name === 'Body' ? bodyMat : name === 'Fin' ? finMat : trim ?? mesh.material;
    if (trim) trims.push({ mesh, mat: trim });
    mesh.frustumCulled = false;
  });
  // Normalise: centre the model and scale it to its display size.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  const k = def.size / Math.max(size.x, size.y, size.z);
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(k);
  root.add(holder);
  return {
    root,
    art,
    setSilhouette(on) {
      for (const m of mats) {
        const u = m.userData.uniforms;
        if (u) u.uSilhouette.value = on ? 1 : 0;
      }
      eyeMat.visible = !on;
      for (const t of trims) t.mesh.material = on ? SILHOUETTE : t.mat;
    },
    setExcite(v) {
      bodyMat.userData.uniforms.uExcite.value = v;
      finMat.userData.uniforms.uExcite.value = v;
    },
    dispose() {
      mats.forEach((m) => m.dispose());
    },
  };
}
