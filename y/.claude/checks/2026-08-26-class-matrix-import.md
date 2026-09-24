# 2026-08-26 - importing the class/instructor timetable, and the QR panel

## 1. The instructors sheet is a TIMETABLE, not a list

`MODULE 4 INSTRUCTORS & CLASSES.xlsx`, read directly:

```
     CLASS   MAIN COURSE (12)        MAIN COURSE (6)   MAIN COURSE (5)        LEVEL
10   B-117   Sema                    Max               Alireza / Elif Ç (1)   UPPER
14   B-129   Fatemeh (12)            Kevser (6)        Alireza                UPPER
16   B-214   Pelin  (10) /Derya (2)  Abdulrauf         Ceyda Ö                PRE-ADVANCED
```

One sheet, 16 classes in rows 3-19, **one row per class with three instructor
columns**. Fed to the ordinary importer it failed outright, and correctly: no
Email column and no single Name column, so the header detector found nothing
and `columnsForAoa` threw. That is exactly "it could not read the teachers".

Four things had to be undone:

| in the sheet | what it means |
| --- | --- |
| one row per CLASS | teachers are spread across rows and columns |
| `Pelin  (10) /Derya (2)` | **two people** sharing one class |
| `(12)`, `(6)`, `(1)` | contact hours, not part of a name |
| a second `MC1 MC2 MC3` header at row 12 | a header repeat inside the data |

Plus two level words the department writes that the map did not have:
**INTER** (-> B1+) and **UPPER** (-> B2). `PRE-INT.` and `PRE-ADVANCED` were
already there.

### Result on the real file

**28 teachers out of 16 classes**, verified against the shipped code:

| check | result |
| --- | --- |
| distinct teachers | 28 |
| contact hours stripped | no name contains a bracket |
| shared cells split | Pelin and Derya both present; Alireza and Elif Ç both present |
| mid-sheet header skipped | no MC1/MC2/MC3 row became a person |
| classes collected per teacher | `Z Ceyda` -> `D-306,D-307,D-308` |
| levels normalised | `Sema` -> B2 from UPPER |
| teacher across several levels | `Büşra` teaches B1 and B2 classes, so her level is left blank rather than guessed |
| hard problems | **0** - nothing blocks |
| excluded for no email | **28** |

### Why 28 excluded is the right answer, not a failure

The sheet has no addresses in it, and email is the login key. Those rows go to
the excluded list, which names **exactly who needs an address**, and the panel
now offers that list back: **"Download 28 row(s) to add emails"** produces a CSV
with name, class, level and an empty Email column. The office fills one column
and uploads the same file.

Round trip verified end to end: matrix in, emails added, back through the
importer -> **28 importable, class lists intact** (`Z Ceyda` still holds three),
and a normal list is **not** mistaken for a matrix on the way back.

### Detection is deliberately narrow

A sheet is only treated as a matrix when **all** of these hold: a CLASS column
exists, **no cell anywhere holds an email address**, at least three rows carry a
class code, and at least **two** columns are mostly names. One name column is a
normal list; any addresses at all mean it is a real roster however it is laid
out. The student sheet never takes this path.

Two permanent cases added to `tools/roster-import-torture.js` (now **29**,
all passing) using a synthetic fixture, so the gate runs without the Desktop
file.

**An assertion error worth recording:** the fixture case first failed claiming
13 teachers when the code produced 15. The code was right and my arithmetic was
wrong - 3 in D-302, +Gizem, +3 in D-306, +4 in B-117, +4 in B-214. Fixed the
assertion, not the code, and wrote the count into the test.

## 2. The QR panel - what was actually wrong, and a correction

**The QR was invisible, and this is measured, not inferred.**
`createSvgTag({ scalable: true })` omits width and height, so the SVG rendered
at **0 x 0**. Dropping `scalable` gives **152 x 152**. That is why the cards
showed a class code and no QR.

**I have to correct my own diagnosis.** I said the panel was building ~16,000
DOM nodes. Measured, it is **64**, and it renders in **21.5ms** for 16 classes:

| 16 classes | markup | nodes | parse + layout |
| --- | --- | --- | --- |
| inline SVG | 292 KB | 64 | 21.5 ms |
| data-uri `<img>` | 491 KB | 32 | **7.7 ms** |

The `<img>` switch is a real improvement (2.8x faster, half the nodes,
guaranteed sizing) but **it is not the lag** that was reported. 21.5ms is not
something a person feels. **The lag has not been found**, and it is not here.

Also fixed on that panel:

- **"PREVIEW" where a code belongs** told the teacher nothing. The card now
  shows the **class code**, labelled "placeholder - the real join code is
  created with the accounts".
- **`printOne` and `printClassCodes` had no `ensureQr()` guard**, so a print
  could throw before opening anything. That is the most likely "the class
  buttons are hanged".
- QR generation is now cached per URL, so reprinting is instant.

## 3. Other items from the same report

- **Placement parts and counts moved to Admin > Content**, under a "Placement
  test" heading. The Placement tab keeps the exam pickers and writing mode and
  points at the new home. Same `cfg`, same `saveCfg`, one source of truth; all
  19 config-shape tests still pass.
- **File pickers** use a shared `.ll-file` style instead of the raw browser
  control.
- **Leave guard on the roster panel**: a validated sheet, or credentials not
  yet downloaded, now prompt before the tab closes. It stands down once the
  credentials CSV is saved.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity, game-registry, **roster-import-torture (29 cases)** - all PASS
- bump: roster-import.js v14, CACHE_VERSION -> **v350**; `--check` OK

## Still open

- **The lag.** Not the QR panel. Next suspect is the Admin tab loading 400
  students plus 1000 sessions on every open. Not measured yet.
- The ToS revision is drafted but **not applied** - it is waiting on the KVKK
  office's answer on who the controller is.
