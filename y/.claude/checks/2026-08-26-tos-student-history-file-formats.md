# 2026-08-26 - the ToS naming question, per-student history, and the file formats I had not covered

## 1. Terms of Service - your name is already in it, three times

Checked `index.html` (the ToS modal, English and Turkish). "Alireza Kabiri"
appears in three DIFFERENT legal roles, and they are not the same thing:

| where | role | line |
| --- | --- | --- |
| section 3 | **Data Controller / Veri Sorumlusu** | 240 / 331 |
| section 6 | **owner of the software and content** | 267 / 358 |
| section 10 | contact for KVKK data requests | 291 / 382 |

So whoever told you your name should be there was describing something already
done. **I am not a lawyer and this is not legal advice** - the point below is
worth putting in front of the university's KVKK office rather than acting on
from a check log.

### The concern worth raising

Under KVKK, the *veri sorumlusu* is whoever decides the purposes and means of
processing. That role carries VERBIS registration duty, 30-day Article 11
response duty, 72-hour breach notification, and personal exposure to
administrative fines.

The app is for FSMVU students, gated to `@fsm.edu.tr` addresses, built and run
as part of the EdTech and AI Coordinator role. On those facts the **university**
looks much more like the controller than an individual employee does. Naming a
person can put personal liability where institutional liability belongs, and an
incorrect controller identification is itself a compliance problem.

### The two things are separable, which is the answer to "still my app"

- **Data controller** - who is legally answerable for student personal data.
  Very likely FSMVU, with you named as the operational contact.
- **Copyright / IP in the software** - can remain yours, subject to your
  employment contract. Turkish FSEK vests economic rights of works made within
  an employee's duties in the employer unless agreed otherwise, so a written
  agreement is what settles this, not a line in the ToS.
- If the university is controller and you operate the app, the missing document
  is a **processing agreement** between the two.

### Two other things that are stale, regardless of the above

- **"Last Updated: December 2024"** - twenty months old. Since then the app
  gained an AI writing corrector, a placement test, Gemini calls and anonymous
  classroom players. None of those are described in the data section, and
  anonymous play is a materially different processing story.
- **No governing-law or jurisdiction clause.** Turkish law is mentioned only
  inside "Consequences of Misuse".

**Nothing was changed.** Rewriting who is legally responsible is not a call to
make from a code session; say the word and I will draft the revision for the
KVKK office to review.

## 2. Per-student history now comes from that student's own sessions

The middle option from the previous log, implemented.

**Before:** the detail modal filtered the dashboard's global 1000-session
window by `userId`. With 400 students active that window is two or three days,
so "12 sessions, 64%" meant "whatever of theirs landed in the last 1000 rows",
and a student busy last month opened as if they had never used the app.

**Now:** `teacher/js/student-detail.js` fetches that ONE student's sessions
directly (`where('userId','==',id)`) when the modal opens. A query per student a
teacher actually opens, not per dashboard load.

Details that matter:

- **Two paints.** It renders instantly from the slice already in memory, then
  repaints with the complete history when the query lands. Opening is not
  slower than it is today.
- **Cached per student** for the session, so clicking back and forth between
  two students does not re-read either.
- **`_openFor` guard.** A teacher who closes the modal and opens someone else
  before the query returns does not get the previous student's numbers painted
  over the new one.
- **One wiring path.** The repaint replaces the modal's innerHTML, which would
  have left a dead Close button; both paints now call the same `wire()`.
- **Failure is honest.** If the query is refused, what is on screen stays -
  it is partial, not wrong - and a line appears reading "Recent activity only -
  the full history could not be loaded." rather than an error replacing real
  numbers.

Rules allow this: `/sessions` read is `resource.data.userId == request.auth.uid
|| isAdmin() || teacherHasScope()`, per document, so any teacher with scope can
run the query.

The dashboard feed and its 1000-row cap are untouched. What is still capped is
the **needs-attention average** on the Activity tab, which is computed across
all students at once; that one needs the rollup-on-write approach, not this.

## 3. The file formats I said were not covered

Previous log said real .xls, password-protected workbooks and Google Sheets
links "would be refused with a parser error rather than a helpful message".
Now covered, by CONTENT rather than by file extension - a .xls renamed .xlsx,
or a link saved as .csv, both lie about themselves.

| what arrives | detected by | what the admin is told |
| --- | --- | --- |
| real .xls (pre-2007) | OLE2 magic `D0 CF 11 E0` | save as .xlsx in Excel, or convert in Google Sheets / LibreOffice |
| password-protected workbook | ZIP local-header encryption bit | remove the password via File > Info > Protect Workbook |
| Google Sheets link saved as a file | body starts with a docs.google.com URL | File > Download > Microsoft Excel (.xlsx) |
| saved web page | starts `<!doctype` / `<html` | same download route |
| PDF | `%PDF-` | ask for the spreadsheet the PDF came from |
| Word document | `.doc`/`.docx` name | the roster has to be a spreadsheet |
| zero-byte file | length 0 | it may not have finished downloading |
| random binary | >10% control bytes in the first 512 | not a spreadsheet, re-save from Excel |

### One real failure the test caught

Random binary junk was NOT refused. SheetJS is lenient: handed arbitrary bytes
it does not error, it reads them as delimited text and returns a sheet of
mojibake, so the import failed later with "no Name or Email column" - telling an
admin their roster is missing a column when the file was never a spreadsheet.
Fixed with the control-byte check above.

**The torture test asserts the MESSAGE, not just the refusal.** Each of these
cases carries a pattern the message must match, because "it threw" and "it
helped" are different things.

`tools/roster-import-torture.js` is now **27 cases, all passing**.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity, game-registry, roster-import-torture - **all PASS**
- bump: roster-import.js v11, student-detail.js v3,
  CACHE_VERSION v345 -> **v346**; `--check` OK
