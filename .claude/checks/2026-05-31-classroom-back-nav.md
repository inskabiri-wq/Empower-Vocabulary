# Classroom "back" → hub, and the "cached version" diagnosis

**Date:** 2026-05-31
**Trigger:** (1) "classroom mode back to dashboard brings to the vocabulary"; (2) "on vocabulary, click hub/back, stays in the previous cached version".

---

## #1 — Classroom back-link went to the vocab screen, not the hub  ✅ fixed
`classroom-student.html` routed "back" to **`student-dashboard.html#vocabulary`** (a deep-link straight into the vocabulary screen) in two places, while every *other* classroom game (heist/listening/reading/trust) goes to the plain **`student-dashboard.html`** (the hub).

Fixed both to land on the hub + relabelled:
- Header (line 64): `#vocabulary` → `student-dashboard.html`; "← Practice" → **"← Dashboard"**.
- Game-over screen (line 189): `#vocabulary` → `student-dashboard.html`; "← Back to Practice" → **"← Back to Dashboard"**.

Bonus: this also removes the `#vocabulary` deep-link, so the back-nav stack can't start out of sync with the visible screen.

## #2 — "previous cached version" is NOT a code bug
Traced it: the in-app **← Hub** button → `backToHub()` (hub.js:198) which **already calls `renderHub()`** (line 201), and the system-back path (`back-nav.js`) also re-renders on `popstate`. So the hub *does* refresh on return — there's nothing stale in the code path. hub↔vocab is pure client-side (no fetch), so it can't be re-pulling old HTML mid-navigation.

→ "Previous cached version" = the **PWA service worker** serving the **old dashboard page/CSS** after a deploy (the recurring post-deploy cache lag). The page you have open is controlled by the *previous* worker until it's replaced.

**How to clear it (user side):**
- Hard-refresh **on the dashboard page itself** (Ctrl/Cmd-Shift-R) — not just the login page.
- If it persists: DevTools → Application → Service Workers → **Unregister**, then reload; or **close all tabs** of the site and reopen.
- Students aren't really affected — they cold-open the app, so the worker updates between sessions and serves fresh next time.

**Optional permanent fix (offered, not built):** add a tiny "New version available — tap to refresh" toast (via `pwa-register.js` `controllerchange`) so an update is one tap instead of a manual hard-refresh. Not auto-reload (that could nuke an in-progress writing essay). Awaiting the user's go.

## Checks
- classroom-student.html: 0 `#vocabulary` links remain; both now `student-dashboard.html` (verified).
- hub.js unchanged (the attempted duplicate-renderHub edit failed-safe — `backToHub` keeps its single `renderHub()`).
- Layout/markup unchanged (href + label text only) → no tag-balance impact.

## ROOT CAUSE of the recurring "I still see the old version" (found via live check)
Curled the live host: **all changes were already deployed** (classroom "Back to Dashboard", `hub.css` `:has(#hubScreen.active)` full-width rule present, `.hub-rail-stats` gone). But the **service worker was still `v4`** — and static CSS/JS are **cache-first within a version**, so the browser kept serving the old cached files until the version label changes. The new files were on the server but the worker never purged the old cache → user sees the previous version.

**Fix:** bumped `CACHE_VERSION` **v4 → v5**. On the next deploy: new worker → `activate` purges `empower-shell-v4` → `controllerchange` → `pwa-register.js` auto-reloads once → fresh CSS/JS. No manual hard-refresh needed.

**Lesson (mine):** bump `CACHE_VERSION` on **every** deploy that changes any cached CSS/JS — I'd missed it after the two-column/rail/classroom edits, which is why they didn't surface despite being deployed.

**Optional hardening (offered, not done — touches core SW, want to test first):** switch static assets to *stale-while-revalidate* so changed files self-refresh on the next load even if the version isn't bumped.

## Deploy
Hosting-only. `firebase deploy --only hosting`. With v5 + the existing auto-reload, the dashboard refreshes itself — no manual hard-refresh.
