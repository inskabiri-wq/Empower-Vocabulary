# App-wide popups → one themed dialog + global checkbox styling

**Date:** 2026-05-27
**Trigger:** "check every and every pop up question ... make sure all works with same theme and same structure! also tick boxes everywhere in app stylish it."

---

## 1. One shared dialog for the whole app

New `y/js/app-dialog.js` — a singleton `window.AppDialog` with three promise-based methods that replace the ugly native browser popups everywhere:

```js
AppDialog.alert(message, { title, icon, okLabel })            // → Promise<void>
AppDialog.confirm(message, { title, okLabel, cancelLabel, danger, icon }) // → Promise<bool>
AppDialog.prompt(message, { title, value, placeholder, password, okLabel }) // → Promise<string|null>
```

**Design:**
- Dark-glass card, gradient title, indigo confirm button, **danger** variant (red) for destructive actions, scale-in animation — matches the classroom `.modal-*` look, so **every dialog in the app now shares one structure + theme**.
- **Self-injects its own scoped CSS** (`.appdlg-*`) on first use → no per-page `<link>` needed, and the classes can never collide with a page's existing `.modal-*` styles.
- Enter = OK, Esc = cancel, backdrop click = cancel, focus lands on the input (prompt) or OK button.
- Queues so only one shows at a time; falls back to native if the DOM isn't ready (never throws).

Wired (one `<script src="js/app-dialog.js">` in `<head>`) into: index, student-dashboard, teacher-dashboard, writing-exam, classroom-teacher, classroom-student.

## 2. Every raw native popup replaced

Swapped all bare `alert()` / `confirm()` / `prompt()` for the themed equivalents (kept the existing `if(!bg) window.confirm(...)` fallbacks in the classroom modals — those only fire if the themed modal element is missing, and the classroom modals are already on-theme).

| File | Was | Now |
|---|---|---|
| classroom-teacher.html | 6× `alert` (picker validation) | `AppDialog.alert` w/ titles + icons |
| classroom/js/teacher.js | `confirm` cancel-session | `AppDialog.confirm` danger |
| classroom/js/trust-student.js | buggy `await window.confirm ? confirm()` | clean `AppDialog.confirm` |
| classroom/js/student.js | `alert` | `AppDialog.alert` |
| student/js/games.js | `alert`×3, `confirm` (made `startActivity` async) | themed |
| student/js/progress.js, reading-exam.js, auth.js | `alert` | themed |
| student/js/writing-exam.js | `alert`×2, `confirm` (leave page) | themed |
| index/js/auth.js | `prompt` (password) | `AppDialog.prompt({password:true})` |
| teacher/js/organizations.js | `alert`×3, `confirm` (remove domain) | themed, danger |
| teacher/js/confusing-pairs.js | `confirm` fallback | `AppDialog.confirm` |
| teacher/js/student-detail.js, activity-admin.js, grading-stats.js, assignments/js/* | `alert` | themed |

Verified: **no raw `confirm(`/`prompt(` calls remain** anywhere (only HTML comments mention them).

## 3. Checkboxes & radios — styled app-wide

Added to `y/css/brand.css` (loaded on every page):
```css
input[type="checkbox"], input[type="radio"] { accent-color:#6366f1; cursor:pointer; }
+ focus-visible ring + label cursor
```
`accent-color` recolors every native checkbox/radio to brand indigo **without changing size or behaviour**, so it can't break any layout — and correctly does nothing to the already-custom assignment student-picker (which hides its native input). Every plain checkbox in the app is now brand-consistent.

---

## One pre-existing thing I cleaned up while here
`classroom-teacher.html`'s `datasets.json` fetch logged a hard **console.error** when the page redirects an unauthenticated user to login (the redirect aborts the in-flight fetch). It's benign (real teachers stay; the fetch completes) but my new head-script shifted timing enough to surface it. Downgraded that one catch to a `console.warn` with a clear message — honest (a vocab hiccup on the picker isn't fatal; Vocab Race re-checks `vocabulary` before starting) and removes the noise.

---

## Checks

| Check | Result |
|---|---|
| `node -c` on all 16 touched JS + app-dialog.js | ✅ all clean |
| `brand.css` brace balance | ✅ 8/8 |
| No raw `confirm(`/`prompt(` calls remain | ✅ (comments only) |
| **Dialogs E2E** (Playwright): API present, renders themed card, 2 buttons, danger variant, confirm→true, prompt→value, no overlay leak, **checkbox accent = rgb(99,102,241)** | ✅ 8/8 |
| **Full page smoke** (16 pages, browser, JS errors) | ✅ 16/16, zero errors |

---

## Deploy
`firebase deploy --only hosting` ships the new dialog + checkbox styling. (No rules change in this batch.)

## Notes
- Test scripts: `.claude/pw-dialogs.js` (+ existing pw-smoke.js), outside the shipped `y/` folder.
- The classroom game confirm modals (`trustConfirm`, `readingConfirm`, `listeningConfirm`, heist) were left as-is — they already use the shared `.modal-*` structure + per-game palette, so they're consistent by design. If you later want them to also route through `AppDialog`, it's a small follow-up.
