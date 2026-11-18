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
- Q-004 · How are the labs laid out in the repo (one folder per lab, one shared app, …)?
- Q-005 · How is lab work handed in or deployed (git remote, hosting, branches, tags)?
- Q-006 · What are the design tokens (colors, fonts, spacing), and is there a design board?
- Q-007 · Care e a doua aplicație reală (proiectul colegului) și e colegul de acord?
- Q-008 · Care e data predării finale și a susținerii?
- Q-009 · Acceptă profesorul scope-ul redus (15–20 h în loc de ~40 h)?
- Q-010 · Poate P1 să fie o aplicație nouă, construită în acest proiect?

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
- **Status:** open
- **Blocks:** AGENTS.md section 3; where new code goes
- **Who answers:** the user (course requirements)
- **Proposed answer:**
- **Answer:** partial, 2026-11-18 (user): the whole repo is the feature flags and A/B
  testing project (not one folder per lab). Still open: the folder layout inside it.
- **Recorded as:**

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
- **Answer:**
- **Recorded as:**

## Q-007 · Care e a doua aplicație reală (proiectul colegului) și e colegul de acord?
- **Status:** open
- **Blocks:** integrarea SDK-ului în a doua aplicație; interviul de DX (INTERVIEW.md); cele 2 schimbări în SDK
- **Who answers:** the user, după ce vorbește cu un coleg
- **Proposed answer:**
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
