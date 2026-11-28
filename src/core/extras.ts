/**
 * Everything layered on top of the Daily Cast: what changes a catch (bait, the Surprise
 * Tide, boat upgrades, variants, seasonal and abyss creatures, beginner's luck, missed-day
 * casts) and what keeps a player coming back (streak freezes, the Streak Wager, the
 * Captain's orders, ranks, milestones, the Captain's Log, the weather on the sea).
 *
 * Pure functions only: the screens call these and save the result.
 */
import { GAME, TOPICS, tierById, tierIndex, topicById, type TierId, type TopicId } from '../config';
import { ABYSS, SEASONAL, SETS, SPECIES, VARIANT_INFO, speciesId, variantId, type SetId, type VariantId } from '../content/creatures';
import { CASTS_PER_PAGE, LOG_PAGES } from '../content/lore';
import type { Question } from './answers';
import type { CastState, CastSummary, CatchRecord } from './game';
import { liveStreak, type SaveData } from './progress';
import { dayStart, rng } from './schedule';

const MIN = 60_000;

// ───────────────────────── Cast modifiers ─────────────────────────

export type CastKind = 'daily' | 'archive';

/** Everything that shapes a cast, fixed when it starts so reloading can't change a catch. */
export interface CastMods {
  kind: CastKind;
  /** Topic that weighs double, or null. */
  bait: TopicId | null;
  limitMs: number;
  tide: { start: number; end: number } | null;
  /** Seeds this player's rolls for this cast. */
  seed: number;
  /** Beginner's luck: the first correct answer lands at least an Octopus. */
  luck: boolean;
  /** Shiny odds: 1 in this many. */
  shinyOdds: number;
  /** Sonar hints available this cast. */
  sonar: number;
  /** Weight salvaged from each Old Boot. */
  salvageKg: number;
  /** Correct catches before this cast, for abyss unlocks. */
  lifetime: number;
  /** Device time zone offset (minutes, as Date#getTimezoneOffset) when the cast began. */
  tz: number;
}

export interface Multiplier { label: string; x: number }

export const ARCHIVE_FACTOR = 0.5;
export const MUTANT_SECONDS = 5;
export const NIGHT = { from: 20, to: 6 };
const SEASONAL_CHANCE = 0.4;
const ABYSS_CHANCE = 0.3;

export const limitOf = (s: CastState) => s.mods?.limitMs ?? GAME.secondsPerQuestion * 1000;

/** The Surprise Tide: a 90-minute double-weight window at a different time every day. */
export function tideFor(day: number): { start: number; end: number } {
  const r = rng(day * 2246822519 + 77);
  // Starts between 07:00 and 19:30 UTC (09:00–21:30 in Athens), so it's never the middle of the night in Europe.
  const startMin = 7 * 60 + Math.floor(r() * (12.5 * 60));
  const start = dayStart(day) + startMin * MIN;
  return { start, end: start + 90 * MIN };
}

export const inWindow = (w: { start: number; end: number } | null, at: number) => !!w && at >= w.start && at < w.end;

const local = (at: number, tz: number) => new Date(at - tz * MIN);
export const localHour = (at: number, tz: number) => local(at, tz).getUTCHours();
export const localMonth = (at: number, tz: number) => local(at, tz).getUTCMonth();
export const isNight = (hour: number) => hour >= NIGHT.from || hour < NIGHT.to;

function seedFor(playerId: string, day: number, kind: CastKind): number {
  let h = 2166136261 ^ day ^ (kind === 'archive' ? 0x5bd1e995 : 0);
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function dailyCasts(save: SaveData): CastSummary[] {
  return save.history.filter((h) => (h.kind ?? 'daily') === 'daily');
}

export function lifetimeCatches(save: SaveData): number {
  let n = 0;
  for (const h of save.history) for (const c of h.catches) if (c.tier !== 'boot') n++;
  return n;
}

export function buildMods(save: SaveData, day: number, kind: CastKind, bait: TopicId | null, tz: number): CastMods {
  const u = save.upgrades;
  return {
    kind,
    bait,
    limitMs: (GAME.secondsPerQuestion + UPGRADES.rod.effect[u.rod]) * 1000,
    tide: kind === 'daily' ? tideFor(day) : null,
    seed: seedFor(save.playerId, day, kind),
    luck: kind === 'daily' && dailyCasts(save).length < LUCK_CASTS,
    shinyOdds: UPGRADES.lantern.effect[u.lantern],
    sonar: UPGRADES.sonar.effect[u.sonar],
    salvageKg: UPGRADES.net.effect[u.net],
    lifetime: lifetimeCatches(save),
    tz,
  };
}

export const LUCK_CASTS = 7;

/** Topics in a set of questions, in order of appearance, with how many questions each has. */
export function baitOptions(questions: Question[]): { topic: TopicId; n: number }[] {
  const out: { topic: TopicId; n: number }[] = [];
  for (const q of questions) {
    const o = out.find((x) => x.topic === q.topic);
    if (o) o.n++;
    else out.push({ topic: q.topic, n: 1 });
  }
  return out;
}

/**
 * Turn a plain catch into the real one: beginner's luck, abyss and seasonal creatures,
 * variants, and every multiplier. Rolls come from the cast's seed, so they never change.
 */
export function decorate(rec: CatchRecord, s: CastState): { rec: CatchRecord; luckUsed: boolean } {
  const m = s.mods;
  if (!m) return { rec, luckUsed: !!s.luckUsed };
  if (rec.tier === 'boot') {
    const salvage = m.salvageKg;
    return { rec: salvage > 0 ? { ...rec, kg: salvage, salvage } : rec, luckUsed: !!s.luckUsed };
  }
  let tier: TierId = rec.tier;
  let boost: CatchRecord['boost'];
  let luckUsed = !!s.luckUsed;
  if (m.luck && !luckUsed) {
    luckUsed = true;
    if (tierIndex(tier) < tierIndex('octopus')) {
      tier = 'octopus';
      boost = 'luck';
    }
  }
  const r = rng((m.seed ^ Math.imul(rec.index + 1, 2654435761)) >>> 0);
  const rollAbyss = r(), rollSeason = r(), rollShiny = r();
  let species = speciesId(tier, rec.topic);
  let variant: VariantId | undefined;
  let special: CatchRecord['special'];

  const deep = ABYSS.filter((d) => d.tier === tier && m.lifetime >= d.unlockAt);
  const month = localMonth(rec.at, m.tz);
  const visitors = SEASONAL.filter((v) => v.tier === tier && v.months.includes(month));
  const elapsed = m.limitMs / 1000 - rec.secondsLeft;
  if (deep.length && rollAbyss < ABYSS_CHANCE) {
    species = `abyss:${deep[Math.floor(rollAbyss / ABYSS_CHANCE * deep.length)].key}`;
    special = 'abyss';
  } else if (visitors.length && rollSeason < SEASONAL_CHANCE) {
    species = `season:${visitors[Math.floor(rollSeason / SEASONAL_CHANCE * visitors.length)].key}`;
    special = 'seasonal';
  } else if (rollShiny < 1 / m.shinyOdds) variant = 'shiny';
  else if (elapsed <= MUTANT_SECONDS) variant = 'mutant';
  else if (isNight(localHour(rec.at, m.tz))) variant = 'night';
  if (variant) species = variantId(variant, tier);

  const baseKg = tierById(tier).kg;
  const mults: Multiplier[] = [];
  if (rec.wager) mults.push({ label: 'Captain’s Wager', x: 2 });
  if (m.bait && m.bait === rec.topic) mults.push({ label: `${topicById(m.bait).label} bait`, x: 2 });
  if (inWindow(m.tide, rec.at)) mults.push({ label: 'Surprise Tide', x: 2 });
  if (variant) mults.push({ label: VARIANT_INFO[variant].label, x: VARIANT_INFO[variant].mult });
  if (m.kind === 'archive') mults.push({ label: 'Missed-day cast', x: ARCHIVE_FACTOR });
  const x = mults.reduce((p, k) => p * k.x, 1);
  const kg = Math.max(1, Math.round(baseKg * x));
  return {
    rec: { ...rec, tier, baseKg, kg, species, variant, special, boost, mults },
    luckUsed,
  };
}

/** Sonar: a clue to a rare answer for this question. */
export function sonarHint(q: Question, day: number): { letter: string; letters: number; words: number } {
  const rare = q.answers.filter((a) => a.est < 3);
  const pool = rare.length ? rare : q.answers.slice().sort((a, b) => a.est - b.est).slice(0, 3);
  let h = day * 131;
  for (const ch of q.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = pool[Math.floor(rng(h)() * pool.length)];
  return { letter: a.name.trim()[0].toUpperCase(), letters: a.name.replace(/[^\p{L}]/gu, '').length, words: a.name.trim().split(/\s+/).length };
}

// ───────────────────────── Boat upgrades ─────────────────────────

export type UpgradeId = 'rod' | 'lantern' | 'sonar' | 'net';

export interface UpgradeDef {
  name: string;
  /** Effect at each level, level 0 first. */
  effect: number[];
  /** Cost to reach level 1, 2, 3. */
  costs: number[];
  describe: (v: number) => string;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  rod: { name: 'Long Rod', effect: [0, 2, 4, 6], costs: [400, 1200, 3000], describe: (v) => (v ? `+${v} seconds on every question` : 'No extra time') },
  lantern: { name: 'Lucky Lantern', effect: [50, 40, 30, 20], costs: [500, 1500, 3500], describe: (v) => `Shiny odds: 1 in ${v}` },
  sonar: { name: 'Sonar', effect: [0, 1, 2, 3], costs: [600, 1500, 3500], describe: (v) => (v ? `${v} rare-answer ${v === 1 ? 'hint' : 'hints'} per cast` : 'No hints') },
  net: { name: 'Salvage Net', effect: [0, 5, 15, 40], costs: [300, 900, 2400], describe: (v) => (v ? `Each Old Boot salvages ${v} kg` : 'Old Boots weigh nothing') },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
export const MAX_LEVEL = 3;

export function buyUpgrade(save: SaveData, id: UpgradeId): boolean {
  const lvl = save.upgrades[id];
  if (lvl >= MAX_LEVEL) return false;
  const cost = UPGRADES[id].costs[lvl];
  if (save.purse < cost) return false;
  save.purse -= cost;
  save.upgrades = { ...save.upgrades, [id]: lvl + 1 };
  return true;
}

// ───────────────────────── Streak freeze ─────────────────────────

export const MAX_FREEZES = 2;
export const FREEZE_COST = 500;

/** A freeze is earned for every seven days in a row. */
export function earnFreeze(save: SaveData): boolean {
  if (save.streak.current > 0 && save.streak.current % 7 === 0 && save.freezes < MAX_FREEZES) {
    save.freezes++;
    return true;
  }
  return false;
}

/**
 * Missed days are covered by freezes, if there are enough of them. Covered days keep the
 * streak alive (they don't add to it). Returns how many freezes were used.
 */
export function applyFreezes(save: SaveData, today: number): number {
  const s = save.streak;
  if (s.current <= 0 || s.lastDay <= 0) return 0;
  const missed = today - 1 - s.lastDay;
  if (missed <= 0 || save.freezes < missed) return 0;
  save.freezes -= missed;
  for (let d = s.lastDay + 1; d < today; d++) save.frozenDays = [...save.frozenDays, d];
  save.streak = { ...s, lastDay: today - 1 };
  return missed;
}

export function buyFreeze(save: SaveData): boolean {
  if (save.freezes >= MAX_FREEZES || save.purse < FREEZE_COST) return false;
  save.purse -= FREEZE_COST;
  save.freezes++;
  return true;
}

// ───────────────────────── Streak Wager ─────────────────────────

export const WAGER_DAYS = 7;
export const WAGER_STAKES = [100, 250, 500];

export function placeStreakWager(save: SaveData, today: number, stake: number): boolean {
  if (save.streakWager || save.purse < stake) return false;
  save.purse -= stake;
  save.streakWager = { start: today, stake };
  return true;
}

const playedDaily = (save: SaveData, d: number) => save.history.some((h) => h.day === d && (h.kind ?? 'daily') === 'daily');

/** Days of the current Streak Wager already done. */
export const wagerProgress = (save: SaveData) =>
  save.streakWager ? Array.from({ length: WAGER_DAYS }, (_, i) => playedDaily(save, save.streakWager!.start + i)).filter(Boolean).length : 0;

/** Settle the Streak Wager: seven Daily Casts in seven days wins double; a missed day loses it. */
export function resolveStreakWager(save: SaveData, today: number): 'won' | 'lost' | null {
  const w = save.streakWager;
  if (!w) return null;
  const days = Array.from({ length: WAGER_DAYS }, (_, i) => w.start + i);
  if (days.every((d) => playedDaily(save, d))) {
    save.purse += w.stake * 2;
    save.streakWager = null;
    save.lastStreakWager = { stake: w.stake, won: true };
    return 'won';
  }
  if (days.some((d) => d < today && !playedDaily(save, d))) {
    save.streakWager = null;
    save.lastStreakWager = { stake: w.stake, won: false };
    return 'lost';
  }
  return null;
}

// ───────────────────────── Captain's orders ─────────────────────────

export type OrderKind = 'tierTopic' | 'haul' | 'quick' | 'days' | 'perfect' | 'rare' | 'variety' | 'variant';

export interface Order {
  week: number;
  kind: OrderKind;
  text: string;
  target: number;
  topic?: TopicId;
  reward: number;
}

export const ORDER_REWARD = 400;
export const weekOf = (day: number) => Math.floor((day - 1) / 7);
export const weekEnd = (week: number) => week * 7 + 7;

const ORDER_KINDS: OrderKind[] = ['tierTopic', 'haul', 'quick', 'days', 'perfect', 'rare', 'variety', 'variant'];

export function orderFor(week: number): Order {
  const r = rng(week * 7919 + 31);
  const kind = ORDER_KINDS[Math.floor(r() * ORDER_KINDS.length)];
  const topic = TOPICS[Math.floor(r() * TOPICS.length)].id;
  const base = { week, kind, reward: ORDER_REWARD };
  switch (kind) {
    case 'tierTopic': return { ...base, topic, target: 1, text: `Land an Octopus or rarer on a ${topicById(topic).label.toLowerCase()} question` };
    case 'haul': return { ...base, target: 2000, text: 'Haul 2,000 kg this week' };
    case 'quick': return { ...base, target: 6, text: 'Land 6 catches with 10 or more seconds left' };
    case 'days': return { ...base, target: 5, text: 'Finish 5 Daily Casts this week' };
    case 'perfect': return { ...base, target: 1, text: 'Get 6 or more right in a single cast' };
    case 'rare': return { ...base, target: 2, text: 'Land 2 Swordfish or rarer' };
    case 'variety': return { ...base, target: 6, text: 'Catch fish from 6 different topics' };
    case 'variant': return { ...base, target: 1, text: 'Land a Shiny, Night or Mutant catch' };
  }
}

export function orderProgress(o: Order, save: SaveData): number {
  const casts = save.history.filter((h) => weekOf(h.playedOn ?? h.day) === o.week);
  const caught = casts.flatMap((h) => h.catches).filter((c) => c.tier !== 'boot');
  switch (o.kind) {
    case 'tierTopic': return caught.filter((c) => c.topic === o.topic && tierIndex(c.tier) >= tierIndex('octopus')).length;
    case 'haul': return Math.round(casts.reduce((s, h) => s + h.totalKg, 0));
    case 'quick': return caught.filter((c) => c.secondsLeft >= 10).length;
    case 'days': return casts.filter((h) => (h.kind ?? 'daily') === 'daily').length;
    case 'perfect': return casts.filter((h) => h.correct >= 6).length;
    case 'rare': return caught.filter((c) => tierIndex(c.tier) >= tierIndex('swordfish')).length;
    case 'variety': return new Set(caught.map((c) => c.topic)).size;
    case 'variant': return caught.filter((c) => !!c.variant).length;
  }
}

/** Pay out this week's orders if they're done. Returns the reward paid, or 0. */
export function claimOrder(save: SaveData, today: number): number {
  const o = orderFor(weekOf(today));
  if (save.ordersClaimed.includes(o.week) || orderProgress(o, save) < o.target) return 0;
  save.ordersClaimed = [...save.ordersClaimed, o.week];
  save.purse += o.reward;
  return o.reward;
}

// ───────────────────────── Ranks ─────────────────────────

export interface Rank { name: string; kg: number; coat: string; band: string }

export const RANKS: Rank[] = [
  { name: 'Deckhand', kg: 0, coat: '#1d3550', band: '#1d3550' },
  { name: 'Bosun', kg: 300, coat: '#2f5d4e', band: '#1f4036' },
  { name: 'Navigator', kg: 1000, coat: '#34508f', band: '#22386a' },
  { name: 'First Mate', kg: 3000, coat: '#7a2f3c', band: '#561f29' },
  { name: 'Skipper', kg: 7500, coat: '#2d2f3a', band: '#e7ad58' },
  { name: 'Captain', kg: 15000, coat: '#14283f', band: '#e7ad58' },
  { name: 'Commodore', kg: 30000, coat: '#4a2a6b', band: '#e7ad58' },
  { name: 'Admiral', kg: 60000, coat: '#f3ede1', band: '#e7ad58' },
];

export const lifetimeKg = (save: SaveData) => save.history.reduce((s, h) => s + h.totalKg, 0);

export function rankFor(kg: number): { rank: Rank; index: number; next: Rank | null } {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (kg >= RANKS[i].kg) index = i;
  return { rank: RANKS[index], index, next: RANKS[index + 1] ?? null };
}

// ───────────────────────── Milestones ─────────────────────────

export interface Milestone { days: number; reward: number; unlock?: string }

export const MILESTONES: Milestone[] = [
  { days: 3, reward: 100 },
  { days: 7, reward: 300, unlock: 'A pennant for the mast' },
  { days: 14, reward: 600 },
  { days: 30, reward: 1500, unlock: 'A string of lanterns' },
  { days: 50, reward: 2500 },
  { days: 100, reward: 6000, unlock: 'Gold trim on the boat' },
  { days: 200, reward: 10000 },
  { days: 365, reward: 25000, unlock: 'A golden sea' },
];

/** The milestone reached by the current streak that hasn't been celebrated yet. */
export function pendingMilestone(save: SaveData): Milestone | null {
  const cur = save.streak.current;
  const due = MILESTONES.filter((m) => cur >= m.days && !save.milestonesSeen.includes(m.days));
  return due.length ? due[due.length - 1] : null;
}

export function celebrate(save: SaveData, m: Milestone) {
  // Every milestone up to this one counts as seen; the reward is paid once.
  for (const x of MILESTONES) if (x.days <= m.days && !save.milestonesSeen.includes(x.days)) save.milestonesSeen = [...save.milestonesSeen, x.days];
  save.purse += m.reward;
}

/** Boat cosmetics follow the best streak ever reached. */
export function boatLevel(save: SaveData): { pennant: boolean; lanterns: boolean; gold: boolean } {
  const b = Math.max(save.streak.best, save.streak.current);
  return { pennant: b >= 7, lanterns: b >= 30, gold: b >= 100 };
}

// ───────────────────────── Captain's Log ─────────────────────────

export function pagesUnlocked(save: SaveData): number {
  const n = dailyCasts(save).length;
  if (n === 0) return 0;
  return Math.min(LOG_PAGES.length, 1 + Math.floor((n - 1) / CASTS_PER_PAGE));
}

/** Daily Casts still to go before the next page, or null when all are unlocked. */
export function castsToNextPage(save: SaveData): number | null {
  const have = pagesUnlocked(save);
  if (have >= LOG_PAGES.length) return null;
  const need = have * CASTS_PER_PAGE + 1;
  return need - dailyCasts(save).length;
}

// ───────────────────────── The sea ─────────────────────────

export type Weather = 'calm' | 'storm' | 'golden';

/** Storms after a missed day, gold on a long streak. */
export function weatherFor(save: SaveData, today: number): Weather {
  const playedToday = playedDaily(save, today);
  if (!playedToday && save.streak.lastDay > 0 && save.streak.lastDay < today - 1) return 'storm';
  if (liveStreak(save.streak, today) >= 7) return 'golden';
  return 'calm';
}

/** Harbour props grow with the Logbook. */
export const harbourSize = (save: SaveData) => Math.min(10, Math.floor(Object.keys(save.found).length / 5));

// ───────────────────────── Beat yourself ─────────────────────────

/** Your average daily haul over the last seven Daily Casts before today. */
export function sevenDayTarget(save: SaveData, today: number): number | null {
  const prior = dailyCasts(save).filter((h) => h.day < today).sort((a, b) => b.day - a.day).slice(0, 7);
  if (!prior.length) return null;
  return Math.round(prior.reduce((s, h) => s + h.totalKg, 0) / prior.length);
}

// ───────────────────────── Missed-day casts ─────────────────────────

export const ARCHIVE_WINDOW = 30;

/** Past days with no cast, newest first. */
export function missedDays(save: SaveData, today: number): number[] {
  const out: number[] = [];
  for (let d = today - 1; d >= Math.max(1, today - ARCHIVE_WINDOW); d--) if (!save.history.some((h) => h.day === d)) out.push(d);
  return out;
}

export const archiveAvailable = (save: SaveData, today: number) => save.archivePlayedOn !== today;

// ───────────────────────── Aquarium ─────────────────────────

export const EXHIBIT_REWARD = 1000;

export function exhibits(save: SaveData): { id: SetId; label: string; have: number; total: number; done: boolean }[] {
  return SETS.map((s) => {
    const list = SPECIES.filter((x) => x.set === s.id);
    const have = list.filter((x) => save.found[x.id]).length;
    return { id: s.id, label: s.label, have, total: list.length, done: have === list.length };
  });
}

/** Completed exhibits not yet rewarded get paid now. Returns their labels. */
export function claimExhibits(save: SaveData): string[] {
  const out: string[] = [];
  for (const e of exhibits(save)) {
    if (e.done && !save.exhibitsDone.includes(e.id)) {
      save.exhibitsDone = [...save.exhibitsDone, e.id];
      save.purse += EXHIBIT_REWARD;
      out.push(e.label);
    }
  }
  return out;
}

/** Seasonal visitors leaving at the end of this month that the player hasn't caught. */
export function leavingSoon(save: SaveData, at: number, tz: number): { id: string; name: string; daysLeft: number }[] {
  const d = new Date(at - tz * MIN);
  const month = d.getUTCMonth();
  const next = (month + 1) % 12;
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const daysLeft = Math.max(1, Math.ceil((end - d.getTime()) / 86_400_000));
  return SEASONAL.filter((v) => v.months.includes(month) && !v.months.includes(next) && !save.found[`season:${v.key}`])
    .map((v) => ({ id: `season:${v.key}`, name: v.name, daysLeft }));
}

export function inSeason(at: number, tz: number) {
  const month = localMonth(at, tz);
  return SEASONAL.filter((v) => v.months.includes(month));
}

export function tierLabel(id: TierId) {
  return tierById(id).name;
}
