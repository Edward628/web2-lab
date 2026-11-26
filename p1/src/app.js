// DS-web2-parking: the parking page that runs the reserve-button-color experiment
// (D-006, D-015). Config → anonymous user → SDK → one variant read, waiting at most
// 5 s for the configuration (D-013) → the list.
// Without p1/config.js the page shows the control and logs why.

import { init } from '../../sdk/src/index.js';
import { getUserId } from './user-id.js';
import { SPOTS, loadReservation, reserve, cancel } from './reservation.js';
import { firstVariant } from './variant.js';

const FLAG_KEY = 'reserve-button-color';

function localStorageOrNull() {
  try {
    return globalThis.localStorage;
  } catch {
    return null; // access itself throws when storage is blocked
  }
}

async function loadConfig() {
  try {
    return await import('../config.js');
  } catch (err) {
    console.error('P1: p1/config.js is missing or broken; copy p1/config.example.js, or set P1_SDK_KEY on the server (D-015). Showing the control.', err);
    return {};
  }
}

const $ = (id) => document.getElementById(id);
const storage = localStorageOrNull();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSpots() {
  const free = SPOTS.filter((s) => s.free).length;
  $('legend').textContent = `${free} libere din ${SPOTS.length}`;
  $('spots').replaceChildren(
    ...SPOTS.map((s) => {
      const label = el('label', `spot ${s.free ? 'free' : 'taken'}`);
      const input = el('input');
      Object.assign(input, { type: 'radio', name: 'spot', value: s.id, disabled: !s.free });
      const box = el('span', 'box');
      box.append(
        el('span', 'id', s.id), ' ',
        el('span', s.free ? 'sm muted' : 'sm', `· ${s.where}`),
      );
      const status = el('span', 'status sm');
      const icon = el('span', '', s.free ? '●' : '✕');
      icon.setAttribute('aria-hidden', 'true');
      status.append(icon, ` ${s.free ? 'Liber' : 'Ocupat'}`);
      box.append(status);
      label.append(input, box);
      return label;
    }),
  );
}

function showSuccess({ spotId, until }) {
  const spot = SPOTS.find((s) => s.id === spotId);
  const where = spot ? spot.where[0].toUpperCase() + spot.where.slice(1) : '';
  const time = new Date(until).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  $('success-title').textContent = `Locul ${spotId} e rezervat.`;
  $('success-detail').textContent = where ? `${where} · până la ${time}.` : `Până la ${time}.`;
  document.body.dataset.state = 'success';
}

function showList() {
  for (const input of $('spots').querySelectorAll('input')) input.checked = false;
  document.body.dataset.state = 'list';
}

const { sdkKey, baseUrl } = await loadConfig();
const ff = init({ sdkKey, baseUrl });
ff.identify(getUserId(storage));
document.body.dataset.variant = await firstVariant(ff, FLAG_KEY);

renderSpots();
$('spots').addEventListener('change', () => {
  if (document.body.dataset.state === 'invalid') document.body.dataset.state = 'list';
});
$('reserve').addEventListener('click', () => {
  const chosen = $('spots').querySelector('input:checked')?.value ?? null;
  const r = reserve(storage, chosen, ff.track);
  if (r === 'invalid') {
    document.body.dataset.state = 'invalid';
    return;
  }
  showSuccess(r);
  $('success').focus();
});
$('cancel').addEventListener('click', () => {
  cancel(storage);
  showList();
  $('spots').querySelector('input:not(:disabled)')?.focus();
});

const held = loadReservation(storage);
if (held) showSuccess(held);
else showList();
