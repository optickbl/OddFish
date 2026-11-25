import { tierById, topicById } from '../../config';
import { SETS, SPECIES, type SetId, type Species } from '../../content/creatures';
import { ICON, captain, creature } from '../art';
import type { Ctx } from '../ctx';
import { esc, fmtDate, fmtKg, sheet } from '../dom';
import { sfx } from '../feedback';
import { webglAvailable } from '../sea';
import { startOrResume } from './cast';

let filter: SetId | 'all' = 'all';

const rarityOf = (s: Species) => (s.tier ? tierById(s.tier).rarity : 'Oddity');
const weightOf = (s: Species) => (s.tier && s.tier !== 'boot' ? fmtKg(tierById(s.tier).kg) : '');

export function renderLogbook(ctx: Ctx, root: HTMLElement) {
  const found = ctx.save.found;
  const list = SPECIES.filter((s) => filter === 'all' || s.set === filter);
  const total = SPECIES.length;
  const have = SPECIES.filter((s) => found[s.id]).length;
  const nothing = have === 0;

  root.innerHTML = `<main id="main" class="view">
    <h1 class="page-title">Logbook</h1>
    <div class="chips" role="group" aria-label="Filter creatures">
      ${[{ id: 'all', label: 'All' }, ...SETS].map((f) => `<button type="button" data-f="${f.id}" aria-pressed="${filter === f.id}">${f.label}</button>`).join('')}
    </div>
    <div class="progress"><p class="lbl"><span>Collection progress</span><b>${have} / ${total}</b></p><div class="bar" role="progressbar" aria-label="Collection progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${have}"><i style="width:${(have / total) * 100}%"></i></div></div>
    ${nothing ? `<div class="empty">${captain('grumpy')}<p>Your Logbook is empty. Every catch you make lands here.</p></div>` : ''}
    <div class="grid">
      ${list.map((s) => {
        const f = found[s.id];
        const legend = s.tier === 'leviathan';
        const meta = [rarityOf(s), weightOf(s)].filter(Boolean).join(' · ');
        const short = weightOf(s) || rarityOf(s);
        return `<button type="button" class="tile ${f ? 'found' : 'unknown'} ${f && legend ? 'legend' : ''}" data-s="${s.id}" aria-label="${f ? esc(s.name) : 'Undiscovered creature'}, ${meta}">
          ${creature(s.id)}${f ? `<span class="nm">${esc(s.name)}</span>` : ''}<span class="meta">${short}</span></button>`;
      }).join('')}
    </div>
    ${nothing ? `<div style="text-align:center;margin-top:22px"><button class="btn primary" data-start>Start Casting ${ICON.arrow}</button></div>` : ''}
  </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) =>
    b.addEventListener('click', () => {
      filter = b.dataset.f as SetId | 'all';
      sfx.tap();
      ctx.rerender();
      root.querySelector<HTMLElement>(`[data-f="${filter}"]`)?.focus();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => b.addEventListener('click', () => openSpecies(ctx, b.dataset.s!)));
  root.querySelector('[data-start]')?.addEventListener('click', () => startOrResume(ctx));
  if (webglAvailable()) void swapInModels(ctx, root);
}

/** Replace tile illustrations with renders of the 3D models, once each is ready. */
async function swapInModels(ctx: Ctx, root: HTMLElement) {
  let studio: typeof import('../../three/studio');
  try {
    studio = await import('../../three/studio');
  } catch {
    return;
  }
  const tiles = [...root.querySelectorAll<HTMLElement>('.tile[data-s]')];
  for (const tile of tiles) {
    const id = tile.dataset.s!;
    if (!studio.hasModel(id)) continue;
    const url = await studio.thumbnail(id, !ctx.save.found[id]);
    if (!url || !tile.isConnected) continue;
    const svg = tile.querySelector('svg.cr');
    const img = document.createElement('img');
    img.className = 'cr model';
    img.alt = '';
    img.decoding = 'async';
    img.src = url;
    svg?.replaceWith(img);
  }
}

function openSpecies(ctx: Ctx, id: string) {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) return;
  const f = ctx.save.found[id];
  const catches = ctx.save.history
    .flatMap((h) => h.catches)
    .filter((c) => c.tier !== 'boot' && c.species === id)
    .reverse();
  let body: string;
  if (f) {
    const items = catches.slice(0, 20).map((c) => `<li><span>“${esc(c.answerName)}”<small>${esc(c.questionText)} · ${fmtDate(c.at)}</small></span><b>${fmtKg(c.kg)}</b></li>`).join('');
    body = `<p class="hint">Caught ${f.count} ${f.count === 1 ? 'time' : 'times'} · first on ${fmtDate(f.first)}</p>${items ? `<ul class="history">${items}</ul>` : ''}`;
  } else {
    const hint = s.hint ?? `A ${tierById(s.tier!).rarity.toLowerCase()} answer to a ${topicById(s.topic!).label.toLowerCase()} question.`;
    body = `<p class="hint">${esc(hint)}</p>`;
  }
  const meta = [rarityOf(s), weightOf(s)].filter(Boolean);
  let stop: (() => void) | null = null;
  let closed = false;
  const view = sheet(
    `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button>
     <div class="center inspect ${f ? '' : 'tile unknown'}" style="${f ? '' : 'background:none;box-shadow:none'}">${creature(id, { cls: 'big' })}</div>
     <h2 class="center">${f ? esc(s.name) : 'Undiscovered'}</h2>
     <div class="facts">${meta.map((m) => `<span class="pill r-${s.tier ?? 'odd'}">${m}</span>`).join('')}</div>
     ${body}`,
    { label: f ? s.name : 'Undiscovered creature', onClose: () => { closed = true; stop?.(); } },
  );
  if (!webglAvailable()) return;
  // Found: a live model you can turn. Not yet found: its shadow.
  const host = view.root.querySelector<HTMLElement>('.inspect')!;
  void import('../../three/studio').then(async (studio) => {
    if (!studio.hasModel(id) || closed) return;
    if (!f) {
      const url = await studio.thumbnail(id, true);
      const svg = host.querySelector('svg.cr');
      if (url && svg && !closed) {
        const img = document.createElement('img');
        img.className = 'cr big model';
        img.alt = '';
        img.src = url;
        svg.replaceWith(img);
      }
      return;
    }
    host.classList.add('live');
    const halt = await studio.inspect(host, id, ctx.reduced());
    if (closed) return halt();
    stop = halt;
    host.tabIndex = 0;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', `${s.name}. Drag or use the arrow keys to turn it.`);
    host.querySelector('svg.cr')?.remove();
  }).catch(() => {});
}
