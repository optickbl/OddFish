import { GAME, WAGER_MULTIPLIER, tierById, tierIndex, type TierId, type TopicId } from '../config';
import { speciesId, type OddityId, type VariantId } from '../content/creatures';
import { decorate, limitOf, type CastKind, type CastMods, type Multiplier } from './extras';
import { questionById } from './answers';
import { resolveRarity, type QuestionStats, type RaritySource } from './rarity';
import { validate } from './validate';

export interface CatchRecord {
  day: number;
  index: number;
  questionId: string;
  questionText: string;
  topic: TopicId;
  input: string;
  answerId: string | null;
  answerName: string | null;
  tier: TierId;
  /** Weight before the wager. */
  baseKg: number;
  /** Weight awarded (doubled if the wager won). Stored, never recomputed. */
  kg: number;
  wager: boolean;
  pct: number | null;
  source: RaritySource | null;
  sample: number | null;
  species: string;
  timedOut: boolean;
  /** Seconds left when the answer was cast. */
  secondsLeft: number;
  at: number;
  /** Variant creature (Shiny, Night, Mutant), if any. */
  variant?: VariantId;
  /** A seasonal visitor or an abyss creature took the place of the usual catch. */
  special?: 'seasonal' | 'abyss';
  /** Beginner's luck upgraded this catch. */
  boost?: 'luck';
  /** Everything that multiplied the weight. */
  mults?: Multiplier[];
  /** Weight salvaged from an Old Boot by the Salvage Net. */
  salvage?: number;
}

export interface CastState {
  day: number;
  questionIds: string[];
  /** Index of the current question. */
  index: number;
  /** When the current question was shown (trusted clock), or null before it starts. */
  startedAt: number | null;
  catches: CatchRecord[];
  wagerArmed: boolean;
  /** Question index the wager was spent on. */
  wagerIndex: number | null;
  status: 'playing' | 'complete';
  /** Bait, tide, upgrades and the rest, fixed when the cast began. Absent on older saves. */
  mods?: CastMods;
  /** Beginner's luck has been spent this cast. */
  luckUsed?: boolean;
  /** Question indexes where a Sonar hint was used. */
  sonarUsed?: number[];
}

export const LIMIT_MS = GAME.secondsPerQuestion * 1000;
/** Allowance for the time between pressing Cast and the game handling it. */
const GRACE_MS = 600;

export function newCast(day: number, questionIds: string[], mods?: CastMods): CastState {
  const s: CastState = { day, questionIds, index: 0, startedAt: null, catches: [], wagerArmed: false, wagerIndex: null, status: 'playing' };
  return mods ? { ...s, mods, luckUsed: false, sonarUsed: [] } : s;
}

export const castKind = (s: CastState): CastKind => s.mods?.kind ?? 'daily';
export const sonarLeft = (s: CastState) => Math.max(0, (s.mods?.sonar ?? 0) - (s.sonarUsed?.length ?? 0));
export function useSonar(s: CastState): CastState {
  if (sonarLeft(s) <= 0 || s.sonarUsed?.includes(s.index) || isAnswered(s)) return s;
  return { ...s, sonarUsed: [...(s.sonarUsed ?? []), s.index] };
}

export const currentQuestion = (s: CastState) => questionById(s.questionIds[s.index]);
export const isAnswered = (s: CastState, i = s.index) => s.catches.some((c) => c.index === i);
export const wagerAvailable = (s: CastState) => s.status === 'playing' && s.wagerIndex === null;

export function startQuestion(s: CastState, at: number): CastState {
  if (s.status !== 'playing' || s.startedAt !== null) return s;
  return { ...s, startedAt: at };
}

export function remainingMs(s: CastState, at: number): number {
  const limit = limitOf(s);
  if (s.startedAt === null) return limit;
  return Math.max(0, limit - (at - s.startedAt));
}

export function toggleWager(s: CastState): CastState {
  if (!wagerAvailable(s) || isAnswered(s)) return s;
  return { ...s, wagerArmed: !s.wagerArmed };
}

export interface CastOutcome {
  state: CastState;
  record: CatchRecord | null;
  rejected?: 'duplicate' | 'not-started' | 'finished';
}

/**
 * Lock in an answer for the current question. Called once per question: later calls are
 * rejected, so a double tap or a second submit can't change the catch. If the deadline
 * has passed, the answer is ignored and the question earns an Old Boot.
 */
export function castAnswer(s: CastState, input: string, at: number, stats: QuestionStats | null = null): CastOutcome {
  if (s.status !== 'playing') return { state: s, record: null, rejected: 'finished' };
  if (s.startedAt === null) return { state: s, record: null, rejected: 'not-started' };
  if (isAnswered(s)) return { state: s, record: null, rejected: 'duplicate' };
  const q = currentQuestion(s);
  if (!q) throw new Error(`Unknown question ${s.questionIds[s.index]}`);

  const limit = limitOf(s);
  const elapsed = at - s.startedAt;
  const timedOut = elapsed > limit + GRACE_MS;
  const text = timedOut ? '' : input.trim().slice(0, 80);
  const verdict = text ? validate(q, text) : null;
  const wager = s.wagerArmed && s.wagerIndex === null;

  let record: CatchRecord;
  if (verdict?.ok) {
    const rarity = resolveRarity(verdict.answer, stats);
    const baseKg = tierById(rarity.tier).kg;
    record = {
      day: s.day, index: s.index, questionId: q.id, questionText: q.text, topic: q.topic, input: text,
      answerId: verdict.answer.id, answerName: verdict.answer.name, tier: rarity.tier,
      baseKg, kg: wager ? baseKg * WAGER_MULTIPLIER : baseKg, wager,
      pct: rarity.pct, source: rarity.source, sample: rarity.sample,
      species: speciesId(rarity.tier, q.topic), timedOut: false,
      secondsLeft: Math.max(0, (limit - elapsed) / 1000), at,
    };
  } else {
    record = {
      day: s.day, index: s.index, questionId: q.id, questionText: q.text, topic: q.topic, input: text,
      answerId: null, answerName: null, tier: 'boot', baseKg: 0, kg: 0, wager,
      pct: null, source: null, sample: null, species: 'boot', timedOut: timedOut || !text,
      secondsLeft: Math.max(0, (limit - elapsed) / 1000), at,
    };
  }
  const d = decorate(record, s);
  record = d.rec;
  const state: CastState = {
    ...s,
    luckUsed: s.mods ? d.luckUsed : s.luckUsed,
    catches: [...s.catches, record],
    wagerArmed: false,
    wagerIndex: wager ? s.index : s.wagerIndex,
  };
  return { state, record };
}

/** Move to the next question, or finish the cast after the seventh. */
export function advance(s: CastState): CastState {
  if (!isAnswered(s)) return s;
  if (s.index + 1 >= s.questionIds.length) return { ...s, status: 'complete', startedAt: null };
  return { ...s, index: s.index + 1, startedAt: null, wagerArmed: false };
}

/** Handles a reload or a return to the app mid-question: an expired question becomes a boot. */
export function settleExpired(s: CastState, at: number): CastOutcome {
  if (s.status === 'playing' && s.startedAt !== null && !isAnswered(s) && at - s.startedAt > limitOf(s) + GRACE_MS) {
    return castAnswer(s, '', at);
  }
  return { state: s, record: null };
}

/**
 * A cast left unfinished when its day ended: the unanswered questions become Old Boots
 * so the catches already made are kept.
 */
export function forfeitRest(s: CastState, at: number): CastState {
  if (s.status === 'complete') return s;
  let state = s;
  while (state.status === 'playing') {
    if (!isAnswered(state)) {
      const limit = limitOf(state);
      const started = state.startedAt ?? at - limit - GRACE_MS - 1;
      state = castAnswer({ ...state, startedAt: started, wagerArmed: false }, '', Math.max(at, started + limit + GRACE_MS + 1)).state;
    }
    state = advance(state);
  }
  return state;
}

export interface CastSummary {
  day: number;
  totalKg: number;
  correct: number;
  catches: CatchRecord[];
  rarest: CatchRecord | null;
  heaviest: CatchRecord | null;
  wager: 'won' | 'lost' | 'unused';
  legendaries: number;
  /** 'archive' for a missed-day cast. Absent on older saves (daily). */
  kind?: CastKind;
  /** The Daily Cast number on which this was played (differs from day for missed-day casts). */
  playedOn?: number;
  /** Bait used, if any. */
  bait?: string | null;
}

export function summarize(s: CastState, playedOn: number = s.day): CastSummary {
  const catches = s.catches.slice().sort((a, b) => a.index - b.index);
  const correct = catches.filter((c) => c.tier !== 'boot');
  const rarest = correct.reduce<CatchRecord | null>((best, c) => {
    if (!best) return c;
    const d = tierIndex(c.tier) - tierIndex(best.tier);
    if (d !== 0) return d > 0 ? c : best;
    return (c.pct ?? 100) < (best.pct ?? 100) ? c : best;
  }, null);
  const heaviest = correct.reduce<CatchRecord | null>((b, c) => (!b || c.kg > b.kg ? c : b), null);
  const w = catches.find((c) => c.wager);
  return {
    day: s.day,
    totalKg: catches.reduce((sum, c) => sum + c.kg, 0),
    correct: correct.length,
    catches,
    rarest,
    heaviest,
    wager: !w ? 'unused' : w.tier === 'boot' ? 'lost' : 'won',
    legendaries: catches.filter((c) => c.tier === 'leviathan').length,
    kind: castKind(s),
    playedOn,
    bait: s.mods?.bait ?? null,
  };
}

/** Oddities earned by a finished cast (the anchor depends on the streak and is checked separately). */
export function oddsFromCast(sum: CastSummary): OddityId[] {
  const out: OddityId[] = [];
  if (sum.catches.some((c) => c.tier === 'boot')) out.push('boot');
  if (sum.catches.some((c) => c.tier !== 'boot' && c.secondsLeft <= 3)) out.push('bottle');
  if (sum.correct === sum.catches.length && sum.catches.length > 0) out.push('pearl');
  if (sum.catches.some((c) => c.wager && (c.tier === 'swordfish' || c.tier === 'leviathan'))) out.push('horseshoe');
  if (sum.totalKg >= 1500) out.push('chest');
  return out;
}
