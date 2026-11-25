import type { TopicId } from '../config';
import { DEFAULT_EST, QUESTION_SOURCES, type QuestionSource } from '../content/questions';

export interface CanonAnswer {
  id: string;
  name: string;
  /** Normalised accepted spellings (with spaces). */
  keys: string[];
  /** Same keys with spaces removed, used for compact and fuzzy matching. */
  compact: string[];
  /** Curated provisional estimate, percent. Only used before real data exists. */
  est: number;
}

export interface Question {
  id: string;
  topic: TopicId;
  difficulty: 1 | 2 | 3;
  text: string;
  answers: CanonAnswer[];
}

const FOLD: Record<string, string> = { ł: 'l', Ł: 'l', ø: 'o', Ø: 'o', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', ß: 'ss', đ: 'd', Đ: 'd', ı: 'i' };

/** Canonical form for comparing answers: case, accents, punctuation and spacing don't matter. */
export function normalize(input: string): string {
  return String(input)
    .replace(/[łŁøØæÆœŒßđĐı]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’‘`´]/g, '')
    .replace(/[-_/,;:]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

export const slug = (s: string) => normalize(s).replace(/ /g, '-');

function keysFor(name: string, suffix?: string): string[] {
  const k = normalize(name);
  const out = new Set([k]);
  if (suffix) {
    const s = normalize(suffix);
    if (k.endsWith(' ' + s)) out.add(k.slice(0, -(s.length + 1)));
    else if (k !== s) out.add(`${k} ${s}`);
  }
  return [...out].filter(Boolean);
}

export function parseQuestion(src: QuestionSource): Question {
  const seen = new Map<string, string>();
  const answers = src.answers.split(';').map((raw) => {
    const [namesPart, estPart] = raw.split('=');
    const names = namesPart.split('|').map((n) => n.trim()).filter(Boolean);
    const name = names[0];
    const keys = [...new Set(names.flatMap((n) => keysFor(n, src.suffix)))];
    const est = estPart === undefined ? DEFAULT_EST : Number(estPart);
    if (!name || Number.isNaN(est)) throw new Error(`Bad answer "${raw}" in ${src.id}`);
    const id = slug(name);
    for (const k of keys) {
      const owner = seen.get(k);
      if (owner && owner !== id) throw new Error(`Alias "${k}" used twice in ${src.id}`);
      seen.set(k, id);
    }
    return { id, name, keys, compact: keys.map((k) => k.replace(/ /g, '')), est };
  });
  return { id: src.id, topic: src.topic, difficulty: src.difficulty, text: src.text, answers };
}

export const QUESTIONS: Question[] = QUESTION_SOURCES.map(parseQuestion);
const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
export const questionById = (id: string): Question | undefined => BY_ID.get(id);
