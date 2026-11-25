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
- **Provider:** `server/` (nu există încă); azi configurația se dă direct la `init` (D-009).
- **Consumers:** `sdk/src/evaluate.js`, `sdk/src/index.js`; în viitor `dashboard/` (scrie
  flag-urile pe care serverul le servește în această formă).
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25.
- **Confirmed:** 2026-11-25

## Consumed
None yet.

## External
None yet.
