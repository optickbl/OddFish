import { GAME, tierById } from '../../config';
import { now } from '../../core/clock';
import type { CastSummary } from '../../core/game';
import { previousBest } from '../../core/progress';
import { nextResetAt } from '../../core/schedule';
import { ICON, captain, creature, speciesName, type Mood } from '../art';
import type { Ctx } from '../ctx';
import { countUp, esc, fmtCountdown, fmtKg, fmtNum, toast } from '../dom';
import { sfx } from '../feedback';
import { shareCard, shareText } from '../share';
import { lastNewFinds } from './cast';

function verdict(sum: CastSummary): { mood: Mood; line: string } {
  if (sum.legendaries >= 2 || sum.totalKg >= 2000) return { mood: 'shocked', line: 'Legendary haul. I am… impressed.' };
  if (sum.totalKg >= 800) return { mood: 'happy', line: 'A fine haul. Don’t let it go to your head.' };
  if (sum.totalKg >= 200) return { mood: 'grumpy', line: 'Respectable. The sardines send their regards.' };
  return { mood: 'grumpy', line: 'I’ve seen better hauls from a bucket.' };
}

export function renderResults(ctx: Ctx, root: HTMLElement) {
  const day = ctx.today();
  const sum = ctx.save.history.find((h) => h.day === day) ?? ctx.save.history[ctx.save.history.length - 1];
  if (!sum) return ctx.go('home');
  const isToday = sum.day === day;
  const prev = previousBest(ctx.save, sum.day);
  const newBest = prev !== null && sum.totalKg > prev;
  const v = verdict(sum);
  const reduced = ctx.reduced();
  const fresh = isToday && lastNewFinds.length > 0;

  const pbRow = prev === null
    ? `<li><span class="row-icon">${ICON.trophy}</span><span class="k">Personal best</span><span class="v">First haul</span></li>`
    : newBest
      ? `<li><span class="row-icon">${ICON.trophy}</span><span class="k">New personal best!</span><span class="v gold">+${fmtKg(sum.totalKg - prev)}</span></li>`
      : `<li><span class="row-icon">${ICON.trophy}</span><span class="k">Personal best</span><span class="v">${fmtKg(prev)}</span></li>`;

  const rarest = sum.rarest;
  const wager = sum.wager === 'won' ? 'Won ×2' : sum.wager === 'lost' ? 'Lost' : 'Not used';

  root.innerHTML = `<main id="main" class="view results">
    <h1>Your Daily Haul</h1>
    <p class="caption">Daily Cast #${sum.day}</p>
    <div class="sign" role="img" aria-label="Total haul ${fmtNum(sum.totalKg)} kilograms"><div class="kg" data-kg>0 kg</div>${newBest ? '<div class="pb">New personal best</div>' : ''}</div>
    <div class="fishrow" aria-hidden="true">${sum.catches.map((c, i) => `<span class="slot ${c.tier === 'leviathan' ? 'legend' : ''}" style="animation-delay:${reduced ? 0 : 0.35 + i * 0.12}s">${creature(c.species)}</span>`).join('')}</div>
    <ul class="rows">
      <li><span class="row-icon">${ICON.check}</span><span class="k">Correct answers</span><span class="v">${sum.correct} / ${GAME.questionsPerCast}</span></li>
      <li><span class="row-icon">${ICON.star}</span><span class="k">Rarest catch</span><span class="v ${rarest?.tier === 'leviathan' ? 'gold' : ''}">${rarest ? `${esc(tierById(rarest.tier).name)} (${fmtKg(rarest.kg)})` : '—'}</span></li>
      <li><span class="row-icon">${ICON.anchor}</span><span class="k">Captain’s Wager</span><span class="v">${wager}</span></li>
      ${pbRow}
      ${fresh ? `<li><span class="row-icon">${ICON.book}</span><span class="k">New in your Logbook</span><span class="v">${lastNewFinds.length}</span></li>` : ''}
    </ul>
    <div class="actions">
      <button class="btn secondary" data-logbook>View Logbook</button>
      <button class="btn primary" data-share>${ICON.share} Share</button>
    </div>
    <button class="btn ghost" data-copy style="margin-top:6px">Copy as text</button>
    <p class="captain-says">${captain(v.mood)}<span>“${v.line}”</span></p>
    <details class="catches"><summary>See all seven catches</summary><ol>
      ${sum.catches.map((c) => `<li>${creature(c.species)}<div><p class="q">${esc(c.questionText)}</p><p class="a">${c.answerName ? esc(c.answerName) : c.input ? `“${esc(c.input)}”` : 'No answer'}</p></div>
        <p class="t"><b>${fmtKg(c.kg)}</b>${c.tier === 'boot' ? 'Old Boot' : esc(speciesName(c.species))}${c.wager ? ' · ×2' : ''}</p></li>`).join('')}
    </ol></details>
    ${isToday ? `<p class="next">Next cast in <span data-countdown>${fmtCountdown(nextResetAt(now()) - now())}</span></p>` : ''}
  </main>`;

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
}
