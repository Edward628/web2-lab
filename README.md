# web2-lab — Feature flags și experimente A/B cu SDK

Proiect pentru Tehnologii Web II (Categoria F · Dev tools & operare · ★★★★).
Tot repository-ul `web2-lab` este acest proiect.

## Pe scurt
Un serviciu de feature flags și experimente A/B. Un admin gestionează flag-urile într-un
dashboard. Aplicațiile care folosesc SDK-ul JavaScript primesc configurația, o evaluează
local și văd schimbările în sub 2 secunde. SDK-ul trimite evenimente de expunere și de
conversie, iar dashboard-ul arată rezultatele experimentului, cu semnificație statistică.

## Ce conține
| Parte | Ce face |
|---|---|
| Pagina de start (`/`) | Prezintă proiectul și duce la P1 și la dashboard. |
| P1 (`/p1/`) | Aplicația de parcare: locuri simulate și butonul „Rezervă locul”, pe care rulează experimentul `reserve-button-color` (`blue` / `green`, metrica `reserve_click`). Utilizator anonim, fără date personale (D-006). |
| Dashboard — Autentificare | Un singur admin, parolă verificată cu hash scrypt, sesiune de 8 h (D-019). |
| Dashboard — Lista flag-urilor | Comutatorul Pornit / Oprit pe mediul ales (este kill switch-ul, cu confirmare în prod) și rollout-ul la flag-urile boolean (D-004); semnalează flag-urile stale (neevaluate de 30 de zile) și pe cele 100% într-o direcție de 30 de zile (D-022). |
| Dashboard — Rezultatele experimentului | Expuneri, conversii și rata per variantă, interval de încredere 95%, p-value (test z), eșantion minim, „nu e semnificativ încă” și avertisment de peeking (D-001, D-021). |
| Dashboard — Jurnal de audit | Fiecare schimbare a unui flag: ce s-a schimbat, când (ora României), valoarea dinainte și de după. |
| SDK (`sdk/`) | `init`, `identify`, `isEnabled`, `getVariant`, `track`, `flush`, `refresh`, `connect`, `close`, `status`. Evaluare locală cu bucketing determinist (MurmurHash3), actualizări prin SSE cu fallback la polling, cache în `localStorage`, starea `stale`, evenimente trimise în batch (D-003, D-018). |
| Server (`server/`) | Express + PostgreSQL: configurația cu ETag (`/sdk/config`), stream-ul de versiuni SSE (`/sdk/stream`), ingestia idempotentă de evenimente (`/sdk/events`), API-ul de administrare (`/admin/*`); servește P1 și dashboard-ul. |

Contractele API-urilor: `docs/agents/CONTRACTS.md`. Deciziile: `docs/agents/DECISIONS.md`.

## Online
P1: https://web2-lab-0c75.onrender.com/p1/ (server pe Render, baza pe Neon, D-014).
Acum e online doar P1. Pagina de start, dashboard-ul și SSE-ul ajung online la primul deploy
de după 2026-12-03 08:05 (ora României), când se încheie experimentul (D-016).

## Rulare locală
Cer Docker și Node.js 24.
```bash
cp .env.example .env                      # completează POSTGRES_PASSWORD și TEST_DATABASE_URL
(cd server && npm install)
(cd server && npm run -s hash-password)   # pune rezultatul în .env ca ADMIN_PASSWORD_HASH
docker compose up -d --build --wait       # PostgreSQL + serverul pe :3000
docker compose exec server npm run seed   # proiectul ParkingLot și cheile SDK; afișează cheia prod
```
Pune cheia prod în `.env` ca `P1_SDK_KEY`, apoi `docker compose up -d --wait` din nou.
- Pagina de start: http://127.0.0.1:3000/
- P1: http://127.0.0.1:3000/p1/
- Dashboard: http://127.0.0.1:3000/dashboard/

## SDK-ul în altă aplicație
SDK-ul se distribuie ca tarball `npm pack`, fără registry npm (D-007). P1 și serverul îl
folosesc în continuare din sursă (`sdk/src`, D-015).
```bash
(cd sdk && npm pack)                                   # face sdk/web2-lab-sdk-0.1.0.tgz
cd /calea/spre/aplicatia-ta && npm install /calea/spre/web2-lab-sdk-0.1.0.tgz
```
În aplicație (modul ES, într-un bundler sau în Node):
```js
import { init } from 'web2-lab-sdk';

const client = init({ sdkKey: '<cheia SDK a mediului>', baseUrl: 'https://<serverul>' });
await client.refresh();
client.identify('<id anonim al utilizatorului>');
if (client.isEnabled('flag-ul-meu')) { /* ... */ }
```
Pachetul are doar `src/` (fără build și fără dependențe). O aplicație fără npm (de exemplu
P07, cu Thymeleaf) nu are încă o variantă într-un singur fișier (Q-026).

## Teste și CI
Testele folosesc `node --test` (D-002):
```bash
(cd sdk && npm test)
(cd p1 && npm test)
(cd dashboard && npm test)
docker compose up -d --wait db            # testele serverului cer PostgreSQL; golesc baza web2_test
(cd server && set -a && . ../.env && set +a && npm test)
```
GitHub Actions (`.github/workflows/test.yml`) rulează toate cele patru la fiecare push pe
`main` și la fiecare pull request. CI-ul nu face deploy (D-017).

## Testul de încărcare
Ingestia a trecut testul cerut de fișă pe stack-ul local: 1.000 de evenimente/s timp de 60 s,
0 erori, p99 25 ms; și 1.200 de evenimente/s, tot fără erori. Scriptul refuză orice host în afară
de `127.0.0.1` și `localhost`. Metoda, comanda și rezultatele: `docs/LOAD-TEST.md`.

## Simplificat față de fișă (de confirmat cu profesorul, Q-009)
| Cerință din fișă | În acest proiect |
|---|---|
| Roluri developer / admin / cititor | un singur rol: admin |
| SDK pentru browser și Node | doar browser |
| Segmente salvate | fără segmente; doar reguli pe atribute și rollout |
| Istoricul configurației | doar jurnalul de audit, fără revenire la o versiune anterioară |

### Neconstruit încă
- Din dashboard: crearea flag-urilor, regulile de targetare, descrierile, etichetele și arhivarea.
  Singurul flag, `reserve-button-color`, e creat de seed.
- Ecranele „Detaliul unui flag” și „Proiect și medii” (Q-040).
- Editarea alocării pe variante (Q-039) și a ratei de bază / MDE ale unui experiment (Q-042).

## Ce mai rămâne
- `EXPERIMENT.md`: rezultatul real, după 2026-12-03 08:05 (ora României), apoi deploy-ul
  (pe Render trebuie adăugat `ADMIN_PASSWORD_HASH`).
- Integrarea SDK-ului în P07 („Când vine autobuzul?”), după ce colegul își termină aplicația
  (Q-007, Q-026, Q-027); interviul de DX → `INTERVIEW.md`; minim 2 schimbări în SDK →
  `DECISIONS.md` la rădăcină, scris de student (Q-019).
- Cloudflare: încă nu se știe ce serviciu și de ce (Q-041).
- Răspunsurile profesorului: data predării (Q-008, amânarea e acceptată), scope-ul redus (Q-009),
  P1 construit în proiect (Q-010).

## Variabilele mele
| Variabilă | Valoare |
|---|---|
| Aplicația 1 (P1) | aplicația de parcare din acest proiect, online la https://web2-lab-0c75.onrender.com/p1/ |
| Aplicația 2 | P07 „Când vine autobuzul?”, proiectul unui coleg (Q-007) |
| Experimentul | culoarea butonului de rezervare din P1; metrica: click pe rezervare; 7 zile, 2026-11-26 08:05 – 2026-12-03 08:05 (ora României), fără schimbări până la final (D-016) |
| Utilizatori | colegii de grupă |
| Metoda statistică | frecventistă, test z pe două proporții, α = 0,05 (D-001) |
| Formatul configurației și fallback-ul | JSON versionat, SSE + polling, cache local (D-003) |

## Stack și timp
Node.js cu JavaScript, Express, PostgreSQL, Docker Compose; UI în HTML + JavaScript simplu;
teste cu `node --test` (D-002). Buget: 15–20 de ore (fișa estimează ~40).

## Mockup
`flagship/` e un mockup de idee, fără server; nu face parte din codul proiectului.
