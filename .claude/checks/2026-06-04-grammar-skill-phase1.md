# Grammar skill - Phase 1: practice drills by CEFR level · 2026-06-04

## Request
"Let's go for the grammar part." Chosen: practice drills + grammar exams, organised
by CEFR level, scaffolded with samples. Phase 1 = the student practice screen.

## What was built (Phase 1)
New files:
- `y/student/js/skills/grammar-content.js` - `window.GRAMMAR_PRACTICE`: levels
  [A2, B1, B1+, B2] -> topics -> questions {stem, options, answer index, explain}.
  Scaffold: 10 topics, 40 questions (present simple, articles, prepositions,
  present perfect, 1st conditional, relative clauses, past perfect, passive,
  3rd conditional, reported speech).
- `y/student/css/grammar.css` - scoped to #grammarScreen: level tabs, topic cards,
  drill, option states (correct/wrong), feedback, result. Dark navy theme.
- (rewrote) `y/student/js/skills/grammar.js` - engine: level tabs -> topic cards ->
  one-question-at-a-time MCQ with instant feedback + explanation -> score + retry.
  No timer, replayable, NO Firestore reads/writes (local practice only).

Wiring (y/student-dashboard.html):
- Added `<div id="grammarBody">` inside #grammarScreen; subtitle "-" -> "Practice by level".
- Linked grammar.css?v=1; added grammar-content.js?v=1 before grammar.js?v=1.
- Cache-busted hub.js?v=1.
hub.js: grammar `active:false` -> `true`; getSkillSubtitle returns "Practice by
level" for grammar; cleaned the "-" fallback (was an em dash) to a hyphen.

## Verification
- `node --check` on grammar-content.js / grammar.js / hub.js -> SYNTAX OK.
- Content integrity (node eval): 10 topics, 40 questions, EVERY answer index in
  range, all have stem/options/explain -> "data issues: NONE".
- Wiring grep: grammarBody present, grammar.css + grammar-content.js linked,
  subtitle set, hub grammar active:true. All true.
- SW CACHE_VERSION v14 -> v15.

## Deploy / view
- `firebase deploy --only hosting`, reopen. Hub -> Grammar -> pick a level -> a
  topic -> answer. (Grammar card lights up; clicking it always worked, the screen
  is now populated.)

## Phase 2 (next, NOT done)
Grammar EXAMS: add a `grammar` skill to assignments/js/exam-registry.js
(level-grouped), a grammar-exam runner, and teacher-picker support so grammar can
be assigned and scored. Touches the assignment system, so it is a separate,
careful pass.

## A2 content rebuilt to coursebook + Azar (same day)
User shared the coursebook scope-and-sequence (Units 1-11, A2) and asked to base
A2 grammar on it + the Azar "Basic English Grammar" progression.
- Rebuilt the A2 bank: 16 topics / 64 questions covering Units 1-7 grammar:
  be (+/-), be questions, a/an, plural nouns, possessives (my / 's), question
  words, present simple (+/-), present simple questions, adverbs of frequency,
  have got, some/any, much/many/a lot of, there is/are, past simple, past simple
  questions, like/love/hate + -ing. Azar-style "rule + example" explanations.
- B1 / B1+ / B2 left as scaffold.
- Cache: grammar-content.js?v=1 -> ?v=2 in student-dashboard.html.
- Verified: node --check OK; A2 16 topics/64 Q; total 92 Q; every answer index in
  range; "data issues: NONE".
- NEXT A2 batch (Units 8-11): can/could + have to, present continuous, present
  simple vs continuous, comparatives, superlatives, present perfect (+ vs past
  simple). Not done yet.

## Theme match + reset-on-hub (same day)
- Theme: rewrote grammar.css to follow the VOCABULARY palette (global vars:
  --accent-primary blue #3b82f6, --accent-secondary orange #fb923c, --bg-item,
  --success/--error) and mirror the vocab quiz option look (.choice-btn): same
  card/option styling, blue->orange gradient buttons, green/red answer states,
  pulse/shake. No more bespoke teal theme.
- Reset: grammar.js renderGrammarScreen() now FULLY resets (level -> first,
  topic null, qi/score 0) then renders home; exposed as window.resetGrammar too.
  hub.js openSkill() calls window.renderGrammarScreen() after showScreen for
  grammar, so re-entering from the hub always starts fresh (never a half drill).
- Cache: grammar.css?v=1->2, grammar.js?v=1->2, hub.js?v=1->2 in student-dashboard.html.
- Verified: node --check grammar.js + hub.js OK; cache bumps confirmed.

## Assignment wiring (Phase 2) - architecture mapped, NOT built yet
- skill-registry.js: grammar = status 'coming-soon', formId 'grammarAssignmentForm'.
  Picker (teacher-assignments.js) shows "coming soon" for it; active skills route
  via routeToCreationForm() (vocab) or an override (exam-form.js, writing-form.js).
- To wire grammar fully needs: (1) flip registry to 'active'; (2) a grammar
  creation form modal + grammar-form.js (open/save, route override); (3) student
  side - student-assignments.js renders it + "Start" opens the grammar screen at
  the assigned level + completion recording; (4) confirm Firestore rules accept a
  skill:'grammar' assignment doc. This is the fragile assignment path, so it is a
  careful separate build - pending the shape decision (practice-by-level vs
  pick-topics vs scored quiz).

## Notes
- Hub card shows "0%" for grammar (no cumulative score tracked yet); can wire a
  practice-progress signal later.
- Practice content is a scaffold - swap in real questions anytime (same shape).
