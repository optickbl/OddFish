import { TIERS, TOPICS, type TierId, type TopicId } from '../config';

export type SetId = 'reef' | 'deep' | 'legendary' | 'oddities';
export type OddityId = 'boot' | 'bottle' | 'pearl' | 'horseshoe' | 'chest' | 'anchor';

export interface Species {
  id: string;
  name: string;
  /** Art used to draw it. */
  art: TierId | OddityId;
  tier: TierId | null;
  topic: TopicId | null;
  set: SetId;
  /** How to find it, shown on undiscovered oddities. */
  hint?: string;
}

export const SETS: { id: SetId; label: string }[] = [
  { id: 'reef', label: 'Reef' },
  { id: 'deep', label: 'Deep Sea' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'oddities', label: 'Oddities' },
];

const setForTier = (t: TierId): SetId => (t === 'sardine' || t === 'clownfish' ? 'reef' : t === 'leviathan' ? 'legendary' : 'deep');

/** Each fish tier comes in one variant per topic: an Atlas Sardine, a Starlit Leviathan… */
export const speciesId = (tier: TierId, topic: TopicId) => `${tier}:${topic}`;

const FISH: Species[] = TIERS.filter((t) => t.id !== 'boot').flatMap((t) =>
  TOPICS.map((tp) => ({ id: speciesId(t.id, tp.id), name: `${tp.variant} ${t.name}`, art: t.id, tier: t.id, topic: tp.id, set: setForTier(t.id) })),
);

export const ODDITIES: Species[] = [
  { id: 'boot', name: 'Old Boot', art: 'boot', tier: 'boot', topic: null, set: 'oddities', hint: 'Every wrong answer lands one.' },
  { id: 'bottle', name: 'Message in a Bottle', art: 'bottle', tier: null, topic: null, set: 'oddities', hint: 'Land a correct answer in the final three seconds.' },
  { id: 'pearl', name: 'Perfect Pearl', art: 'pearl', tier: null, topic: null, set: 'oddities', hint: 'Answer all seven correctly.' },
  { id: 'horseshoe', name: 'Lucky Horseshoe', art: 'horseshoe', tier: null, topic: null, set: 'oddities', hint: 'Win the Captain’s Wager on a Swordfish or Leviathan.' },
  { id: 'chest', name: 'Treasure Chest', art: 'chest', tier: null, topic: null, set: 'oddities', hint: 'Haul 1,500 kg in one Daily Cast.' },
  { id: 'anchor', name: 'Ship’s Anchor', art: 'anchor', tier: null, topic: null, set: 'oddities', hint: 'Keep a seven-day streak.' },
];

export const SPECIES: Species[] = [...FISH, ...ODDITIES];
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export const speciesById = (id: string) => BY_ID.get(id);
