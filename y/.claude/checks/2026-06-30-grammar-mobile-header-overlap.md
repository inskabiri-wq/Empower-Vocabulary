# 2026-06-30: Grammar mobile header overlap (icons over the title)

## Bug (mobile, reported with screenshot)
On the Grammar skill screen, the right-side controls (settings gear + avatar +
Logout) overlapped the "Grammar / Practice by level" title on a phone. Cause:
#grammarScreen .skill-header-right had flex-wrap:wrap while the parent stayed
nowrap and the group was flex-shrink:0, so the controls overflowed onto the title.

## Fix
- grammar.css: changed #grammarScreen .skill-header-right flex-wrap wrap -> nowrap
  and added a max-width:600px block: header wraps, title row on top full-width,
  controls on a full-width row below, right-aligned.
- skills.css: added the same max-width:600px rule generically for .skill-header so
  Reading / Writing / Speaking / Listening (same markup) cannot hit the same bug.

## Verified (isolated harness with the REAL css, python static server)
- Before: gear + avatar rendered on top of "Grammar" at 375px (screenshot).
- After: clean 2-row header, no overlap (screenshot). Desktop (661px+) unchanged,
  single row, measured overlap=false.
- em-dash 0 in both files. grammar.css ?v=15 -> ?v=16; skills.css has no query so
  the already-bumped service-worker v69 refetches it. No deploy / no push.

## 2026-06-30 (cont.): match Grammar header placement to Vocabulary
User: grammar and vocab headers should have identical placement. Rewrote the
skill-header mobile rule (skills.css, <=768px) to mirror the vocab .dashboard-
header stacking: back button on its own row, title below, settings/profile/logout
on a full-width row underneath, LEFT-aligned (was right-aligned, one-row hub+title).
Removed the now-divergent #grammarScreen @media from grammar.css (generic rule
covers it; kept flex-wrap:nowrap so controls stay one line).
Verified via harness geometry (real CSS): vocab and grammar both hubAboveTitle=true,
ctrlBelowTitle=true, controls left-aligned. grammar.css ?v=16 -> ?v=17; skills.css
relies on service-worker v69. em-dash 0 new. No deploy.
