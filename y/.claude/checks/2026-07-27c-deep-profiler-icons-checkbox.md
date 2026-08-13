# 2026-07-27c - Deep profiler tables restored, SVG card icons, styled checkbox

Three separate reports against the writing lab, fixed together.

## 1. "In deep I don't see the chart of words that was there before"

NOT a regression - the data was never requested. `renderProfile` in corrector.js
has always had two branches:

- rich: sortable **Words / Verb forms / Clauses** tables (List <-> Distribution
  toggle, per-row "view sentences"), built from `lemmas` / `verbForms` /
  `clauses`
- fallback: the 3-bar Vocabulary range + Grammar range summary

Only the PRE-BAKED SAMPLE essays carried those three arrays. `writingSchema`
never asked Gemini for them, so EVERY live analysis - light, medium and deep -
took the fallback branch. The tables were last seen on a sample.

Fix (`functions/index.js`):
- `lemmas` / `verbForms` / `clauses` added to the schema, and pushed onto the
  DEEP `required` list, so constrained decoding guarantees them there.
- Prompt gained a deep-only `profilerSpec`: lemma = dictionary form + PoS +
  CEFR + real count, no function words, max 40; verbForms max 12 and clauses
  max 10, each with 1-2 verbatim example sentences. The caps exist because
  these three lists are the bulk of a deep response's output tokens.
- `maxOutputTokens` is now depth-aware: **16384 for deep**, 8192 otherwise.
  A truncated response is not shorter feedback, it is invalid JSON and the
  whole run fails. You are billed for tokens produced, not for the cap.

Fix (`corrector.js` `renderProfile`): the summary row (Level estimate +
Vocabulary range + Grammar range) now ALWAYS renders and the profiler tables
are appended BELOW it. Previously the rich branch replaced the summary cards,
so switching to deep would have silently removed two cards. Deep is now
strictly additive. The dead `else` branch and the orphaned `.cor-estwrap` rule
are gone.

COST: deep only. Roughly +1000 to +1500 output tokens per deep run on the
pricier deep model, about +$0.01 per run. Deep is already permission-gated and
capped per teacher, so the exposure stays bounded. Light and medium unchanged.

## 2. "Change the SVG" (the Level Estimate icon)

The profile card headings used colour emoji, which render inconsistently per OS
(on Windows several came out as flat coloured blocks), cannot inherit the
heading colour, and print badly. Replaced all six with inline SVG on
`currentColor` via a new `icon(name)` helper + `ICONS` map:

| was | now |
|---|---|
| 📊 Level estimate | bar-chart SVG |
| 🔤 Vocabulary range / Words | book SVG |
| 🔧 Grammar range / Verb forms | lines SVG |
| 🧩 Clauses | node SVG |

`.cor-hicon { flex:none; opacity:.9 }`. Because they use currentColor they turn
black automatically under the existing print stylesheet.

## 3. "The box is not stylish" (the Simpler checkbox)

`.cor-toggle input` was a native checkbox: a bare white square on a dark
toolbar, with only `accent-color` applied (which colours the TICK, not the
empty box). Replaced with a drawn checkbox from the same box family as the
toolbar inputs: `appearance:none`, 18px, `#0b1120` fill, same border token,
5px radius; on `:checked` it fills with the app indigo `#6366f1` and draws a
white tick; focus-visible ring; the wrapper border also turns indigo when on.

## Verification (real browser, served files, real buttons)
- Real depth buttons + real Analyze button, stub answering `analyzeWriting`
  with exactly the shape the new schema requires per depth.
- MEDIUM: 3 cards (Level estimate / Vocabulary range / Grammar range), 5 vocab
  bars, 0 tables. Unchanged from before.
- DEEP: **6** cards - the same 3 PLUS Words(4 rows) / Verb forms(2) /
  Clauses(2). 8 table rows, 6 List/Distribution toggles, 2 view-sentence
  buttons. Nothing lost, tables gained.
- Heading icons: 6 inline `svg.cor-hicon` present, **0 emoji** in heading text.
- Checkbox computed styles (transition disabled - the pane was not compositing,
  which freezes transitions at their start value and gave a misleading first
  reading): unchecked `rgb(11,17,32)` box / subtle blue border; checked
  `rgb(99,102,241)` fill + border, white 5x10 tick rotated 45deg.
- Console: zero errors.
- node --check on both changed files; rubric-sync PASS; ui-sanity PASS;
  grammar-sanity PASS; em-dash in added lines: 0.
- Versions: corrector.js ?v=10, corrector.css ?v=5, SW v113 -> v114.

## Ship
```
firebase deploy --only hosting
firebase deploy --only functions:analyzeWriting
```
The function deploy is what actually restores the Words table - hosting alone
ships the renderer, but the server would still never send `lemmas`.
