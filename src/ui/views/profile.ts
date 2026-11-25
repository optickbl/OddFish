import { now } from '../../core/clock';
import { computeRecords, liveStreak } from '../../core/progress';
import { clearSave, exportSave, importSave, loadSave } from '../../services/storage';
import { onlineAvailable, sendMagicLink, signOut, signedInEmail } from '../../services/supabase';
import { ICON, captain } from '../art';
import type { Ctx } from '../ctx';
import { esc, sheet, toast } from '../dom';
import { haptic, setHaptics, setSound, sfx } from '../feedback';
import { showHowTo } from '../howto';

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function renderProfile(ctx: Ctx, root: HTMLElement) {
  const save = ctx.save;
  const r = computeRecords(save);
  const streak = liveStreak(save.streak, ctx.today());
  const acc = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
  const online = onlineAvailable();
  const email = online ? signedInEmail() : null;
  const sw = (id: string, on: boolean, label: string) => `<button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-sw="${id}"></button>`;

  root.innerHTML = `<main id="main" class="view">
    <h1 class="page-title">Profile</h1>
    <div class="identity">${captain('grumpy')}<div><h2>${esc(save.name)}</h2><p>${email ? `Signed in as ${esc(email)}` : 'Progress saved on this device'}</p>
      <button class="link-btn" data-rename style="padding:6px 0">Change name</button></div></div>
    <div class="mini-stats">
      <div><b>${streak}</b><span>Day streak</span></div>
      <div><b>${r.casts}</b><span>Casts</span></div>
      <div><b>${r.answered ? `${acc}%` : '—'}</b><span>Correct</span></div>
    </div>

    <section class="section" aria-labelledby="s-set"><h3 id="s-set">Settings</h3>
      <div class="setting"><p>Sound<small>Off until you turn it on</small></p>${sw('sound', save.settings.sound, 'Sound')}</div>
      <div class="setting"><p>Haptics<small>${canVibrate ? 'Gentle vibrations on catches' : 'Not supported on this device'}</small></p>${sw('haptics', save.settings.haptics && canVibrate, 'Haptics')}</div>
      <div class="setting"><p>Reduced motion<small>Also follows your device setting</small></p>${sw('motion', save.settings.motion === 'reduced', 'Reduced motion')}</div>
    </section>

    <section class="section" aria-labelledby="s-on"><h3 id="s-on">Online play</h3>
      ${online
        ? email
          ? `<p class="note">Your casts are scored by the Oddfish server with live player rarity.</p><button class="link-btn" data-signout>Sign out</button>`
          : `<form data-signin style="display:flex;gap:8px;margin-top:8px"><label class="sr" for="em">Email</label><input id="em" class="answer" type="email" required placeholder="you@example.com" style="height:50px;font-size:16px"><button class="btn secondary">Send link</button></form>
             <p class="note" style="margin-top:8px">We’ll email you a sign-in link. No password, nothing else collected.</p>`
        : `<p class="note">Oddfish is running in local mode. Rarity comes from curated estimates and is labelled as estimated. Email sign-in and live player rarity switch on when online play launches.</p>`}
    </section>

    <section class="section" aria-labelledby="s-data"><h3 id="s-data">Your progress</h3>
      <button class="link-btn" data-howto>How to play</button><br>
      <button class="link-btn" data-backup>Back up progress</button><br>
      <button class="link-btn" data-restore>Restore from a backup</button><br>
      <button class="link-btn danger" data-reset>Reset all progress</button>
    </section>
    <p class="version">Oddfish 1.0 · Daily Cast #${ctx.today()}</p>
  </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-sw]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.sw;
      const on = b.getAttribute('aria-checked') !== 'true';
      if (id === 'haptics' && !canVibrate) return toast('Haptics aren’t supported on this device');
      b.setAttribute('aria-checked', String(on));
      if (id === 'sound') { save.settings.sound = on; setSound(on); if (on) sfx.reveal('octopus'); }
      if (id === 'haptics') { save.settings.haptics = on; setHaptics(on); if (on) haptic('good'); }
      if (id === 'motion') { save.settings.motion = on ? 'reduced' : 'system'; document.documentElement.classList.toggle('reduce', ctx.reduced()); }
      ctx.persist();
    }),
  );

  root.querySelector('[data-rename]')!.addEventListener('click', () => {
    const { root: s, close } = sheet(
      `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button><h2>Your name</h2>
       <form data-f style="margin-top:16px;display:grid;gap:14px"><label class="sr" for="nm">Name</label><input id="nm" class="answer" maxlength="24" value="${esc(save.name)}" autofocus>
       <button class="btn primary wide">Save</button></form><p class="note" style="margin-top:12px">Only shown on this device.</p>`,
      { label: 'Change name' },
    );
    s.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (s.querySelector<HTMLInputElement>('#nm')!.value || '').trim().slice(0, 24);
      if (v) { save.name = v; ctx.persist(); }
      close();
      ctx.rerender();
    });
  });

  root.querySelector('[data-howto]')!.addEventListener('click', () => showHowTo());

  root.querySelector('[data-backup]')!.addEventListener('click', () => {
    const code = exportSave(save);
    const { root: s } = sheet(
      `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button><h2>Back up progress</h2>
       <p class="note" style="margin:10px 0 14px">Progress lives on this device. Keep this code somewhere safe to restore it on another device.</p>
       <textarea readonly aria-label="Backup code">${esc(code)}</textarea><button class="btn primary wide" data-copy style="margin-top:14px">Copy code</button>`,
      { label: 'Back up progress' },
    );
    s.querySelector('[data-copy]')!.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); toast('Backup copied'); }
      catch { s.querySelector('textarea')!.select(); toast('Select the code and copy it'); }
    });
  });

  root.querySelector('[data-restore]')!.addEventListener('click', () => {
    const { root: s, close } = sheet(
      `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button><h2>Restore progress</h2>
       <p class="note" style="margin:10px 0 14px">Paste a backup code. This replaces the progress on this device.</p>
       <textarea aria-label="Backup code" data-code autofocus></textarea><button class="btn primary wide" data-go style="margin-top:14px">Restore</button>`,
      { label: 'Restore progress' },
    );
    s.querySelector('[data-go]')!.addEventListener('click', () => {
      const next = importSave(s.querySelector<HTMLTextAreaElement>('[data-code]')!.value.trim());
      if (!next) return toast('That code doesn’t look right');
      Object.assign(save, next);
      ctx.persist();
      close();
      toast('Progress restored');
      ctx.rerender();
    });
  });

  root.querySelector('[data-reset]')!.addEventListener('click', () => {
    const { root: s, close } = sheet(
      `<h2>Reset all progress?</h2><p class="note" style="margin:10px 0 20px">Your Logbook, records and streak will be deleted from this device. This can’t be undone.</p>
       <div class="actions" style="margin-top:0"><button class="btn secondary" data-close autofocus>Keep it</button><button class="btn primary" data-yes style="background:var(--coral)">Reset</button></div>`,
      { label: 'Reset all progress' },
    );
    s.querySelector('[data-yes]')!.addEventListener('click', () => {
      clearSave();
      Object.assign(save, loadSave(now()), { onboarded: true });
      ctx.persist();
      close();
      toast('Progress reset');
      ctx.go('home');
    });
  });

  root.querySelector('[data-signout]')?.addEventListener('click', () => { signOut(); location.reload(); });
  root.querySelector<HTMLFormElement>('[data-signin]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = root.querySelector<HTMLInputElement>('#em')!.value.trim();
    try { await sendMagicLink(em); toast('Check your inbox for the link'); }
    catch { toast('Couldn’t send the link. Try again.'); }
  });
}
