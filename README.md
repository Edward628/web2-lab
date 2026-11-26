# web2-lab — Feature flags și experimente A/B cu SDK

Proiect pentru Tehnologii Web II (Categoria F · Dev tools & operare · ★★★★).
Tot repository-ul `web2-lab` este acest proiect.

## Pe scurt
Un serviciu de feature flags și experimente A/B. Un admin creează flag-uri într-un
dashboard. Aplicațiile care folosesc SDK-ul JavaScript primesc configurația, o
evaluează local și văd schimbările în sub 2 secunde. SDK-ul trimite evenimente de
expunere și de conversie, iar dashboard-ul arată rezultatele experimentului, cu
semnificație statistică.

## Scope

### Intră în proiect
- Proiecte, medii (dev / prod) și chei de SDK per mediu.
- Flag-uri boolean și multivariate, cu descriere, etichete și stare (activ / arhivat).
- Reguli de targetare evaluate în ordine: atribute de utilizator, rollout procentual, valoare implicită.
- Bucketing determinist: `hash(flag_key + user_id)` → [0, 100), testat cu vectori de referință;
  creșterea rollout-ului (de exemplu 10% → 30%) păstrează utilizatorii deja incluși.
- SDK JavaScript pentru browser: inițializare cu cheie, identificarea utilizatorului,
  `isEnabled` / `getVariant`, evaluare locală, actualizări prin SSE cu fallback la polling,
  cache local pentru offline, configurație versionată (ETag). Publicat ca pachet (npm sau tarball).
- Experimente: flag multivariat + metrică + alocare; evenimente de expunere și conversie trimise în batch.
- Ingestie de evenimente în batch, idempotentă (id de eveniment), cu un test de încărcare documentat.
- Rezultate: expuneri, conversii, rata per variantă, interval de încredere, semnificație,
  eșantion minim, mesajul „nu e semnificativ încă” și avertisment de peeking.
- Jurnal de audit pe flag-uri și kill switch instant.
- Detecția flag-urilor stale (neevaluate de 30 de zile) și a celor 100% într-o direcție.
- Interfața și documentația în limba română.

### Simplificat față de fișă (de confirmat cu profesorul, Q-009)
| Cerință din fișă | În acest proiect |
|---|---|
| Roluri developer / admin / cititor | un singur rol: admin |
| SDK pentru browser și Node | doar browser |
| Segmente salvate | fără segmente; doar reguli pe atribute și rollout |
| Istoric al configurației | doar jurnalul de audit, fără revenire la o versiune anterioară |

### Nu intră în proiect
- Tot ce e în tabelul de mai sus, cât timp profesorul acceptă simplificarea.
- SDK pentru alte limbaje.

## Variabilele mele
| Variabilă | Valoare |
|---|---|
| Aplicația 1 (P1) | o aplicație mică de parcare, construită în acest proiect, pusă online: https://web2-lab-0c75.onrender.com/p1/ |
| Aplicația 2 | proiectul unui coleg — necunoscut încă (Q-007) |
| Experimentul | culoarea butonului de rezervare din P1; metrica: click pe rezervare; rulează 7 zile, 2026-11-26 08:05 – 2026-12-03 08:05 (ora României), fără deploy pe `p1/` sau `sdk/` și fără schimbări la flag până la final (D-016) |
| Utilizatori | colegii de grupă |
| Metoda statistică | frecventistă, test z pe două proporții, α = 0,05 (D-001) |
| Formatul configurației și fallback-ul | JSON versionat, SSE + polling, cache local (D-003) |

## Stack
Node.js cu JavaScript, Express, PostgreSQL, Docker Compose; UI în HTML + JavaScript
simplu; teste cu `node --test` (D-002). Hosting: serverul pe Render, baza pe Neon, P1 servit de server (D-014), la https://web2-lab-0c75.onrender.com/p1/.

## Timp
Buget: 15–20 de ore (fișa estimează ~40). Data predării: necunoscută (Q-008).

## Partea umană (obligatorie, o face studentul)
- Integrarea SDK-ului în cele 2 aplicații reale.
- Experimentul real, minim 7 zile → `EXPERIMENT.md`.
- Interviul de DX cu colegul → `INTERVIEW.md`; minim 2 schimbări în SDK → `DECISIONS.md` la rădăcină
  (scris de student; nu e ledger-ul agenților din `docs/agents/`, Q-019).

## Mockup
`flagship/` este un mockup de idee, fără server (backend simulat în `localStorage`).
Nu e codul proiectului și nu respectă încă `docs/design/DESIGN.md`.
