// DS-web2-flags: the flags of the open project in one environment (C-007), and the
// switch, which is the kill switch (D-004): in prod it asks first, in both directions.
// The copy comes from flags.js; everything is built with DOM nodes and textContent,
// never from HTML strings, so a flag key cannot inject markup.
import { createApi } from './api.js';
import {
  typeLabel,
  targetingSummary,
  needsConfirm,
  confirmCopy,
  successCopy,
  writeErrorCopy,
  undoOf,
  footerText,
  emptyTitle,
  badges,
} from './flags.js';

const $ = (id) => document.getElementById(id);
let env = 'prod'; // the mock opens on prod
let flags = []; // as listed by the server, in this environment
let version = null; // the environment's config_version, from the server
let loadedOnce = false;

// A 401 on the first load means "not logged in"; later, the session expired.
const api = createApi({
  onUnauthorized: () => location.assign(loadedOnce ? 'login.html?expired=1' : 'login.html'),
});

// el('td', { 'data-label': 'Tip' }, 'boolean'); children are nodes or strings.
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'onclick') node.addEventListener('click', value);
    else node.setAttribute(name, value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

// Copy parts (flags.js): strings, and { code } in <code>.
const parts = (list) => (Array.isArray(list) ? list : [list]).map((p) => (typeof p === 'string' ? p : el('code', {}, p.code)));

function setNotice(node = null) {
  $('notice').replaceChildren(...(node ? [node] : []));
}

function closeConfirm() {
  $('confirm').replaceChildren();
}

// --- states of the list -------------------------------------------------------------

const HEAD = () =>
  el('thead', {}, el('tr', {}, el('th', {}, 'Flag'), el('th', {}, 'Tip'), el('th', {}, 'Targetare'), el('th', {}, 'Stare'), el('th', {}, el('span', { class: 'sr' }, 'Acțiuni'))));

function showLoading() {
  const bar = (width) => el('div', { style: `width:${width}%` });
  const row = (a, b, c) => el('tr', {}, el('td', {}, bar(a), bar(b)), el('td', {}, bar(70)), el('td', {}, bar(c)), el('td', {}, bar(40)), el('td', {}, el('div')));
  $('content').replaceChildren(
    el('div', { class: 'card', 'aria-busy': 'true' },
      el('table', { class: 'skeleton', 'aria-label': 'Se încarcă flag-urile' }, HEAD(), el('tbody', {}, row(60, 85, 50), row(45, 75, 60), row(55, 65, 45)))),
  );
  $('footer').hidden = true;
}

function showLoadError() {
  $('content').replaceChildren(
    el('div', { class: 'notice error', role: 'alert' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '!'),
      el('div', {}, el('strong', {}, 'Nu am putut încărca flag-urile.'), ' Serverul nu răspunde. Verifică conexiunea și încearcă din nou.',
        el('div', { class: 'notice-actions' }, el('button', { class: 'btn', type: 'button', onclick: load }, 'Încearcă din nou')))),
  );
  $('footer').hidden = true;
}

function showEmpty() {
  $('content').replaceChildren(
    el('div', { class: 'card empty' },
      el('h2', {}, emptyTitle(env)),
      el('p', { class: 'muted' }, 'Un flag pornește sau oprește o funcție fără redeploy. Aici vei vedea starea, regulile și rollout-ul fiecărui flag.'),
      el('p', { class: 'sm muted' }, 'Flag-urile se adaugă deocamdată cu seed-ul.')),
  );
  $('footer').hidden = true;
}

function switchFor(flag, busy) {
  const state = flag.enabled ? 'Pornit' : 'Oprit';
  const button = el('button', {
    class: 'switch', role: 'switch', type: 'button', 'data-key': flag.key,
    'aria-checked': String(flag.enabled), 'aria-label': `${flag.key}: ${state}`,
  }, el('span', { class: 'track' }), state);
  if (busy) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  button.addEventListener('click', () => requestChange({ key: flag.key, env, enabled: !flag.enabled }, button));
  return button;
}

// Stale and 100% într-o direcție (D-022), under the flag name as in the mock; nothing when neither.
function badgesFor(flag) {
  const texts = badges(flag);
  return texts.length === 0 ? null : el('div', { class: 'tags' }, ...texts.map((t) => el('span', { class: 'tag warn' }, t)));
}

function showList(version, busyKey = null) {
  if (flags.length === 0) return showEmpty();
  const rows = flags.map((flag) =>
    el('tr', {},
      el('td', {}, el('div', { class: 'flagname' }, el('code', {}, flag.key)), badgesFor(flag)),
      el('td', { 'data-label': 'Tip' }, typeLabel(flag)),
      el('td', { 'data-label': 'Targetare' }, targetingSummary(flag)),
      el('td', { 'data-label': 'Stare' }, switchFor(flag, flag.key === busyKey)),
      el('td', {}, el('div', { class: 'actions' }))));
  $('content').replaceChildren(el('div', { class: 'card' }, el('table', {}, HEAD(), el('tbody', {}, ...rows))));
  $('footer').textContent = footerText(flags.length, env, version);
  $('footer').hidden = false;
}

const focusSwitch = (key) => document.querySelector(`.switch[data-key="${CSS.escape(key)}"]`)?.focus();

// --- load ---------------------------------------------------------------------------

async function load() {
  const requested = env;
  showLoading();
  const result = await api.listFlags(requested);
  if (requested !== env) return; // the admin switched environment meanwhile
  if (!result.ok) {
    if (result.error !== 'unauthorized') showLoadError();
    return;
  }
  loadedOnce = true;
  flags = result.data.flags;
  version = result.data.version;
  $('project').textContent = `Proiect: ${result.data.project.name}`;
  showList(version);
}

// --- the switch ---------------------------------------------------------------------

function requestChange(change, trigger) {
  const flag = flags.find((f) => f.key === change.key);
  if (!flag) return;
  if (!needsConfirm(change.env)) return apply(change);
  setNotice();
  const copy = confirmCopy(flag, change.enabled, change.env);
  const cancel = () => {
    closeConfirm();
    (trigger?.isConnected ? trigger : document.querySelector(`.switch[data-key="${CSS.escape(change.key)}"]`))?.focus();
  };
  const cancelButton = el('button', { class: 'btn', type: 'button', onclick: cancel }, 'Renunță');
  const dialog = el('div', { class: 'confirm', role: 'alertdialog', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-body' },
    el('h2', { id: 'confirm-title' }, ...parts(copy.title)),
    el('p', { id: 'confirm-body' }, ...parts(copy.body)),
    el('div', { class: 'row' },
      el('button', { class: `btn ${copy.danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => { closeConfirm(); apply(change); } }, copy.action),
      cancelButton));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') cancel();
  });
  $('confirm').replaceChildren(dialog);
  cancelButton.focus(); // the safe choice has the focus
}

async function apply(change) {
  setNotice();
  if (change.env === env) showList(version, change.key);
  const result = await api.setEnabled(change.key, change.env, change.enabled);
  if (result.error === 'unauthorized') return;
  if (change.env !== env) return; // the list on screen is another environment now
  if (!result.ok) {
    showList(version);
    const copy = writeErrorCopy(change.key, change.enabled, change.env);
    setNotice(el('div', { class: 'notice error', role: 'alert' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '!'),
      el('div', {}, el('strong', {}, ...parts(copy.title)), ' ', copy.body,
        el('div', { class: 'notice-actions' }, el('button', { class: 'btn', type: 'button', onclick: () => apply(change) }, 'Încearcă din nou')))));
    focusSwitch(change.key);
    return;
  }
  const updated = result.data.flag;
  flags = flags.map((f) => (f.key === updated.key ? updated : f));
  version = result.data.version;
  showList(version);
  const copy = successCopy(updated, change.env, version);
  // Undo is the reverse change, so in prod it asks again (D-004) and is audited.
  const undo = el('button', { class: 'btn undo', type: 'button', onclick: () => requestChange(undoOf(change)) }, 'Anulează');
  setNotice(el('div', { class: 'notice success', role: 'status' },
    el('span', { class: 'icon', 'aria-hidden': 'true' }, '✓'),
    el('div', {}, el('strong', {}, copy.title), ' ', ...parts(copy.body), undo)));
  focusSwitch(change.key);
}

// --- environment and logout ---------------------------------------------------------

for (const button of document.querySelectorAll('.seg button')) {
  button.addEventListener('click', () => {
    if (button.dataset.env === env) return;
    env = button.dataset.env;
    for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b === button));
    setNotice();
    closeConfirm();
    load();
  });
}

$('logout').addEventListener('click', async () => {
  await api.logout();
  location.assign('login.html');
});

load();
