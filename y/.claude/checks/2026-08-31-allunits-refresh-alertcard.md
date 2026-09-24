# 2026-08-31 - SendGrid out, All-units card, the double refresh killed, alert card

Four pieces, in the order they were asked for.

## 1. SendGrid removed entirely, the sending function kept

`firebase deploy` was stopping to ask for a `SENDGRID_KEY` that does not exist.
That prompt came from `defineSecret`, and the `defineString` params asked for
sender name and address on top of it.

All three are gone. No mail library, no declared secret, no params, and
`@sendgrid/mail` is out of `package.json`. **Deploys no longer ask anything.**

What is kept is everything that is hard: finding ungraded submissions,
resolving the teacher, formatting the message, not sending twice. The transport
is now two clearly marked functions:

```js
function emailProviderReady() { return false; }
async function sendReminderEmail(msg) { ... }
```

`msg` is already in the shape every provider expects. The comment above them
carries the steps for university SMTP and for a hosted API, including the
SPF/DKIM catch.

**A detail that matters:** a submission is only marked `reminderEmailSent`
when `sendReminderEmail` returns true. A stub or a dry run leaves it alone, so
no reminder is silently consumed while the transport is missing. Set
`REMINDERS_DRY_RUN=1` to see what it would send.

Verified: the bundle loads and all six functions still export.

## 2. The All-units card

The account's own data explained the complaint. Of 13 grammar sessions, **10
were played with "all units" selected** and only 3 targeted a real unit.

`getProg()` already credits all-units play to every unit at that level, so the
donuts were never the problem - the race in item 3 of the previous log was.
What was genuinely missing is anywhere to SEE that play as itself, or to start
it from the board: the map only offered per-unit drills.

There is now an **All units** card at the head of each level, with its own
donut, per-game rows and status. It is deliberately excluded from
mastered / gamesTotal / accSum, because it covers the same questions as the
unit cards and would otherwise count the same play twice.

`parseInt('all')` is `NaN`, which would have made the new card's rows dead
clicks, so both click sites go through `unitAttr(el)` now. `startGame` and
`poolFor` already understood `'all'`.

## 3. The double refresh, killed properly

Priming from a cache only hid it. A first-ever sign-in had nothing to prime
from and still saw the grid torn down, and my per-uid cache change reintroduced
exactly that on the first load after deploy.

The real cause is that `renderHub()` did `grid.innerHTML = ''` whenever the
signature changed, and the signature includes the percentages. So the arrival
of the Firestore stats always destroyed and rebuilt the grid.

Structure and values are tracked separately now. When the tiles themselves have
not changed and only the numbers have, `updateHubValues()` patches `--pct`, the
ring, the percentage label and the subtitle **in place**. No node is removed,
so there is nothing to see. A real structural change (a skill switched off)
still rebuilds.

### Executed against a fake DOM that counts teardowns

| check | result |
| --- | --- |
| the signature DID change (numbers moved) | PASS |
| the STRUCTURE did not change | PASS |
| **grid was NOT torn down** | PASS |
| grammar tile reads 81%, ring var updated | PASS |
| vocabulary reads 38%, subtitle refreshed too | PASS |
| a LIVE pill is not overwritten with a percentage | PASS |
| switching a skill OFF still counts as structural | PASS |

## 4. The alert card (Option A), measured before and after

**Read cost: zero.** The count comes from `allWritingSubs`, the live snapshot
the dashboard already holds. A submission is waiting unless its status is
`graded` or `returned` - the same test `grading-stats.js` uses, so the two
screens cannot disagree.

**Not added to Total Alerts.** The other three are students who need help; this
is work the teacher owes. The panel's visibility test now checks either, so a
teacher with no struggling students but a pile of marking still sees the row -
the exact case the card exists for.

### The alignment, measured

Option A as literally specified (`auto-fit`) **orphans**, which is what was
suspected:

| viewport | auto-fit | with `grid-column: 1 / -1` |
| --- | --- | --- |
| 1440 | 5 across | 4 + full-width band |
| 1024 | 5 across | 4 + full-width band |
| 834 | **4 + 1 stranded** | 2 + 2 + full-width band |
| 768 | **4 + 1 stranded** | 2 + 2 + full-width band |
| 600 | - | all stacked |
| 390 | **2 + 2 + 1 stranded** | all stacked |

Five does not divide into the 4 / 2 / 1 column counts this grid uses, so
auto-fit strands the fifth card at every size below a laptop. Spanning the row
removes the orphan at **every** width instead of some of them, and it says
something true: four student-risk cards, then the teacher's own work on its own
line. No horizontal scroll at any width.

**My probe's first orphan test was wrong** - it called a row an orphan when it
held fewer cards, so a card deliberately spanning the full width was reported
as stranded. It measures whether the last row FILLS the grid now. Had I
trusted it I would have "fixed" a layout that was already correct.

## Ritual

- `node --check` across every `.js` plus `functions/index.js` - 0 failures
- em-dash scan on all six touched files - clean
- `teacher-dashboard.html` div balance 400/400
- gates: seventeen, all PASS
- both runtime suites re-run after the edits - all PASS
- bump: hub.js v17, activity.js v10, grammar.js, CACHE_VERSION -> **v385**
