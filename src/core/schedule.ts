import { GAME, TOPICS, type TopicId } from '../config';
import { QUESTIONS, type Question } from './answers';

const DAY_MS = 86_400_000;

/** Daily Cast number for an instant. Everyone resets at 00:00 UTC. */
export const dayNumber = (nowMs: number): number => Math.floor((nowMs - GAME.epochUtc) / DAY_MS) + 1;
/** Start of a Daily Cast, in ms since epoch (UTC midnight). */
export const dayStart = (day: number): number => GAME.epochUtc + (day - 1) * DAY_MS;
export const nextResetAt = (nowMs: number): number => dayStart(dayNumber(nowMs) + 1);

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Easy, medium, hard, easy, medium, hard, medium: a varied rhythm through the cast. */
const RHYTHM: (1 | 2 | 3)[] = [1, 2, 3, 1, 2, 3, 2];

function orderByRhythm(qs: Question[]): Question[] {
  const left = qs.slice();
  const out: Question[] = [];
  for (const want of RHYTHM.slice(0, qs.length)) {
    let bestI = 0;
    for (let i = 1; i < left.length; i++) {
      if (Math.abs(left[i].difficulty - want) < Math.abs(left[bestI].difficulty - want)) bestI = i;
    }
    out.push(left.splice(bestI, 1)[0]);
  }
  return out;
}

const planCache = new Map<number, string[][]>();

/**
 * Questions are dealt in cycles: inside a cycle no question repeats, and each day draws
 * from as many different topics as possible. Every player gets the same seven.
 */
function cyclePlan(cycle: number, bank: Question[]): string[][] {
  const cached = planCache.get(cycle);
  if (cached && bank === QUESTIONS) return cached;
  const per = GAME.questionsPerCast;
  const days = Math.floor(bank.length / per);
  const r = rng(0x0dd + cycle * 7919);
  const pools = new Map<TopicId, Question[]>();
  for (const t of shuffle(TOPICS.map((x) => x.id), r)) pools.set(t, shuffle(bank.filter((q) => q.topic === t), r));
  const plan: string[][] = [];
  for (let d = 0; d < days; d++) {
    const pick: Question[] = [];
    while (pick.length < per) {
      const topics = [...pools.entries()]
        .filter(([, qs]) => qs.length > 0)
        .sort((a, b) => b[1].length - a[1].length);
      const fresh = topics.filter(([t]) => !pick.some((q) => q.topic === t));
      const [, qs] = (fresh[0] ?? topics[0])!;
      pick.push(qs.shift()!);
    }
    plan.push(orderByRhythm(pick).map((q) => q.id));
  }
  if (bank === QUESTIONS) planCache.set(cycle, plan);
  return plan;
}

export function dailyQuestionIds(day: number, bank: Question[] = QUESTIONS): string[] {
  const days = Math.floor(bank.length / GAME.questionsPerCast);
  const idx = Math.max(0, day - 1);
  return cyclePlan(Math.floor(idx / days), bank)[idx % days];
}
