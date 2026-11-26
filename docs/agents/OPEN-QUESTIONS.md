# Open questions — web2-lab

<!-- graffino-agentic:begin v1 -->
> Unknowns. Work that depends on an open question is out of scope until it is
> answered. Only the user answers; an agent never answers by guessing. An agent may
> write a `Proposed answer` the evidence supports; the question stays
> `investigating` until the user confirms it.
> Answered entries stay, with the answer and date, and usually become a D- or PATTERN-.
<!-- graffino-agentic:end -->

## Index
- Q-001 · Which stack does web2-lab use, and how is it installed, run and built? · _answered_
- Q-002 · Which test runner and linter do the labs use, if any? · _answered_
- Q-003 · How do we screenshot this app?
- Q-004 · How are the labs laid out in the repo (one folder per lab, one shared app, …)? · _answered_
- Q-005 · How is lab work handed in or deployed (git remote, hosting, branches, tags)?
- Q-006 · What are the design tokens (colors, fonts, spacing), and is there a design board?
- Q-007 · Care e a doua aplicație reală (proiectul colegului) și e colegul de acord?
- Q-026 · Cum include SDK-ul o aplicație fără npm (Thymeleaf, P07)?
- Q-027 · Ce `user_id` trimite P07 SDK-ului?
- Q-008 · Care e data predării finale și a susținerii?
- Q-009 · Acceptă profesorul scope-ul redus (15–20 h în loc de ~40 h)?
- Q-010 · Poate P1 să fie o aplicație nouă, construită în acest proiect?
- Q-011 · Ce face butonul „Kill switch” față de comutatorul Pornit / Oprit din listă? · _answered_
- Q-012 · De unde știe serverul când a fost evaluat ultima dată un flag (flag stale)? · _answered_
- Q-013 · Cum se combină rollout-ul și alocarea pe variante? · _answered_
- Q-014 · Ce funcție de hash folosește bucketing-ul? · _answered_
- Q-015 · Cu ce rată de bază și efect minim se calculează eșantionul minim? · _answered_
- Q-016 · Cum identifică P1 un utilizator (user_id)? · _answered_
- Q-017 · Ce face aplicația P1? · _answered_
- Q-018 · Cum se autentifică adminul în dashboard? · _answered_
- Q-019 · Unde se scriu schimbările în SDK cerute de fișă (`DECISIONS.md`)? · _answered_
- Q-020 · O conversie se numără o dată per utilizator sau la fiecare click? · _answered_
- Q-021 · Ce operatori au regulile de targetare? · _answered_
- Q-022 · Gestionează dashboard-ul mai multe proiecte? · _answered_
- Q-023 · Cum se publică SDK-ul? · _answered_
- Q-024 · După câte zile e semnalat un flag „100% într-o direcție”?
- Q-025 · Cerința de 25 de commit-uri pe 8 zile vine din fișă?
- Q-028 · Cum citește serverul versiunea și flag-urile unui mediu consistent, când există scrieri? · _answered_
- Q-029 · Ce are voie să conțină configurația publică, și cât de aleatoare sunt cheile SDK?
- Q-030 · Câte evenimente ține SDK-ul în coadă cât e offline, și ce aruncă la coada plină?
- Q-031 · Cum evită ingestia blocarea pe rândurile `flag_environments` la 1.000 de evenimente/s?
- Q-032 · Acceptăm deadlock-urile între batch-uri care scriu aceleași chei în ordini diferite?
- Q-033 · Cât timp păstrăm id-urile de eveniment din `ingested_events`?
- Q-034 · Ce se întâmplă cu o conversie care ajunge înaintea batch-ului cu expunerea ei? · _answered_
- Q-035 · Ce face starea de eroare „Locul tocmai a fost ocupat” într-un P1 fără backend? · _answered_
- Q-036 · Ce sugestii din review-ul PR-ului #15 (P1) construim mai târziu?
- Q-037 · Câte stream-uri deschise acceptă serverul înainte de `503` (C-006)?
- Q-038 · Câte încercări de login acceptă serverul, și ce face peste limită? · _answered_
- Q-039 · Editează API-ul de administrare și alocarea pe variante a unui flag multivariat?
- Q-040 · Ce proiect deschide dashboard-ul până există ecranul „Proiect și medii”?
- Q-041 · Ce serviciu Cloudflare trebuie integrat, și de ce?

---

## Q-001 · Which stack does web2-lab use, and how is it installed, run and built?
- **Status:** answered
- **Blocks:** AGENTS.md section 2 commands; any code; the build check in the definition of done
- **Who answers:** the user (course requirements)
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): Node.js + JavaScript, Express, PostgreSQL, Docker Compose.
  Whether the course imposes a stack is still unknown; if it does, D-002 is superseded.
  Install/run/build commands are added to AGENTS.md once they exist.
- **Recorded as:** D-002

## Q-002 · Which test runner and linter do the labs use, if any?
- **Status:** answered
- **Blocks:** tests first in /build; the test check in the definition of done
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): tests use `node --test` (D-002). 2026-11-25 (user): no
  linter for now.
- **Recorded as:** D-002; AGENTS.md section 2

## Q-003 · How do we screenshot this app?
- **Status:** open
- **Blocks:** the screenshot step in /build and DESIGN.md; the screenshot command in AGENTS.md section 2
- **Who answers:** the user, once the stack is chosen (Q-001)
- **Proposed answer:**
- **Answer:**
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-004 · How are the labs laid out in the repo (one folder per lab, one shared app, …)?
- **Status:** answered
- **Blocks:** AGENTS.md section 3; where new code goes
- **Who answers:** the user (course requirements)
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): the whole repo is the feature flags and A/B testing
  project (not one folder per lab). Four top-level folders: `server/` (Express API, SSE,
  ingest), `dashboard/` (static HTML/JS served by the server), `sdk/` (the package),
  `p1/` (the parking app, static). Tests sit next to each part (`server/test`,
  `sdk/test`). One Docker Compose file at the root.
- **Recorded as:** AGENTS.md section 3; D-007

## Q-005 · How is lab work handed in or deployed (git remote, hosting, branches, tags)?
- **Status:** open
- **Blocks:** how a lab is handed in; any tag or deploy
- **Who answers:** the user (course requirements)
- **Proposed answer:**
- **Answer:** partial, 2026-11-12 (user): the code lives on GitHub,
  `https://github.com/Edward628/web2-lab` (public), remote `origin`, branch `main`.
  Still open: how labs are handed in, and whether anything is deployed or tagged.
  For the hosting plan, 2026-11-25 (user): serve only `p1/` and `sdk/src`, never the repo
  root (it holds `.env`); consider a ~5 s timeout on P1's first `refresh()` that falls back
  to the control (blue) without an exposure. 2026-11-25 (user): serving P1 from the same
  origin as the server would avoid the CORS preflight on the `keepalive` event POST sent at
  `pagehide` (some browsers do not preflight keepalive requests).
  Hosting answered, 2026-11-26 (user): the server on Render (Docker, auto-deploy off, manual deploy
  with the user's go), PostgreSQL on Neon, P1 served from the server's origin (D-014, D-015).
  Live, 2026-11-26 (user): first deploy done, P1 at https://web2-lab-0c75.onrender.com/p1/, checked in a browser. The
  experiment runs 2026-11-26 08:05 – 2026-12-03 08:05 Europe/Bucharest; test events cleared in
  Neon before it started; deploy freeze until then (D-016).
  Still open: how labs are handed in, and any tag.
- **Recorded as:** D-014, D-015 (hosting), D-016 (experiment freeze)
- **Confirmed:** 2026-11-26

## Q-006 · What are the design tokens (colors, fonts, spacing), and is there a design board?
- **Status:** open
- **Blocks:** the token tables in docs/design/DESIGN.md; the first mock and the first styled screen
- **Who answers:** the user (or the course brief)
- **Proposed answer:**
- **Answer:** partial, 2026-11-18 (user): tokens approved (one set for dashboard and P1;
  sober, technical; indigo accent; system font). No design board yet.
- **Recorded as:** docs/design/DESIGN.md → Tokens

## Q-007 · Care e a doua aplicație reală (proiectul colegului) și e colegul de acord?
- **Status:** open
- **Blocks:** integrarea SDK-ului în a doua aplicație; interviul de DX (INTERVIEW.md); cele 2 schimbări în SDK
- **Who answers:** the user, după ce vorbește cu un coleg
- **Proposed answer:**
- **Answer:** partial, 2026-11-25 (user): un coleg a fost de acord; aplicația lui este
  proiectul P07 „Când vine autobuzul?” (Tursib Sibiu). Stack (din fișa lui): Java 21,
  Spring Boot, Thymeleaf randat pe server, Leaflet pentru hartă (singurul JavaScript
  consistent), PostgreSQL + PostGIS, Docker Compose; hosting Render + Neon; are login
  (USER / ADMIN). Încă necunoscute: URL-ul live, ce funcție pune sub flag, ce `user_id`
  trimite (Q-027), cum include SDK-ul fără npm (Q-026).
  Update 2026-11-25 (user): aplicația colegului nu e gata încă; integrarea în P07 se face
  după ce o termină, iar până atunci studentul își construiește partea lui.
- **Recorded as:**

## Q-026 · Cum include SDK-ul o aplicație fără npm (Thymeleaf, P07)?
- **Status:** open
- **Blocks:** integrarea în P07; D-007 (SDK publicat doar ca tarball `npm pack`)
- **Who answers:** the user
- **Proposed answer:** pe lângă tarball, `sdk/` produce și un singur fișier JS pentru
  `<script>` (expune `window.FF`), pe care P07 îl copiază în `static/` sau îl încarcă de la
  serverul de flag-uri. Ar schimba D-007, deci ar fi un PROPOSAL.
- **Answer:**
- **Recorded as:**
- **Confirmed:** 2026-11-25

## Q-027 · Ce `user_id` trimite P07 SDK-ului?
- **Status:** open
- **Blocks:** bucketing-ul stabil în P07; regula „fără date personale”
- **Who answers:** the user, cu colegul
- **Proposed answer:** un id anonim aleator în `localStorage` (ca P1, D-006) pentru
  vizitatori; pentru utilizatorii logați, un id opac (nu email, nu username).
- **Answer:**
- **Recorded as:**

## Q-008 · Care e data predării finale și a susținerii?
- **Status:** open
- **Blocks:** planificarea experimentului de 7 zile și a celor 25 de commit-uri pe 8 zile
- **Who answers:** the user (profesorul)
- **Proposed answer:**
- **Answer:** partial, 2026-11-26 (user, de la profesor): predarea era marți 2026-12-01, dar
  se acceptă o amânare, fără o durată precizată. Ținta: totul gata pe 2026-12-03, după ce se
  încheie experimentul (D-016, 08:05 Europe/Bucharest). Încă deschis: data exactă a predării
  după amânare și data susținerii.
- **Recorded as:**

## Q-009 · Acceptă profesorul scope-ul redus (15–20 h în loc de ~40 h)?
- **Status:** open
- **Blocks:** dacă rămân pe dinafară: rolurile developer/cititor, SDK-ul pentru Node, segmentele salvate, istoricul configurației (README → „Simplificat față de fișă”)
- **Who answers:** the user (profesorul)
- **Proposed answer:**
- **Answer:**
- **Recorded as:**

## Q-010 · Poate P1 să fie o aplicație nouă, construită în acest proiect?
- **Status:** open
- **Blocks:** aplicația 1 în care se integrează SDK-ul și se rulează experimentul
- **Who answers:** the user (profesorul)
- **Proposed answer:**
- **Answer:** partial, 2026-11-18 (user): nu există un P1 real; studentul vrea să construiască o aplicație mică de parcare, pusă online, folosită de colegii de grupă. De confirmat că fișa acceptă asta.
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-011 · Ce face butonul „Kill switch” față de comutatorul Pornit / Oprit din listă?
- **Status:** answered
- **Blocks:** DS-web2-flags; API-ul de oprire a unui flag
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): comutatorul ESTE kill switch-ul. Oprit = toți utilizatorii
  primesc valoarea implicită, în mediul selectat, cu confirmare în prod și intrare în jurnalul
  de audit. Butonul separat „Kill switch” dispare din mock.
- **Recorded as:** D-004; docs/design/mocks/DS-web2-flags.html

## Q-012 · De unde știe serverul când a fost evaluat ultima dată un flag (flag stale)?
- **Status:** answered
- **Blocks:** detecția flag-urilor stale; formatul batch-ului de evenimente
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): SDK-ul numără evaluările per flag și le trimite în același
  batch cu evenimentele de expunere și conversie. Serverul ține `last_evaluated_at` per flag
  și mediu.
- **Recorded as:** D-005

## Q-013 · Cum se combină rollout-ul și alocarea pe variante?
- **Status:** answered
- **Blocks:** evaluarea în SDK și pe server; vectorii de referință
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): un singur bucket per utilizator și flag. Fiecare variantă
  are un interval din [0, 100) (de exemplu `blue` 0–50, `green` 50–100). La un flag boolean,
  rollout N% = intervalul 0–N e pornit, deci creșterea rollout-ului păstrează utilizatorii
  deja incluși. Regulile de targetare se verifică întâi, apoi intervalele.
- **Recorded as:** D-004

## Q-014 · Ce funcție de hash folosește bucketing-ul?
- **Status:** answered
- **Blocks:** bucketing; vectorii de referință
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): MurmurHash3 pe 32 de biți, scris în repo (fără dependență),
  același cod în SDK și pe server. Formula exactă (separator, modulo) se fixează împreună cu
  vectorii de referință.
- **Recorded as:** D-004

## Q-015 · Cu ce rată de bază și efect minim se calculează eșantionul minim?
- **Status:** answered
- **Blocks:** rezultatele experimentului (D-001)
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): implicit rată de bază 20% și efect minim detectabil +10
  puncte procentuale (~290 de utilizatori per variantă), editabile per experiment. Cu o grupă
  de ~30 de colegi, rezultatul real va arăta „nu e semnificativ încă”; `EXPERIMENT.md`
  explică de ce. Statistica e dovedită prin teste pe date cunoscute.
- **Recorded as:** D-001

## Q-016 · Cum identifică P1 un utilizator (user_id)?
- **Status:** answered
- **Blocks:** P1; bucketing-ul în P1
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): id anonim aleator, creat la prima vizită și ținut în
  `localStorage`. Fără date personale, fără login. Aceeași persoană pe două dispozitive
  contează de două ori.
- **Recorded as:** D-006

## Q-017 · Ce face aplicația P1?
- **Status:** answered
- **Blocks:** DS-web2-parking; folderul `p1/`
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): o singură pagină cu locuri de parcare simulate (liber /
  ocupat) și butonul „Rezervă locul” (experimentul). Rezervările stau în memorie sau în
  `localStorage`; P1 nu are backend propriu.
- **Recorded as:** D-006

## Q-018 · Cum se autentifică adminul în dashboard?
- **Status:** answered
- **Blocks:** DS-web2-login; protecția API-ului de administrare
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): un singur admin; hash-ul parolei vine dintr-o variabilă de
  mediu (niciodată în repo); login-ul pune un cookie de sesiune `httpOnly`. Fără tabel de
  utilizatori.
- **Recorded as:** D-008

## Q-019 · Unde se scriu schimbările în SDK cerute de fișă (`DECISIONS.md`)?
- **Status:** answered
- **Blocks:** predarea interviului de DX
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): într-un `DECISIONS.md` separat, la rădăcina repo-ului,
  lângă `EXPERIMENT.md` și `INTERVIEW.md`, scris de student în română, pentru profesor.
  Ledger-ul din `docs/agents/` rămâne pentru agenți; fiecare schimbare în SDK primește și o
  intrare D- care trimite la el.
- **Recorded as:** README.md → „Partea umană”

## Q-020 · O conversie se numără o dată per utilizator sau la fiecare click?
- **Status:** answered
- **Blocks:** ingestia evenimentelor; rezultatele experimentului
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): o dată per utilizator și experiment, și doar după prima
  expunere. Rata = utilizatori care au convertit / utilizatori expuși (cerut de testul z din
  D-001).
- **Recorded as:** D-005

## Q-021 · Ce operatori au regulile de targetare?
- **Status:** answered
- **Blocks:** editorul de reguli; evaluarea
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): `equals` și `in` (în listă), pe atributele utilizatorului.
- **Recorded as:** D-004

## Q-022 · Gestionează dashboard-ul mai multe proiecte?
- **Status:** answered
- **Blocks:** modelul de date; DS-web2-settings
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): modelul de date suportă mai multe proiecte; dashboard-ul
  deschide un proiect, iar „Proiect și medii” permite crearea și schimbarea lui. Fără
  selector de proiect în header.
- **Recorded as:** D-007

## Q-023 · Cum se publică SDK-ul?
- **Status:** answered
- **Blocks:** integrarea în P1 și în aplicația colegului
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-18 (user): tarball făcut cu `npm pack` în `sdk/`; P1 și colegul îl
  instalează din fișier sau din URL-ul GitHub. Fără cont npm.
- **Recorded as:** D-007

## Q-024 · După câte zile e semnalat un flag „100% într-o direcție”?
- **Status:** open
- **Blocks:** detecția flag-urilor 100% într-o direcție (mock-ul arată „de 45 de zile” doar ca exemplu)
- **Who answers:** the user
- **Proposed answer:** 30 de zile, ca la flag-urile stale; „100%” = rollout 100% pornit,
  0% (oprit) sau o variantă cu intervalul întreg.
- **Answer:**
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-025 · Cerința de 25 de commit-uri pe 8 zile vine din fișă?
- **Status:** open
- **Blocks:** planificarea (Q-008); README nu o menționează
- **Who answers:** the user (fișa proiectului)
- **Proposed answer:**
- **Answer:**
- **Recorded as:**

## Q-028 · Cum citește serverul versiunea și flag-urile unui mediu consistent, când există scrieri?
- **Status:** answered
- **Blocks:** planul API-ului de administrare (scrierile care cresc `config_version`, D-010)
- **Who answers:** the user, în planul API-ului de administrare
- **Proposed answer:** `buildConfig` (`server/src/config.js`) citește versiunea și flag-urile
  în două interogări separate. Odată ce există scrieri, una care se încheie între ele ar servi
  flag-urile noi cu ETag-ul vechi (D-003, C-002). Ambele citiri într-o singură tranzacție
  `REPEATABLE READ`, pe un singur client. Azi nu se poate întâmpla: nu există scrieri.
- **Answer:** 2026-11-26 (user, plan „Admin API, dashboard login and the flags screen”): răspunsul propus,
  confirmat explicit: `buildConfig` citește versiunea și flag-urile într-o singură tranzacție
  `REPEATABLE READ READ ONLY`, pe un singur client; fiecare scriere e o singură tranzacție.
- **Recorded as:** D-020
- **Confirmed:** 2026-11-26

## Q-029 · Ce are voie să conțină configurația publică, și cât de aleatoare sunt cheile SDK?
- **Status:** open
- **Blocks:** editorul de reguli; generarea cheilor SDK în API-ul de administrare
- **Who answers:** the user
- **Proposed answer:** cheia SDK e publică (C-002), deci oricine vede tot ce e în regulile unui
  mediu, inclusiv valorile de targetare. Regulile nu conțin date personale (email, nume, id-uri
  reale), ca la D-006. Cheile SDK se generează cu cel puțin 128 de biți aleatori, ca să nu poată
  fi ghicite (`404` vs `200` arată dacă o cheie există).
- **Answer:** partial, 2026-11-25 (user): cheile SDK au 128 de biți aleatori (32 de cifre hex),
  începând cu seed-ul ParkingLot. Încă deschis: ce au voie să conțină regulile.
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-030 · Câte evenimente ține SDK-ul în coadă cât e offline, și ce aruncă la coada plină?
- **Status:** open
- **Blocks:** o limită a cozii de evenimente în SDK (D-011); azi coada crește fără limită
- **Who answers:** the user
- **Proposed answer:**
- **Answer:**
- **Recorded as:**

## Q-031 · Cum evită ingestia blocarea pe rândurile `flag_environments` la 1.000 de evenimente/s?
- **Status:** open
- **Blocks:** planul testului de încărcare (README → ingestie „cu un test de încărcare documentat”)
- **Who answers:** the user, în planul testului de încărcare
- **Proposed answer:** review-ul de performanță (P1): `UPDATE`-ul `evaluations`
  (`server/src/events.js`) blochează aceleași câteva rânduri pentru toate batch-urile unui mediu,
  până la `COMMIT`, după ~40 de interogări. Cu 10 conexiuni în pool și fără timeout-uri, cererile
  (inclusiv `GET /sdk/config`) așteaptă fără limită. De măsurat întâi; apoi, de exemplu, un singur
  `UPDATE` la sfârșitul tranzacției, cu cheile sortate, plus `connectionTimeoutMillis` și
  `lock_timeout`.
- **Answer:**
- **Recorded as:**

## Q-032 · Acceptăm deadlock-urile între batch-uri care scriu aceleași chei în ordini diferite?
- **Status:** open
- **Blocks:** planul testului de încărcare
- **Who answers:** the user, în planul testului de încărcare
- **Proposed answer:** review-ul de performanță (P2), plauzibil, nemăsurat: două tab-uri ale
  aceluiași utilizator pot insera aceleași expuneri în ordine inversă (sau o expunere și
  `UPDATE`-ul `evaluations`), deci PostgreSQL abandonează un batch cu `40P01` → `500`, iar SDK-ul
  îl retrimite. Nu se pierd date. Opțiuni: scrierile sortate după cheie în tranzacție, sau
  acceptat și documentat.
- **Answer:**
- **Recorded as:**

## Q-033 · Cât timp păstrăm id-urile de eveniment din `ingested_events`?
- **Status:** open
- **Blocks:** planul testului de încărcare; mărimea bazei de date
- **Who answers:** the user
- **Proposed answer:** review-ul de performanță (P3): tabelul crește fără limită (~86 M rânduri
  pe zi la 1.000 de evenimente/s), iar fiecare insert devine mai lent. O fereastră de păstrare
  (de exemplu ștergerea id-urilor mai vechi decât cel mai lung interval de retrimitere al SDK-ului)
  păstrează idempotența pentru retrimiteri.
- **Answer:**
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-034 · Ce se întâmplă cu o conversie care ajunge înaintea batch-ului cu expunerea ei?
- **Status:** answered
- **Blocks:** planul testului de încărcare; corectitudinea ratei de conversie (D-001, D-005)
- **Who answers:** the user
- **Proposed answer:** review-ul de performanță (P4): după C-003, o conversie fără expunere
  salvată se ignoră, iar id-ul ei rămâne văzut. Când batch-urile se suprapun (trimitere la 20 de
  evenimente sau la `pagehide` cât timp una e în curs) sau batch-ul cu expunerea e retrimis după
  un `500`, conversia se pierde definitiv, deci rata e subestimată. Opțiuni: SDK-ul trimite un
  singur batch o dată (D-011, partea 2); sau serverul păstrează conversiile timpurii și le numără
  când sosește expunerea (schimbă C-003, PROPOSAL); sau acceptat și documentat.
- **Answer:** 2026-11-25 (user): SDK-ul trimite o singură cerere o dată, iar evenimentele
  rămân în coadă (aceleași id-uri) până la răspuns, deci o expunere ajunge mereu înaintea
  conversiei ei. C-003 nu se schimbă. Cazurile rămase sunt acceptate și documentate: două
  tab-uri ale aceluiași utilizator trimit independent; la `pagehide` cu peste 20 de
  evenimente, bucățile pleacă în paralel, deci o conversie dintr-o bucată ulterioară își
  poate pierde expunerea.
- **Recorded as:** D-011
- **Confirmed:** 2026-11-25

## Q-035 · Ce face starea de eroare „Locul tocmai a fost ocupat” într-un P1 fără backend?
- **Status:** answered
- **Blocks:** DS-web2-parking (starea de eroare); P1
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** 2026-11-25 (user): starea de eroare dispare din DS-web2-parking. Fără backend,
  un loc nu poate fi ocupat de altcineva între timp. Mock-ul se actualizează în build-ul P1 și
  se re-aprobă.
- **Recorded as:** D-006; docs/design/mocks/DS-web2-parking.html (la build-ul P1)

## Q-036 · Ce sugestii din review-ul PR-ului #15 (P1) construim mai târziu?
- **Status:** open
- **Blocks:** nimic acum; P1 merge fără ele
- **Who answers:** the user
- **Proposed answer:** sugestiile, lăsate deoparte la cererea userului (2026-11-25):
  (1) `<link rel="modulepreload">` în `p1/index.html` pentru modulele SDK și `config.js`
  (lanț de ~6 cereri una după alta înainte de listă); (2) o rezervare existentă afișată înainte
  de cererea configurației (`p1/src/app.js`), alegere de design; (3) skeleton cu 6 locuri și
  loc pentru legendă, ca lista să nu împingă conținutul (cere re-aprobarea mock-ului);
  (4) la hosting public (Q-005): `<meta name="robots" content="noindex">` și o meta description;
  (5) un mesaj `<noscript>` (cere re-aprobarea mock-ului). De reținut: cache-ul configurației în
  `localStorage` din D-003 e construit (D-018, 2026-11-26): după deploy, offline P1 arată varianta
  din cache dacă `refresh()` răspunde în 5 s (D-013), nu controlul.
- **Answer:**
- **Recorded as:**
- **Confirmed:** 2026-11-26

## Q-037 · Câte stream-uri deschise acceptă serverul înainte de `503` (C-006)?
- **Status:** open
- **Blocks:** primul deploy după experiment (D-016) și orice `connect()` în producție
- **Who answers:** the user
- **Proposed answer:** review-ul PR-ului #19 (constatarea 1): `GET /sdk/stream`
  (`server/src/app.js`, `server/src/stream.js`) nu are nicio limită per cheie, per IP sau în total.
  Cheia SDK e publică (C-002), deci oricine poate ține deschise oricâte stream-uri, fiecare cu un
  socket și câțiva KB de memorie, fără timeout, pe instanța gratuită Render de 512 MB. Fără conexiune
  de bază de date ținută; o interogare per mediu la 15 s, oricâte stream-uri. Azi nu se întâmplă:
  P1 nu apelează `connect()`. Valoarea limitei e încă de stabilit.
- **Answer:** partial, 2026-11-26 (user): o limită pe totalul stream-urilor deschise, cu `503`
  peste o valoare fixă, se construiește înainte de primul deploy după experiment, adică înainte
  ca ceva să apeleze `connect()` în producție. Schimbă C-006 (PROPOSAL în planul ei). Încă
  deschis: valoarea fixă.
- **Recorded as:**

## Q-038 · Câte încercări de login acceptă serverul, și ce face peste limită?
- **Status:** answered
- **Blocks:** primul deploy cu API-ul de administrare (C-007), după experiment (D-016)
- **Who answers:** the user
- **Proposed answer:** `POST /admin/login` nu are nicio limită; scrypt încetinește fiecare
  încercare, dar dashboard-ul e public pe Render. De exemplu: cel mult N încercări greșite pe minut
  (per IP sau în total), apoi `429` pentru un timp fix. Valorile sunt de stabilit.
  Dovadă nouă, review-ul de securitate al PR-ului #20 (2026-11-26, constatarea 1): fără limită,
  (a) parola se poate ghici online cu zeci de încercări pe secundă, fără nimic în log; (b) fiecare
  login rulează scrypt (~16 MB, zeci de ms) pe threadpool-ul libuv (4 fire), pe care îl folosesc și
  fișierele P1 (`sendFile`, `express.static`) și `dns.lookup` la conexiunile noi spre Neon, deci un
  val de login-uri fără sesiune oprește P1, `/sdk/config` și `/sdk/stream` pe instanța de 512 MB.
  `npm run hash-password` accepta orice parolă nevidă.
- **Answer:** 2026-11-26 (user): o singură verificare scrypt o dată; cel mult 10 login-uri eșuate
  pe minut, în total, apoi `429` până se încheie minutul; `hash-password` cere cel puțin 12
  caractere. Construit în PR-ul #20, cu schimbarea C-007 aprobată.
- **Recorded as:** C-007, D-019
- **Confirmed:** 2026-11-26

## Q-039 · Editează API-ul de administrare și alocarea pe variante a unui flag multivariat?
- **Status:** open
- **Blocks:** schimbarea alocării unui experiment din dashboard (azi C-007 refuză rollout-ul pe un flag multivariat cu `400`)
- **Who answers:** the user
- **Proposed answer:**
- **Answer:**
- **Recorded as:**

## Q-040 · Ce proiect deschide dashboard-ul până există ecranul „Proiect și medii”?
- **Status:** open
- **Blocks:** DS-web2-settings; mai multe proiecte în aceeași bază
- **Who answers:** the user
- **Proposed answer:** azi C-007 folosește proiectul cu id-ul cel mai mic (singurul e ParkingLot);
  presupunere acceptată de user în planul API-ului de administrare, 2026-11-26.
- **Answer:**
- **Recorded as:**

## Q-041 · Ce serviciu Cloudflare trebuie integrat, și de ce?
- **Status:** open
- **Blocks:** orice integrare Cloudflare; orice schimbare în fața P1 live
- **Who answers:** the user (profesorul / fișa proiectului)
- **Proposed answer:**
- **Answer:** partial, 2026-11-26 (user): Cloudflare trebuie integrat. Încă necunoscut: ce
  serviciu (DNS / proxy cu domeniu propriu, Turnstile, Pages, Workers) și de ce (ce cerință
  acoperă).
- **Recorded as:**
- **Note:** de știut înainte de plan: un proxy Cloudflare cere un domeniu propriu (nu se pune
  în fața lui `onrender.com`) și poate afecta stream-ul SSE (`GET /sdk/stream`, C-006: buffering,
  timeout-uri de conexiune), cache-ul cu ETag al configurației (D-003, C-002) și limita de login
  (Q-038, C-007: o limită în total, nu per IP, dar orice logică pe IP ar vedea IP-urile
  Cloudflare). Până la 2026-12-03 08:05 Europe/Bucharest nu se schimbă nimic în fața P1 live
  (D-016: DNS, proxy, domeniu, Worker).
