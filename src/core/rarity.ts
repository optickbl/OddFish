import { GAME, TIERS, type TierId } from '../config';
import type { CanonAnswer } from './answers';

/** Aggregated, anonymous counts for one question on one day. */
export interface QuestionStats {
  /** Total valid (correct) answers submitted for this question. */
  total: number;
  /** Valid answers per canonical answer id. */
  counts: Record<string, number>;
}

export type RaritySource = 'players' | 'estimate';

export interface Rarity {
  tier: TierId;
  /** Percent of valid answers that matched this answer. */
  pct: number;
  source: RaritySource;
  /** Number of valid responses behind a 'players' figure. */
  sample: number;
}

/** Map a frequency in percent to a tier using the configured thresholds. */
export function tierForPct(pct: number, tiers = TIERS): TierId {
  for (const t of tiers) if (t.minPct !== null && t.minPct > 0 && pct >= t.minPct) return t.id;
  return 'leviathan';
}

/**
 * Rarity is measured per question from real answers once there are enough of them.
 * Before that, the curated estimate is used and labelled as such. Rarity is never stored on
 * the answer itself; each catch keeps the tier it was awarded at the time.
 */
export function resolveRarity(answer: CanonAnswer, stats: QuestionStats | null, minSample: number = GAME.minSampleSize): Rarity {
  if (stats && stats.total >= minSample) {
    const count = stats.counts[answer.id] ?? 0;
    const pct = (count / stats.total) * 100;
    return { tier: tierForPct(pct), pct, source: 'players', sample: stats.total };
  }
  return { tier: tierForPct(answer.est), pct: answer.est, source: 'estimate', sample: stats?.total ?? 0 };
}

/** Friendly figure for a real player percentage, e.g. 0.8% or 12%. */
export function formatPct(pct: number): string {
  if (pct < 0.1) return 'under 0.1%';
  if (pct < 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  return `${Math.round(pct)}%`;
}
