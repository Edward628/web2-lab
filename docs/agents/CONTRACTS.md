# Contracts — web2-lab

<!-- graffino-agentic:begin v1 -->
> Promises across a boundary. **Provided:** this repo owns the contract; the text
> lives here only. **Consumed:** a link to the provider's entry plus the fields this
> repo relies on. **External:** what we rely on from a third-party service.
> Changing a provided contract is a PROPOSAL (AGENTS.md → The gate) and the plan
> lists the consumers' files too. Status: `approved` · `proposed` · `superseded-by`.
<!-- graffino-agentic:end -->

## Index
- C-001 · Configurația unui mediu (JSON servit SDK-ului) · provided
- C-002 · Endpoint-ul configurației pentru SDK · provided

---

## Provided

### C-001 · Configurația unui mediu (JSON servit SDK-ului)
- **Status:** approved
- **Interface:** `{version, flags}` (D-003); `flags` e un obiect cheiat după `flag_key`:
  ```json
  { "version": 7,
    "flags": {
      "<flag_key>": {
        "type": "boolean" | "multivariate",
        "enabled": true,
        "default": <valoare>,
        "rules": [ { "attribute": "<nume>", "operator": "equals", "value": <v>, "serve": <valoare> },
                   { "attribute": "<nume>", "operator": "in", "values": [<v>, ...], "serve": <valoare> } ],
        "variants": [ { "value": <valoare>, "from": 0, "to": 50 } ] } } }
  ```
  Un flag oprit servește `default`. Regulile se evaluează în ordine; prima potrivită servește
  `serve`. Apoi varianta cu `from ≤ bucket < to` (bucket D-004); un bucket neacoperit servește
  `default`. Un flag boolean cu rollout N% = `variants: [{value: true, from: 0, to: N}]`,
  `default: false`, deci o singură cale de evaluare pentru ambele tipuri.
  **Validă când:** `version` e un număr finit; `flags` e un obiect (nu `null`, nu array);
  fiecare flag e un obiect cu `rules` și `variants` array-uri (obligatorii); fiecare regulă
  și fiecare variantă e un obiect; fiecare `from` și `to` e un număr finit. O configurație
  invalidă e respinsă întreagă și rămâne ultima validă (`sdk/src/validate.js`).
- **Provider:** `server/src/config.js` (construiește configurația din PostgreSQL, D-010) și
  `server/src/app.js` (o servește prin C-002, doar dacă trece `isValidConfig`); configurația
  se poate da și direct la `init` (D-009).
- **Consumers:** `sdk/src/validate.js`, `sdk/src/evaluate.js`, `sdk/src/index.js`; în viitor
  `dashboard/` (scrie flag-urile pe care serverul le servește în această formă).
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25; user,
  plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25.
- **Confirmed:** 2026-11-25

### C-002 · Endpoint-ul configurației pentru SDK
- **Status:** approved
- **Interface:** `GET {baseUrl}/sdk/config?key=<cheia SDK, URL-encoded>`.
  `200` → configurația mediului cheii (C-001) ca JSON, cu header-ul `ETag` = `"<version>"`
  (forma tare, între ghilimele; D-003, D-010). O cerere cu `If-None-Match` egal exact cu
  ETag-ul curent → `304`, fără corp. Fără `key` (sau gol) → `400`; o cheie necunoscută →
  `404`. O configurație stocată care nu trece validarea C-001 nu e servită niciodată: `500`,
  fără corp, iar serverul o scrie în log. CORS: fiecare răspuns are
  `Access-Control-Allow-Origin: *` și `Access-Control-Expose-Headers: ETag`; preflight-ul
  `OPTIONS` → `204` cu `Access-Control-Allow-Methods: GET` și
  `Access-Control-Allow-Headers: If-None-Match`. SDK-ul trimite înapoi ETag-ul exact cum l-a
  primit; orice alt status sau o eroare de rețea e `'error'` în SDK. Cheia stă în URL ca să
  meargă la fel și pentru SSE (`EventSource` nu poate trimite header-e); cheia SDK e oricum
  publică în browser, deci se stochează în clar.
- **Provider:** `server/src/app.js`, `server/src/config.js`.
- **Consumers:** `sdk/src/index.js` (`refresh()`).
- **Evidence:** user, plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25;
  user, plan „Server: docker-compose, schema și GET /sdk/config”, 2026-11-25 (400/404/500,
  CORS, forma ETag-ului).
- **Confirmed:** 2026-11-25

## Consumed
None yet.

## External
None yet.
