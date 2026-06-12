# Grammar UI -> match vocab look + unit descriptions · 2026-06-09 (pass 2)

Addresses #1 (unit descriptions), #2 (coloring), #3 (match vocab UI). #4 (DB
tracking) needs a scope decision - asked the user.

## #2 Coloring + #3 closer to vocab (grammar.js v8->v9, grammar.css v7->v8)
- Stat icons: plain emoji -> the SAME colored SVG icons as the vocab dashboard
  (trophy/star/target/book/pad) inside 32px tinted rounded boxes, with the value
  text colored per accent (orange/amber/green/teal/blue). data-accent on each .gr-stat.
- XP pill: orange gradient -> teal (rgba(13,148,136) bg + --dash-primary-lt text),
  matching the vocab "Level N - Rank" pill.
- XP bar: -> teal->amber->yellow gradient (like vocab .xp-bar-fill).
- Active pills (level + unit): blue -> solid teal (--dash-primary) with the same halo,
  matching vocab .sel-opt.active.
- Unit chips: wide "Unit 1" buttons -> compact "U1" chips in a 4-col grid (like vocab's
  "U1..U12" grid).

## #1 Unit descriptions (back, and live)
- Under "Choose a game" there's now a description line:
  - "All N units · every A2 topic." when All is selected.
  - "Unit N: <topic, topic, ...>" listing that unit's grammar topics when a unit is picked.
  It updates when you click a unit chip.

## Cache
- grammar.js v8->v9, grammar.css v7->v8, service-worker.js v19->v20.

## Verify
- node --check grammar.js OK. Stubbed-DOM renderMenu runs clean.
- grammar.css braces 154/154. No em dashes in grammar.js / grammar.css.
- GR_SVG icons, data-accent, gr-unit-desc, gr-pill-u, unit-topic lookup all present.

## Note on "exact replica"
- The BODY now mirrors the vocab dashboard (welcome banner, teal XP, colored stat
  icons, compact unit chips, content sidebar, map button). The TOP bar intentionally
  differs: grammar is a skill sub-page (has "<- Hub" + skill title), whereas vocab is
  the main dashboard (profile chip / settings / logout). If a fully pixel-identical
  top bar is wanted too, that's a follow-up.

## #4 (database / tracking) - PENDING a scope decision
Grammar practice currently saves progress in localStorage only (per-device, invisible
to the teacher). Recording it to Firestore is a real feature with rules implications;
asked the user whether to (A) log each completed game for the teacher view + cross-device,
(B) also store per-question detail, or (C) just persist student XP across devices.
