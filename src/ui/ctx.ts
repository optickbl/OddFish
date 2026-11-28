import type { SaveData } from '../core/progress';
import type { Engine } from '../services/engine';

export type Route = 'home' | 'cast' | 'results' | 'harbour' | 'logbook' | 'records' | 'profile';

export interface Ctx {
  save: SaveData;
  /** Today's Daily Cast number (global, UTC). */
  today: () => number;
  engine: Engine;
  persist: () => void;
  go: (r: Route) => void;
  rerender: () => void;
  reduced: () => boolean;
  /** Registers cleanup for the current view (timers, listeners). */
  onLeave: (fn: () => void) => void;
}
