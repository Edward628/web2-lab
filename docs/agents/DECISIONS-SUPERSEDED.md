# Decisions superseded — web2-lab

<!-- graffino-agentic:begin v1 -->
> Decisions that no longer apply. **Never obeyed**; read only to explain old code or a
> past choice. Each points to the entry that replaced it. `ledger-lint.py --fix`
> keeps this file in sync: superseded entries move here from `DECISIONS.md`, and
> their index lines move here from its index.
<!-- graffino-agentic:end -->

## Index
- D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă · _superseded-by D-011_
- D-012 · P1: SDK-ul din sursă, cheia dintr-un fișier ignorat de git, track doar la rezervare validă · _superseded-by D-015_
- D-011 · API-ul SDK-ului: D-009 plus evenimente (expuneri, track, batch) · _superseded-by D-018_

---

## D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă
- **Status:** superseded-by D-011
- **Rule:** `init({ sdkKey, baseUrl, config? })` întoarce sincron un client `{ sdkKey,
  identify(userId, attributes), isEnabled(flagKey), getVariant(flagKey), refresh() }`; starea
  stă în client, nu în modul. Un `config` dat la `init` care nu trece validarea C-001 aruncă
  `TypeError`; fără `config`, fiecare flag e necunoscut până la prima configurație validă.
  `refresh()` cere configurația de la server (C-002, D-003) și întoarce un Promise cu
  `'updated' | 'not-modified' | 'rejected' | 'error'`, fără să fie respins vreodată; o
  configurație acceptată o înlocuiește pe cea veche dintr-o dată; la `'rejected'` sau
  `'error'` rămâne ultima configurație validă. `identify` cu un `userId` care nu e string
  aruncă `TypeError`. Citirile nu aruncă:
  un flag necunoscut (doar chei proprii ale `flags`) dă `isEnabled` → `false` și
  `getVariant` → `null`; înainte de `identify` un flag servește `default`; o regulă pe un
  atribut lipsă sau cu operator necunoscut nu se potrivește; `equals` e `===`.
  `isEnabled` = valoarea `=== true`; `getVariant` întoarce valoarea pentru orice tip de flag.
  Evaluarea e funcția pură `evaluate(flagKey, flag, user)` din `sdk/src/evaluate.js`;
  validarea e funcția pură `isValidConfig(config)` din `sdk/src/validate.js`.
- **Why:** un client per `init` izolează testele și se mapează direct pe un viitor
  `window.FF` (Q-026); o aplicație nu trebuie să cadă din cauza unui flag lipsă sau a unei
  configurații stricate. SSE și polling-ul (planuri ulterioare) vor apela `refresh()`.
- **Evidence:** user, plan „SDK init, identify, isEnabled și getVariant”, 2026-11-25; user,
  plan „SDK: configurația de la server cu ETag și validare”, 2026-11-25.

## D-012 · P1: SDK-ul din sursă, cheia dintr-un fișier ignorat de git, track doar la rezervare validă
- **Status:** superseded-by D-015
- **Rule:** `p1/` importă `../sdk/src/index.js` ca modul ES și e servit de un server static
  (local, legat la `127.0.0.1`). Cheia SDK (prod) și `baseUrl` stau în `p1/config.js`, ignorat
  de git; `p1/config.example.js` e în repo. P1 apelează `track("reserve_click")` doar la o
  rezervare validă (un loc liber ales), niciodată la un click invalid.
- **Why:** P1 e HTML static fără bundler (D-002), iar tarball-ul `npm pack` (D-007) nu se poate
  importa direct dintr-o pagină; cheia e creată de seed per bază de date, deci nu se scrie în
  repo; metrica numără rezervări, nu click-uri greșite.
- **Evidence:** user, plan „P1, the parking page (DS-web2-parking)”, 2026-11-25. D-007 rămâne
  calea prin care alte aplicații primesc SDK-ul.

## D-011 · API-ul SDK-ului: D-009 plus evenimente (expuneri, track, batch)
- **Status:** superseded-by D-018
- **Rule:** Tot ce spune D-009 rămâne valabil (init, identify, isEnabled, getVariant, refresh,
  citirile nu aruncă). În plus, clientul are `track(metric)` și `flush()`:
  - `track(metric)` pune în coadă o conversie `{id, type: 'conversion', userId, metric}`; un
    `metric` care nu e string aruncă `TypeError`; înainte de `identify` conversia se ignoră.
  - `getVariant` pe un flag cu `experiment: true` (C-001), după `identify`, cu valoarea venită
    dintr-un interval de variantă (nu flag oprit, nu regulă de targetare, nu bucket neacoperit),
    pune în coadă o singură expunere per utilizator și flag. `isEnabled` nu trimite expuneri.
  - Fiecare citire a unui flag cunoscut numără o evaluare; numărătorile pleacă într-un singur
    eveniment `evaluations` per trimitere.
  - Coada se trimite (C-003) la 20 de evenimente sau după 5 s, în cereri de cel mult 20 de
    evenimente, cu `fetch(…, { keepalive: true })`, și la `pagehide`. O eroare de rețea sau 5xx
    păstrează evenimentele (aceleași id-uri); un 4xx le aruncă. `flush()` întoarce un Promise
    cu `'sent' | 'empty' | 'error' | 'dropped'` și nu e respins niciodată.
  - Id-urile de eveniment au 128 de biți aleatori (`crypto.getRandomValues`, 32 de cifre hex).
  - O conversie contează după ordinea de ingestie pe server (D-005, C-003), nu după ceasul
    browserului.
  - O singură cerere e în curs o dată (Q-034); evenimentele ies din coadă doar când vine
    răspunsul (șterse după id).
  - Timer-ul de 5 s pornește când coada devine nevidă și repornește la 5 s după o trimitere
    eșuată, fără backoff.
  - La `pagehide` se trimite toată coada imediat, în cereri de cel mult 20, inclusiv
    evenimentele cererii în curs (aceleași id-uri; serverul le ignoră pe cele văzute).
  - `flush()` așteaptă cererea în curs, apoi trimite bucățile una după alta; rezultatul e
    `'error'` dacă s-a oprit la o eroare, altfel `'dropped'` dacă o bucată a fost aruncată,
    altfel `'sent'`; `'empty'` dacă nu era nimic de trimis.
  - Numărătorile pleacă într-un eveniment `evaluations` adăugat la coadă doar când nu așteaptă
    deja unul.
  - `track(metric)` verifică tipul înainte de `identify`. Fără `baseUrl` nu se pune nimic în
    coadă, iar `flush()` → `'empty'`.
  - O cerere fără răspuns în 10 s (`AbortSignal.timeout(10_000)`) e `'error'`: evenimentele
    rămân și se retrimit cu aceleași id-uri. Și după o trimitere eșuată de la `pagehide`
    (pagina păstrată în back/forward cache) timer-ul de 5 s repornește.
  - Un eveniment pe care `JSON.stringify` nu-l poate codifica (de exemplu o variantă `BigInt`
    dintr-o configurație dată la `init`) se aruncă la punerea în coadă, ca să nu blocheze coada.
- **Why:** D-005 cere expuneri, conversii și evaluări trimise în batch de SDK; `keepalive` și
  `pagehide` păstrează o conversie făcută chiar înainte de închiderea tab-ului;
  `randomUUID` există doar pe HTTPS sau localhost; când s-a decis, hosting-ul P1 nu era stabilit
  (Q-005). P1 e acum pe HTTPS (D-014), dar `getRandomValues` merge în orice context, deci regula rămâne.
- **Evidence:** user, plan „Event ingest, SDK exposures, track and batching, ParkingLot seed”,
  2026-11-25 (5 s / 20 de evenimente, experimentul marcat în configurație, ordinea de ingestie,
  A1–A2, keepalive + pagehide); user, plan „SDK part 2: exposures, track, flush, batching”,
  2026-11-25 (o cerere în curs, timer, pagehide, rezultatul lui `flush()`, `evaluations`,
  fără `baseUrl`); user, review-ul PR-ului #14, 2026-11-25 (timeout de 10 s, retrimiterea după
  `pagehide`, evenimentele necodificabile).
