# 2026-07-06: per-exam 3-scope visibility (Practice / Classroom / Assignments)

## Request
Reading (and listening) exams in Content controls need THREE independent hide
buttons per exam: hide from practice, hide from classroom game, hide from
assignments. Plus: the 3 newly imported exams must be visible in every surface.

## Schema (settings/contentControls, admin-only writes, same doc)
- practiceHidden    (existing) - enforced by content-controls-student.js
- classroomHidden   (NEW)      - { reading:[examId], listening:[examId] }
- assignmentsHidden (NEW)      - { reading:[examId], listening:[examId] }

## Changes
- teacher/js/content-controls.js (?v=7 -> ?v=8): reading/listening exam rows now
  render 3 scope pills (check Practice / check Classroom / check Assignments; x =
  hidden, amber). flipScope() saves all maps; load() parses them; level title
  shows "N restricted". Grammar/vocab rows keep the single practice toggle.
- assignments/js/exam-form.js: live onSnapshot on settings/contentControls;
  assignments-hidden exams are EXCLUDED from the exam dropdown. onSnapshot (not
  a one-shot get) because the admin panel lives on the same page - a stale
  cache bug found LIVE in the E2E and fixed on the spot.
- classroom-teacher.html: ccClassroomHidden loader + visibleExams(skill,level)
  filter wired into all four reading/listening level+exam dropdown builders.
- teacher/js/config.js + classroom/js/teacher.js: same localhost+flag guarded
  emulator connect as the other pages (teacher-side E2E possible now).
- tools/seed-emulator.js: seeds the ADMIN identity (akabiriaslifar@fsm.edu.tr)
  so admin-only writes can be exercised locally.
- Bulk em-dash cleanup (134) in the touched files incl. all registry titles.

## Verified LIVE on the emulators (admin login, real UI clicks)
1. Admin panel: C1 tab present; both new C1 exams + Gold listed; 3 pills each.
2. Clicked "Classroom" hide on c1-r2 (Bats) + "Assignments" hide on c1-r1 (Dogs):
   Firestore doc showed classroomHidden.reading=["c1-r2"],
   assignmentsHidden.reading=["c1-r1"].
3. Assignment modal: 47 options, Gold + Bats present, Dogs EXCLUDED.
4. Classroom reading picker: levels A1/A2/B1/B2/C1; C1 list = only Dogs; Bats
   EXCLUDED.
5. reading-exam.js READINGS_INDEX confirmed registry-derived (student practice
   gets new exams automatically; practiceHidden enforcement pre-existing).
Toggles were made in the in-memory emulator only - production untouched.

## Ritual
node --check all touched JS + 3 inline classroom scripts parse OK; preflight ALL
PASS; content-controls.js ?v=8; SW bumped for the no-query files. No deploy/push.
