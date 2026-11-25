import type { CastState, CastSummary, CatchRecord } from './game';
import type { OddityId } from '../content/creatures';

export interface Streak {
  current: number;
  best: number;
  /** Last Daily Cast number completed, 0 if none. */
  lastDay: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  motion: 'system' | 'reduced';
}

export interface SaveData {
  v: 1;
  playerId: string;
  name: string;
  createdAt: number;
  onboarded: boolean;
  settings: Settings;
  streak: Streak;
  /** Highest Daily Cast number this device has seen; the day never goes backwards. */
  maxDaySeen: number;
  current: CastState | null;
  history: CastSummary[];
  /** First catch time and count per species id. */
  found: Record<string, { first: number; count: number }>;
}

export function freshSave(now: number, randomId: string): SaveData {
  return {
    v: 1,
    playerId: randomId,
    name: `Angler ${randomId.slice(0, 4).toUpperCase()}`,
    createdAt: now,
    onboarded: false,
    settings: { sound: false, haptics: true, motion: 'system' },
    streak: { current: 0, best: 0, lastDay: 0 },
    maxDaySeen: 0,
    current: null,
    history: [],
    found: {},
  };
}

/** Completing a cast keeps a run going if yesterday was completed too. */
export function completeDay(s: Streak, day: number): Streak {
  if (day <= s.lastDay) return s;
  const current = s.lastDay === day - 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: day };
}

/** The streak shown today: still alive if the last completed cast was today or yesterday. */
export const liveStreak = (s: Streak, today: number) => (s.lastDay >= today - 1 ? s.current : 0);

export function recordFinds(found: SaveData['found'], catches: CatchRecord[], odd: OddityId[], at: number) {
  const out = { ...found };
  const add = (id: string) => {
    const f = out[id];
    out[id] = f ? { first: f.first, count: f.count + 1 } : { first: at, count: 1 };
  };
  for (const c of catches) if (c.tier !== 'boot') add(c.species);
  for (const o of odd) add(o);
  return out;
}

export interface Records {
  bestHaul: { kg: number; day: number } | null;
  bestCatch: CatchRecord | null;
  mostLegendaries: { n: number; day: number } | null;
  longestStreak: number;
  totalCatches: number;
  uniqueCreatures: number;
  casts: number;
  totalKg: number;
  correct: number;
  answered: number;
  wagersWon: number;
}

export function computeRecords(save: SaveData): Records {
  let bestHaul: Records['bestHaul'] = null;
  let bestCatch: CatchRecord | null = null;
  let mostLegendaries: Records['mostLegendaries'] = null;
  let totalCatches = 0, totalKg = 0, correct = 0, answered = 0, wagersWon = 0;
  for (const h of save.history) {
    if (!bestHaul || h.totalKg > bestHaul.kg) bestHaul = { kg: h.totalKg, day: h.day };
    if (h.legendaries > 0 && (!mostLegendaries || h.legendaries > mostLegendaries.n)) mostLegendaries = { n: h.legendaries, day: h.day };
    if (h.wager === 'won') wagersWon++;
    totalKg += h.totalKg;
    correct += h.correct;
    answered += h.catches.length;
    for (const c of h.catches) {
      if (c.tier !== 'boot') totalCatches++;
      if (c.tier !== 'boot' && (!bestCatch || c.kg > bestCatch.kg)) bestCatch = c;
    }
  }
  return {
    bestHaul, bestCatch, mostLegendaries,
    longestStreak: save.streak.best,
    totalCatches,
    uniqueCreatures: Object.keys(save.found).length,
    casts: save.history.length,
    totalKg, correct, answered, wagersWon,
  };
}

/** Best haul before a given day, for "new personal best" comparisons. */
export function previousBest(save: SaveData, day: number): number | null {
  const prior = save.history.filter((h) => h.day < day);
  return prior.length ? Math.max(...prior.map((h) => h.totalKg)) : null;
}
