# 2026-09-23 (evening) - logo, teacher filters, bigger message box, review fixes

His report: "i still cant see the logo ... the data for the pic is in there",
"message works fine but make the box a bit bigger! is it mobile friendly and
laptop!", "i guess the filters on teachers dash for messages are failing".
Plus the adversarial review of the messages feature, which ran out of usage
part-way (4 confirmed, 11 left unjudged); the unjudged ones were checked here
by hand against the code and the data.

## 1. The logo - why it never showed

Checked live, not assumed. Live hosting is v435 (same as local then), both the
logo module and the registry load on the student dashboard, the registry
starts itself. The cause was the DATA: production `settings/organizations`
has no `logo` on either row, and the list has not been saved since 2026-05-30.
Nothing anywhere in `settings` mentions a logo. The picture FILE is in the app;
the entry telling the app to use it for FSM was never written.

Fix: `js/org-brand.js` now has FSMVU's seal as the built-in DEFAULT for
fsm.edu.tr and stu.fsm.edu.tr. A logo typed in Admin > Organizations still
wins; any other university still needs its own (they supply the file).

That exposed a second, latent bug: the demo check looked for
`role === 'demo'`, which no account has. Production demo accounts are an
ordinary role plus `demoAccount: true` (functions/index.js createDemoAccount).
With a logo present, the stakeholder demo logins would have got the seal - he
ruled that out. Now checks `demoAccount === true`, and waits for the user
document before painting (the poll used to stop the moment anything was
painted, so a wrong first paint would have stuck).

Verified: emulator, production's exact data (no logo), admin account on the
student dashboard at 1366px - seal drawn dead centre (logo centre 698 = header
centre 698). `y/tools/harness/org-brand.html` rewritten to production shapes:
12/12; the OLD module run through it fails exactly the three cases that matter
(both "no logo field" cases, and a production-style demo teacher getting the
seal).

Phones: the seal stays hidden at <= 720px, as originally designed. Measured
rather than assumed: showing it at 375px squeezes the title block from 241px
to 193px and pushes the subtitle onto an extra line (+21px). Offered to him.

## 2. "The filters on the teacher dashboard are failing"

Every filter works: emulator, realistic inbox (5 messages for the teacher's
class, 1 from another class, 1 to admin), hit-tested clicks - Waiting 3 /
Answered 2 / All 5, topic filters, combinations, empty state; other class and
admin message never shown.

Production was then checked read-only (counts and field names only, never
message text). Every inbox query production runs SUCCEEDS - no missing index.
But production holds only 2 messages and NEITHER is addressed to a teacher, so
every teacher inbox is genuinely empty. Two real problems did turn up:

- **Old-format message and the filter.** One message predates the recipient
  choice (no `to`/`topic`). Its card said "To admin" but the "Sent to admin"
  filter compared the raw field and HID it. One `toOf()` now serves both.
  Verified on v6: "Sent to admin" -> a1, legacy1.
- **Privacy: demo.teacher@fsm.edu.tr is assigned to B125, a real class.** The
  stakeholder demo login could have read and answered real students' messages.
  Rules: `staffCanSee` now requires `!isDemoAccount()` for teachers; the inbox
  card is not shown to demo accounts either. Gate: 3 new demo-teacher checks;
  with the new line removed exactly those 3 fail.

So testing the teacher view with demo.teacher now shows NOTHING, by design. Use
a real teacher account with a class.

## 3. Bigger box, phone and laptop

`#phSupport` only (other hub panels keep the shared 420px):
- laptop: 600px wide (was 420), conversation up to min(66vh, 640px), taller
  writing box. Measured 600 x 617 at 1366x800, fits the screen.
- phone (<= 520px): full width less 8px each side (359 of 375), conversation
  70dvh, writing box 16px text so iPhone Safari does not zoom. No sideways
  scroll, Send reachable (hit-tested).
- teacher inbox on phones: the Overview list now flows with the page instead
  of scrolling inside a 520px box (a swipe starting on it could not move the
  page); 16px input; full-width action buttons.

## 4. Review findings fixed

Student (`js/profile-hub.js`):
- half-written message kept across opening another thread, going back, and
  closing/reopening (verified all three); cleared on send or "Start again"
- thread no longer says "No answer yet" when staff marked it answered without
  writing - says "Marked as answered by ..." (or "Marked as answered" when the
  old inbox recorded no name); list says "Answered", not "Waiting", for those
- unread decided from the document as it is NOW and recounted, never
  decremented (verified: 1 new -> open -> 0, nothing comes back as New)
- a send/reply that resolves after the student moved on no longer paints into
  the wrong conversation
- the red-dot check has its own sign-in wait; it rode on the profile read's
  wait, which is skipped when the page already has the user document

Staff (`teacher/js/messages-admin.js`, `teacher/css/messages.css`):
- a reply being typed survives the thread loading, filter changes and card
  rebuilds (verified: typed before the thread landed, still there after)
- the thread is fetched fresh every time a card is opened (a student's
  follow-up was hidden until a page reload)
- status colours from the palette tokens: light-mode amber is now #b45309
  (was #f59e0b, about 2:1 on white)
- "Answered by staff" -> "Answered" when no name was recorded

Rules (`firestore.rules`): creation now requires `email ==
request.auth.token.email` and bounded strings for name/class/level/module, so
"who sent it" cannot be faked. Gate: 2 new checks.

## Test hygiene found on the way

The preview's service worker served a cached teacher dashboard with the OLD
inbox script twice (v5 when v6 was on disk) - the first phone run tested old
code and its result was discarded. Caught by asserting the loaded ?v= before
trusting any result. Same effect his students get after a deploy: one extra
refresh.

## Checks

- `support-messages-check.js`: **56/56** (was 51), rules pushed from disk
  first; negative-tested (demo line removed -> exactly 3 fail)
- `node --check` all JS clean; em-dash scan clean; `gates.js` **31 passed, 0
  failed**, 1 skipped (rules-live, needs --prod)
- versions: org-brand.js v3, profile-hub.js v18, messages-admin.js v7,
  messages.css v3; CACHE_VERSION v439; `--check` clean

## Deploy (his)

Both: `firebase deploy --only firestore:rules` (demo exclusion + sender check)
and hosting.
