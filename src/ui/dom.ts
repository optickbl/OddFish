export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtKg = (n: number) => `${fmtNum(n)} kg`;

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

export function qs<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
}

export function reducedMotion(setting: 'system' | 'reduced'): boolean {
  if (setting === 'reduced') return true;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Smoothly count a number up inside an element. */
export function countUp(el: HTMLElement, to: number, ms: number, format: (n: number) => string, reduced: boolean, onTick?: () => void) {
  if (reduced || ms <= 0) {
    el.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  let lastTick = -1;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = format(to * eased);
    const tick = Math.floor(k * 12);
    if (onTick && tick !== lastTick) { lastTick = tick; onTick(); }
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let toastTimer = 0;
export function toast(msg: string) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2200);
}

/** A bottom sheet dialog. Returns a close function. */
export function sheet(html: string, opts: { label: string; onClose?: () => void } ): { root: HTMLElement; close: () => void } {
  const prev = document.activeElement as HTMLElement | null;
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opts.label)}" tabindex="-1">${html}</div>`;
  document.body.appendChild(wrap);
  const panel = wrap.querySelector<HTMLElement>('.sheet')!;
  requestAnimationFrame(() => wrap.classList.add('open'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 260);
    opts.onClose?.();
    prev?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) close();
  });
  setTimeout(() => (panel.querySelector<HTMLElement>('[autofocus]') ?? panel).focus(), 30);
  return { root: panel, close };
}
