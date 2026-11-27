# Decisions — web2-lab

<!-- graffino-agentic:begin v1 -->
> Constraints the code must obey. Status: `approved` (obey) · `proposed` (do not
> build on it) · `superseded-by <ID>` (kept to explain old code).
> Adding or changing an entry needs the user's OK (AGENTS.md → The gate).
<!-- graffino-agentic:end -->

## Index
- D-001 · Rezultatele experimentelor folosesc metoda frecventistă (test z, α = 0,05)
- D-002 · Stack: Node.js (JavaScript), Express, PostgreSQL, Docker Compose
- D-003 · Configurația SDK: JSON versionat, SSE cu fallback la polling, cache local
- D-004 · Evaluarea: reguli, apoi intervale pe un singur bucket (MurmurHash3); comutatorul e kill switch-ul
- D-005 · Evenimente: un batch cu expuneri, conversii și numărul de evaluări
- D-006 · P1: o pagină cu locuri simulate, utilizator anonim
- D-007 · Structura repo-ului, proiectele și publicarea SDK-ului
- D-008 · Autentificarea adminului: parolă din variabilă de mediu, cookie de sesiune
- D-010 · Versiunea configurației: un întreg per mediu
- D-013 · P1 așteaptă configurația cel mult 5 s; cererea configurației din SDK expiră la 10 s
- D-014 · Hosting: serverul pe Render, baza pe Neon, P1 pe aceeași origine
- D-015 · P1: SDK-ul din sursă; cheia din `p1/config.js` local sau din `P1_SDK_KEY` pe server; track doar la rezervare validă
- D-016 · Experimentul `reserve-button-color` rulează 7 zile; până la final, fără deploy pe `p1/` sau `sdk/` și fără schimbări la flag
- D-017 · CI: GitHub Actions rulează testele SDK, P1, dashboard și server; fără deploy
- D-018 · API-ul SDK-ului: D-011 plus actualizări live (SSE, polling), cache local și starea `stale`
- D-019 · Sesiunea adminului: hash scrypt din `ADMIN_PASSWORD_HASH`, token în memorie 8 h
- D-020 · Scrierile configurației: o tranzacție cu versiunea și auditul; citirile `REPEATABLE READ`
- D-021 · Statistica rezultatelor: controlul e valoarea implicită; p cu SE comun, IC Wald, eșantion minim clasic

---

## D-001 · Rezultatele experimentelor folosesc metoda frecventistă (test z, α = 0,05)
- **Status:** approved
- **Rule:** Rezultatele unui experiment se calculează cu testul z pe două proporții, α = 0,05,
  putere 80%. Eșantionul minim per variantă e calculat și afișat. „Semnificativ” apare doar
  când p < 0,05 și eșantionul minim e atins; altfel se afișează „nu e semnificativ încă”, iar
  un p < 0,05 înainte de eșantionul minim primește avertisment de peeking. Eșantionul minim
  se calculează implicit cu rata de bază 20% și efect minim detectabil +10 puncte
  procentuale; ambele sunt editabile per experiment.
- **Why:** variabilă din fișa proiectului; metoda e simplu de explicat la susținere. Cu
  ~30 de colegi eșantionul minim (~290 per variantă) nu va fi atins; rezultatul real arată
  „nu e semnificativ încă”, iar statistica e dovedită prin teste pe date cunoscute.
- **Evidence:** interviu și aprobare de la user, 2026-11-18; README.md → „Variabilele mele”; Q-015.
- **Confirmed:** 2026-11-27

## D-002 · Stack: Node.js (JavaScript), Express, PostgreSQL, Docker Compose
- **Status:** approved
- **Rule:** Serverul e Node.js cu JavaScript simplu (fără TypeScript) și Express; datele stau
  în PostgreSQL; serverul și baza de date pornesc cu Docker Compose. Dashboard-ul și aplicația
  P1 sunt HTML + JavaScript simplu, fără framework de UI. Testele folosesc runner-ul inclus în
  Node (`node --test`).
- **Why:** studentul știe JavaScript; SDK-ul trebuie să fie în JavaScript (fișa); serverele
  rulează în Docker (Lab Setup); bugetul de 15–20 h nu lasă loc pentru framework-uri noi.
- **Evidence:** interviu și aprobare de la user, 2026-11-18; răspunde la Q-001.
- **Confirmed:** 2026-11-27

## D-003 · Configurația SDK: JSON versionat, SSE cu fallback la polling, cache local
- **Status:** approved
- **Rule:** Configurația servită SDK-ului e un JSON `{version, flags}`, cu `ETag = version`.
  SSE trimite doar „există versiunea N”; SDK-ul cere configurația nouă și o înlocuiește
  dintr-o dată, deci o evaluare folosește o singură versiune. După 3 reconectări SSE eșuate,
  SDK-ul trece pe polling cu `If-None-Match` la 30 s. Ultima configurație e salvată în
  `localStorage` pentru offline. După 60 s fără confirmare de la server, SDK-ul raportează
  starea `stale`.
- **Why:** variabilă din fișa proiectului (formatul configurației și strategia de fallback);
  acoperă cerința „fără a amesteca două versiuni într-o evaluare”.
- **Evidence:** interviu și aprobare de la user, 2026-11-18.
- **Confirmed:** 2026-11-27

## D-004 · Evaluarea: reguli, apoi intervale pe un singur bucket (MurmurHash3); comutatorul e kill switch-ul
- **Status:** approved
- **Rule:** Bucket = `murmur3_32(utf8(flag_key + ":" + user_id), seed 0) % 100`, un întreg
  0..99 (MurmurHash3 x86 pe 32 de biți, scris în repo, fără dependență, același cod în SDK și
  pe server; vectorii de referință din `sdk/test` fixează formula). `flag_key` sau `user_id`
  care nu sunt string aruncă `TypeError`. Un flag oprit servește valoarea implicită. Un flag pornit verifică
  întâi regulile de targetare, în ordine (operatori `equals` și `in`, pe atributele
  utilizatorului), apoi intervalele: fiecare variantă are un interval din [0, 100); la un flag
  boolean, rollout N% = intervalul 0–N e pornit, deci creșterea rollout-ului păstrează
  utilizatorii deja incluși. Comutatorul Pornit / Oprit din dashboard este kill switch-ul:
  acționează pe mediul selectat, cere confirmare în prod și scrie în jurnalul de audit.
- **Why:** un singur control și un singur bucket sunt cel mai puțin de construit și de testat;
  hash-ul trebuie să ruleze sincron și identic în browser și în Node.
- **Evidence:** user, 2026-11-18; Q-011, Q-013, Q-014, Q-021. Formula și bucket-ul întreg: plan „bucketing determinist”, aprobat 2026-11-18.
- **Confirmed:** 2026-11-27

## D-005 · Evenimente: un batch cu expuneri, conversii și numărul de evaluări
- **Status:** approved
- **Rule:** SDK-ul trimite un singur fel de batch, cu evenimente de expunere, conversie și
  numărul de evaluări per flag, fiecare cu id de eveniment (ingestie idempotentă). O expunere
  contează o dată per utilizator și experiment. O conversie contează o dată per utilizator și
  experiment, și doar după prima expunere; rata = utilizatori care au convertit / utilizatori
  expuși. Numărul de evaluări actualizează `last_evaluated_at` per flag și mediu, din care se
  calculează flag-urile stale.
- **Why:** evaluarea e locală (D-003), deci serverul află de evaluări doar din SDK; testul z
  pe două proporții (D-001) cere conversii unice per utilizator.
- **Evidence:** user, 2026-11-18; Q-012, Q-020.
- **Confirmed:** 2026-11-27

## D-006 · P1: o pagină cu locuri simulate, utilizator anonim
- **Status:** approved
- **Rule:** P1 este o singură pagină (DS-web2-parking) cu locuri de parcare simulate (liber /
  ocupat) și butonul „Rezervă locul”, pe care rulează experimentul. Rezervările stau în
  memorie sau în `localStorage`; P1 nu are backend propriu. `user_id` e un id anonim aleator,
  creat la prima vizită și ținut în `localStorage`; P1 nu cere și nu păstrează date personale.
- **Why:** minimul necesar pentru experiment în bugetul de 15–20 h, fără date personale.
- **Evidence:** user, 2026-11-18; Q-016, Q-017.
- **Confirmed:** 2026-11-27

## D-007 · Structura repo-ului, proiectele și publicarea SDK-ului
- **Status:** approved
- **Rule:** Patru foldere la rădăcină: `server/` (API Express, SSE, ingestie; servește
  `dashboard/`), `dashboard/`, `sdk/`, `p1/`, plus un singur `docker-compose.yml`. Testele stau
  lângă fiecare parte (`server/test`, `sdk/test`). Modelul de date suportă mai multe
  proiecte; dashboard-ul are un proiect deschis, schimbat din „Proiect și medii”, fără selector
  în header. SDK-ul se publică drept tarball făcut cu `npm pack` în `sdk/`, fără cont npm.
- **Why:** granițe clare între server, UI, SDK și P1; publicarea pe npm nu e necesară.
- **Evidence:** user, 2026-11-18; Q-004, Q-022, Q-023.
- **Confirmed:** 2026-11-27

## D-008 · Autentificarea adminului: parolă din variabilă de mediu, cookie de sesiune
- **Status:** approved
- **Rule:** Există un singur admin. Hash-ul parolei vine dintr-o variabilă de mediu (niciodată
  în repo sau în loguri). Login-ul reușit pune un cookie de sesiune `httpOnly`; API-ul de
  administrare și dashboard-ul îl cer. Nu există tabel de utilizatori.
- **Why:** un singur rol (README → „Simplificat față de fișă”); cel mai puțin de construit
  pentru un dashboard pus online.
- **Evidence:** user, 2026-11-18; Q-018.
- **Confirmed:** 2026-11-27

## D-010 · Versiunea configurației: un întreg per mediu
- **Status:** approved
- **Rule:** Fiecare mediu are `environments.config_version`, un întreg care începe la 1.
  Configurația servită (C-001) are `version` = această valoare, iar ETag-ul (C-002) e
  `"<config_version>"`. Orice schimbare care modifică configurația unui mediu trebuie să
  crească versiunea acelui mediu (scrierea vine cu API-ul de administrare).
- **Why:** D-003 cere `ETag = version`; o coloană pe mediu e cel mai puțin de construit și
  de testat, fără istoric al configurației (README → „Simplificat față de fișă”).
- **Evidence:** user, plan „Server: docker-compose, schema și GET /sdk/config”, 2026-11-25.
- **Confirmed:** 2026-11-27

## D-013 · P1 așteaptă configurația cel mult 5 s; cererea configurației din SDK expiră la 10 s
- **Status:** approved
- **Rule:** P1 așteaptă primul `refresh()` cel mult 5 s. Dacă răspunsul vine la timp (orice
  rezultat), citește varianta o dată cu `getVariant`. Altfel afișează controlul (`blue`) fără
  să apeleze `getVariant`, deci fără expunere, și rămâne pe control pentru acea încărcare a
  paginii chiar dacă configurația vine mai târziu. În SDK, cererea configurației (C-002) are un
  timeout de 10 s (`AbortSignal.timeout(10_000)`), ca POST-ul de evenimente (D-011): o cerere
  sau un corp fără răspuns în 10 s întoarce `'error'` din `refresh()`.
- **Why:** un server care acceptă conexiunea dar nu răspunde ținea skeleton-ul pe ecran
  oricât (review-ul de performanță al PR-ului #15); o expunere fără ca utilizatorul să fi văzut
  varianta ar strica experimentul (D-005).
- **Evidence:** user, review-ul PR-ului #15, 2026-11-25; nota din Q-005 (2026-11-25).
- **Confirmed:** 2026-11-27

## D-014 · Hosting: serverul pe Render, baza pe Neon, P1 pe aceeași origine
- **Status:** approved
- **Rule:** Serverul rulează pe Render (web service gratuit, Docker din `server/Dockerfile`,
  contextul = rădăcina repo-ului, branch `main`, regiunea Frankfurt, health check `/p1/`).
  Auto-deploy e oprit: un deploy se face manual (Manual Deploy) și doar cu acordul userului.
  Baza de date e pe Neon (gratuit, PostgreSQL 17, Frankfurt), cu TLS:
  `DATABASE_URL` se termină în `?sslmode=verify-full`. Serverul servește P1 pe aceeași
  origine, doar o listă fixă: `p1/index.html`, `p1/styles.css`, `p1/src/*` și `sdk/src/*`;
  niciodată rădăcina repo-ului, `.env`, testele sau fișierele `package.json`. Imaginea nu
  conține `p1/config.js` și `p1/test` (`.dockerignore`). Secretele (`DATABASE_URL`) stau doar
  în variabilele de mediu Render; seed-ul pe Neon îl rulează userul, de pe mașina lui.
- **Why:** colegii trebuie să poată folosi P1 online, gratuit. Pe aceeași origine, POST-ul
  `keepalive` de la `pagehide` nu are nevoie de preflight CORS (nota din Q-005). Render Shell
  și job-urile one-off sunt plătite, deci seed-ul rulează local.
- **Evidence:** user, plan „Host the server and P1 (Render + Neon)”, 2026-11-26 (auto-deploy oprit,
  regiunea, health check-ul, seed-ul rulat de user); C-004, C-005.
- **Confirmed:** 2026-11-27

## D-015 · P1: SDK-ul din sursă; cheia din `p1/config.js` local sau din `P1_SDK_KEY` pe server; track doar la rezervare validă
- **Status:** approved
- **Rule:** `p1/` importă `../sdk/src/index.js` ca modul ES și `../config.js` pentru `sdkKey`
  și `baseUrl`. Local, cu un server static legat la `127.0.0.1`, `p1/config.js` e ignorat de
  git; `p1/config.example.js` e în repo. Când P1 e servit de serverul nostru (D-014, și local
  la `127.0.0.1:3000/p1/`), `GET /p1/config.js` e generat din variabila de mediu `P1_SDK_KEY`
  (cheia prod creată de seed pe baza respectivă), cu `baseUrl = location.origin`, cheia scrisă
  cu `JSON.stringify` și `Cache-Control: no-cache`; fără `P1_SDK_KEY` → `404`, iar P1 afișează
  controlul. P1 apelează `track("reserve_click")` doar la o rezervare validă (un loc liber
  ales), niciodată la un click invalid.
- **Why:** un host construit din git nu are `p1/config.js`; cheia e publică (C-002), dar e
  creată de seed per bază de date, deci nu se scrie în repo. Restul, ca în D-012.
- **Evidence:** user, plan „Host the server and P1 (Render + Neon)”, 2026-11-26; înlocuiește D-012.
- **Confirmed:** 2026-11-27

## D-016 · Experimentul `reserve-button-color` rulează 7 zile; până la final, fără deploy pe `p1/` sau `sdk/` și fără schimbări la flag
- **Status:** approved
- **Rule:** Experimentul `reserve-button-color` (P1, metrica `reserve_click`) rulează de la
  2026-11-26 08:05 până la 2026-12-03 08:05, ora României (Europe/Bucharest; 06:05 UTC), pe
  https://web2-lab-0c75.onrender.com/p1/. Până la final: niciun deploy care schimbă ceva în `p1/` sau `sdk/`
  (serverul importă `sdk/src`, deci și un deploy al serverului cu schimbări în `sdk/` e oprit),
  și nicio schimbare la flag-ul `reserve-button-color` sau la experimentul lui (setări, variante,
  metrică), nici în cod, nici în baza de pe Neon. Nici rândurile din `exposures`, `conversions`
  și `ingested_events` din Neon nu se șterg și nu se modifică; interogările `SELECT` (doar citire)
  sunt permise. Schimbările pe aceste părți se pot construi și merge-ui, dar nu se pun online
  până la final.
- **Why:** o schimbare în pagină, în SDK sau în alocare în timpul experimentului ar amesteca două
  variante ale testului și ar strica rezultatul (D-001, D-005).
- **Evidence:** user, 2026-11-26: primul deploy făcut, experimentul pornit la 08:05, evenimentele de
  test șterse în Neon înainte de start; user, 2026-11-26: fără ștergeri sau modificări în
  `exposures`, `conversions`, `ingested_events` până la final, `SELECT` permis.
- **Confirmed:** 2026-11-27

## D-017 · CI: GitHub Actions rulează testele SDK, P1, dashboard și server; fără deploy
- **Status:** approved
- **Rule:** `.github/workflows/test.yml` rulează testele din `sdk/`, `p1/`, `dashboard/` și `server/`
  la fiecare push pe `main` și la fiecare pull request, pe Node 24 (ca `server/Dockerfile`). Testele
  serverului folosesc un container de serviciu `postgres:17-alpine` cu baza `web2_test`
  (PATTERN-004), cu autentificare `trust`, deci fără parolă în fișier. CI-ul nu are secrete și
  nu face niciodată deploy.
- **Why:** testele rulează la fiecare PR, nu doar local; deploy-ul rămâne manual, cu acordul
  userului (D-014), iar în timpul experimentului e oprit (D-016).
- **Evidence:** user, plan „CI with GitHub Actions”, 2026-11-26 (trigger-ele: push pe `main` și PR);
  user, plan „README.md describes the finished project”, 2026-11-27 (testele dashboard-ului, deja în
  `test.yml`, intră în regulă).
- **Confirmed:** 2026-11-27

## D-018 · API-ul SDK-ului: D-011 plus actualizări live (SSE, polling), cache local și starea `stale`
- **Status:** approved
- **Rule:** Tot ce spune D-011 rămâne valabil. În plus:
  - `init({ sdkKey, baseUrl, config?, storage? })`: `storage` e implicit `localStorage`, citit
    într-un try (PATTERN-006); `null` = fără cache.
  - Cache: `{etag, config}` sub cheia `ff:config:<sdkKey>`, salvat la fiecare `refresh()` cu
    `'updated'`. La `init`, fără `config`, un cache valid (C-001, `etag` string sau `null`) devine
    configurația curentă și ETag-ul ei; un cache invalid sau ilizibil se ignoră. Un `config` dat
    la `init` câștigă în fața cache-ului.
  - `connect()`: un `EventSource` pe C-006 (fără `EventSource` global → polling imediat). O
    versiune mai nouă decât configurația curentă (sau orice versiune, fără configurație) →
    `refresh()`; datele care nu sunt un întreg se ignoră. După o eroare, SDK-ul închide stream-ul
    și îl redeschide după 3 s. A 3-a eroare la rând, fără `open` între ele (prima încercare
    contează), trece pe polling: `refresh()` imediat, apoi la 30 s, până la `close()`; nu se mai
    întoarce la SSE. `connect()` de două ori deschide un singur stream.
  - `close()` oprește stream-ul, reconectarea în așteptare și polling-ul.
  - `status()` → `'ok' | 'stale'`: `'stale'` când au trecut 60 s de la `init` sau de la ultima
    confirmare. Confirmă: `open`, un mesaj `version` valid, un `refresh()` cu `'updated'` sau
    `'not-modified'`. Nu confirmă: `'error'`, `'rejected'`, configurația din cache.
- **Why:** D-003 (SSE cu fallback la polling, cache pentru offline, starea `stale`); `connect()`
  explicit lasă `init` și P1 neschimbate; reconectarea făcută de SDK face numărarea eșecurilor
  deterministă.
- **Evidence:** user, plan „Live configuration updates (SSE, polling fallback, local cache, stale
  state)”, 2026-11-26 (versiunea citită la 15 s, `connect`/`close`/`status`, fără întoarcere la
  SSE, P1 neschimbat, cele cinci presupuneri). Înlocuiește D-011.
- **Confirmed:** 2026-11-27

## D-019 · Sesiunea adminului: hash scrypt din `ADMIN_PASSWORD_HASH`, token în memorie 8 h
- **Status:** approved
- **Rule:** Hash-ul parolei (D-008) stă în variabila de mediu `ADMIN_PASSWORD_HASH`, în forma
  `scrypt:<salt hex>:<hash hex>` (fără `$`, pe care Docker Compose l-ar interpola), generat cu
  `npm run hash-password` în `server/` (`node:crypto` scrypt, comparat cu `timingSafeEqual`, fără
  dependență nouă), care refuză o parolă sub 12 caractere. Login-ul are limita din C-007 (Q-038). Login-ul reușit creează un token aleator de 256 de biți, ținut în memoria
  serverului 8 h; cookie-ul e `ff_admin=<token>; HttpOnly; Secure; SameSite=Strict; Path=/;
  Max-Age=28800`. Un restart (sau oprirea Render pe planul gratuit) pierde sesiunile: adminul se
  loghează din nou. Fără `ADMIN_PASSWORD_HASH` (sau cu o valoare greșită) serverul pornește, scrie
  în log doar numele variabilei, iar login-ul răspunde `503`. API-ul de administrare (C-007) nu are
  CORS, iar scrierile cer `Content-Type: application/json`, deci un formular de pe alt site nu le
  poate trimite.
- **Why:** D-008 lasă mecanismul deschis; o sesiune în memorie nu cere un secret nou și nici o
  dependență, iar un singur admin acceptă o relogare după restart.
- **Evidence:** user, plan „Admin API, dashboard login and the flags screen”, 2026-11-26 (în memorie,
  8 h; D-019 aprobat); user, review-ul de securitate al PR-ului #20, 2026-11-26 (parola de cel puțin
  12 caractere).
- **Confirmed:** 2026-11-27

## D-020 · Scrierile configurației: o tranzacție cu versiunea și auditul; citirile `REPEATABLE READ`
- **Status:** approved
- **Rule:** Fiecare schimbare din API-ul de administrare (C-007) e o singură tranzacție: rândul din
  `flag_environments` blocat (`FOR UPDATE`), actualizat, `environments.config_version + 1` (D-010) și
  un rând în `audit_log` (acțiunea, valoarea dinainte și de după, versiunea nouă). O valoare deja
  setată nu schimbă nimic: fără versiune nouă, fără rând de audit. O eroare anulează tot.
  `buildConfig` citește versiunea și flag-urile într-o singură tranzacție `REPEATABLE READ READ ONLY`,
  pe un singur client, deci o configurație servită are mereu flag-urile versiunii din ETag.
- **Why:** Q-028: o scriere încheiată între cele două citiri ar servi flag-uri noi cu ETag-ul vechi
  (D-003, C-002); jurnalul de audit e cerut de D-004 și de README.
- **Evidence:** user, plan „Admin API, dashboard login and the flags screen”, 2026-11-26 (Q-028
  confirmat explicit, D-020 aprobat).
- **Confirmed:** 2026-11-27

## D-021 · Statistica rezultatelor: controlul e valoarea implicită; p cu SE comun, IC Wald, eșantion minim clasic
- **Status:** approved
- **Rule:** Controlul unui experiment e valoarea implicită (`default`) a flag-ului. Fiecare altă
  variantă se compară cu controlul, separat, fără corecție pentru comparații multiple. Diferența =
  rata variantei − rata controlului. p-value: test z pe două proporții, bilateral, cu eroarea
  standard comună (pooled). Intervalul de încredere de 95%: Wald, cu eroarea standard necomună.
  Eșantionul minim per variantă: `n = ⌈(z₀,₉₇₅·√(2p̄q̄) + z₀,₈·√(p₁q₁ + p₂q₂))² / δ²⌉`, cu
  p₁ = rata de bază, p₂ = p₁ + MDE, p̄ = (p₁ + p₂) / 2 (294 pentru 20% / +10 pp). Eșantionul minim
  e atins când ambele grupuri au cel puțin n utilizatori expuși. Un grup fără expuneri → diferență,
  IC și p `null`; o eroare standard comună 0 (0% sau 100% în ambele) → p `null`; ambele înseamnă
  „nu e semnificativ încă”. Rata de bază și MDE stau per experiment (`experiments.baseline_rate`,
  `experiments.mde`, implicit 0,20 și 0,10); editarea lor e Q-042.
- **Why:** D-001 lasă formulele deschise; ele fixează valorile de referință din teste. P1 tratează
  deja `blue` (valoarea implicită) drept control (D-013).
- **Evidence:** user, plan „Experiment results”, 2026-11-26 (controlul = `default`, fiecare variantă
  față de control, formula clasică cu 294, editarea mai târziu; D-021 aprobat).
- **Confirmed:** 2026-11-27
