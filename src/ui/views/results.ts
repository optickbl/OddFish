import { GAME, tierById, topicById, type TopicId } from '../../config';
import { now } from '../../core/clock';
import { EXHIBIT_REWARD, celebrate, orderFor, orderProgress, pendingMilestone, sevenDayTarget, weekOf, type Milestone } from '../../core/extras';
import type { CastSummary } from '../../core/game';
import { previousBest } from '../../core/progress';
import { nextResetAt } from '../../core/schedule';
import { ICON, captain, creature, speciesName, type Mood } from '../art';
import type { Ctx } from '../ctx';
import { countUp, esc, fmtCountdown, fmtKg, fmtNum, sheet, toast } from '../dom';
import { haptic, sfx } from '../feedback';
import { shareCard, shareText } from '../share';
import { seaHaul } from '../sea';
import { lastReport, resultsDay } from './cast';

/** The Captain, curating: a line for each thing donated to the aquarium. */
const CURATOR = [
  (n: string) => `A ${n}. I’ll find it a tank by the window.`,
  (n: string) => `${n}? Fine. It can go next to the boot.`,
  (n: string) => `Never had a ${n} in the aquarium before. Don’t tell anyone I’m pleased.`,
  (n: string) => `Into the aquarium with the ${n}. Mind the glass.`,
];

function verdict(sum: CastSummary): { mood: Mood; line: string } {
  if (sum.legendaries >= 2 || sum.totalKg >= 2000) return { mood: 'shocked', line: 'Legendary haul. I am… impressed.' };
  if (sum.totalKg >= 800) return { mood: 'happy', line: 'A fine haul. Don’t let it go to your head.' };
  if (sum.totalKg >= 200) return { mood: 'grumpy', line: 'Respectable. The sardines send their regards.' };
  return { mood: 'grumpy', line: 'I’ve seen better hauls from a bucket.' };
}

export function renderResults(ctx: Ctx, root: HTMLElement) {
  const day = ctx.today();
  const save = ctx.save;
  const sum = save.history.find((h) => h.day === resultsDay(day)) ?? save.history.find((h) => h.day === day) ?? save.history[save.history.length - 1];
  if (!sum) return ctx.go('home');
  const archive = sum.kind === 'archive';
  const isToday = sum.day === day;
  const prev = previousBest(save, sum.day);
  const newBest = !archive && prev !== null && sum.totalKg > prev;
  const v = verdict(sum);
  const reduced = ctx.reduced();
  const report = lastReport && lastReport.day === sum.day ? lastReport : null;
  const finds = report?.newFinds ?? [];
  const fresh = finds.length > 0;
  const target = archive ? null : report ? report.target : sevenDayTarget(save, sum.day);
  const order = orderFor(weekOf(sum.playedOn ?? sum.day));
  const orderNow = orderProgress(order, save);
  const fishFinds = finds.filter((f) => f.includes(':'));
  const curator = fishFinds.length ? CURATOR[sum.day % CURATOR.length](speciesName(fishFinds[0])) : null;

  const targetRow = target === null ? '' : sum.totalKg >= target
    ? `<li><span class="row-icon">${ICON.target}</span><span class="k">Beat your 7-day average</span><span class="v gold">+${fmtKg(sum.totalKg - target)}</span></li>`
    : `<li><span class="row-icon">${ICON.target}</span><span class="k">Your 7-day average</span><span class="v">${fmtKg(target)}</span></li>`;
  const extra: string[] = [];
  if (sum.bait) extra.push(`<li><span class="row-icon">${ICON.hook}</span><span class="k">Bait</span><span class="v">${esc(topicById(sum.bait as TopicId).label)}</span></li>`);
  if (report) extra.push(`<li><span class="row-icon">${ICON.scale}</span><span class="k">Into the hold</span><span class="v">+${fmtKg(sum.totalKg)}</span></li>`);
  extra.push(report?.order
    ? `<li><span class="row-icon">${ICON.scroll}</span><span class="k">Captain’s orders done!</span><span class="v gold">+${fmtKg(report.order)}</span></li>`
    : `<li><span class="row-icon">${ICON.scroll}</span><span class="k">Captain’s orders<small>${esc(order.text)}</small></span><span class="v">${save.ordersClaimed.includes(order.week) ? 'Done' : `${fmtNum(Math.min(orderNow, order.target))} / ${fmtNum(order.target)}`}</span></li>`);
  for (const e of report?.exhibits ?? []) extra.push(`<li><span class="row-icon">${ICON.book}</span><span class="k">Exhibit complete: ${esc(e)}</span><span class="v gold">+${fmtKg(EXHIBIT_REWARD)}</span></li>`);
  if (report?.freeze) extra.push(`<li><span class="row-icon">${ICON.snow}</span><span class="k">Streak freeze earned</span><span class="v">${save.freezes} held</span></li>`);
  if (report?.wager === 'won' && save.lastStreakWager) extra.push(`<li><span class="row-icon">${ICON.flame}</span><span class="k">Streak Wager won!</span><span class="v gold">+${fmtKg(save.lastStreakWager.stake * 2)}</span></li>`);
  if (report?.wager === 'lost') extra.push(`<li><span class="row-icon">${ICON.flame}</span><span class="k">Streak Wager lost</span><span class="v">—</span></li>`);

  const pbRow = archive ? '' : prev === null
    ? `<li><span class="row-icon">${ICON.trophy}</span><span class="k">Personal best</span><span class="v">First haul</span></li>`
    : newBest
      ? `<li><span class="row-icon">${ICON.trophy}</span><span class="k">New personal best!</span><span class="v gold">+${fmtKg(sum.totalKg - prev)}</span></li>`
      : `<li><span class="row-icon">${ICON.trophy}</span><span class="k">Personal best</span><span class="v">${fmtKg(prev)}</span></li>`;

  const rarest = sum.rarest;
  const wager = sum.wager === 'won' ? 'Won ×2' : sum.wager === 'lost' ? 'Lost' : 'Not used';

  root.innerHTML = `<main id="main" class="view results">
    <h1>${archive ? 'Missed-Day Haul' : 'Your Daily Haul'}</h1>
    <p class="caption">${archive ? `Missed-day cast #${sum.day} · half weight` : `Daily Cast #${sum.day}`}</p>
    <div class="sign" role="img" aria-label="Total haul ${fmtNum(sum.totalKg)} kilograms"><div class="kg" data-kg>0 kg</div>${newBest ? '<div class="pb">New personal best</div>' : ''}</div>
    <div class="fishrow" aria-hidden="true">${sum.catches.map((c, i) => `<span class="slot ${c.tier === 'leviathan' ? 'legend' : ''}" style="animation-delay:${reduced ? 0 : 0.35 + i * 0.12}s">${creature(c.species)}</span>`).join('')}</div>
    <ul class="rows">
      <li><span class="row-icon">${ICON.check}</span><span class="k">Correct answers</span><span class="v">${sum.correct} / ${GAME.questionsPerCast}</span></li>
      <li><span class="row-icon">${ICON.star}</span><span class="k">Rarest catch</span><span class="v ${rarest?.tier === 'leviathan' ? 'gold' : ''}">${rarest ? `${esc(tierById(rarest.tier).name)} (${fmtKg(rarest.kg)})` : '—'}</span></li>
      <li><span class="row-icon">${ICON.anchor}</span><span class="k">Captain’s Wager</span><span class="v">${wager}</span></li>
      ${pbRow}
      ${targetRow}
      ${fresh ? `<li><span class="row-icon">${ICON.book}</span><span class="k">Donated to the aquarium<small>${finds.slice(0, 4).map((f) => esc(speciesName(f))).join(', ')}${finds.length > 4 ? '…' : ''}</small></span><span class="v">${finds.length} new</span></li>` : ''}
      ${extra.join('')}
    </ul>
    <div class="actions">
      <button class="btn secondary" data-logbook>View Logbook</button>
      <button class="btn primary" data-share>${ICON.share} Share</button>
    </div>
    <button class="btn ghost" data-copy style="margin-top:6px">Copy as text</button>
    <p class="captain-says">${captain(curator ? 'happy' : v.mood)}<span>“${esc(curator ?? v.line)}”</span></p>
    <details class="catches"><summary>See all seven catches</summary><ol>
      ${sum.catches.map((c) => `<li>${creature(c.species)}<div><p class="q">${esc(c.questionText)}</p><p class="a">${c.answerName ? esc(c.answerName) : c.input ? `“${esc(c.input)}”` : 'No answer'}</p></div>
        <p class="t"><b>${fmtKg(c.kg)}</b>${c.tier === 'boot' ? 'Old Boot' : esc(speciesName(c.species))}${c.mults?.length ? ` · ×${+c.mults.reduce((p, m) => p * m.x, 1).toFixed(2)}` : c.wager ? ' · ×2' : ''}</p></li>`).join('')}
    </ol></details>
    ${isToday ? `<p class="next">Next cast in <span data-countdown>${fmtCountdown(nextResetAt(now()) - now())}</span></p>` : ''}
  </main>`;

  // The haul, afloat in 3D (the SVG row stays as the fallback).
  const seaMoodFor = sum.legendaries > 0 || v.mood === 'shocked' ? 'excited' : v.mood === 'happy' ? 'happy' : sum.totalKg < 200 ? 'disappointed' : 'idle';
  seaHaul(sum.catches.map((c) => c.species), root.querySelector<HTMLElement>('.fishrow')!, seaMoodFor);
  const kg = root.querySelector<HTMLElement>('[data-kg]')!;
  countUp(kg, sum.totalKg, sum.totalKg > 0 ? 1400 : 0, (n) => `${fmtNum(n)} kg`, reduced, sfx.count);

  root.querySelector('[data-logbook]')!.addEventListener('click', () => ctx.go('logbook'));
  const shareBtn = root.querySelector<HTMLButtonElement>('[data-share]')!;
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    try {
      const r = await shareCard(sum);
      if (r === 'downloaded') toast('Share card saved');
    } catch {
      toast('Couldn’t make the card. Try Copy as text.');
    } finally {
      shareBtn.disabled = false;
    }
  });
  root.querySelector('[data-copy]')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText(sum));
      toast('Copied to clipboard');
    } catch {
      toast('Copy isn’t available here');
    }
  });

  const cd = root.querySelector<HTMLElement>('[data-countdown]');
  if (cd) {
    const iv = window.setInterval(() => {
      if (ctx.today() !== day) return ctx.go('home');
      cd.textContent = fmtCountdown(nextResetAt(now()) - now());
    }, 1000);
    ctx.onLeave(() => clearInterval(iv));
  }

  // A streak milestone gets its own moment, once.
  const m = !archive && report ? pendingMilestone(save) : null;
  if (m) {
    celebrate(save, m);
    ctx.persist();
    const t = setTimeout(() => showMilestone(m), reduced ? 200 : 1900);
    ctx.onLeave(() => clearTimeout(t));
  }
}

function showMilestone(m: Milestone) {
  sfx.reveal('leviathan');
  haptic('legend');
  const confetti = Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.12}s;--c:${['#E7AD58', '#F7F0E3', '#E58A6E', '#7ff0e4'][i % 4]}"></i>`).join('');
  sheet(
    `<div class="confetti" aria-hidden="true">${confetti}</div>
     <div class="milestone">
       <div class="flame-big">${ICON.flame}<b>${m.days}</b></div>
       <h2>${m.days}-day streak!</h2>
       <p class="note">${captain('shocked', '', undefined)}</p>
       <p>The Captain doesn’t hand out compliments. This is close.</p>
       <ul class="boosts"><li>${ICON.scale}<span><b>+${fmtKg(m.reward)}</b> into the hold</span></li>${m.unlock ? `<li>${ICON.boat}<span><b>${esc(m.unlock)}</b> for your boat</span></li>` : ''}</ul>
       <button class="btn primary wide" data-close autofocus>Back to it</button>
     </div>`,
    { label: `${m.days}-day streak` },
  );
}
