// DS-web2-audit: every change made from the dashboard in one environment of the open
// project, newest first, 50 a page with "Mai vechi" (C-007 GET /admin/audit), filtered by
// flag on the server. Read only. The copy comes from audit-text.js; everything is built
// with DOM nodes and textContent, never from HTML strings, so a flag key or a stored value
// cannot inject markup.
import { createApi } from './api.js';
import {
  actionLabel,
  stateParts,
  timeText,
  versionText,
  subtitleText,
  captionText,
  footerParts,
  emptyTitleParts,
} from './audit-text.js';

const $ = (id) => document.getElementById(id);
let env = 'prod'; // the mock opens on prod, like the other screens
let flag = null; // the flag filter, or null for all flags
let shown = 0; // rows on screen
let pages = 0; // pages loaded
let nextBefore = null; // the cursor of the next (older) page
let view = 0; // bumped at every new list, so a late answer to an older one is dropped
let loadedOnce = false;

// A 401 on the first load means "not logged in"; later, the session expired.
const api = createApi({
  onUnauthorized: () => location.assign(loadedOnce ? 'login.html?expired=1' : 'login.html'),
});

// el('td', { 'data-label': 'Flag' }, …); children are nodes or strings.
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'onclick') node.addEventListener('click', value);
    else node.setAttribute(name, value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

// Copy parts (audit-text.js): strings, and { code } in <code>.
const parts = (list) => list.map((p) => (typeof p === 'string' ? p : el('code', {}, p.code)));
const HEADINGS = ['Ora', 'Flag', 'Acțiune', 'Înainte → după', 'Versiunea configurației'];

// --- rows -------------------------------------------------------------------------------

function row(entry) {
  const action = actionLabel(entry.action);
  return el('tr', {},
    el('td', { class: 'when' }, el('time', { datetime: entry.at, title: entry.at }, timeText(entry.at))),
    el('td', { 'data-label': 'Flag' }, el('code', {}, entry.flagKey)),
    el('td', { 'data-label': 'Acțiune' },
      el('span', { class: `act ${action.kind}`.trim() }, action.icon ? el('span', { 'aria-hidden': 'true' }, action.icon) : null, ` ${action.text}`)),
    el('td', { 'data-label': 'Înainte → după' },
      el('span', { class: 'change' },
        el('span', {}, ...parts(stateParts(entry.action, entry.before))),
        el('span', { 'aria-hidden': 'true' }, '→'),
        el('span', { class: 'sr' }, 'devine'),
        el('span', {}, ...parts(stateParts(entry.action, entry.after))))),
    el('td', { 'data-label': 'Versiunea configurației' }, versionText(entry.configVersion)));
}

const skeletonRows = (n) =>
  el('tbody', { class: 'skeleton', 'aria-busy': 'true', 'aria-label': n === 3 ? 'Se încarcă jurnalul' : 'Se încarcă schimbările mai vechi' },
    ...Array.from({ length: n }, () =>
      el('tr', {}, ...[80, 60, 50, 70, 30].map((width) => {
        const bone = el('div');
        bone.style.width = `${width}%`;
        return el('td', {}, bone);
      }))));

function table(caption, body) {
  return el('div', { class: 'card audit' },
    el('table', {},
      caption === null ? null : el('caption', { class: 'sr' }, caption),
      el('thead', {}, el('tr', {}, ...HEADINGS.map((t) => el('th', {}, t)))),
      body));
}

// --- states ------------------------------------------------------------------------------

function showLoading() {
  $('content').replaceChildren(table(null, skeletonRows(3)));
  $('more').hidden = true;
}

function showLoadError() {
  $('content').replaceChildren(
    el('div', { class: 'notice error', role: 'alert' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '!'),
      el('div', {}, el('strong', {}, 'Nu am putut încărca jurnalul.'), ' Serverul nu răspunde. Verifică conexiunea și încearcă din nou.',
        el('div', { class: 'notice-actions' }, el('button', { class: 'btn', type: 'button', onclick: load }, 'Încearcă din nou')))),
  );
  $('more').hidden = true;
}

function showEmpty() {
  const card = flag === null
    ? el('div', { class: 'card empty' },
      el('h2', {}, ...parts(emptyTitleParts(env, null))),
      el('p', { class: 'muted' }, 'Aici apare fiecare pornire, oprire și schimbare de rollout făcută din dashboard, cu ora, valoarea dinainte și de după și versiunea configurației pe care a creat-o.'),
      el('p', { class: 'sm muted' }, el('a', { href: './' }, 'Mergi la flag-uri'), ' ca să faci o schimbare.'))
    : el('div', { class: 'card empty' },
      el('h2', {}, ...parts(emptyTitleParts(env, flag))),
      el('p', { class: 'muted' }, 'Flag-ul n-a fost pornit, oprit sau schimbat din dashboard în acest mediu.'),
      el('p', {}, el('button', { class: 'btn', type: 'button', onclick: () => setFlag(null) }, 'Arată toate flag-urile')));
  $('content').replaceChildren(card);
  $('more').hidden = true;
}

// The footer line, and "Mai vechi" while an older page exists; an error while loading it
// keeps the rows and offers a retry.
function showMore({ loading = false, error = false } = {}) {
  const footer = el('p', { class: 'sm muted' }, ...parts(footerParts({ count: shown, env, flag, more: nextBefore !== null, pages })));
  const children = [];
  if (error) {
    children.push(el('div', { class: 'notice error', role: 'alert' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '!'),
      el('div', {}, el('strong', {}, 'Nu am putut încărca schimbările mai vechi.'), ' Cele de mai sus rămân. Verifică conexiunea și încearcă din nou.',
        el('div', { class: 'notice-actions' }, el('button', { class: 'btn', type: 'button', onclick: loadMore }, 'Încearcă din nou')))));
  }
  children.push(footer);
  if (nextBefore !== null && !error) {
    children.push(loading
      ? el('button', { class: 'btn', type: 'button', disabled: '', 'aria-busy': 'true' }, 'Se încarcă…')
      : el('button', { class: 'btn', type: 'button', onclick: loadMore }, 'Mai vechi'));
  }
  $('more').replaceChildren(...children);
  $('more').hidden = false;
}

// The flag select: "Toate flag-urile" and the environment's flags, by key.
function fillFlags(flags) {
  const select = $('flag');
  select.replaceChildren(el('option', { value: '' }, 'Toate flag-urile'), ...flags.map((f) => el('option', { value: f.key }, f.key)));
  select.value = flag ?? '';
}

// --- load ------------------------------------------------------------------------------

async function load() {
  const current = ++view;
  showLoading();
  const [audit, flags] = await Promise.all([api.listAudit(env, { flag }), api.listFlags(env)]);
  if (current !== view) return; // the admin changed environment or filter meanwhile
  if (!audit.ok || !flags.ok) {
    if (audit.error !== 'unauthorized' && flags.error !== 'unauthorized') showLoadError();
    return;
  }
  loadedOnce = true;
  $('project').textContent = subtitleText(audit.data.project.name);
  fillFlags(flags.data.flags);
  shown = audit.data.entries.length;
  pages = 1;
  nextBefore = audit.data.nextBefore;
  if (shown === 0) return showEmpty();
  $('content').replaceChildren(table(captionText(env, flag), el('tbody', { id: 'rows' }, ...audit.data.entries.map(row))));
  showMore();
}

async function loadMore() {
  const current = view;
  const skeleton = skeletonRows(2);
  $('rows').after(skeleton);
  showMore({ loading: true });
  const result = await api.listAudit(env, { flag, before: nextBefore });
  if (current !== view) return;
  skeleton.remove();
  if (!result.ok) {
    if (result.error !== 'unauthorized') showMore({ error: true });
    return;
  }
  $('rows').append(...result.data.entries.map(row));
  shown += result.data.entries.length;
  pages += 1;
  nextBefore = result.data.nextBefore;
  showMore();
}

// --- environment, filter and logout -------------------------------------------------------

function setFlag(key) {
  flag = key;
  $('flag').value = key ?? '';
  load();
}

// A new environment starts on all flags: its flag list is loaded with it.
for (const button of document.querySelectorAll('.seg button')) {
  button.addEventListener('click', () => {
    if (button.dataset.env === env) return;
    env = button.dataset.env;
    flag = null;
    for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b === button));
    load();
  });
}

$('flag').addEventListener('change', (e) => setFlag(e.target.value === '' ? null : e.target.value));

$('logout').addEventListener('click', async () => {
  await api.logout();
  location.assign('login.html');
});

load();
