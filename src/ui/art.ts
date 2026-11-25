import { topicById, type TierId, type TopicId } from '../config';
import { speciesById, type OddityId } from '../content/creatures';

/** Flat, layered shading: no outlines, no gradients, readable at small sizes. */
export interface Palette { base: string; shade: string; light: string; accent: string }

export const TIER_PALETTES: Record<Exclude<TierId, 'boot'>, Palette> = {
  sardine: { base: '#9dbdd0', shade: '#56809d', light: '#e9f1f5', accent: '#2c4b61' },
  clownfish: { base: '#ef8a3d', shade: '#c4612a', light: '#fbf4ea', accent: '#23252e' },
  octopus: { base: '#e5847c', shade: '#bd5c57', light: '#f6c6bd', accent: '#fff4ea' },
  swordfish: { base: '#5a8fbd', shade: '#2f5f8a', light: '#dde9f2', accent: '#1f3d5c' },
  leviathan: { base: '#4a7aa3', shade: '#2c5478', light: '#c5dbea', accent: '#e7ad58' },
};

const EYE = '#10243A';
const eye = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${EYE}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`;

const FISH: Record<Exclude<TierId, 'boot'>, (p: Palette) => string> = {
  sardine: (p) => `
    <path d="M22 40 L5 26 Q10 40 5 54 Z" fill="${p.shade}"/>
    <path d="M56 31 L64 21 L71 31 Z" fill="${p.shade}"/>
    <path d="M20 40 C34 28 66 26 92 33 C102 36 108 38 111 40 C108 42 102 44 92 47 C66 54 34 52 20 40 Z" fill="${p.base}"/>
    <path d="M20 40 C34 28 66 26 92 33 C102 36 108 38 111 40 C96 37 60 34 20 40 Z" fill="${p.shade}"/>
    <path d="M28 42 C50 48 78 48 104 41 C96 46 70 52 44 50 C36 49 31 46 28 42 Z" fill="${p.light}"/>
    <g fill="${p.accent}" opacity=".45"><circle cx="40" cy="38.5" r="1.6"/><circle cx="49" cy="37.8" r="1.6"/><circle cx="58" cy="37.4" r="1.6"/></g>
    <path d="M75 44 L68 51 L81 46 Z" fill="${p.shade}" opacity=".8"/>
    <path d="M88 34 Q85 40 88 46" stroke="${p.shade}" stroke-width="1.5" fill="none" opacity=".6"/>
    ${eye(98, 38, 3.2)}`,
  clownfish: (p) => `
    <path d="M26 41 C16 30 8 30 5 32 C9 38 9 44 5 50 C8 52 16 52 26 41 Z" fill="${p.base}"/>
    <path d="M6 32 C9 38 9 44 6 50" stroke="${p.accent}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M44 23 C54 13 70 13 80 22 C70 25 54 26 44 23 Z" fill="${p.base}"/>
    <ellipse cx="60" cy="42" rx="38" ry="22" fill="${p.base}"/>
    <path d="M24 46 C30 58 48 64 64 64 C82 64 94 56 98 46 C90 55 76 58 62 58 C44 58 31 53 24 46 Z" fill="${p.shade}" opacity=".45"/>
    <g fill="${p.light}" stroke="${p.accent}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M30 29 C33 36 33 48 30 55 L37 59 C40 50 40 34 37 25 Z"/>
      <path d="M55 21 C60 32 60 52 55 63 L65 63 C70 52 70 32 65 21 Z"/>
      <path d="M82 26 C86 34 86 50 82 58 L88 56 C91 48 91 36 88 28 Z"/>
    </g>
    <path d="M70 50 C66 58 72 63 79 56 Z" fill="${p.base}"/>
    <path d="M42 28 C52 23 66 22 76 25" stroke="${p.light}" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>
    ${eye(93, 39, 3.4)}`,
  octopus: (p) => `
    <g stroke="${p.base}" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M42 44 C34 56 26 58 22 54 C19 51 22 47 26 49"/>
      <path d="M50 48 C46 62 40 70 32 70 C28 70 28 66 31 65"/>
      <path d="M58 50 C58 63 56 70 50 74"/>
      <path d="M64 50 C66 63 70 70 76 73"/>
      <path d="M71 48 C76 62 84 70 92 69 C96 68 95 64 92 64"/>
      <path d="M78 44 C86 54 94 58 98 54 C101 51 98 47 94 49"/>
    </g>
    <g fill="${p.light}"><circle cx="36" cy="55" r="1.4"/><circle cx="44" cy="62" r="1.4"/><circle cx="57" cy="62" r="1.4"/><circle cx="67" cy="62" r="1.4"/><circle cx="79" cy="61" r="1.4"/><circle cx="86" cy="54" r="1.4"/></g>
    <path d="M60 6 C80 6 90 20 88 34 C87 44 78 50 60 50 C42 50 33 44 32 34 C30 20 40 6 60 6 Z" fill="${p.base}"/>
    <path d="M32 34 C33 44 42 50 60 50 C78 50 87 44 88 34 C80 42 70 45 60 45 C50 45 40 42 32 34 Z" fill="${p.shade}"/>
    <ellipse cx="47" cy="18" rx="8" ry="4.5" fill="${p.light}" opacity=".75" transform="rotate(-22 47 18)"/>
    <ellipse cx="50" cy="32" rx="5" ry="5.5" fill="${p.accent}"/><ellipse cx="70" cy="32" rx="5" ry="5.5" fill="${p.accent}"/>
    ${eye(51, 33, 2.6)}${eye(71, 33, 2.6)}`,
  swordfish: (p) => `
    <path d="M24 40 C16 30 11 20 8 13 C17 19 23 28 28 36 Z" fill="${p.shade}"/>
    <path d="M24 40 C16 50 11 60 8 67 C17 61 23 52 28 44 Z" fill="${p.shade}"/>
    <path d="M44 31 C46 18 52 10 58 7 C60 16 62 24 67 29 Z" fill="${p.shade}"/>
    <path d="M22 40 C34 30 60 24 84 30 C92 32 98 35 102 38 L118 39.4 L102 41 C98 45 92 48 84 50 C60 56 34 50 22 40 Z" fill="${p.base}"/>
    <path d="M22 40 C34 30 60 24 84 30 C92 32 98 35 102 38 C80 34 52 34 22 40 Z" fill="${p.shade}"/>
    <path d="M30 43 C50 51 76 52 98 43 C90 49 78 52 64 52 C50 52 38 49 30 43 Z" fill="${p.light}"/>
    <path d="M71 46 C67 54 63 58 58 61 C64 57 71 53 77 47 Z" fill="${p.shade}"/>
    <path d="M103 39.6 L116 39.6" stroke="${p.light}" stroke-width=".8" opacity=".7"/>
    ${eye(94, 37, 2.8)}`,
  leviathan: (p) => `
    <path d="M15 37 C11 28 5 23 2 22 C6 29 8 34 12 39 C8 43 6 49 2 55 C5 54 11 50 15 43 Z" fill="${p.shade}"/>
    <path d="M44 27 C46 22 48 20 53 18 C51 23 51 26 52 28 Z" fill="${p.shade}"/>
    <path d="M14 39 C26 30 48 19 75 19 C97 19 113 29 117 42 C119 50 113 57 98 58 C76 60 46 54 26 45 C20 42 16 41 14 39 Z" fill="${p.base}"/>
    <path d="M14 39 C26 30 48 19 75 19 C91 19 105 25 113 34 C97 27 70 26 48 32 C34 36 22 41 14 39 Z" fill="${p.shade}" opacity=".6"/>
    <path d="M40 50 C58 56 82 60 100 57 C110 55 115 50 117 44 C110 52 96 55 80 54 C64 53 50 52 40 50 Z" fill="${p.light}"/>
    <g stroke="${p.shade}" stroke-width=".8" opacity=".45" fill="none"><path d="M76 55 L108 51"/><path d="M80 57.6 L105 54.4"/></g>
    <path d="M84 52 C82 60 76 66 69 68 C74 62 78 56 80 51 Z" fill="${p.shade}"/>
    <path d="M104 47 C108 47 112 46 115.5 44" stroke="${p.shade}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <g fill="${p.accent}"><circle cx="60" cy="25" r="1.1"/><circle cx="69" cy="23" r=".9"/><circle cx="78" cy="22.5" r="1.1"/><circle cx="87" cy="23.5" r=".8"/></g>
    ${eye(100, 41, 2.3)}`,
};

const ODD: Record<OddityId, string> = {
  boot: `
    <path d="M38 10 L64 10 L64 44 C80 44 96 48 102 56 C104 60 104 63 102 66 L36 66 Z" fill="#8a5a35"/>
    <path d="M64 44 C80 44 96 48 102 56 C104 60 104 63 102 66 L84 66 C84 56 76 50 64 50 Z" fill="#6e4527"/>
    <rect x="34" y="64" width="72" height="8" rx="3" fill="#3e2a1b"/>
    <rect x="35" y="6" width="32" height="8" rx="3" fill="#6e4527"/>
    <path d="M48 20 L60 24 M48 28 L60 32 M48 36 L60 40" stroke="#e8d5b5" stroke-width="2" stroke-linecap="round"/>
    <path d="M42 17 L42 58" stroke="#b07d52" stroke-width="3" stroke-linecap="round"/>
    <path d="M64 14 C74 18 70 26 76 32" stroke="#6aa58a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  bottle: `<g transform="rotate(-18 60 42)">
    <path d="M51 12 L61 12 L61 23 C71 29 73 35 73 43 L73 66 C73 70 70 72 66 72 L46 72 C42 72 39 70 39 66 L39 43 C39 35 41 29 51 23 Z" fill="#7fb39b" opacity=".9"/>
    <rect x="49" y="4" width="14" height="11" rx="2.5" fill="#c08a5a"/>
    <rect x="45" y="38" width="22" height="24" rx="3" fill="#f7f0e3"/>
    <path d="M49 45 H63 M49 50 H63 M49 55 H59" stroke="#c9b08c" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M43 40 L43 64" stroke="#fff" stroke-width="2" opacity=".45" stroke-linecap="round"/></g>`,
  pearl: `
    <path d="M22 48 C24 28 40 12 60 12 C80 12 96 28 98 48 Z" fill="#efe0c4"/>
    <g stroke="#d4bd96" stroke-width="1.4" fill="none"><path d="M60 14 L60 46"/><path d="M44 18 L52 46"/><path d="M76 18 L68 46"/><path d="M31 30 L45 47"/><path d="M89 30 L75 47"/></g>
    <path d="M18 50 C24 66 44 74 60 74 C76 74 96 66 102 50 Z" fill="#e8d5b5"/>
    <circle cx="60" cy="49" r="13" fill="#f7f0e3"/>
    <path d="M49 55 C53 61 67 61 71 55 C67 59 53 59 49 55 Z" fill="#d9cdb8"/>
    <circle cx="55" cy="44" r="4" fill="#fff"/>`,
  horseshoe: `
    <path d="M36 16 C36 56 45 70 60 70 C75 70 84 56 84 16" stroke="#e7ad58" stroke-width="13" fill="none"/>
    <path d="M36 16 C36 56 45 70 60 70 C75 70 84 56 84 16" stroke="#c48a36" stroke-width="2" fill="none" transform="translate(0 4)" opacity=".6"/>
    <g fill="#9c6a28"><circle cx="36" cy="26" r="1.8"/><circle cx="38" cy="40" r="1.8"/><circle cx="44" cy="54" r="1.8"/><circle cx="84" cy="26" r="1.8"/><circle cx="82" cy="40" r="1.8"/><circle cx="76" cy="54" r="1.8"/></g>
    <path d="M31 22 C31 16 32 12 34 10" stroke="#f6d08c" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  chest: `
    <g fill="#f2c46d"><circle cx="50" cy="20" r="6"/><circle cx="63" cy="16" r="6"/><circle cx="74" cy="21" r="5.5"/></g>
    <path d="M26 38 C26 22 40 16 60 16 C80 16 94 22 94 38 Z" fill="#a86e42"/>
    <rect x="26" y="36" width="68" height="34" rx="4" fill="#8a5a35"/>
    <rect x="26" y="36" width="68" height="5" fill="#6e4527"/>
    <rect x="38" y="17" width="7" height="53" fill="#e7ad58"/><rect x="75" y="17" width="7" height="53" fill="#e7ad58"/>
    <rect x="54" y="33" width="12" height="14" rx="2" fill="#e7ad58"/><circle cx="60" cy="40" r="2" fill="#6e4527"/>`,
  anchor: `
    <circle cx="60" cy="13" r="6.5" stroke="#e8d5b5" stroke-width="4" fill="none"/>
    <rect x="57" y="19" width="6" height="48" rx="2" fill="#e8d5b5"/>
    <rect x="44" y="25" width="32" height="6" rx="3" fill="#e8d5b5"/>
    <path d="M30 48 C32 64 46 71 60 71 C74 71 88 64 90 48" stroke="#e8d5b5" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M24 52 L32 42 L36 54 Z M96 52 L88 42 L84 54 Z" fill="#e8d5b5"/>
    <path d="M60 31 L60 64" stroke="#c9b08c" stroke-width="2"/>`,
};

export function paletteFor(tier: Exclude<TierId, 'boot'>, topic: TopicId | null): Palette {
  if (!topic) return TIER_PALETTES[tier];
  const t = topicById(topic).palette;
  if (tier === 'clownfish') return { base: t.base, shade: t.shade, light: '#fbf4ea', accent: '#23252e' };
  if (tier === 'octopus') return { base: t.base, shade: t.shade, light: t.light, accent: '#fff4ea' };
  if (tier === 'leviathan') return { base: t.base, shade: t.shade, light: t.light, accent: '#e7ad58' };
  return { base: t.base, shade: t.shade, light: t.light, accent: t.shade };
}

function inner(art: TierId | OddityId, topic: TopicId | null): string {
  if (art in ODD) return ODD[art as OddityId];
  const t = art as Exclude<TierId, 'boot'>;
  return FISH[t](paletteFor(t, topic));
}

/** Draw a creature. `species` is a species id ("octopus:science", "boot", "pearl") or a bare tier. */
export function creature(species: string, opts: { cls?: string; title?: string } = {}): string {
  const s = speciesById(species);
  const art = s ? s.art : (species as TierId);
  const topic = s ? s.topic : null;
  const label = opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true"';
  return `<svg class="cr ${opts.cls ?? ''}" viewBox="0 0 120 80" ${label}>${inner(art, topic)}</svg>`;
}

/** The canonical look of each tier, for legends and guides. */
export const tierArt = (tier: TierId, cls = '') => `<svg class="cr ${cls}" viewBox="0 0 120 80" aria-hidden="true">${inner(tier, null)}</svg>`;

export type Mood = 'grumpy' | 'happy' | 'shocked';

/** The Captain: a grumpy orange tabby in a captain's hat. */
export function captain(mood: Mood = 'grumpy', cls = ''): string {
  return `<svg class="cat ${cls}" viewBox="0 0 120 112" aria-hidden="true">${captainInner(mood)}</svg>`;
}

function captainInner(mood: Mood): string {
  const base = '#e58c45', shade = '#c46a2c', stripe = '#b55d24';
  const eyes =
    mood === 'happy'
      ? `<path d="M40 63 C43 57 50 57 53 63" stroke="#3a2416" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M67 63 C70 57 77 57 80 63" stroke="#3a2416" stroke-width="3.2" fill="none" stroke-linecap="round"/>
         <ellipse cx="38" cy="73" rx="6" ry="3.5" fill="#f19a76" opacity=".55"/><ellipse cx="82" cy="73" rx="6" ry="3.5" fill="#f19a76" opacity=".55"/>`
      : mood === 'shocked'
        ? `<circle cx="46" cy="61" r="8" fill="#f7f0e3"/><circle cx="74" cy="61" r="8" fill="#f7f0e3"/><circle cx="46" cy="61" r="4.5" fill="${EYE}"/><circle cx="74" cy="61" r="4.5" fill="${EYE}"/><circle cx="47.6" cy="59.4" r="1.4" fill="#fff"/><circle cx="75.6" cy="59.4" r="1.4" fill="#fff"/>`
        : `<ellipse cx="46" cy="62" rx="6.5" ry="5.2" fill="#d4dd77"/><ellipse cx="74" cy="62" rx="6.5" ry="5.2" fill="#d4dd77"/><ellipse cx="46" cy="63" rx="1.7" ry="4" fill="${EYE}"/><ellipse cx="74" cy="63" rx="1.7" ry="4" fill="${EYE}"/>
           <path d="M38 55 L55 59.5 L55 54 L38 54 Z" fill="${base}"/><path d="M82 55 L65 59.5 L65 54 L82 54 Z" fill="${base}"/>
           <path d="M39 56.5 L54.5 60.5 M81 56.5 L65.5 60.5" stroke="${shade}" stroke-width="1.8" stroke-linecap="round"/>`;
  const mouth =
    mood === 'happy'
      ? `<path d="M52 84 C54 93 66 93 68 84 Z" fill="#7a2e2a"/><path d="M56 89 C58 92 62 92 64 89 C62 87 58 87 56 89 Z" fill="#e5847c"/>`
      : mood === 'shocked'
        ? `<ellipse cx="60" cy="88" rx="4" ry="5" fill="#7a2e2a"/>`
        : `<path d="M53 87 C56 83.5 64 83.5 67 87" stroke="#6b3a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M29 52 L25 21 L50 39 Z" fill="${base}"/><path d="M91 52 L95 21 L70 39 Z" fill="${base}"/>
    <path d="M32 47 L30 28 L45 39 Z" fill="#eaa48a"/><path d="M88 47 L90 28 L75 39 Z" fill="#eaa48a"/>
    <path d="M23 71 C21 48 36 34 60 34 C84 34 99 48 97 71 C96 89 81 101 60 101 C39 101 24 89 23 71 Z" fill="${base}"/>
    <path d="M23 71 C24 89 39 101 60 101 C81 101 96 89 97 71 C90 88 76 95 60 95 C44 95 30 88 23 71 Z" fill="${shade}" opacity=".55"/>
    <path d="M25 67 L36 69 M26 75 L36 75 M95 67 L84 69 M94 75 L84 75" stroke="${stripe}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="60" cy="81" rx="16" ry="11" fill="#f7e6cf"/>
    ${eyes}
    <path d="M56 75 L64 75 L60 80 Z" fill="#d9766b"/>
    ${mouth}
    <path d="M44 80 L28 77 M44 83 L29 85 M76 80 L92 77 M76 83 L91 85" stroke="#f7f0e3" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>
    <path d="M30 41 C30 24 44 15 60 15 C76 15 90 24 90 41 Z" fill="#f7f0e3"/>
    <path d="M30 41 C30 30 36 22 44 18 C40 24 38 32 38 41 Z" fill="#e8dcc6"/>
    <rect x="29.5" y="34" width="61" height="9" fill="#1d3550"/>
    <path d="M27 44 C40 51 80 51 93 44 L91 49 C78 55 42 55 29 49 Z" fill="#10243A"/>
    <circle cx="60" cy="28" r="5.2" fill="#e7ad58"/>
    <path d="M60 25 L60 31 M57.6 26.6 H62.4 M57 29.4 C58 31.2 62 31.2 63 29.4" stroke="#1d3550" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
}

/** Home scene: the Captain's boat under the moon. */
export function harbourScene(): string {
  return `<svg class="scene" viewBox="0 0 360 250" aria-hidden="true">
    <defs><filter id="of-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>
    <circle cx="252" cy="74" r="46" fill="#E7AD58" opacity=".28" filter="url(#of-soft)"/>
    <circle cx="252" cy="74" r="31" fill="#F3DDB0"/>
    <circle cx="243" cy="66" r="5" fill="#E8D0A0" opacity=".8"/><circle cx="261" cy="84" r="3.5" fill="#E8D0A0" opacity=".8"/>
    <g fill="#F7F0E3"><circle cx="40" cy="40" r="1.1" opacity=".7"/><circle cx="92" cy="22" r=".9" opacity=".5"/><circle cx="148" cy="52" r="1.2" opacity=".6"/><circle cx="322" cy="30" r="1" opacity=".6"/><circle cx="186" cy="16" r=".8" opacity=".5"/><circle cx="58" cy="92" r=".8" opacity=".45"/><circle cx="330" cy="124" r=".9" opacity=".45"/><circle cx="196" cy="98" r=".7" opacity=".4"/></g>
    <path d="M226 192 H278 M236 200 H268 M244 208 H260" stroke="#F3DDB0" stroke-width="2" stroke-linecap="round" opacity=".16"/>
    <g class="bob">
      <circle cx="98" cy="120" r="30" fill="#E7AD58" opacity=".35" filter="url(#of-soft)"/>
      <rect x="80" y="100" width="3.5" height="76" rx="1.75" fill="#8a5a35"/>
      <path d="M80 100 H100 V103.5 H83.5 Z" fill="#8a5a35"/>
      <path d="M91 108 H105 L103 104.5 H93 Z" fill="#5c3a22"/>
      <rect x="91" y="108" width="14" height="19" rx="3" fill="#F3C77A"/>
      <rect x="95.5" y="111" width="5" height="12" rx="2.5" fill="#FFF2CF"/>
      <g transform="translate(130 92) scale(.66)">${captainBody()}</g>
      <path d="M48 168 H302 C294 200 266 216 228 218 H122 C84 216 56 200 48 168 Z" fill="#7a5236"/>
      <path d="M58 192 H292 C282 207 258 216 228 218 H122 C92 216 70 207 58 192 Z" fill="#5e3e28"/>
      <path d="M54 180 H296" stroke="#E8D5B5" stroke-width="2.5" opacity=".55"/>
      <rect x="44" y="162" width="262" height="9" rx="4.5" fill="#a0714a"/>
    </g>
    <g class="sea">
      <path d="M-45 206 Q-22 200 0 206 T45 206 T90 206 T135 206 T180 206 T225 206 T270 206 T315 206 T360 206 T405 206 V250 H-45 Z" fill="#18344B"/>
      <path d="M-45 220 Q-22 214 0 220 T45 220 T90 220 T135 220 T180 220 T225 220 T270 220 T315 220 T360 220 T405 220 V250 H-45 Z" fill="#132c41"/>
    </g>
  </svg>`;
}

/** Captain with a little coat, for scenes. */
function captainBody(): string {
  return `<path d="M22 150 C20 118 36 100 60 100 C84 100 100 118 98 150 Z" fill="#1d3550"/>
    <path d="M60 100 L60 150" stroke="#10243A" stroke-width="2"/><circle cx="54" cy="116" r="2.4" fill="#E7AD58"/><circle cx="54" cy="130" r="2.4" fill="#E7AD58"/>
    ${captainInner('grumpy')}`;
}

export const ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v3M8.5 20h7M10 17h4"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/></svg>',
  anchor: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M4.5 13.5C5 18 8 21 12 21s7-3 7.5-7.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  fish: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c3-4 7-5.5 10.5-5.5 3 0 5.5 2.5 7.5 5.5-2 3-4.5 5.5-7.5 5.5C10 17.5 6 16 3 12zM3 12 1 8.5M3 12l-2 3.5"/><circle cx="16.5" cy="11" r=".6"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.6 3-5.6 4-9.4 2.8 1.6 4.6 4 4.8 6.6.8-.6 1.3-1.6 1.4-2.8 1.3 1.4 1.8 3.3 1.8 5.4C18 18.6 15.6 21 12 21z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 12 12 21 4 12z"/></svg>',
};

/** Wordmark: italic serif with a little wave underneath. */
export const wordmark = (cls = '') =>
  `<span class="wordmark ${cls}"><span>Oddfish</span><svg viewBox="0 0 120 12" aria-hidden="true"><path d="M4 8 C26 2 44 2 60 6 C76 10 96 10 116 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>`;

export const hookMark = () =>
  `<svg class="hookmark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#18344B"/><path d="M33 9 V38 C33 46 27 50 22 50 C16 50 13 46 13 41 L13 38" stroke="#F7F0E3" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M13 38 L18 43" stroke="#F7F0E3" stroke-width="4.5" stroke-linecap="round"/><circle cx="33" cy="9" r="3.5" fill="none" stroke="#E7AD58" stroke-width="2.5"/></svg>`;

export const speciesName = (id: string) => speciesById(id)?.name ?? id;
