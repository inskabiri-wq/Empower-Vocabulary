# 2026-08-18 - White + blue: reported issues (round 1)

Four issues reported with screenshots, plus "white should be the default from
the beginning of the app, also on the login page, then they can change it".

## 1. Level pills - "so visible box"
Every pill was a box and the selected one differed only by a pale border, so
none of them looked picked. Worse, the app had TWO different treatments for the
same idea: the Quest Board used a solid blue chip, reading/listening used a pale
tint. Both are the solid blue chip with white text now.
Also retired the sky end of the Quest Board's gradient (#0ea5e9 -> #3b82f6).

## 2. Reading exam opened dark
Two separate causes, both fixed:
- `RD_PREF_DEFAULT.theme` was 'dark'. Now 'light'; a student who already chose
  a theme keeps it, because readPrefs() only falls back when the stored value is
  missing or invalid.
- More importantly the CSS DEFAULT was dark: #readingExamScreen declared the
  dark tokens unconditionally and light was an opt-in [data-theme="light"].
  So the exam painted dark before the JS ran. Inverted: light is the base,
  dark is now an explicit [data-theme="dark"] block with exactly the old values.
- The old light theme was a warm cream (#fdfbf6); it is the app's white now.
- The "Light" preview swatch was updated to match the theme it previews.
The writing exam had the same shape (`<body data-theme="dark">`) - now light,
and its "Reset to defaults" resets to light rather than back to dark.

## 3. Invisible text on the grammar / vocabulary maps
Root cause was one idiom used 175 times: `rgba(255,255,255,a)` as text, hairline
border and raised-surface fill. That is dark-theme shorthand and renders as
nothing on white. Introduced three tints - --tint-surface, --tint-line,
--tint-line-strong - and mapped 96 values onto them BY PROPERTY.
Declared ONLY in the theme blocks, never in :root, so in dark mode
`var(--tint-line, rgba(255,255,255,0.08))` falls through to the original literal
and dark is unchanged.
Two more were opaque `color: white` (.qc-unit-name, .qc-donut-label), which the
translucent sweep by definition could not catch.

## 4. Overdue was too mellow
It was styled as the QUIETEST thing on the card: a desaturated grey-blue, and
`.my-assignment-card.overdue` even set `opacity: 0.78`, literally fading out the
most urgent state. Now red in both themes, bold, at full opacity.

## The audit tool was wrong, twice
Both bugs produced silent PASSES, not errors, so earlier "0 failures" results
were overstated. Fixed and saved as `y/tools/demos/contrast-audit.js`:
1. It started the background walk at the element's PARENT, so filled buttons
   read as white-on-white.
2. It only parsed `rgba()` stops in background-image, so a card painted
   `linear-gradient(#ffffff, #f7faff)` looked transparent - the walk continued
   to a dark ancestor and scored white-on-white text as white-on-dark.
Re-running with the corrected tool surfaced 7 real failures that had been
passing. All fixed:
  .gr-pill.active (near-black text on a blue chip), .gr-stat-val (bright green,
  2.28:1), .qc-unit-topics, .xp-badge-pill and .map-btn-text (blue-400 as text
  on a pale-blue fill), and --text-muted nudged #5b6b7f -> #556274.

## Verification
- Contrast audit, corrected: hub, Grammar, Reading, Listening, Vocabulary,
  Quest Board - 0 failures each.
- `node --check` every JS file in the repo: passes.
- theme-sanity PASS; tokenise-colors idempotent; bump --check no drift.
- Service worker v228.
- The reading EXAM itself needs real Firebase data, so what was verified there
  is the palette (base tokens now resolve light), not a full exam run.

## Still open
- Classroom games (step 3).
- Em dashes: reading-exam.js had 58 including the visible "- choose -" options;
  hyphenated. Repo-wide there are still ~900 across ~80 files.
- Nothing deployed.
