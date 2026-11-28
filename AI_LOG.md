# AI_LOG — jurnalul de lucru cu agentul AI

Proiect: feature flags și experimente A/B cu SDK (web2-lab).
Agent: Claude Code, cu skill-ul Graffino (AGENTS.md, registrul din `docs/agents/`, `/plan` și `/build`).
Mod de lucru: pentru fiecare bucată, `/plan` → citesc planul și dau verdicte în tabelul
„Knowledge used” → `/build` (teste întâi) → review cu agenți separați → verific eu → PR → merge.


---

## 2026-11-18 · Interviul și scope-ul (PR #1)
**Am cerut:** să fiu intervievat, câte o întrebare, până se poate scrie scope-ul.
**Am primit:** întrebări despre aplicații, stack, timp, experiment, metoda statistică, hosting, limbă.
**Ce am făcut:**
- am ales să construiesc o aplicație nouă de parcare ca P1 și să testez culoarea butonului cu colegii de grupă;
- am ales metoda frecventistă (test z, α = 0,05) și stack-ul Node.js + Express + PostgreSQL în Docker;
- pentru bugetul de 15–20 h am ales simplificări (un singur rol, SDK doar pentru browser, fără segmente, fără istoric) și le-am notat ca întrebare pentru profesor;
- am aprobat D-001, D-002, D-003.

## 2026-11-18 · Designul (PR #2, #4)
**Am cerut:** interviu despre stil, tokens, lista de ecrane, primul mock.
**Ce am făcut:**
- am ales un stil sobru și tehnic, cu accent indigo și fontul sistemului; tema urmează sistemul, fără buton;
- am confirmat mock-ul pentru lista de flag-uri; când agentul l-a modificat (butonul separat de kill switch a dispărut, comutatorul a devenit kill switch-ul), l-am reconfirmat.

## 2026-11-18 · Bucketing-ul determinist (PR #5)
**Am primit:** MurmurHash3, cu vectori de referință dintr-o implementare independentă.
**Ce am învățat:** de ce utilizatorul din 10% rămâne înăuntru când rollout-ul crește la 30%: bucket-ul lui nu se schimbă, doar pragul crește.

## 2026-11-25 · Mock-ul de parcare și colegul cu P07 (PR #6, #7)
**Ce am făcut:**
- am cerut refacerea designului după feedback-ul profesorului („mai trebuie lucrat la design”);
- am aprobat culorile variantelor, aceleași în light și dark, ca tema să nu influențeze experimentul;
- am vorbit cu un coleg (aplicația P07, autobuze); aplicația lui nu e gata, deci integrarea vine mai târziu.

## 2026-11-25 · SDK-ul: evaluare și configurație de pe server (PR #8, #9)
**Ce am făcut:**
- am pornit un review cu trei agenți separați (performanță, securitate, SEO);
- review-ul a găsit un bug real: `getVariant(1)` arunca eroare, deși regula aprobată spunea că citirile nu aruncă niciodată; am cerut reparația cu test întâi;
- am cerut ca validarea configurației să intre în planul următor, unde configurația vine de pe rețea.

## 2026-11-25 · Serverul, evenimentele și seed-ul (PR #10, #11, #12)
**Ce am făcut:**
- descărcarea imaginii PostgreSQL s-a blocat din cauza internetului; am descărcat-o manual cu `docker pull`;
- la review am aprobat reparațiile: serverul nu mai cade dacă baza de date se repornește, porturile sunt doar locale, containerul nu rulează ca root;
- la evenimente, review-ul a găsit caractere NUL și texte prea lungi care dădeau 500 și pierdeau evenimente; am ales limita de 256 de caractere;
- am împărțit planul mare în două (server, apoi SDK).

## 2026-11-25 · Evenimentele în SDK și P1 (PR #14, #15)
**Ce am făcut:**
- am cerut ca SDK-ul să trimită un singur pachet odată (risc de conversii pierdute) și să trimită la închiderea paginii;
- agentul a făcut push fără să aștepte confirmarea mea; i-am cerut să aștepte de acum înainte, cum spune AGENTS.md;
- am aprobat ca P1 să afișeze controlul după 5 s dacă serverul nu răspunde, fără expunere, ca să nu fie distorsionat experimentul;
- am verificat P1 în browser: validarea, rezervarea, anularea, mobilul și expunerea + conversia în baza de date.

## 2026-11-26 · Hosting și pornirea experimentului (PR #16, #17)
**Ce am făcut:**
- mi-am creat conturi pe Neon (Frankfurt, PostgreSQL 17) și Render (planul gratuit); am pus parola bazei doar în setările Render, nu în repo sau în chat;
- am rulat seed-ul pe Neon din terminalul meu;
- am șters evenimentele de test din Neon înainte de start;
- experimentul a pornit pe 26.11, ora 08:05, și se încheie pe 03.12, ora 08:05; am cerut regula D-016: fără deploy și fără modificări la flag sau la date până atunci.

## 2026-11-26 · CI și SSE (PR #18, #19)
**Ce am făcut:**
- am ales ca CI să ruleze doar la push pe `main` și la PR-uri, ca să nu ruleze testele de două ori;
- la SSE, review-ul a arătat că oricine cu cheia publică poate deschide oricâte conexiuni; am cerut o limită înainte de primul deploy.

## 2026-11-26 · API-ul de admin și dashboard-ul (PR #20, #21)
**Ce am făcut:**
- am împărțit planul în două PR-uri (server, apoi ecranele);
- review-ul de securitate a găsit că login-ul nu avea limită de încercări, iar fiecare încercare consumă memorie; am ales o verificare odată, maximum 10 încercări greșite pe minut și parola minimă de 12 caractere;
- am testat în browser kill switch-ul: oprit → P1 trece pe albastru; pornit → revine la varianta utilizatorului.

## 2026-11-26 · Rezultatele experimentului (PR #23, #24)
**Ce am făcut:**
- am verificat de mână valorile de referință (eșantion minim 294, p ≈ 0,031) și se potriveau;
- la mock am cerut „utilizatori expuși” peste tot, ca să nu pară două cifre diferite.
**Ce am învățat:** de ce la ~15 utilizatori pe variantă rezultatul corect e „nu e semnificativ încă” și de ce nu opresc experimentul mai devreme (peeking).

## 2026-11-27 · Limita de stream-uri, jurnalul de audit, pagina de start (PR #25, #26, #27)
**Ce am făcut:**
- am ales limita de 200 de stream-uri SSE;
- la jurnalul de audit am cerut să scrie că schimbările sunt făcute de admin (singurul rol) și am cerut textul de final din mock-ul aprobat;
- la pagina de start, agentul s-a oprit pentru că un test existent cerea `GET /` → 404; am aprobat schimbarea, pentru că intenția testului (nu se servește conținutul repo-ului) rămâne verificată altfel.

## 2026-11-27 · Testul de încărcare, README, SDK ca pachet, insignele (PR #28–#31)
**Ce am făcut:**
- am cerut ca rezultatul testului de încărcare să fie documentat chiar dacă pică; la 1.000 ev/s pragul depindea de fracțiuni de milisecundă, așa că am cerut încă o rulare la 1.200 ev/s (0 erori, p99 24 ms);
- README-ul a scos la iveală că SDK-ul nu se putea împacheta și că lipsea detecția flag-urilor stale; le-am făcut pe amândouă;
- am ales numele `web2-lab-sdk`, versiunea 0.1.0 și să rămână privat pe npm.

---

## Ce am învățat despre lucrul cu agentul
- planul înainte de cod m-a ajutat să văd deciziile înainte să fie greu de schimbat;
- review-ul făcut de agenți separați a găsit bug-uri pe care testele nu le prinseseră;
- am cerut mereu dovezi (rezultatele testelor, verificarea în browser), nu doar „merge”;
- deciziile de produs (metoda, pragurile, culorile, ce simplific) le-am luat eu.
