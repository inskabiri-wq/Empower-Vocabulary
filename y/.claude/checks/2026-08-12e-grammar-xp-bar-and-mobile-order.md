# 2026-08-12e - Grammar XP bar and mobile order match vocabulary

## 1. The XP bar

Grammar had its own `.gr-xp*` markup and CSS. Measured against vocabulary's:

| | grammar (before) | vocabulary |
|---|---|---|
| track | 10px, flat `rgba(255,255,255,0.08)` | 9px, `--dash-elevated` |
| fill | teal->amber gradient, static | same gradient + `background-size:200%` + `dashXpShine` |
| fill sheen | none | white `::after` top highlight |
| "X / 100 XP" | `--text-secondary` (grey) | `--dash-xp` (amber) |
| pill | 0.8em, padding 5/12 | 0.72rem, padding 4/12 |
| milestones | 0.65em, `0` always marked hit | 0.58rem, hit computed from XP |
| block padding | 14px 16px | 14px 18px |

Fixed by making grammar render vocabulary's component rather than a lookalike:
`grammar.js` now emits `.dash-xp-block` / `.dash-xp-top` / `.xp-badge-pill` /
`.xp-num` / `.xp-bar-container` / `.xp-bar-fill` / `.xp-bar-glow` /
`.xp-milestones`, and every `#menuScreen .xp-*` rule in `extra.css` is now
`#menuScreen ..., #grammarScreen ...`. All `.gr-xp*` CSS is deleted. Milestone
pips light from the real XP (`xpIn >= m`) instead of hard-coding `0` as hit.

Verified with every property read from both screens - **all identical**:

    block      14px 18px  r14px  rgb(30,41,59)
    track      9px  r9999px  rgb(51,65,85)  border 0
    fill       linear-gradient(90deg, #0d9488, #f59e0b, ...) size 200%  anim dashXpShine
    pill       11.52px/800  rgb(45,212,191)  pad 4px 12px
    xp figure  12.48px/700  rgb(245,158,11)
    milestone  9.28px/700

### Why it could not have worked before

`.skill-screen` declared only part of `#menuScreen`'s token set. `--dash-xp`,
`--dash-xp-lt`, `--dash-secondary`, `--dash-streak`, `--dash-success`,
`--dash-fg1/2/3` did not exist there, so any component lifted from the
vocabulary dashboard fell back to its defaults. Those eight tokens are now
declared on `.skill-screen` with `#menuScreen`'s values - which also fixes the
same latent problem for listening, reading, writing and speaking.

## 2. Mobile order

Grammar's phone layout was `.gr-side { order: -1 }` - the entire Level/Unit
column jumped ABOVE the welcome banner, so grammar opened on a wall of pills
while vocabulary opened on the welcome card.

Now the same technique vocabulary uses: `display: contents` on both column
wrappers so their children become direct flex children of `.gr-dash`, then one
explicit `order` sequence. Measured by sorting the rendered elements by Y at
390px wide - the two screens produce the **same sequence**:

    welcome -> xp -> stats -> select content -> section title -> games -> map button

Desktop is unchanged: `.gr-dash` is still a `754px + 300px` grid with the side
column to the right of main.

### Trap: source order beat the media query

The mobile block was first written next to `.gr-dash` near the top of
`grammar.css` and did nothing. `#grammarScreen .gr-side { display: flex }` is
declared ~60 lines further down at equal specificity, so the later rule won and
`display: contents` never applied - `.gr-side` computed `flex` with `order: 0`.
The block now lives at the END of the file with a comment saying it must stay
there, and a pointer at the old location.

## Gates

- `node --check` grammar.js - pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `grammar-sanity.js` PASS,
  `bump.js --check` OK
- em-dash scan on added lines: 0
- grammar.js v32, grammar.css v27, extra.css v7, skills.css v6;
  service worker v194
