# 2026-06-14 — Classroom timer widget

Teacher request: a classroom timer (countdown, presets, sound + flash at zero,
fullscreen project mode) available in Classroom Mode AND the teacher dashboard.

## What was built
- **`y/js/classroom-timer.js`** (new, self-contained, no deps/assets):
  - Floating "⏱ Timer" launch button (bottom-right) + an overlay modal it injects
    on load. Exposes `window.ClassTimer.open()/.close()`.
  - Countdown mode: presets 1/3/5/10/15 min + -1/+1 nudge; Start/Pause; Reset.
  - Stopwatch mode (counts up); presets hide in this mode.
  - At zero: 3 WebAudio beeps (generated, no audio file) + a red screen-flash + the
    digits stay at 00:00.
  - "⛶ Project" mode: hides the chrome, blows the digits up to fill the screen
    (min(34vw,52vh)), and requests fullscreen (best-effort) for the board. Esc / Exit
    leaves project mode, then closes.
  - All styling is injected once (own `<style>`, fixed dark theme so it looks the same
    on every page); high z-index; no dependency on page CSS.
- Wired (script tag before `</body>`) into the 6 teacher-facing pages:
  teacher-dashboard.html, classroom-teacher.html, classroom-heist-teacher.html,
  classroom-listening-teacher.html, classroom-reading-teacher.html,
  classroom-trust-teacher.html. (Not on student pages.)

## Versions
- new file classroom-timer.js **?v=1**; service-worker v49 -> **v50**.
- The 6 host pages are HTML (network-first), so no per-page version needed.

## Verification — sanity + smoke
- **Sanity:** node --check OK; one em dash in the header comment was removed (no em
  dashes remain).
- **Smoke** (harness loading the widget): 0 console errors; API exposed; launch button
  present; overlay opens; default 05:00; preset 1m -> 01:00; +1 -> 02:00; Start ->
  "Pause"; stopwatch mode shows 00:00 with presets hidden; Project mode toggles the
  fullscreen class on and Exit/Esc clears it.

## Not done
- No deploy (hosting-only). No GitHub push.
- Live look after deploy worth doing: confirm the floating button doesn't overlap any
  existing bottom-right control on the heist/classroom host pages (z-index is high; can
  reposition if it clashes).
