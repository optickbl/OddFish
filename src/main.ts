import './styles.css';
import { now, syncClock } from './core/clock';
import { forfeitRest } from './core/game';
import { dayNumber } from './core/schedule';
import { getEngine } from './services/engine';
import { loadSave, persist } from './services/storage';
import { captureSessionFromUrl } from './services/supabase';
import { ICON } from './ui/art';
import type { Ctx, Route } from './ui/ctx';
import { reducedMotion, toast } from './ui/dom';
import { setHaptics, setSound } from './ui/feedback';
import { finalizeCast, renderCast } from './ui/views/cast';
import { renderHome } from './ui/views/home';
import { renderLogbook } from './ui/views/logbook';
import { renderProfile } from './ui/views/profile';
import { renderRecords } from './ui/views/records';
import { renderResults } from './ui/views/results';
import { bootSea, seaOff, seaReduced } from './ui/sea';

const ROUTES: Route[] = ['home', 'cast', 'results', 'logbook', 'records', 'profile'];
const TABS: { r: Route; label: string; icon: string }[] = [
  { r: 'home', label: 'Home', icon: ICON.home },
  { r: 'logbook', label: 'Logbook', icon: ICON.book },
  { r: 'records', label: 'Records', icon: ICON.trophy },
  { r: 'profile', label: 'Profile', icon: ICON.user },
];

captureSessionFromUrl();
const root = document.getElementById('root')!;
const save = loadSave(Date.now());
let leaveFns: (() => void)[] = [];
let warnedStorage = false;

const ctx: Ctx = {
  save,
  today() {
    const d = Math.max(dayNumber(now()), save.maxDaySeen, 1);
    if (d > save.maxDaySeen) {
      save.maxDaySeen = d;
      ctx.persist();
    }
    return d;
  },
  engine: getEngine(),
  persist() {
    if (!persist(save) && !warnedStorage) {
      warnedStorage = true;
      toast('Progress can’t be saved in this browser mode');
    }
  },
  go(r) {
    if (location.hash !== `#${r}`) location.hash = r;
    else render();
  },
  rerender: () => render(),
  reduced: () => reducedMotion(save.settings.motion),
  onLeave: (fn) => leaveFns.push(fn),
};

function currentRoute(): Route {
  const h = location.hash.replace(/^#/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

function navHtml(active: Route) {
  return `<nav class="nav" aria-label="Main"><ul>${TABS.map((t) => `<li><a href="#${t.r}" ${t.r === active ? 'aria-current="page"' : ''}>${t.icon}<span>${t.label}</span></a></li>`).join('')}</ul></nav>`;
}

/** A cast left over from a previous day keeps its catches; unanswered questions become boots. */
function closeStaleCast() {
  const c = save.current;
  if (c && c.day < ctx.today()) {
    finalizeCast(ctx, forfeitRest(c, now()));
  }
}

function render() {
  leaveFns.forEach((f) => { try { f(); } catch { /* ignore */ } });
  leaveFns = [];
  closeStaleCast();
  const route = currentRoute();
  document.documentElement.classList.toggle('reduce', ctx.reduced());
  // Screens without a sea moment switch the 3D off; the others ask for it while rendering.
  seaOff();
  seaReduced(ctx.reduced());
  root.classList.toggle('wide', route === 'logbook');
  const view = document.createElement('div');
  view.style.display = 'contents';
  try {
    ({ home: renderHome, cast: renderCast, results: renderResults, logbook: renderLogbook, records: renderRecords, profile: renderProfile })[route](ctx, view);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<main id="main" class="view full"><div class="err" role="alert"><h2>Something snagged</h2><p>The Captain dropped the net. Your progress is safe.</p><button class="btn primary" data-reload>Reload</button></div></main>`;
    view.querySelector('[data-reload]')!.addEventListener('click', () => location.reload());
  }
  // A view can redirect while rendering; only mount if the route still matches.
  if (currentRoute() !== route) return;
  root.replaceChildren(view);
  if (route !== 'cast') root.insertAdjacentHTML('beforeend', navHtml(route));
  const title = { home: 'Oddfish', cast: 'Daily Cast · Oddfish', results: 'Your haul · Oddfish', logbook: 'Logbook · Oddfish', records: 'Records · Oddfish', profile: 'Profile · Oddfish' }[route];
  document.title = title;
  window.scrollTo(0, 0);
}

setSound(save.settings.sound);
setHaptics(save.settings.haptics);
window.addEventListener('hashchange', render);
render();

// The 3D sea loads after the first screen is up, so it never delays playing.
const startSea = () => bootSea(ctx.reduced());
if (document.readyState === 'complete') setTimeout(startSea, 50);
else window.addEventListener('load', () => setTimeout(startSea, 50), { once: true });

// Trust the server's clock for the daily reset where possible.
void syncClock(`${import.meta.env.BASE_URL}version.json`).then((ok) => {
  if (ok && currentRoute() !== 'cast') render();
});

// Start audio on the first gesture (browsers block it before then).
window.addEventListener('pointerdown', () => setSound(save.settings.sound), { once: true });
