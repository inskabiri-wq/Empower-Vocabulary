# 2026-09-23 (late) - AI Quiz in two languages, FAQs, late-profile logo fix

He said: "deployed, check it landed and go with 1 and 2 on hold 3", then "also i
need the AI QUIZ only to be in 2 languages !". 1 = Turkish/English, read as the
AI Quiz ONLY (said so to him); 2 = FAQs; 3 = avatar saving, still ON HOLD.

## The deploy landed

Live service-worker.js is v446, the version on disk before this work
(org-brand.js v8, app-rating.js v2 live). Everything below is on disk at v450,
not deployed.

## AI Quiz: English, Türkçe, or both

- Setup has a Language choice: English + Türkçe (default), English only,
  Türkçe only. The room stores `lang`; a resumed room keeps it.
- Projector: question and options in the room's language; with both, the
  Turkish sits on a quieter second line. Module title and the big counter
  follow it too ("Soru 2 / 20"). The counter was English-only in the first
  run - found in the end-to-end test, fixed, and added to the gate.
- Phones start in the room's language and have an EN / EN+TR / TR switch in
  the header, remembered per phone. Every word on the phone (31 strings)
  switches, in place: answers already given and their colours are kept.
- A room made before this (no `lang`) shows English, exactly as before.
- The answer/reveal/score code is untouched.

Proven on the emulator, two roles (host 127.0.0.1, phone localhost):
room JMERK (both): join, answer, score 120 written; with a second player
holding the question open, switched TR -> both -> EN before and after
answering - text swapped, answer lock and right/wrong colours kept; ladder and
"Bitti" end screen switch; host reveal marks C. Room TQPRB (Türkçe): lobby
"· Türkçe", phone with no choice of its own joined in Turkish, projector in
Turkish; `lang` stripped mid-game (legacy) -> phone fell back to English;
resume kept Turkish; question 2 showed "Soru 2 / 20" on both screens.

Note for a future test: with ONE player the host closes the question the
moment everyone has answered, so a switch after answering lands on the ladder.

Gate: `tools/aiquiz-lang-check.js` (10 checks, static). The other four AI Quiz
gates (answer-spread, e2e-rules 19, classroom-lobby, lobby-listener) pass.

## FAQs

- Admin > FAQ (`teacher/js/faq-admin.js`, `teacher/css/faq.css`): write,
  edit, reorder (arrows renumber 10, 20, ...), show/hide, delete (confirm), a
  filter, counts. "Add starter questions" adds 8 about signing in and the app
  as DRAFTS; pressing it again adds only the missing ones. No "who can read my
  messages" starter: the rules let any scoped teacher read teacher-addressed
  messages (the app narrows it), so a privacy promise there would be untrue.
- Students (`js/profile-hub.js`, via `js/faq.js`): "Common questions" at the
  top of Messages & help, with search (accents and Turkish i folded) and
  topic groups; and after a student picks a topic, up to 4 questions on it,
  "These might already answer it", BEFORE they write. The draft and choices
  survive going to Common questions and back.
- Sign-in page: "Can't sign in? Contact us · Common questions" - the link
  appears only when a published question is marked for the sign-in page;
  "Contact us" is unchanged. Dialog with search; Escape / backdrop close.
- Rules `faqs/{id}`: admin-only writes, every field checked; a PUBLISHED
  question is readable by anyone, signed in or not; drafts admin-only; so
  every student query carries published == true (one query, in js/faq.js).
- `js/faq.js` loaded before profile-hub.js on all 4 hub pages, on index.html
  and on the teacher dashboard (topic list).

Proven in the browser on the emulator (signed in with emulator custom tokens,
no password typed): admin added starters, published 6, edited one (link
rendered), moved one, added one with the empty-answer error first, deleted one
through the dialog, re-pressed starters (1 added). Phone width 375: form fits,
no sideways scroll. Student: entry shown, 4 related sign-in answers after
"Lingualab admin > My account", drafts hidden (7 of 9), search, back keeps
the draft. Signed out on the sign-in page: 3 questions (the sign-in draft
hidden), search, Escape and backdrop close.

Gate: `tools/faq-check.js` (52 checks: topics agree with the rules and cover
every Messages & help topic, starters fit and are drafts, escaping, search,
wiring, and 34 real-token rule checks incl. signed-out reads). Leaves the
emulator as found.

## Logo: a slow profile no longer loses the seal

org-brand.js re-checked for ~20s and then stopped. `student/js/auth.js` and
`teacher/js/config.js` now call `LLOrgBrand.refresh()` the moment the profile
lands (guarded, so a logo error cannot break the dashboard). Simulated with a
fake clock: profile at 20.6s / 30s / 90s showed no seal before, shows it now.
Live check: the seal showed on the emulator student dashboard with auth.js v16.

## Ritual

node --check on every touched script; no em dash in anything touched
(firestore.rules holds 40 old ones outside the new block - out of scope);
push-rules; `gates.js` 34 passed, 0 failed (1 production gate skipped as
always); `bump.js --check` consistent at v450.

## For him to deploy

Hosting AND rules (new faqs rules):
    firebase deploy --only hosting,firestore:rules
Then Admin > FAQ > "Add starter questions", read them, and show the ones he
wants. The sign-in link stays hidden until one marked "Also on the sign-in
page" is shown to students.
