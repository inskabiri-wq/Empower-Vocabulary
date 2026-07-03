# 2026-06-23 - Roster onboarding, Phase 3a: per-class QR codes

The "like Google Classroom" piece: one scannable QR + short join code per class,
printable, so students land in the right class without typing their name/number.

## What was built
- `y/teacher/js/vendor/qrcode.min.js` - qrcode-generator (Kazuhiko Arase, ~56 KB,
  dependency-free, exports global `qrcode`). Vendored locally, served from 'self'
  so the CSP needs no change; lazy-loaded only when the QR view runs.
- `y/teacher/js/roster-import.js` (extended): the class-codes view.
  - `ensureQr()` lazy-loads the QR lib.
  - `loadClassCodes()` reads `classes` where moduleId == the entered module
    (rules already allow signed-in read of classes), sorts by code, renders.
  - `renderClassCards()` / `buildCard()` draw one card per class: class code,
    level + teacher, an SVG QR, and the join code in mono. Dark theme on the
    dashboard, light theme in the print window.
  - QR encodes `location.origin + '/join.html?c=<classKey>&k=<joinCode>'`
    (the join page is Phase 3b, next).
  - `printClassCodes()` opens a print window with light cards + auto-print.
  - Exposed `window.RosterImport` (renderClassCards/ensureQr/buildJoinUrl) as a
    small surface for the verification harness.
- `y/teacher-dashboard.html`: added the "Show class QR codes" + "Print all"
  buttons and the `#riQr` container to the Roster import panel.

## Verification
- `node --check` clean; no em dashes in my code (vendored lib excluded).
- REAL-browser smoke (preview static-y, throwaway _riqr_harness.html, deleted):
  rendered 2 fake classes via the real `RosterImport.renderClassCards` ->
  2 cards, 2 QR SVGs each containing real modules (rect/path), class codes
  (D302/D303) + join codes shown, join URL exactly
  `http://localhost:5173/join.html?c=2026-M3__D302&k=K7M9PQ`. PASS.

## Open / next
- Phase 3b: `join.html` (the QR scan target) - signed-in student reads the
  class + their enrollment, confirms they are in the right class, routes to the
  dashboard. Read-only (no rules change needed).
- Phase 3c: set/change-password popup on the student dashboard (Firebase
  updatePassword + AppDialog; fires when users/{uid}.mustSetPassword is true).
- The live `loadClassCodes` Firestore read path is exercised only on the real
  dashboard (auth-gated); the render + QR + URL are verified above.

## Not done
- No deploy. No push. Login untouched.
