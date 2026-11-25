# Architecture — web2-lab

<!-- graffino-agentic:begin v1 -->
> How this repo is built, generated from the code at backfill and kept current by
> whoever changes the structure. The code wins: when this page is wrong, fix it.
<!-- graffino-agentic:end -->

## Overview
A feature flags and A/B testing service with a browser SDK (README.md). Planned parts
(D-007): `server/`, `dashboard/`, `sdk/`, `p1/`. Only `sdk/` exists so far: the
deterministic bucketing and the client that evaluates flags locally.

```text
sdk/src/index.js     init({ sdkKey, config }) → { identify, isEnabled, getVariant } (D-009)
sdk/src/evaluate.js  evaluate(flagKey, flag, user): rules, then variant ranges (D-004, C-001)
sdk/src/bucket.js    murmur3_32, bucket(flagKey, userId) → 0..99, isInRollout
```

## Parts
| Part | Path | Responsibility | Talks to |
|---|---|---|---|
| SDK | `sdk/` | browser SDK: bucketing (D-004) and local evaluation on a configuration passed to `init` (C-001, D-009); no network yet. ES modules, no dependencies; tests in `sdk/test` | nothing yet |

## Data flow
None yet.

## State and storage
| What | Where | Owner | Notes |
|---|---|---|---|

## Configuration
| Name | Where set | Used by | Notes |
|---|---|---|---|
<!-- names only, never values -->

## Build, deploy, runtime
Source on GitHub (`origin`, branch `main`). Stack: D-002. SDK tests: `cd sdk && npm test`.
Hand-in and deploy: not decided (Q-005). See AGENTS.md sections 2 and 5.

## Boundaries
None yet.
