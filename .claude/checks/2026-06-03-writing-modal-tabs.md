# Writing assignment modal: full-page tabbed popup + AI demo tab · 2026-06-03

## Request
"New Writing Assignment make this a pop up full page margin page for more space
and bring them as tabs and put the demo there!" Follow-up choice (AskUserQuestion):
the demo should be "just a button/link" (not embedded).

## What changed (additive only - no field IDs or save logic touched)

### y/teacher-dashboard.html  (#writingAssignmentModal)
- Modal box widened to a full-page popup with margins:
  `writing-modal-wide` -> `max-width: min(1180px, 96vw); width: 96vw; max-height: 92vh`.
- Added a 4-button tab bar (`.wtabs` / `.wtab`), each calling
  `switchWritingTab('<name>', this)`:
    1) details   -> "1 Details"
    2) settings  -> "2 Settings & Rubric"
    3) targeting -> "3 Targeting"
    4) ai        -> "AI feedback"
- Wrapped the EXISTING field groups into 4 `.wtab-pane` divs
  (`data-wpane="details|settings|targeting|ai"`). Details is open by default;
  the other three carry the `hidden` attribute.
- AI pane = a card with title, plain-language description (three depths,
  named+modelled grammar, plan of next steps, NO scores), and one button:
  `Open AI feedback demo >` -> `window.open('http://localhost:8830/.staging/empower-write/','_blank','noopener')`.
- Footer (Cancel / Save Assignment) kept OUTSIDE all panes, made sticky at the
  bottom so it is visible on every tab.
- Added a small `<style>` block for `.wtabs/.wtab/.wtab-pane/.ai-tab-*`.

### y/assignments/js/writing-form.js
- `openWritingAssignmentModal()`: added `switchWritingTab('details');` right
  before `modal.classList.add('active')` so the modal always opens on tab 1.
- New function (exported to window):
  ```js
  function switchWritingTab(name) {
    const m = document.getElementById('writingAssignmentModal');
    if (!m) return;
    m.querySelectorAll('.wtab-pane').forEach(p => { p.hidden = (p.getAttribute('data-wpane') !== name); });
    m.querySelectorAll('.wtab').forEach(t => t.classList.toggle('active', t.getAttribute('data-wtab') === name));
    const box = m.querySelector('.modal-box'); if (box) box.scrollTop = 0;
  }
  window.switchWritingTab = switchWritingTab;
  ```
  Note: it toggles by `data-wpane`/`data-wtab`, so it does not depend on the
  `this` argument the buttons pass (harmless extra arg). Hidden panes stay in
  the DOM, so `getElementById` on Save still reads every field regardless of
  which tab is showing - save path is unchanged.

### y/service-worker.js
- `CACHE_VERSION` v10 -> v11 so returning users pick up the new HTML/JS.

## Why this is safe with the "assignments are fragile" rule
- Purely additive: every original `<div class="form-group">` / field id /
  label is preserved; only wrapper `.wtab-pane` divs were added around them.
- No change to `saveWritingAssignment()`, `applyWritingPrefill()`, validation,
  or Firestore writes.
- Hidden panes remain in the DOM (CSS `hidden`, not removed), so all values are
  still readable on Save.

## Verification
- `node --check y/assignments/js/writing-form.js` -> SYNTAX OK.
- Regex div balance on the modal region -> 307 open / 307 close = BALANCED.
- Smoke (static DOM parse): `.wtab-pane` count = 4, `.wtab` (switchWritingTab)
  buttons = 4, every writing field id still present (missing = none).
- Manual read of lines 1992-2179: tab names match pane names 1:1; Details open,
  others hidden; AI demo button present; Cancel/Save footer sits outside panes
  and is sticky.
- Live browser render NOT exercised this pass: the Chrome extension was
  disconnected, and the live teacher dashboard needs Firebase auth (the modal is
  hidden until a teacher clicks New Writing Assignment). The change is a
  deterministic, additive DOM/JS restructure fully covered by the static checks
  above. Recommend a quick click-through after deploy.

## Deploy (user action)
1. `firebase deploy --only hosting`
2. Hard-refresh (Ctrl/Cmd + Shift + R) once, so the v11 service worker takes over.
3. Click "New Writing Assignment" -> confirm the 4 tabs switch, all fields save,
   and the AI tab's "Open AI feedback demo" opens the staging corrector.

## Follow-up: em/en dash scrub (teacher-dashboard.html)
User confirmed scrubbing the leftover dashes in existing field text.
- Replaced every em dash (U+2014) and en dash (U+2013) with a plain hyphen
  across the whole file: 73 -> 0.
- Method: .NET `[IO.File]::ReadAllText` -> `.Replace(...)` -> `WriteAllText`
  with `UTF8Encoding($false)` (no BOM), so emojis/box-art are preserved.
- Covered both UI-visible text (option labels like "A2 - Elementary", the
  "- Not set -" / "- Select a level -" placeholders, the title placeholder
  "B2 Opinion Essay - Practice 1", the Rubric "- optional, shown to students"
  hint) AND dev comments.
- Verified: grep for `[em/en dash]` = 0 matches; the 4 `.wtab-pane` divs and all
  field option labels still present and reading cleanly.
- Character-only change: cannot affect div balance, IDs, or logic. Rides on the
  same v11 deploy as the tab restructure (no extra cache bump needed).
- Scope was this file only ("while we are in here"). Other pages/JS may still
  contain em dashes; an app-wide sweep is available on request.

## Note on the demo URL
The AI tab opens `http://localhost:8830/.staging/empower-write/`, which only
works on your machine while the local no-cache server is running. It is a
private preview by design (Empower Write is built beside the app and NOT
deployed). Once funded/approved, the live feature mounts directly in this AI
pane and that button is replaced.
