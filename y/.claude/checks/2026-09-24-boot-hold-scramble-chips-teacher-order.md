# 2026-09-24 - dashboard loads at once, Scramble "not reached", chips, teacher order

He said: no Placement box in Rate Lingualab; the admin/teacher choice boxes in
Messages & help are not the same; the dashboard "flashes" the app and tiles
first, then assignments, logo and percentages - make it all appear together;
where is the teachers' message location, and put Rate between Classroom and
Log out; and in a game "what do you mean not reached, I was the only one".

Done as: a read-only investigation workflow (4 agents), an implementation
workflow on 4 disjoint file sets, my own browser checks on the emulator, and an
adversarial review (reviewer + skeptic per finding).

## 1. Dashboard reveals together (student-dashboard.html + 8 scripts)

Nothing coordinated the hub: each piece drew when its own data came, spread
over about five network round trips. Now a HUB BOOT HOLD block in the head
keeps #hubScreen invisible (visibility, so layout and seal placement still
work) until six signals arrive: tiles (hub.js), placement (placement-tile.js),
user (auth.js), logo (org-brand.js, after the seal image has loaded), stats
(auth.js cache prime / progress.js), assignments ('assignments:updated').
- After 150 ms a small pulsing Lingualab mark shows; at 2.5 s it reveals
  whatever happens; a script runtime error reveals at once. Plain timers, no
  frames or transitions. Fails open if the script never runs.
- Never held: deep links (#vocabulary etc), ?preview=1, signed-out redirects;
  ui.js showScreen releases it for any other screen.
- Real bug fixed on the way: the percentages "cache prime" looked for the
  session in localStorage, but the SDK keeps it in IndexedDB, so tiles drew
  0% first on every visit. LLJourneyCache.primeFor(uid) now runs from auth.js.
- auth.js no longer waits for the login activity log (two round trips).
- The false "No assignments right now!" flash on first sign-in is gone.
- org-brand.js additions are guarded by window.LLHubBoot: no-op on the teacher
  dashboard. boot-trace.js (?boot=1) records "hub revealed <why> <timings>".
Proven: harness tools/harness/hub-boot.html runAll() all 8 groups PASS in the
pane. Emulator, real student: data-hub-boot = "ready:211" (tiles 30, placement
170, user 171, logo 200, assignments 208, stats 211 ms); boot trace shows every
redraw (tiles x2, seal, assignments) BEFORE "hub revealed", no skeleton left at
reveal, seal in place. #vocabulary deep link never held.

## 2. Scramble "not reached" - nothing was lost, the label was wrong

Teacher-paced game: a phone records a sentence only on Submit, so a sentence
shown but not submitted before the round moved on (timer, Next, End, unused
words) had no result and was labelled as if students go at their own pace.
- Review now: "no answers" (shown, nobody submitted, tooltip "0 right, 0 wrong,
  N no answer"), "not played" (after the game ended), and "N no answer" under
  the count so a sentence most of the class could not finish no longer reads
  a clean green. Never "0%" for an unanswered sentence.
- Phone: "Sentence N was not submitted - moving on." when the round moves on.
- Review findings fixed: (a) REJOIN WIPED THE SCORE (pre-existing, same bug the
  AI Quiz had): joinRoom wrote score/answered 0 and lastRound -1 over an
  existing player; now an existing player keeps everything, the phone restores
  its score and shows "Your answer for this sentence is in" for a sentence
  already answered (no double submit, no false notice); (b) the end-of-game
  race: results wait 1.5 s ("Collecting the last answers...") only when someone
  had not answered the live sentence, so a last-second answer reaches the
  review, podium and saved report; (c) "10 no answer" wrapped in the 74px
  column: widened to 96px, and the harness now measures wraps.
- Phone layout (pre-existing): the % dropped into the number column and ran
  into the count ("100%12/12"); now on the sentence's line at the right.
Proven live on the emulator: room RBABX solo (answer 1, skip 2 and 3, End in
4) -> 1 "100% 1/1", 2-4 "no answers", 5 "not played"; the phone notice fired.
Room UCXQY (with a non-answering player): answered 1 (+200), reloaded and
rejoined -> DB still score 200 / answered 1 / lastRound 0, phone showed 200 and
"answer is in", Next gave no false notice; End in 2 -> "Collecting..." ~1.5 s
then 1 "100% 1/1 / 1 no answer", 2 "no answers", 3-5 "not played".
Harness scramble-review.html verify() PASS (3 lists) and FAILS at the old 74px.

## 3. Teacher dashboard

- Messages for teachers are the "Messages from your students" card on
  Overview, only for teachers with a class; admin and demo accounts never get
  it (by his decision), which is why he never sees it. It was the LAST card;
  now directly under the four number cards. Emulator teacher (B101): card at
  +16 px under the stats, "0 waiting", on desktop and at 375 px.
- Rate Lingualab now sits between Classroom and Logout; the phone More sheet
  mirrors it: Lingualab, Classroom, Rate Lingualab, divider, Logout.

## 4. Student chips

- Rate Lingualab: Placement chip for students (rules already allowed it).
  Emulator: 9 chips, Placement last; saved liked ["placement"], 4 stars.
  app-feedback-check.js now checks the STUDENT list itself (negative-tested:
  removing the chip fails the gate).
- Messages & help: every choice in a group is as wide as the widest, right
  aligned: who 362-672 / 362-672, topics all 452-672, when all 562-657 (px).

## Second review round (7 more confirmed, all fixed)

- BOOT ORDER BUG, found in my own cold-cache test, not by a reviewer:
  auth.js loads BEFORE progress.js but calls loadJourneyStats(). Awaiting
  the login log used to hide the race; once that await went, a fast load hit
  "ReferenceError: loadJourneyStats is not defined" - no percentages and a
  2.5 s cap on every load (the first "ready:211" run passed on cached
  scripts). auth.js now starts the user-doc read, then awaits
  DOMContentLoaded (domReady) before anything that uses later scripts
  (progress.js, avatar.js, the demo banner). 4 cold loads in a row: ready at
  134-358 ms, all six signals, no errors.
- 'stats' now comes ONLY from the fresh loadJourneyStats (the cached copy can
  be stale after grammar, writing or another device, and a tile jumped after
  the reveal); the cached copy is the fallback if the cap comes first.
  grammar.js refreshes the stats after a drill, like reading and listening.
- Loader drawn white on the Dark and Contrast themes (was navy on dark).
- Scramble: results render ONCE and the listeners are detached before the
  1.5 s wait (a late answer could advance a finished game and re-open its
  results); advanceRound refuses a finished game. Room GJJBP: finished,
  roundIndex stayed 1.
- Scramble late joiners: a new player records joinedRound; the review counts
  "no answer" only among players who were there for that sentence. Live: a
  student who joined on sentence 2 is not counted against sentence 1.
  Harness has a lateReview fixture (PASS 4 lists, host/harness parity PASS).
- Scramble notice names every missed sentence ("Sentences 3 to 4 ...") when a
  phone slept through several.
- Teacher Overview card: list capped at 340 px on laptops and the wheel now
  carries on to the page at its end; the "N waiting" badge ships hidden and
  appears only with a loaded count (never a false "0 waiting").

## Ritual

node --check on every touched script; no em/en dash in any touched file;
push-rules; gates.js 34 passed, 0 failed (1 production gate skipped as
always); bump.js --check consistent at v454 after the second round.

## For him to deploy

Yesterday's release is live (production service worker v450, index.html loads
js/faq.js). Everything above is on disk at v454. Hosting only (no rules change):
    firebase deploy --only hosting
Then one hard refresh. Open student-dashboard.html?boot=1 on a real phone once:
the panel's "hub revealed" line should say "ready", not "cap".
