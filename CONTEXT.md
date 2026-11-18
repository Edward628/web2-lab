# CONTEXT — web2-lab vocabulary

<!-- graffino-agentic:begin v1 -->
> The approved terms for this project. Use each term exactly as defined, in the part
> of speech given. Never swap in a synonym; never use a word on an _Avoid_ line.
<!-- graffino-agentic:end -->

> Starter list. The repo is empty, so the course's own terms are not known yet.
> Add terms as the labs define them.

**Lab** (noun) — one course exercise, with its own task and code.
_Avoid_: homework, project (for a single exercise)

**Screen** (noun) — one page or view a person sees in the browser; has a DS- ID in `docs/design/registry.yaml`.
_Avoid_: view (for the whole page), window

**Component** (noun) — a reusable piece of UI shared by several screens; has a DS- ID.
_Avoid_: widget, element (for a reusable piece)

**Token** (noun) — a named design value (color, size, spacing, font, duration) from `docs/design/DESIGN.md`.
_Avoid_: variable (for design values), magic number

**Mock** (noun) — the design of a new or changed screen, drawn as `docs/design/mocks/<DS-id>.html` before it is built.
_Avoid_: wireframe, prototype

## Termenii proiectului (feature flags și A/B)

**Flag** (substantiv) — un comutator numit (`flag_key`) care decide ce valoare primește un utilizator; boolean sau multivariat.
_Avoid_: toggle, switch, feature (pentru comutator)

**Mediu** (substantiv) — o copie separată a configurației unui proiect: `dev` sau `prod`.
_Avoid_: environment (în UI), stage

**Cheie SDK** (substantiv) — cheia cu care o aplicație citește configurația unui singur mediu.
_Avoid_: token, API key (pentru cheia SDK)

**Regulă de targetare** (substantiv) — o condiție pe atributele utilizatorului care, dacă se potrivește, servește o valoare; regulile se evaluează în ordine.
_Avoid_: filtru, condiție (singur)

**Rollout** (substantiv) — procentul de utilizatori care primesc valoarea activă a unui flag.
_Avoid_: lansare treptată (în cod), procent (singur)

**Bucket** (substantiv) — numărul din [0, 100) calculat determinist din `flag_key + user_id`.
_Avoid_: grupă, slot

**Variantă** (substantiv) — una dintre valorile unui flag multivariat (de exemplu `blue`, `green`).
_Avoid_: versiune, braț

**Experiment** (substantiv) — un flag multivariat + o metrică + o alocare pe variante.
_Avoid_: test (singur), campanie

**Expunere** (substantiv) — evenimentul „utilizatorul a văzut varianta X”; contează o dată per utilizator.
_Avoid_: impresie, view

**Conversie** (substantiv) — evenimentul metricii (de exemplu click pe rezervare); contează doar după prima expunere.
_Avoid_: acțiune, goal

**Kill switch** (substantiv) — oprirea instantă a unui flag din dashboard.
_Avoid_: panic button

**Flag stale** (substantiv) — un flag neevaluat de 30 de zile.
_Avoid_: flag vechi, flag mort

**Configurație** (substantiv) — setul versionat de flag-uri și reguli al unui mediu, servit SDK-ului.
_Avoid_: setări, config (în UI)
