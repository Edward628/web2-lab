# Architecture — web2-lab

<!-- graffino-agentic:begin v1 -->
> How this repo is built, generated from the code at backfill and kept current by
> whoever changes the structure. The code wins: when this page is wrong, fix it.
<!-- graffino-agentic:end -->

## Overview
A feature flags and A/B testing service with a browser SDK (README.md). Planned parts
(D-007): `server/`, `dashboard/`, `sdk/`, `p1/`. `sdk/` and `server/` exist so far: the
SDK evaluates flags locally; the server serves each environment's configuration from
PostgreSQL (C-002).

```text
sdk/src/index.js     init({ sdkKey, baseUrl, config? }) → { identify, isEnabled, getVariant, refresh } (D-009)
sdk/src/validate.js  isValidConfig(config): the C-001 checks before a configuration is used
sdk/src/evaluate.js  evaluate(flagKey, flag, user): rules, then variant ranges (D-004, C-001)
sdk/src/bucket.js    murmur3_32, bucket(flagKey, userId) → 0..99, isInRollout

server/src/index.js  reads DATABASE_URL, PORT; migrate(); listen
server/src/app.js    createApp({ pool }): GET/OPTIONS /sdk/config (C-002, CORS)
server/src/config.js buildConfig(pool, sdkKey) → C-001 object | null
server/src/db.js     createPool(url), migrate(pool) runs server/db/schema.sql
```

## Parts
| Part | Path | Responsibility | Talks to |
|---|---|---|---|
| SDK | `sdk/` | browser SDK: bucketing (D-004) and local evaluation (C-001, D-009) on a configuration passed to `init` or fetched by `refresh()` with ETag (C-002, D-003); invalid configurations are rejected. ES modules, no dependencies; tests in `sdk/test` | `server/` via C-002 |
| Server | `server/` | Express API: `GET /sdk/config` builds the key's environment configuration from PostgreSQL, checks it with the SDK's `isValidConfig` (imported from `../sdk/src`), serves it with `ETag: "<version>"` / 304 and CORS. Schema applied at start. Tests in `server/test` against a real `web2_test` database | PostgreSQL; SDK via C-002 |

## Data flow
SDK `refresh()` → `GET /sdk/config?key=…` (+ `If-None-Match`) → `sdk_keys` → environment
→ `flags` ⋈ `flag_environments` → C-001 JSON → `isValidConfig` → 200 + ETag, 304, or 500.

## State and storage
| What | Where | Owner | Notes |
|---|---|---|---|
| projects, environments (dev/prod, `config_version`, D-010), sdk_keys, flags, flag_environments (enabled, default, rules, variants as JSONB) | PostgreSQL `web2` (volume `db-data`) | `server/db/schema.sql` | `web2_test` is created by `server/db/init-test-db.sql` for the tests |

## Configuration
| Name | Where set | Used by | Notes |
|---|---|---|---|
| `POSTGRES_PASSWORD` | `.env` (gitignored) | `docker-compose.yml` | required; Compose fails without it |
| `DATABASE_URL` | `docker-compose.yml` | `server/src/index.js` | built from `POSTGRES_PASSWORD` |
| `PORT` | `docker-compose.yml` | `server/src/index.js` | default 3000 |
| `TEST_DATABASE_URL` | `.env` | `server/test/helpers.js` | database name must end in `_test` |
<!-- names only, never values -->

## Build, deploy, runtime
Source on GitHub (`origin`, branch `main`). Stack: D-002. `docker compose up -d --build`
runs PostgreSQL 17 and the server image (`node:24-alpine`, built from the repo root so it
can copy `sdk/src`; runs as `node`; `restart: unless-stopped`). Both ports are bound to
`127.0.0.1` until hosting is decided (Q-005). The pool logs a dropped idle connection and
keeps running. Commands: AGENTS.md section 2.
Hand-in and deploy: not decided (Q-005). See AGENTS.md sections 2 and 5.

## Boundaries
None yet.
