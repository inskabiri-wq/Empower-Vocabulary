# B2 bank + grammar in classroom games · 2026-06-10

## 1. B2 grammar bank (grammar-content.js, replaces the 2-topic scaffold)
- 936 questions, 19 topics, 9 units, all units exactly 104.
- New generators: b2PastPerfCont, b2FuturePerf, b2MixedCond (3 forms),
  b2WishPast (regrets: wish + had + pp), b2ModalPassive (must/should/can/
  has to + be + pp, with (verb) cues), b2DeductionPast (must/can't/might
  have done, curated evidence pairs + the have-slot form), b2BeUsedTo
  (used to vs be used to + -ing), b2GerInfMeaning (27 hand items:
  stop/remember/forget/try/go on/regret/mean + -ing vs to), b2ReportingVerbs
  (12 direct->reported items + combinatorial offer/refuse/promise/agree + to
  and suggest/admit/deny/recommend + -ing drills), b2SoSuch, b2Unless
  (unless / in case / as long as / so that), b2Articles (the + instruments/
  rivers/superlatives, a/an edge cases).
- Reused for review: b1pPresPerfCont, b1pFutureCont, b1pCond3, b1pWish,
  b1pPassivePerf, b1pPastModals, b1pCausative, b1pReported, b1GerundInf.
- All rules from the ambiguity pass apply: time anchors on cross-tense
  options, (verb) cues on open-class blanks, no nonsense carriers.
- Fixed during build: "anyone can't have entered" (negative subject) ->
  "the thief can't have entered"; "nobody must have watered" -> "everyone
  must have forgotten"; broken cue derivation (complet/tak) -> explicit base
  forms; phrasal "switch offing" guarded out; LEMMA map for reporting verbs.
- Lint: 6 rebuilds x 4 levels = 24k+ questions, 0 problems, 0 cross-tense
  questions without an anchor (lint now knows modal + ____ forces 'have').

## 2. Grammar Race (standalone classroom game)
- classroom-teacher.html: new picker card #pickGrammar (teal). Shares the
  Vocab Race setup screen; openRaceSetup(mode) sets window.classroomMode,
  retitles the form, resets level/unit. grammar-content.js?v=10 loaded.
- teacher.js: createSession branches on classroomMode; grammar questions are
  stored in the SAME words[] shape (word=stem, definition=correct answer,
  + options/answer/explain), so the lobby, leaderboard, per-word results
  table and answers subcollection all keep working unchanged.
  getGrammarQuestionsForSession(level, unit, count) + updateUnitSelector
  grammar branch (units parsed from topic blurbs). Session doc gets
  mode: 'grammar' | 'vocab'.
- student.js: grammar sessions are always multiple-choice;
  showGrammarChoice renders the stem (blank highlighted) + the question's
  own 4 options reshuffled per student. selectOption/processAnswer/answers
  recording untouched (stems ride in the word field).

## 3. Heist + Trust No One: grammar question source
- Both setup forms (classroom-teacher.html) get a "Coin questions" /
  "Investigation questions" select: Vocabulary (pack, default) or Grammar
  + level/unit pickers (filled from the bank). Passwords + Taboo hints stay
  pack-based either way (that mechanic needs the word list).
- URL params qsrc/glv/gun -> heist-teacher.js + trust-teacher.js store
  questionSource/grammarLevel/grammarUnit on the session doc.
- heist-student.js: buildGrammarEarnQueue() + grammar branch in
  nextEarnQuestion; wrong-answer feedback shows the right option.
- trust-student.js: buildGrammarQueue() + shared renderQuestionItem() used
  by BOTH the alive loop and the ghost loop; correctTextOf() for feedback.
- SAFETY: if the grammar bank is missing/empty, both games fall back to
  the pack words, so a session can never stall.
- classroom-heist-student.html + classroom-trust-student.html load
  grammar-content.js?v=10.
- firestore.rules: no change needed (session create rules only pin
  hostUid/createdBy; extra fields allowed). Old sessions without
  questionSource default to vocab on the student side.

## 4. "Both, mixed" question source (user follow-up)
- Heist + Trust forms: third option "Both, mixed (vocabulary + grammar)".
  Grammar level/unit pickers show for grammar AND mixed; create validation
  requires a level for both.
- heist-teacher.js / trust-teacher.js: qsrc whitelist ['grammar','mixed'].
- heist-student.js / trust-student.js: mixed queue = grammar questions
  (capped to the pack size so the blend is ~50/50, not 900 vs 20) + pack
  words, shuffled; trust got a shared buildSourceQueue() used by the alive
  AND ghost loops. Same pack fallback if the bank is missing.
- Race: the setup screen now has a Questions select (Vocabulary / Grammar /
  Both, mixed). The picker card preselects it; the teacher can switch.
  Mixed sessions store half grammar + half vocab from the SAME level/unit
  (vocab "Unit N" labels mapped to grammar's numeric units; the unit
  dropdown shows the union of both sources' units). student.js now decides
  the render PER ITEM (a question with its own options array renders as a
  grammar MCQ), so mixed words[] arrays just work.
- Simulation: mixed race B1 units all/3/7 -> 5 grammar + 5 vocab each;
  heist/trust mixed -> 20 + 20 queue; vocab/grammar modes unchanged.

## 5. Setup-form reorder (user follow-up: source first)
- Heist + Trust setup forms restructured: 1) question source + grammar
  level/unit FIRST, 2) hint pack second with an honest label (Heist:
  "Hint pack (vault passwords + hints)"; Trust: "Hint pack (vocabulary
  words)"), 3) game rules after. No id changes, JS untouched; verified
  all 20 form ids unique and div/select tags balanced (128/128, 25/25).
- Em dashes in the moved trust option labels replaced with hyphens.

## Verification
- node --check on all 7 touched JS files: OK.
- Pool simulation against the real bank: every level/unit filter returns
  the expected counts (A2 1149 / B1 1040 / B1+ 934 / B2 936; unit filters
  104+), 0 malformed questions; a 20-question race doc is ~3.4 KB
  (Firestore limit 1 MB).
- NOT verified live (needs Firebase login + 2 devices): an actual hosted
  round. The flows reuse the existing race/heist/trust loops untouched
  for vocab mode; grammar mode is guarded branches + fallbacks.

## Cache
- service-worker.js v34 -> v35 (classroom JS + HTML have no ?v).

## Deploy
- firebase deploy --only hosting (user runs it).
