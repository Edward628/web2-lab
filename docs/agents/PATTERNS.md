# Patterns — web2-lab

<!-- graffino-agentic:begin v1 -->
> How we build things here. Copy only `approved` entries. `candidate` = seen once or
> not yet confirmed; agents add these freely. Promotion needs the user's OK.
<!-- graffino-agentic:end -->

## Index
- PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark · candidate

---

## PATTERN-001 · Un mock are o bară de control cu toate stările și cu tema light / dark
- **Status:** candidate
- **How:** Fiecare mock din `docs/design/mocks/` începe cu o bară marcată „Controale mock”
  (nu face parte din ecran) cu un selector de stare (listă, un element, gol, încărcare,
  eroare, succes, confirmare) și un selector light / dark. Stările sunt blocuri `.state`
  afișate după `body[data-state]`; tokens-urile sunt variabile CSS din `DESIGN.md`.
- **Example:** `docs/design/mocks/DS-web2-flags.html`
