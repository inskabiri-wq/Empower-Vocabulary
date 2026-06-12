# Writing modal: wizard Next/Back + remove COMING SOON tile · 2026-06-04

## Request
1. "We don't need that" - remove the disabled "AI feedback - COMING SOON" checkbox
   tile from the Settings & Rubric tab (the real AI feedback is now its own tab, #4).
2. Make the footer a proper wizard:
   - Page 1 (Details):   Next only
   - Page 2 (Settings):  Back + Next
   - Page 3 (Targeting): Back + Next
   - Page 4 (AI):        Back + Save Assignment  (no Next)
   So Save shows ONLY on the last page.
3. Hard constraint from user: "do whatever it takes to make sure it never breaks."

## Changes (additive; save path untouched)

### y/teacher-dashboard.html
- Removed the visible COMING SOON tile. Kept a hidden input in its place:
  `<input type="checkbox" id="writingAiCorrection" hidden>` - REQUIRED, because
  writing-form.js reads #writingAiCorrection in 3 spots (reset L43, save L219,
  prefill L352). Deleting the element would null-crash open/save/edit. Hidden
  input keeps value = false, identical saved data, zero JS change.
- Settings-row comment updated ("Auto-submit toggle. (AI feedback now has its own tab.)").
- Footer: now `display:flex` with Cancel on the left and a right-aligned cluster
  (`margin-left:auto`) holding Back, Next, and Save. Added `id="writingSaveBtn"`
  to the Save button.
- `<style>`: added `.wnav-btn` (neutral pill) + `.wnav-btn:hover` +
  `#writingSaveBtn[hidden]{display:none}` and `.wnav-btn[hidden]{display:none}`
  (id/attribute selectors beat the `.modal-btn` class so hiding is reliable).

### y/assignments/js/writing-form.js
- `var WRITING_TABS = ['details','settings','targeting','ai'];`
- `currentWritingTab()` reads the visible pane.
- `switchWritingTab(name)` now also sets footer button visibility:
  ```
  back.hidden = (i <= 0);          // no Back on page 1
  next.hidden = (i === last);      // no Next on the last page
  save.hidden = (i !== last);      // Save ONLY on the last page
  ```
- `nextWritingTab()` / `prevWritingTab()` walk WRITING_TABS; both exported to window.
- `openWritingAssignmentModal` already calls `switchWritingTab('details')` on open,
  so the modal resets to page 1 with the correct buttons each time.

## Button matrix (verified by tracing the logic)
| Page | i | Back | Next | Save |
|------|---|------|------|------|
| Details   | 0 | hidden | shown  | hidden |
| Settings  | 1 | shown  | shown  | hidden |
| Targeting | 2 | shown  | shown  | hidden |
| AI        | 3 | shown  | hidden | shown  |

## Verification (node .claude/checks/2026-06-04-writing-wizard-check.js)
- `node --check writing-form.js` -> SYNTAX OK.
- div open/close 305/305 -> BALANCED.
- panes = 4; #writingBackBtn / #writingNextBtn / #writingSaveBtn each = 1.
- missing field IDs = NONE (all 19 fields the save path reads still present).
- COMING SOON gone from settings pane; writingAiCorrection is a hidden input.
- em/en dashes = 0.
- js: window.switchWritingTab / nextWritingTab / prevWritingTab / WRITING_TABS /
  function saveWritingAssignment all present; save reads writingAiCorrection x3.
- ==> ALL CHECKS PASS.

## Why the writing assignment cannot break from this
- Every change is additive HTML/CSS + 3 tiny sync DOM functions. No field id,
  no validation, no Firestore call, and `saveWritingAssignment()` are changed.
- Next/Back/tab-switch are pure show/hide of divs already in the DOM. No network.
- Hidden panes stay in the DOM, so Save still reads every field on any page.

## The "Access Denied" the user saw (SEPARATE, pre-existing)
- It is `#accessDenied` (the 🔒 "only available for teachers" + "Go to Practice"
  screen), driven by `y/teacher/js/config.js` - NOT by the modal and NOT by Next.
- config.js shows it when: no user / user doc missing / role != 'teacher' /
  a Firestore read throws `permission-denied` during loadDashboard (L285) /
  ANY unhandled promise rejection -> `fatal()` (L54-56) / 30s load timeout (L134).
- The `unhandledrejection -> fatal()` path is aggressive: a single failed
  background read can overlay "Access Denied" on top of an already-loaded
  dashboard, which matches "access denied in the background."
- NOT YET FIXED. To target the exact branch without guessing, need the small grey
  line under the "Access Denied" heading (that text = `#accessInfo`, set by the
  branch that fired) and/or the red console line (e.g.
  "[loadDashboard] studentsQuery FAILED: <code>" or "Error loading dashboard").
- config.js is security-adjacent; will not modify it blind. Diagnose first.

## Copy fix (same session) - AI tab was mis-described
- The AI tab text wrongly said "students get instant AI writing feedback".
  WRONG: this is a TEACHER tool. It is the AI counterpart of the manual
  comment-bank correction panel - same rubric, same comments/highlights, no
  scores - except the AI drafts the marking via the API and the teacher
  reviews/edits/releases. Students do NOT self-serve it.
- Renamed tab + card head "AI feedback" -> "AI correction" (cosmetic; data-wtab
  / data-wpane stay "ai", so JS is unaffected).
- Rewrote `.ai-tab-desc` to say "the AI version of the panel you use to correct
  papers ... a teacher tool, not an automatic grader for students."
- Note now: "Once approved, this AI correction panel mounts right here, beside
  your manual comment-bank one."
- Verified: ALL CHECKS PASS; "students get instant" = 0; "AI correction" x2;
  em/en dashes = 0.

## Deploy
- On localhost:8830 (no-cache preview): just refresh.
- On the live site: `firebase deploy --only hosting` then hard-refresh (SW already v11).
