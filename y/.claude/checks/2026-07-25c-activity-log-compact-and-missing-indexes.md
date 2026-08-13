# 2026-07-25c — Activity log: compact rows + the REAL cause of "reports don't work"

## 1. The box was too big (picture 2)
Padding tweaks alone were not enough - each entry STACKED THREE ROWS
(action+pill / user / meta line with time+date+device), so every log entry was
a tall block and only ~4 fit on screen.
Rebuilt `_renderLogItem` as ONE line:
  [icon] Action  (category pill)  role+name (class) ............ when
- `.activity-log-line` flex row; `.activity-log-who` ellipsis; `.activity-log-when`
  pushed right with margin-left:auto, full timestamp + device in its title tooltip.
- Card: padding 18/20 -> 7/12, icon 48 -> 28px, radius 14 -> 10, list gap 12 -> 6.
- Mobile (<=640px) wraps the "when" onto its own line.
- MEASURED: row height **~150px -> 44px**; "when" right-aligned. PASS.

## 2. "Error Loading Logs / The query requires an index" - THE REAL CAUSE
The Activity Log query is always `orderBy('timestamp','desc')` plus ANY
combination of equality filters (userRole / category / activityType / userId).
Firestore requires a COMPOSITE INDEX for every such combination, and
`firestore.indexes.json` had **zero activityLogs indexes** (16 indexes total,
none for this collection). So: no filter = fine (automatic single-field index);
the moment a filter is applied the query is illegal -> the red error.
FIX: generated all **15** combinations (4 singles + 6 pairs + 4 triples + 1 quad),
each `<fields...> ASC + timestamp DESC`. firestore.indexes.json now has 31.
NEEDS: `firebase deploy --only firestore:indexes` (indexes then BUILD for a few
minutes before queries succeed).

## 3. Two wrong theories I chased first - reverted, no trace left
- Added an ActivityLogger call to grammar.js on the assumption grammar was not
  logged. User corrected me: grammar DOES appear, vocabulary does not. Reverted.
- Then decoupled the vocab ActivityLogger call from `loadJourneyStats()` in
  auth.js (a real fragility: the log write sits after an awaited stats refresh
  inside one try block, so a stats failure silently skips the log entry).
  Reverted too - the screenshot proved the cause was the missing index, and I am
  not shipping unrelated speculation. `git diff` on both files now shows only
  the required em-dash -> ASCII normalization.
  NOTE for later: that auth.js ordering fragility is REAL and still present. If
  vocabulary is still missing from the log AFTER the indexes build, that is the
  first place to look (console would show "Failed to log session:").

## 4. Still unexplained (honest)
Why grammar appears and vocabulary does not. Code says the opposite: vocab
calls ActivityLogger.logPracticeCompleted (auth.js ~line 209), grammar.js never
calls the logger at all. The index error was breaking the panel's filtered
queries, so nothing observed there was trustworthy. Re-check after deploying the
indexes, then I can chase the asymmetry with real data.

## Verification
- node --check activity-admin.js / auth.js / grammar.js - OK.
- firestore.indexes.json parses; 15 activityLogs indexes added.
- ui-sanity PASS; grammar-sanity PASS.
- Compact row measured in a browser harness with the REAL css: 44px rows. PASS.

## Versions
activity-admin.js ?v=2, activity-tracker.css ?v=4, SW v110 -> v111.

## Ship
firebase deploy --only hosting
firebase deploy --only firestore:indexes      <-- fixes the red error
