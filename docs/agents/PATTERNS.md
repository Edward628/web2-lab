# Patterns — web2-lab

<!-- graffino-agentic:begin v1 -->
> How we build things here. Copy only `approved` entries. `candidate` = seen once or
> not yet confirmed; agents add these freely. Promotion needs the user's OK.
<!-- graffino-agentic:end -->

## Index
- PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark · candidate
- PATTERN-002 · Vectorii de referință vin dintr-o implementare independentă, nu din codul testat · candidate
- PATTERN-003 · Testele noi se verifică pe stub-uri temporare, ca să pice din motivul corect · candidate

---

## PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark
- **Status:** candidate
- **How:** Fiecare mock din `docs/design/mocks/` începe cu o bară marcată „Controale mock”
  (nu face parte din ecran) cu un selector de stare (listă, un element, gol, încărcare,
  eroare, succes, confirmare) și un selector light / dark. Stările sunt blocuri `.state`
  afișate după `body[data-state]`; tokens-urile sunt variabile CSS din `DESIGN.md`.
- **Example:** `docs/design/mocks/DS-web2-flags.html`

## PATTERN-002 · Vectorii de referință vin dintr-o implementare independentă, nu din codul testat
- **Status:** candidate
- **How:** Când un test fixează valori care nu au voie să se schimbe (hash, bucket, statistică),
  valorile se calculează cu o implementare independentă (un pachet sau un tool rulat o singură
  dată, în afara repo-ului), verificată întâi pe vectorii publici. Testul scrie valorile literal
  și spune de unde vin; implementarea independentă nu devine dependență.
- **Example:** `sdk/test/bucket.test.js` (murmurhash3js-revisited 3.0.0)
- **Confirmed:** 2026-11-25

## PATTERN-003 · Testele noi se verifică pe stub-uri temporare, ca să pice din motivul corect
- **Status:** candidate
- **How:** Când testele scrise întâi importă un modul care nu există, eroarea e
  `ERR_MODULE_NOT_FOUND` și ascunde dacă testele sunt corecte. Se creează temporar modulul cu
  exporturile din plan, care aruncă `Error('not implemented')`, se rulează testele (fiecare
  test nou pică cu „not implemented”, cele vechi trec), apoi stub-urile se șterg înainte de
  commit-ul `test(...)`.
- **Example:** commit `e74e46c` (`sdk/test/evaluate.test.js`, `sdk/test/client.test.js`)
