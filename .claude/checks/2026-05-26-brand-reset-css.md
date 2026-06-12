# Sanity + Smoke — Brand-Reset CSS

**Date:** 2026-05-26
**Trigger:** Teacher screenshot showed the default browser number-input spinner buttons inside the verify-gate modal. Spec: "every where" — fix brand consistency across the whole app, not just one input.

---

## Approach

Created a **single shared brand-reset stylesheet** at `y/css/brand.css` that's linked from **every** HTML page in the app. Single source of truth for any future "make this consistent everywhere" rules.

### Rules in this round (`y/css/brand.css`)

| Rule | Why |
|---|---|
| `input[type="number"]::-webkit-{inner,outer}-spin-button { display: none }` + `appearance: textfield` (Firefox) | Kills the native up/down arrow buttons. Input still numeric, only the visual chrome is gone. |
| `input[type="search"]::-webkit-search-cancel-button { appearance: none }` | Hides Webkit's native clear-X (looks bolted on). No current search input needs it but it's a brand-wide rule. |
| `:focus-visible { outline: 2px solid rgba(99,102,241,0.55) }` | Default low-contrast OS outlines were invisible on dark backgrounds. Per-component focus rings (via `box-shadow`) override this naturally. |
| `::selection { background: rgba(99,102,241,0.42); color: #fff }` | Selection blue clashed with the brand; indigo matches the app accent. |

### Where brand.css is loaded

All 10 HTML pages of the app, **before** any other stylesheet so per-page styles can still win conflicts:

| Page | Has number input | brand.css linked |
|---|---|---|
| `index.html` | yes (register form) | ✓ |
| `reset-password.html` | — | ✓ |
| `student-dashboard.html` | yes (verify gate, others) | ✓ |
| `teacher-dashboard.html` | yes (admin forms) | ✓ |
| `classroom-teacher.html` | yes (heist setup, vocab settings) | ✓ |
| `classroom-student.html` | — | ✓ |
| `classroom-heist-teacher.html` | yes (legacy fallback fields) | ✓ |
| `classroom-heist-student.html` | — | ✓ |
| `writing-exam.html` | — | ✓ |
| `app.html` | — | ✓ |

---

## Checks run

| Check | Result |
|---|---|
| `css/brand.css` file exists | ✅ |
| `<link href="css/brand.css">` present on 10 / 10 HTML pages | ✅ |
| Div-balance regression on all 10 pages | ✅ all balanced |
| `node tools/validate-readings.js` | ✅ 46 exams, 227 checks, 0 fails |

---

## Manual smoke test (next browser refresh)

1. Open `student-dashboard.html` → trigger verify-gate modal → confirm the **class number** field has no spinner arrows.
2. Open `index.html` → register tab → confirm the **class number** field has no spinner arrows.
3. Open `classroom-teacher.html` → pick The Heist → confirm **Game length / Reward / Heist fee** fields have no spinner arrows.
4. Hover any number input — no spinner appears on focus (Webkit sometimes re-shows them).
5. Tab through any form — focus rings are visible indigo (not invisible OS gray).
6. Select text on any page — selection is indigo, not browser blue.

---

## Standing preferences (carried forward, applied this round)

- **"Stylish" = brand-wide reach**: when fixing one visual issue, apply the fix everywhere it could occur. ✓
- **Sanity + smoke check + dated md log after every change**: this file. ✓

---

## Next addition candidates (not done in this round)

If more "looks-default" elements get flagged, drop them into `brand.css`:

- `<input type="date">` Webkit calendar icon — none in the app currently
- `<input type="file">` button — none in the app currently
- `<details>` / `<summary>` disclosure arrow — none in the app currently
- Checkbox + radio native look — currently per-component styled in classroom + reading-exam; leave alone unless a page surfaces an unstyled one
