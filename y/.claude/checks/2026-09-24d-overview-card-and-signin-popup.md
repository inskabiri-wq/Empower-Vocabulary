# 2026-09-24 (d) - teacher Overview message card; sign-in page popup

He said: "deployed, check it landed and do 1 and 2 ... i did 4 seemed fine but
check again yourself".

## The deploy landed
Live service worker v457 = disk; all 43 game assets byte-identical; live rules
= disk (created 2026-09-24 10:56 UTC).

## His item 4, re-checked from my side (read-only)
- Production FAQs: 8 of 8 shown to students, 4 on the sign-in page.
- Live sign-in page, signed out: "Contact us · Common questions"; Common
  questions lists the 4; Contact us opens the new dialog (nothing sent).
- Game pages serve the fixed host scripts.
- NOT checkable by me: ?boot=1 on his phone (needs a real student sign-in).

## 1. Teacher Overview message card
- The teacher's card shows the newest 3 (2 on a phone) plus "Show N more" /
  "Show fewer"; an open card always stays. Filters reset it. The admin inbox
  is not capped.
- An opened message lifts the list's height cap (:has(.is-expanded)) and is
  scrolled into view, so its reply box is never below the box edge.
- On the teacher card a bare page tag ("student-dashboard.html") is dropped;
  a device line still shows; the admin sees both.
- Emulator, demo teacher with 6 waiting from B101: laptop 3 cards + "Show 3
  more" -> 6 -> "Show fewer" -> 3; third card opened: max-height none, reply
  box fully inside. Phone 375: 2 cards + "Show 4 more", card 852 px (was
  1254 with 3, unbounded before), charts 16 px below, no sideways scroll.

## 2. Sign-in page popup for game phones
index/js/main.js ignores an ANONYMOUS session (a classroom game on the same
site) instead of signing it out with "University email required" - which also
killed the game in any other tab. Emulator: anonymous session -> sign-in page:
no popup, session kept, Contact us sent with it (rules allow anonymous).

## Ritual
node --check; no em/en dash in touched files; push-rules; gates.js 35 passed,
0 failed; bump --check consistent at v459.

## Deploy
    firebase deploy --only hosting
