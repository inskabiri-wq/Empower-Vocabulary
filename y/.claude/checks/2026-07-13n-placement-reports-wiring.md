# 2026-07-13n — Placement: Reports wiring (final placement piece)

## Built (y/teacher/js/reports-admin.js, ?v=9 -> ?v=10)
- `placements` cache + `loadPlacements()` (lazy, /placementResults limit 1000,
  [] sentinel so it fetches once, re-render on arrival - same pattern as aiUsage).
- `filteredPlacements()`: respects the period (at vs cutoffMs), the Class filter
  (studentClass) and the Level filter (vs profileLevel when present).
- KPI tile "Placement tests" (purple).
- Chart "🎯 Placement recommendations by level" (A2/B1/B1+/B2 ordered, zoom
  lightbox like every other chart via chartCard).
- Excel sheet "Placement": Date, Student, Class, per-section %s, writing words,
  Recommended, ladder path, duration (min). Essay TEXT intentionally kept out
  of the file (stays in Firestore, read via the Placement tab).
- teacher-dashboard.html reports-admin ref ?v=10; service-worker v101 -> v102.

## Verification
- node --check - OK; em-dash - clean.
- Faithful harness (real ?v=10 script, top-level `let` globals, stubbed
  Firestore with real-shaped Timestamps): KPI = 2, chart has bars, class filter
  9A -> KPI 1. PASS.
  (First harness run failed with 0 - stub timestamps lacked .toDate(); loader
  instrumentation proved load/then/render all fired; code was correct.)
- Smoke: 19/0/1 (pre-existing orphaned-submissions data issue, unrelated).

## PLACEMENT FEATURE: COMPLETE (tasks 140-145)
Ship: `firebase deploy --only hosting` + `firebase deploy --only firestore:rules`.
Then: Admin > Features > 🎯 Placement Test = ON; Placement tab (admin-only,
grantable) -> pick exams/writing mode/targeting; students see the hub tile.
