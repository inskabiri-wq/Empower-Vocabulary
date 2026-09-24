# 2026-08-29 - terms rewritten, a reminder that fires itself, and 1000 students measured

Four items. Three are done in code; the fourth is now measurable on one laptop.

## 1. The terms of service: the legal error was one line

`y/index.html` said, in both languages:

> **Data Controller (Veri Sorumlusu):** Alireza Kabiri

That is the sentence the colleagues were warning about. Under KVKK the
**veri sorumlusu** is whoever determines the purposes and means of processing.
The students are FSMVU students, the data is collected for FSMVU teaching, and
FSMVU staff use it. The University is the controller. Naming an individual
there personally attaches the controller's duties - VERBİS registration, breach
notification, answering Article 11 requests - and the administrative fines that
go with them.

Now:

| | before | after |
| --- | --- | --- |
| Data Controller | Alireza Kabiri | **Fatih Sultan Mehmet Vakıf University** |
| Data Processor | not named | **Alireza Kabiri**, developer, processing on the University's instructions |

### Ownership of the app did not move, and now says so explicitly

Section 6 previously mixed the two ideas up. It now separates them:

> The App ... is the property of **Alireza Kabiri**, who retains all
> intellectual property rights in it. The App is licensed to FSMVU for
> educational use ... Ownership of the software is separate from, and
> unaffected by, the University's role as Data Controller.

That is the answer to "how is it still my app": IP ownership and data
controllership are different things, and only the second one had to move.

### Two transfers the old terms did not disclose

Reading the code rather than the document turned up disclosure gaps:

- `functions/index.js` sends submitted essay text to
  **`generativelanguage.googleapis.com`** (Google Gemini) for AI writing
  feedback. The old "Sharing" line said data goes to FSMVU staff and is not
  sold. True, and incomplete.
- reminder emails will go through **Twilio SendGrid**.

Both are now listed as service providers, with a note that their servers may be
outside Türkiye.

### Pronunciation, stated accurately

`student/js/pronunciation.js` uses the Web Speech API. In Chrome and Edge that
means **the browser sends the audio to Google**. It would have been easy and
wrong to write "processed on your device". The terms now say what actually
happens, and separately that Lingualab records, uploads and stores nothing.

### Retention now matches what the app does

The terms said "enrollment plus 2 years" flat, while the app deletes activity
logs at 6 months. A privacy notice that contradicts the software is worse than
no notice. Split: account and progress records keep enrollment + 2 years,
detailed activity logs 6 months.

Verified: EN and TR both carry 10 sections, tags balance (36/36 div, 38/38 p,
10/10 ul), and **zero** occurrences of the old controller line remain.

**This is not legal advice.** It is the document saying what the code does, with
the controller/processor split the University has now confirmed.

## 2. The retention reminder lives in the app, not in a calendar

Nothing prunes on a schedule, deliberately. So the reminder goes where the
buttons are: `retentionNudge()` runs on tab open and shows an amber band when
logs older than the window exist, naming how far back they go.

It costs **one document read** - `limit(1)`, because the banner only needs to
know whether anything old exists, never how much. `countOlderThan()` reads up
to 5000 and is right for the button, not for something that runs on every open.
A missing index or a permissions hiccup hides the banner rather than breaking
the tab.

## 3. Activity logs stay out of the Reports workbook, and that is now enforced

The reasoning is written at `exportWorkbook()`, and `live-markup-check.js`
asserts it: the Download button on the Activity Logs tab is not a report, it is
the enforced first step of the delete. Add an "Activity logs" sheet to Reports
and an admin can export from a screen with no delete button, then delete from a
screen whose export they skipped. The guard would still pass its own check while
protecting nothing.

Both new assertions were **proved against the mistake**: injecting an
`'Activity logs'` sheet fails the gate, and renaming the banner mount fails it.

My first version of the sheet-name check silently matched nothing, because
`[^)]*` between `book_append_sheet(` and the name cannot cross the `)` of the
nested `aoa_to_sheet(rows)`. A gate that passes because its regex never matches
is worse than no gate. It reads the last quoted string on the line now.

## 4. The 1000-student rehearsal, without 1000 phones

`y/tools/loadtest-aiquiz.js` drives the real join path over the wire:
anonymous sign-in, read the session by code, write `players/{uid}`, read the
question bank, then a scoring storm where everyone answers at once.

Students are real anonymous ID tokens from the Auth emulator, so **rules are
enforced** exactly as for a phone. Only seeding uses the emulator's `owner`
bypass. It refuses to run against anything non-local.

### Measured, 1000 students, 12 questions

| stage | ok | median | p95 | slowest |
| --- | --- | --- | --- | --- |
| anonymous sign-in | 1000/1000 | - | - | - |
| read session by code | 1000/1000 | 19 ms | 41 ms | 52 ms |
| join (write player) | 1000/1000 | 24 ms | 35 ms | 43 ms |
| read question bank | 1000/1000 | 17 ms | 22 ms | 24 ms |
| scoring storm | 1000/1000 | 22 ms | 32 ms | 43 ms |

**1000 atomic increments in 352 ms. Zero lost updates.** 28,000 document
operations for a whole game, which is inside the free daily tier.

### It reported a failure twice, and both times the harness was wrong

- **"150 of 200 players"** - the REST list endpoint paginates and I ignored
  `nextPageToken`. A clean run looked like it had lost 50 students.
- **"250 of 200 players"** - the session code was derived from N, so a second
  run at the same size inherited the first run's residue. Each run now gets a
  fresh code.

A third bug produced no failure at all and so was nearly missed: `--questions`
was parsed with `indexOf` on the raw argv, which returned -1 when the flag was
absent, so `argv[0]` (the student count) became the question count and an
8-question game quietly ran as a 200-question one.

Three harness bugs, zero application bugs. The pattern from memory held: suspect
the harness first.

### What this still cannot tell you

The venue wifi, real phone CPU, and Google's production auth quota. Access
points commonly cap around 50 concurrent clients, and that remains the likeliest
thing to break.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan on all 7 touched files - clean
- gates: seventeen, all PASS
- bump: activity-admin.js v10, activity-tracker.css v10, reports-admin.js v17,
  CACHE_VERSION -> **v374**; `--check` OK
- emulators started for the test and stopped afterwards; nothing was deployed
