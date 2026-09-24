# 2026-08-26 - AI Quiz switch, roster import torture test, placement modules

## 1. The AI Quiz was missing from Admin > Features

Reported: the Classroom Games panel lists nine games and not the AI Quiz.

**Two of the three pieces were already there.** A classroom game needs:

1. a launcher on `classroom-teacher.html` - `#pickAiQuiz` existed
2. a row in the toggle map at the foot of that page - `game_aiquiz` existed
3. a row in `FEATURES` in `teacher/js/feature-activation.js` - **missing**

So the game was gateable and nothing errored; the switch simply had nothing to
draw, and an admin could never turn the AI Quiz off. One line added.

**Gated so it cannot happen again:** `tools/game-registry-check.js` asserts all
three agree in both directions - a launcher with no switch, and a switch that
gates nothing, both fail. Currently 10 games, 10 switches, PASS.

## 2. Roster import - the receptionist test

Asked for: prove it survives whatever messy Excel the office sends, with
fallbacks, and no "sorry, I did not count that".

`tools/roster-import-torture.js` builds **real .xlsx and .csv files** for each
situation and runs them through the SHIPPED parse and validate path, loaded in
a stubbed browser so it is the real code and not a copy.

The existing importer was already strong: Turkish and English header aliases,
header-row auto-detection over the first 15 rows, CEFR word mapping
("Pre-Intermediate" to B1), and a content-based column classifier that decides
which column is which from the VALUES, so an email/student-no swap is
impossible. Three gaps were found and closed.

### Found and fixed

| gap | before | now |
| --- | --- | --- |
| **Only sheet 1 was read** | a cover or instructions tab in front of the data meant "no email addresses found" and the whole import failed | `pickSheet()` scores every sheet by how many addresses it holds and reads that one, and says which sheet it used |
| **Repeated header rows** | pasting three class sheets under each other put "E-POSTA" in the email column and reported invalid addresses on lines 34 and 67 | a row whose own cells are column names is skipped |
| **Decorated addresses** | `Ali Veli <ali@x.edu.tr>`, `ali@x.edu.tr;`, `mailto:...` all failed as invalid email | `cleanEmail()` unwraps angle brackets, strips `mailto:`, takes the first of a separated list and trims trailing punctuation |

### The 19 cases, all passing

| | case | outcome |
| --- | --- | --- |
| 1 | clean English headers | 2 clean, 0 problems |
| 2 | Turkish headers (ADI SOYADI / E-POSTA / OGRENCI NO / SINIF / SEVIYE) | parsed |
| 3 | university banner + blank rows above the header | header found on row 5 |
| 4 | columns shuffled, plus phone and notes columns | right columns picked |
| 5 | a row-number "NO" column next to "OGRENCI NO" | took the real student number |
| 6 | levels as "Pre-Intermediate" / "upper intermediate" / "b1+" / "Elementary" | normalised to B1 / B2 / B1+ / A2 |
| 7 | student number stored as a NUMBER not text | survived as a string |
| 8 | emails with spaces, capitals, angle brackets, `mailto:`, trailing `;` | all four recovered |
| 9 | blank rows scattered through the data | skipped silently |
| 10 | three class sheets pasted together, header repeats twice | 3 students, 0 problems |
| 11 | cover tab in front of the data | read the "Ogrenciler" sheet |
| 12 | the same email twice in different case | one kept, duplicate flagged |
| 13 | students with no email at all | excluded, and **not** treated as a hard error, so commit is still allowed |
| 14 | class codes "A-101", "HAZ3", "9-C" | kept, flagged as warnings only |
| 15 | no recognisable headers at all | content classifier carried it |
| 16 | comma CSV | parsed |
| 17 | **semicolon CSV** (what Turkish Excel exports) | parsed |
| 18 | completely empty workbook | refused with "every sheet is empty" |
| 19 | a stock list instead of a roster | refused with a message naming what it needs |

The last two are the point: being **refused clearly** is a pass. Silently
importing the wrong thing is the failure this guards against.

### Design points worth knowing

- **No email is not a blocker.** Email is the login key, so those rows go to a
  separate "excluded" list. The rest of the sheet still imports.
- **Unusual class codes are warnings, not errors.** A real code the app has not
  seen must not stop 300 accounts being created.
- **The dry run does all of this with zero writes and no Blaze.** The Cloud
  Function re-validates server-side and is the only writer; the browser copy is
  purely for instant preview.

### Not covered, honestly

Real .xls (the pre-2007 binary), password-protected workbooks, and Google
Sheets links. The first two would be refused with a parser error rather than a
helpful message. If the office actually sends one, that is a ten-minute fix,
not a redesign.

## 3. Placement - per-part and per-question control

There was no modular control: the only switch was writing on/off/AI. Added, in
`settings/placementConfig`:

- **`parts`** - Grammar, Vocabulary, Reading exam, Listening exam on/off.
  (Writing keeps its existing three-way control.)
- **`rungs`** - grammar and vocabulary question counts **per CEFR band**
  (A2 / B1 / B1+ / B2), 0 to 30 each.

Admin UI sits under the existing exam pickers in Admin > Placement: pill
checkboxes for parts, a small table of number inputs for the counts, and a live
"N language questions in total" line. Autosaves like the rest of that panel.

Runtime honours it in `student/js/placement.js`: a part that is off contributes
0 questions and leaves its score **empty** on the report rather than counting as
a zero; both language parts off skips the ladder entirely and the test goes
straight to the remaining skills.

**A missing key means ON, everywhere.** An existing `placementConfig` written
before any of this runs the full 46-question test exactly as it does today.

The ladder is resolved **once per attempt** and stored on `state.ladder`, so an
admin editing the config mid-test cannot renumber the bands under a student who
is already climbing.

### Verified against the shipped resolver, 19 config shapes

Every case passes, including the ones an admin should not be able to produce:

| config | result |
| --- | --- |
| no config at all | A2:8/5 B1:8/5 B1+:6/4 B2:6/4, 46 questions |
| grammar off | 18 questions, vocabulary only |
| vocabulary off | 28 questions, grammar only |
| both off | no ladder, straight to the skill parts |
| partial custom list | listed bands change, the rest keep defaults |
| a band set to 0/0 | that band is dropped from the ladder |
| `g: "abc"`, `v: null` | falls back to that band's default, not to zero |
| `g: 999`, `v: -5` | clamped to 30 and 0 |
| unknown band "C2" | ignored |
| `rungs: "nonsense"` | ignored, defaults used |
| `rungs: [null, ...]` | null entry skipped |

Falling back to the **default** rather than to zero matters: a zero would
silently shorten the test and nobody would notice.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity, **game-registry (new)**, **roster-import-torture (new)** -
  all PASS
- bump: feature-activation.js v7, roster-import.js v10, placement-admin.js v9,
  placement.js v10, CACHE_VERSION v344 -> **v345**; `--check` OK
