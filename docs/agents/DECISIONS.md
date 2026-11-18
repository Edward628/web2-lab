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

---

## D-001 · Rezultatele experimentelor folosesc metoda frecventistă (test z, α = 0,05)
- **Status:** approved
- **Rule:** Rezultatele unui experiment se calculează cu testul z pe două proporții, α = 0,05,
  putere 80%. Eșantionul minim per variantă e calculat și afișat. „Semnificativ” apare doar
  când p < 0,05 și eșantionul minim e atins; altfel se afișează „nu e semnificativ încă”, iar
  un p < 0,05 înainte de eșantionul minim primește avertisment de peeking.
- **Why:** variabilă din fișa proiectului; metoda e simplu de explicat la susținere.
- **Evidence:** interviu și aprobare de la user, 2026-11-18; README.md → „Variabilele mele”.
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
- **Confirmed:** 2026-11-18
