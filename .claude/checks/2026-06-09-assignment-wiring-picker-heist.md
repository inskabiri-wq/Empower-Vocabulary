# Assignment wiring + topic picker + student picker + heist password · 2026-06-09

The remaining 4 of the 8 reported issues (#5-#8).

## #5 Grammar assignment wiring (audited — it IS wired)
Traced the full chain; every link is present and correct:
- Create: grammar-form.js writes {skill:'grammar', level, topics, target...} to /assignments.
- Rules: /assignments create = isTeacher() && _validAssignmentTarget (targetType in
  class/level/module/individual) && teacherId==uid -> grammar passes.
- Student list: student-assignments.js is fully skill-aware (SKILL_REGISTRY.skillOf)
  and renders grammar like any skill.
- Start: startAssignment -> sk==='grammar' -> window.startGrammarAssignment(assignment).
- Completion: grammar.js -> markAssignmentCompleted(id,100) -> /assignmentCompletions
  /{uid}_{aid} with odUserId (matches the teacher + student read query).
Conclusion: the most likely cause of "nothing wired" was the STALE grammar.js
(startGrammarAssignment didn't exist yet, so clicking the assignment did nothing).
The cache bumps (grammar.js v8, SW v19) fix that. If a specific step still fails
after deploy, need the exact symptom to go further.

## #6 Topic picker grouped by Unit (grammar-form.js)
- populateGrammarTopics() now groups topic checkboxes under "Unit N" headers (parsed
  from the blurb, matching the student board) + a "Select all / Clear" toolbar +
  "None selected = the whole level" hint.
- Changing the level already refreshes the list (onchange="onGrammarLevelChange()").

## #7 Individual-student picker (root-caused + unified)
- ROOT CAUSE: the fancy checkbox (fill + checkmark) CSS was hardcoded to
  `.assignment-student-checkbox` (vocab only). So in grammar/writing/exam (which use
  .grammar-/.writing-/.exam- checkbox classes via StudentPicker) selecting a student
  showed NO checkmark -> "not friendly". Generalised the 3 rules to
  `.student-checkbox-item input[type=checkbox]` / `:has(input[type=checkbox]:checked)`
  -> every form now shows the same blue checkmark (vocab + grammar + writing + exam).
- Bigger: .student-checkbox-items max-height 200 -> 340px (taller list, all forms).
- Killed the browser autocomplete dropdown (the "Alireza/edt/alirez" popup) by adding
  autocomplete="off" to both search inputs (StudentPicker + vocab populateAssignmentStudents).

## #8 Heist: player never knew their rotated password (heist-student.js + html)
- After a successful crack the host rotates the victim's vault to a new word, but the
  victim was never told. Added subscribeMyPassword(): listens to the player's own
  /passwords/{uid} doc (owner-readable per rules), shows a persistent
  "🔑 Your secret vault password: WORD" bar in the play view, and toasts
  "Your vault was cracked and re-locked! New password: WORD" when it changes.
- Also fixed the visible em dashes in heist-student.js (hacked-you toast, hint
  fallback, rank fallback). (Comment-only em dashes remain across classroom files;
  a full scrub is a separate pass if wanted.)

## Cache
- service-worker.js v18 -> v19 (the assignment JS/CSS + classroom heist files load
  without a ?v= query, so the SW bump is what busts them).

## Verify
- node --check passed: heist-student.js, grammar-form.js, student-picker.js,
  teacher-assignments.js. assignments.css braces 213/213.
- checkbox selector generalised (no more .assignment-student-checkbox:checked).
- grammar topics grouped by Unit + select-all present. heist subscribeMyPassword wired.
- visible em dashes in heist-student.js removed.

## Deploy
- firebase deploy --only hosting, then reopen (may take a second load for the SW to
  swap to v19). Teacher: grammar topics now grouped by Unit; student picker shows
  checkmarks + is taller in every form. Heist: players see/keep their vault password.
