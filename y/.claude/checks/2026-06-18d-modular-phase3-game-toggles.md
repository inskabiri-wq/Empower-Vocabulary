# 2026-06-18 - Modular activation, Phase 3: individual classroom games on/off

Each classroom game can now be activated/deactivated. Placed in the Admin ▸
Features panel (its natural home - it already toggles "Classroom Mode"), since
games don't fit the level-tab Content panel.

## Admin - `y/teacher/js/feature-activation.js`
- Added 6 game entries to the FEATURES list: `game_vocabRace`, `game_grammar`,
  `game_heist`, `game_trust`, `game_reading`, `game_listening` ("Vocab Race ·
  game", etc.). They render as toggle cards and use the EXISTING flip/save path
  (flat keys in settings/featureToggles, missing/true = on, false = off). No new
  storage shape, no rules change.

## Gate - `y/classroom-teacher.html`
- New inline script (after teacher.js, where `db`/`auth` are defined): on auth,
  reads settings/featureToggles and hides the picker card for any deactivated
  game (`game_heist` -> `#pickHeist`, etc.). Safe default: if the read fails or
  auth isn't ready, all games stay visible. Card-id map verified against the
  real picker ids (pickVocabRace/pickGrammar/pickHeist/pickTrust/pickReading/
  pickListening).

## Versions
- `feature-activation.js` ?v=2 -> **?v=3**. `classroom-teacher.html` is
  network-first (inline gate ships with the HTML) - no SW bump.

## Verification
- `node --check` OK on feature-activation.js. No em dashes (names use middot).
- Smoke (harness running the EXACT gate IIFE with stubbed db/auth,
  game_heist:false + game_trust:false, deleted after): #pickHeist + #pickTrust
  HIDDEN, the other four shown; 0 console errors.

## Remaining phases
2b. Vocabulary WORD LISTS / units (needs admin datasets fetch + unit-picker gate
    + dropping those words from "All units" practice).
4.  Practice modes per skill.
5.  Courses per-course + per-module.

## Not done
- No deploy. No push.
