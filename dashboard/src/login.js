// DS-web2-login: one password field (one admin, D-008). Each answer of POST
// /admin/login (C-007) shows one state of the mock; 204 goes to the flags screen.
import { createApi } from './api.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
const input = $('password');
const submit = $('submit');
const notices = ['expired', 'limited', 'unconfigured', 'error'];

// The flags screen sends the admin here with ?expired=1 after a 401 (C-007).
$('expired').hidden = new URLSearchParams(location.search).get('expired') !== '1';

const api = createApi({ onUnauthorized() {} });

function show({ notice = null, wrong = false, busy = false, disabled = false }) {
  for (const id of notices) $(id).hidden = id !== notice;
  $('wrong').hidden = !wrong;
  if (wrong) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'wrong');
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  input.disabled = busy || disabled;
  submit.disabled = busy || disabled;
  submit.textContent = busy ? 'Se verifică…' : 'Intră';
  form.setAttribute('aria-busy', String(busy));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  show({ busy: true });
  const outcome = await api.login(input.value);
  if (outcome === 'ok') {
    location.assign('./');
    return;
  }
  if (outcome === 'wrong') {
    show({ wrong: true });
    input.value = '';
    input.focus();
  } else if (outcome === 'unconfigured') {
    show({ notice: 'unconfigured', disabled: true });
  } else {
    show({ notice: outcome === 'limited' ? 'limited' : 'error' });
    input.focus();
  }
});

input.focus();
