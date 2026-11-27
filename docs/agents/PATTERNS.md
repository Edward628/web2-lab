# Patterns — web2-lab

<!-- graffino-agentic:begin v1 -->
> How we build things here. Copy only `approved` entries. `candidate` = seen once or
> not yet confirmed; agents add these freely. Promotion needs the user's OK.
<!-- graffino-agentic:end -->

## Index
- PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark · candidate
- PATTERN-002 · Vectorii de referință vin dintr-o implementare independentă, nu din codul testat · candidate
- PATTERN-003 · Testele noi se verifică pe stub-uri temporare, ca să pice din motivul corect · candidate
- PATTERN-004 · Testele serverului rulează pe un PostgreSQL real, într-o bază `*_test` · candidate
- PATTERN-005 · Testele SDK-ului cu timp și rețea: `fetch` înlocuit și timere simulate · candidate
- PATTERN-006 · `localStorage` se primește ca parametru și orice acces e în try/catch · candidate
- PATTERN-007 · Testele SSE: `EventSource` fals în SDK, stream citit cu `fetch` pe server · candidate
- PATTERN-008 · Textele și rezumatele UI în module pure testate; DOM-ul se construiește din noduri, nu din HTML · candidate
- PATTERN-009 · Un fișier nou servit de server intră în trei locuri: ruta, testul static și `server/Dockerfile` · candidate

---

## PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark
- **Status:** candidate
- **How:** Fiecare mock din `docs/design/mocks/` începe cu o bară marcată „Controale mock”
  (nu face parte din ecran) cu un selector de stare (listă, un element, gol, încărcare,
  eroare, succes, confirmare) și un selector light / dark. Stările sunt blocuri `.state`
  afișate după `body[data-state]`; tokens-urile sunt variabile CSS din `DESIGN.md`.
- **Example:** `docs/design/mocks/DS-web2-flags.html`
- **Confirmed:** 2026-11-26

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
- **Confirmed:** 2026-11-26

## PATTERN-004 · Testele serverului rulează pe un PostgreSQL real, într-o bază `*_test`
- **Status:** candidate
- **How:** Testele din `server/test` folosesc `TEST_DATABASE_URL` (baza `web2_test`, creată de
  `server/db/init-test-db.sql` la primul `docker compose up`). `helpers.js` refuză orice bază al
  cărei nume nu se termină în `_test`, aplică schema cu `migrate()` și golește tabelele
  (`TRUNCATE … RESTART IDENTITY`) înainte de fiecare test, deci id-urile din fixture-uri sunt
  fixe. Fișierele rulează unul câte unul (`--test-concurrency=1`). Aplicația primește pool-ul
  prin `createApp({ pool })` și ascultă pe un port aleator.
- **Example:** `server/test/helpers.js`, `server/test/sdk-config.test.js`
- **Confirmed:** 2026-11-27

## PATTERN-005 · Testele SDK-ului cu timp și rețea: `fetch` înlocuit și timere simulate
- **Status:** candidate
- **How:** Testele unitare care depind de timp sau de ordinea cererilor înlocuiesc `fetch` cu
  `t.mock.method(globalThis, 'fetch', …)` (cererile se rețin, răspunsul vine dintr-o funcție
  sau dintr-un Promise rezolvat de test) și pornesc `t.mock.timers.enable({ apis: ['setTimeout'] })`.
  Timpul avansează cu `t.mock.timers.tick(ms)`, iar `await new Promise((r) => setImmediate(r))`
  lasă răspunsurile să se termine. Comportamentul cap la cap rămâne în testul round-trip pe
  serverul real.
- **Example:** `sdk/test/events.test.js`
- **Confirmed:** 2026-11-26

## PATTERN-006 · `localStorage` se primește ca parametru și orice acces e în try/catch
- **Status:** candidate
- **How:** Modulele care țin date în browser primesc `storage` ca parametru (nu citesc
  `localStorage` global), iar fiecare `getItem` / `setItem` / `removeItem` e în try/catch: un
  storage blocat sau lipsă face ca datele să țină doar cât pagina, fără excepție. Pagina obține
  `localStorage` tot într-un try (accesul în sine poate arunca). Testele folosesc un storage în
  memorie și unul la care orice apel aruncă.
- **Example:** `p1/src/user-id.js`, `p1/src/reservation.js`, `p1/test/helpers.js`
- **Confirmed:** 2026-11-26

## PATTERN-007 · Testele SSE: `EventSource` fals în SDK, stream citit cu `fetch` pe server
- **Status:** candidate
- **How:** În testele unitare ale SDK-ului, `globalThis.EventSource` e o clasă falsă care reține
  instanțele, cu `emit(type, data)`; se șterge în `t.after`. Pe server, stream-ul se citește cu
  `fetch` + `TextDecoderStream`, un mesaj întreg până la `\n\n`, și se închide cu un
  `AbortController`. Doar `setInterval` e simulat (`t.mock.timers.enable({ apis: ['setInterval'] })`,
  înainte de pornirea aplicației), ca PostgreSQL și socket-urile să meargă în timp real.
  `listen().close()` închide întâi conexiunile deschise. Testul cap la cap folosește
  `EventSource` din Node (`--experimental-eventsource` în `npm test`).
- **Example:** `sdk/test/live.test.js`, `server/test/sdk-stream.test.js`
- **Confirmed:** 2026-11-27

## PATTERN-008 · Textele și rezumatele UI în module pure testate; DOM-ul se construiește din noduri, nu din HTML
- **Status:** candidate
- **How:** Copy-ul unui ecran (titluri, mesaje, plurale, rezumate) stă într-un modul fără DOM
  (`dashboard/src/flags.js`), testat cu `node --test`; un text cu cod e o listă de părți (string sau
  `{code}`). Clientul API primește `fetch` ca parametru și întoarce stări numite (`'wrong'`,
  `'limited'`…), testate cu un `fetch` fals. Pagina construiește nodurile cu un `el(tag, attrs, …children)`
  și `textContent`, niciodată din string-uri HTML, deci o cheie de flag nu poate injecta markup.
  Comportamentul în browser rămâne verificat de mână până există o comandă de screenshot (Q-003).
- **Example:** `dashboard/src/flags.js`, `dashboard/src/api.js`, `dashboard/src/app.js`, `dashboard/test/`

## PATTERN-009 · Un fișier nou servit de server intră în trei locuri: ruta, testul static și `server/Dockerfile`
- **Status:** candidate
- **How:** Serverul servește P1 și dashboard-ul dintr-o listă fixă (D-014), iar imaginea Docker copiază tot
  o listă fixă. O pagină nouă (de exemplu `dashboard/experiment.html`) primește: ruta în `serveDashboard`
  / `serveP1` (`server/src/app.js`), o linie în testul static (`server/test/dashboard-static.test.js`) și
  numele în `COPY`-ul din `server/Dockerfile`. Testele nu acoperă imaginea, deci se verifică o dată cu
  `docker compose up -d --build --wait server` și `curl` pe URL-ul paginii (200). Fișierele din `src/`
  intră automat (folderul e copiat întreg).
- **Example:** `server/Dockerfile` (`dashboard/experiment.html`, PR-ul DS-web2-experiment)
