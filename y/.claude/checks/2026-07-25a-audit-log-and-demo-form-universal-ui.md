# 2026-07-25a — Access audit log + Demo account form on the app's universal UI

(First log correctly dated 2026-07-25; earlier logs in this session drifted -
see the note at the end.)

## 1. Access audit log looked like plain text (ai-writing-admin ?v=9)
Rows were bare lines with a hyphen separator. Now each entry is an app-style
row: bordered + rounded (radius 10) like every other list in the dashboard,
with a coloured ACTION PILL (green tint for grants, red tint for anything
matching /revok/i), the target teacher in bold, and "who - when" right-aligned
in muted text.
- Also fixed: a just-written entry showed a bare "-" because Firestore's
  serverTimestamp is not resolved locally yet. It now reads **"just now"**.

## 2. Demo account form used free-text fields (teacher-dashboard + demo-account-admin ?v=3)
The form mixed a raw <select> with free-text inputs, which was BOTH off-style
and a data-integrity hole: the Academic year was typed as "2025-26" while the
whole app filters on "2025-2026", so such an account matches no year filter.
- Class: text input -> `.ll-select` dropdown, options filled at runtime from the
  REAL class list (derived from `allStudents`, read by bare identifier behind a
  typeof guard since it is a top-level `let`, with a retry while the dashboard
  loads and a 'B101' fallback). Refilled when the sub-tab is opened.
- Module: text input -> dropdown (Module 1-4).
- Academic year: text input -> dropdown with CANONICAL values
  (2025-2026 / 2026-2027 / 2027-2028).
- Role + Level: existing selects gained the shared `.ll-select` class, so all
  FIVE controls now render in the one app-wide dropdown style.

## Verification (browser harness, real markup + real scripts)
- Demo form: all 5 controls are <select> and carry .ll-select; class dropdown
  populated from stubbed classes -> ["B114","C122","D310"] (deduped + sorted);
  year options canonical, "2025-26" gone. PASS
- Audit log: 2 rows rendered as bordered cards; pending row shows "just now",
  no bare dash; revoke row tinted red (248,113,113), grant row green
  (34,197,94). PASS
- node --check both JS files OK; em-dash scan clean.
- Versions: demo-account-admin ?v=3, ai-writing-admin ?v=9, SW v106 -> v107.

## Note on existing data
The already-created demo student carries `academicYear: "2025-26"`. It will not
match year filters until corrected - either delete/recreate it from this panel
(now impossible to get wrong) or leave it, since it is only a demo login.

## Ship
firebase deploy --only hosting
