# 2026-08-19 - Five reported items

## 1 + 2. Dark boxes on the teacher assignments tab and the courses page
Same root cause as the Admin tab, and I had been finding these one screenshot at
a time, which does not scale. Built `y/tools/light-coverage.js`: it reports any
CSS rule that paints a dark surface or near-white text and has NO light-mode
counterpart and is not token-driven.

First run: 97 findings, cut to 65 after teaching it that white text on a FILLED
control is correct (a blue button, a red badge) - otherwise the report is mostly
buttons and nobody reads it.

Those 65 were generated mechanically: each new rule mirrors a real selector and
flips ONLY its surface, keeping the original alpha so translucent panels stay
translucent and the layering is unchanged. Dark is untouched.
  63 rules across 22 files, then 2 stragglers by hand.
Now 0. The check is repeatable: `node y/tools/light-coverage.js --strict`.

Deliberate exemptions, both with reasons in the code:
- video / canvas grounds stay black; letterboxing is black in every player and a
  white gap round a video reads as a bug.
- the scrollbar track was NOT exempted - it is page chrome, so it follows.

## 3. Deactivation worked everywhere except placement
The placement card builds itself and appends straight to #hubGrid, so it never
goes through hub.js and never learned about `hideInactiveTiles`. Its own comment
said "the card is never removed". Every other tile disappears when its skill is
switched off; this one stayed as a greyed "Not activated" card. Same rule now.

Race closed while doing it: boot()'s reads can resolve AFTER the switch is
flipped, and would have put the card back. A `suppressed` flag is checked by
ensureCard(), so both paths agree.

## 4. "It refreshes twice to know if it is on or off"
`feature-toggles.js` used a one-shot `.get()`. Two consequences, and together
they are exactly the reported symptom:
  1. A teacher flipping a switch changed nothing on an already-open page, so a
     reload was needed at all.
  2. Firestore's offline cache can answer that first get() from cache, so reload
     #1 could still show the OLD value and only reload #2 showed the new one.
Now `onSnapshot`. The switch takes effect immediately with no refresh, and there
is no cache-then-server race to lose. It REPLACES the read rather than adding
one: a single listener on one small document.
placement-tile.js now listens for the same event, or it would have kept its
sign-in value while every other tile updated around it.

## 5. Density: hero + stats moved into the Quest Board
Agreed with the suggestion, with one deviation the user approved: the XP row
STAYS on the screen. Those five stat cards are report-card numbers - "2326
questions" does not help anyone choose a game - but the XP bar is the reward
loop, and hiding progress behind a click is how you kill it.

Grammar (JS-built): hero + stats now render at the top of the Quest Board.
Vocabulary (static HTML): the nodes were MOVED, not copied. Their ids are what
the dashboard JS writes into (welcomeName, currentStreak, journeyAccuracy, ...);
duplicating them would have given two elements the same id and updates would
have landed on whichever the browser returned first - silently, and only for
some of them. Verified every moved id appears exactly once and the div count is
still balanced (328/328).

The 0/25/50/75/100 tick scale is gone from both - the "X / 100 XP" label beside
the pill already says it. The loop in progress.js that lit the ticks went with
it rather than being left to query a node that no longer exists.

MEASURED, grammar screen:
  before: hero 87 + XP 92 + stats 99 = 278px of preamble, games started at 402px
  after:  XP 65px, games start at 152px, main column 540px -> 290px
  saving: 250px

Correction to my own estimate: I predicted the XP row would slim to ~32px. It is
65px - a bordered card with a pill row and a bar has a floor. The overall saving
still came in above the 240px I predicted.

## Verification
- Contrast audit: grammar screen 0, Quest Board 0.
- node --check every JS file: passes.
- theme-sanity PASS, tokenise-colors idempotent, inline-css-check PASS,
  light-coverage 0, bump --check no drift. Service worker v239.
- The browser pane stopped compositing at the end, so the last step was verified
  by measurement and audit, NOT visually.

## Still open
- Vocabulary screen density beyond the header (the activity grid itself).
- The 13 unit pills that should collapse into a dropdown.
- Nothing deployed.
