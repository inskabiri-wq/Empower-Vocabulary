# Grammar bank: ambiguity + absurd-sentence fix · 2026-06-10

User-reported (with screenshots):
1. "____ four men in the fridge." (absurd + both There are / There were fit)
2. "The shops ____ really good." (are and were both fit, no time word)
3. Fill blank "The students ____ the door last week." (open / close both fit)
4. Fill blank "____ the students read a book?" (Do and Did both fit)
5. Fill blank "My sister ____ write a letter." (can / didn't / will all fit)

## Engine (grammar.js v16, grammar.css v14)
- Fill in the Blank now shows a WORD BANK under the input ("Choose from:"
  + the question's own 4 options as chips). This is the textbook word-box
  pattern: the student still types (spelling practice), but the choice set
  is visible, which kills every open-class ambiguity (open vs close,
  can vs didn't, Do vs Did) in one stroke across all 3,131 questions.
- Fill checking was already case-insensitive (norm() lowercases), so
  "did" vs "Do" failed on tense only, never on the capital letter.

## Content (grammar-content.js v8): rules applied everywhere
- RULE 1: if a question's options mix present + past forms (is/are vs
  was/were, do/does vs did, There is/are vs There was/were), the stem MUST
  carry a time expression (right now / today / yesterday / last night /
  in 1990 / since 2019 ...).
- RULE 2: single-tense topics keep all 4 options in ONE tense, so no time
  word is needed and no second answer is possible.
- RULE 3: no random cross-products that produce nonsense. Curated pairs.

Fixed generators:
- there: full redesign. Campus-flavoured curated noun+place pairs
  (printer in the computer room, twenty students in the lecture hall).
  Permanent things test singular/plural (present-only options); events
  test present vs past WITH anchors. No more "four men in the fridge".
- wasWere: people get people-complements, things get thing-complements
  (no more "the students were delicious"); every stem past-anchored.
- aan: distractors the/some -> two/these ("It is the dog" was also right).
- qw: every question now carries its short answer ("____ do you live?
  In Istanbul.") so only one question word fits.
- poss: distractors stay in the same person ("He is washing ____ car"
  could be his OR her -> now his/him/he/himself).
- presSimple: routine anchors + distractor v.ed/didn't removed ("He ____
  breakfast" could be eats or ate).
- presSimpleQ: routine anchors (every day / on Sundays).
- pastQ: yesterday/last week anchors on Did-questions ("Did the students
  read a book?" was also fine with Do).
- ppVsPast: removed recently/before/many-times frames (valid in BOTH
  tenses); the present-perfect side now uses 'since ...' with durative
  verbs, where past simple is truly wrong.
- someAny: 'the' distractor -> 'an'; offer frame -> "I would like ____ X,
  please." ("Would you like A coffee?" was also right).
- muchMany + b1AFewLittle: 'a lot of / lots of / few / little' distractors
  (all grammatical) -> a few / several / a little / a bit of (wrong with
  the given noun); topped up to keep ~104/unit.
- b1PastCont: v.ed distractor ("She WATCHED TV at 8 last night" is fine)
  -> wrong-agreement was/were + -ing; durative verbs only (VDUR pool).
- b1Cond2 + b1pWish: 'was' distractor (widely accepted) -> 'be'.
- b1ModalsOblig: real rules/advice sentences ("Students must arrive on
  time"), no more "It is a rule: she must drink coffee".
- b1PassivePres/Past + b1pPassivePerf: curated subject+participle pairs
  (no "the letter is eaten every day" / "the car has been written");
  past-passive tails all carry years/anchors; added question forms.
- b1pCausative: possessive now matches the subject (Tom has HIS photo
  taken, not my); present form's options stay present (had also fit
  "every month" as past habit).
- b1pPresPerfCont / b1pFutureCont: durative verbs only (no "has been
  opening the door for two hours").
- New helpers: lcFirst() (protects English/Turkish in questions), VDUR.

## Automated lint (now part of the verify run)
- Cross-tense options without a stem anchor: 0 (was 148 raw, all triaged:
  real fixes above, the rest false positives refined into the lint:
  'been' forces the perfect; 'ever' / 'would' / short-answer context).
- TOTAL 3131 Q (A2 1149 / B1 1040 / B1+ 934 / B2 8 scaffold),
  problems 0, 4-option 100%, agreement errors 0, em-dash 0.
  Units: A2 U1-U11 and B1 U1-U10 all 104+ (A2 U1=108); B1+ U8=102.

## Cache
- grammar-content.js ?v=8, grammar.js ?v=16, grammar.css ?v=14
  (student-dashboard.html + teacher-dashboard.html), SW v31 -> v32.

## Not verified live
- Browser render of the fill word-bank chips (needs Firebase login).
  Markup mirrors existing esc()+map pattern; node --check passed on both
  files and the content lint executes the real shipped file.

## Deploy
- firebase deploy --only hosting (user runs it).
