# Admin-section cleanup: remove Organizations panel + de-dup Confusing Pairs · 2026-06-04

## Requests
1. "Tightly coupled to firestore.rules - delete it in teachers dash under admin
   section" -> remove the Organizations (allowed email-domains) admin panel.
2. "[Confusing word pairs] I have it two places keep it only in admin" -> remove
   the Overview copy; keep the Admin-tab copy.

## Changes
### 1) Organizations panel removed
- Deleted file `y/teacher/js/organizations.js` (the self-installing "🏛 Organizations"
  admin card). It was a leaf IIFE: only teacher-dashboard.html loaded it, nothing
  else called into it (verified by grep).
- Removed its `<script>` include + comment from teacher-dashboard.html.
- Updated the neighbouring org-registry comment to drop the organizations.js mention.
- KEPT `index/js/org-registry.js` (window.OrgRegistry) - that is the login-page data
  layer that gates who can register, plus the hardcoded FSM fallback in firestore.rules.
  So registration gating is UNCHANGED; allowed domains are now managed in
  firestore.rules / the /settings/organizations doc directly, with no UI to edit them.
- firestore.rules was NOT modified.

### 2) Confusing Pairs de-duplicated (Overview copy removed)
- teacher-dashboard.html: removed the Overview mount block
  (`<div class="av-root"><div id="overviewConfusingPairsMount">`).
- overview-v2.js: removed the `ConfusingPairs.mount('overviewConfusingPairsMount')`
  call (left a comment noting it is admin-only now).
- KEPT the Admin-tab copy: admin.js still renders `#adminConfusingPairsMount` via
  `ConfusingPairs.mount('adminConfusingPairsMount')`. Shared module
  teacher/js/confusing-pairs.js and the student-side reader (games.js) are untouched,
  so flagged pairs still affect distractors.

### 3) Service worker
- CACHE_VERSION v11 -> v12 so returning users get all of today's changes.

## Verification (node + grep)
- `node --check overview-v2.js` -> OK.
- overviewConfusingPairsMount in html = 0; in overview-v2.js = 0.
- adminConfusingPairsMount references in admin.js = 2 (mount div + mount call) -> kept.
- organizations.js reference in html = 0; file exists = false.
- teacher-dashboard.html div balance = 303/303 BALANCED.
- (Note: overview-v2.js still has 34 pre-existing em/en dashes in its own
  comments/strings - NOT introduced here; app-wide dash scrub still available on request.)

## Deploy
- `firebase deploy --only hosting`, then hard-refresh (SW v12 takes over).
- No Firestore rules change needed.
