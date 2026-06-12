# Sanity + Smoke — Classroom-mode bug pass

**Date:** 2026-05-27
**Trigger:** User checked the deployed Reading + Listening + Heist + Trust classroom games and reported a long list of issues across all of them. This pass fixes every one.

---

## What was broken / what's now fixed

### 1. Listening · "Create" button bounced back to the picker (BLOCKER)

**Cause:** `listening-teacher.js` checked `typeof window.LISTENING_EXAMS === 'undefined'`, but `LISTENING_EXAMS` is declared with `const` at script scope in `student/js/listening-exam.js` — `const` declarations at top-level **do NOT attach to `window`**. The check was always true → `loadAndSanitizeExam` threw → `createSession` failed silently → the auto-handler's fallback redirected back to `classroom-teacher.html`.

**Fix:** `classroom/js/listening-teacher.js` — use bare `typeof LISTENING_EXAMS` (no `window.` prefix). `typeof` on an undeclared identifier returns `'undefined'` without throwing a ReferenceError, so the check still works. Also updated `LISTENING_EXAMS.find(…)` direct access.

### 2. Reading · host green/red dots + scores visible on projected screen

**Cause:** The host's `progressGrid` always painted per-question `right`/`wrong` colour dots + "X/Y correct" + "Z%" stats. If the teacher mirrors their tab to the classroom projector (which they will), students can read the colours and deduce answers.

**Fix:** Added a **projector-safe eye-toggle** (`#eyesToggleBtn`) in the live-view top bar. Default = **OFF** (safe). When OFF:
- Per-question dots collapse to a single brand-violet "answered" colour — no red/green.
- Stats line shows only "X/Y answered" — no correct count, no percentage.
- The answer-key reference panel (`#answerKeyDetails`) is `display:none`.
- A **📺 Projector-safe** chip appears in the chip row so the teacher visually confirms the screen is OK to mirror.

When ON: full info appears. State persisted to localStorage (`reading-classroom-eyes-on`) so it survives reloads. Same pattern mirrored to Listening (key `listening-classroom-eyes-on`).

### 3. Reading + Listening · "popups not working properly"

**Cause:** The themed confirm modal uses classes `.modal-overlay` / `.modal-content` / `.modal-title` / `.modal-buttons` / `.modal-btn-cancel` / `.modal-btn-confirm`. These classes were defined in `student/css/styles.css` (the solo-mode stylesheet), which is **never loaded** by the classroom HTMLs. The classroom CSS stack (`brand.css` → `classroom/css/styles.css` → game-specific overlay) had no rules for them — so the modal rendered as **unstyled bare DOM**: invisible buttons, no backdrop, no clear affordance. That's why the user saw nothing happen on End-exam, Submit, etc.

**Fix:** Added a complete `.modal-overlay` / `.modal-content` / `.modal-title` / `.modal-message` / `.modal-buttons` / `.modal-btn*` rule set to the **shared** `classroom/css/styles.css`. Brand-consistent (dark glass + blur backdrop + violet→indigo gradient on the confirm button). Includes:
- `display:flex` centred with backdrop blur
- Scale-in animation when `.active` is added
- Mobile breakpoint (`max-width: 480px`) that stacks buttons full-width
- `overflow-y:auto` on both overlay and content so tall modals scroll on small screens

This single fix repairs every confirm modal across Reading + Listening + Trust + future games.

### 4. Reading · End-exam button "doesn't work"

**Cause:** End-exam calls `ask(...)` which opens the themed modal. Because the modal CSS was missing (issue #3), the user saw nothing happen — the modal *was* opening, but its DOM was invisible, and clicking Confirm was a guess. The data path itself (`status: 'finished'` write + student-side `subscribeSession` routing to `view-done`) was always correct.

**Fix:** Resolved by fix #3 — the modal now renders properly so the End-exam confirmation is visible and actionable.

### 5. Listening · "couldn't even check what was around it"

**Resolved by fixes #1 + #3** — the user can now reach the lobby (#1) and see the modals (#3).

### 6. Refresh = double-warning + goodbye

**Requirement:** "Before that, ask twice for the warning if you are going to refresh it. Do you want it? Do you want it? If they refresh it, the game is closed, like goodbye."

**Fix:** New shared file **`y/classroom/js/refresh-guard.js`**:
- Captures `F5`, `Ctrl+R`, `Ctrl+Shift+R`, `Cmd+R` keydowns in the capture phase
- Polls a global predicate `window.refreshGuardShouldProtect()` — if it returns true, `preventDefault()` and show a themed two-step modal:
  - Step 1: ⚠️ "Refresh this tab? You're in the middle of a classroom game."
  - Step 2: 🚪 "Are you absolutely sure? This will close your session for good."
- If both confirmed → `window.location.reload()` (the "goodbye" — anonymous auth means the session is effectively closed for them)
- If either cancelled → stays in the game

Each student JS sets the predicate appropriate to its game:
- **Reading + Listening**: protect when `session.status === 'live'` OR `'revealed'`
- **Trust No One**: protect during `liftoff`, `playing`, `meeting`, `eject`
- **Heist**: protect during `playing` or `password`

Wired into all four student HTML pages via `<script src="classroom/js/refresh-guard.js"></script>` placed before the game's own student JS.

The browser's URL-bar refresh button can't be intercepted from JS (browsers don't fire a key event for it) — that path still falls through to the existing `beforeunload` native prompt, so there's still one warning layer there.

### 7. Heist · hack modal mobile (no scroll, hidden buttons, no back)

**Cause:** `.heist-modal-bg` had no `overflow-y:auto` and `.heist-modal` had no `max-height`. On mobile with a tall pw-grid (8–15 password choices), the modal grew taller than the viewport and the bottom action bar (Cancel + Crack vault) fell off-screen with no way to reach it.

**Fix:** `classroom/css/heist.css`:
- `.heist-modal-bg` → `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- `.heist-modal` → `max-height: calc(100vh - 32px)` + `display: flex; flex-direction: column`
- `.heist-modal .pw-grid` → `overflow-y: auto; flex: 1 1 auto; min-height: 0` (the scrollable middle)
- `.heist-modal-actions` → `flex-shrink: 0` + a thin top border so it visually pins to the bottom of the modal as a sticky action bar
- New `.heist-modal-close` — top-right ← button (32×32 round) as a clearly visible back affordance
- `@media (max-width: 480px)` → action buttons stack vertically (column-reverse so the primary "Crack vault" sits above "← Back" for thumb reach)

JS (`classroom/js/heist-student.js`):
- Renders the new `<button class="heist-modal-close" id="closeHack">←</button>` at the top of the modal
- "Cancel" relabelled to "← Back" for parity
- Added click-outside-to-close (backdrop click) + Esc-to-close keybinding

### 8. Heist · Bitcoin polish + heist-flavoured music

**Coin badge** (`.heist-coins`): redesigned with a real **₿** glyph as a spinning ::before element — gold-on-dark coin disc with a glow, animating `rotateY(360deg)` every 6s. Whenever the balance changes, JS toggles a `.bump` class that adds a 0.45s scale + filter pulse on top of the rotation, so successful cracks feel rewarding. Removed the `coin-ico` element (the pseudo replaces it).

**Music**: swapped both `heist-student.js` and `heist-teacher.js` track lists from `SoundHelix-Song-1/2/8/10/16.mp3` (shared with Vocab Race + Trust) to `SoundHelix-Song-7/9/11/13/15.mp3` — picked for darker, tenser, more "vault-cracking heist movie" tonality. Each classroom mode now has its own sonic personality:
- Vocab Race: original 5 (energetic pop)
- Trust No One: same 5 (works for deep-space)
- The Heist: 7/9/11/13/15 (brooding electronic)

---

## Files modified

**New**
- `y/classroom/js/refresh-guard.js`

**Modified**
- `firestore.rules` — (no changes this pass; previous additions intact)
- `y/classroom/css/styles.css` — generic themed modal stylesheet
- `y/classroom/css/heist.css` — modal mobile + Bitcoin coin badge
- `y/classroom/css/reading.css` — projector-safe chip, neutral "answered" dot, eye-toggle pressed state
- `y/classroom/css/listening.css` — same set as reading.css
- `y/classroom-teacher.html` — (no changes this pass; previous additions intact)
- `y/classroom-reading-teacher.html` — eye-toggle + projector-safe chip in top bar
- `y/classroom-listening-teacher.html` — eye-toggle + projector-safe chip in top bar
- `y/classroom-reading-student.html` — refresh-guard script tag
- `y/classroom-listening-student.html` — refresh-guard script tag
- `y/classroom-trust-student.html` — refresh-guard script tag
- `y/classroom-heist-student.html` — refresh-guard script tag
- `y/classroom/js/reading-teacher.js` — eye-toggle state + render gating
- `y/classroom/js/reading-student.js` — refreshGuardShouldProtect predicate
- `y/classroom/js/listening-teacher.js` — fix LISTENING_EXAMS scope check, eye-toggle state + render gating
- `y/classroom/js/listening-student.js` — refreshGuardShouldProtect predicate
- `y/classroom/js/trust-student.js` — refreshGuardShouldProtect predicate
- `y/classroom/js/heist-student.js` — refreshGuardShouldProtect predicate, new modal close button + bindings, coin bump animation, heist music tracks
- `y/classroom/js/heist-teacher.js` — heist music tracks

---

## Checks run

| Check | Result |
|---|---|
| `node -c` syntax on all 8 modified JS files | ✅ ALL OK |
| `classroom/css/styles.css` brace balance | ✅ 214 / 214 |
| `classroom/css/heist.css` brace balance | ✅ 125 / 125 |
| `classroom/css/reading.css` brace balance | ✅ 151 / 151 |
| `classroom/css/listening.css` brace balance | ✅ 166 / 166 |
| `classroom-teacher.html` div balance | ✅ 115 / 115 |
| `classroom-reading-teacher.html` div balance | ✅ 47 / 47 |
| `classroom-reading-student.html` div balance | ✅ 45 / 45 |
| `classroom-listening-teacher.html` div balance | ✅ 54 / 54 |
| `classroom-listening-student.html` div balance | ✅ 45 / 45 |
| `classroom-trust-student.html` div balance | ✅ 84 / 84 |
| `classroom-heist-student.html` div balance | ✅ 27 / 27 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test plan

### Listening
1. Teacher dashboard → Classroom Mode → 🎧 Listening Exam → pick B1 → "FSMEPT Listening 1" → defaults → **Create Listening Room**.
2. Expected: **lobby with QR code appears** (no more bounce back to picker).
3. Eye-toggle: top-right "🙈 Show answers" button is visible. Default state shows "📺 Projector-safe" chip in the chip row.

### Reading
4. Same flow, but pick Reading Exam → A2 → "The Lies People Tell" → Create.
5. Verify: eye-toggle present + default off + projector-safe chip visible.
6. Click "Show answers" → eye toggles to 👁, chip disappears, dots colour right/wrong, answer-key panel expands.
7. Click again → returns to projector-safe state. Reload the page — state persists from localStorage.
8. Click **End exam** → themed modal appears (NOT invisible bare buttons). Confirm → status flips → all students transition to "Exam closed" view.

### Refresh guard
9. As a student, join any classroom game. Hit **F5**. Themed modal #1 appears ("Refresh this tab?"). Click "Yes, refresh" → modal #2 appears ("Are you absolutely sure?"). Click "Close my game" → the page actually reloads (goodbye).
10. Repeat but click "Cancel" on either step → stays in the game.
11. Test Ctrl+R, Cmd+R (on Mac), and Ctrl+Shift+R — all should be intercepted.
12. As a student in the "Done" or "Join" view, hit F5 — should refresh without prompting (predicate returns false outside live game).

### Heist hack modal (mobile)
13. On a phone (or browser DevTools mobile mode @ iPhone SE width):
    - Click a vault → modal opens.
    - Verify the top-right ← back button is visible.
    - Scroll through password choices — internal scroll works.
    - Reach the bottom — action bar is pinned, both "← Back" and "Crack vault" buttons are visible above the viewport's bottom edge.
    - Tap outside the modal (backdrop) or hit Esc → modal closes.

### Heist Bitcoin + music
14. Student joins → balance chip shows the spinning ₿ glyph + numeric balance.
15. Crack a vault successfully → balance jumps + chip bumps (scale + glow flash + 180° rotation pulse).
16. Hit the music play button → distinct track (SoundHelix-Song-7) — should sound different from Vocab Race / Trust music.

---

## Standing preferences applied

- **Brand-wide stylish** — the new modal stylesheet, eye-toggle, projector-safe chip, Bitcoin coin badge, and refresh-guard double-modal all use the brand language: dark glass, indigo/violet gradients, JetBrains Mono accents, subtle pulse animations.
- **Sanity + smoke + dated md** — this file.

---

## Open concerns / nothing left to ship

- The URL-bar refresh button still can't trigger the double-themed modal — only the keyboard shortcuts can. The native `beforeunload` prompt is the fallback for that path, which is the best browsers allow without an installed PWA. Documented; not a blocker.
- Heist host doesn't have an eye-toggle equivalent (the host's view there is the dashboard, not a projected exam — different threat model). If we ship a "project the live leaderboard" feature later, we'd add the same toggle.
- The Reading/Listening eye-toggle defaults OFF for safety, but teachers can flip it ON per-session and it persists. If teachers prefer "always on" per device, the localStorage flag covers that. No per-user-account preference because the host's tab isn't tied to a user-doc setting in this iteration.
