import { castAnswer, startQuestion, type CastOutcome, type CastState } from '../core/game';
import { now } from '../core/clock';
import { onlineConfig, OnlineEngine } from './supabase';

/**
 * The game talks to an Engine. The local engine scores on the device with clearly labelled
 * estimated rarity. The online engine (Supabase) scores on the server from real answers.
 */
export interface Engine {
  readonly mode: 'local' | 'online';
  start(s: CastState): Promise<CastState>;
  cast(s: CastState, input: string): Promise<CastOutcome>;
}

export class LocalEngine implements Engine {
  readonly mode = 'local' as const;
  async start(s: CastState) {
    return startQuestion(s, now());
  }
  async cast(s: CastState, input: string) {
    // No shared answer data exists locally, so rarity comes from curated estimates.
    return castAnswer(s, input, now(), null);
  }
}

let engine: Engine | null = null;

export function getEngine(): Engine {
  if (!engine) {
    const cfg = onlineConfig();
    engine = cfg && cfg.session() ? new OnlineEngine(cfg) : new LocalEngine();
  }
  return engine;
}
