# Decisions superseded — web2-lab

<!-- graffino-agentic:begin v1 -->
> Decisions that no longer apply. **Never obeyed**; read only to explain old code or a
> past choice. Each points to the entry that replaced it. `ledger-lint.py --fix`
> keeps this file in sync: superseded entries move here from `DECISIONS.md`, and
> their index lines move here from its index.
<!-- graffino-agentic:end -->

## Index
- D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă · _superseded-by D-011_

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
