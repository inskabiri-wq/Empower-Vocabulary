# 2026-08-26 - "still no teachers read?" - they were, and the panel said otherwise

The teacher sheet imported correctly. The panel then told the admin two
opposite things at once, so it read as a failure.

## What the screen said

```
Teachers valid        0
note: This sheet is a CLASS TIMETABLE ... turned into 28 teacher rows across 16 classes.
note: It carries no email addresses, so no accounts can be created from it yet.
could not find a name or email column          <- in red
```

A blue note saying **28 teachers were read**, three lines above a red error
saying **no name column was found**, over a card reading **0**.

## The three things wrong with that, all fixed

### 1. The red error should never fire for a matrix

`mappingLine()` warns when `name` or `email` is missing from the column map. A
class timetable HAS no name column - names come out of the three instructor
columns - and it has no addresses at all, which the blue note already explains.
The check now skips a matrix (`map._matrix`) entirely.

### 2. The mapping line hid where the people came from

It listed Class and Level and simply omitted Name, which looks like something
failed. It now says where the names were read from:

```
Teachers sheet: Names -> cols C, D, E   Class -> col B   Level -> col F
```

### 3. A bare "0" with no explanation

`summaryCard` gained a sub-line. Against the real files:

| card | value | sub-line |
| --- | --- | --- |
| Students valid | 277 | 332 read, 55 waiting for an email address |
| Teachers valid | **0** | **28 read, all waiting for an email address** |

Zero is the honest number - none of them can become an account without an
address - but it now says why.

## A trap found while writing the explanation

The "Download 83 row(s) to add emails" button emitted **one combined CSV** of
55 students and 28 teachers with a `role` column.

**The importer never reads that column.** It takes a student sheet and a
teacher sheet separately, so uploading that file back as the teacher sheet
would have created **55 students as teachers**. The role column was information
for a human that the machine ignored - which is the worst kind.

It now downloads **two files**, `add-emails-teachers-<module>.csv` and
`add-emails-students-<module>.csv`, and the status line says which goes where.
The button also names the teacher count, since that is the number the admin is
chasing.

## Where the import actually stands, on the real files

```
Students valid    277
Teachers valid    0   (28 read, waiting for emails)
Classes           16
Excluded          83  (55 students + 28 teachers, all missing an address)
Hard problems     0
Warnings          0
```

**Next step for the admin:** download the two files, fill the Email column in
the teachers one, upload it as the teacher sheet, validate again. That path was
round-tripped end to end earlier: 28 in, 28 importable out, class lists intact.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: all eight PASS (torture suite 32 cases)
- bump: roster-import.js v18, CACHE_VERSION -> **v355**; `--check` OK
