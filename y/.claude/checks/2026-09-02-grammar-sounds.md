# 2026-09-02 - grammar had never made a sound

Reported as "can't hear grammar sounds" after the shared-engine deploy. Not a
regression: `student/js/skills/grammar.js` had **zero** sound calls, and always
had. Vocabulary had fifteen. Grammar simply never asked.

The engine was reachable the whole time on that page - `ui.js` loads at line
1089 and `grammar.js` at 1132 - so this was a missing call, not a missing
dependency.

## Added

All three grammar games, at the moment the answer is judged:

| game | where |
| --- | --- |
| Multiple choice | after `if (i === q.answer) state.score++` |
| Fill in the blank | after the `norm(val)` comparison |
| Unscramble | after the token-order comparison |

Plus the `complete` flourish when a drill finishes, matching vocabulary.

One helper does it:

```js
function sfx(ok) {
  if (typeof playSound === 'function') playSound(ok ? 'correct' : 'incorrect');
}
```

Through `playSound()` rather than `LLSound` directly, so it obeys the single
Sound Effects switch like everything else, and stays silent rather than
throwing if the engine is ever absent.

## Executed

The real `sfx()` from grammar.js chained to the real `playSound()` from ui.js,
the way the page chains them:

| | |
| --- | --- |
| a right answer plays "correct" | PASS |
| a wrong answer plays "incorrect" | PASS |
| finishing plays "complete" | PASS |
| no engine loaded: silent, no throw | PASS |
| sfx is called from all three games | PASS |

`grammar-sanity` still passes, so nothing about the content changed.

## Backed up first

`grammar.js` was copied to the scratchpad before the scripted edit. That is
the direct lesson from the previous change, where a script corrupted seven
files with no backup to fall back on. Every anchor in the script also asserted
it matched exactly once, so a silent no-match could not pass as success.

## Still silent, and worth deciding

| activity | sound |
| --- | --- |
| Vocabulary games | 15 calls |
| Grammar | 3 calls + complete |
| **Pronunciation** | none |
| **Reading exam** | none |
| **Listening exam** | none |
| **Writing exam** | none |

Pronunciation is the interesting one: it is the only activity where the student
is already making noise, so a cue may help or may collide with the microphone.
The three exams are arguably right to stay silent - a chime after every reading
question would be wrong in a test - but that should be a decision, not an
oversight like this one was.

## Ritual

- `node --check` across every `.js` - 0 failures
- grammar-sanity - PASS
- gates: eighteen, all PASS
- em-dash scan - clean
- bump: grammar.js, CACHE_VERSION -> **v396**; `--check` OK
