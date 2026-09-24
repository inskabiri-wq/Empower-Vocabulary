# 2026-08-25 - lobby QR card and join link

Report: "are they same, make it same as the left one! check all games!" with two
lobby screenshots. Left = Vocab Race (bare centred QR, join address under it).
Right = Trust No One (QR sitting inside a grey box, no join address).

## What was actually different

Two things, both real.

**1. The join address was hidden on four games.** heist, trust, reading and
listening all carried `<a id="joinUrl" ... style="display:none">`. Their JS was
already filling it in (`trust-teacher.js:298` sets href and textContent), so the
address was computed and then hidden. A teacher on those four had a QR and no
readable fallback for anyone whose camera would not focus.

**2. The QR card drew a visible grey box.** When the per-game copies of these
rules were merged into `classroom/css/styles.css`, the merged rule used
`background: var(--tint-surface, rgba(255,255,255,0.03))`. The fallback is the
near-invisible value Vocab Race used, but the token is defined, so light mode
resolved it to a real grey. The white QR tile then sat inside a second surface.

## Fix

- `.session-qr-card` is now `background: transparent; border: 0`. The white QR
  tile is the only surface, which is what the left screenshot shows.
- Added `.session-join-url` (centred, muted, `word-break: break-all`) and swapped
  the four inline `display:none` attributes for that class.

## Verified by computed style, not by looking

Presence checks passed while the two lobbies still looked different, so this was
measured instead. Each host page's own stylesheet list was loaded into an iframe
in light mode and the lobby markup was rendered against it:

| | card bg | card border | tile white | join link shown |
|---|---|---|---|---|
| vocabrace, aiquiz, trust, heist, bingo, scramble, tug, reading, listening | `rgba(0,0,0,0)` | `0px` | yes | yes |

All nine identical. No page still hides the link inline.

## Ritual

- JS sweep: all files parse (nothing JS changed, run as a guard)
- em dashes: 0 in all five changed files
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile - all PASS
- bump: `styles.css` v47 -> v48 (21 refs), CACHE_VERSION v340 -> v341,
  `--check` reports no drift

The four HTML files carry no `?v=`, so they refresh on the service-worker bump.
