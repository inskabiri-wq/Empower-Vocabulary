# 2026-09-24 (c) - Contact us on the sign-in page; teacher sidebar "More"

He said: the message (Messages & help) "to the sign in page as well, with an
extra step to write name and email, compulsory - only on the sign in page";
and for Rate us / Widgets on the teacher dashboard: "I like the More idea, and
on phone as well".

## Sign-in page messages (contract: scratchpad signin-msg-contract.md)

- Someone who cannot sign in has no account, so the message is written with
  NO sign-in (not even anonymous: index/js/main.js signs such users out with
  the "University email required" popup). One narrow, fully validated shape:
  source 'signin', typed name (2-100) and email (lowercased, format-checked),
  to 'admin' only, topic account/technical/other, when, device, page
  'index.html', message 1-2000, status open, server createdAt. Nothing else.
- js/signin-support.js (new): "Contact us" (footer and the Common questions
  dialog) opens a guided dialog: 1 name + email (both required, Continue
  disabled until valid, "Used only to answer this message."), 2 topic,
  3 when, 4 message (device attached for account/technical), 5 "Sent ... when
  you can sign in with <email>, the answer will be in Messages & help".
  Falls back to the old mailto if the module or the write fails.
- Rules: a second create branch for that shape (auth null or anonymous only);
  isAuthorOf(d): a signed-in user whose VERIFIED token email equals the typed
  email may read it, its replies, mark it read and reply - like any author.
  Teachers never see it; signed-out nobody reads anything.
- Admin > Messages: card tagged "Sign-in page" with "Name and email were typed
  on the sign-in page, not checked against an account."; reply placeholder
  says where the answer appears.
- Student Messages & help: sign-in messages sent with the student's own email
  are listed with theirs, tagged "Sent from the sign-in page".
- Gates: support-messages-check.js 123 checks (67 new; mutation-tested),
  support-topics-check.js 15 (sign-in subset in sync).
- Proven on the emulator, three roles: signed out on index.html sent
  "Demo Student / Demo.Student@FSM.edu.tr" -> stored with the 11 fields,
  email lowercased; admin saw the tagged card and answered; the student,
  signed in, saw it "Sent from the sign-in page", "Answered by Alireza Kabiri
  (Admin)", opened it and replied without error.
- Known limit: the one write anyone on the internet can make; rules cannot
  rate-limit. If spam ever appears: App Check or a callable function.

## Teacher sidebar "More" (desktop and phone)

- Account section: Lingualab, Classroom, More, Logout. More opens Widgets,
  Display, Rate Lingualab (the same elements, moved; their scripts find them
  by id/attribute). Open/closed remembered per browser (localStorage, guarded).
- Phone: the More sheet shows the same More row expanding in place (mobile-
  shell.js), then the divider and Logout.
- Proven: desktop closed/open lists, Display opened settings, Widgets opened
  its popover, Rate opened the rating form, state remembered; phone 375 px
  sheet: More expands to the three rows. Gates teacher-mobile-check,
  live-markup-check, inline-css-check, dialog-scope-check PASS.

## Ritual
node --check on all touched scripts; no new em/en dash (firestore.rules keeps
its 40 old ones); push-rules; gates.js 35 passed, 0 failed; bump --check
consistent at v457.

## Deploy (rules FIRST, then hosting)
    firebase deploy --only firestore:rules
    firebase deploy --only hosting
