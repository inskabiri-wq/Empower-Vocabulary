# 2026-07-13f — Writing AI two-tier permissions: backend + admin UI

Part 1 of the permission feature. Backend enforcement + admin control panel.
(Client popups / always-visible icon / assignments entry point = next part.)

## Data model (settings/aiWritingAccess)
- `teacherUids[]` -> base access (Light + Medium)   [existing]
- `deepUids[]`    -> extra permission for Deep        [new]
- `deepCaps{uid}` -> per-teacher Deep limit; 0/missing = unlimited [new]
- `deepUsed{uid}` -> Deep count, written server-side only        [new]

## Server (`functions/index.js`)
- `assertWritingAI(context, depth)`: base check for everyone (admin bypasses);
  for depth==='deep' also requires uid in deepUids AND deepUsed[uid] < deepCaps[uid]
  (when a cap > 0). Distinct HttpsError codes/messages:
  - no base -> permission-denied "You do not have permission to use Writing AI..."
  - no deep -> permission-denied "Deep analysis needs extra permission..."
  - over cap -> resource-exhausted "You have used all N of your Deep analyses..."
- analyzeWriting: computes `depth` BEFORE the check and passes it; after a
  successful Deep run by a non-admin, increments `deepUsed[uid]` via
  FieldValue.increment (Admin SDK, set+merge) so the cap is authoritative.

## Admin UI (`ai-writing-admin.js` ?v=5)
- Replaced the grant-dropdown with a per-teacher table: Teacher | Use | Deep |
  Deep limit | Used. Deep checkbox disabled until Use is on; limit input disabled
  until Deep is on; blank/0 = unlimited; "Used" shows N (and /cap, red when hit).
- save() uses update() (falls back to set+merge) so removed caps actually clear
  and the server-written deepUsed is preserved. Never writes deepUsed.
- Bumped teacher-dashboard.html ref ?v=4 -> ?v=5; SW v94 -> v95.

## Verification
- `node --check` functions/index.js + ai-writing-admin.js — OK. em-dash — clean.
- Gate decision unit test (8 cases): no-base blocked, base ok, base-only blocked
  from Deep, Deep at cap blocked, Deep under cap ok, Deep no-cap ok, admin always
  ok. PASS.
- Admin UI browser harness (real ?v=5 + stubbed Firestore): 2 rows; t1 base
  checked from cfg; t2 Deep disabled until Use; ticking Use->Deep->limit 5 saves
  teacherUids[t1,t2] / deepUids[t2] / deepCaps{t2:5}; payload has NO deepUsed. PASS.

## To ship (user action)
- BOTH: `firebase deploy --only functions:analyzeWriting` AND
  `firebase deploy --only hosting`.
- Then Admin > Writing AI shows the table; set Use/Deep/limits per teacher.

## Still to build (next part)
- Client: reveal the sidebar ICON for all teachers (always visible); show a themed
  popup on no-permission / no-Deep / cap-reached instead of the inline note.
- The unified writing-AI entry point under Assignments (user: "right side, under
  the assignment, above activities") - need to locate that exact spot in the layout.
