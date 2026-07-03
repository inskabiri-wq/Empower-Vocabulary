# 2026-06-29 - Fill in the Blank: "which word" hint

## Problem (user)
In Fill in the Blank there are no options, so the typed answer is often
unguessable - many verbs fit grammatically but only one is the expected answer,
and the only "hint" shown was the topic name. Students did not know WHICH word.

## Fix (grammar.js ?v=26 -> ?v=27)
- Added maskAnswer(): the answer with all but the first letter of each word masked
  (goes -> g___, has been -> h__ b___, would have -> w____ h___).
- Fill mode now shows a reveal-on-demand "Show hint" button (same style as MCQ /
  Unscramble) that reveals: "Word to make: <masked answer>" + the grammar rule.
- Strong students still answer cold; stuck students get the "which word" prompt
  without the full answer. CSP-safe (delegated/handler wiring already in place).
- Multiple Choice and Unscramble unchanged (they show options, so no need).

## Sanity
- node --check grammar.js OK. em-dash 0. mask tested on 10 sample answers.
- Grammar content checker still PASS (grammar-content.js untouched this change).
- grammar.js ?v=26 -> ?v=27. No deploy/push. Redeploy to ship.

## 2026-06-29 (cont.): Fill hint redesigned - grammar rule + verb MEANING clue
- User did not want the first-letter mask. Fill "Show hint" now gives two things and
  never the word: (1) the grammar rule, (2) a meaning CLUE for the verb (a short
  definition that never contains the verb), so the student still has to think.
- Added GR_GLOSS (~90 common verbs), GR_IRREG, grBase()+grLemma() (resolves an
  inflected answer to its base; restores dropped e and de-doubles consonants).
- Only lexical verbs get a clue; auxiliaries/articles/quantifiers and the
  going-to / used-to structures fall back to the grammar rule only.
- node --check OK, em-dash 0, content checker still PASS. grammar.js ?v=27 -> ?v=28.

## 2026-06-30: completed the verb clue (causative bug + coverage)
Reported: B2 causative "He had the speech ____ last month" (= translated) showed
only the Grammar rule, no verb Clue - because translate + many causative/passive
verbs were not in the dictionary, and the resolver mangled some verbs.

Fixes in grammar.js (?v=28 -> ?v=29):
- Resolver rewrite grBase -> grCandidates(): tries the raw word first (so base
  verbs ending -ing like "sing" survive) then every inflection rule, offering the
  plain strip AND the de-doubled / e-restored form. Fixes called->call, passed->
  pass, stopped->stop, liked->like, driving->drive.
- Added irregulars: said->say, worn->wear, grown->grow, stolen->steal,
  lying->lie, won->win.
- Added ~33 verb glosses (translate, service, type, copy, audit, analyse, tailor,
  review, redecorate, redesign, landscape, notice, lock, grow, test, water, turn,
  serve, steal, cancel, plant, depart, retire, film, attend, present, settle,
  fail, cycle, say, lie, deliver, record).
- Non-verb topics: tagged each question with q._tid in poolFor and added
  GR_NONVERB_TID so plural/comparative/superlative/possessive/quantifier/article
  topics show ONLY the grammar rule (kills the leaves->leave, watches->watch
  nonsense clue).

Fill-only audit (single-word answers = real fill questions): 3163 fill questions,
1047 now carry a verb clue; WRONG clues on non-verb topics = 0; verb answers with
no clue = 0. Content checker still PASS. node --check OK, em-dash 0. v28 -> v29.

## 2026-06-30: added first-letter to the fill hint
User: meaning clue alone still too vague. Added a "Starts with: <first letter>"
line to fillHintBlock (grammar.js), shown with the Grammar rule + verb Clue.
Example causative: Grammar rule / Clue: the verb means "change words into another
language" / Starts with: "t"  -> student reaches "translated". First letter only
(not the whole word). node --check OK, em-dash 0. grammar.js ?v=29 -> ?v=30.
