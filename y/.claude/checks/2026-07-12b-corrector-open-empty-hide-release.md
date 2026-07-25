# 2026-07-12b — Writing corrector: open empty + hide Release (live tool)

## Why
The corrector (`lingualab-write/index.html`) is now the real teacher tool reached
from the sidebar link (see [2026-07-12a]). But it still opened as a demo: it
auto-loaded the "Uniforms (B1)" sample essay, showed a "Release to student"
button that is not wired yet, carried a "demo" badge, and a footer claiming live
AI "runs once this corrector is mounted in the teacher tools" (now false). The
user asked: open empty, and turn the Release button off for now.

## Changes
- `y/lingualab-write/index.html`
  - `<title>` "Lingualab Write · Demo" -> "Lingualab Write".
  - Removed the header `demo` badge (`<span class="cor-tag">demo</span>`).
  - `#corRelease` "Release to student" button -> `hidden` (not wired yet).
  - Footer rewritten to describe the real flow (paste writing, pick depth, live
    AI, review before sharing).
  - Bumped `js/corrector.js?v=3` -> `?v=4`.
- `y/lingualab-write/js/corrector.js` (?v=4)
  - New `clearAll()`: no active sample (`currentSampleIdx = -1`), empty essay +
    task, cleared correction, `editSet` cleared, results hidden.
  - Sample picker: prepended a `<option value="">Blank (paste your own)</option>`;
    `change` -> `clearAll()` when blank, else `loadSample(n)`.
  - `init()` now ends with `clearAll()` instead of `loadSample(0)` -> opens blank.
  - Reset button: clears when no sample is loaded, else restores the loaded sample.
  - (`isSampleEssay()` returns false when blank, so a pasted essay routes to the
    live `analyzeWriting` Cloud Function as before.)
- `y/service-worker.js`: CACHE_VERSION `v91` -> `v92`; normalized 3 pre-existing
  em dashes in the header comments to hyphens (touched-file cleanup).

## Verification
- `node --check y/lingualab-write/js/corrector.js` — OK.
- em-dash scan (index.html + corrector.js + service-worker.js) — clean.
- Browser (localhost:5173, SW cache cleared + reload to defeat stale ?v=4):
  - opens with essay empty, task empty, results hidden ✅
  - Release button not visible (offsetParent null) ✅
  - no `.cor-tag` demo badge; H1 = "Lingualab Write" ✅
  - sample picker defaults to "Blank (paste your own)" ✅
  - pick sample 0 -> essay fills + results show; back to Blank -> clears + hides ✅
  - probe of the served files confirmed the dev server serves the edited y/ copies
    (clearAll present, corrector.js?v=4, release hidden, new footer).
- Smoke: 19 passed / 0 warnings / 1 failure — "Submissions reference real
  assignments". PRE-EXISTING live-data issue (orphaned writing submissions
  pointing at deleted assignments); unrelated to this front-end change.

## To ship (user action)
- `firebase deploy --only hosting`.
- Still open: Gemini API billing depleted ("prepayment credits are depleted") —
  top up prepay OR switch the key's project to pay-as-you-go so live analysis
  returns results. Pipeline verified end to end otherwise.
