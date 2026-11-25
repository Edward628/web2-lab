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
- Q-002 · Which test runner and linter do the labs use, if any?
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
- **Status:** open
- **Blocks:** tests first in /build; the test check in the definition of done
- **Who answers:** the user
- **Proposed answer:**
- **Answer:** partial, 2026-11-18 (user): tests use `node --test` (D-002). Linter: not chosen yet.
- **Recorded as:** D-002

## Q-003 · How do we screenshot this app?
- **Status:** open
- **Blocks:** the screenshot step in /build and DESIGN.md; the screenshot command in AGENTS.md section 2
- **Who answers:** the user, once the stack is chosen (Q-001)
- **Proposed answer:**
- **Answer:**
- **Recorded as:**

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
- **Recorded as:**

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
- **Answer:**
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

## Q-025 · Cerința de 25 de commit-uri pe 8 zile vine din fișă?
- **Status:** open
- **Blocks:** planificarea (Q-008); README nu o menționează
- **Who answers:** the user (fișa proiectului)
- **Proposed answer:**
- **Answer:**
- **Recorded as:**
