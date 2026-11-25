import { normalize, type CanonAnswer, type Question } from './answers';

export type Verdict =
  | { ok: true; answer: CanonAnswer; how: 'exact' | 'fuzzy' }
  | { ok: false; reason: 'empty' | 'unknown' | 'ambiguous' };

/** Optimal string alignment distance (Levenshtein plus adjacent swaps). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** How many typos a key of this length tolerates. Short words must be exact. */
export const tolerance = (len: number) => (len >= 9 ? 2 : len >= 5 ? 1 : 0);

function variants(k: string): string[] {
  const v = [k];
  if (k.endsWith('ies')) v.push(k.slice(0, -3) + 'y');
  if (k.endsWith('es')) v.push(k.slice(0, -2));
  if (k.endsWith('s')) v.push(k.slice(0, -1));
  return v;
}

/**
 * Deterministic answer check against the canonical database.
 * Exact alias match first (with simple plurals), then a small typo allowance.
 * A typo that is equally close to two different answers is rejected rather than guessed.
 */
export function validate(question: Question, input: string): Verdict {
  const k = normalize(input);
  if (!k) return { ok: false, reason: 'empty' };
  for (const v of variants(k)) {
    const c = v.replace(/ /g, '');
    for (const a of question.answers) if (a.keys.includes(v) || a.compact.includes(c)) return { ok: true, answer: a, how: 'exact' };
  }
  const c = k.replace(/ /g, '');
  if (c.length < 4) return { ok: false, reason: 'unknown' };
  let best: CanonAnswer | null = null;
  let bestD = Infinity;
  let tie = false;
  for (const a of question.answers) {
    let ad = Infinity;
    for (const key of a.compact) {
      const tol = tolerance(key.length);
      if (!tol) continue;
      const dist = editDistance(c, key, tol);
      if (dist <= tol && dist < ad) ad = dist;
    }
    if (ad === Infinity) continue;
    if (ad < bestD) { best = a; bestD = ad; tie = false; }
    else if (ad === bestD && best && best.id !== a.id) tie = true;
  }
  if (!best) return { ok: false, reason: 'unknown' };
  if (tie) return { ok: false, reason: 'ambiguous' };
  return { ok: true, answer: best, how: 'fuzzy' };
}
