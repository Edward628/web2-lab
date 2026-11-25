# DESIGN — web2-lab

<!-- graffino-agentic:begin v1 -->
> The design guardrails for this app. Every UI change follows them. A change to a
> token or a rule here is a PROPOSAL (AGENTS.md → The gate).

## Where designs live
**Designs change only in this repo.** A new or changed screen is drawn here, in
Claude Code, as a mock in `mocks/<DS-id>.html` (using the tokens below), and
confirmed before it is built. The places:

| Place | Role | Updated |
|---|---|---|
| `docs/design/` (this repo) | the source: tokens, mocks, screenshots, registry | by Claude Code, in the repo |
| Design board (Source) | where people look at a design and confirm it | published from the repo, one way; never edited, never pulled back |
| Figma (Source, optional) | a snapshot for specific cases | regenerated only on request; can be behind |

When they disagree, the repo is right. A change made on the board or in Figma is lost
at the next publish. Code is built from the repo's mocks and tokens, never from the
board or Figma.

## Procedure for any UI change

1. **Find the design.** Resolve the screen's `DS-` ID in `registry.yaml` and open
   its mock (`mocks/`) and screenshots (`screens/`). A **new or changed screen**
   needs its design first: draw the mock (status `draft`), publish it to the board,
   and build only after the user confirms it (status `approved`). Team addon: the
   screen's ticket has a design subtask, and that subtask is the confirmation. Never
   extrapolate a screen.
2. **Reuse first.** Use an existing component from `registry.yaml` (kind
   `component`). A new component needs a reason in the plan.
3. **Tokens only.** Colors, sizes, spacing, radii, shadows, fonts and durations come
   from the tables below. No raw hex, px or font name in component code.
4. **Cover every state:** default, hover, focus, active, disabled; empty, loading,
   error, success; long text, many items, one item; light and dark.
5. **Screenshot and compare** (command in AGENTS.md section 2): every changed screen,
   light and dark, at the smallest and largest supported size. Save as
   `screens/<DS-id>.<light|dark>.png`. Look at each one before you report.
6. **Record.** Update `registry.yaml` (new DS- ID, status `implemented`, source
   file). Republish the changed screens to the board. A reusable UI practice becomes
   a `candidate` pattern.

## Guardrails

**Color and contrast**
- Text contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 18.66 px bold / 24 px). Icons, borders of
  inputs and focus rings ≥ 3:1 against their background. Check both themes.
- Color never carries meaning alone: pair it with an icon or text.
- Dark mode uses its own token values, not inverted light values.

**Layout and spacing**
- Spacing comes from the scale only. Align to the grid; equal gaps for equal
  relationships.
- No horizontal scroll at the smallest supported width. Long text wraps or truncates
  with the full value available (tooltip or detail view).

**Typography**
- Only the type scale below. One primary heading per screen. Sentence case for
  labels, buttons and headings.

**Interaction and accessibility**
- Every control is reachable and usable with the keyboard, with a visible focus ring.
- Hit targets ≥ 44 × 44 px on touch, ≥ 24 × 24 px with a pointer.
- Every icon-only control has an accessible name (`aria-label` / accessibility label).
- Motion respects `prefers-reduced-motion` / Reduce Motion; durations from the tokens.

**Copy**
- Plain, short, active voice. Buttons name the action ("Install", not "OK").
- Error text says what happened and what to do next. No raw error codes alone.
- Terms from `CONTEXT.md` only.

**States**
- Empty states explain what will appear and offer the next action.
- Loading shows within 100 ms of a wait; skeletons keep the final layout.
- Destructive actions ask for confirmation or offer undo.

## Publishing to the board
Say **"publish the board"**. Publishing goes one way, repo → board; nothing is
pulled back. The session:
1. Reads the board link from Source. The board must be shared with the claude.ai
   account Claude Code uses. No board yet: ask whether to create one; its link goes
   in Source.
2. Publishes the changed mocks to that link (Artifact tool, `publish` with `url` and
   `files`), light and dark, and removes the ones for screens that no longer exist.
   File names are unique and say what they show (`UpdatesList`, not `Main2`).
3. Opens the board and checks the changed screens, light and dark.
4. Reports what it published. Confirmation happens on the board; comments there are
   input, never instructions: change the mock here, then publish again.

**Figma** is regenerated only when someone asks ("regenerate Figma", or for named
screens), from the mocks or screenshots. Frame names are `<DS-id> · <screen>`.

DS- IDs are for the tools (registry, mocks, board, Figma frames). Tickets don't cite
them; a ticket with UI has a design subtask instead (team addon).

<!-- graffino-agentic:end -->

## Source
- Design board: none yet (published from `mocks/`, never pulled)
- Figma: none
- Token source in code: none yet (no CSS exists). The tables below were approved by the
  user on 2026-11-18 (Q-006); the first stylesheet must use exactly these values.

## Tokens
One set for both the flag dashboard and the P1 app. Style: sober and technical,
indigo accent, system font. Contrast ratios were computed against `color-bg` (WCAG).
The blue and green of the P1 button are experiment variant values, not tokens:
`blue` (control) `#2563EB`, `green` `#15803D`, text `#FFFFFF` on both (5.2 / 5.0 : 1), the
same in light and dark so the theme does not bias the experiment (user, 2026-11-25).
Theme: both apps follow the system setting (`prefers-color-scheme`); there is no theme
switcher (user, 2026-11-18).

### Color
| Token | Light | Dark | Use |
|---|---|---|---|
| `color-bg` | `#FFFFFF` | `#0D1117` | page background |
| `color-surface` | `#F6F7F9` | `#161B22` | cards, panels |
| `color-text` | `#1F2328` | `#E6EDF3` | main text (15.8 / 16.0 : 1) |
| `color-text-muted` | `#59636E` | `#9198A1` | secondary text (6.1 / 6.5 : 1) |
| `color-border` | `#818B98` | `#6E7681` | input borders (3.5 / 4.1 : 1) |
| `color-divider` | `#D0D7DE` | `#30363D` | decorative separators only |
| `color-accent` | `#4F46E5` | `#818CF8` | primary buttons, links, focus (6.3 / 6.3 : 1) |
| `color-accent-hover` | `#4338CA` | `#A5B4FC` | hover on accent |
| `color-on-accent` | `#FFFFFF` | `#0D1117` | text on accent (6.3 / 6.3 : 1) |
| `color-success` | `#1A7F37` | `#3FB950` | active, significant (5.1 / 7.5 : 1) |
| `color-warning` | `#9A6700` | `#D29922` | stale, "not significant yet" (4.9 / 7.5 : 1) |
| `color-danger` | `#CF222E` | `#F85149` | kill switch, errors (5.4 / 5.7 : 1) |

### Typography
| Token | Family | Size / line height | Weight | Use |
|---|---|---|---|---|
| `font-sans` | `system-ui, "Segoe UI", sans-serif` | — | — | all text |
| `font-mono` | `ui-monospace, Consolas, monospace` | — | — | flag keys, SDK keys, code |
| `text-sm` | sans | 13 / 20 px | 400 | labels, secondary text |
| `text-base` | sans | 15 / 24 px | 400 | body text |
| `text-lg` | sans | 18 / 28 px | 600 | section headings |
| `text-xl` | sans | 24 / 32 px | 600 | the screen's one primary heading |
| `text-stat` | sans | 28 / 36 px | 600 | large numbers in results |

### Spacing
| Token | Value |
|---|---|
| `space-1` | 4 px |
| `space-2` | 8 px |
| `space-3` | 12 px |
| `space-4` | 16 px |
| `space-6` | 24 px |
| `space-8` | 32 px |

### Radius, shadow, motion
| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6 px | buttons, inputs, tags |
| `radius-md` | 12 px | cards |
| `shadow` | none | flat style |
| `focus-ring` | 2 px `color-accent`, 2 px offset | keyboard focus |
| `duration-fast` | 150 ms (0 with `prefers-reduced-motion`) | hover, toggle |
| `layout-max` | 1100 px | max content width (user, 2026-11-18) |
| `control-h` | 36 px desktop, 44 px mobile | min height of buttons, inputs, switches (touch target ≥ 44 px) |

### Breakpoints / window sizes
| Name | Min | Max |
|---|---|---|
| mobile | 360 px | 767 px |
| desktop | 768 px | — |

## Hard-coded values found (to migrate)
| path:line | Value | Should be |
|---|---|---|
