// Central game configuration. Change values here, not in game code.

export const GAME = {
  questionsPerCast: 7,
  secondsPerQuestion: 20,
  /** Daily Cast #1 starts at this instant. Every player resets at 00:00 UTC. */
  epochUtc: Date.UTC(2026, 10, 25),
  /** Minimum valid responses for a question before real player frequency is shown. */
  minSampleSize: 200,
  /** Public link used on share cards and copied results. */
  shareUrl: 'https://optickbl.github.io/oddfish/',
} as const;

export type TierId = 'boot' | 'sardine' | 'clownfish' | 'octopus' | 'swordfish' | 'leviathan';

export interface TierDef {
  id: TierId;
  name: string;
  rarity: string;
  kg: number;
  emoji: string;
  /** Minimum answer frequency (%) for this tier. null for the boot. */
  minPct: number | null;
}

/** Tiers from most common to rarest. Thresholds are in percent of valid answers. */
export const TIERS: readonly TierDef[] = [
  { id: 'boot', name: 'Old Boot', rarity: 'Incorrect', kg: 0, emoji: '🥾', minPct: null },
  { id: 'sardine', name: 'Sardine', rarity: 'Very common', kg: 1, emoji: '🐟', minPct: 30 },
  { id: 'clownfish', name: 'Clownfish', rarity: 'Common', kg: 5, emoji: '🐠', minPct: 10 },
  { id: 'octopus', name: 'Octopus', rarity: 'Uncommon', kg: 25, emoji: '🐙', minPct: 3 },
  { id: 'swordfish', name: 'Swordfish', rarity: 'Rare', kg: 100, emoji: '🗡️', minPct: 1 },
  { id: 'leviathan', name: 'Leviathan', rarity: 'Legendary', kg: 500, emoji: '🐉', minPct: 0 },
];

export const tierById = (id: TierId): TierDef => TIERS.find((t) => t.id === id)!;
export const tierIndex = (id: TierId): number => TIERS.findIndex((t) => t.id === id);

export const WAGER_MULTIPLIER = 2;

export type TopicId =
  | 'geography' | 'animals' | 'food' | 'nature' | 'history' | 'science' | 'culture' | 'general';

export interface TopicDef {
  id: TopicId;
  label: string;
  /** Creature variant name used for catches from this topic, e.g. "Atlas Sardine". */
  variant: string;
  palette: { base: string; shade: string; light: string; accent: string };
}

export const TOPICS: readonly TopicDef[] = [
  { id: 'geography', label: 'Geography', variant: 'Atlas', palette: { base: '#4f9fd1', shade: '#2d6d9a', light: '#bfe4f7', accent: '#f2c14e' } },
  { id: 'animals', label: 'Animals', variant: 'Wild', palette: { base: '#8fb54a', shade: '#5c7d2b', light: '#d9ecaa', accent: '#5a3a1f' } },
  { id: 'food', label: 'Food', variant: 'Saffron', palette: { base: '#f2a531', shade: '#c4721a', light: '#ffe0a3', accent: '#b6332a' } },
  { id: 'nature', label: 'Nature', variant: 'Mossy', palette: { base: '#4e9b7a', shade: '#2f6b52', light: '#b5e3c9', accent: '#e86f8a' } },
  { id: 'history', label: 'History', variant: 'Ancient', palette: { base: '#c07a4a', shade: '#86492a', light: '#f0c9a4', accent: '#e9d27a' } },
  { id: 'science', label: 'Science', variant: 'Starlit', palette: { base: '#8a6be0', shade: '#5a3fb0', light: '#d8ccff', accent: '#7ff0e4' } },
  { id: 'culture', label: 'Culture', variant: 'Painted', palette: { base: '#e06a9f', shade: '#a83d70', light: '#ffc9e0', accent: '#4ad0d9' } },
  { id: 'general', label: 'General knowledge', variant: 'Curious', palette: { base: '#38b8b0', shade: '#1f7f79', light: '#b9f0ea', accent: '#ff8a5c' } },
];

export const topicById = (id: TopicId): TopicDef => TOPICS.find((t) => t.id === id)!;
