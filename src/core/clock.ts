/**
 * Trusted time. The daily reset is global (00:00 UTC), so the game reads time from the
 * web server's Date header where it can, instead of trusting the device clock.
 */
let offsetMs = 0;
let synced = false;

export const now = (): number => Date.now() + offsetMs;
export const isSynced = () => synced;

export async function syncClock(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${t0}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    const t1 = Date.now();
    clearTimeout(timer);
    const header = res.headers.get('date');
    if (!header) return false;
    const server = Date.parse(header);
    if (Number.isNaN(server)) return false;
    // The Date header has 1 s resolution; only correct clocks that are clearly off.
    const estimate = server + 500 - (t0 + t1) / 2;
    if (Math.abs(estimate) > 5000) offsetMs = estimate;
    synced = true;
    return true;
  } catch {
    return false;
  }
}

/** Test helper. */
export function _setOffset(ms: number) {
  offsetMs = ms;
}
