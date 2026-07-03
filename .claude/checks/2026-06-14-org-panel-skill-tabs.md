# 2026-06-14 — Organizations panel + Content controls skill tabs

## Skill tabs in Content controls
Teacher wanted skill tabs in the Content controls panel (which already had level tabs).
- `teacher/js/content-controls.js`: added a skill-tab row (All / 📖 Reading / 🎧 Listening
  / ✏️ Grammar) above the level tabs. `activeSkill` state filters which blocks render for
  the active level; "All" shows everything. Cache: content-controls.js v2 -> **v3**.

## Organizations panel (was never in the code)
The user was sure an organizations panel existed. Confirmed it did NOT: a full search
(admin.js, all of y/, the .tmp design mockup) found only the DATA layer
(index/js/org-registry.js, the sign-up domain gate) and the admin tab's "Add Teacher"
form (which only mentions the FSM domain). The org-registry header even says a management
UI was *intended* but it was never built. None of my prior work touched org code.
Built it now:
- `teacher-dashboard.html` Admin tab: new `#orgAdminPanel` / `#orgAdminBody` below
  Content controls.
- `teacher/js/org-admin.js` (new, ?v=1): lists organizations (name, @domain, Active
  toggle, "Can host teachers" toggle, Remove), plus an add form (name + domain +
  teacher-eligible). Saves to `settings/organizations` as
  `{ list, activeDomains, teacherEligibleDomains, updatedAt, updatedBy }` (admin-only via
  the existing /settings rule). FSM domains (fsm.edu.tr, stu.fsm.edu.tr) are protected —
  no Remove button — mirroring the org-registry fallback. Loads from settings, else
  OrgRegistry.FALLBACK. The sign-up gate (org-registry.js) already reads this doc live.
- Cache: service-worker v48 -> **v49**.

## Grammar map "doesn't work for all" — investigated, found healthy
The "Explore Grammar Map" board builds per level and the content is clean: A2/B1/B1+/B2
all have correctly numbered units (1-11 / 1-10 / 1-9 / 1-9), no missing/phantom units.
The recent grammar practice filter is guarded so it can't blank the map. From code +
data it works across all levels. Asked the user for the specific symptom (which level /
what happens) to pinpoint — could not reproduce from code.

## Verification — sanity + smoke
- **Sanity:** node --check OK on content-controls.js + org-admin.js; no em dashes.
- **Smoke** (stubbed harness, registries loaded): 0 errors. Content controls: 4 skill
  tabs; clicking Grammar hid the reading section and showed grammar. Org panel: 2 rows
  rendered, Remove only on the non-FSM org (FSM protected), add form present; toggling an
  org and adding a new org both fired saves (row count 2 -> 3).

## Versions
- content-controls.js v2 -> **v3**; org-admin.js new **?v=1**; service-worker v48 -> **v49**.

## Still pending (separate build): classroom timer widget
Countdown timer (presets, sound, fullscreen project mode) in Classroom Mode + teacher
dashboard. Not started.

## Not done
- No deploy (hosting-only; /settings rule already covers settings/organizations). No push.
