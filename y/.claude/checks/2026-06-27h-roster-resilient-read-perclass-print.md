# 2026-06-27 - Roster: read sheets without email, resilient parse, per-class print

## "Teacher sheet blocked - No header row found ... needs Email"  -> now reads it
- detectHeader required an EMAIL column to identify the header row, so a teacher
  sheet with names but no email threw "No header row found" and blocked everything.
  Now a header row needs a NAME *or* an Email column. Teacher (or student) sheets
  without emails read fine; the no-email rows land in the Excluded tab where you can
  add an email + Save (moves them to valid) or remove them.
- doValidate now parses each sheet INDEPENDENTLY (safeParse). One unreadable sheet
  no longer aborts the other - it loads what it can and shows a soft "heads up"
  popup (new notify(), non-danger) naming the sheet that failed.

## "prints should be per class and whole"
- Each QR card now has a "Print this class" button (per-class print). The existing
  "Print all" still prints the whole module. printClassCodes -> printList(list,
  heading) + printOne(code); a delegated click handler on #riQr drives per-card print.

## "Enter the module first ... ?"
- Softened that message (amber, not red) and it now points to "Preview from this
  sheet" (which needs no module). "Show class QR codes" still needs the module
  because it loads the codes already saved in Firestore for that module.

## Sanity
- node --check OK, stubbed-load OK, em-dash 0. roster-import.js ?v=4 -> ?v=5.
- Server unchanged: the function receives already-parsed rows from the client, and
  the no-email-exclude is already mirrored there.
- No deploy/push. REDEPLOY hosting; SW v67 + ?v=5 force the refresh. Verify by
  clicking through after deploy (cannot drive the admin flow headlessly).
