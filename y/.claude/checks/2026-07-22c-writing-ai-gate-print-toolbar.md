# 2026-07-22c - Writing AI: page gate, PDF cleanup, toolbar boxing

Reported from a downloaded PDF: the toolbar buttons printed, the page URL
printed and was clickable, the printed page was half empty, the "Simpler
language" control looked bad and jumped when Deep was hidden.

## 1. SECURITY: lingualab-write had NO page gate
The corrector rendered in full for anyone with the URL, and that URL is
printed into every PDF (Chrome's footer), so it does get shared. The AI call
itself was never exposed (assertWritingAI refuses server-side), but the whole
tool was on screen.

Added js/auth-gate.js, same posture as the dashboards (teacher/js/config.js):
  - no user            -> window.location.replace('../index.html')  (login)
  - signed in, granted -> reveal (admin, or uid in aiWritingAccess.teacherUids)
  - signed in, not granted -> #corGateDenied panel + link back to dashboard
FAIL CLOSED: <html class="cor-checking"> + an INLINE <style> hides .cor-app
before any stylesheet loads, and only a passing check removes the class. If
auth never answers, an 8s timer sends the visitor to login rather than
revealing the page.

## 2. PDF: on-screen controls were printing
The print block hid .cor-toolbar but NOT .cor-topactions, which holds Reset /
Edit all / Print / Release - that is the row in the screenshot. Added
.cor-topactions, .cor-sec-edit (per-section pencil) and .cor-modal.

## 3. PDF: half the page empty
.cor-comments is repeat(auto-fill, minmax(300px,1fr)). Group headers span all
columns, so any group with ONE comment left the right column blank, and grid
rows size to the tallest cell, which produced the big vertical gaps. In print
it is now a single full-width column, .cor-crit-grid is pinned to 2, and
comments/rewrites/criteria get break-inside: avoid so nothing splits across a
page break.

## 4. The printed URL is NOT ours
"https://empower-vocabulary-practice.web.app/lingualab-write/index.html" and
"4/6" are Chrome's own print header/footer, controlled by the "Headers and
footers" checkbox in the print dialog. CSS cannot switch it off. corrector.js
now shows a note when Print is pressed telling the teacher to turn it off.
A true fix would mean generating the PDF in-app (vendored jsPDF/html2pdf);
not done, flagged to the user.

## 5. Toolbar boxing (universal look) + no layout shift
- .cor-toggle ("Simpler language") had no box at all. It now uses the same box
  family as the inputs: #0f1729 background, var(--border-color), radius 12px,
  padding 10px 14px, hover border.
- margin-left: auto pins it to the RIGHT of the row, so gateDeepButton()
  hiding the Deep button can no longer shift it.
- .cor-levels switched from rgba(255,255,255,0.04) to the same #0f1729 so the
  three controls in the row read as one family.

## Verification
- node --check auth-gate.js + corrector.js OK; em-dash scan clean.
- Gate, real browser on the static server, SIGNED OUT: loading
  /lingualab-write/index.html redirected to /index.html (title
  "Lingualab - Login"). PASS.
- Toolbar harness (temp, deleted): measured .cor-toggle left BEFORE and AFTER
  applying gateDeepButton's display:none to the Deep button - 1054px both
  times, moved: false. Box confirmed: border present, background
  rgb(15,23,41), radius 12px, padding 10px 14px. PASS.
- Print rules verified by reading the compiled @media print block.
- NOT verified in a real print preview (headless pane cannot composite a
  print render); the print CSS is a static rule change.

## Versions
corrector.css ?v3, corrector.js ?v8, new auth-gate.js ?v1, SW v111 -> v112.

## Ship
firebase deploy --only hosting
