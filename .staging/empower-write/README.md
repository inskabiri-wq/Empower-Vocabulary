# Empower Write - staging (hidden, NOT deployed)

A standalone AI **writing corrector** for Empower Lab. It gives **three depths** of
feedback (Light / Medium / Deep) and **no scores** - qualitative correction only.
Built directly on the app's existing essay rubrics, criteria, comment bank, and
inline-annotation engine, so "mounting" it later is a straight move into `y/`.

## Where it lives & why it's safe
- **Path:** `E:\vocab-trainer\.staging\empower-write\`
- It sits **outside `y/`** (the deploy root) **and** under a `.`-prefixed folder.
  `firebase.json` ignores both (`public: "y"`, `ignore: ["**/.*", …]`), so
  `firebase deploy` can **never** ship it. It touches **zero** live app files.

## How to open it
Double-click `index.html` (or right-click → open in a browser). It loads the
**real** `writing-comment-bank.js` + `writing-annotations.js` from `..\..\y\…`
by relative path, so what you see is exactly what production would render.
> Tip: if a browser blocks the relative `file://` includes, run a tiny local
> server from `E:\vocab-trainer`:  `py -m http.server 8800`  then open
> `http://localhost:8800/.staging/empower-write/`.

## The three levels (depth, not marks)
| Level | Purpose | Shows |
|---|---|---|
| 🪶 **Light** | Triage - only what a reader notices first / what's failing | a few marks + brief overall + compact criteria |
| ✍️ **Medium** | Full correction pass for assignments | all marks + per-criterion notes + plan |
| 🔬 **Deep** | Minute, top-to-bottom analysis | everything + model rewrites + full plan |

## Practising now (Claude is the "API")
1. Pick a rubric + level, paste a real essay, click **Correct**.
2. The **Practice mode** panel builds the exact request - copy it, paste it to
   Claude in chat. Claude returns JSON (see `SCHEMA.md`).
3. Paste that JSON back into the box → **Render** → see the full visual.

The seeded **sample essay** renders instantly (no chat round-trip) so you can
see all three levels immediately - just click the level chips.

## Files
- `index.html` - the UI shell
- `css/corrector.css` - styles (theme tokens come from the app's `variables.css`)
- `js/corrector-config.js` - the 3 levels + severities
- `js/sample.js` - sample essay + 3 worked corrections (the instant demo)
- `js/corrector.js` - engine: anchors quotes, paints highlights, builds the panel
- `PROMPT.md` - the 3 system prompts the real API will use
- `SCHEMA.md` - the JSON contract between API and UI

## Mounting when funded (≈ 30 min, mechanical)
1. Move `js/corrector-config.js`, `js/sample.js`, `js/corrector.js`,
   `css/corrector.css` into `y/assignments/…` (drop the vendored relative paths;
   point at the real files in place).
2. Add a page (e.g. `y/empower-write.html`) or a button in the teacher essay
   viewer that calls `renderCorrection(apiResponse, essayText)`.
3. Replace **Practice mode** with one real call: send `buildPrompt(...)` to
   **Gemini** (cheapest, in-Firebase) or **Claude** (via a tiny proxy) and pass
   the returned JSON straight to `renderCorrection`. The schema already matches.
4. Optional: write the AI's `annotations` to the `writingSubmissions.annotations`
   field (same shape the teacher tools already use) so AI + teacher notes coexist.
