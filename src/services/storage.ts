import { freshSave, type SaveData } from '../core/progress';

const KEY = 'oddfish:save:v1';
let memory: string | null = null;

function randomId(): string {
  try {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(16).slice(2, 18).padEnd(16, '0');
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function write(v: string) {
  memory = v;
  try {
    localStorage.setItem(KEY, v);
    return true;
  } catch {
    return false;
  }
}

function isSave(x: unknown): x is SaveData {
  const s = x as SaveData;
  return !!s && s.v === 1 && typeof s.playerId === 'string' && Array.isArray(s.history) && typeof s.found === 'object' && !!s.streak;
}

/** Fill in anything an older save doesn't have yet. */
function upgrade(parsed: SaveData, now: number): SaveData {
  const base = freshSave(now, parsed.playerId);
  const save: SaveData = { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings }, upgrades: { ...base.upgrades, ...parsed.upgrades } };
  // Saves from before the Harbour: everything already hauled goes in the purse.
  if (typeof (parsed as Partial<SaveData>).purse !== 'number') save.purse = save.history.reduce((s, h) => s + h.totalKg, 0);
  return save;
}

export function loadSave(now: number): SaveData {
  const raw = read();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isSave(parsed)) return upgrade(parsed, now);
    } catch {
      /* fall through to a fresh save */
    }
  }
  return freshSave(now, randomId());
}

export function persist(save: SaveData): boolean {
  return write(JSON.stringify(save));
}

/** Progress is stored on this device only. Players can keep a copy as text. */
export const exportSave = (save: SaveData) => JSON.stringify(save);

export function importSave(text: string): SaveData | null {
  try {
    const parsed = JSON.parse(text);
    return isSave(parsed) ? upgrade(parsed, Date.now()) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
