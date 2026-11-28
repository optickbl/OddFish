import { LOG_PAGES } from '../../content/lore';
import {
  FREEZE_COST, MAX_FREEZES, MAX_LEVEL, MILESTONES, RANKS, UPGRADES, UPGRADE_IDS, WAGER_DAYS, WAGER_STAKES, archiveAvailable, boatLevel, buyFreeze, buyUpgrade,
  castsToNextPage, lifetimeKg, missedDays, pagesUnlocked, placeStreakWager, rankFor, wagerProgress, type UpgradeId,
} from '../../core/extras';
import { castKind } from '../../core/game';
import { ICON, captain } from '../art';
import type { Ctx } from '../ctx';
import { esc, fmtKg, fmtNum, sheet, toast } from '../dom';
import { haptic, sfx } from '../feedback';
import { startArchive } from './cast';

const UPGRADE_ICON: Record<UpgradeId, string> = { rod: ICON.hook, lantern: ICON.star, sonar: ICON.sonar, net: ICON.fish };

export function renderHarbour(ctx: Ctx, root: HTMLElement) {
  const save = ctx.save;
  const today = ctx.today();
  const life = lifetimeKg(save);
  const { rank, next } = rankFor(life);
  const toNext = next ? Math.max(0, next.kg - life) : 0;
  const pct = next ? Math.min(100, ((life - rank.kg) / (next.kg - rank.kg)) * 100) : 100;

  const upgrades = UPGRADE_IDS.map((id) => {
    const u = UPGRADES[id];
    const lvl = save.upgrades[id];
    const max = lvl >= MAX_LEVEL;
    const cost = max ? 0 : u.costs[lvl];
    const pips = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<li class="upgrade"><span class="row-icon">${UPGRADE_ICON[id]}</span>
      <span class="k"><b>${esc(u.name)}</b><span class="pips" aria-label="Level ${lvl} of ${MAX_LEVEL}">${pips}</span>
      <small>${esc(u.describe(u.effect[lvl]))}${max ? '' : ` → <span class="next">${esc(u.describe(u.effect[lvl + 1]))}</span>`}</small></span>
      ${max ? '<span class="v gold">Max</span>' : `<button class="buy" data-buy="${id}" ${save.purse < cost ? 'disabled' : ''}>${fmtKg(cost)}</button>`}</li>`;
  }).join('');

  const wager = save.streakWager;
  const wagerHtml = wager
    ? `<p class="note">${fmtKg(wager.stake)} riding on ${WAGER_DAYS} Daily Casts in a row, from Daily Cast #${wager.start}.</p>
       <div class="daysrow">${Array.from({ length: WAGER_DAYS }, (_, i) => {
         const d = wager.start + i;
         const ok = save.history.some((h) => h.day === d && (h.kind ?? 'daily') === 'daily');
         return `<i class="${ok ? 'on' : d < today ? 'miss' : d === today ? 'now' : ''}">${i + 1}</i>`;
       }).join('')}</div>
       <p class="note">${wagerProgress(save)} of ${WAGER_DAYS} done · win ${fmtKg(wager.stake * 2)}. Freezes don’t count here.</p>`
    : `<p class="note">Bet kilos from your hold that you’ll finish a Daily Cast every day for the next ${WAGER_DAYS} days. Make it and you get double back. Miss a day and the sea keeps it.</p>
       <div class="stakes">${WAGER_STAKES.map((k) => `<button class="btn secondary" data-stake="${k}" ${save.purse < k ? 'disabled' : ''}>Bet ${fmtKg(k)}</button>`).join('')}</div>
       ${save.lastStreakWager ? `<p class="note" style="margin-top:8px">Last wager: ${save.lastStreakWager.won ? `won ${fmtKg(save.lastStreakWager.stake * 2)}` : `lost ${fmtKg(save.lastStreakWager.stake)}`}.</p>` : ''}`;

  const missed = missedDays(save, today);
  const archiveCur = save.current && save.current.status === 'playing' && castKind(save.current) === 'archive' ? save.current : null;
  const canArchive = archiveAvailable(save, today);
  const missedHtml = missed.length
    ? `<ul class="missed">${missed.slice(0, 8).map((d) => `<li><span>Daily Cast #${d}</span>
        ${archiveCur?.day === d ? `<button class="buy" data-play="${d}">Continue</button>` : `<button class="buy" data-play="${d}" ${!canArchive || archiveCur ? 'disabled' : ''}>Play</button>`}</li>`).join('')}</ul>
       <p class="note">${canArchive || archiveCur ? 'One missed-day cast a day. Catches weigh half and don’t touch your streak.' : 'You’ve played your missed-day cast for today. Another tomorrow.'}</p>`
    : `<p class="note">No missed days in the last 30. The Captain approves.</p>`;

  const unlocked = pagesUnlocked(save);
  const seen = save.pagesSeen;
  const nextPage = castsToNextPage(save);
  const locked = LOG_PAGES.length - unlocked;
  const logHtml = `<ul class="log">${LOG_PAGES.slice(0, unlocked).map((p, i) =>
    `<li><button data-page="${i}"><span class="num">${i + 1}</span><span>${esc(p.title)}</span>${i >= seen ? '<span class="new">New</span>' : ''}</button></li>`).join('')}
    ${locked ? `<li class="locked"><span class="num">${unlocked + 1}</span><span>${ICON.lock} ${locked === 1 ? 'One more page' : `${locked} more pages`} still locked</span></li>` : ''}</ul>
    <p class="note">${unlocked === 0 ? 'Finish your first Daily Cast to open the log.' : nextPage === null ? 'Every page so far. The Captain is still writing.' : `Next page in ${nextPage} ${nextPage === 1 ? 'Daily Cast' : 'Daily Casts'}.`}</p>`;

  const boat = boatLevel(save);
  const boatHtml = `<ul class="rows compact">${MILESTONES.map((m) => {
    const got = save.milestonesSeen.includes(m.days) || Math.max(save.streak.best, save.streak.current) >= m.days;
    return `<li class="${got ? '' : 'dim'}"><span class="row-icon">${got ? ICON.check : ICON.flame}</span><span class="k">${m.days}-day streak<small>${m.unlock ? esc(m.unlock) + ' · ' : ''}+${fmtKg(m.reward)}</small></span><span class="v">${got ? 'Earned' : ''}</span></li>`;
  }).join('')}</ul>
  <p class="note">${[boat.pennant && 'Pennant', boat.lanterns && 'Lantern string', boat.gold && 'Gold trim'].filter(Boolean).join(' · ') || 'Your boat is plain for now. Streaks dress it up.'}</p>`;

  root.innerHTML = `<main id="main" class="view harbour">
    <h1 class="page-title">Harbour</h1>
    <div class="rank-card">${captain('happy', '', rank)}<div>
      <p class="eyebrow">Your rank</p><h2>${esc(rank.name)}</h2>
      <p class="note">${fmtKg(life)} hauled in total</p>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="note">${next ? `${fmtKg(toNext)} to ${esc(next.name)}` : 'The highest rank on the sea.'}</p>
    </div></div>
    <div class="hold">${ICON.scale}<span>In the hold</span><b>${fmtKg(save.purse)}</b></div>
    <p class="note center">Every haul goes into the hold. Spend it here.</p>

    <section class="section" aria-labelledby="h-up"><h3 id="h-up">Boat upgrades</h3><ul class="rows">${upgrades}</ul></section>

    <section class="section" aria-labelledby="h-fr"><h3 id="h-fr">Streak freezes</h3>
      <div class="freezes">${Array.from({ length: MAX_FREEZES }, (_, i) => `<span class="${i < save.freezes ? 'on' : ''}">${ICON.snow}</span>`).join('')}
        <button class="buy" data-freeze ${save.freezes >= MAX_FREEZES || save.purse < FREEZE_COST ? 'disabled' : ''}>${save.freezes >= MAX_FREEZES ? 'Full' : `Buy · ${fmtKg(FREEZE_COST)}`}</button></div>
      <p class="note">A freeze covers a missed day so your streak survives. You earn one every 7 days in a row and can hold ${MAX_FREEZES}.</p>
    </section>

    <section class="section" aria-labelledby="h-wg"><h3 id="h-wg">Streak Wager</h3>${wagerHtml}</section>

    <section class="section" aria-labelledby="h-ms"><h3 id="h-ms">Missed days</h3>${missedHtml}</section>

    <section class="section" aria-labelledby="h-log"><h3 id="h-log">Captain’s Log</h3>${logHtml}</section>

    <section class="section" aria-labelledby="h-boat"><h3 id="h-boat">Streak milestones</h3>${boatHtml}</section>

    <section class="section" aria-labelledby="h-rk"><h3 id="h-rk">Ranks</h3>
      <ul class="ranks">${RANKS.map((r) => `<li class="${life >= r.kg ? 'on' : ''}"><span class="sw" style="background:${r.coat};box-shadow:0 0 0 3px ${r.band} inset"></span><span>${esc(r.name)}</span><small>${fmtNum(r.kg)} kg</small></li>`).join('')}</ul>
    </section>
  </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buy as UpgradeId;
    if (!buyUpgrade(save, id)) return toast('Not enough in the hold yet');
    ctx.persist();
    sfx.wager();
    haptic('good');
    toast(`${UPGRADES[id].name} upgraded`);
    ctx.rerender();
  }));
  root.querySelector('[data-freeze]')?.addEventListener('click', () => {
    if (!buyFreeze(save)) return toast('Not enough in the hold yet');
    ctx.persist();
    sfx.wager();
    toast('Streak freeze ready');
    ctx.rerender();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-stake]').forEach((b) => b.addEventListener('click', () => {
    const stake = Number(b.dataset.stake);
    if (!placeStreakWager(save, today, stake)) return toast('Not enough in the hold yet');
    ctx.persist();
    sfx.wager();
    haptic('good');
    toast(`Wager placed: ${fmtKg(stake)}`);
    ctx.rerender();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) => b.addEventListener('click', () => startArchive(ctx, Number(b.dataset.play))));
  root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.page);
    const p = LOG_PAGES[i];
    sfx.tap();
    sheet(`<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button>
      <p class="eyebrow">Captain’s Log · page ${i + 1}</p><h2>${esc(p.title)}</h2>
      <p class="logtext">${esc(p.text)}</p>
      <p class="captain-says">${captain('grumpy')}<span>— the Captain</span></p>`, { label: p.title });
  }));

  if (unlocked > save.pagesSeen) {
    save.pagesSeen = unlocked;
    ctx.persist();
  }
}
