# 2026-06-24 - Grammar: validated-generator PILOT (a2-be) + hints

User clarified: wants ~104 questions PER TOPIC (~8,000 total), not per level, and
a HINT on each grammar question. Pure hand-typing 8,000 is infeasible, so the
agreed approach (their choice "1"): a VALIDATED generator (typed pools + lint)
that produces volume WITHOUT wrong English. This is the pilot for ONE topic.

## What was built
- grammar-content.js: `lintQ` (rejects structurally bad items), `buildValidated`
  (filter + dedupe + cap), `withHint`, and a `VALID` map of validated generators.
- Pilot generator `VALID['a2-be']`: TYPED pools - singular subjects (She/He/Tom/
  The teacher...) only ever take "is" + an adjective or a SINGULAR noun ("a
  teacher"); plural subjects (They/We/You/My parents...) only take "are" + adj or
  PLURAL noun ("teachers"); "I" only takes "am". So agreement is correct by
  construction. Each question carries a hint + a per-subject explanation.
- Assembly precedence: VALID[id] -> FIXED[id] -> old generator.
- grammar.js: renderChoice + renderUnscramble now show a "Hint: ..." chip when a
  question has `q.hint` (fill already had a hint).

## Verification
- node --check OK on both files; no em dashes.
- Node load: a2-be = exactly 104 questions; bad agreement = 0 (PASS); missing
  hint = 0; option problems = 0; "We ____ a teacher" = NOT present (gone).
  Samples all correct ("The teacher is a student", "My parents are afraid").
- REAL-browser smoke (preview, throwaway _hint_harness.html, deleted): Unit 1 ->
  Multiple Choice served "You ____ very young." WITH the chip "Hint: verb to be:
  I am, he/she/it is, you/we/they are." Hint displays correctly.
- Versions: grammar-content.js v15->v16, grammar.js v24->v25.

## Next (after user approves the pilot quality)
- Scale: build a VALID generator for each of the ~80 topics (A2/B1/B1+/B2 + C1),
  each with typed pools + hint, capped at 104. This is the bulk of the remaining
  work. The hand-written FIXED banks stay as the fallback until each topic's
  VALID generator lands.

## Not done
- No deploy. No push.

---
## 2026-06-25 update: validated generators scaled to 7 A2 topics
Added validated generators (typed pools + lint + hint, 104 each) for:
a2-be, a2-be-questions, a2-was-were, a2-there-is-are, a2-a-an,
a2-present-simple, a2-past-simple.
Verified (Node): each ~104, lint problems 0, missing hints 0; agreement
spot-checks all pass (no "Is they", no "Are she", no plural+was, no plural+-s).
grammar-content.js v16 -> v17.
Remaining: 18 more A2 topics + all of B1/B1+/B2 + C1 (new) = ~75 topics on FIXED
(4 each) until their validated generator lands.

---
## 2026-06-25: A2 COMPLETE (all 25 topics validated)
All 25 A2 topics now use validated generators (typed pools + lint + hint):
2321 total questions, 0 lint problems, agreement spot-checks all pass.
Per-topic counts range ~44-104 (most 90-104). A few are naturally smaller
because the tested word is the ANSWER not the stem (adv-frequency 44,
question-words 56) - forcing 104 there would mean repeated/odd carriers.
grammar-content.js bumped through v20.
Remaining: B1 (20 topics), B1+ (18), B2 (19) - currently on the hand-written
FIXED fallback (~4 each) - and C1 (new, 0 topics). ~57 topics to go.

---
## 2026-06-25: FIX - semantic adjective-noun compatibility (comparatives/superlatives)
Bug (reported live): the comparative/superlative generators paired EVERY adjective
with EVERY noun, producing grammatically-correct but SILLY carriers like
"This exam is happier than that one" and "the fastest film". Typed pools fixed
agreement but not collocation.
Fix: new ADJN table maps each adjective -> [comparative, superlative, NOUNS it can
sensibly describe] (happy -> child/student/family/team/customer; fast ->
car/train/runner/computer/plane; etc.). a2-comparatives, a2-superlatives and
b1-comparatives now iterate adjective x ITS OWN nouns only.
Verified: each 104, lint 0, and an automated scan for the reported silly combos
(happy+exam/film/car, fast+film/exam) returns 0. Samples sensible.
grammar-content.js -> v23.
NOTE: user has deployed, so a REDEPLOY (firebase deploy --only hosting) is needed
to push this fix live.

---
## 2026-06-25: FULL A2 SEMANTIC DEBUG (user-requested)
Audited all 25 A2 topics (sample dump + heuristic flags for animacy / collocation /
verb-object nonsense). Found + fixed 3 more classes beyond comparatives:
1. "It" as a PERSON subject -> dropped "It"/"it" from a2-be, a2-be-questions,
   a2-was-were, a2-adv-frequency (was producing "It is a nurse", "It is never tired").
2. a2-some-any -> "There is some time in the fridge" and "I bought some friends".
   Templates changed to "We have ____ N." / "Is/Are there ____ N?"; dropped "friends".
3. a2-much-many -> "I don't drink homework", "How much traffic do you need?".
   Templates changed to "How ____ N is/are there?" / "Is/Are there ____ N?".
Re-audit: It+person 0, "in the fridge" 0, "some friends" 0, "don't drink X" 0,
"do you need traffic/homework" 0. A2 = 2326 questions, 0 lint problems.
(The remaining "It is..." are superlatives "It is the fastest car here." - correct.)
grammar-content.js -> v24. REDEPLOY needed to push live.

---
## 2026-06-25: A2 SEMANTIC DEBUG - PASS 2 (read EVERY stem, not heuristics)
User caught two the heuristic pass missed: "We were at work last year" and
"there are some people in the box". Heuristics only flag what you predict, so
this pass dumped ALL ~2326 A2 stems to a file and read every line. Fixes:
1. a2-was-were: was Math.random + cross-joined transient states with long times
   ("ill last year"). Now a deterministic COMBO list pairing transient states
   with short anchors, places/events with longer ones.
2. a2-there-is-are: "people in the box", then (pass 2b) "a car in the kitchen" /
   "a window in the garden". Now typed groups: small objects -> surfaces/box;
   furniture+plants -> inside places; living things -> room/garden/outside.
3. a2-be / a2-be-questions: job-title subjects (The teacher/doctor) + job
   complements gave "The teacher is a doctor". Dropped those subjects. Also
   "The children are nurses/engineers" -> changed PLUR "The children" to "The women".
4. a2-a-an: abstract nouns + I have/I need/This is gave "This is an hour",
   "I need an island". Now concrete nouns only + It is/That is/This is/I can see.
5. a2-simple-vs-continuous: "Listen! She is reading" (silent action) AND the
   "At the moment, My sister..." capital-mid-sentence bug. Now "She is reading
   a book at the moment." (subject-initial).
Re-verified by re-dumping + targeted scans: children+profession 0, car/window
wrong-place 0, capital-mid-sentence 0, lint 0, missing-hint 0. A2 = 2326.
grammar-content.js -> v25. REDEPLOY needed.
Lesson: for generated content, READ the output, do not trust pattern heuristics.
