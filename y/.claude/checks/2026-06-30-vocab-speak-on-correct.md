# 2026-06-30 - Vocabulary: read the word aloud on a correct answer

## Request
In the vocabulary games, speak the correct word after it is answered correctly,
so students can hear it and repeat to practise pronunciation.

## Change (y/student/js/games.js)
Reused the existing accent-aware speak() helper (pronunciation.js). Added a
guarded speak() on the CORRECT branch of the four modes that lacked it:
- checkChoice (meaning MCQ)   -> speak(currentWords[currentIndex].word)
- checkFill (gap-fill)        -> speak(displayForm)  (the inflected form shown)
- checkUnscramble            -> speak(cur.word)
- selectMatchItem (matching) -> speak(a.id)          (a.id is the word)
Reverse and Spelling already spoke on correct (unchanged). Each call is guarded
with "typeof speak === function" so embedded classroom games that do not load
pronunciation.js never throw.

## Also (hard no-em-dash rule)
Replaced 5 user-facing em dashes in the word-order / unscramble feedback strings
with hyphens ("No more points - ...", "Attempt n/3 - try again!"). Remaining em
dashes in games.js are code comments and required punctuation regex char-classes.

## Sanity
- node --check games.js + service-worker.js OK.
- My new lines added 0 em dashes; 5 pre-existing user-facing ones removed.
- Cache-first asset, so bumped service-worker CACHE_VERSION v67 -> v68 to refetch.
- No deploy / no push.
