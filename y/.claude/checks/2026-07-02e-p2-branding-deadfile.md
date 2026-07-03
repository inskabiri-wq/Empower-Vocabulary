# 2026-07-02: P2 code-review fixes (branding + dead file)

## P2a - hub header said "FSM Language Trainer" instead of the brand
- student-dashboard.html:362  hub <h1> text "FSM Language Trainer" -> "Lingualab".
  Dashboard is now consistently "Lingualab" (title, apple-web-app-title, hub h1,
  vocab menuScreen h1).
- manifest.json description started "FSM Language Trainer - practice English..."
  with an em dash -> "Practice English across ..." (drops the stale name AND the
  em dash). manifest name/short_name were already "Lingualab".
- Left intentionally: teacher/js/student-detail.js PDF footer
  ("Lingualab | FSM Language Trainer | confidential ...") already leads with the
  brand and reads as a descriptor; tools/demos/hub-preview.html is a dev-only
  preview. Neither is student-facing pilot flow.

## P2b - dead firebase-config.js
y/index/js/firebase-config.js was a duplicate Firebase init loaded by NO html page
(grep across y/ found zero code references). Deleted. Preflight js-parse count went
104 -> 103, confirming removal; manifest.json still valid.

## Verified
preflight ALL PASS (syntax 103 js, grammar sanity, version drift, data JSON,
em-dash on changed files). My edits add 0 em dashes (net -1, removed the manifest
one). No cache-first asset changed (student-dashboard.html is network-first, manifest
is no-cache), so NO service-worker bump needed. No deploy / no push.

## Flagged, not changed (out of P2 scope)
student-dashboard.html:822 and :841 render a bare em dash as the Writing/Speaking
skill subtitles (`<div class="skill-sub">—</div>`) - user-facing, pre-existing.
Needs a content decision (drop it, or real text), so left for the user.
