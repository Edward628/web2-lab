# Testul de încărcare al ingestiei de evenimente

Cerința din fișă: ingestia trebuie să reziste la **1.000 de evenimente/s**, cu un test de
încărcare documentat (README → „Ingestie de evenimente în batch”).

**Rezultat (2026-11-27, stack-ul local): PASS.** 60.000 de evenimente în 60 s, toate acceptate,
0 erori, p99 25 ms, numărul de rânduri din bază exact cel așteptat.

## Metoda

- **Ținta:** doar stack-ul local Docker Compose (`server` + `db`), `POST /sdk/events` (C-003) pe
  `http://127.0.0.1:3000`, în mediul `dev` al proiectului ParkingLot (cheia creată de seed).
  Niciodată Neon sau Render (D-016): scriptul refuză orice host în afară de `127.0.0.1` și
  `localhost`, atât pentru server, cât și pentru `DATABASE_URL`.
- **Încărcarea:** un batch de 20 de evenimente (mărimea batch-ului din SDK) la fiecare 20 ms,
  timp de 60 s: 3.000 de cereri, 50 de cereri/s, **1.000 de evenimente/s**. Fiecare batch are:
  - 10 expuneri pe `reserve-button-color`, pentru 10 utilizatori noi (`blue` / `green`);
  - 9 conversii `reserve_click`, pentru 9 dintre ei (deci după expunerea lor, D-005);
  - 1 eveniment `evaluations` (`UPDATE` pe rândul din `flag_environments`, Q-031).

  Id-urile evenimentelor și ale utilizatorilor sunt unice (`lt-<run>-<batch>-…`), deci nicio
  cerere nu e ignorată ca duplicat.
- **Open-loop:** fiecare batch pleacă la momentul lui din program, fără să aștepte răspunsurile
  anterioare. Un server lent apare ca latență mai mare, nu ca o rată de trimitere mai mică.
  Scriptul măsoară și cât de târziu a plecat fiecare batch față de program („send lag”), ca un
  client lent să nu fie confundat cu un server lent. Timeout pe cerere: 10 s, ca în SDK.
- **Sonda de configurație:** în paralel, un `GET /sdk/config` pe secundă, ca să se vadă dacă
  ingestia blochează citirile configurației (Q-031).
- **Măsurători:**
  - *throughput* = evenimente acceptate (`204`) ÷ fereastra de trimitere (de la primul batch la
    ultimul, plus un interval de 20 ms);
  - latența fiecărei cereri (până la răspunsul complet), p50 / p95 / p99 / max (nearest rank);
  - *error rate* = cereri fără `204` (alt status, eroare de rețea sau timeout) ÷ toate cererile;
  - numărul de rânduri înainte și după, în `ingested_events` (mediul dev), `exposures` și
    `conversions` (experimentul dev), comparate cu ce s-a acceptat: +20, +10 și +9 pe batch;
  - cât crește `ingested_events` pe disc (`pg_total_relation_size`, cu indexul; Q-033);
  - logul serverului în timpul rulării (erori `500`, deadlock-uri `40P01`, Q-032).
- **Regula PASS / FAIL** (aprobată în plan): throughput ≥ 1.000 de evenimente/s, **și** 0 erori,
  **și** p99 < 1 s, **și** creșterea rândurilor egală cu cea așteptată. Scriptul iese cu 0 la
  PASS și cu 1 la FAIL.

## Cum se rulează

```bash
# o dată: .env completat (POSTGRES_PASSWORD), stack-ul pornit și seed-ul rulat
docker compose up -d --build --wait
docker compose exec server npm run seed

cd server && set -a && . ../.env && set +a
DATABASE_URL="postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/web2" npm run -s load-test -- --duration 5   # smoke
DATABASE_URL="postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/web2" npm run -s load-test                   # 60 s
docker compose logs server --since <ora de start, UTC>                                                             # erori?
```

Opțiuni: `--duration <s>` (implicit 60), `--rate <evenimente/s>` (implicit 1000). Raportul e
un JSON pe stdout. Rândurile rămân în baza locală `web2` (~65.000 de rânduri pe rulare);
`docker compose down -v` șterge volumul bazei locale, iar după el se rulează din nou seed-ul.
Codul: `server/scripts/load-test.js`, cu părțile pure în `server/scripts/load-test-lib.js`,
testate în `server/test/load-test.test.js`.

## Mașina

Laptop cu Intel Core i7-13650HX (20 de fire), 11,5 GB RAM disponibili pentru WSL2; Docker
29.9.2 în WSL2; imaginile `node:24-alpine` (server) și `postgres:17-alpine` (bază), cu setările
implicite (pool `pg` de 10 conexiuni, fără tuning PostgreSQL). Scriptul rulează pe aceeași mașină
(Node 26). **Cifrele sunt ale acestei mașini, pe localhost:** fără latența de rețea și fără
limitele planurilor gratuite Render și Neon (C-004, C-005), care nu sunt testate aici.

## Rezultate — 2026-11-27

| | Smoke (5 s) | Rularea de 60 s |
|---|---|---|
| Run id | `b8736fe9f812a3d6` | `582eee32de3f5df4` |
| Batch-uri / evenimente trimise | 250 / 5.000 | 3.000 / 60.000 |
| Evenimente acceptate (`204`) | 5.000 | **60.000** |
| Throughput (evenimente/s) | 999,9 | **1.000** |
| Erori / error rate | 0 / 0 % | **0 / 0 %** |
| Latență p50 / p95 / p99 / max (ms) | 17,3 / 22,5 / 38,7 / 61,0 | **16,2 / 18,8 / 25,2 / 68,4** |
| Send lag maxim (ms) | 3,3 | 4,7 |
| `GET /sdk/config` p50 / p95 / p99 (ms) | 2,9 / 52,3 / 52,3 (5 cereri) | 2,3 / 3,8 / 40,3 (60 de cereri, toate `200`) |
| `ingested_events` / `exposures` / `conversions` (creștere) | +5.000 / +2.500 / +2.250 (exact) | **+60.000 / +30.000 / +27.000 (exact)** |
| `ingested_events` pe disc | 157 B / eveniment | 152 B / eveniment (+8,7 MB) |
| `last_evaluated_at` actualizat | da | da |
| Logul serverului | — | gol (fără `500`, fără `40P01`) |
| Verdict | FAIL (doar throughput, vezi mai jos) | **PASS** |

**Despre throughput-ul de 999,9 din smoke run.** Scriptul trimite exact 1.000 de evenimente/s.
Când ultimul batch pleacă cu câteva zecimi de milisecundă mai târziu decât primul (jitter-ul
timerelor), fereastra devine puțin mai lungă de 5 s, iar throughput-ul măsurat iese puțin sub
1.000. La smoke run, diferența a fost 0,37 ms din 5.000 ms. Serverul a acceptat totul, cu p99
39 ms. La rularea de 60 s, jitter-ul a căzut în favoarea testului. Deci condiția „≥ 1.000” e la
limita măsurătorii. Celelalte condiții au o marjă mare: 0 erori, p99 de 40 de ori sub 1 s și
send lag sub 5 ms. Cu ele, verdictul nu depinde de acest jitter.

## Ce arată pentru întrebările deschise

- **Q-031 (blocarea pe `flag_environments`):** la 50 de batch-uri/s, fiecare cu un `UPDATE`
  `evaluations` pe același rând, latența ingestiei a rămas plată (p99 25 ms). Citirile
  configurației au p50 2,3 ms și p99 40 ms, deci nu au așteptat după ingestie. Pool-ul de 10
  conexiuni nu a fost epuizat la această încărcare. Pe Render și Neon (rețea, compute mai mic)
  problema nu e măsurată.
- **Q-032 (deadlock-uri):** nu e exercitată. Fiecare utilizator apare într-un singur batch și
  există un singur flag, deci nu există două batch-uri care să scrie aceleași chei în ordini
  diferite. 0 erori `500` și niciun `40P01` în log, dar asta **nu** dovedește că deadlock-ul nu
  poate apărea.
- **Q-033 (păstrarea id-urilor):** `ingested_events` crește cu ~152 B pe eveniment (cu indexul).
  La 1.000 de evenimente/s, asta înseamnă ~13 GB pe zi. Cei 0,5 GB ai planului gratuit Neon
  (C-005) s-ar umple după ~3,5 M evenimente, adică ~1 h la această rată, fără `exposures` și
  `conversions`. La traficul real (zeci de utilizatori) creșterea e neglijabilă.

Orice schimbare în ingestie (`server/src/events.js`) se face într-un plan separat.
