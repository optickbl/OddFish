import { GAME, tierById, tierIndex } from '../../config';
import { questionById } from '../../core/answers';
import { now } from '../../core/clock';
import {
  LIMIT_MS, advance, currentQuestion, isAnswered, newCast, oddsFromCast, remainingMs, settleExpired, summarize, toggleWager, wagerAvailable,
  type CastState, type CatchRecord,
} from '../../core/game';
import { completeDay, recordFinds } from '../../core/progress';
import { formatPct } from '../../core/rarity';
import { dailyQuestionIds, rng } from '../../core/schedule';
import { ICON, creature, speciesName } from '../art';
import type { Ctx } from '../ctx';
import { article, esc, fmtKg } from '../dom';
import { haptic, sfx } from '../feedback';

/** Species first found by the cast that just finished, for the results screen. */
export let lastNewFinds: string[] = [];

export function startOrResume(ctx: Ctx) {
  const day = ctx.today();
  const s = ctx.save.current;
  if (!s || s.day !== day || s.status !== 'playing') {
    if (ctx.save.history.some((h) => h.day === day)) return ctx.go('results');
    ctx.save.current = newCast(day, dailyQuestionIds(day));
    ctx.persist();
  }
  sfx.tap();
  ctx.go('cast');
}

/** Close a completed cast: history, streak, Logbook. Safe to call once per cast. */
export function finalizeCast(ctx: Ctx, s: CastState) {
  const save = ctx.save;
  if (save.history.some((h) => h.day === s.day)) {
    save.current = null;
    ctx.persist();
    return;
  }
  const sum = summarize(s);
  save.history = [...save.history, sum].sort((a, b) => a.day - b.day);
  save.streak = completeDay(save.streak, s.day);
  const odd = oddsFromCast(sum);
  if (save.streak.current >= 7) odd.push('anchor');
  const before = new Set(Object.keys(save.found));
  save.found = recordFinds(save.found, sum.catches, odd, now());
  lastNewFinds = Object.keys(save.found).filter((k) => !before.has(k));
  save.current = null;
  ctx.persist();
}

const CIRC = 2 * Math.PI * 42;

export function renderCast(ctx: Ctx, root: HTMLElement) {
  const save = ctx.save;
  let s = save.current;
  if (!s || s.status !== 'playing') return ctx.go(save.history.some((h) => h.day === ctx.today()) ? 'results' : 'home');
  const settled = settleExpired(s, now());
  if (settled.record) {
    s = settled.state;
    save.current = s;
    ctx.persist();
  }
  if (isAnswered(s)) {
    const rec = s.catches.find((c) => c.index === s!.index)!;
    return renderReveal(ctx, root, s, rec, false);
  }
  renderQuestion(ctx, root, s);
}

function dotsHtml(s: CastState) {
  return `<div class="dots" aria-hidden="true">${s.questionIds.map((_, i) => `<i class="${i < s.index ? 'done' : i === s.index ? 'now' : ''}"></i>`).join('')}</div>`;
}

function topBar(s: CastState) {
  return `<div class="cast-top"><button class="icon-btn" data-leave aria-label="Back to home. The timer keeps running">${ICON.back}</button>
    <p class="label">Daily Cast · ${s.index + 1} of ${GAME.questionsPerCast}</p><span></span></div>`;
}

function renderQuestion(ctx: Ctx, root: HTMLElement, initial: CastState) {
  let s = initial;
  const q = currentQuestion(s)!;
  const canWager = wagerAvailable(s);
  root.innerHTML = `<main id="main" class="view full cast">
    ${topBar(s)}${dotsHtml(s)}
    <div class="ring" role="timer" aria-label="Seconds left"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/><circle class="arc" cx="50" cy="50" r="42" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg><b data-secs>${GAME.secondsPerQuestion}</b></div>
    <h1 class="question" id="qtext">${esc(q.text)}.</h1>
    <form data-form autocomplete="off" novalidate>
      <label class="sr" for="answer">Your answer</label>
      <input id="answer" class="answer" name="answer" placeholder="Your answer…" maxlength="60" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="qtext" disabled>
      <button class="btn primary" type="submit" data-cast disabled>Cast</button>
    </form>
    ${canWager ? `<button class="wager" type="button" data-wager aria-pressed="${s.wagerArmed}">
        <span class="row-icon">${ICON.anchor}</span><span><b>Captain’s Wager</b><span>Double this catch. Once a day.</span></span><span class="x2">×2</span></button>`
      : s.wagerIndex !== null ? `<p class="wager-note">Captain’s Wager used on question ${s.wagerIndex + 1}</p>` : ''}
    <p class="sr" aria-live="assertive" data-announce></p>
  </main>`;

  const input = root.querySelector<HTMLInputElement>('#answer')!;
  const castBtn = root.querySelector<HTMLButtonElement>('[data-cast]')!;
  const ring = root.querySelector<HTMLElement>('.ring')!;
  const arc = root.querySelector<SVGCircleElement>('.arc')!;
  const secs = root.querySelector<HTMLElement>('[data-secs]')!;
  const announce = root.querySelector<HTMLElement>('[data-announce]')!;
  const wagerBtn = root.querySelector<HTMLButtonElement>('[data-wager]');
  let busy = false;
  let raf = 0;
  let lastSec = -1;

  const commit = (next: CastState) => {
    s = next;
    ctx.save.current = s;
    ctx.persist();
  };

  root.querySelector('[data-leave]')!.addEventListener('click', () => ctx.go('home'));

  wagerBtn?.addEventListener('click', () => {
    if (busy) return;
    commit(toggleWager(s));
    wagerBtn.setAttribute('aria-pressed', String(s.wagerArmed));
    if (s.wagerArmed) { sfx.wager(); haptic('good'); } else { sfx.tap(); }
    input.focus();
  });

  const tick = () => {
    const rem = remainingMs(s, now());
    const sec = Math.ceil(rem / 1000);
    arc.style.strokeDashoffset = String(CIRC * (1 - rem / LIMIT_MS));
    if (sec !== lastSec) {
      lastSec = sec;
      secs.textContent = String(sec);
      ring.classList.toggle('low', sec <= 5);
      if (sec <= 5 && sec > 0) sfx.tick();
      if (sec === 10 || sec === 5) announce.textContent = `${sec} seconds left`;
    }
    if (rem <= 0) return void submit(true);
    raf = requestAnimationFrame(tick);
  };

  const submit = async (timedOut: boolean) => {
    if (busy) return;
    const text = input.value;
    if (!timedOut && !text.trim()) {
      input.focus();
      return;
    }
    busy = true;
    cancelAnimationFrame(raf);
    input.disabled = true;
    castBtn.disabled = true;
    if (wagerBtn) wagerBtn.disabled = true;
    if (!timedOut) { ripple(castBtn); sfx.cast(); haptic('cast'); }
    const minWait = ctx.reduced() ? 150 : timedOut ? 450 : 1100;
    if (timedOut) announce.textContent = 'Time’s up';
    const t0 = performance.now();
    try {
      const out = await ctx.engine.cast(s, timedOut ? '' : text);
      if (!out.record) {
        if (out.rejected === 'duplicate') return ctx.rerender();
        throw new Error(out.rejected ?? 'No catch');
      }
      commit(out.state);
      if (!timedOut) showReeling(root, s);
      await wait(Math.max(0, minWait - (performance.now() - t0)));
      if (!root.isConnected) return;
      renderReveal(ctx, root, s, out.record, true);
    } catch {
      busy = false;
      showNetworkError(ctx, root);
    }
  };

  root.querySelector<HTMLFormElement>('[data-form]')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit(false);
  });

  const onVisible = () => {
    if (document.visibilityState === 'visible' && !busy && remainingMs(s, now()) <= 0) void submit(true);
  };
  document.addEventListener('visibilitychange', onVisible);
  ctx.onLeave(() => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisible); });

  ctx.engine.start(s).then((started) => {
    if (!root.isConnected) return;
    commit(started);
    input.disabled = false;
    castBtn.disabled = false;
    input.focus({ preventScroll: true });
    raf = requestAnimationFrame(tick);
  }).catch(() => showNetworkError(ctx, root));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ripple(btn: HTMLElement) {
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = Math.max(btn.clientWidth, btn.clientHeight);
  r.style.cssText = `width:${size}px;height:${size}px;left:${btn.clientWidth / 2 - size / 2}px;top:${btn.clientHeight / 2 - size / 2}px`;
  btn.appendChild(r);
  setTimeout(() => r.remove(), 650);
}

function showReeling(root: HTMLElement, s: CastState) {
  const main = root.querySelector('main');
  if (!main) return;
  main.innerHTML = `${topBar(s)}${dotsHtml(s)}<div class="reeling" role="status"><div class="float"><span class="bobber"></span><span class="rip"></span><span class="rip"></span></div><p>Reeling in…</p></div>`;
}

function showNetworkError(ctx: Ctx, root: HTMLElement) {
  root.innerHTML = `<main id="main" class="view full"><div class="err" role="alert"><h2>Lost the line</h2>
    <p>We couldn’t reach the harbour, so nothing was recorded. Check your connection and try again. Your timer is still running.</p>
    <button class="btn primary" data-retry>Try again</button></div></main>`;
  root.querySelector('[data-retry]')!.addEventListener('click', () => ctx.rerender());
}

/** A rare answer the player could have given, shown after a miss so it teaches something. */
function couldHave(questionId: string, day: number): string | null {
  const q = questionById(questionId);
  if (!q) return null;
  const rare = q.answers.filter((a) => a.est < 1);
  const pool = rare.length ? rare : q.answers;
  return pool[Math.floor(rng(day * 131 + questionId.length * 7)() * pool.length)]?.name ?? null;
}

function renderReveal(ctx: Ctx, root: HTMLElement, s: CastState, r: CatchRecord, fresh: boolean) {
  const t = tierById(r.tier);
  const isBoot = r.tier === 'boot';
  const legend = r.tier === 'leviathan';
  const name = isBoot ? 'Old Boot' : speciesName(r.species);
  const lead = isBoot ? (r.timedOut ? 'The line went slack…' : 'You reeled in an') : `You caught ${article(name)}`;
  const last = s.index + 1 >= s.questionIds.length;
  const lit = tierIndex(r.tier) >= tierIndex('octopus');

  let said: string;
  if (isBoot) {
    const alt = couldHave(r.questionId, s.day);
    const why = r.timedOut ? 'Time ran out on this one.' : `“${esc(r.input)}” isn’t an answer the Captain accepts here.`;
    said = `<p class="said fade-up d2">${why}${alt ? `<br>One that would have counted: <strong>${esc(alt)}</strong>` : ''}</p>`;
  } else if (r.source === 'players' && r.pct !== null) {
    const p = formatPct(r.pct);
    said = `<p class="said players fade-up d2">“${esc(r.answerName)}”<br>${r.pct < 10 ? `Only <strong>${p}</strong> of players gave this answer!` : `<strong>${p}</strong> of players gave this answer.`}</p>`;
  } else {
    said = `<p class="said fade-up d2">“${esc(r.answerName)}”</p><span class="est fade-up d2">Estimated rarity · live player figures appear once ${GAME.minSampleSize} players have answered</span>`;
  }

  const wagerLine = r.wager
    ? isBoot ? '<small>Captain’s Wager lost</small>' : `<small>Captain’s Wager ×2 · from ${fmtKg(r.baseKg)}</small>`
    : '';

  root.innerHTML = `<main id="main" class="view full reveal ${legend && fresh ? 'legend-reveal' : ''}" aria-live="polite">
    <p class="lead fade-up">${lead}</p>
    <h1 class="fade-up">${esc(name)}${isBoot ? '' : '!'}</h1>
    <div class="stage ${lit ? 'lit' : ''} ${legend ? 'legend' : ''} ${isBoot ? 'boot' : ''}"><div class="rays"></div><div class="halo"></div>${creature(r.species, { title: name })}</div>
    <span class="pill r-${r.tier} fade-up d1">${ICON.diamond}${t.rarity}</span>
    <p class="weight fade-up d1">${fmtKg(r.kg)}${wagerLine}</p>
    ${said}
    <button class="btn primary fade-up d3" data-next>${last ? 'Weigh your haul' : 'Continue'} ${ICON.arrow}</button>
  </main>`;

  if (fresh) {
    sfx.reveal(r.tier);
    haptic(isBoot ? 'bad' : legend ? 'legend' : 'good');
  }
  if (!fresh || ctx.reduced()) root.querySelector('main')!.classList.remove('legend-reveal');

  const next = root.querySelector<HTMLButtonElement>('[data-next]')!;
  setTimeout(() => next.isConnected && next.focus({ preventScroll: true }), legend && fresh ? 1700 : 600);
  let moved = false;
  next.addEventListener('click', () => {
    if (moved) return;
    moved = true;
    sfx.tap();
    const cur = ctx.save.current;
    if (!cur) return ctx.go('home');
    const adv = advance(cur);
    if (adv.status === 'complete') {
      finalizeCast(ctx, adv);
      ctx.go('results');
    } else {
      ctx.save.current = adv;
      ctx.persist();
      ctx.rerender();
    }
  });
}
