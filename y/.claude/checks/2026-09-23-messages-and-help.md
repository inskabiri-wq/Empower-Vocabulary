# 2026-09-23 - Messages & help: guided flow, in-app threads, two inboxes

He showed a Speexx support widget ("not these words exactly but these") and
then, mid-build, added three decisions of his own:

- "if the teachers answers i have to see [it] ... i wanna answer it in panel,
  no email involved, but i wanna see who has sent it and he has to see who
  answered"
- "the placement of the message is for admin, but for teachers only put it on
  the dashboard first page! remember that!"  (saved to memory)
- and, from the previous round, the login line says "Contact us", not
  "your teacher"

## What was built

**Student** (`y/js/profile-hub.js`, the profile menu row "Messages & help"):
a guided conversation. WHO (My teacher / Lingualab admin) -> WHAT (topic chips,
different per recipient) -> WHEN (today / yesterday / this week / earlier; not
asked for an idea) -> write -> send. Technical topics attach the device and page
automatically ("Windows computer - Chrome, student-dashboard.html"). "Your
messages" lists each thread as waiting or "Answered by <name> (Teacher/Admin)"
with a New badge; the header avatar gets a red dot. Opening a thread marks it
read; replying re-opens it for staff.

**Staff** (`y/teacher/js/messages-admin.js` + new `y/teacher/css/messages.css`):
one module, two homes.
- Admin: Admin > Messages. Everything, both recipients, plus a "Sent to" filter.
- Teacher: a card on the Overview page. Only messages addressed to teachers, from
  the teacher's own classes. Never shown to the admin, or to a teacher with no
  scope.
- Filters: Waiting / Answered / All with counts, topic, recipient (admin only),
  class (when more than one). Answer in the card; mark answered without a reply;
  mark as waiting.

**Rules** (`firestore.rules`): the supportMessages block rewritten, plus a
`replies` subcollection. The line that matters most: **a message addressed to
the admin can never be read or answered by a teacher**, enforced on the
document's own `to` field. Replies and "Answered by" are signed with the
account's real email and role, checked against the token, so neither can be
forged. The student cannot pre-fill any answer bookkeeping at creation, cannot
mark a message answered, and `replyCount` / `lastReplyAt` / `answeredAt` must
move honestly (increment by one, server time).

## Bugs found on the way

- **Every message the old box sent had a blank email.** It read
  `profile.email`, and `fromUserDoc()` never set one. Now taken from the
  signed-in account.
- **The support gate pointed Admin Auth at PRODUCTION.** It set
  FIRESTORE_EMULATOR_HOST but not FIREBASE_AUTH_EMULATOR_HOST, so
  `admin.auth().updateUser()` aimed at real Auth and failed quietly only for lack
  of credentials. Fixed; the three other emulator gates were checked and never
  call Admin Auth.
- CSS token typo `--t2-surface-2` (the real one is `--t2-surface2`), caught by
  checking every token used against both palettes before shipping.
- No `.t2-badge.success` variant exists (critical / warning / info only).
- Walkthrough found two display bugs, both fixed and re-verified: the count said
  "0 messages" beside a card kept on screen after answering (now a `keep` set
  that the count honours), and the time wrapped to the left under a long name.

## Verified

- `y/tools/support-messages-check.js`: **51 checks**, real tokens against the
  emulator, rules pushed from disk first with `push-rules.js`. Covers creation
  validation, every read boundary (including list queries, which Firestore judges
  differently from gets), answering, forgery attempts, student bookkeeping limits,
  staff limits.
- New `y/tools/support-topics-check.js`: 8 checks that the recipient / topic /
  when lists and the topic wording agree across rules, profile-hub.js and
  messages-admin.js. Negative-tested (a topic renamed on one side fails twice).
- **Real sign-in walkthrough against the emulators** (app's own
  `useEmulators` switch, confirmed host 127.0.0.1:8080, production untouched):
  student -> teacher and student -> admin sent; teacher saw only the teacher one
  on Overview, answered it; admin saw both in Admin > Messages including the
  teacher's answer and name, answered the admin one; student got the red dot and
  "2 new", read "Answered by Ayse Yilmaz (Teacher)" and "Answered by Alireza
  Kabiri (Admin)", replied; the reply re-opened the thread for the teacher, who
  answered again. Database state read back and matched.
- `node --check` all JS clean, em-dash scan clean, `gates.js` **31 passed, 0
  failed** (rules-live skipped, needs --prod).
- Versions bumped: profile-hub.js v16, messages-admin.js v5, overview-v2.js
  v12, messages.css v2; CACHE_VERSION -> v435; `--check` clean.

## Deploy (his)

This needs BOTH a rules deploy and a hosting deploy. The live ruleset is still
the 11 Sep one, so today nothing can be sent at all.

## Not built yet (asked for earlier, still open)

App rating + feedback, Turkish / English, FAQs.

## Later the same day - "I still don't see the logo"

Two causes, both confirmed rather than assumed:

1. **Production has no logo field.** Read-only check of
   `settings/organizations`: neither row has `logo`, list last saved
   2026-05-30. The code draws nothing without it, by design. The live build
   (v433) already has the logo box in Admin > Organizations, so he can set it.
2. **The logo only exists on the student dashboard.** `js/org-brand.js` and its
   mounts are on `student-dashboard.html` alone; the teacher dashboard never
   loads it.

Proved the whole path on the emulators with a real admin sign-in, starting
from production's exact shape (no logo): typed `fsmvu-seal.png` into both boxes
with real keystrokes + Tab; both saved with previews; the sign-in domains
(`activeDomains`, `teacherEligibleDomains`) read back unchanged; the student
dashboard then drew the seal at the header middle (180px source, 34px shown).

## Gate hygiene fix - support-messages-check.js

It deleted the users doc of every account it signed in as, including the admin
account the emulator seed shares, and overwrote `settings/organizations`
without merge. That is what made the emulator dashboard say "User document not
found" for the admin. Emulator only, production never touched. It now snapshots
both before and restores them after; proved with a before/after read (admin
doc and 2 org rows identical) and still 51/51.
