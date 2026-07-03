# 2026-06-23 - Roster onboarding: user-doc field-name reconciliation

Fixes the integration gap flagged in 2026-06-23d: the rosterImport function was
writing `currentClass / currentModule / currentYear`, which the app does not
read. Now it writes the app's canonical fields, so imported people surface
correctly with no other changes.

## Canonical fields (confirmed by reading the app)
- Student placement (written by verify-gate.js, read app-wide):
  `studentClass`, `level`, `module`, `academicYear`.
- Teacher scoping (config.js `where('studentClass','in', assignedClasses)`):
  `assignedClasses` (array). NOTE: `assignedYear`, if set, is used by config.js
  as a `level == assignedYear` filter, so setting it would hide all the
  teacher's students. We deliberately do NOT set it.

## Change - functions/index.js (rosterImport commit)
Per-role user-doc write:
- student -> `studentClass = class`, `level`, plus `module` + `academicYear`.
- teacher -> `assignedClasses = [classes]`, plus `module` + `academicYear`.
- both keep `email/name/role/studentNo/rosterManaged/mustSetPassword`.
The Admin SDK bypasses the rules' identity-lock, so each module's relocation
just overwrites `studentClass` (D302 -> D305); the student still cannot change
it themselves (client writes stay locked).

## Verification
- `node --check functions/index.js` OK. No em dashes in the change.
- Shape sim (per role):
  - STUDENT -> studentClass D302, level C1, academicYear, module, NO
    assignedClasses, mustSetPassword true (new account).
  - TEACHER -> assignedClasses ["D302","D303"], NO studentClass, NO assignedYear,
    mustSetPassword DELETE (existing account, not re-forced).

## Effect
- Imported students appear in the teacher dashboard (matched by studentClass)
  and the student app shows their class/level like a self-verified account.
- Imported teachers are scoped to their own classes via assignedClasses.

## Still open
- The `enrollments` history docs from a prior module keep `active:true`
  (harmless: the app reads current placement from users.studentClass; join.html
  only reads the specific scanned module). Could be set active:false on
  relocation later if desired.
- COLUMN_MAP still assumed headers (lock with the real sheet).
- C1 everywhere (Phase 4) still pending.
- Blaze + deploy + emulator end-to-end test still required before go-live.

## Not done
- No deploy. No push. Login untouched.
