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
- C-006 · Stream-ul de versiuni pentru SDK (SSE) · provided
- C-007 · API-ul de administrare (sesiune, lista flag-urilor, comutator, rollout, rezultatele experimentelor, jurnalul de audit) · provided
- C-004 · Render (web service gratuit) · external
- C-005 · Neon (PostgreSQL gratuit) · external

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
- **Confirmed:** 2026-11-27

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
- **Confirmed:** 2026-11-27

### C-006 · Stream-ul de versiuni pentru SDK (SSE)
- **Status:** approved
- **Interface:** `GET {baseUrl}/sdk/stream?key=<cheia SDK, URL-encoded>`. Fără `key` (sau gol) →
  `400`; o cheie necunoscută (inclusiv una cu NUL) → `404`; o eroare de bază de date înainte de
  pornirea stream-ului → `500`; cu 200 de stream-uri deschise în total (toate mediile, pe instanță)
  → `503`, verificat după căutarea cheii, chiar înainte de pornirea stream-ului (deci `400`, `404`
  și `500` vin întâi); toate fără corp, fără `Retry-After`. SDK-ul tratează `503` ca orice conexiune
  eșuată (D-018). Altfel `200`, `Content-Type: text/event-stream`,
  `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Access-Control-Allow-Origin: *`.
  Mesajele: `event: version\ndata: <config_version>\n\n` (D-010), trimis la conectare și apoi
  la 15 s cât timp e deschis un stream al acelui mediu; o citire eșuată sare peste acel tick (scrisă
  în log), stream-ul rămâne deschis. Alte evenimente nu există; fără câmpul `id:`. Mesajul la
  15 s ține loc și de confirmare (D-018, `stale` după 60 s).
- **Provider:** `server/src/app.js`, `server/src/stream.js` (un timer per mediu, oprit odată cu
  ultimul stream, deci nicio interogare când nu e nimeni conectat; un contor al stream-urilor
  deschise, scăzut la închiderea fiecăruia, `MAX_STREAMS = 200`).
- **Consumers:** `sdk/src/live.js`, pornit din `sdk/src/index.js` (`connect()`, D-018).
- **Evidence:** user, plan „Live configuration updates (SSE, polling fallback, local cache, stale
  state)”, 2026-11-26 (versiunea citită la 15 s, nu LISTEN/NOTIFY); user, plan „Q-037: a cap on
  open SSE streams”, 2026-11-27 (200 în total, `503` fără corp, ordinea 400 → 404/500 → 503).
- **Confirmed:** 2026-11-27

### C-007 · API-ul de administrare (sesiune, lista flag-urilor, comutator, rollout, rezultatele experimentelor, jurnalul de audit)
- **Status:** approved
- **Interface:** Fără CORS. Sesiunea: cookie-ul `ff_admin` (D-019). Toate răspunsurile de eroare
  sunt fără corp.
  - `POST /admin/login`, corp `{"password": "<string>"}` → `204` + `Set-Cookie: ff_admin=<token>;
    HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`. Fără hash configurat → `503`;
    `Content-Type` diferit de `application/json` → `415`; corp care nu e JSON sau fără `password`
    string → `400`; parolă greșită → `401`. Limita (Q-038): o singură verificare de parolă (scrypt)
    o dată, iar cererile așteaptă la rând; cel mult 10 login-uri eșuate (`401`) pe minut, în total,
    minutul numărat de la primul eșec; peste ele, orice login (și cu parola bună) → `429`, fără corp
    și fără cookie, până se încheie minutul. Limita e verificată când vine rândul cererii. `400` și
    `415` nu contează ca eșecuri; un login reușit nu golește numărătoarea. Numărătoarea stă în
    memorie (un restart o pornește de la zero).
  - `POST /admin/logout` → `204`, șterge sesiunea și cookie-ul (`Max-Age=0`).
  - `GET /admin/flags?env=dev|prod` → `200`
    `{project: {id, name}, environment, version, flags: [{key, type, enabled, default, ruleCount, variants, rollout}]}`,
    flag-urile cu rând în acel mediu, ordonate după cheie. Proiectul e cel cu id-ul cel mai mic
    (Q-040). `rollout` = N când flag-ul e boolean și `variants` e `[]` (0) sau
    `[{value: true, from: 0, to: N}]`; altfel `null`. `env` lipsă sau alt mediu → `400`; niciun
    proiect sau mediu → `404`.
  - `PATCH /admin/flags/<flag_key>?env=dev|prod`, `Content-Type: application/json`, corpul exact unul
    dintre `{"enabled": <boolean>}` și `{"rollout": <întreg 0–100>}` → `200 {flag, version}` (`flag`
    ca în listă, `version` = versiunea curentă a mediului). Rollout N pune
    `variants = [{value: true, from: 0, to: N}]` (C-001) și nu atinge `default` sau `enabled`. Alt
    `Content-Type` → `415`; alt corp, `env` greșit sau rollout pe un flag multivariat → `400`; flag
    fără rând în acel mediu → `404`; eroare de bază de date → `500`, nimic schimbat. Scrierea urmează
    D-020 (versiune nouă și rând de audit doar la o schimbare reală).
  - `GET /admin/experiments?env=dev|prod` → `200`
    `{project: {id, name}, environment, experiments: [{flagKey, metric, baseline, mde, minSample, control,
    variants: [{value, exposed, converted, rate}], comparisons: [{variant, difference, ci: {low, high},
    pValue, minSampleReached, significant, peeking}]}]}`: experimentele proiectului deschis (Q-040) în
    acel mediu, ordonate după cheia flag-ului. `control` = valoarea implicită a flag-ului. `variants`:
    variantele configurate, în ordine, apoi controlul dacă nu e printre ele, apoi orice altă valoare
    expusă, după textul JSON. `rate` = convertiți / expuși, `null` fără expuneri. O comparație per
    variantă care nu e controlul; `difference`, `ci` și `pValue` pot fi `null` (D-021).
    `minSampleReached` = controlul și varianta au cel puțin `minSample` expuși; `significant` = p < 0,05
    și eșantionul atins; `peeking` = p < 0,05 înainte de el (D-001). `env` lipsă sau alt mediu → `400`;
    niciun proiect sau mediu → `404`; eroare de bază de date → `500`. Doar citire, dintr-un singur
    snapshot (D-020).
  - `GET /admin/audit?env=dev|prod[&flag=<flag_key>][&before=<id>]` → `200`
    `{project: {id, name}, environment, entries: [{id, at, flagKey, action, before, after, configVersion}], nextBefore}`:
    rândurile din `audit_log` ale mediului proiectului deschis (Q-040), cele mai noi primele (după `id`,
    descrescător), cel mult 50. `at` = ISO 8601 în UTC; `action` ∈ `enable` | `disable` | `rollout`;
    `before` / `after` = obiectele salvate (`{enabled}` sau `{variants}`), neschimbate. `nextBefore` = id-ul
    de dat ca `before` pentru pagina următoare (mai veche), `null` când nu mai sunt rânduri mai vechi.
    `flag` păstrează doar rândurile acelui flag; o cheie necunoscută (sau cu NUL) → `200` fără intrări.
    `env` lipsă sau alt mediu, `before` care nu e un întreg 1…2147483647, `flag` gol, sau un parametru dat
    de două ori → `400`; niciun proiect sau mediu → `404`; eroare de bază de date → `500`. Doar citire,
    dintr-un singur snapshot (D-020). Un singur admin (D-008), deci fiecare intrare e făcută de admin.
  - Orice altă rută sau metodă `/admin/*` decât login, fără o sesiune validă (lipsă, necunoscută sau
    expirată) → `401`; cu o sesiune validă, o rută sau metodă necunoscută → `404`. Ambele fără corp
    și fără `Allow` (nici `OPTIONS` nu arată metodele).
- **Provider:** `server/src/app.js`, `server/src/admin.js`, `server/src/experiments.js`, `server/src/stats.js`, `server/src/audit.js`.
- **Consumers:** `dashboard/src/api.js` (apelat din `dashboard/src/app.js`, `dashboard/src/login.js`, `dashboard/src/experiment.js` și `dashboard/src/audit.js`).
- **Evidence:** user, plan „Admin API, dashboard login and the flags screen”, 2026-11-26 (C-007 aprobat;
  doar flag-uri boolean pentru rollout; presupunerile acceptate); user, review-ul de securitate al
  PR-ului #20, 2026-11-26 (limita de login cu `429` aprobată; `401` pe orice altă rută `/admin`); user, plan
  „Experiment results”, 2026-11-26 (`GET /admin/experiments` aprobat); user, plan „Audit log screen”,
  2026-11-27 (`GET /admin/audit` aprobat: cursor `before`, 50 fix, filtrul `flag` pe server).
- **Confirmed:** 2026-11-27

## Consumed
None yet.

## External

### C-004 · Render (web service gratuit)
- **Status:** approved
- **Interface:** construiește imaginea din `server/Dockerfile` (contextul = rădăcina repo-ului)
  și setează `PORT`, pe care serverul ascultă (`server/src/index.js`). HTTPS e dat de Render.
  Variabilele de mediu `DATABASE_URL` și `P1_SDK_KEY` se setează în dashboard-ul Render. Pe
  planul gratuit serviciul se oprește după 15 min fără trafic, iar prima cerere îl pornește din
  nou în ~30–60 s; sistemul de fișiere e gol la fiecare deploy (nu ținem nimic pe disc).
- **Consumer:** `server/src/index.js`, `server/Dockerfile` (D-014).
- **Evidence:** user, plan „Host the server and P1 (Render + Neon)”, 2026-11-26.
- **Confirmed:** 2026-11-26

### C-005 · Neon (PostgreSQL gratuit)
- **Status:** approved
- **Interface:** PostgreSQL 17, acces doar prin TLS (`?sslmode=verify-full` în `DATABASE_URL`;
  certificatul e de la o autoritate publică). Compute-ul se oprește după 5 min fără conexiuni și
  pornește la prima conexiune; conexiunile inactive închise de Neon sunt prinse de
  `pool.on('error')` (`server/src/db.js`). Planul gratuit are 0,5 GB de stocare.
- **Consumer:** `server/src/db.js`, `server/scripts/seed.js` (D-014).
- **Evidence:** user, plan „Host the server and P1 (Render + Neon)”, 2026-11-26.
- **Confirmed:** 2026-11-26
