# Empower Write — staging build · 2026-06-03

## What
A standalone AI **writing corrector** (3 depths, **no scores**) built beside the
app, ready to mount into `y/` when funding lands. Practised here with Claude as
the "API". Built on the app's existing rubrics / comment bank / annotation engine.

## Where (and why it can't deploy)
`E:\vocab-trainer\.staging\empower-write\`
- Outside `y/` (deploy root is `public: "y"`) **and** under a `.`-folder
  (`firebase.json` ignores `**/.*`). Doubly excluded from `firebase deploy`.
- Touches **zero** live files. Loads the real `writing-comment-bank.js` +
  `writing-annotations.js` + `variables.css` by relative path (shared, not copied).

## Files
- `index.html` · `css/corrector.css`
- `js/corrector-config.js` (3 levels + severities)
- `js/sample.js` (sample essay + 3 worked corrections — instant demo)
- `js/corrector.js` (anchors quotes → highlights → level-aware panel; practice mode)
- `README.md` · `SCHEMA.md` (API↔UI contract) · `PROMPT.md` (the 3 system prompts)

## Levels (depth, not marks; no scores anywhere)
- 🪶 Light — triage: only what a reader notices first; few marks + brief overall.
- ✍️ Medium — full correction pass: all marks + per-criterion notes + plan.
- 🔬 Deep — minute analysis: every issue + detailed criteria + model rewrites + plan.

## Checks (all PASS)
`node --check` on all 3 JS files → clean.
Smoke (`.claude/checks/2026-06-03-empower-write-check.js`):
- config + sample eval cleanly.
- **Quote anchoring: Light 5/5, Medium 14/14, Deep 17/17** found in the essay (in order).
- Every level has ≥1 strength; all severities valid (fix/tip/strength).
- deep has rewrites; medium has plan.
- corrector.css braces balanced (86). index.html: all 9 required refs present,
  `<div>` balanced (16), closes cleanly.
- Served over HTTP: page + all 3 shared includes return **200**.

## Run / preview
Local server (started this session): `py -m http.server 8830 --directory E:\vocab-trainer`
→ open `http://localhost:8830/.staging/empower-write/`
(Or just open `index.html`; HTTP is recommended so the relative `../../y/` includes load cleanly.)

## Mount when funded (mechanical, ~30 min)
1. Move the 4 staging assets into `y/assignments/…`; point includes at the real files in place.
2. Add `y/empower-write.html` (or a button in the teacher essay viewer) that calls
   `renderCorrection(apiResponse, essayText)`.
3. Replace practice mode with ONE real call: `buildPrompt(level,rubric,task,essay)` →
   Gemini (in-Firebase) or Claude (via tiny proxy) → pass JSON to `renderCorrection`.
4. Optional: persist AI `annotations` to `writingSubmissions.annotations` (same shape teachers use).

## Notes
- Output schema == existing annotation schema (+ `severity`, `suggestion`; `score` always omitted).
- The teacher's preferred GPT can be folded into `PROMPT.md` (mix & match voice; schema unchanged).

## Iteration 2 (2026-06-03) — 15 feedback fixes
1. Deleted the header subtitle + the task-label hint parenthetical.
2. Task/prompt is now a multi-line textarea (bigger).
3. Highlights much more visible (3px underline, stronger tint, brighter focus ring).
4. Fixed click→comment scroll: mark-click scrolls to comment, comment-click scrolls to mark (removed the double-scroll that fought itself).
5. Criterion cards always show the note + issue count as the basis for the verdict.
6. Removed em dashes (—) from all UI-visible text (title, blurbs, copy). (Dev `.md` docs + code comments still contain them; not user-facing.)
7. Added a "Simpler language" toggle → swaps to simple-English overall/notes (sample has variants) and adds a simple-English instruction to the API request.
8. Layout is now full-width stacked: essay on top, then a profile row, then comments in a multi-column grid UNDER the text (no more tall narrow sidebar).
9. Hover a highlight → floating tooltip with the comment + suggestion. Click still jumps to the full comment.
10. Renamed Correct→Analyze; sample renders + scrolls to results; custom essay opens practice mode with a clear inline instruction.
11. Added "Level estimate" card: CEFR + IELTS/TOEFL/rubric **suggestions** (clearly flagged "suggestions only, not an official score"). No hard scores.
12. Added overall CEFR estimate + Vocabulary CEFR distribution (bar chart per band).
13. Added Grammar distribution (feature × count + CEFR badge).
14. Fixed white-on-white rubric dropdown (solid dark `<option>` bg + text colour).
15. Practice-mode paste now tolerant: strips ```code fences``` and extracts the `{…}` block; shows a clear error instead of failing silently.

Re-checks: node --check (3 files) clean; smoke PASS (quotes 5/14/17 anchor); CSS braces 112; HTML balanced; served index/sample over HTTP return 200 with the new markers present.
Interpretations to confirm with user: #6 = "never use the — dash"; #11 = predictive band figures allowed but only as labelled suggestions.

## Iteration 3 (2026-06-03) — 4 follow-ups
1. Vocabulary distribution rebuilt as a VERTICAL bar chart (old horizontal fill was on an inline span, so width/height collapsed → no bar).
2. Grammar range is now CEFR TABS (ALL + A1/A2/B1…); each feature shows count + CEFR badge + example words from the essay (added `examples[]` to sample grammar features).
4. ROOT CAUSE of invisible highlights found: `<mark>` defaults its text colour to BLACK, so highlighted words were black-on-dark and vanished. Fixed with `.cor-hl{color:inherit}` + boosted tint (fix/tip 30%, strength 40%).
3. (No change needed — user liked the content descriptions.)
Re-checks: node --check clean; smoke PASS (5/14/17); CSS braces 120; served assets contain cor-vbars/cor-tab/color:inherit.

## Iteration 4 (2026-06-03) — samples + cleanup
- Added 3 more samples + a Sample picker dropdown. sample.js now exports `window.CORRECTOR_SAMPLES` (array of 4); `CORRECTOR_SAMPLE` kept as back-compat default.
  - S1 Uniforms (B1·essay), S2 Social media (B2·essay), S3 Daily routine (A2·short rubric), S4 Online learning (B1·academic rubric). Covers all 3 rubrics + A2/B1/B2.
- Deleted the Practice-mode accordion (dev/req/json/paste). Custom essays now show an inline note (live AI runs once mounted). Removed corSample/corDev wiring; added corSamplePick + corReset + corNote.
- Smoke check extended to iterate ALL samples. PASS: S1 5/14/17, S2 3/8/10, S3 3/6/7, S4 3/7/9; CSS braces 121; served HTML has samplePick+reset, accordion gone.
Note: buildPrompt()/parseLooseJson() remain defined (unused now) for mounting reference.

## Iteration 6 (2026-06-03) — editing, print, equal pair, simple-lang on all parts
- Equal pair: .cor-prof-pair now align-items:stretch + .cor-pt-list fixed 300px → Verb forms & Clauses equal height with scroll (verified 376/376).
- "N issues ›" in By-criterion is clickable → jumpToCrit() scrolls to that criterion's comment group + flash (verified).
- EDIT MODE (✏️ Edit toggle, body.cor-editing): overall, criteria (verdict+note), comments (text+suggestion), model rewrites (before/after/why), plan — all contenteditable + ✕ delete + "+ Add". Writes back to activeCorrection (simple fields when simpleLang on). Verified add(15)/delete(14)/edit-persist.
- PRINT/PDF: 🖨️ button → window.print() + @media print stylesheet (light, hides controls, expands tables, dark text).
- Simpler-language now covers ALL text parts: added noteSimple (criteria) + planSimple + helpers noteOf/whyOf/planArr + suggestionOf. Verified overall/note/comment/plan all switch on Uniforms·Medium.
- STALE-CACHE FIX (recurring): replaced plain http.server with .staging/serve-nocache.py (Cache-Control: no-store) on 8830, and versioned local includes (?v=2). Root cause of "simple language doesn't work": browser served an old cached sample.js. Now refresh always fresh.
- node --check + smoke PASS (CSS braces 194); all features verified live via Chrome MCP.
- Pending (optional): author simple variants for S2/S3/S4 + deep; persist edits on mount.

## Iteration 5 (2026-06-03) — Text-Inspector-style profiler tables
- User referenced Text Inspector (English Vocabulary Profile + English Grammar Profile). Built sortable tables into the profile area:
  - Words (Lemma · PoS · CEFR · Count), Verb forms (Form · With · CEFR · Count), Clauses (Clause · With · CEFR · Count).
  - Sortable column headers (▲/▼; default Count desc; CEFR sorts by band then count); CEFR colour badges; coloured lemma/PoS; sticky headers + scroll.
  - Each row: "view sentences" (☰) expands example occurrences from the essay.
  - Per-table List ↔ Distribution tabs (Distribution = CEFR histogram derived from the rows).
- Data added to S1 (uniforms) faithful to the user's screenshots (uniform A2×7, present simple/do×7, noun clause (that) B1×4, etc.): 26 lemmas, 10 verb forms, 6 clauses.
- Backward compatible: samples without `lemmas` (S2/S3/S4) keep the simpler vbar + grammar-tab cards. `activeProfile = currentSample()` feeds essay-level profile to renderProfile; correction.lemmas overrides if present.
- Checks: node --check clean; smoke PASS (4 samples); profiler-data sanity (with-keys, cefr+count) ok; CSS braces 145; served JS has buildTableCard/renderTbody/toggleSentences.
- Next (pending user OK): author tables for S2/S3/S4; optional pagination + filter chips (+Form/+With/+CEFR) to match Text Inspector fully.

## Iteration 5b (2026-06-03) — fix "empty boxes / margin"
- ROOT CAUSE: the #corProfile CONTAINER still had class="cor-profile" (display:grid, auto-fit minmax 230). My rendered cards became grid items in a multi-column grid and were STRETCHED to equal row height (estimate card forced to ~809px → tall empty box + wasted margin). Tables themselves were fine (data present).
- FIX: removed cor-profile class from the #corProfile container (now plain block, vertical stack). Estimate card wrapped in .cor-estwrap (max-width 420px). .cor-prof-pair given align-items:start so the shorter Clauses card no longer stretches.
- VERIFIED LIVE (Chrome MCP, localhost:8830): container display=block; estimate 420×261 (was 809 tall); Words full-width; Verb forms + Clauses side-by-side (436 / 333, not equal-stretched); column sort works (CEFR desc→motivation/B2, asc→a/A1, count→a); view-sentences expands. Smoke PASS.

## Iteration 5c (2026-06-03) — profiler tables for ALL samples
- Authored sample-level lemmas/verbForms/clauses for S2 (social media B2), S3 (daily routine A2 short), S4 (online learning B1 academic) — realistic CEFR/counts/example sentences from each essay.
- Verified LIVE across all 4 samples via the picker: Uniforms 26/10/6, Social media 31/10/5, Daily routine 23/8/2, Online learning 25/8/5 tables render.
- Also: the background preview server (port 8830) had died → user saw Chrome's error page (looked like "no data"). Restarted `py -m http.server 8830 --directory E:\vocab-trainer`.
- GPT integration deferred per user ("forget about it for now").
- node --check + smoke PASS.

## Iteration 7 (2026-06-03) — alignment, rewrite diff, per-section edit, simplify(), cost, RENAME
- Toolbar alignment: `.cor-row` align-items center→flex-end so sample/rubric selects, level chips and the toggle line up (verified bottoms equal).
- Model rewrites: confirmed correct (Before=error, After=fix). Added char-level prefix/suffix **diff highlight** (`.cor-diff-del`/`.cor-diff-ins`) so subtle changes (e.g. comma-splice fix) are visible. Read-only shows diff; editable shows plain spans.
- Per-section editing: each card has a top-right ✏️ button (`editSet`); toggling makes just that section editable. Toolbar "✏️ Edit all" toggles all. Verified 5 section buttons.
- SIMPLER LANGUAGE FIX (root of repeated complaint): only Uniforms·Medium had hand-authored `simple`. Added `simplify()` (grammar-term dictionary + praise patterns + first-sentence fallback) used by textOf/noteOf/overallOf/whyOf/planArr when no authored simple exists. Now affects comments/tips/fixes EVERYWHERE: Social media Deep 8/10, Daily routine 6/6, Online learning Deep 8/9 comments switch.
- COST.md: exact API spend. ~1k in / ~1.5k out per correction. Per correction: Gemini Flash $0.0005, Haiku $0.0068, Sonnet $0.026, Opus $0.128. 400 students @ ~800 corrections/mo: Flash ~$0.40/mo (~$4/yr), Sonnet ~$20/mo (~$185/yr), Opus ~$102/mo.
- RENAME: `.staging/writing-corrector/` → `.staging/empower-write/`; renamed check js + this md; scrubbed "Writing Corrector"/"writing-corrector"/"WRITING CORRECTOR" from all folder files + logs. New URL: http://localhost:8830/.staging/empower-write/.
- STALE-CACHE: now served by `.staging/serve-nocache.py` (Cache-Control: no-store) — refresh always fresh.
- node --check + smoke PASS; all verified live via Chrome MCP.

## Iteration 7b (2026-06-03) — estimate contrast + AI-responsibility button
- Q: "with Flash do I get all of this each time?" → YES; output schema is identical for every model (prompt-enforced full JSON). Flash = same data, lower accuracy; Sonnet/Opus = same data, sharper. Cost figures already assume full output.
- #2 Level-estimate rows were too faint: set label `#cbd5e1`, values `#fff` bold, brighter separators. Verified value colour = rgb(255,255,255).
- #3 Added AI-responsibility acknowledgment bar (`.cor-ack`): checkbox "I have reviewed this AI feedback and take full responsibility…" + a **Release to student** button that stays DISABLED until the box is ticked and is a no-op placeholder (shows a "demo only, not wired" note). Verified disabled→enabled→note.
- node --check OK; verified live (estimate white, release gated + no-op).

## Iteration 7c (2026-06-03) — top-right action cluster + release popup; cache-ready prompt
- Moved Reset / Edit all / Print / Release into a header **top-right cluster** (`.cor-topactions`); toolbar keeps only Analyze + blurb; removed the header ribbon and the inline `.cor-ack` bar.
- Release now opens a **popup** (`#corReleaseModal`): the "I take full responsibility…" text + Cancel / Confirm. Confirm = no-op placeholder (shows demo note); Cancel / backdrop-click closes. Verified open→confirm→close + note; Edit still works from header.
- PROMPT.md rewritten in **cache-ready order** (fixed prefix → CACHE BOUNDARY → essay last) reflecting current behaviour (name grammar point + model it, estimates-as-suggestions, simple/simpleSuggestion, lemmas/verbForms/clauses) + few-shot slot + cost table. buildPrompt() reordered to match (schema in prefix, essay last, cache-boundary marker).
- node --check OK; verified live via Chrome MCP.
