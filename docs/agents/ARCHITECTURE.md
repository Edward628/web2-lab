# Architecture — web2-lab

<!-- graffino-agentic:begin v1 -->
> How this repo is built, generated from the code at backfill and kept current by
> whoever changes the structure. The code wins: when this page is wrong, fix it.
<!-- graffino-agentic:end -->

## Overview
A feature flags and A/B testing service with a browser SDK (README.md). Planned parts
(D-007): `server/`, `dashboard/`, `sdk/`, `p1/`. `sdk/`, `server/` and `p1/` exist so far:
the SDK evaluates flags locally; the server serves each environment's configuration from
PostgreSQL (C-002) and ingests the SDK's event batches (C-003); P1 is the parking page that
runs the `reserve-button-color` experiment through the SDK (D-006, D-012).

```text
sdk/src/index.js     init({ sdkKey, baseUrl, config? }) → { identify, isEnabled, getVariant, refresh, track, flush } (D-011)
sdk/src/events.js    createEventQueue({ sdkKey, baseUrl }): queue, 20 / 5 s, one request in flight, pagehide (C-003)
sdk/src/validate.js  isValidConfig(config): the C-001 checks before a configuration is used
sdk/src/evaluate.js  evaluateDetail → { value, fromVariant }, evaluate → value: rules, then variant ranges (D-004, C-001)
sdk/src/bucket.js    murmur3_32, bucket(flagKey, userId) → 0..99, isInRollout

server/src/index.js  reads DATABASE_URL, PORT; migrate(); listen
server/src/app.js    createApp({ pool }): GET/OPTIONS /sdk/config (C-002), POST/OPTIONS /sdk/events (C-003), CORS
server/src/config.js buildConfig(pool, sdkKey) → C-001 object | null (experiment: true on experiment flags)
server/src/events.js validateBatch(body), environmentOf(pool, key), ingestBatch(pool, envId, events): one transaction
server/src/seed.js   seedParkingLot(pool) → { dev, prod } SDK keys; idempotent
server/scripts/seed.js  `npm run seed`: migrate + seedParkingLot on DATABASE_URL, prints the keys
server/src/db.js     createPool(url), migrate(pool) runs server/db/schema.sql

p1/index.html        DS-web2-parking (states loading, list, invalid, success); p1/styles.css
p1/src/app.js        import ../config.js → getUserId → init + identify → await refresh() → getVariant once → body[data-variant]
p1/src/user-id.js    getUserId(storage): 32 hex in localStorage; a new id per page load when storage is blocked
p1/src/reservation.js SPOTS (6 fixed), loadReservation / reserve (1 h hold, track('reserve_click') only when valid) / cancel, variantOf
p1/config.example.js sdkKey + baseUrl template; the real p1/config.js is gitignored (D-012)
```

## Parts
| Part | Path | Responsibility | Talks to |
|---|---|---|---|
| SDK | `sdk/` | browser SDK: bucketing (D-004) and local evaluation (C-001, D-011) on a configuration passed to `init` or fetched by `refresh()` with ETag (C-002, D-003); invalid configurations are rejected. Exposures, conversions and evaluation counts are batched to `POST /sdk/events` (C-003), one request at a time. ES modules, no dependencies; tests in `sdk/test` | `server/` via C-002, C-003 |
| P1 | `p1/` | the parking page (DS-web2-parking): static HTML + ES modules, imports the SDK from `../sdk/src` (D-012), no backend of its own (D-006). Reservation and anonymous user id in `localStorage`. Without `p1/config.js` it shows the control and logs to the console. Tests in `p1/test` (pure modules; the page itself is checked by hand) | `server/` via the SDK (C-002, C-003) |
| Server | `server/` | Express API: `GET /sdk/config` builds the key's environment configuration from PostgreSQL, checks it with the SDK's `isValidConfig` (imported from `../sdk/src`), serves it with `ETag: "<version>"` / 304 and CORS. `POST /sdk/events` stores exposures, conversions (only after a stored exposure) and `last_evaluated_at`, idempotent by event id (C-003, D-005). Schema applied at start. Tests in `server/test` against a real `web2_test` database | PostgreSQL; SDK via C-002 |

## Data flow
SDK `refresh()` → `GET /sdk/config?key=…` (+ `If-None-Match`) → `sdk_keys` → environment
→ `flags` ⋈ `flag_environments` (⟕ `experiments`) → C-001 JSON → `isValidConfig` → 200 + ETag, 304, or 500.

SDK batch → `POST /sdk/events?key=…` → validate (400) → `sdk_keys` → environment (404) →
one transaction, events in order: `ingested_events` (seen id → skip) → `exposures` /
`conversions` / `flag_environments.last_evaluated_at` → 204 (500 rolls back).

## State and storage
| What | Where | Owner | Notes |
|---|---|---|---|
| `p1.userId`, `p1.reservation` (`{spotId, until}`) | browser `localStorage` | `p1/src/user-id.js`, `p1/src/reservation.js` | the reservation expires after 1 h |
| projects, environments (dev/prod, `config_version`, D-010), sdk_keys, flags, flag_environments (enabled, default, rules, variants as JSONB, `last_evaluated_at`), experiments (flag + environment + metric), exposures, conversions, ingested_events | PostgreSQL `web2` (volume `db-data`) | `server/db/schema.sql` | `web2_test` is created by `server/db/init-test-db.sql` for the tests |

## Configuration
| Name | Where set | Used by | Notes |
|---|---|---|---|
| `POSTGRES_PASSWORD` | `.env` (gitignored) | `docker-compose.yml` | required; Compose fails without it |
| `DATABASE_URL` | `docker-compose.yml` | `server/src/index.js`, `server/scripts/seed.js` | built from `POSTGRES_PASSWORD` |
| `PORT` | `docker-compose.yml` | `server/src/index.js` | default 3000 |
| `TEST_DATABASE_URL` | `.env` | `server/test/helpers.js` | database name must end in `_test` |
| `sdkKey`, `baseUrl` | `p1/config.js` (gitignored; template `p1/config.example.js`) | `p1/src/app.js` | the prod SDK key printed by the seed (D-012) |
<!-- names only, never values -->

## Build, deploy, runtime
Source on GitHub (`origin`, branch `main`). Stack: D-002. `docker compose up -d --build`
runs PostgreSQL 17 and the server image (`node:24-alpine`, built from the repo root so it
can copy `sdk/src`; runs as `node`; `restart: unless-stopped`). Both ports are bound to
`127.0.0.1` until hosting is decided (Q-005). The pool logs a dropped idle connection and
keeps running. Commands: AGENTS.md section 2.
P1 is served by a static server from the repo root, bound to `127.0.0.1` (AGENTS.md section 2);
a host must serve only `p1/` and `sdk/src` (Q-005).
Hand-in and deploy: not decided (Q-005). See AGENTS.md sections 2 and 5.

## Boundaries
None yet.
