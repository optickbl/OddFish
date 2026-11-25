import type { TierId } from '../config';

/**
 * Small synthesised sounds (no audio files). Muted by default; the player turns sound on
 * in Profile or with the speaker button. Haptics use the Vibration API where supported.
 */
let ctx: AudioContext | null = null;
let enabled = false;
let hapticsOn = true;

export function setSound(on: boolean) {
  enabled = on;
  if (on) ensure();
}
export const setHaptics = (on: boolean) => (hapticsOn = on);

function ensure(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function splash(at = 0, dur = 0.35, gain = 0.08) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  tap: () => tone(660, 0, 0.06, 'sine', 0.05),
  cast: () => { tone(520, 0, 0.18, 'sine', 0.06, 260); splash(0.16, 0.3, 0.06); },
  tick: () => tone(880, 0, 0.05, 'triangle', 0.035),
  wager: () => { tone(392, 0, 0.12, 'triangle', 0.07); tone(523, 0.09, 0.16, 'triangle', 0.07); tone(784, 0.2, 0.3, 'sine', 0.06); },
  count: () => tone(990, 0, 0.03, 'sine', 0.025),
  reveal(tier: TierId) {
    if (tier === 'boot') { tone(196, 0, 0.22, 'triangle', 0.08, 140); tone(147, 0.18, 0.3, 'triangle', 0.07, 110); return; }
    const notes: Record<Exclude<TierId, 'boot'>, number[]> = {
      sardine: [523],
      clownfish: [523, 659],
      octopus: [523, 659, 784],
      swordfish: [523, 659, 784, 1047],
      leviathan: [392, 523, 659, 784, 1047, 1319],
    };
    notes[tier].forEach((f, i) => tone(f, i * (tier === 'leviathan' ? 0.11 : 0.08), tier === 'leviathan' ? 0.6 : 0.3, 'sine', 0.07));
    splash(0, 0.25, 0.04);
  },
};

export function haptic(kind: 'tap' | 'cast' | 'good' | 'bad' | 'legend') {
  if (!hapticsOn) return;
  try {
    const p = { tap: 8, cast: 14, good: [12, 40, 12], bad: [40], legend: [20, 60, 20, 60, 40] }[kind];
    navigator.vibrate?.(p as number | number[]);
  } catch {
    /* not supported */
  }
}
