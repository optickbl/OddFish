import { GAME } from '../../config';
import { now } from '../../core/clock';
import { liveStreak } from '../../core/progress';
import { nextResetAt } from '../../core/schedule';
import { ICON, harbourScene, wordmark } from '../art';
import type { Ctx } from '../ctx';
import { fmtCountdown, fmtKg } from '../dom';
import { showHowTo } from '../howto';
import { startOrResume } from './cast';

export function renderHome(ctx: Ctx, root: HTMLElement) {
  const day = ctx.today();
  const save = ctx.save;
  const done = save.history.find((h) => h.day === day);
  const cur = save.current && save.current.day === day && save.current.status === 'playing' ? save.current : null;
  const streak = liveStreak(save.streak, day);
  const streakHtml = streak > 0 ? `<p class="streak">${ICON.flame}<span>${streak}-day streak</span></p>` : '';

  let body: string;
  if (done) {
    body = `<h2 id="dc">Today’s haul</h2>
      <p class="today"><span class="kg">${fmtKg(done.totalKg)}</span></p>
      <p class="countdown" aria-live="off">Next cast in <span data-countdown>${fmtCountdown(nextResetAt(now()) - now())}</span></p>
      <button class="btn primary" data-results>See your haul ${ICON.arrow}</button>${streakHtml}`;
  } else if (cur) {
    body = `<h2 id="dc">Daily Cast</h2>
      <p class="sub">Question ${cur.index + 1} of ${GAME.questionsPerCast} · your line is still out</p>
      <button class="btn primary" data-start>Continue Casting ${ICON.arrow}</button>${streakHtml}`;
  } else {
    body = `<h2 id="dc">Daily Cast</h2>
      <p class="sub">${GAME.questionsPerCast} questions · ${GAME.secondsPerQuestion} seconds each</p>
      <button class="btn primary" data-start>Start Casting ${ICON.arrow}</button>${streakHtml}
      <button class="btn ghost howto" data-howto>How to play</button>`;
  }

  root.innerHTML = `<main id="main" class="view home">
    <header class="top">${wordmark()}<button class="icon-btn" data-profile aria-label="Settings">${ICON.gear}</button></header>
    <div class="hero">${harbourScene()}</div>
    <section class="daily" aria-labelledby="dc"><p class="sr">Daily Cast number ${day}</p>${body}</section>
  </main>`;

  root.querySelector('[data-start]')?.addEventListener('click', () => startOrResume(ctx));
  root.querySelector('[data-results]')?.addEventListener('click', () => ctx.go('results'));
  root.querySelector('[data-profile]')?.addEventListener('click', () => ctx.go('profile'));
  root.querySelector('[data-howto]')?.addEventListener('click', () => showHowTo());

  const cd = root.querySelector<HTMLElement>('[data-countdown]');
  if (cd) {
    const iv = window.setInterval(() => {
      const left = nextResetAt(now()) - now();
      if (ctx.today() !== day) return ctx.rerender();
      cd.textContent = fmtCountdown(left);
    }, 1000);
    ctx.onLeave(() => clearInterval(iv));
  }

  if (!save.onboarded) {
    save.onboarded = true;
    ctx.persist();
    setTimeout(() => showHowTo(), 450);
  }
}
