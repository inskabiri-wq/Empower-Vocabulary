# 2026-08-26 - why grammar showed no answers, and what actually changed in the logs

## 1. "For logs I don't see any change - have you changed anything?"

Yes, but **not the Activity Logs feed**, so the Logs tab looking identical is
correct.

What changed was the **per-student drill-down** (`teacher/js/student-detail.js`):
opening one student now queries that student's own sessions instead of
filtering the dashboard's most-recent-1000 window. It is invisible unless a
student has activity older than that window - which, at 400 students, is
anything more than about two or three days back.

**Still on the 1000-row window, and still wrong over a term:** the Activity
tab's needs-attention average. That one is computed across every student at
once, so a per-student query does not fix it; it needs per-student totals rolled
up as sessions are written. Not started.

And none of it is live until a deploy.

## 2. Grammar and pronunciation showed no per-question answers

Three activities record per-question detail in **three different fields**, and
three views were each honouring a different subset:

| stored by | field | shape |
| --- | --- | --- |
| reading / listening exams | `session.answers.items` | `{ q, a, correct, ok }` |
| grammar practice | `session.grammarDetails` | `{ q, picked, correct, ok }` |
| vocabulary practice | `session.vocabDetails` | `{ q, picked, correct, ok }` |

| view | answers | grammarDetails | vocabDetails |
| --- | --- | --- | --- |
| Activity tab | no | **yes** | **yes** |
| student detail, on screen | **yes** | no | no |
| student detail, printed report | **yes** | **yes** | no |

So whether a row expanded depended on which screen you were looking at. Nothing
was missing from the data - grammar writes `grammarDetails` on all three of its
games (choice, fill, unscramble) and has done all along.

### Fix

One normaliser, `_itemsOf(session)`, that knows all three field names and
returns the uniform shape. Both student-detail views now use it, so the printed
report and the on-screen table agree with each other and with the Activity tab.

Tested against nine shapes:

| input | items |
| --- | --- |
| reading/listening `answers.items` | passed through |
| grammar `grammarDetails` | normalised (`picked` -> `a`) |
| vocabulary `vocabDetails` | normalised |
| a correct vocabulary answer | `ok: true` preserved |
| pronunciation | none |
| an old session with no detail | none |
| empty arrays | none |
| both `answers` and `grammarDetails` | `answers` wins |
| null session | none |

### Pronunciation will still show nothing, and that is correct

`student/js/pronunciation.js` **never decides an answer is right or wrong** -
its only `score` variable ranks text-to-speech voices. There is no per-question
detail because nothing marks it. This is the same root cause as the "0%"
problem fixed earlier: those sessions now save with no percentage and
`unscored: true` rather than a fake zero.

Showing right/wrong for pronunciation would mean **building marking first** -
comparing what was said against the target word. That is a feature, not a
display fix, and it has not been started.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: all eight PASS
- bump: student-detail.js v4, CACHE_VERSION -> **v356**; `--check` OK
