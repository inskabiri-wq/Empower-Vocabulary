# 2026-07-13h — Writing AI sidebar: unified line icon (no emoji)

## Why
The relocated ✍️ Writing AI sidebar item used a COLORED EMOJI while every other
MAIN nav item uses the monochrome Lucide-style line-icon system (overview-v2.js
ICONS + data-icon hydration). User: "check the symbols" = make it match.

## Changes
- `y/teacher/js/overview-v2.js` (?v=2, first versioned ref)
  - Added `pen-line` to ICONS (Lucide pen-line paths) - renders via the same
    t2Icon() svg (18px, stroke 1.8, currentColor).
  - Normalized 34 pre-existing em dashes to hyphens (comments + a few UI strings;
    touched-file cleanup per the no-em-dash rule).
- `y/teacher-dashboard.html`
  - `#aiWritingNav` icon span: emoji ✍️ -> `<span class="ico" data-icon="pen-line"></span>`.
  - `overview-v2.js` now loaded with `?v=2` (was unversioned; needed cache-bust).
  - More-menu keeps ✍️ (that menu's entries are all emojis - consistent there).
- `y/service-worker.js`: v96 -> v97.

## Verification
- `node --check overview-v2.js` — OK; em-dash scan (3 files) — clean.
- Static: nav anchor uses data-icon="pen-line", no emoji in the anchor.
- Browser harness (REAL sidebar markup from the served page + REAL overview-v2.js
  hydration): #aiWritingNav .ico contains an <svg stroke="currentColor"> with the
  SAME width + stroke-width as the Assignments icon; no emoji remains. PASS.

## To ship (user action)
- `firebase deploy --only hosting`, hard reload.
