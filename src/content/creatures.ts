import { TIERS, TOPICS, tierById, type TierId, type TopicId } from '../config';

export type SetId = 'reef' | 'deep' | 'legendary' | 'variants' | 'seasonal' | 'abyss' | 'oddities';
export type OddityId = 'boot' | 'bottle' | 'pearl' | 'horseshoe' | 'chest' | 'anchor';
export type VariantId = 'shiny' | 'night' | 'mutant';
type FishTier = Exclude<TierId, 'boot'>;

/** Colours for a creature that doesn't use its topic colourway. */
export interface Look {
  /** Flat illustration palette. */
  svg: { base: string; shade: string; light: string; accent: string };
  /** 3D palette, merged over the model's own. */
  gl: { main: string; belly: string; light: string; dark: string; glow?: number; iridescence?: number; bellyMetal?: number; roughness?: number; metal?: number };
}

export interface Species {
  id: string;
  name: string;
  /** Art used to draw it. */
  art: TierId | OddityId;
  tier: TierId | null;
  topic: TopicId | null;
  set: SetId;
  /** How to find it, shown on undiscovered entries. */
  hint?: string;
  look?: Look;
  variant?: VariantId;
  /** Seasonal visitors: local months (0 = January) when they can be caught. */
  months?: number[];
  /** Abyss creatures: lifetime correct catches needed before they can appear. */
  unlockAt?: number;
}

export const SETS: { id: SetId; label: string }[] = [
  { id: 'reef', label: 'Reef' },
  { id: 'deep', label: 'Deep Sea' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'variants', label: 'Variants' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'abyss', label: 'The Abyss' },
  { id: 'oddities', label: 'Oddities' },
];

const setForTier = (t: TierId): SetId => (t === 'sardine' || t === 'clownfish' ? 'reef' : t === 'leviathan' ? 'legendary' : 'deep');

/** Each fish tier comes in one variant per topic: an Atlas Sardine, a Starlit Leviathan… */
export const speciesId = (tier: TierId, topic: TopicId) => `${tier}:${topic}`;
export const variantId = (v: VariantId, tier: TierId) => `${v}:${tier}`;

const FISH_TIERS = TIERS.filter((t) => t.id !== 'boot');

const FISH: Species[] = FISH_TIERS.flatMap((t) =>
  TOPICS.map((tp) => ({ id: speciesId(t.id, tp.id), name: `${tp.variant} ${t.name}`, art: t.id, tier: t.id, topic: tp.id, set: setForTier(t.id) })),
);

export const VARIANT_LOOK: Record<VariantId, Look> = {
  shiny: {
    svg: { base: '#f2c46d', shade: '#c98f2e', light: '#fff3cf', accent: '#8a5a1c' },
    gl: { main: '#e0a93a', belly: '#fff0c4', light: '#fff7da', dark: '#8a5a1c', bellyMetal: 0.95, metal: 0.65, iridescence: 0.8, roughness: 0.22, glow: 0.5 },
  },
  night: {
    svg: { base: '#24345c', shade: '#141f3a', light: '#7ff0e4', accent: '#7ff0e4' },
    gl: { main: '#1b2748', belly: '#2c3f6b', light: '#7ff0e4', dark: '#0b1020', glow: 2.4, roughness: 0.3 },
  },
  mutant: {
    svg: { base: '#8bc34a', shade: '#5b7d1f', light: '#e8ff9a', accent: '#7b2d8b' },
    gl: { main: '#6f9e2c', belly: '#c9e86a', light: '#e8ff9a', dark: '#5a1f6b', glow: 0.9, iridescence: 0.45 },
  },
};

export const VARIANT_INFO: Record<VariantId, { label: string; hint: string; mult: number }> = {
  shiny: { label: 'Shiny', hint: 'A rare golden catch. Any correct answer can land one.', mult: 1.5 },
  mutant: { label: 'Mutant', hint: 'Land a correct answer within 5 seconds.', mult: 1.5 },
  night: { label: 'Night', hint: 'Only bites between 8 pm and 6 am, your time.', mult: 1.25 },
};

const VARIANTS: Species[] = (['shiny', 'night', 'mutant'] as VariantId[]).flatMap((v) =>
  FISH_TIERS.map((t) => ({
    id: variantId(v, t.id), name: `${VARIANT_INFO[v].label} ${t.name}`, art: t.id, tier: t.id, topic: null,
    set: 'variants' as SetId, look: VARIANT_LOOK[v], variant: v, hint: `${VARIANT_INFO[v].hint} Must be ${article(t.name)} ${t.name}-tier answer.`,
  })),
);

function article(w: string) {
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

const L = (svg: Look['svg'], gl: Look['gl']): Look => ({ svg, gl });

interface Visitor { key: string; name: string; tier: FishTier; months: number[]; look: Look }

/** Seasonal visitors (northern hemisphere). Each swims through for two or three months. */
export const SEASONAL: Visitor[] = [
  { key: 'frostfin', name: 'Frostfin', tier: 'sardine', months: [11, 0, 1], look: L({ base: '#cfe8f5', shade: '#8fb8d0', light: '#ffffff', accent: '#4f7f9c' }, { main: '#9cc8e0', belly: '#f4fbff', light: '#ffffff', dark: '#4f7f9c', iridescence: 0.6, bellyMetal: 0.5 }) },
  { key: 'snowcap', name: 'Snowcap Clownfish', tier: 'clownfish', months: [0, 1], look: L({ base: '#e9eef5', shade: '#aebccc', light: '#ffffff', accent: '#3a4a63' }, { main: '#dfe7f1', belly: '#ffffff', light: '#ffffff', dark: '#3a4a63' }) },
  { key: 'aurora', name: 'Aurora Leviathan', tier: 'leviathan', months: [0, 1, 2], look: L({ base: '#3a9e8f', shade: '#24695f', light: '#c9fff2', accent: '#ff8ad8' }, { main: '#2f8a7c', belly: '#b6f2e4', light: '#ff8ad8', dark: '#16423b', glow: 2.2 }) },
  { key: 'blossom', name: 'Blossom Clownfish', tier: 'clownfish', months: [2, 3, 4], look: L({ base: '#f5a8c4', shade: '#d9759b', light: '#fff0f6', accent: '#7a2f4f' }, { main: '#f08db4', belly: '#ffd6e6', light: '#fff4f8', dark: '#7a2f4f' }) },
  { key: 'mistral', name: 'Mistral Swordfish', tier: 'swordfish', months: [2, 3], look: L({ base: '#9fb7c9', shade: '#6c879c', light: '#eef4f8', accent: '#3e5568' }, { main: '#7f9bb0', belly: '#eef4f8', light: '#d6ecff', dark: '#3e5568', iridescence: 0.4, bellyMetal: 0.5 }) },
  { key: 'tidepool', name: 'Tidepool Octopus', tier: 'octopus', months: [4, 5], look: L({ base: '#5fc4b0', shade: '#3a917f', light: '#c9f2e8', accent: '#fff4ea' }, { main: '#4fb3a0', belly: '#bdeee2', light: '#f0fff9', dark: '#2c6e61' }) },
  { key: 'sunfin', name: 'Sunfin', tier: 'sardine', months: [5, 6, 7], look: L({ base: '#f6c453', shade: '#d0952a', light: '#fff4cf', accent: '#8a5a1c' }, { main: '#f0b43c', belly: '#fff1c2', light: '#fffbe8', dark: '#8a5a1c', bellyMetal: 0.7 }) },
  { key: 'reefking', name: 'Reef King Octopus', tier: 'octopus', months: [6, 7], look: L({ base: '#ff7a59', shade: '#d1503a', light: '#ffd0bd', accent: '#fff4ea' }, { main: '#ff6d4a', belly: '#ffc2ad', light: '#fff0e6', dark: '#a33a29' }) },
  { key: 'meltemi', name: 'Meltemi Swordfish', tier: 'swordfish', months: [7, 8], look: L({ base: '#3fa7d6', shade: '#1f78a6', light: '#e6f6ff', accent: '#0f4a6b' }, { main: '#2b8fc4', belly: '#e6f6ff', light: '#bff0ff', dark: '#0f4a6b', bellyMetal: 0.5, iridescence: 0.4 }) },
  { key: 'harvest', name: 'Harvest Clownfish', tier: 'clownfish', months: [8, 9], look: L({ base: '#d9822b', shade: '#a85b16', light: '#fbe3c0', accent: '#4a2a0f' }, { main: '#c9701f', belly: '#f6c98f', light: '#fff1dc', dark: '#4a2a0f' }) },
  { key: 'gloom', name: 'Gloom Octopus', tier: 'octopus', months: [9, 10], look: L({ base: '#7b5ea7', shade: '#56407a', light: '#d7c6f0', accent: '#c6ff7a' }, { main: '#6a4f96', belly: '#bfa9e0', light: '#c6ff7a', dark: '#3a2856', glow: 1.2 }) },
  { key: 'stormcrest', name: 'Stormcrest Leviathan', tier: 'leviathan', months: [10, 11], look: L({ base: '#4b5a6b', shade: '#2f3a47', light: '#cfd8e2', accent: '#9fe8ff' }, { main: '#3a4756', belly: '#aab6c3', light: '#9fe8ff', dark: '#1c242e', glow: 2 }) },
];

interface Deep { key: string; name: string; tier: FishTier; unlockAt: number; look: Look }

/** Abyss creatures stay hidden until a player has landed enough catches. */
export const ABYSS: Deep[] = [
  { key: 'ghost', name: 'Ghost Swordfish', tier: 'swordfish', unlockAt: 25, look: L({ base: '#e9f1f4', shade: '#b9c9d1', light: '#ffffff', accent: '#6b8a99' }, { main: '#dfe9ee', belly: '#ffffff', light: '#c9fbff', dark: '#6b8a99', glow: 1.4, iridescence: 0.5 }) },
  { key: 'abyssal', name: 'Abyssal Octopus', tier: 'octopus', unlockAt: 75, look: L({ base: '#2a1f33', shade: '#160f1c', light: '#ff4d6d', accent: '#ff4d6d' }, { main: '#24182c', belly: '#3b2a47', light: '#ff4d6d', dark: '#0d0810', glow: 2.4 }) },
  { key: 'elder', name: 'Elder Leviathan', tier: 'leviathan', unlockAt: 150, look: L({ base: '#1c1c22', shade: '#0f0f14', light: '#e7ad58', accent: '#e7ad58' }, { main: '#1a1a20', belly: '#3a3530', light: '#ffcf70', dark: '#0a0a0d', glow: 2.8, bellyMetal: 0.6 }) },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthsLabel = (m: number[]) => (m.length === 1 ? MONTHS[m[0]] : `${MONTHS[m[0]]}–${MONTHS[m[m.length - 1]]}`);

const VISITORS: Species[] = SEASONAL.map((v) => ({
  id: `season:${v.key}`, name: v.name, art: v.tier, tier: v.tier, topic: null, set: 'seasonal' as SetId, look: v.look, months: v.months,
  hint: `In season ${monthsLabel(v.months)}. Sometimes takes the place of ${article(tierById(v.tier).name)} ${tierById(v.tier).name} catch.`,
}));

const DEEP: Species[] = ABYSS.map((d) => ({
  id: `abyss:${d.key}`, name: d.name, art: d.tier, tier: d.tier, topic: null, set: 'abyss' as SetId, look: d.look, unlockAt: d.unlockAt,
  hint: `Stirs after ${d.unlockAt} lifetime catches. Sometimes takes the place of ${article(tierById(d.tier).name)} ${tierById(d.tier).name} catch.`,
}));

export const ODDITIES: Species[] = [
  { id: 'boot', name: 'Old Boot', art: 'boot', tier: 'boot', topic: null, set: 'oddities', hint: 'Every wrong answer lands one.' },
  { id: 'bottle', name: 'Message in a Bottle', art: 'bottle', tier: null, topic: null, set: 'oddities', hint: 'Land a correct answer in the final three seconds.' },
  { id: 'pearl', name: 'Perfect Pearl', art: 'pearl', tier: null, topic: null, set: 'oddities', hint: 'Answer all seven correctly.' },
  { id: 'horseshoe', name: 'Lucky Horseshoe', art: 'horseshoe', tier: null, topic: null, set: 'oddities', hint: 'Win the Captain’s Wager on a Swordfish or Leviathan.' },
  { id: 'chest', name: 'Treasure Chest', art: 'chest', tier: null, topic: null, set: 'oddities', hint: 'Haul 1,500 kg in one Daily Cast.' },
  { id: 'anchor', name: 'Ship’s Anchor', art: 'anchor', tier: null, topic: null, set: 'oddities', hint: 'Keep a seven-day streak.' },
];

export const SPECIES: Species[] = [...FISH, ...VARIANTS, ...VISITORS, ...DEEP, ...ODDITIES];
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export const speciesById = (id: string) => BY_ID.get(id);
