// DS-web2-experiment: the results of the open project's experiments in one environment
// (C-007, D-001, D-021). Read only. The copy comes from results.js; everything is built
// with DOM nodes and textContent, never from HTML strings, so a flag key, metric or
// variant cannot inject markup.
import { createApi } from './api.js';
import {
  percent,
  pp,
  ciText,
  pText,
  valueText,
  convertedText,
  sampleText,
  barWidth,
  experimentVerdict,
  badge,
  resultCell,
  metaParts,
  summary,
  methodText,
  footerText,
  emptyTitle,
} from './results.js';

const $ = (id) => document.getElementById(id);
let env = 'prod'; // the mock opens on prod, where the real experiment runs
let loadedOnce = false;

// A 401 on the first load means "not logged in"; later, the session expired.
const api = createApi({
  onUnauthorized: () => location.assign(loadedOnce ? 'login.html?expired=1' : 'login.html'),
});

// el('td', { 'data-label': 'p' }, '0,031'); children are nodes or strings.
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'onclick') node.addEventListener('click', value);
    else node.setAttribute(name, value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

// Copy parts (results.js): strings, and { code } in <code>.
const parts = (list) => (Array.isArray(list) ? list : [list]).map((p) => (typeof p === 'string' ? p : el('code', {}, p.code)));
const icon = (symbol) => el('span', { 'aria-hidden': 'true' }, symbol);

// --- one experiment -------------------------------------------------------------------

function tile(experiment, variant) {
  const isControl = valueText(variant.value) === valueText(experiment.control);
  const bar = el('div', { class: `bar${variant.exposed >= experiment.minSample ? ' full' : ''}`, 'aria-hidden': 'true' }, el('span'));
  bar.firstChild.style.width = `${barWidth(variant.exposed, experiment.minSample)}%`;
  return el('div', { class: 'tile' },
    el('div', { class: 'tile-head' }, el('code', {}, valueText(variant.value)), isControl ? el('span', { class: 'tag' }, 'control') : null),
    variant.rate === null ? el('div', { class: 'stat', 'aria-label': 'fără rată' }, '—') : el('div', { class: 'stat' }, percent(variant.rate)),
    el('div', { class: 'sm muted' }, convertedText(variant)),
    bar,
    el('div', { class: 'sm muted' }, sampleText(variant.exposed, experiment.minSample)));
}

function comparisonTable(experiment) {
  const rows = experiment.comparisons.map((c) => {
    const result = resultCell(c);
    return el('tr', {},
      el('td', {}, el('code', {}, valueText(c.variant))),
      el('td', { 'data-label': 'Diferență' }, pp(c.difference)),
      el('td', { 'data-label': 'IC 95%' }, ciText(c.ci)),
      el('td', { 'data-label': 'p' }, pText(c.pValue)),
      el('td', { 'data-label': 'Eșantion minim' }, c.minSampleReached ? 'atins' : 'neatins'),
      el('td', { 'data-label': 'Rezultat' }, el('span', { class: `res ${result.kind}` }, icon(result.icon), ` ${result.text}`)));
  });
  const head = ['Variantă', 'Diferență față de control', 'IC 95%', 'p', 'Eșantion minim', 'Rezultat'].map((t) => el('th', {}, t));
  return el('div', { class: 'table-wrap' },
    el('table', {}, el('caption', { class: 'sr' }, 'Fiecare variantă față de control'), el('thead', {}, el('tr', {}, ...head)), el('tbody', {}, ...rows)));
}

function card(experiment, index) {
  const b = badge(experimentVerdict(experiment));
  const s = summary(experiment);
  const titleId = `experiment-${index}`;
  return el('section', { class: 'card exp', 'aria-labelledby': titleId },
    el('div', { class: 'exp-head' },
      el('div', {}, el('h2', { id: titleId }, el('code', {}, experiment.flagKey)), el('div', { class: 'sm muted' }, ...parts(metaParts(experiment)))),
      el('span', { class: `badge ${b.kind}` }, icon(b.icon), ` ${b.text}`)),
    el('div', { class: 'exp-body' },
      el('div', { class: 'tiles' }, ...experiment.variants.map((v) => tile(experiment, v))),
      el('div', { class: `notice ${s.kind}`, role: 'status' },
        el('span', { class: 'icon', 'aria-hidden': 'true' }, s.icon),
        el('div', {}, el('strong', {}, s.title), ' ', ...parts(s.body))),
      experiment.comparisons.length > 0 ? comparisonTable(experiment) : null,
      el('p', { class: 'method sm muted' }, methodText(experiment))));
}

// --- states ------------------------------------------------------------------------------

function showLoading() {
  const bar = (width, height) => {
    const node = el('div', { class: 'bone' });
    node.style.width = `${width}%`;
    if (height) node.style.height = height;
    return node;
  };
  const skeletonTile = () => el('div', { class: 'tile' }, bar(30), bar(50, 'var(--space-8)'), bar(80), bar(100));
  $('content').replaceChildren(
    el('section', { class: 'card exp skeleton', 'aria-busy': 'true', 'aria-label': 'Se încarcă rezultatele' },
      el('div', { class: 'exp-head' }, el('div', { class: 'grow' }, bar(30), bar(55))),
      el('div', { class: 'exp-body' }, el('div', { class: 'tiles' }, skeletonTile(), skeletonTile()), bar(100, 'var(--space-8)'), bar(100, 'calc(var(--space-8) * 2)'))),
  );
  $('footer').hidden = true;
}

function showLoadError() {
  $('content').replaceChildren(
    el('div', { class: 'notice error', role: 'alert' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '!'),
      el('div', {}, el('strong', {}, 'Nu am putut încărca rezultatele.'), ' Serverul nu răspunde. Verifică conexiunea și încearcă din nou.',
        el('div', { class: 'notice-actions' }, el('button', { class: 'btn', type: 'button', onclick: load }, 'Încearcă din nou')))),
  );
  $('footer').hidden = true;
}

function showEmpty() {
  $('content').replaceChildren(
    el('div', { class: 'card empty' },
      el('h2', {}, emptyTitle(env)),
      el('p', { class: 'muted' }, 'Un experiment compară variantele unui flag pe o metrică. Aici vei vedea, pentru fiecare variantă, utilizatorii expuși, conversiile și rata, cu intervalul de încredere și semnificația.'),
      el('p', { class: 'sm muted' }, 'Experimentele se adaugă deocamdată cu seed-ul.')),
  );
  $('footer').hidden = true;
}

function showResults(experiments) {
  if (experiments.length === 0) return showEmpty();
  $('content').replaceChildren(...experiments.map(card));
  $('footer').textContent = footerText(experiments.length, env);
  $('footer').hidden = false;
}

// --- load ------------------------------------------------------------------------------

async function load() {
  const requested = env;
  showLoading();
  const result = await api.listExperiments(requested);
  if (requested !== env) return; // the admin switched environment meanwhile
  if (!result.ok) {
    if (result.error !== 'unauthorized') showLoadError();
    return;
  }
  loadedOnce = true;
  $('project').textContent = `Proiect: ${result.data.project.name}`;
  showResults(result.data.experiments);
}

// --- environment and logout --------------------------------------------------------------

for (const button of document.querySelectorAll('.seg button')) {
  button.addEventListener('click', () => {
    if (button.dataset.env === env) return;
    env = button.dataset.env;
    for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b === button));
    load();
  });
}

$('logout').addEventListener('click', async () => {
  await api.logout();
  location.assign('login.html');
});

load();
