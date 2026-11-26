# Decisions superseded — web2-lab

<!-- graffino-agentic:begin v1 -->
> Decisions that no longer apply. **Never obeyed**; read only to explain old code or a
> past choice. Each points to the entry that replaced it. `ledger-lint.py --fix`
> keeps this file in sync: superseded entries move here from `DECISIONS.md`, and
> their index lines move here from its index.
<!-- graffino-agentic:end -->

## Index
- D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă · _superseded-by D-011_
- D-012 · P1: SDK-ul din sursă, cheia dintr-un fișier ignorat de git, track doar la rezervare validă · _superseded-by D-015_

---

## D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă
- **Status:** superseded-by D-011
- **Rule:** `init({ sdkKey, baseUrl, config? })` întoarce sincron un client `{ sdkKey,
  identify(userId, attributes), isEnabled(flagKey), getVariant(flagKey), refresh() }`; starea
  stă în client, nu în modul. Un `config` dat la `init` care nu trece validarea C-001 aruncă
  `TypeError`; fără `config`, fiecare flag e necunoscut până la prima configurație validă.
  `refresh()` cere configurația de la server (C-002, D-003) și întoarce un Promise cu
  `'updated' | 'not-modified' | 'rejected' | 'error'`, fără să fie respins vreodată; o
  configurație acceptată o înlocuiește pe cea veche dintr-o dată; la `'rejected'` sau
  `'error'` rămâne ultima configurație validă. `identify` cu un `userId` care nu e string
  aruncă `TypeError`. Citirile nu aruncă:
  un flag necunoscut (doar chei proprii ale `flags`) dă `isEnabled` → `false` și
  `getVariant` → `null`; înainte de `identify` un flag servește `default`; o regulă pe un
  atribut lipsă sau cu operator necunoscut nu se potrivește; `equals` e `===`.
  `isEnabled` = valoarea `=== true`; `getVariant` întoarce valoarea pentru orice tip de flag.
  Evaluarea e funcția pură `evaluate(flagKey, flag, user)` din `sdk/src/evaluate.js`;
  validarea e funcția pură `isValidConfig(config)` din `sdk/src/validate.js`.
- **Why:** un client per `init` izolează testele și se mapează direct pe un viitor
  `window.FF` (Q-026); o aplicație nu trebuie să cadă din cauza unui flag lipsă sau a unei
  configurații stricate. SSE și polling-ul (planuri ulterioare) vor apela `refresh()`.
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25; user,
  plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25.

## D-012 · P1: SDK-ul din sursă, cheia dintr-un fișier ignorat de git, track doar la rezervare validă
- **Status:** superseded-by D-015
- **Rule:** `p1/` importă `../sdk/src/index.js` ca modul ES și e servit de un server static
  (local, legat la `127.0.0.1`). Cheia SDK (prod) și `baseUrl` stau în `p1/config.js`, ignorat
  de git; `p1/config.example.js` e în repo. P1 apelează `track("reserve_click")` doar la o
  rezervare validă (un loc liber ales), niciodată la un click invalid.
- **Why:** P1 e HTML static fără bundler (D-002), iar tarball-ul `npm pack` (D-007) nu se poate
  importa direct dintr-o pagină; cheia e creată de seed per bază de date, deci nu se scrie în
  repo; metrica numără rezervări, nu click-uri greșite.
- **Evidence:** user, plan „P1, the parking page (DS-web2-parking)”, 2026-11-25. D-007 rămâne
  calea prin care alte aplicații primesc SDK-ul.
