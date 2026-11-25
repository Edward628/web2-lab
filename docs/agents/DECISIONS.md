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
- D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă
- D-010 · Versiunea configurației: un întreg per mediu

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
- **Confirmed:** 2026-11-18

## D-002 · Stack: Node.js (JavaScript), Express, PostgreSQL, Docker Compose
- **Status:** approved
- **Rule:** Serverul e Node.js cu JavaScript simplu (fără TypeScript) și Express; datele stau
  în PostgreSQL; serverul și baza de date pornesc cu Docker Compose. Dashboard-ul și aplicația
  P1 sunt HTML + JavaScript simplu, fără framework de UI. Testele folosesc runner-ul inclus în
  Node (`node --test`).
- **Why:** studentul știe JavaScript; SDK-ul trebuie să fie în JavaScript (fișa); serverele
  rulează în Docker (Lab Setup); bugetul de 15–20 h nu lasă loc pentru framework-uri noi.
- **Evidence:** interviu și aprobare de la user, 2026-11-18; răspunde la Q-001.
- **Confirmed:** 2026-11-18

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
- **Confirmed:** 2026-11-25

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
- **Confirmed:** 2026-11-18

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
- **Confirmed:** 2026-11-18

## D-006 · P1: o pagină cu locuri simulate, utilizator anonim
- **Status:** approved
- **Rule:** P1 este o singură pagină (DS-web2-parking) cu locuri de parcare simulate (liber /
  ocupat) și butonul „Rezervă locul”, pe care rulează experimentul. Rezervările stau în
  memorie sau în `localStorage`; P1 nu are backend propriu. `user_id` e un id anonim aleator,
  creat la prima vizită și ținut în `localStorage`; P1 nu cere și nu păstrează date personale.
- **Why:** minimul necesar pentru experiment în bugetul de 15–20 h, fără date personale.
- **Evidence:** user, 2026-11-18; Q-016, Q-017.
- **Confirmed:** 2026-11-18

## D-007 · Structura repo-ului, proiectele și publicarea SDK-ului
- **Status:** approved
- **Rule:** Patru foldere la rădăcină: `server/` (API Express, SSE, ingestie; servește
  `dashboard/`), `dashboard/`, `sdk/`, `p1/`, plus un singur `docker-compose.yml`. Testele stau
  lângă fiecare parte (`server/test`, `sdk/test`). Modelul de date suportă mai multe
  proiecte; dashboard-ul are un proiect deschis, schimbat din „Proiect și medii”, fără selector
  în header. SDK-ul se publică drept tarball făcut cu `npm pack` în `sdk/`, fără cont npm.
- **Why:** granițe clare între server, UI, SDK și P1; publicarea pe npm nu e necesară.
- **Evidence:** user, 2026-11-18; Q-004, Q-022, Q-023.
- **Confirmed:** 2026-11-18

## D-008 · Autentificarea adminului: parolă din variabilă de mediu, cookie de sesiune
- **Status:** approved
- **Rule:** Există un singur admin. Hash-ul parolei vine dintr-o variabilă de mediu (niciodată
  în repo sau în loguri). Login-ul reușit pune un cookie de sesiune `httpOnly`; API-ul de
  administrare și dashboard-ul îl cer. Nu există tabel de utilizatori.
- **Why:** un singur rol (README → „Simplificat față de fișă”); cel mai puțin de construit
  pentru un dashboard pus online.
- **Evidence:** user, 2026-11-18; Q-018.
- **Confirmed:** 2026-11-18

## D-009 · API-ul SDK-ului: init întoarce un client; citirile nu aruncă
- **Status:** approved
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
- **Confirmed:** 2026-11-25

## D-010 · Versiunea configurației: un întreg per mediu
- **Status:** approved
- **Rule:** Fiecare mediu are `environments.config_version`, un întreg care începe la 1.
  Configurația servită (C-001) are `version` = această valoare, iar ETag-ul (C-002) e
  `"<config_version>"`. Orice schimbare care modifică configurația unui mediu trebuie să
  crească versiunea acelui mediu (scrierea vine cu API-ul de administrare).
- **Why:** D-003 cere `ETag = version`; o coloană pe mediu e cel mai puțin de construit și
  de testat, fără istoric al configurației (README → „Simplificat față de fișă”).
- **Evidence:** user, plan „Server: docker-compose, schema și GET /sdk/config”, 2026-11-25.
- **Confirmed:** 2026-11-25
