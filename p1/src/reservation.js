// The simulated parking lot (D-006): six fixed spots, one reservation held for an
// hour in localStorage (kept across reloads). Only a valid reservation is tracked
// (D-015). The experiment's variant maps to a button color; anything but 'green'
// is the control.

export const SPOTS = [
  { id: 'A12', where: 'etaj 1', free: true },
  { id: 'A13', where: 'etaj 1', free: false },
  { id: 'B03', where: 'etaj 2', free: true },
  { id: 'B04', where: 'etaj 2', free: false },
  { id: 'C01-ELECTRIC-INCARCARE-RAPIDA', where: 'subsol, lângă lift', free: true },
  { id: 'C02', where: 'subsol', free: false },
];

const KEY = 'p1.reservation';
const HOLD_MS = 60 * 60 * 1000;
const METRIC = 'reserve_click';

// → { spotId, until } or null (nothing stored, unreadable, expired or blocked).
export function loadReservation(storage, now = Date.now()) {
  let r;
  try {
    r = JSON.parse(storage?.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  if (typeof r?.spotId !== 'string' || typeof r.until !== 'number') return null;
  if (r.until <= now) {
    cancel(storage);
    return null;
  }
  return { spotId: r.spotId, until: r.until };
}

// → 'invalid' (no free spot chosen; nothing stored or tracked) or { spotId, until }.
export function reserve(storage, spotId, track, now = Date.now()) {
  if (!SPOTS.some((s) => s.id === spotId && s.free)) return 'invalid';
  const r = { spotId, until: now + HOLD_MS };
  try {
    storage?.setItem(KEY, JSON.stringify(r));
  } catch {
    // storage blocked: the reservation lasts for this page load
  }
  track(METRIC);
  return r;
}

export function cancel(storage) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // storage blocked: nothing was kept
  }
}

export const variantOf = (value) => (value === 'green' ? 'green' : 'blue');
