# 2026-09-22d - login hero photo, student support messages

The last two off the list.

## 1. Login hero photo

Full-bleed, purely additive. Nothing on the page moved: `.login-card` stays
centred, `#particles` keeps drifting, `.gradient-overlay` stays.

Final stacking, bottom to top:

    body::before      -1   the photograph
    body::after       -1   a scrim over it
    #particles         0   (unchanged)
    .gradient-overlay  1   (unchanged)
    .container        10   the login card (unchanged)

`image-set()` picks AVIF 136 KB / WebP 203 KB / JPEG 277 KB, and under 760px
the -sm pair instead (AVIF 50 KB), because a full-bleed background is cropped
hard on a narrow screen. A `<link rel=preload>` with `imagesrcset` was added so
the largest paint on the page does not wait for the CSS to parse.

**Every visible word lives inside `.login-card`**, which carries an opaque
`linear-gradient(145deg,#ffffff,#f7faff)` - its `backgroundColor` computes to
transparent, which looked alarming until the `backgroundImage` was checked. So
the scrim is about composition, not legibility.

First pass shipped the scrim at 0.62-0.88 and the photo washed out to nearly
nothing, which defeats having one. Softened to **0.30-0.58** light,
0.42-0.72 dark, and confirmed in a screenshot.

Theme note: the theme class is on `<html>`, not `<body>`, so the light scrim is
selected by `.light-mode body::after`. Verified from computed styles, not
assumed.

## 2. Student support messages

**Not a chat, and no third-party widget.** Everything stays in this project -
a hosted widget would put student names, messages and IPs on someone else's
server, and FSMVU is the data controller.

### Where it lives - one place each, as he asked

- **Student:** ONE row in the profile hub, "✉️ Message your teacher"
  (`js/profile-hub.js`). No dashboard tile, no header button, nothing inline.
  The hub is mounted on every page a signed-in student uses, so it is
  reachable everywhere without being SHOWN everywhere.
- **Teacher:** ONE new sub-tab, Admin > 📬 Messages, with an unread pill on the
  tab itself. Read on demand, never streamed - a live listener on a queue
  nobody watches most of the day is cost for nothing.
- **Login page:** a plain text line, "Can't sign in? Email ...". No form: a
  student who cannot sign in cannot use a signed-in form, so the in-app box is
  no use to them there.

Replies go by email. There is deliberately no reply box, because this project
has **no mail provider configured** (functions/index.js records SendGrid was
removed on purpose) and a Send button would be a promise nothing keeps.

Because the student is signed in, name / email / class / level / module come
from the profile already loaded. They type only the message, and it arrives
already identified. A login-page form could never do that.

### A real finding: canWriteAsRealUser() does NOT exclude demo accounts

The rules file has claimed for a long time that demo gating happens "indirectly
via canWriteAsRealUser". **It does not.** Checked against production:

    demo.student@fsm.edu.tr  emailVerified=true  role=student
    demo.teacher@fsm.edu.tr  emailVerified=true  role=teacher

`createDemoAccount` makes them verified FSM accounts with NORMAL roles, so
`isVerifiedFsm()` passes and they are indistinguishable from real users by
role. The gate caught this: the demo account filed a support message
successfully on the first run.

The only marker is **`demoAccount: true`** on the user document, written by the
admin SDK at creation - real student documents do not carry the field at all.
A new `isDemoAccount()` helper reads it, and supportMessages/create requires
`!isDemoAccount()`.

**Worth him knowing:** any other rule relying on canWriteAsRealUser to keep
demo accounts out is not doing so. /sessions carries exactly that comment.

### Proof

`y/tools/support-messages-check.js` (new gate), real ID tokens, **12/12**:

    WRITING
      a verified student can send their own message
      a student CANNOT forge another student as the author (403)
      a DEMO account cannot file a message (403)
      a student cannot file one already marked answered (403)
      an empty message is refused (403)
      a message over 2000 characters is refused (403)
    READING
      the author can read their own message
      another student CANNOT read it (403)
      staff can read the queue
    RESOLVING
      staff can mark it answered
      a student cannot re-open it (403)
      even staff cannot edit what was sent (403)

The demo user in the gate is modelled exactly as production writes one -
verified, role 'student', `demoAccount: true` - not as a role the app never
actually assigns.

### The harness lied once, again

The first run failed four positives. Cause: `accounts:update` with the user's
OWN idToken does not set `email_verified`, so the minted token said false and
`isVerifiedFsm()` correctly refused. It looked like a rules bug and was not.
`identity()` now sets it through the Admin SDK and asserts the claim in the
token before proceeding.

### And an unstyled-class catch

The panel markup used `admin-card`, `admin-card-head`, `admin-card-title`,
`admin-card-note` on the assumption that a shared admin-card component existed.
**It does not** - every other admin panel scopes its own styles under its panel
id. Caught by re-running the orphan-class scan on the new code; renamed to
`#messagesPanel .msg-panel / .msg-head / .msg-title / .msg-note` and defined.
This is the third time that scan has paid for itself today.

## Ritual

- `node --check` clean on every JS touched, em-dash scan 0 across all of them
- `inline-css-check` PASS
- `bump.js`: profile-hub ?v14, messages-admin ?v2, index styles ?v58,
  CACHE_VERSION **v430**; `--check` no drift
- **29 gates pass, 0 fail**, 1 production skip (the new support gate is
  auto-discovered)
- AI Quiz 19/19 and games security 138/138 re-run, since firestore.rules changed

## Deploying - TWO commands this time

    firebase deploy --only firestore:rules
    firebase deploy --only hosting

The rules deploy is new and REQUIRED - without it the Send button fails with a
permission error, because supportMessages does not exist in the live ruleset.

Note the earlier deploy today landed only partway: live was v422 while the tree
was v426. Check `curl -s <site>/service-worker.js | grep CACHE_VERSION` after.
