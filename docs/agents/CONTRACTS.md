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
- C-003 · Endpoint-ul de evenimente pentru SDK · provided

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
        "variants": [ { "value": <valoare>, "from": 0, "to": 50 } ],
        "experiment": true } } }
  ```
  `experiment` e opțional: apare, cu valoarea `true`, doar când flag-ul are un experiment în
  mediul respectiv (tabelul `experiments`); lipsește în rest. Validarea nu îl verifică.
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
- **Consumers:** `sdk/src/validate.js`, `sdk/src/evaluate.js`, `sdk/src/index.js` (citește
  `experiment`, D-011); în viitor `dashboard/` (scrie flag-urile pe care serverul le servește în
  această formă).
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25; user,
  plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25; user, plan „Event
  ingest, SDK exposures, track and batching, ParkingLot seed”, 2026-11-25 (`experiment`).
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

### C-003 · Endpoint-ul de evenimente pentru SDK
- **Status:** approved
- **Interface:** `POST {baseUrl}/sdk/events?key=<cheia SDK, URL-encoded>`, cu
  `Content-Type: application/json` și corpul:
  ```json
  { "events": [
    { "id": "<1–64 caractere>", "type": "exposure",    "userId": "u", "flagKey": "f", "variant": <json> },
    { "id": "…",                "type": "conversion",  "userId": "u", "metric": "reserve_click" },
    { "id": "…",                "type": "evaluations", "counts": { "<flag_key>": <întreg ≥ 1> } } ] }
  ```
  `userId`, `flagKey`, `metric` și cheile din `counts` au cel mult 256 de caractere. Niciun
  string din batch (inclusiv `variant` și cheile lui) nu conține NUL (`\u0000`) sau un surogat
  singur, pe care PostgreSQL nu le poate păstra.
  Acceptat → `204`. Fără `key` (sau gol), corp pe care parserul JSON îl refuză (nu e JSON,
  charset sau `Content-Encoding` nesuportat), corp care nu are forma și limitele de mai sus,
  sau `events` gol → `400`, fără corp, tot batch-ul respins, nimic salvat. Cheie necunoscută
  (inclusiv una care conține NUL) → `404`. Corp
  peste 100 kB (limita implicită Express) → `413`. Eroare de bază de date → `500`, nimic
  salvat (o tranzacție per batch), deci SDK-ul poate retrimite.
  Ingestia, în ordinea din array, în mediul cheii: un `id` deja văzut în acest mediu se ignoră
  (idempotență). O expunere contează o dată per utilizator și experiment; se păstrează prima
  variantă. O conversie contează o dată per utilizator și experiment, în fiecare experiment al
  mediului cu acea metrică, doar dacă expunerea utilizatorului e deja salvată (într-un batch
  anterior sau mai devreme în același batch); altfel se ignoră și nu se păstrează pentru mai
  târziu. `evaluations` pune `last_evaluated_at = now()` pe flag-urile mediului (D-005).
  Un flag necunoscut, o expunere pe un flag fără experiment și o metrică pe care n-o folosește
  niciun experiment sunt valide, dar ignorate. Un experiment = un flag într-un mediu, cu o
  metrică (cel mult unul per flag și mediu).
  CORS: fiecare răspuns are `Access-Control-Allow-Origin: *`; preflight-ul `OPTIONS` → `204` cu
  `Access-Control-Allow-Methods: POST` și `Access-Control-Allow-Headers: Content-Type`.
- **Provider:** `server/src/app.js`, `server/src/events.js`.
- **Consumers:** `sdk/src/events.js` (coada, D-011), apelat din `sdk/src/index.js`.
- **Evidence:** user, plan „Event ingest, SDK exposures, track and batching, ParkingLot seed”,
  2026-11-25 (ordinea de ingestie, A3, A4); user, review-ul PR-ului de ingestie, 2026-11-25
  (limita de 256 de caractere, 400 pentru text nestocabil și pentru erorile parserului).
- **Confirmed:** 2026-11-25

## Consumed
None yet.

## External
None yet.
