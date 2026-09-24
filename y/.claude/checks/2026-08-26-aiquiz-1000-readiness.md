# 2026-08-26 - is the AI Quiz ready for 1000 students, and the header/background drift

Two requests in one pass. The scale audit is the one that matters, so it is first.

---

# Part 1 - AI Quiz at 1000, every angle

## The two things that would have broken the demo

### 1. A host refresh stranded the whole room. FIXED.

`classroom/js/aiquiz-teacher.js` held `code` and the question list **in memory
and nowhere else**. A reload dropped both and returned to the setup screen.

The room does not stop when the host's tab does: all 1000 phones stay
subscribed to a session document that will now never advance, and there is no
control anywhere that can end it. Not recoverable in front of a hall.

Now the host mirrors `{code, questions, seconds, qIndex}` to localStorage on
room creation and on every question, and reads it on boot. Resume requires
**all** of: an entry under six hours old, a session that still exists, is not
`finished`, and whose `hostUid` is this teacher. Anything else falls through to
a clean setup screen. A question still inside its timer resumes with the time
actually remaining; anything else comes back closed with the ladder up and Next
armed, which cannot cut a live question short or double-ask one.

### 2. The host was billed and throttled for 7,720 reads it never used. FIXED.

`watchPlayers()` subscribes to the whole `players` subcollection to draw the
lobby count. It was released only when the game **ended**, not when the quiz
**started**. Every student's score write is a change to that collection, so the
host kept receiving a callback per student per question for the whole game.

Measured on the emulator at 1000 players, `tools/demos/aiquiz-listener-load.html`:

| | callbacks per question | across a 20-question game |
| --- | --- | --- |
| listener left attached (before) | **386** | **7,720** |
| released at quiz start (after) | **0** | **0** |

Each of those is a document read billed to the project and a delta pushed to
the machine driving the projector. This is the most likely cause of the "the pc
or the mobile for teachers are very slow" report. Released in `askQuestion()`
now, and re-attached only on a return to the lobby.

**386 is a floor, not a ceiling.** The emulator batched 1000 writes into 386
callbacks because the harness sent them in blocks of 250. Real phones answer
independently, so production would sit closer to one callback per write.

## What was already right, confirmed rather than assumed

| | measured | why it matters |
| --- | --- | --- |
| session doc every phone listens to | **189-206 bytes** | one host write fans out to 1000 phones; a fat document would push the whole question bank each time |
| questions | separate doc, read **once** per phone | 3,194 bytes read at join, never on question change |
| ladder | **10 docs**, a `get()` not a listener | flat whether the room holds 30 or 1000 |
| lobby | one number, not a card per student | the O(N squared) render that made Vocab Race unusable at 300 |
| student end-of-game | reads **nothing** | Vocab Race still reads the whole player list per student; the AI Quiz never did |
| fan-out | 60 listeners, one host write -> **60 callbacks, 1234ms** | exactly one each, no amplification |
| increments | top score exactly 600 (5 x 120) | concurrent `FieldValue.increment` did not race |

## Security, re-run against the real rules with an anonymous account

| attempt | result |
| --- | --- |
| write OWN score | ALLOWED |
| write ANOTHER student's score | denied |
| delete another player | denied |
| advance the question | denied |
| end the game | denied |
| rewrite the answer key | denied |
| create a fake room | denied |
| read the session / the questions | ALLOWED (needed to play) |
| file a gameReport | denied |

`isOwner(uid)` short-circuits before `_isMiniHost()`, so a student write costs
**no extra rule reads** - which matters when 1000 of them land at once.

**Stated plainly, because it is a real trade:** the questions document holds
the answer key and any joined student can read it, so someone with devtools
could see the answers. That is the same posture as the other seven mini-games.
For an orientation it is fine. It would not be fine for an exam.

## The risk I cannot test, and it is the biggest one

**1000 anonymous sign-ups from one campus network in a few minutes.**

Every join creates a brand new Firebase anonymous account, and a hall full of
people sits behind a handful of shared public addresses - the exact shape
Firebase Auth throttles. No emulator can answer this: the emulator's auth has
no quota.

Two mitigations shipped:

- **Sign-in moved from the Join button to page load.** It now spends the time
  the student takes to read the screen and type a name, instead of firing at
  the same instant as everyone's first write.
- **Retry with exponential backoff plus jitter** on `too-many-requests`,
  `network-request-failed` and `internal-error`: 0.8s, 1.6s, 3.2s, 6.4s, 12.8s,
  each plus up to a second of jitter. Without the jitter every throttled phone
  waits the same interval and returns as one synchronised burst.

**This still needs a rehearsal with real handsets on the venue network.** It is
the one item on this page that measurement cannot close.

## Other pre-flight items

- **Anonymous sign-in must be enabled** in Firebase Console for the project. If
  it is off, every student gets "Anonymous sign-in is disabled".
- **The QR image comes from `api.qrserver.com`**, an outside service. If the
  venue blocks it or it is down, the QR does not draw. The join URL is printed
  underneath and still works, so read the code out. Worth loading the lobby on
  the venue wifi beforehand.
- **Writes:** 1000 joins + 20,000 score writes, all to distinct documents keyed
  by random uid, so there is no hot document and no sequential-id index
  hotspot. Firestore is not the constraint.
- **Cost:** roughly 43,000 reads and 21,000 writes per full game, about 4 US
  cents. Money is a non-issue; the 7,720 wasted reads were a speed problem, not
  a billing one.

## Two parity gaps found while auditing

- **`game-report.js` was not loaded by the AI Quiz** - the only classroom host
  that filed nothing, so its sessions never appeared in Admin - Reports. Now
  loaded and called from `endGame()`, fail-silent like the rest.
- **`refresh-guard.js` was not loaded by the AI Quiz join page** - the only one
  of eight student pages without it, so a stray F5 dropped a student with no
  confirmation. Now loaded, guarded to only protect once actually in a room.

---

# Part 2 - the headers and the background

## The background was three different products

| pages | gradient | floating shapes | particles |
| --- | --- | --- | --- |
| classroom-teacher (Vocab Race / Grammar Race) | yes | yes | **yes** |
| aiquiz, bingo, scramble, tug | yes | yes | no |
| heist, trust, reading, listening | **no** | **no** | no |

Which is exactly the two screenshots. The gradient and shapes are pure CSS and
already lived in `classroom/css/styles.css` that all of them load - four pages
simply never had the markup. The particles were canvas code buried inside
`teacher.js` and `student.js` where nothing else could reach them.

Lifted into `classroom/js/bg-particles.js` and loaded by the eight game hosts.
Identical behaviour (50 dots, same four colours, links under 120px) plus three
guards, since this now runs on the machine driving a projector: it stops when
the tab is hidden, honours `prefers-reduced-motion` with a single static frame,
and throttles resize to a frame. The two original pages keep their own copy and
deliberately do **not** load the shared file, or the canvas would animate twice.

## The header did not fit a phone - on eight pages, not one

Reported as an AI Quiz problem. Measured at 390px, reproducing what
`js/app-settings.js` does to the bar, it is all eight game hosts:

```
Pick a different game 193px + Dashboard 126 + lockup 86 + actions 50
= 475px of content in a 390px box   ->   85px overflow
```

The phone budget in `styles.css` was worked out for the **hub**, whose buttons
are the much narrower "Dashboard" and "Logout". AI Quiz is not special; it is
byte-identical to bingo, scramble and tug.

Fix: the label words are wrapped in `.ll-navtext` and hidden under 620px,
keeping the emoji - the same trade the greeting already makes. Budget after is
about 240px, which clears a 360px phone too. Desktop is unchanged.

| | overflow at 390px | after |
| --- | --- | --- |
| aiquiz, bingo, scramble, tug | 85px | **0** |
| heist, trust | 5-9px | **0** |
| reading, listening | 31-42px | **0** |
| classroom-teacher | 0 | 0 |

## One header shape

Five hosts draw `<header class="header">`: full width, square, bottom rule. The
other four have no `<header>` at all - their chrome is a `.<game>-top` div that
renders as an inset card with 14px corners and each game's private surface
colour. Same job, two objects.

The four now take the five's appearance, **by CSS only**: their ids are bound
by each game's script for the leave-confirmation and `app-settings.js` finds
these bars by class name. Rebuilding the markup would risk four working games
for a cosmetic win.

Qualified as `body .heist-top` on purpose: every game sheet is linked **after**
`styles.css`, so a bare `.heist-top` ties on specificity and loses on source
order. The first attempt did exactly that and measured as no change at all.
Colours come from `--bg-secondary` / `--border-color`, the tokens `.header`
uses, so they match in **both** themes rather than only in light.

Verified by computed style, all nine, both themes: `lightAllSame: true`,
`darkAllSame: true` - radius 0, same background, same 1px bottom border.

## Smaller ones

- **"Pick different game" vs "Pick a different game."** The hub said the first,
  8 times; every game page said the second. Now all say the same.
- **The toast covered the header.** At `top:18px` it landed across the bar and
  sat on the greeting and the settings wheel. Moved to `top:88px` on both toast
  families, which clears the 65-79px header on every one of these pages.

## A measurement error worth recording

The first header re-measurement said the overflow had got **worse** (85 -> 93)
and the restyle had not applied. Both were false: the iframe reused the cached
`styles.css?v=48` because only the HTML was cache-busted, so it measured the
old file. The tell was `.ll-navtext` computing as visible when the rule that
hides it was right there. Every stylesheet URL is now busted per run, and the
probe polls until a value only the new CSS can produce actually appears.

Separately, an earlier run reported aiquiz at 0 overflow and bingo at 85 for
byte-identical markup. That impossibility was the stylesheets not having
finished loading in some iframes. Same fix.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity - **all PASS**
- `classroom-lobby-check.js` failed first on the dashboard label, correctly:
  wrapping the words in `.ll-navtext` broke its literal `🏠 Dashboard` match.
  The checker now allows the wrapper and still insists on the label.
- end-to-end replay with the real rules, 25 students x 5 questions -
  **0 failures**, increments did not race
- bump: styles.css v49 (21 refs), aiquiz-teacher.js v3, aiquiz-student.js v4,
  bg-particles.js v2 (8 refs), CACHE_VERSION v341 -> **v342**; `--check` OK

## Still open

- the venue rehearsal for 1000 real sign-ins, above
- `classroom/js/student.js` (Vocab Race) still has every student read the whole
  players collection at game end - about a million reads at 1000 players. The
  AI Quiz never did this, so it does not affect the orientation.
- 17 places still average `percentage || 0`, unrelated to this pass
