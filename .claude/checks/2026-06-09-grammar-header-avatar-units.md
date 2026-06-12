# Grammar screen: match vocab header + avatar + unit chips · 2026-06-09 (pass 3)

User pointed at 3 remaining differences vs the vocab screen: the settings/header,
the welcome avatar, and the unit chips.

## Fixes (grammar.js v10->v11, grammar.css v8->v9, student-dashboard.html)
1. HEADER — the grammar skill-header-right was just a "0%" pill. Now it has the SAME
   trio as the vocab dashboard header: ⚙️ settings (openSettingsModal), the profile
   chip (avatar + name + Level·XP, openProfileModal), and 🚪 Logout (openLogoutModal).
   Uses the same classes (.header-icon-btn / .profile-badge / .logout-btn) so it's
   styled identically; grammar-specific ids (grAvatarEmoji / grProfileName /
   grProfileLevel / grProfileXP) to avoid duplicate-id clashes with #menuScreen.
2. AVATAR — the welcome banner showed a static 📘. Now it shows the LIVE avatar
   (liveAvatar() reads #avatarDisplayEmoji, the same dragon the vocab dashboard shows).
   syncGrammarHeader() copies the live profile (avatar/name/level/XP) into the header
   chip on every renderMenu.
3. UNIT CHIPS — were a 4-column grid; now a 7-column grid (repeat(7, minmax(0,1fr)))
   matching the vocab #unitPills layout.
   + #grammarScreen teal overrides for .profile-badge / .header-icon-btn so the header
   matches the vocab teal accent.

## Cache
- grammar.js v10->v11, grammar.css v8->v9, service-worker.js v21->v22.

## Verify
- node --check grammar.js OK. Stubbed render: renderMenu runs; syncGrammarHeader copied
  live profile (grProfileName=Alireza, grAvatar=🐉).
- grammar.css braces 158/158. No em dashes in grammar.js / grammar.css.
- HTML header has settings/profile/logout with the global handlers; 7-col units present.

## Deploy
- firebase deploy --only hosting, reopen (SW -> v22). Hub -> Grammar: header now has
  settings + profile chip (live avatar) + logout; welcome shows the dragon; units are
  a 7-col chip grid - matching the vocab screen.
