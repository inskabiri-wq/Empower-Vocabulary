# 2026-07-19e - Score icon swap + one-page marketing site

## 1. "Live Scores" icon -> clean brand SVG (and same on placement)
The 📊 emoji rendered inconsistently across devices. Replaced it with an
inline 3-bar ascending SVG bar-chart in the brand blue/teal/sky
(#3b82f6 / #06b6d4 / #38bdf8), identical on every device. Applied to every
"Live Scores" heading:
- classroom-teacher.html (Vocab/Grammar Race live board)
- classroom-tug-teacher.html, classroom-bingo-teacher.html,
  classroom-scramble-teacher.html
And, per the request, the SAME icon now sits on the placement language-score
title (placement.html #plScore "Language part complete - your score"), a
larger 24px version to match the pl-title.
SW bumped v110 -> v111 (HTML has no ?v; CACHE_VERSION purge refreshes it).

## 2. Marketing site (Google Apps Script) - NEW, outside y/
User answers: PUBLIC SHOWCASE, ENGLISH, CONTACT/EMAIL CTA, clean SVG icon.
Delivered in E:\vocab-trainer\marketing-site\ (NOT part of the Firebase app):
- index.html - the whole site, fully self-contained (all CSS + JS inline,
  no external images; only Google Fonts over the network). Matches the app's
  brand: dark #0a0f1a, Poppins body + Outfit headings, blue/teal/violet
  gradients, glass cards, ambient blobs. Sections: sticky nav (flask logo),
  hero (gradient headline + glass app-mock showing a vocab question + live
  leaderboard + a "Live scores" bar-chart badge), animated stat band
  (400+ / 6 / 9 / 8,000+, count-up on scroll), skills (6), classroom games
  (9) with QR/live/CSV pills, Writing-AI split with a colour-coded essay
  mock, teachers split with a progress dashboard mock, 3-step how-it-works,
  contact CTA (mailto akabiriaslifar@fsm.edu.tr), footer.
  `<base target="_top">` so links/mailto escape the Apps Script iframe.
  Reveal-on-scroll is robust: reduced-motion + no-IntersectionObserver fall
  back to show-all, plus a 3.5s safety timeout so content can never stay
  hidden.
- Code.gs - doGet() serving the "index" HTML file, viewport meta, ALLOWALL.
- README.txt - step-by-step Apps Script deploy (new project -> paste Code.gs
  -> add HTML file named "index" -> paste index.html -> Deploy as Web app,
  access Anyone).

## Verification (browser, local static server on 8899)
- No console errors. Desktop 1280: no horizontal overflow (body 1265),
  6 sections present, hero h1 59px, Outfit + Poppins loaded, 9 games /
  6 features / 3 steps / 4 stats, mailto CTA + nav CTA present.
- Count-up animates to 400+ / 6 / 9 / 8,000+; hero + stats reveal fire.
- Mobile 375: no overflow (375=375), hamburger shows, menu opens on tap,
  hero + cards collapse to one column.
- Screenshot confirms a polished, on-brand hero.
- Em-dash scan of index.html + the 5 edited app HTMLs: clean.
- bump --check consistent (SW v111).

## Ship
- App: firebase deploy --only hosting (picks up the icon change + SW v111),
  hard refresh.
- Site: deploy separately on Google Apps Script per marketing-site/README.txt
  (not part of the Firebase deploy).
