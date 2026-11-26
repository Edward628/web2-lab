# Architecture — web2-lab

<!-- graffino-agentic:begin v1 -->
> How this repo is built, generated from the code at backfill and kept current by
> whoever changes the structure. The code wins: when this page is wrong, fix it.
<!-- graffino-agentic:end -->

## Overview
A feature flags and A/B testing service with a browser SDK (README.md). Planned parts
(D-007): `server/`, `dashboard/`, `sdk/`, `p1/`. All four exist:
the SDK evaluates flags locally; the server serves each environment's configuration from
PostgreSQL (C-002) and ingests the SDK's event batches (C-003); P1 is the parking page that
runs the `reserve-button-color` experiment through the SDK (D-006, D-015). Hosted, the server also serves P1 from its own origin
(D-014): Render runs the image, Neon holds the database (C-004, C-005).

```text
sdk/src/index.js     init({ sdkKey, baseUrl, config?, storage? }) → { identify, isEnabled, getVariant, refresh, track, flush, connect, close, status } (D-018);
                     refresh() times out at 10 s (D-013); config cache ff:config:<sdkKey>; status() 'stale' 60 s after the last confirmation
sdk/src/live.js      createLive(…): EventSource on /sdk/stream (C-006), reconnect after 3 s, 3 failures → polling every 30 s
sdk/src/events.js    createEventQueue({ sdkKey, baseUrl }): queue, 20 / 5 s, one request in flight, pagehide (C-003)
sdk/src/validate.js  isValidConfig(config): the C-001 checks before a configuration is used
sdk/src/evaluate.js  evaluateDetail → { value, fromVariant }, evaluate → value: rules, then variant ranges (D-004, C-001)
sdk/src/bucket.js    murmur3_32, bucket(flagKey, userId) → 0..99, isInRollout

server/src/index.js  reads DATABASE_URL, PORT, P1_SDK_KEY, ADMIN_PASSWORD_HASH; migrate(); listen
server/src/app.js    createApp({ pool, p1SdkKey, adminPasswordHash }): GET/OPTIONS /sdk/config (C-002), GET /sdk/stream (C-006), POST/OPTIONS /sdk/events (C-003), CORS;
                     /admin/* (C-007, no CORS); the dashboard at /dashboard/ (fixed list: index.html, login.html, styles.css, src/; same headers as P1);
                     P1 at /p1/ (fixed list: index.html, styles.css, /p1/src, /sdk/src), /p1/config.js from p1SdkKey or 404 (D-014, D-015);
                     P1 responses: nosniff, X-Frame-Options DENY, CSP frame-ancestors 'none'; no X-Powered-By
server/src/config.js buildConfig(pool, sdkKey) → C-001 object | null (experiment: true on experiment flags); one REPEATABLE READ snapshot (D-020)
server/src/admin.js  hashPassword, parseHash; adminRoutes(app, …): login / logout (in-memory session, 8 h, cookie ff_admin, D-019;
                     one scrypt at a time, 10 failures a minute then 429, Q-038), any other /admin path 401 / 404,
                     GET /admin/flags?env=, PATCH /admin/flags/:key?env= {enabled} | {rollout}: one transaction, config_version + 1, audit_log row (D-020)
                     GET /admin/experiments?env=: results per experiment from one snapshot
server/src/experiments.js experimentResults(db, environmentId): exposed / converted per variant, each variant vs the control (the default, D-021)
server/src/stats.js  normalCdf, minSample, compare (z-test pooled SE, Wald CI), verdict (D-001, D-021); no dependency
server/src/stream.js streamTarget(pool, key), createStreams(pool).add: "version N" on connect and every 15 s, one timer per environment with open streams
server/src/events.js validateBatch(body), environmentOf(pool, key), ingestBatch(pool, envId, events): one transaction
server/src/seed.js   seedParkingLot(pool) → { dev, prod } SDK keys; idempotent
server/scripts/seed.js  `npm run seed`: migrate + seedParkingLot on DATABASE_URL, prints the keys
server/src/db.js     createPool(url), migrate(pool) runs server/db/schema.sql; readSnapshot / transaction(pool, fn)
server/scripts/hash-password.js  `npm run hash-password`: reads the password, prints ADMIN_PASSWORD_HASH (scrypt:<salt>:<hash>)

p1/index.html        DS-web2-parking (states loading, list, invalid, success); p1/styles.css
p1/src/app.js        import ../config.js → getUserId → init + identify → firstVariant → body[data-variant]
p1/src/variant.js    firstVariant(ff, flagKey): waits ≤ 5 s for refresh(), then getVariant once; late → 'blue', no exposure (D-013)
p1/src/user-id.js    getUserId(storage): 32 hex in localStorage; a new id per page load when storage is blocked
p1/src/reservation.js SPOTS (6 fixed), loadReservation / reserve (1 h hold, track('reserve_click') only when valid) / cancel, variantOf
p1/config.example.js sdkKey + baseUrl template; the real p1/config.js is gitignored (D-015)

dashboard/index.html DS-web2-flags: environment switch (opens on prod), list, switch with confirmation in prod both ways, undo, Ieși
dashboard/login.html DS-web2-login: one password field; states for 401, 429, 503, network error, ?expired=1
dashboard/src/api.js createApi({ fetch, onUnauthorized }): login / logout / listFlags / setEnabled on C-007; 10 s timeout
dashboard/src/flags.js copy and summaries (plurals, targeting, confirm / success / error text), pure
dashboard/src/app.js, login.js  the pages: DOM nodes and textContent only; a 401 goes to login.html (?expired=1 after the first load)
```

## Parts
| Part | Path | Responsibility | Talks to |
|---|---|---|---|
| SDK | `sdk/` | browser SDK: bucketing (D-004) and local evaluation (C-001, D-011) on a configuration passed to `init`, loaded from the `localStorage` cache, or fetched by `refresh()` with ETag (C-002, D-003); invalid configurations are rejected. `connect()` keeps it current over SSE (C-006), or by polling every 30 s after 3 failures (D-018); `status()` reports `stale`. Exposures, conversions and evaluation counts are batched to `POST /sdk/events` (C-003), one request at a time. ES modules, no dependencies; tests in `sdk/test` | `server/` via C-002, C-003, C-006 |
| P1 | `p1/` | the parking page (DS-web2-parking): static HTML + ES modules, imports the SDK from `../sdk/src` (D-015), no backend of its own (D-006). Reservation and anonymous user id in `localStorage`. Without a config (`p1/config.js` locally, or `P1_SDK_KEY` on the server) it shows the control and logs to the console. Tests in `p1/test` (pure modules; the page itself is checked by hand) | `server/` via the SDK (C-002, C-003) |
| Dashboard | `dashboard/` | the admin screens DS-web2-login and DS-web2-flags: static HTML + ES modules served by the server from a fixed list at `/dashboard/`; lists an environment's flags and flips the switch (the kill switch, confirmation in prod) through the admin API. Tests in `dashboard/test` (pure modules; the pages are checked by hand) | `server/` via C-007 |
| Server | `server/` | Express API: `GET /sdk/config` builds the key's environment configuration from PostgreSQL, checks it with the SDK's `isValidConfig` (imported from `../sdk/src`), serves it with `ETag: "<version>"` / 304 and CORS. `GET /sdk/stream` sends the environment's `config_version` on connect and every 15 s while streams are open (C-006). `POST /sdk/events` stores exposures, conversions (only after a stored exposure) and `last_evaluated_at`, idempotent by event id (C-003, D-005). `/admin/*` (C-007): one admin with an in-memory session (D-019) lists an environment's flags and changes the switch or a boolean rollout; each change bumps `config_version` and writes `audit_log` in one transaction (D-020). It also returns each experiment's results: users exposed and converted per variant, and each variant against the control with the 95% CI, p-value and minimum sample (D-001, D-021). Schema applied at start. Tests in `server/test` against a real `web2_test` database | PostgreSQL; SDK via C-002 |

## Data flow
SDK `refresh()` → `GET /sdk/config?key=…` (+ `If-None-Match`) → `sdk_keys` → environment
→ `flags` ⋈ `flag_environments` (⟕ `experiments`) → C-001 JSON → `isValidConfig` → 200 + ETag, 304, or 500.

SDK `connect()` → `GET /sdk/stream?key=…` → `sdk_keys` → environment → `version N` now, then every 15 s
(`SELECT config_version`) → SDK: N newer than its configuration → `refresh()`.

SDK batch → `POST /sdk/events?key=…` → validate (400) → `sdk_keys` → environment (404) →
one transaction, events in order: `ingested_events` (seen id → skip) → `exposures` /
`conversions` / `flag_environments.last_evaluated_at` → 204 (500 rolls back).

Admin `PATCH /admin/flags/:key?env=` → session cookie (401) → one transaction: `flag_environments` row
`FOR UPDATE` → update → `environments.config_version + 1` → `audit_log` → 200. SDKs see the new
version on the next stream tick (C-006) or `refresh()`.

## State and storage
| What | Where | Owner | Notes |
|---|---|---|---|
| `p1.userId`, `p1.reservation` (`{spotId, until}`) | browser `localStorage` | `p1/src/user-id.js`, `p1/src/reservation.js` | the reservation expires after 1 h |
| `ff:config:<sdkKey>` (`{etag, config}`) | browser `localStorage` (or the `storage` given to `init`) | `sdk/src/index.js` | last configuration from the server, for offline use (D-018) |
| projects, environments (dev/prod, `config_version`, D-010), sdk_keys, flags, flag_environments (enabled, default, rules, variants as JSONB, `last_evaluated_at`), experiments (flag + environment + metric, `baseline_rate`, `mde`), exposures, conversions, ingested_events, audit_log (admin changes, D-020) | PostgreSQL `web2` (volume `db-data`) | `server/db/schema.sql` | `web2_test` is created by `server/db/init-test-db.sql` for the tests |

## Configuration
| Name | Where set | Used by | Notes |
|---|---|---|---|
| `POSTGRES_PASSWORD` | `.env` (gitignored) | `docker-compose.yml` | required; Compose fails without it |
| `DATABASE_URL` | `docker-compose.yml` | `server/src/index.js`, `server/scripts/seed.js` | built from `POSTGRES_PASSWORD` |
| `PORT` | `docker-compose.yml` | `server/src/index.js` | default 3000 |
| `TEST_DATABASE_URL` | `.env` | `server/test/helpers.js` | database name must end in `_test` |
| `sdkKey`, `baseUrl` | `p1/config.js` (gitignored; template `p1/config.example.js`) | `p1/src/app.js` | the prod SDK key printed by the seed (D-015); a static server only |
| `P1_SDK_KEY` | `.env` (optional) locally; Render env var when hosted | `server/src/index.js` → `/p1/config.js` | the prod SDK key of that database; unset → 404, P1 shows the control (D-015) |
| `ADMIN_PASSWORD_HASH` | `.env` (optional) locally; Render env var when hosted (after the experiment) | `server/src/index.js` → `server/src/admin.js` | `scrypt:<salt>:<hash>` from `npm run hash-password` (D-019); unset or malformed → login 503 |
| admin sessions | server memory | `server/src/admin.js` | 8 h; lost on restart (D-019) |
| `DATABASE_URL` (hosted) | Render env var | `server/src/index.js` | Neon URL ending in `?sslmode=verify-full` (D-014, C-005); never in the repo |
<!-- names only, never values -->

## Build, deploy, runtime
Source on GitHub (`origin`, branch `main`). Stack: D-002. `docker compose up -d --build`
runs PostgreSQL 17 and the server image (`node:24-alpine`, built from the repo root so it
can copy `sdk/src`; runs as `node`; `restart: unless-stopped`). Both ports are bound to
`127.0.0.1` locally; the hosted server runs on Render (D-014). The pool logs a dropped idle connection and
keeps running. Commands: AGENTS.md section 2.
P1 is served by a static server from the repo root, bound to `127.0.0.1` (AGENTS.md section 2);
or by the server itself at `/p1/` (fixed file list, D-014). The image holds no `.env`,
`p1/config.js` or `p1/test` (`.dockerignore`).
Hosted (D-014): Render web service (free, Docker, Frankfurt, auto-deploy off, manual deploy
with the user's go), PostgreSQL on Neon (free, TLS). Hand-in: not decided (Q-005). See AGENTS.md sections 2 and 5.

## Boundaries
None yet.
