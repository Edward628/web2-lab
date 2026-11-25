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
- **Provider:** `server/` (nu există încă; o servește prin C-002); configurația se poate da și
  direct la `init` (D-009).
- **Consumers:** `sdk/src/validate.js`, `sdk/src/evaluate.js`, `sdk/src/index.js`; în viitor
  `dashboard/` (scrie flag-urile pe care serverul le servește în această formă).
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25; user,
  plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25.
- **Confirmed:** 2026-11-25

### C-002 · Endpoint-ul configurației pentru SDK
- **Status:** approved
- **Interface:** `GET {baseUrl}/sdk/config?key=<cheia SDK, URL-encoded>`.
  `200` → configurația mediului cheii (C-001) ca JSON, cu header-ul `ETag` = versiunea
  (D-003). O cerere cu `If-None-Match` egal cu ETag-ul curent → `304`, fără corp. O cheie
  necunoscută → `4xx`. SDK-ul trimite înapoi ETag-ul exact cum l-a primit; orice alt status
  sau o eroare de rețea e `'error'` în SDK. Cheia stă în URL ca să meargă la fel și pentru
  SSE (`EventSource` nu poate trimite header-e); cheia SDK e oricum publică în browser.
- **Provider:** `server/` (nu există încă).
- **Consumers:** `sdk/src/index.js` (`refresh()`).
- **Evidence:** user, plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25.
- **Confirmed:** 2026-11-25

## Consumed
None yet.

## External
None yet.
