import { GAME } from '../../config';
import { now } from '../../core/clock';
import {
  WAGER_DAYS, boatLevel, castsToNextPage, harbourSize, inWindow, leavingSoon, orderFor, orderProgress, pagesUnlocked, rankFor, lifetimeKg, sevenDayTarget,
  UPGRADES, tideFor, wagerProgress, weatherFor, weekEnd, weekOf,
} from '../../core/extras';
import { castKind } from '../../core/game';
import { liveStreak } from '../../core/progress';
import { nextResetAt } from '../../core/schedule';
import { ICON, harbourScene, wordmark } from '../art';
import type { Ctx } from '../ctx';
import { esc, fmtCountdown, fmtKg, fmtNum } from '../dom';
import { showHowTo } from '../howto';
import { seaHome } from '../sea';
import { showResults, startOrResume } from './cast';

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function renderHome(ctx: Ctx, root: HTMLElement) {
  const day = ctx.today();
  const save = ctx.save;
  const t = now();
  const done = save.history.find((h) => h.day === day);
  const cur = save.current && save.current.day === day && save.current.status === 'playing' && castKind(save.current) === 'daily' ? save.current : null;
  const archiveCur = save.current && save.current.status === 'playing' && castKind(save.current) === 'archive' ? save.current : null;
  const streak = liveStreak(save.streak, day);
  const freezes = save.freezes > 0 ? `<span class="freeze" title="Streak freezes">${ICON.snow}${save.freezes}</span>` : '';
  const streakHtml = streak > 0 || save.freezes > 0
    ? `<p class="streak">${ICON.flame}<span>${streak}-day streak</span>${freezes}</p>` : '';
  const target = sevenDayTarget(save, day);
  const targetHtml = target !== null && !done ? `<p class="target">${ICON.target}<span>Today’s target: <b>${fmtKg(target)}</b> · your 7-day average</span></p>` : '';

  // The Surprise Tide: a secret until it arrives.
  const tide = tideFor(day);
  let tideHtml = '';
  if (!done) {
    if (inWindow(tide, t)) tideHtml = `<p class="tide in" role="status">${ICON.wave}<span><b>The Surprise Tide is in!</b> Every catch weighs double for <span data-tide>${Math.ceil((tide.end - t) / 60000)}</span> more minutes.</span></p>`;
    else if (t < tide.start) tideHtml = `<p class="tide">${ICON.wave}<span>A Surprise Tide comes in at a secret time today. Catches during it weigh double.</span></p>`;
    else tideHtml = `<p class="tide past">${ICON.wave}<span>Today’s tide came in at ${hhmm(tide.start)}. Tomorrow’s is a surprise.</span></p>`;
  }

  let body: string;
  if (done) {
    const beat = target !== null && done.kind !== 'archive' ? (done.totalKg >= target ? `<p class="target won">${ICON.target}<span>Beat your 7-day average by <b>${fmtKg(done.totalKg - target)}</b></span></p>` : `<p class="target">${ICON.target}<span>${fmtKg(target - done.totalKg)} short of your 7-day average</span></p>`) : '';
    body = `<h2 id="dc">Today’s haul</h2>
      <p class="today"><span class="kg">${fmtKg(done.totalKg)}</span></p>${beat}
      <p class="countdown" aria-live="off">Next cast in <span data-countdown>${fmtCountdown(nextResetAt(t) - t)}</span></p>
      <button class="btn primary" data-results>See your haul ${ICON.arrow}</button>${streakHtml}`;
  } else if (cur) {
    body = `${tideHtml}<h2 id="dc">Daily Cast</h2>
      <p class="sub">Question ${cur.index + 1} of ${GAME.questionsPerCast} · your line is still out</p>
      <button class="btn primary" data-start>Continue Casting ${ICON.arrow}</button>${streakHtml}${targetHtml}`;
  } else {
    body = `${tideHtml}<h2 id="dc">Daily Cast</h2>
      <p class="sub">${GAME.questionsPerCast} questions · ${GAME.secondsPerQuestion + UPGRADES.rod.effect[save.upgrades.rod]} seconds each</p>
      <button class="btn primary" data-start>Start Casting ${ICON.arrow}</button>${streakHtml}${targetHtml}
      <button class="btn ghost howto" data-howto>How to play</button>`;
  }

  // Cards: things to come back for.
  const cards: string[] = [];
  if (archiveCur) {
    cards.push(`<button class="card" data-archive>${ICON.calendar}<span><b>Missed-day cast #${archiveCur.day}</b><small>Question ${archiveCur.index + 1} of ${GAME.questionsPerCast} · tap to finish it</small></span>${ICON.arrow}</button>`);
  }
  const order = orderFor(weekOf(day));
  const prog = orderProgress(order, save);
  const claimed = save.ordersClaimed.includes(order.week);
  const daysLeft = weekEnd(order.week) - day + 1;
  cards.push(`<div class="card order ${claimed ? 'done' : ''}">${ICON.scroll}<span><b>Captain’s orders</b><small>${esc(order.text)}</small>
    <span class="bar"><i style="width:${Math.min(100, (prog / order.target) * 100)}%"></i></span>
    <small>${claimed ? 'Done. Fresh orders next week.' : `${fmtNum(Math.min(prog, order.target))} / ${fmtNum(order.target)} · +${fmtKg(order.reward)} · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}</small></span></div>`);
  for (const l of leavingSoon(save, t, new Date().getTimezoneOffset())) {
    cards.push(`<a class="card leaving" href="#logbook">${ICON.calendar}<span><b>${esc(l.name)} leaves in ${l.daysLeft} ${l.daysLeft === 1 ? 'day' : 'days'}</b><small>A seasonal visitor you haven’t caught yet</small></span>${ICON.arrow}</a>`);
  }
  if (save.streakWager) {
    cards.push(`<a class="card" href="#harbour">${ICON.flame}<span><b>Streak Wager · ${wagerProgress(save)} / ${WAGER_DAYS} days</b><small>${fmtKg(save.streakWager.stake * 2)} if you don’t miss a day</small></span>${ICON.arrow}</a>`);
  }
  const pages = pagesUnlocked(save);
  if (pages > save.pagesSeen) {
    cards.push(`<a class="card new" href="#harbour">${ICON.scroll}<span><b>A new page in the Captain’s Log</b><small>Something stirs in the deep…</small></span>${ICON.arrow}</a>`);
  } else {
    const next = castsToNextPage(save);
    if (next !== null && pages > 0) cards.push(`<a class="card quiet" href="#harbour">${ICON.scroll}<span><b>Captain’s Log</b><small>Next page in ${next} ${next === 1 ? 'Daily Cast' : 'Daily Casts'}</small></span>${ICON.arrow}</a>`);
  }

  const weather = weatherFor(save, day);
  const rank = rankFor(lifetimeKg(save));
  root.innerHTML = `<main id="main" class="view home">
    <header class="top">${wordmark()}<button class="icon-btn" data-profile aria-label="Settings">${ICON.gear}</button></header>
    <a class="rank-chip" href="#harbour">${ICON.boat}<span>${esc(rank.rank.name)}</span><span class="sep"></span>${ICON.scale}<span>${fmtKg(save.purse)}</span></a>
    <div class="hero w-${weather}">${harbourScene()}${weather === 'storm' ? '<p class="weather-note">A storm rolled in while you were away.</p>' : weather === 'golden' ? '<p class="weather-note gold">Golden water: your streak is on fire.</p>' : ''}</div>
    <section class="daily" aria-labelledby="dc"><p class="sr">Daily Cast number ${day}</p>${body}</section>
    <section class="cards" aria-label="This week">${cards.join('')}</section>
  </main>`;

  seaHome(root.querySelector<HTMLElement>('.hero')!, { weather, buoys: harbourSize(save), boat: boatLevel(save), outfit: rank.rank });
  root.querySelector('[data-start]')?.addEventListener('click', () => startOrResume(ctx));
  root.querySelector('[data-results]')?.addEventListener('click', () => showResults(ctx, day));
  root.querySelector('[data-profile]')?.addEventListener('click', () => ctx.go('profile'));
  root.querySelector('[data-howto]')?.addEventListener('click', () => showHowTo());
  root.querySelector('[data-archive]')?.addEventListener('click', () => ctx.go('cast'));

  const cd = root.querySelector<HTMLElement>('[data-countdown]');
  const td = root.querySelector<HTMLElement>('[data-tide]');
  const iv = window.setInterval(() => {
    const n = now();
    if (ctx.today() !== day) return ctx.rerender();
    if (cd) cd.textContent = fmtCountdown(nextResetAt(n) - n);
    if (!done && inWindow(tide, n) !== inWindow(tide, t)) return ctx.rerender();
    if (td) td.textContent = String(Math.ceil((tide.end - n) / 60000));
  }, 1000);
  ctx.onLeave(() => clearInterval(iv));

  if (!save.onboarded) {
    save.onboarded = true;
    ctx.persist();
    setTimeout(() => showHowTo(), 450);
  }
}
