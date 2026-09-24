# 2026-08-26 - the stray "Leave site?", and the two sheets that disagreed

Reported with a screenshot of the live site: a browser "Leave site? Changes you
made may not be saved." prompt over a Roster import panel showing all zeroes and
"One sheet could not be read - the other was loaded."

## 1. The screenshot is the OLD build

Both real files parse correctly against the current code:

| sheet | result |
| --- | --- |
| `FSMVÜ ... CLASS LISTS MODULE IV ... v3.xlsx` | 332 rows, **277 students valid**, 55 with no email, **0 hard problems** |
| `MODULE 4 INSTRUCTORS & CLASSES.xlsx` | **28 teachers** from 16 classes, 0 hard problems |

The zeroes in the screenshot are the .xlsx-refusal regression fixed an hour
earlier (v15). It needs a deploy and a hard refresh.

## 2. The "Leave site?" prompt was mine, and it was firing on nothing

```js
return !!(state.validated && (state.students || state.teachers));
```

**An empty array is truthy.** A refused parse leaves `state.students` as `[]`,
and `revalidate()` sets `state.validated = true` regardless, so the guard fired
on a panel holding nothing at all - including immediately after both sheets had
been rejected, which is exactly the moment there is nothing to lose.

Now counts rows instead. Tested against nine states:

| state | prompt |
| --- | --- |
| nothing touched | no |
| **both sheets refused (arrays empty)** | **no** |
| a real student sheet loaded | yes |
| a real teacher sheet loaded | yes |
| files picked but not validated | no |
| credentials created, not downloaded | yes |
| credentials downloaded | no |
| credentials downloaded, rows still loaded | yes |

## 3. "One sheet could not be read" when NEITHER was

The status line and modal title always said "one", so with both sheets refused
the panel read "One sheet could not be read - the other was loaded" above a row
of zeroes. It now counts: **"Neither sheet could be read - nothing was loaded."**
in red, and the modal tail says to fix the files rather than to carry on.

## 4. The important one: the two sheets did not agree with each other

Running both real files together surfaced this:

```
STUDENT sheet classes: B117 B118 B124 ... D302 D303 ...
TEACHER sheet classes: B-117 B-118 B-124 ... D-302 D-303 ...

classes that MATCH between the two sheets: 0 of 16
```

The student list writes `D302`. The instructors timetable writes `D-302`. **Zero
of sixteen matched.**

Left alone the import would have created every class **twice**, once per sheet,
so every teacher ended up attached to a class with no students and every class
of students had no teacher. **Nothing would have errored.** It would simply have
been wrong, and only discoverable after three hundred accounts existed.

Separators carry no meaning in a class code, so `normalizeClass()` drops them
and upper-cases the rest. Applied on **both** parse paths - the ordinary sheet
and the matrix - so the two sheets cannot disagree again:

| input | output |
| --- | --- |
| `D-302`, `d 302`, `D302` | `D302` |
| `B/117`, `  b/117 ` | `B117` |
| `A.101` | `A101` |
| `9-C` | `9C` |
| `HAZ3` | `HAZ3` |

### After

```
student classes: 16   teacher classes: 16
MATCHING now   : 16 of 16   <- every class has both
students valid : 277        class warnings: 0
```

The "class code looks unusual" warnings also disappear, because canonical codes
now satisfy `CLASS_RE`.

## Tests

Two permanent cases added:

- **class codes are canonical** - three spellings of one room collapse to one,
  and raise no warning
- **a MATRIX and a student list name the same classes** - the timetable's
  `D-302` becomes `D302`

One older assertion was stale and failed: the matrix case still expected
`D-302,D-303`. **The code was right; the assertion was.** Updated, with a note
saying why.

Suite is now **32 cases, all passing**.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: all eight PASS
- bump: roster-import.js v16, CACHE_VERSION -> **v353**; `--check` OK
