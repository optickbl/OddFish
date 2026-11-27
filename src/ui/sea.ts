/**
 * Bridge between screens and the 3D sea. The 3D code loads lazily after the first
 * screen is up; until then (or if WebGL isn't available) screens show their SVG art.
 * Screens ask for what they want; only the last request in a render is applied.
 */
import type { TierId } from '../config';
import type { Mood } from '../three/captain';
import type { Stage, StageMode } from '../three/stage';
import type { SeaLook } from '../three/weather';

type Request = (s: Stage) => void;

let stage: Stage | null = null;
let booting = false;
let want: { mode: StageMode; run: Request } = { mode: 'off', run: (s) => s.setMode('off') };
let queued = false;
let reduced = false;
let gl: boolean | null = null;
let look: Partial<SeaLook> | null = null;

export const seaReady = () => !!stage;

/** Whether this browser can show the 3D art at all. */
export function webglAvailable(): boolean {
  if (new URLSearchParams(location.search).has('flat')) return false;
  if (gl !== null) return gl;
  try {
    const c = document.createElement('canvas');
    gl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    gl = false;
  }
  return gl;
}

function flush() {
  queued = false;
  document.documentElement.classList.toggle('sea-off', want.mode === 'off');
  if (stage) want.run(stage);
}

function request(mode: StageMode, run: Request) {
  want = { mode, run };
  if (!queued) {
    queued = true;
    queueMicrotask(flush);
  }
}

export function bootSea(isReduced: boolean) {
  reduced = isReduced;
  if (booting || stage) return;
  if (!webglAvailable()) return;
  booting = true;
  const canvas = document.createElement('canvas');
  canvas.className = 'sea';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  import('../three/stage')
    .then((m) => m.createStage(canvas))
    .then((s) => {
      stage = s;
      s.setReduced(reduced);
      if (look) s.setLook(look);
      want.run(s);
      // Let the first frame land before the SVG art steps aside.
      requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('has-3d')));
    })
    .catch((e) => {
      console.warn('3D sea unavailable, using illustrations', e);
      canvas.remove();
    });
}

export function seaReduced(r: boolean) {
  reduced = r;
  stage?.setReduced(r);
}

export const seaOff = () => request('off', (s) => s.setMode('off'));
export const seaHome = (anchor: HTMLElement, l?: Partial<SeaLook>) => {
  if (l) seaLook(l);
  request('home', (s) => s.setMode('home', anchor));
};

/** Weather, buoys, boat dressing and outfit. Kept until changed, applied once the sea is up. */
export function seaLook(l: Partial<SeaLook>) {
  look = { ...look, ...l };
  stage?.setLook(l);
}
export const seaQuestion = (anchor: HTMLElement) => request('question', (s) => s.setMode('question', anchor));
/** Answer sent: the bobber dips while the catch is weighed. */
export const seaReel = (anchor: HTMLElement) => request('question', (s) => { s.setMode('question', anchor); s.bite(); });
export const seaMood = (m: Mood) => stage?.mood(m);

export function seaReveal(species: string, tier: TierId, anchor: HTMLElement, instant: boolean) {
  request('reveal', (s) => void s.reveal(species, tier, anchor, instant));
}

export function seaHaul(species: string[], anchor: HTMLElement, mood: Mood) {
  request('results', (s) => void s.haul(species, anchor, mood));
}
