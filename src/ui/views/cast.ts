import { GAME, tierById, tierIndex, topicById, type TopicId } from '../../config';
import { questionById } from '../../core/answers';
import { now } from '../../core/clock';
import {
  ARCHIVE_FACTOR, LUCK_CASTS, UPGRADES, archiveAvailable, baitOptions, buildMods, claimExhibits, claimOrder, dailyCasts, earnFreeze, inWindow, limitOf,
  resolveStreakWager, sevenDayTarget, sonarHint, tideFor, type CastKind,
} from '../../core/extras';
import {
  advance, castKind, currentQuestion, forfeitRest, isAnswered, newCast, oddsFromCast, remainingMs, settleExpired, sonarLeft, summarize, toggleWager, useSonar,
  wagerAvailable, type CastState, type CatchRecord,
} from '../../core/game';
import { completeDay, recordFinds } from '../../core/progress';
import { formatPct } from '../../core/rarity';
import { dailyQuestionIds, rng } from '../../core/schedule';
import { ICON, creature, speciesName } from '../art';
import type { Ctx } from '../ctx';
import { article, esc, fmtKg, sheet, toast } from '../dom';
import { haptic, sfx } from '../feedback';
import { seaMood, seaQuestion, seaReady, seaReel, seaReveal } from '../sea';

/** What the cast that just finished earned, for the results screen. */
export interface CastReport {
  day: number;
  newFinds: string[];
  /** Captain's orders reward paid, 0 if none. */
  order: number;
  exhibits: string[];
  wager: 'won' | 'lost' | null;
  freeze: boolean;
  /** Seven-day average before this cast (daily casts only). */
  target: number | null;
}
export let lastReport: CastReport | null = null;

/** Which cast the results screen shows. */
let viewDay: number | null = null;
export const resultsDay = (today: number) => viewDay ?? today;
export function showResults(ctx: Ctx, day: number) {
  viewDay = day;
  ctx.go('results');
}

export function startOrResume(ctx: Ctx) {
  const day = ctx.today();
  const s = ctx.save.current;
  if (s && s.status === 'playing' && castKind(s) === 'daily' && s.day === day) {
    sfx.tap();
    return ctx.go('cast');
  }
  if (ctx.save.history.some((h) => h.day === day)) return showResults(ctx, day);
  // An unfinished missed-day cast is closed first, keeping its catches.
  if (s && s.status === 'playing' && castKind(s) === 'archive') finalizeCast(ctx, forfeitRest(s, now()));
  chooseBait(ctx, day, 'daily');
}

/** Play a missed day: half weight, no streak, one a day. */
export function startArchive(ctx: Ctx, day: number) {
  const s = ctx.save.current;
  if (s && s.status === 'playing') {
    if (castKind(s) === 'archive' && s.day === day) return ctx.go('cast');
    return toast(castKind(s) === 'daily' ? 'Finish today’s cast first' : 'Finish your other missed-day cast first');
  }
  if (!archiveAvailable(ctx.save, ctx.today())) return toast('One missed-day cast a day. Come back tomorrow.');
  chooseBait(ctx, day, 'archive');
}

export const resumeCast = (ctx: Ctx) => ctx.go('cast');

/** Before the first question: pick the topic that weighs double. */
function chooseBait(ctx: Ctx, day: number, kind: CastKind) {
  const save = ctx.save;
  const ids = dailyQuestionIds(day);
  const opts = baitOptions(ids.map((id) => questionById(id)!).filter(Boolean));
  const t = now();
  const tide = kind === 'daily' ? tideFor(day) : null;
  const luckLeft = LUCK_CASTS - dailyCasts(save).length;
  const notes: string[] = [];
  if (inWindow(tide, t)) notes.push(`${ICON.wave}<span><b>The Surprise Tide is in.</b> Every catch weighs double for the next ${Math.ceil((tide!.end - t) / 60000)} minutes.</span>`);
  if (kind === 'daily' && luckLeft > 0) notes.push(`${ICON.star}<span><b>Beginner’s luck.</b> Your first correct answer lands at least an Octopus. ${luckLeft} ${luckLeft === 1 ? 'cast' : 'casts'} left.</span>`);
  if (kind === 'archive') notes.push(`${ICON.calendar}<span><b>Missed-day cast #${day}.</b> Catches weigh half and don’t count toward your streak.</span>`);
  if (save.upgrades.rod) notes.push(`${ICON.boat}<span><b>Long Rod.</b> ${UPGRADES.rod.describe(UPGRADES.rod.effect[save.upgrades.rod])}.</span>`);
  const { root, close } = sheet(
    `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button>
     <h2>Choose your bait</h2>
     <p class="note" style="margin:8px 0 16px">Pick one topic from today’s seven. Its catches weigh double.</p>
     <div class="baits">${opts.map((o) => {
       const tp = topicById(o.topic);
       return `<button type="button" class="bait" data-topic="${o.topic}"><span class="sw" style="background:${tp.palette.base}"></span><b>${esc(tp.label)}</b>${o.n > 1 ? `<small>${o.n} questions</small>` : ''}</button>`;
     }).join('')}</div>
     ${notes.length ? `<ul class="boosts">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}`,
    { label: 'Choose your bait' },
  );
  root.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach((b) =>
    b.addEventListener('click', () => {
      const bait = b.dataset.topic as TopicId;
      const mods = buildMods(save, day, kind, bait, new Date().getTimezoneOffset());
      save.current = newCast(day, ids, mods);
      if (kind === 'archive') save.archivePlayedOn = ctx.today();
      ctx.persist();
      sfx.tap();
      haptic('cast');
      close();
      ctx.go('cast');
    }),
  );
}

/** Close a completed cast: history, streak, purse, orders, Logbook. Safe to call once per cast. */
export function finalizeCast(ctx: Ctx, s: CastState) {
  const save = ctx.save;
  if (save.history.some((h) => h.day === s.day)) {
    save.current = null;
    ctx.persist();
    return;
  }
  const today = ctx.today();
  const kind = castKind(s);
  const target = kind === 'daily' ? sevenDayTarget(save, s.day) : null;
  const sum = summarize(s, kind === 'daily' ? s.day : today);
  save.history = [...save.history, sum].sort((a, b) => a.day - b.day);
  let freeze = false;
  if (kind === 'daily') {
    save.streak = completeDay(save.streak, s.day);
    freeze = earnFreeze(save);
  }
  const odd = oddsFromCast(sum);
  if (kind === 'daily' && save.streak.current >= 7) odd.push('anchor');
  const before = new Set(Object.keys(save.found));
  save.found = recordFinds(save.found, sum.catches, odd, now());
  const newFinds = Object.keys(save.found).filter((k) => !before.has(k));
  save.purse += sum.totalKg;
  const order = claimOrder(save, today);
  const exhibits = claimExhibits(save);
  const wager = resolveStreakWager(save, today);
  lastReport = { day: s.day, newFinds, order, exhibits, wager, freeze, target };
  viewDay = s.day;
  save.current = null;
  ctx.persist();
}

const CIRC = 2 * Math.PI * 42;
const fmtX = (x: number) => (x === ARCHIVE_FACTOR ? '½' : String(x));

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

function chipsHtml(s: CastState, topic: TopicId): string {
  const m = s.mods;
  if (!m) return '';
  const out: string[] = [];
  if (m.bait && m.bait === topic) out.push(`<span class="chip gold">${ICON.hook}${esc(topicById(m.bait).label)} bait ×2</span>`);
  if (inWindow(m.tide, now())) out.push(`<span class="chip tide">${ICON.wave}Surprise Tide ×2</span>`);
  if (m.kind === 'archive') out.push(`<span class="chip">${ICON.calendar}Missed day ×½</span>`);
  if (m.luck && !s.luckUsed) out.push(`<span class="chip">${ICON.star}Beginner’s luck</span>`);
  return out.length ? `<div class="chip-row">${out.join('')}</div>` : '';
}

function sonarHtml(s: CastState, day: number): string {
  const q = currentQuestion(s)!;
  if (s.sonarUsed?.includes(s.index)) {
    const h = sonarHint(q, day);
    return `<p class="sonar-hint">${ICON.sonar}<span>Sonar: a rare answer starts with <b>“${esc(h.letter)}”</b> · ${h.letters} letters${h.words > 1 ? ` · ${h.words} words` : ''}</span></p>`;
  }
  const left = sonarLeft(s);
  return left > 0 ? `<button type="button" class="sonar" data-sonar>${ICON.sonar}<span>Ping the Sonar</span><small>${left} left</small></button>` : '';
}

function renderQuestion(ctx: Ctx, root: HTMLElement, initial: CastState) {
  let s = initial;
  const q = currentQuestion(s)!;
  const canWager = wagerAvailable(s);
  const limit = limitOf(s);
  root.innerHTML = `<main id="main" class="view full cast">
    ${topBar(s)}${dotsHtml(s)}
    <div class="q-scene" aria-hidden="true"></div>
    <div class="ring" role="timer" aria-label="Seconds left"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/><circle class="arc" cx="50" cy="50" r="42" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg><b data-secs>${Math.round(limit / 1000)}</b></div>
    ${chipsHtml(s, q.topic)}
    <h1 class="question" id="qtext">${esc(q.text)}.</h1>
    <form data-form autocomplete="off" novalidate>
      <label class="sr" for="answer">Your answer</label>
      <input id="answer" class="answer" name="answer" placeholder="Your answer…" maxlength="60" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="qtext" disabled>
      <button class="btn primary" type="submit" data-cast disabled>Cast</button>
    </form>
    ${canWager ? `<button class="wager" type="button" data-wager aria-pressed="${s.wagerArmed}">
        <span class="row-icon">${ICON.anchor}</span><span><b>Captain’s Wager</b><span>Double this catch. Once a day.</span></span><span class="x2">×2</span></button>`
      : s.wagerIndex !== null ? `<p class="wager-note">Captain’s Wager used on question ${s.wagerIndex + 1}</p>` : ''}
    <div data-sonar-slot>${sonarHtml(s, s.day)}</div>
    <p class="sr" aria-live="assertive" data-announce></p>
  </main>`;

  const input = root.querySelector<HTMLInputElement>('#answer')!;
  const castBtn = root.querySelector<HTMLButtonElement>('[data-cast]')!;
  const ring = root.querySelector<HTMLElement>('.ring')!;
  const arc = root.querySelector<SVGCircleElement>('.arc')!;
  const secs = root.querySelector<HTMLElement>('[data-secs]')!;
  const announce = root.querySelector<HTMLElement>('[data-announce]')!;
  const wagerBtn = root.querySelector<HTMLButtonElement>('[data-wager]');
  seaQuestion(root.querySelector<HTMLElement>('.q-scene')!);
  let busy = false;
  let raf = 0;
  let lastSec = -1;

  const commit = (next: CastState) => {
    s = next;
    ctx.save.current = s;
    ctx.persist();
  };

  root.querySelector('[data-leave]')!.addEventListener('click', () => ctx.go('home'));

  const sonarSlot = root.querySelector<HTMLElement>('[data-sonar-slot]')!;
  const bindSonar = () => sonarSlot.querySelector('[data-sonar]')?.addEventListener('click', () => {
    if (busy || s.startedAt === null) return;
    commit(useSonar(s));
    sonarSlot.innerHTML = sonarHtml(s, s.day);
    sfx.wager();
    haptic('good');
    input.focus();
  });
  bindSonar();

  wagerBtn?.addEventListener('click', () => {
    if (busy) return;
    commit(toggleWager(s));
    wagerBtn.setAttribute('aria-pressed', String(s.wagerArmed));
    if (s.wagerArmed) { sfx.wager(); haptic('good'); } else { sfx.tap(); }
    seaMood(s.wagerArmed ? 'excited' : 'thinking');
    input.focus();
  });

  const tick = () => {
    const rem = remainingMs(s, now());
    const sec = Math.ceil(rem / 1000);
    arc.style.strokeDashoffset = String(CIRC * (1 - rem / limit));
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
    sonarSlot.querySelector<HTMLButtonElement>('[data-sonar]')?.setAttribute('disabled', '');
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
  main.innerHTML = `${topBar(s)}${dotsHtml(s)}<div class="q-scene reel" aria-hidden="true"></div><div class="reeling" role="status"><div class="float"><span class="bobber"></span><span class="rip"></span><span class="rip"></span></div><p>Reeling in…</p></div>`;
  seaReel(main.querySelector<HTMLElement>('.q-scene')!);
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

/** Seconds until a 3D catch is out of the water (stir + rise), per tier. */
const REVEAL_DELAY: Record<string, number> = { boot: 1.1, sardine: 0.75, clownfish: 0.85, octopus: 1.1, swordfish: 1.45, leviathan: 2.4 };

function renderReveal(ctx: Ctx, root: HTMLElement, s: CastState, r: CatchRecord, fresh: boolean) {
  const t = tierById(r.tier);
  const isBoot = r.tier === 'boot';
  const legend = r.tier === 'leviathan';
  const name = isBoot ? 'Old Boot' : speciesName(r.species);
  const lead = isBoot
    ? (r.timedOut ? 'The line went slack…' : 'You reeled in an')
    : r.special === 'seasonal' ? 'A seasonal visitor!'
      : r.special === 'abyss' ? 'Something rose from the Abyss…'
        : r.variant === 'shiny' ? 'It’s glittering! You caught'
          : r.variant === 'mutant' ? 'Too fast for nature… you caught'
            : r.variant === 'night' ? 'Out of the dark, you caught'
              : `You caught ${article(name)}`;
  const leadFull = !isBoot && (r.special || r.variant) && !r.special ? `${lead} ${article(name)}` : lead;
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

  const mults = r.mults ?? (r.wager ? [{ label: 'Captain’s Wager', x: 2 }] : []);
  const wagerLine = isBoot
    ? [r.wager ? 'Captain’s Wager lost' : '', r.salvage ? 'Salvaged by your net' : ''].filter(Boolean).map((x) => `<small>${x}</small>`).join('')
    : mults.length ? `<small>${mults.map((m) => `${esc(m.label)} ×${fmtX(m.x)}`).join(' · ')} · from ${fmtKg(r.baseKg)}</small>` : '';
  const badge = r.variant ? `<span class="pill v-${r.variant}">${esc(r.variant[0].toUpperCase() + r.variant.slice(1))}</span>`
    : r.special === 'seasonal' ? `<span class="pill v-season">Seasonal</span>`
      : r.special === 'abyss' ? `<span class="pill v-abyss">The Abyss</span>` : '';
  const luck = r.boost === 'luck' ? `<p class="boost fade-up d2">${ICON.star} Beginner’s luck: the Captain bumped this up to an Octopus.</p>` : '';

  // With the 3D sea, words wait for the catch to break the surface.
  const surface = fresh && seaReady() && !ctx.reduced() ? REVEAL_DELAY[r.tier] : 0;
  root.innerHTML = `<main id="main" class="view full reveal ${legend && fresh ? 'legend-reveal' : ''} ${surface ? 'surfacing' : ''}" style="--rd:${surface}s" aria-live="polite">
    <p class="lead fade-up">${leadFull}</p>
    <h1 class="fade-up">${esc(name)}${isBoot ? '' : '!'}</h1>
    <div class="stage ${lit ? 'lit' : ''} ${legend ? 'legend' : ''} ${isBoot ? 'boot' : ''}"><div class="rays"></div><div class="halo"></div>${creature(r.species, { title: name })}</div>
    <div class="pills fade-up d1"><span class="pill r-${r.tier}">${ICON.diamond}${t.rarity}</span>${badge}</div>
    <p class="weight fade-up d1">${fmtKg(r.kg)}${wagerLine}</p>
    ${luck}${said}
    <button class="btn primary fade-up d3" data-next>${last ? 'Weigh your haul' : 'Continue'} ${ICON.arrow}</button>
  </main>`;

  seaReveal(r.species, r.tier, root.querySelector<HTMLElement>('.stage')!, !fresh);
  if (fresh) {
    sfx.reveal(r.tier);
    haptic(isBoot ? 'bad' : legend ? 'legend' : 'good');
  }
  if (!fresh || ctx.reduced()) root.querySelector('main')!.classList.remove('legend-reveal');

  const next = root.querySelector<HTMLButtonElement>('[data-next]')!;
  setTimeout(() => next.isConnected && next.focus({ preventScroll: true }), (legend && fresh ? 1700 : 600) + surface * 1000);
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
      showResults(ctx, adv.day);
    } else {
      ctx.save.current = adv;
      ctx.persist();
      ctx.rerender();
    }
  });
}
