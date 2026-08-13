# 2026-08-12d - Grammar Quest Board: level tabs, one box, one transparency

Three asks about the grammar map ("explore map"), all measured in
`y/tools/demos/dash-boot.html`, which boots the dashboard's real scripts against
a stubbed Firebase so both boards can actually be opened.

## What was different, measured

Same eleven cards rendered into each board:

| | grammar (before) | vocabulary (before) |
|---|---|---|
| chrome | `.gr-map-modal` > `.gr-map-sheet` | `.modal-overlay` > `.modal-content.learning-map-modal` |
| sheet | 900 wide, padding 18px | 900 wide, padding 36/44px |
| level tabs | **none** | A2 B1 B1+ B2 C1 |
| sheet background | `rgba(28,42,66,0.8)` (translucent) | opaque gradient |
| card | **423 x 305** | **350 x 297** |

That is exactly the report: no tabs on grammar, grammar translucent and
vocabulary not, and grammar's card a wide rectangle against vocabulary's near
square. All three came from grammar having its own bespoke modal.

## Fix: grammar builds vocabulary's modal

`openMap()` in `skills/grammar.js` now emits the same structure vocabulary uses
- `.modal-overlay.active` > `.modal-content.learning-map-modal` with a
`.modal-close-btn`, `.modal-title`, `.qc-board-sub`, `.level-tabs` and
`.learning-map-container`. The bespoke `.gr-map-modal` / `.gr-map-sheet` /
`.gr-map-head` / `.gr-map-close` CSS is deleted; only the grammar-only topic-line
clamp survives, rescoped to `#grMapModal`.

Level tabs are built from `DATA.levels` (A2, B1, B1+, B2, C1). Browsing a tab
does NOT change the menu's level - vocabulary behaves the same way - but
starting a drill from a browsed level does set `state.level` first, so the
questions match the tab you launched from.

Transparency went the direction asked for: vocabulary's sheet was the opaque
one, so `.learning-map-modal` is now
`rgba(12,18,34,0.86) -> rgba(15,23,42,0.80) -> rgba(12,18,34,0.86)` with
`backdrop-filter: blur(14px)`. Both boards read the same rule, so there is one
transparency, not two.

Vocabulary's board subtitle was an inline `style` attribute; it is a
`.qc-board-sub` class now so grammar can use the identical line.

## After

| | grammar | vocabulary |
|---|---|---|
| sheet | 900 x 810 | 900 (identical rule) |
| padding | 36/44px | 36/44px |
| background alphas | 0.86 / 0.80 / 0.86 | 0.86 / 0.80 / 0.86 |
| backdrop | blur(14px) | blur(14px) |
| level tabs | A2* B1 B1+ B2 C1 | A2* B1 B1+ B2 C1 |
| card | **389 x 305** | **389** wide (same content) |

Card width went 423 -> 389 and now matches vocabulary exactly. Switching to B2
repaints 9 cards and moves the active pill; C1 shows the empty state (grammar
has no C1 units). Launching a challenge from a tabbed level closes the board and
starts the drill with no console errors.

## Measurement trap worth remembering

The two sheets first measured 900 vs 810 with identical CSS. The cause was the
modal's open transition: `.modal-content` starts at `scale(0.9)`, and the
preview pane never composites (`visibilityState: hidden`, 0 rAF), so the
transition never advanced and vocabulary's sheet stayed scaled down.
810 = 900 x 0.9. Neutralise with
`*{transition:none !important;animation:none !important}` before reading any
rect, exactly as for colours.

A second trap: `openLearningMap()` is async (`loadMapProgress().then(...)`), so
injecting test cards synchronously after calling it gets overwritten by
`showMapLevel`. Wait before measuring.

## Gates

- `node --check` grammar.js / progress.js / app-settings.js - pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `grammar-sanity.js` PASS,
  `bump.js --check` OK
- em-dash scan on added lines: 0
- grammar.js v31, grammar.css v25, extra.css v6; service worker v192

## Note

Vocabulary's board shows 0 cards in the harness because its dataset JSON 404s
offline; card geometry was verified by rendering grammar's cards inside the
vocabulary board. Everything here is still undeployed.
