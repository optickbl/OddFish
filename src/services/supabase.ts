/**
 * Online play through Supabase (PostgREST + Auth over plain fetch, no SDK).
 *
 * Switched OFF until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time
 * and supabase/schema.sql has been applied. See README "Online play".
 * Scoring, validation, rarity and the 20-second deadline are all enforced by the
 * database functions; the client only displays what the server returns.
 */
import { decorate } from '../core/extras';
import { tierById, type TierId } from '../config';
import { speciesId } from '../content/creatures';
import { currentQuestion, isAnswered, type CastOutcome, type CastState, type CatchRecord } from '../core/game';
import { now } from '../core/clock';

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string | null;
}

const SESSION_KEY = 'oddfish:session:v1';

export interface OnlineConfig {
  url: string;
  anonKey: string;
  session(): Session | null;
}

export function onlineConfig(): OnlineConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey, session: readSession };
}

export const onlineAvailable = () => onlineConfig() !== null;

function readSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    return s && s.accessToken ? s : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(cfg: OnlineConfig, path: string, body: unknown, auth = true, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const s = cfg.session();
      const res = await fetch(`${cfg.url}${path}`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth && s ? s.accessToken : cfg.anonKey}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429) throw new Error('rate-limited');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network error');
}

/** Email magic-link sign-in. The link returns to the site with tokens in the hash. */
export async function sendMagicLink(email: string): Promise<void> {
  const cfg = onlineConfig();
  if (!cfg) throw new Error('Online play is not switched on yet.');
  await request(cfg, '/auth/v1/otp', { email, create_user: true }, false, 1);
}

export function captureSessionFromUrl(): boolean {
  const h = location.hash.startsWith('#access_token=') ? new URLSearchParams(location.hash.slice(1)) : null;
  if (!h) return false;
  const token = h.get('access_token');
  if (!token) return false;
  let email: string | null = null;
  try {
    email = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? null;
  } catch {
    /* ignore */
  }
  saveSession({ accessToken: token, refreshToken: h.get('refresh_token') ?? '', expiresAt: Date.now() + Number(h.get('expires_in') ?? 3600) * 1000, email });
  history.replaceState(null, '', location.pathname + '#profile');
  return true;
}

export const signedInEmail = () => readSession()?.email ?? null;
export const signOut = () => saveSession(null);

interface ServerCatch {
  started_at?: string;
  answer_id: string | null;
  answer_name: string | null;
  tier: TierId;
  base_kg: number;
  kg: number;
  wager: boolean;
  pct: number | null;
  source: 'players' | 'estimate' | null;
  sample: number | null;
  timed_out: boolean;
  seconds_left: number;
}

export class OnlineEngine {
  readonly mode = 'online' as const;
  constructor(private cfg: OnlineConfig) {}

  async start(s: CastState): Promise<CastState> {
    if (s.startedAt !== null) return s;
    const qid = s.questionIds[s.index];
    const res = await request<{ started_at: string }>(this.cfg, '/rest/v1/rpc/start_question', { p_day: s.day, p_question_id: qid });
    return { ...s, startedAt: Date.parse(res.started_at) };
  }

  async cast(s: CastState, input: string): Promise<CastOutcome> {
    if (isAnswered(s)) return { state: s, record: null, rejected: 'duplicate' };
    const q = currentQuestion(s);
    if (!q) throw new Error('Unknown question');
    const wager = s.wagerArmed && s.wagerIndex === null;
    const r = await request<ServerCatch>(this.cfg, '/rest/v1/rpc/submit_answer', {
      p_day: s.day, p_question_id: q.id, p_input: input.trim().slice(0, 80), p_wager: wager,
    });
    const record: CatchRecord = {
      day: s.day, index: s.index, questionId: q.id, questionText: q.text, topic: q.topic, input: input.trim(),
      answerId: r.answer_id, answerName: r.answer_name, tier: r.tier, baseKg: r.base_kg ?? tierById(r.tier).kg, kg: r.kg,
      wager: r.wager, pct: r.pct, source: r.source, sample: r.sample,
      species: r.tier === 'boot' ? 'boot' : speciesId(r.tier, q.topic), timedOut: r.timed_out, secondsLeft: r.seconds_left, at: now(),
    };
    // Bait, tide, variants and upgrades are applied on top of the server's catch.
    const d = decorate(record, s);
    return { state: { ...s, luckUsed: s.mods ? d.luckUsed : s.luckUsed, catches: [...s.catches, d.rec], wagerArmed: false, wagerIndex: r.wager ? s.index : s.wagerIndex }, record: d.rec };
  }
}
