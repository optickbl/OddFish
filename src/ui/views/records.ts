import { tierById } from '../../config';
import { SPECIES } from '../../content/creatures';
import { lifetimeKg, rankFor } from '../../core/extras';
import { computeRecords } from '../../core/progress';
import { ICON, captain, creature, speciesName } from '../art';
import type { Ctx } from '../ctx';
import { esc, fmtKg, fmtNum } from '../dom';
import { startOrResume } from './cast';

export function renderRecords(ctx: Ctx, root: HTMLElement) {
  const r = computeRecords(ctx.save);
  if (r.casts === 0) {
    root.innerHTML = `<main id="main" class="view"><h1 class="page-title">Records</h1>
      <div class="empty">${captain('grumpy')}<p>No records yet. Finish your first Daily Cast and the Captain will start keeping score.</p></div>
      <div style="text-align:center;margin-top:22px"><button class="btn primary" data-start>Start Casting ${ICON.arrow}</button></div></main>`;
    root.querySelector('[data-start]')!.addEventListener('click', () => startOrResume(ctx));
    return;
  }
  const best = r.bestCatch;
  root.innerHTML = `<main id="main" class="view">
    <h1 class="page-title">Records</h1>
    ${best ? `<div class="records-hero">${creature(best.species, { title: speciesName(best.species) })}</div>` : ''}
    <ul class="stats">
      <li><span class="k">Highest haul<small>${r.bestHaul ? `Daily Cast #${r.bestHaul.day}` : ''}</small></span><span class="v">${r.bestHaul ? fmtKg(r.bestHaul.kg) : '—'}</span></li>
      <li><span class="k">Highest catch<small>${best ? `${esc(tierById(best.tier).name)} · “${esc(best.answerName)}”` : ''}</small></span><span class="v ${best?.tier === 'leviathan' ? 'gold' : ''}">${best ? fmtKg(best.kg) : '—'}</span></li>
      <li><span class="k">Longest streak</span><span class="v">${r.longestStreak} ${r.longestStreak === 1 ? 'day' : 'days'}</span></li>
      <li><span class="k">Total catches</span><span class="v">${fmtNum(r.totalCatches)}</span></li>
      <li><span class="k">Unique creatures</span><span class="v">${r.uniqueCreatures} / ${SPECIES.length}</span></li>
      <li><span class="k">Lifetime haul<small>${esc(rankFor(lifetimeKg(ctx.save)).rank.name)}</small></span><span class="v">${fmtKg(lifetimeKg(ctx.save))}</span></li>
      <li><span class="k">Shiny, Night and Mutant catches</span><span class="v">${fmtNum(ctx.save.history.flatMap((h) => h.catches).filter((c) => c.variant).length)}</span></li>
      <li><span class="k">Seasonal and Abyss catches</span><span class="v">${fmtNum(ctx.save.history.flatMap((h) => h.catches).filter((c) => c.special).length)}</span></li>
    </ul>
  </main>`;
}
