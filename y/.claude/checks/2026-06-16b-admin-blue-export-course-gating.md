# 2026-06-16 (round 2) - Admin BLUE palette + export gating + course activation gating

Corrections after user feedback: "admin panels are black, others are blue";
"I still see the report in the teacher dash"; "course activation/deactivation is
admin only, teachers only see their class."

## 1. Admin tab was gray, not blue (the real mismatch)
My earlier font swap was not the issue. The real difference: the rest of the
dashboard uses the BLUE brand palette (`teacher/css/styles.css`:
`--bg-card:#152035`, `--bg-item:#1c2a42`, border `rgba(59,130,246,.2)`), but the
Admin tab read the neutral GitHub-gray `--t2-*` tokens
(`--t2-surface:#161b22`, border `#30363d`).
Fix: a single scoped rule in `teacher-dashboard.html` re-points the `--t2-*`
tokens to the brand colors for `#tab-admin` only:
  - `--t2-bg:#0a0f1a; --t2-surface:#152035; --t2-surface2:#1c2a42;`
    `--t2-surface3:#22304d; --t2-border:rgba(59,130,246,.20);`
    `--t2-border-soft:rgba(59,130,246,.12); --t2-text:#f8fafc;`
    `--t2-text-muted:#94a3b8; --t2-text-dim:#64748b;`
Because the av- Teachers panel aliases `--av-* = var(--t2-*)` and the Feature /
Content / Organization sub-panels read `var(--t2-*)` directly, ONE rule recolors
the entire Admin tab. Accents (blue/green) already matched.
SMOKE (harness, computed styles): Teachers card + sub-panel both resolve to
`rgb(21,32,53)` = `#152035` with border `rgba(59,130,246,.2)` and text
`#f8fafc` - i.e. the same blue as the Overview/Students cards, no longer gray.

## 2. Export Report still showed for teachers -> admin only
The per-student Print/PDF was already gated, but the **sidebar "Export Report"**
(`exportToCSV`) and the **mobile more-menu "Export Report"** were always visible.
- `teacher-dashboard.html`: both buttons get `id` + `style="display:none"`
  (`#exportReportNav`, `#exportReportMore`).
- `teacher/js/config.js`: inside the existing `if (isAdmin())` block, both are
  revealed. Non-admin teachers never see an export entry point now.

## 3. Course activation/deactivation -> admin only
`teacher/js/policy-course-admin.js` `statusPill()`: the Activate/Deactivate
button (`#pcAdminToggleBtn`) now shows only when `isAdmin()`. Teachers still see
the status pill and "View completions" (read-only) and the certificate
fact-check box, but cannot activate/deactivate. (Firestore rules already reject
non-admin writes to `settings/policyCourse`, so this is UI + defence in depth.)

## Versions
- `policy-course-admin.js` ?v=7 -> **?v=8**; service worker **v53 -> v54**
  (busts the unversioned `config.js`). `teacher-dashboard.html` is network-first.

## Verification - sanity + smoke
- `node --check` OK on config.js + policy-course-admin.js.
- Em-dash scan: no em dashes in any line I added (config.js hits are pre-existing
  comments; policy-course-admin.js clean).
- Color cascade verified by computed-style harness (deleted after): admin cards
  now blue `#152035`, not gray `#161b22`.
- Could not screenshot the authed dashboard (login-gated in preview), so the
  Admin tab was verified by measuring the resolved CSS tokens rather than a
  live screenshot.

## Note still open
- Font sizes: dashboard now uses DM Sans throughout + sub-panel headers bumped to
  20px. If specific element sizes still look off vs other tabs, a screenshot of
  the spot would let me match them precisely.
- "View completions" currently is not class-scoped for teachers; left as-is since
  the explicit ask was about activation. Can scope it to the teacher's class on
  request.

## Not done
- No deploy (user runs `firebase deploy`; the video CSP fix needs `--only hosting`).
- No GitHub push.
