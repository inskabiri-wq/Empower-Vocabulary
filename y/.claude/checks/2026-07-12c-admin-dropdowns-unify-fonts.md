# 2026-07-12c — Unify admin dropdowns + delete Writing-AI note + bigger fonts

## Why
User: the app should have ONE dropdown look (the Students filter bar, screenshot)
across admin Content, Writing AI, and Reports; delete the green "Backend ready"
note in the Writing AI panel; and admin fonts should be a bit bigger. Also
confirmed the Firebase project is now pay-as-you-go (the earlier Gemini billing
blocker is resolved).

## Changes
- `y/teacher-dashboard.html`
  - Added a shared `.ll-select` class and merged `.av-sel` into the same rule so
    admin dropdowns match `.filter-select` (navy `--bg-item`, `--border-color`,
    `--text-primary`, radius 8, padding 10px 16px, 14px). `.av-sel-full` kept
    (width:100%). This restyles the Teachers-panel dropdowns (level filter, new
    teacher level/module, per-row year/module) in place.
  - Bumped `reports-admin.js?v=8 -> ?v=9`, `ai-writing-admin.js?v=3 -> ?v=4`.
- `y/teacher/js/reports-admin.js` (?v=9)
  - All 6 filter selects (repRange/Level/Class/Module/Year + repCleanDays) now use
    `class="ll-select"`; removed the inline `selStyle` (t2 tokens).
  - Filter labels 11px -> 12px.
- `y/teacher/js/ai-writing-admin.js` (?v=4)
  - Deleted the green "Backend ready ..." setup note entirely.
  - Grant dropdown -> `class="ll-select" style="min-width:220px;"`.
  - Font bumps: add-label 11->12, grant button 13->14, list header 12->13,
    "no access" 12->13, teacher name 13->14, email 11->12, opener link 13->14,
    opener sub 11->12.
- `y/service-worker.js`: CACHE_VERSION `v92` -> `v93`.

## Verification
- `node --check` reports-admin.js + ai-writing-admin.js — OK.
- em-dash scan (dashboard html + both js + sw) — clean.
- Served-file probe (localhost, cache-busted): reports uses ll-select x6 + no
  selStyle; ai-writing has no "Backend ready", uses ll-select, name at 14px; CSS
  has the `.ll-select, .av-sel {` rule; html refs reports v9 + aiw v4.
- Computed-style harness (faithful: fetched the dashboard's real stylesheets +
  inline <style> into an iframe, no auth redirect):
  - `.ll-select` and `.av-sel` compute IDENTICALLY (ll_eq_av: true).
  - Both match `.filter-select`: bg rgb(28,42,66), border rgba(59,130,246,0.2),
    color rgb(248,250,252), padding 10px 16px, radius 8px; font 14px vs the
    reference 14.4px (0.9em) — intentionally a touch bigger than the old 12px.
- Smoke: 19 passed / 0 warnings / 1 failure — "Submissions reference real
  assignments" (pre-existing orphaned-submission data issue, unrelated).

## Notes / follow-ups
- Project now pay-as-you-go -> the Gemini billing blocker from [2026-07-12a/b] is
  resolved; live AI should return feedback. A definitive live check = open the
  corrector, paste a short non-sample essay, Analyze.
- Content-controls tab has no dropdowns (uses 3-scope toggle rows), so "admin
  content" here = the Teachers-panel `.av-sel` dropdowns, which are unified.

## To ship (user action)
- `firebase deploy --only hosting`.
