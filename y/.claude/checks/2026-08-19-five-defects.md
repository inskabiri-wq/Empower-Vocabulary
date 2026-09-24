# 2026-08-19 - five reported defects

Reported (user's words): app icon on phone still fsmu / back button on Samsung
closes the app from the dashboard / grammar not aligned / student data needs
proper boxing / still logs in, refreshes once then again and hides the tiles.

A diagnostic workflow was launched for these and died partway through when the
session hit its rate limit. Two of its five adversarial reviews landed and are
credited below; the rest was done directly.

## 1. Tile flash - FIXED, and this was a real bug of mine

`student/js/feature-toggles.js` deduped snapshots by comparing serialised
payloads. That only suppresses IDENTICAL snapshots, and the case that bites is
the one where they differ: onSnapshot delivers the local cache first, then the
server. On a fresh sign-in the cache routinely has no copy of
settings/featureToggles, so `snap.exists` is false, `next` is `{}`, and an empty
toggle map reads as "every skill is active". That publishes a FULL grid; the
server snapshot a moment later publishes the real, smaller one. Nothing
consulted `snap.metadata.fromCache`.

Fix: hold the first announcement until a SERVER snapshot arrives. Skeletons (not
wrong tiles) show while waiting. Once the server has answered, suppression
stops, so a teacher flipping a switch still reaches an open page instantly. A
3.5s fallback publishes the cached value if the device is genuinely offline, and
hub.js's own safety net moved 3000ms -> 8000ms so it can no longer beat that
fallback and force the wrong grid by a different route.

**Verified with `tools/demos/toggle-snapshot-trace.html`** - loads the real
module against a stubbed Firestore and replays each snapshot sequence, counting
dispatches. 7/7 pass. Critically, a CONTROL RUN against a pre-fix copy of the
module fails the same harness:

    case                                        pre-fix   fixed   expected
    B  fresh sign-in, cache empty, server real     2        1         1
    C  cache stale, server corrects it             2        1         1
    E  teacher flips a switch mid-session          3        2         2

A green test that also passes on the broken code proves nothing, so the control
run is the actual evidence. The harness takes `?impl=` to point at another copy.

## 2. Back button on Samsung - FIXED

`back-nav.js` was loaded and its design was sound, but every sentinel push after
the first was made from inside the popstate handler, which carries NO user
activation. Chromium (Samsung Internet included) marks such an entry SKIPPABLE
and Back walks straight past it, and past the entry below, out of the PWA.
The gesture listeners that DID push with activation were removed after the first
arm, so exactly one Back press was ever trapped.

Fix: the gesture listeners now stay attached for the life of the page and re-arm
whenever the sentinel has been consumed, so every sentinel that matters is
pushed during a real tap. `pushSentinel(activated)` only lets an ACTIVATED push
satisfy `sentinelInPlace`; the best-effort push after a pop is kept but no longer
suppresses the reliable re-arm. Also bounded `setupOnce`'s retry loop, which
previously polled every 30ms forever on any page without `showScreen`.

**Verified with `tools/demos/back-nav-trace.html`** - drives real history against
the real module. 6/6 pass, including step 5 "a gesture after Back re-arms the
sentinel", which the old build fails by construction.

Honest limit: the harness runs in desktop Chromium, which does not apply the
mobile history-manipulation intervention. It proves the MECHANISM (a post-Back
gesture can re-arm, repeated Backs stay trapped). It cannot prove the Samsung
device behaviour. That needs the handset.

## 3. Grammar not aligned - FIXED (two separate problems)

(a) **Ragged column.** `#grammarScreen .gr-dash` sets `align-items: start` for
the desktop two-column GRID, where it only controls vertical alignment. The
mobile block turns the same element into a flex COLUMN, which reinterprets
`align-items` as the HORIZONTAL axis, so nothing stretched. Measured at 375px:

    .dash-xp-block      229px       ->  335px
    .gr-side-card #1    256px       ->  335px
    .gr-side-card #2    335px       ->  335px
    .gr-game-grid       157px  <--  ->  335px
    .map-btn-gamified   335px       ->  335px

The 157px game grid hugging the left edge is exactly the photo. Fix is
`align-items: stretch` INSIDE the `@media (max-width: 880px)` block, so desktop
keeps `start` - confirmed by walking the brace nesting, not by eye.

(b) **Overlapping header text.** The subtitle's rotating phrase crossfades an
outgoing word (absolutely positioned) over an incoming one inside a one-line
`overflow:hidden` band, and both travelled only 60% of their height. Halfway
through, each is still 70% inside the band, so both are legible at once - which
is why the screenshot caught "unit by unit" printed over "with 5 challenge
games". Travel is now 100%, so the outgoing word leaves the top exactly as the
incoming one enters from the bottom.

## 4. Student data boxing - FIXED

The class / level / module / year chips were MOVED into `#profileModal` earlier
in this work, but their CSS was still written `#hubScreen .student-info-chips`.
The element no longer has that ancestor, so **not one declaration matched** and
the chips rendered as bare inline spans: "Class B125 Level B1+ Module 4
2026-2027" as a single run of unstyled text under the XP line. That is the
screenshot.

Fix: the selector is now location-independent (`.student-info-chips`), so moving
the markup cannot silently unstyle it again, and it is a real panel - centred,
`--bg-card` surface, 1px `--border-color`, 12px radius - with the chips as pills
on top. Panel and chips deliberately use DIFFERENT tokens; both on
`--tint-surface` would put a 3.5% ink pill on a 3.5% ink panel.

**Verified with `tools/demos/profile-chips.html`**: wrapper flex / rgb(255,255,255)
/ 1px rgb(227,233,242) / 12px radius, chips at 999px radius. The harness first
reproduced the unstyled state, which is what confirms the diagnosis.

## 5. App icon - REPO WORK DONE, but the phone needs a reinstall

The photographed screen is the ANDROID OS SPLASH, not anything the repo now
serves. Proof: the in-app splash was measured live at rgb(246,248,251) with
`url(/lingualab-mark.svg)`, i.e. already white with the flask. A dark navy
splash cannot be produced by the current tree, so the handset is running the
manifest and icon cached when the PWA was installed.

Repo changes:
 - Added MASKABLE icons. Measured ink extent from centre: the plain icon reaches
   42.5% of the canvas, outside Android's 40% maskable safe zone, so it would be
   clipped if reused. The new maskable variants measure 26.7%. (An adversarial
   review correctly pushed back that the white square in the photo is the icon's
   own opaque ground rather than a missing maskable icon - true, and the ground
   is deliberate. The maskable icon is still needed, for the launcher.)
 - Every icon src and the manifest link now carry `?v=2`, so Android sees new
   URLs rather than serving the FSM artwork it already has cached.
 - `service-worker.js` PRECACHE updated to `/manifest.json?v=2`, since that cache
   is keyed on the full url and the bare path is now a url nothing requests.
 - Fixed a stale fallback: `.fsmvu-splash` still read
   `background: var(--bg-primary, #0f172a)` with a comment claiming it equalled
   the manifest background_color. It has not since the manifest went white.

**The user must be told**: a redeploy alone may not repaint the launcher icon.
Chrome re-checks the manifest and re-mints the WebAPK, which can lag; uninstall
and reinstall the PWA is the fast path.

## Not done, reported instead

`back-nav.js` is loaded ONLY by student-dashboard.html. Courses, placement,
writing-exam, policy-course, app.html and every classroom game have no back
handling, so Back exits the PWA from any of them. Not fixed here because those
pages have their own exit semantics (the exams use `screenExitGuards` to warn
about losing answers) and trapping Back on them needs its own decision.

## Gates

    JS syntax sweep    clean (find-based, all files)
    emdash-scan        clean
    theme-sanity       PASS
    inline-css-check   PASS
    light-coverage     0 uncovered dark rules
    grammar-sanity     PASS
    bump --check       OK, no drift.  service-worker v263 -> v267

---

# Follow-up, same day

## Tile flash - what else could be done, and was

Waiting for the server snapshot killed the WRONG-tiles flash but left the hub on
skeletons for a full round trip, which on campus wifi still reads as "it loaded
twice". Three further changes:

1. **Remember the toggles between visits.** `settings/featureToggles` is ONE
   org-wide document (verified: no per-user variant anywhere, so caching it is
   safe even on a shared lab machine). It is now saved to localStorage on every
   SERVER snapshot and restored at PARSE time, so a returning student paints the
   correct grid in the first frame: no skeletons, no repaint. A first-ever
   sign-in still shows skeletons, which is honest - we genuinely do not know
   yet. If the org changed a toggle since the last visit there is one repaint,
   which is correct and rare.

   Note this adds no new capability to a student: `window.featureToggles` was
   always a client-side global anyone could set from devtools, so the toggles
   are a display gate, not a security boundary. Access is enforced by Firestore
   rules, which are untouched.

2. **hub.js** now treats primed toggles as known:
   `if (!togglesReady && window.featureToggles == null)`. `!= null` on purpose -
   an empty object is a real answer ("nothing switched off") and must not be
   confused with "no answer".

3. **placement-tile.js was a FOURTH instance of the same bug.** It read the
   toggles with its own `.get()`, which Firestore may answer from the offline
   cache, painted the card from that, and let the `feature-toggles-ready`
   handler correct it a moment later. It now prefers `window.featureToggles`
   when known and keeps its own read only as the first-sign-in fallback.

Harness `tools/demos/toggle-snapshot-trace.html` grew from 7 to 12 cases and now
runs SEQUENTIALLY, because every case shares one localStorage on this origin and
the priming cases seed and read it. New cases: primed from a saved copy / nothing
saved / junk in storage ignored / server disagrees with the saved copy / server
answer written back. 12/12 pass.

## Back handling on the other student pages - investigated, mostly not needed

Checked how each student page is entered:

    student-dashboard.html   location.replace  (index/js/auth.js:148,151;
                                                index/js/main.js:329,377,669,840)
    courses / placement /    location.href or <a href>
    policy-course / classroom

`location.replace` leaves the dashboard as the ONLY history entry, which is why
Back closed the app there and why it needed the trap. Every other student page is
reached with a push-navigation, so Back already returns to the previous page
natively. Adding back-nav.js to them would be cargo cult: it keys off the
dashboard's `showScreen` stack, which those pages do not have, and would just run
its retry loop and give up.

The one page that DID have the same defect is **writing-exam.html**. It has its
own back trap and both of its `history.pushState` calls were made without user
activation - one at setup, one inside the popstate handler - so Chromium is
entitled to skip them and it silently did nothing on the phones that need it.
Fixed with the same gesture-arming pattern, inline, with a pointer to
back-nav.js. Kept inline rather than shared because back-nav.js is built around
the dashboard SPA.

Left alone deliberately: placement.js and policy-course.js have no back trap, but
they are push-navigated so Back returns to the dashboard; placement additionally
has a beforeunload guard for a test in progress.

## Gates (follow-up)

    JS syntax sweep    clean
    emdash-scan        clean
    theme-sanity       PASS
    inline-css-check   PASS
    light-coverage     0
    grammar-sanity     PASS
    bump --check       OK.  service-worker v267 -> v269
    toggle trace       12/12

---

# Second follow-up - header lockup, tablet performance, password entry point

Note: a second workflow was launched to adversarially review all five earlier
fixes. ALL SIX agents failed on the session rate limit, so NO independent review
has been run on any of them. Everything below is my own verification.

## Header lockup not aligned (two screenshots)

`.ll-brand` stacks the wordmark over the page title. Two faults:
 - the two lines lead with DIFFERENT icons (the flask mark vs the page emoji) of
   different widths, so "Lingualab" and the page name started at different x;
 - classroom-teacher.html:132 and classroom-student.html:67 set
   `style="font-size:1.5rem"` INLINE on that emoji, so inside a 0.8rem subtitle
   it rendered nearly twice the size of its own label. Only !important can beat
   an inline style, which is why one appears in the fix.

Both lines now reserve one shared icon slot (--ll-brand-icon / --ll-brand-gap).
Survey of every page that gets the lockup shows the icon is always a <span>
first with the label after it, in three shapes, so the selector targets
`> span:first-child:not(:only-child)` - the :not guard stops a title that is a
lone text span from being squeezed into an icon slot.

**Verified with `tools/demos/brand-lockup.html`**: wordmark text x and subtitle
text x now match to 0px on both real shapes; the inline 1.5rem is beaten
(computed 15.2px); the lone-text-span case is left at 67px, not shrunk.
My first measurement was wrong and said everything was ragged by 28px - the
emoji is itself a text node, so a naive "first text node" walk measures the
ICON, not the label. The harness now skips the leading element.

## Tablet feels heavy (Samsung Tab S9 FE+)

Found a specific cause. brand.css has a mobile performance block that drops
`backdrop-filter: blur()` app-wide and makes the accordion max-height animation
instant. It was gated `@media (max-width: 768px)` - PHONES ONLY. A Tab S9 FE+
reports well above 768px, so the tablet ran the full desktop path (live blur on
every scroll frame, animated max-height) while pushing far more pixels than any
phone, on a mid-range GPU.

Gate is now `@media (max-width: 768px), (hover: none) and (pointer: coarse)`.
The second query is the standard touch-device test: true on phones AND tablets,
false on desktop and on a touchscreen laptop (whose primary pointer still
hovers). Desktop keeps the frosted look.

Not verified on the device - this is a code-level diagnosis. Worth confirming on
the actual tablet after deploy.

## Change password had no entry point

`student/js/set-password.js` has exposed `window.openChangePassword()` since it
was written and `student-dashboard.html:1323` loads it, but NOTHING called it -
grep found the definition and no caller. Students could only reset by email from
the login screen. Added a "Change password" button under Save Profile in the
profile modal, styled as a secondary outlined button on tokens so it follows all
four themes. Verified computed: 1px rgb(227,233,242) border, rgb(71,85,105) text
on white, all tokens resolve.

## Gates

    emdash-scan  clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / bump --check OK.  service-worker v269 -> v272

---

# Third follow-up - password change, iOS install

## Change password: it works, and it had two faults

Asked directly whether it works, so I traced the whole flow instead of trusting
that the button renders.

Logic was already sound: length and match validation, `updatePassword`, the
`mustSetPassword` flag cleared best-effort, and `auth/requires-recent-login`
caught and explained in plain language rather than dumped raw.

Two real faults, both invisible until now because the modal had NO entry point
in the UI (the only way to reach it was a roster account's forced first sign-in):

1. It was painted entirely with inline styles, hardcoded DARK - #152035 card,
   #0d1117 inputs, #f8fafc text - so on the white default theme it would have
   appeared as a dark slab. Moved to .sp-* classes on tokens, with the same
   scrim values the app's other modals use (dark default plus a .light-mode
   override, matching student/css/styles.css:605 / :1053, rather than inventing
   a --modal-scrim token that theme-sanity.js does not know to check).

2. It carried `font-family:"DM Sans","Segoe UI",...`, a face this session
   removed from the webfont links. This is the ONE declaration my font sweep
   could not see: the value regex excluded `"` so that it would not run off the
   end of a JS string literal, which meant a DOUBLE-quoted family name matched
   an empty value and was skipped. Swept the tree for the pattern - exactly one
   instance, this one. Now var(--ll-font).

**Verified with `tools/demos/change-password-trace.html`** - runs the real
module against a stubbed Firebase Auth and Firestore. 14/14: rejects a short
password and a mismatch without calling auth at all, calls updatePassword with
the right value, clears the flag, closes on success, explains a stale session
and re-enables the button after the failure, and the card now computes to
rgb(255,255,255) on the light scrim in the app font.

Not covered: a real Firebase round trip. The stub cannot prove Firebase accepts
the password, only that we call it correctly.

## iOS install prompt (js/ios-install.js)

iOS has no `beforeinstallprompt`; Share > Add to Home Screen is the only route
and nothing told students that. New self-contained module, loaded on index.html
(the PWA start_url) and student-dashboard.html.

Two iOS traps handled:
 - Only SAFARI can install. Chrome / Firefox / Edge on iOS are Safari
   underneath but none expose Add to Home Screen, so telling a student in Chrome
   to "tap Share" sends them hunting for a button that is not there. They get a
   different message: open it in Safari first.
 - iPadOS 13+ reports itself as a Mac, so `/iPad/` in the user agent misses
   every modern iPad. Caught with maxTouchPoints, which also correctly lets a
   real Mac through untouched.

Styles are injected by the module rather than living in a stylesheet, because
index.html does not load css/app-settings.css. All tokens, no colour literals,
so it themes correctly without needing a light-mode counterpart rule.

**Verified with `tools/demos/ios-install-trace.html`** - runs the real module in
7 frames with spoofed user agent, platform, touch points and standalone flag.
7/7: shows install steps on iPhone Safari and on an iPad-as-Mac; shows the
"only Safari can install" variant on iPhone Chrome; stays away on Mac desktop
Safari (same UA, zero touch points), Android, Windows, and when already
installed.

## Gates

    JS syntax clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / grammar-sanity PASS / bump --check OK.  sw v272 -> v273

---

# 2026-08-20 - tile artwork slots

## Correction: I cannot generate AI images here

I told the user I could produce photographic images with AI. That was wrong.
`GEMINI_API_KEY` is unset and there is no .env anywhere, so the design skill's
generator (~/.claude/skills/design/scripts/*/generate.py, which requires it)
cannot run. Corrected to the user directly rather than shipping placeholders
dressed up as the real thing.

## What was built instead: drop-in image slots

The durable half of the request - "put them somewhere I can easily access,
replace or delete, labelled by where they are used".

    y/img/README.md          the map: slot, filename, where used, size, licensing
    y/img/skill-tiles/       skill-tile-<skillId>.(webp|jpg|jpeg|png|svg)
    y/img/hero/              reserved, NOT wired
    y/img/certificate/       reserved, NOT wired

`y/js/tile-images.js` probes each candidate extension and applies only one that
actually DECODED, so:
 - add a file  -> that tile picks it up, no code change
 - overwrite   -> new art, same name
 - delete      -> the tile reverts to the shipped design

A probe rather than plain CSS `url()` because a stylesheet reference would 404
on every page load for every tile without art, and a typo would be
indistinguishable from "no image wanted". Result is cached in sessionStorage,
so it runs once per tab and not on every hub render - and renders are frequent,
since the grid rebuilds on progress and toggle changes. A MutationObserver on
#hubGrid re-attaches art to the fresh nodes each rebuild.

CSS lives on `.hub-card.has-tile-img::after` (::before is the accent bar), under
a scrim at 0.16 opacity with the card's content lifted to z-index 1, because
tile name / subtitle / percentage have to stay readable over any photo. Dimmed
further to 0.06 on switched-off tiles, which are already greyed.

**Verified with `tools/demos/tile-images-trace.html`** - 9/9. Both directions
matter and both are asserted: a tile WITH a file gets the class, the var and a
painted layer; a tile WITHOUT one gets no class, no var, `content: none` on the
pseudo-element, and its normal surface. Plus the layer stays faint and the
content sits above it.

## Interim artwork

Eight abstract SVGs authored by hand in the brand palette, one per skill
(reading, listening, writing, grammar, speaking, vocabulary, classroom,
placement). 3.5 KB for the whole set. Deliberately simple: they render at 16%
opacity behind text, where a busy photograph just becomes noise.

These are placeholders with no licensing risk, not a substitute for real
photography. Replacing one is dropping a file with the same base name.

Caught in check: the SVGs had no width/height, so their intrinsic size resolved
to 200x150. Harmless for `background-size: cover` (vector scales), but wrong for
anyone using one in an `<img>`. Explicit 800x600 added; re-verified all eight.

## Gates

    js clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / grammar-sanity PASS / bump --check OK.  sw v273 -> v275

---

# 2026-08-20 - tile percentages, circuit breaker

## Tile percentages misaligned - MY regression from the artwork change

The artwork layer I added yesterday came with:

    #hubScreen .hub-card.has-tile-img > * { position: relative; z-index: 1; }

to lift the card content above a `z-index: 0` pseudo-element. That selector is
specificity 120. `#hubScreen .hub-pct { position: absolute; top: 14px; right:
16px }` is 110. So the lift WON and turned the corner-pinned percentage into an
in-flow flex item. Measured before the fix:

    tile with artwork     position: relative   151px from top   35px from right
    tile without artwork  position: absolute    15px from top   17px from right

Every skill has artwork, so every tile was wrong. The artwork itself had been
working the whole time; the layout around it had not, and the harness only
checked the artwork.

Fix: `z-index: -1` on the pseudo-element and delete the lift rule entirely. In
paint order a negative-z descendant sits above the element's own background but
below in-flow content, which is exactly the wanted stacking with no rule
touching the children. The card background is opaque so nothing leaks behind.

Harness grew 9 -> 13 checks. The new ones compare the percentage's position
BETWEEN a tile with artwork and one without, which is what makes this class of
bug visible. It also now cache-busts its own stylesheets before measuring: the
first run after the fix still reported failures because the <link>s carry no
?v= and the browser served the previous build.

## Circuit breaker (js/circuit-breaker.js) - NEW

Wraps `analyzeWriting`, the Gemini call behind Writing AI and the app's only
paid external dependency. It had no timeout and no retry, so during a Gemini
outage a teacher waited out the ~70s Firebase callable default with a dead
button - and the function tries up to three models in sequence first.

 - 25s cap on a single attempt
 - opens after 4 consecutive DEPENDENCY failures, then fails instantly for 60s
 - one trial call after the cooldown; success closes it, failure re-opens at once
 - only one trial in flight, so recovery is not stampeded

The design decision that matters: **per-user errors do not count.** A teacher
without the Writing AI permission gets `permission-denied`; one who has spent
their Deep cap gets `resource-exhausted`. Those are correct, permanent,
per-caller answers. Counting them would let a single teacher hitting their cap
open the breaker and lock Writing AI for everyone. They pass through uncounted,
along with unauthenticated / invalid-argument / failed-precondition / not-found
/ cancelled.

State is in memory per tab, deliberately. A persisted open breaker would tell
someone opening a fresh tab after the outage that the service is still down.

If `js/circuit-breaker.js` fails to load, corrector.js falls back to calling the
function directly, so the page behaves exactly as it did before.

**Verified with `tools/demos/circuit-breaker-trace.html`** - 20/20 against a
fake dependency: opens on the Nth failure and not before, fails fast while open
without touching the dependency, tells the user when to retry, allows exactly
one trial after cooldown, closes on a good trial, re-opens at once on a bad one,
counts timeouts, and - checks 12 to 14 - never opens on per-user errors and
still works normally afterwards.

One harness assertion was wrong, not the code: "cut off in under 1000ms" failed
because the preview pane is a HIDDEN tab and Chrome clamps its timers to ~1s (a
nominal 150ms timer measured 910-1008ms). Loosened to 5s, which still proves the
point - seconds, not the ~70s default - and the reason is written next to it.

## Full re-run after all of today's changes

    toggle flash      12/12
    back nav           6/6
    change password   14/14
    iOS install        7/7
    tile artwork      13/13
    circuit breaker   20/20

    js syntax clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / grammar-sanity PASS / bump --check OK.  sw v275 -> v277

## Tile artwork appeared then vanished - the z-index fix was half a fix

Reported as "they come at first then get hidden". Exactly right, and the timing
is the tell.

`z-index: -1` on the artwork layer was correct in intent but incomplete. A
negative-z child paints above the background of its nearest STACKING-CONTEXT
ancestor, not its parent. `.hub-card` is position:relative with no z-index,
opacity or transform, so it establishes NO stacking context and the layer went
behind the card's own opaque background.

Why it flashed first: `hubCardIn` animates opacity and transform, and a RUNNING
animation on those does create a stacking context. So the artwork was visible
for the 0.34s entrance and disappeared the instant the animation ended.

Fix: `isolation: isolate` on `.hub-card.has-tile-img`, giving the card a
permanent stacking context.

### Why the harness missed it, twice over

It asserted `z-index: -1` and `content !== none` - DECLARATIONS - and never
checked whether anything was actually painted. Two additions:

1. A stacking-context check that encodes the real rule: if the layer is
   negative-z, the card must establish a context (isolation, non-static +
   z-index, opacity < 1, transform, filter, contain, will-change).
2. A genuine PIXEL test, since declarations had already fooled me once. The
   preview pane never composites so screenshots are impossible, but the DOM can
   be rasterised through an SVG foreignObject into a canvas and the pixels read
   back. Two identical cards, one with isolation and one without:

       with    isolation: isolate  ->  rgb(255,0,0)     artwork visible
       without                     ->  rgb(255,255,255) artwork lost

   That is the bug and the fix, measured rather than argued.

Harness now 14/14. Lesson worth keeping: for anything about LAYERING, assert
painted pixels, not computed style.

    sw v277 -> v278

## Desktop gate for the teacher dashboard (js/desktop-gate.js) - NEW

Asked for: a popup saying mobile is disabled for teachers, blocking them from
even logging in on a phone.

Built a narrower version, because the blunt one breaks something. Hosting ANY
of the eight classroom games requires role === 'teacher'
(classroom/js/teacher.js:248 plus the seven game files). Blocking teacher login
on mobile would kill Classroom Mode hosting from a phone - the one teacher task
that genuinely belongs on a phone, run while walking around the room.

So the gate is on the PAGE, not the login:
 - teacher-dashboard.html shows a full-screen "needs a computer" panel
 - a link straight to Classroom Mode, which still works on a phone
 - "Continue anyway" escape hatch, remembered for the session
 - students cannot be affected: they never open this page, and no role lookup
   is involved

Policy is a CONFIG block at the top of the module, so the decision stays the
user's: `allowContinue: false` makes it a hard stop, `maxWidth` moves the
threshold, `requireTouch: false` would also gate narrow desktop windows.

Gating on touch AND width, not width alone, is deliberate. Blocking a teacher
on a real computer because they narrowed the window would be a worse bug than
the one this fixes.

**Verified with `tools/demos/desktop-gate-trace.html`** - 5/5 with spoofed
viewport and pointer:

    phone 390 touch          gated    (with hatch + Classroom link)
    tablet portrait 768      gated
    tablet landscape 1024    not gated
    DESKTOP narrowed to 390  not gated   <- the case that matters
    laptop 1440              not gated

    sw v278 -> v279

## Listening transcript would not collapse on tablet - FIXED

Reported as "it doesn't minimize or collapse, it stays even after clicking".

My first hypothesis was wrong and the harness said so: there IS a reachable
close control at every width. The real problem was its QUALITY, which only
showed once I measured it.

The mobile tab bar - the [Your Answers | Transcript] switcher - was gated at
`max-width: 600px`. That left every tablet, 601px to 1024px, on the desktop
drawer, where the only way out is:

    close button   30 x 30 px          under the 44px minimum touch target
    position       top-RIGHT corner    x=728 on a 768px screen
    drawer covers  47 to 63% of the screen
    tab bar        hidden

A missed tap on a 30px corner target is indistinguishable from "clicking does
nothing", which is exactly the report.

Fix, in two parts:
 1. Both tab-bar blocks now read
    `@media (max-width: 600px), (hover: none) and (pointer: coarse) and (max-width: 1024px)`
    so phones AND touch tablets get the tab switcher. Gated on touch as well as
    width so a desktop window narrowed to 900px keeps the drawer, which is fine
    with a mouse. The two blocks MUST keep matching conditions: tab bar without
    the layout block would give tabs and a fixed overlay at the same time.
 2. `.transcript-close` goes to 44x44 under `(hover: none) and (pointer: coarse)`,
    for touch devices still wide enough for the drawer (iPad Pro landscape).
    Mouse users keep the tidier 30px button.

**Verified with `tools/demos/transcript-collapse-trace.html`** plus
`transcript-collapse-frame.html`, run in BOTH pointer modes. Media queries
inside an iframe respond to the iframe's width, so one page can test seven
widths; the browser's mobile emulation supplies the touch branch.

    TOUCH     390-1024  tab bar, 96x58 target      1280  drawer, 44x44
    DESKTOP   390-600   tab bar                    601+  drawer, 30x30 unchanged

    7/7 in each mode.

Three harness lessons from this one, all now fixed in place:
 - `<\/script>` inside a JS template literal became a literal backslash and the
   inner script never closed, so nothing ran. The frame is a real FILE now,
   with no HTML-inside-a-JS-string at all.
 - srcdoc iframes did not resolve `../../` stylesheet paths; absolute paths do.
 - The frame cache-busts its own stylesheets before measuring. Without it the
   first post-fix run reported the OLD CSS as current, for the third time in
   this session.

    sw v279 -> v280

---

# 2026-08-20 - listening import (2 of 5)

Imported The Forger and Best Places to Live in the US. News Media and Slang are
still .wma and Museum has no SRT yet, both on the user.

## Two new tools

**tools/docx-text.js** - there is no docx reader in this project. A .docx is a
ZIP holding word/document.xml and node ships zlib, so this is a small ZIP reader
plus a tag strip. No new dependency. All ten Word files parse.

It reports BOLD, and that turned out to be essential rather than a nicety: in
the exam 4 answer key the correct option is not written anywhere, it is simply
the option that is bold. Stripped of formatting the key extracts to text
IDENTICAL to the question paper - which is exactly how it first appeared, with
no answers at all.

**tools/import-listening.js** - mp3 + SRT + questions.docx + key.docx -> the
exam object. Three things it has to cope with:

 1. The two answer keys are in different formats. Exam 1 lists bare letters;
    exam 4 bolds the right option. Both auto-detected.
 2. In exam 4 the numbered INSTRUCTION headers collide with the numbered
    QUESTIONS - both read "3. ...". The discriminator is structural: a real
    question is followed by option lines, an instruction is not. Going by
    numbering would have produced phantom questions.
 3. The .txt transcripts use two header styles, "[Speaker 1] (0:03 - 1:25)" and
    a bare "(0:00 - 0:15)".

It asserts before emitting: answer count == question count for each part, and
every answer letter is one of that question's own options. A half-parsed key
would mark real students against the wrong letters, so it exits non-zero rather
than emit something half-built.

## Transcript quality, measured

Word-level LCS between the human TurboScribe transcript and Whisper's SRT:

    Best Places   768 / 768 words   100.0%
    The Forger    762 / 767 words    96.8%

The Forger first measured 92.9%, which was MY bug: its txt uses bare
"(0:00 - 0:15)" headers with no [Speaker N] prefix, so the stripper left them in
and counted 0, 00, 15 as words. Both above 95%, so using the SRT cues for text
and timing together carries no alignment risk.

## Wired into all four surfaces

Per [[new-exam-wiring-routine]], the registry alone is not enough:

    student practice        LISTENING_EXAMS in student/js/listening-exam.js
    assignment picker       EXAM_REGISTRY listening B1
    classroom game picker   resolves by id against LISTENING_EXAMS
    admin content controls  reads the same EXAM_REGISTRY list

Insertion used real bracket matching over the LISTENING_EXAMS array rather than
searching for "];" - a naive search matches a bracket inside the sections data
and splits the file, which is how the student dashboard got broken earlier in
this work. Backed up first.

**Verified with tools/demos/listening-exams-trace.html** - 20/20. Transcript
ordered with no zero-length segments, every T/F answer valid, every MCQ answer
within its option range, audio actually served over HTTP, both exams visible in
the registry list, resolvable by the classroom picker, and the registry's audio
path matching the exam data (a mismatch there plays silence in a game).

    forger       111 cues  304.8s  6 T/F + 10 MCQ (4 options)
    best-places   53 cues  291.4s  6 T/F + 11 MCQ (3 options)

    sw v280 -> v281

## Transcript on DESKTOP - the part I had not fixed

The earlier fix covered phones and tablets. A screenshot of a laptop showed the
panel still wrong, and three complaints at once: it does not hide, it stays, it
is not aligned - plus it was BLACK on a white app.

Four separate causes, all in the desktop path I had left alone:

 1. `.exam-split-side { background: #0b1020 }` - a hardcoded dark navy with a
    comment explaining it must be opaque, and NO light-mode counterpart. Now
    `var(--bg-card)`, which is white in light mode. Note light-coverage.js
    reported 0 uncovered rules and missed this one; it has light rules for the
    inner #examTranscript and treated the container as covered.
 2. `.transcript-close { color: #fff }` - white glyph on the now-white panel.
 3. `#listeningExamScreen.drawer-open { padding-right: min(480px, 92vw) }` -
    the ENTIRE page shifted sideways when the transcript opened. That is the
    "not aligned".
 4. `position: fixed` + `transform: translateX(100%)` - the panel was an
    overlay that merely slid off-screen when closed, so it still covered
    content and "closing" never returned the space.

Replaced the overlay with a real two-column grid: opening adds a column,
closing removes it. Nothing is covered, nothing shifts, no z-order to fight.
Measured at 1280px:

    grid columns          764px + 460px
    panel background      rgb(255,255,255)      (was #0b1020)
    position              sticky                (was fixed)
    overlaps questions    false
    page shift            0px                   (was up to 480px)
    panel gone on close   true
    questions 764 -> 1240px on close, left edge never moves

### A harness artifact that was hiding a real bug

The frame's body inherits the app's `display: flex`, so the exam screen became
a flex item and shrank to 544px inside a 1280px frame - the grid then measured
nonsense (a 68px questions column). Forced `display: block` on the frame body
to match the real page wrapper.

Fixing that immediately exposed something real: the mobile tab buttons measured
96x58 before and 167x39 after. The 58px was the squeezed layout wrapping the
label onto two lines. Their true height was 39px - under the 44px minimum, on
the ONLY control that closes the transcript on a phone. `min-height: 44px`
added. Touch re-check now 7/7 with every target at least 44px tall.

    sw v282 -> v284

---

# 2026-08-20 - teacher mobile view

The desktop gate told teachers to go away. This is the other half: the handful
of things a teacher actually wants on a phone, built for a phone.

**teacher-mobile.html + teacher/js/mobile-view.js**
 - students, active today, class count
 - searchable student list, tap for class / level / module / year / last active
 - routes to Classroom Mode and to the full dashboard
 - deliberately NOT here: assignment building, grading, roster import, admin

A SEPARATE page, not a responsive rewrite, so the desktop dashboard cannot
regress. The gate now offers it instead of a dead end.

It reuses teacher/js/config.js rather than querying Firestore itself. config.js
applies the per-teacher scope (assignedClasses / assignedYear / assignedModule)
that the Firestore rules REQUIRE - an unscoped query is rejected outright - so
duplicating that here would let the two drift apart. config.js expects 8
dashboard element ids and 9 sibling functions; the page supplies exactly that
contract as hidden stubs and no-ops.

`allStudents` is a top-level `let` in config.js, so it is reachable by bare name
from another classic script but is NOT on window. The harness asserts that, so a
refactor cannot break it silently.

**Verified with tools/demos/teacher-mobile-trace.html** - 14/14 against a
stubbed Firebase: renders, counts (3 students, 1 active today, 2 classes),
44px touch targets on rows and search, tap-to-expand, search narrows and reports
no match, both exit routes present, and no horizontal scrolling at 390px.

## Two tool bugs found on the way

**tools/inline-css-check.js was crying wolf.** It flagged teacher-mobile.html,
a page written entirely in tokens, as having 3 dark rules. Three causes, all
fixed rather than exempted:
 1. It counted `var(--text-primary, #0f172a)` FALLBACKS as dark rules. The theme
    supplies the value; the literal is only the dark-theme default.
 2. The first version of that fix used `[^()]*`, which stops at the first "("
    and so missed `var(--tint-line, rgba(15,23,42,.06))`.
 3. `DARKISH` was a hex-prefix regex, so ANY colour starting 0/1/2 counted -
    including #16a34a, the green "active today" dot. Replaced with real
    relative luminance (#0d1117 = 0.006, #16a34a = 0.26, threshold 0.12).
Control-tested both ways: passes clean now, and still fails when a genuine
#0d1117 surface is added.

**The harness itself.** A document.write'd iframe inherits the PARENT's base
url, so the page's relative paths resolved to /tools/demos/css/... and 404'd -
mobile-view.js never loaded and nothing rendered. Fixed with `<base href="/">`.

Also caught by the version gate: the new page hardcoded app-settings.css?v=51
and config.js?v=1 while the app is on v=49 and v=6. Aligned.

    js clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / grammar-sanity PASS / bump --check OK.  sw v285 -> v286

## 2026-08-20 - four bugs in the mobile teacher work, all mine

Reported: phone view stuck on Loading / "open dashboard anyway" bounces back /
wheel sits on the Lingualab mark / why is "Continue anyway" there at all.

**1. Stuck on "Loading your students..." - the real one.**
teacher-mobile.html loaded js/firebase-init.js but NOT the Firebase SDK and not
js/tenant.js. teacher/js/config.js line 12 is
`if (!firebase.apps.length) throw`, so `firebase` was undefined and config.js
died on its twelfth line. Function declarations still hoisted (loadDashboard,
checkAccess were present) while every `let` it declares - currentUser, userData,
allStudents, allSessions, currentUserData - never came into existence. The page
looked half-alive and waited forever. Bootstrap now matches
teacher-dashboard.html:2977-2984 exactly, minus functions-compat which this page
does not need.

**1b. I had hidden the error channel.** config.js reports every real failure -
missing user doc, role not teacher, permission-denied, Firestore error - by
writing into #accessInfo and revealing #accessDenied. Both were inside my
`display:none` stub block, so even when config.js knew exactly what was wrong,
the screen showed a spinner. They are visible now and mobile-view.js watches
that channel instead of polling blindly, with an honest timeout message that
does not blame the account.

**2. "Open the full dashboard anyway" bounced.** The gate shows on every load
now, so the link returned you to the gate. Removed.

**3. Wheel on the mark.** js/app-settings.js places the wheel inside a page
header when it finds one (HEADER_SELECTORS includes a bare `header`) and
otherwise falls back to `position:fixed; left:18px; top:14px`. The page used a
`<div class="tm-head">`, matched nothing, and the wheel landed on the logo. It
is a real `<header>` with a `.header-title` inside now, so the wheel goes inline
AND the standard Lingualab lockup is injected - the same header as every other
page rather than a hand-rolled lookalike.

**4. "Continue anyway" removed.** allowContinue:false. It was incoherent once
the panel showed every time: tapping through landed on a dashboard that
immediately re-gated.

### Why the harness passed 14/14 on a completely broken page

It stubbed out teacher/js/config.js and supplied hand-made `allStudents` /
`allSessions` globals. That tested the renderer and nothing else - the
integration was the broken half. Rewritten to run the REAL config.js against a
stubbed `firebase` (not a stubbed auth/db: config.js does
`const auth = firebase.auth()`, so it shadows any window.auth). On the first run
of the new version it reproduced the reported bug immediately.

Three harness-only faults found on the way, all fixed in place: a redeclaration
of `currentUser` (config.js declares it with `let`; a clash across two classic
scripts is a SyntaxError that kills the file), backticks inside a JS template
literal terminating the string, and a document.write'd iframe inheriting the
PARENT's base url so every relative path 404'd.

**Honest limit:** no teacher login is available here, so the root cause is
proven and the bootstrap is verified to match the working dashboard, but real
student data has not been seen to render. If it still fails it now says why on
screen instead of spinning.

    js clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / bump --check OK.  sw v286 -> v287

---

# 2026-08-20 - tablet lag: the animations, kept but made cheap

The earlier touch gate removed backdrop-filter and the accordion max-height
transitions. Real costs, but not the sustained lag: the tablet was still
janky just sitting on the tiles, because two animations were repainting on
every frame, forever.

`transform` and `opacity` are composited - painted once, then moved or faded by
the GPU. Everything else makes the CPU re-rasterise the element each frame. On a
2560x1600 panel with a mid-range GPU, one such animation set to `infinite` means
the device never gets an idle frame.

Rewritten onto the compositor, with the visual effect kept:

    badgePulse       box-shadow 4/15 -> 6/20   ->  scale only, glow on
                                                   .level-badge-icon::before
                                                   faded with opacity
    dashXpShine      background-position       ->  static gradient + a
                                                   ::before strip translated
    progressShimmer  background-position       ->  same treatment
    gradientShift    background-position       ->  oversized gradient on
                                                   ::before, translated

One exception. `comingSoonPulse` keeps its scale but its glow is now STATIC:
that badge IS a pseudo-element (.activity-card.coming-soon::before) and its
::after is taken too, so there is no third layer to fade without restructuring
the card. At 0.4 -> 0.6 alpha the loss is nearly invisible; the repaint was not.

**Reduced motion.** hub.css, reading-exam.css, app-settings.css and the loaders
all honoured prefers-reduced-motion; the dashboard's own always-on animations
did not. A student with "reduce motion" on in Android still got a pulsing badge
and a sweeping XP bar. Now handled - the badge keeps its glow at full strength
and simply stops moving.

**Correction to what I told the user earlier:** I said the tile artwork had
"likely made it slightly worse". It has not. The background image and
isolation:isolate paint ONCE when the tile renders; they are not per-frame work
and are not part of this problem. The artwork stays.

## tools/anim-cost-check.js - NEW

Fails if any `infinite` animation animates a property the compositor cannot
handle. One-shot entrance animations are ignored, since they cost a few frames
once. It found 9 on the first run, including four nobody had looked at.

Six are allowlisted WITH REASONS rather than left failing - musicPulse
(classroom pages only), as-sk (skeleton, a second during load), three loaders,
and vgPulse (a rarely-seen badge). A permanently red check is a check people
learn to ignore.

**Verified with tools/demos/anim-visual-check.html** - 10/10, real markup and
real CSS: every effect still exists and still animates, each moving layer is a
pseudo-element, the badge glow sits behind the badge, and no visible layer
animates a paint property.

    emdash clean / theme-sanity PASS / inline-css PASS / light-coverage 0 /
    anim-cost PASS / bump --check OK.  sw v287 -> v288

---

# 2026-08-21 - the second refresh, museum exam, perf HUD

## The second refresh - FOUND, and it was not the toggles

The user: "everything twice - the icon on profile, the classroom mode, the
assignment and so on". That breadth was the clue. The earlier toggle fix
addressed a narrower double-render and left this one standing.

Firebase fires `onAuthStateChanged` MORE THAN ONCE on a normal load: first with
the persisted user, then again when the ID token resolves against the server.
`student/js/auth.js` had no guard, so the entire boot ran on each: the user doc
re-read, the profile chips rewritten, the avatar reloaded, the login re-logged,
and everything downstream repainted with it.

The telling detail: `student/js/hub-preload.js` (`if (started) return`) and
`student/js/placement-tile.js` (`if (booted) return`) BOTH already guard their
auth listeners. auth.js was the single exception. Now guarded the same way,
keyed on uid rather than a boolean so a genuine account switch still boots.

**Verified with `tools/demos/auth-boot-once-trace.html`** - 4/4, and check 4 is
the one that matters: a CONTROL copy with the guard stripped boots TWICE on the
same harness. Two callbacks -> 1 boot, three -> 1, account switch -> 2.

## Museum of Science and Technology imported (4 of 5)

The SRT arrived as `Museumofscienceandtechnology` with NO file extension -
renamed to museum.srt. 60 cues, 4m38s, 0 unparsable, and 99.5% word agreement
with the human transcript (739 words each).

The importer REFUSED it at first: "found 6 true/false answers for 0 Part A
questions". Correct refusal, and it exposed a real format variation - this paper
has no PART A / PART B headers at all, just a title, the true/false instruction
and six statements. The parser now treats the true/false instruction itself as
the start of a section, and switches to multiple choice when it meets a numbered
line followed by options. Both earlier exams re-parse byte-identically
(forger 6+10, usa 6+11), so the change is additive.

Also: the builder no longer emits an empty "Part B" section. Museum is
true/false only and would have rendered a bare heading with nothing under it.

Wiring harness extended to all three imports and to the count of registered
exams rather than a hardcoded 2. **31/31**, and the practice screen now lists
four exams.

## tools/anim-cost-check.js follow-up + js/perf-hud.js - NEW

Checked the two remaining tablet suspects and cleared both: the tile entrance
animations are transform/opacity (composited, one-shot), and the hub's
MutationObservers watch specific text nodes rather than the grid, with renderHub
still signature-guarded.

So after removing the paint-path animations (v288) and the double boot (v290) I
do not know what else is slow, and a fourth round of reasoning from the code is
worth less than one measurement on the actual hardware. `js/perf-hud.js` is an
opt-in overlay - `?perf=1` on any URL, completely inert otherwise - reporting
fps, worst frame gap, long-task count and the device profile, with a copy
button.

**Verified with `tools/demos/perf-hud-trace.html`** - 7/7, including that it
adds NOTHING to the page without the flag, which matters because it ships on
the student dashboard.

Two harness assertions were wrong and were corrected rather than worked around:
counting the harness's own injected <script> as "something the module added",
and expecting a real fps number in a HIDDEN preview pane, where nothing
composites and requestAnimationFrame never fires. The fps value is only
meaningful on a screen someone is looking at - which is the point of shipping it
to the tablet.

    js clean / emdash clean / theme-sanity PASS / inline-css PASS /
    light-coverage 0 / anim-cost PASS / grammar-sanity PASS / bump OK.
    sw v289 -> v292

## Courses tile had no artwork

The hub's SKILLS list carries eight ids; I authored artwork for seven of them
plus `placement`, and missed `courses` entirely. One tile looked plainly
different from the rest.

Added skill-tile-courses.svg in the same flat style (a document with ruled
lines, a navy disc and a crimson ribbon - distinct from reading's text lines and
vocabulary's stacked cards).

**tools/tile-art-check.js - NEW.** The real failure was not the missing file, it
was that nothing connected the SKILLS list to the artwork folder, so the two
could drift apart silently. This parses the ids out of the SKILLS array
specifically (brace-matched, not every `id:` in hub.js), adds the separately
appended `placement` card, and fails if any of them has no image in any of the
five accepted extensions. Orphaned artwork is reported but does NOT fail - a
file can legitimately exist before a skill is switched on or after one retires.

Control-tested: moving skill-tile-courses.svg away makes it FAIL naming that id,
and restoring it passes. Also pixel-checked that the new file actually renders -
800x600, 441 distinct colours, not a blank square.

    9/9 tiles have artwork.  emdash clean / tile-art PASS / anim-cost PASS /
    bump OK.  sw v292 -> v293
