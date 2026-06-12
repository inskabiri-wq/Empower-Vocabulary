/* ============================================================
   STUDENT DASHBOARD — Phone-back-button integration
   ----------------------------------------------------------------
   Mobile users tapping the system back button used to fall out of
   the page entirely (since the dashboard is a SPA — no real history
   beyond the page-load entry). This module fixes that.

   Behavior:
     • Anywhere INSIDE the app  → system back navigates to the
       previous screen (game → menu → hub).
     • At the hub root          → system back opens the existing
       "Leaving so soon?" logout modal, instead of leaving the page.

   Implementation notes:
     • We maintain our own `navStack` instead of trusting the
       browser's session history exactly, because the in-app back
       buttons (backToHub / backToMenu) skip multiple levels at a
       time — letting the browser do raw step-by-step popping would
       leave stale entries that visit "phantom" intermediate screens.
     • Every call to the existing `showScreen()` is intercepted; we
       update navStack and push a hashState so popstate fires when
       the system back button is pressed.
     • A small recursion guard (`isPopping`) prevents the popstate
       handler from re-pushing while we're navigating to the new top.
   ============================================================ */

(function () {
  'use strict';

  // The single source of truth for "where am I in the app" — root is
  // index 0 (hubScreen), top is the currently-active screen.
  const navStack = ['hubScreen'];
  let isPopping = false;

  // Capture the original showScreen so popstate can call it without
  // re-triggering our patched version's history side-effects.
  let origShowScreen = null;

  function setupOnce() {
    if (typeof window.showScreen !== 'function') {
      // ui.js may not have parsed yet — back off and retry. Cheap.
      setTimeout(setupOnce, 30);
      return;
    }
    if (origShowScreen) return; // already set up

    origShowScreen = window.showScreen;

    // Patch showScreen: every navigation tracks in navStack + history
    window.showScreen = function (id) {
      origShowScreen(id);
      if (isPopping) return;
      // Same-screen no-op: don't pollute history with duplicates
      if (navStack[navStack.length - 1] === id) return;

      const idx = navStack.lastIndexOf(id);
      if (idx >= 0) {
        // Re-visiting a screen already in the stack = a backward jump
        // (e.g. completionScreen → menuScreen via backToMenu). Trim
        // the stack to that point so subsequent system-back presses
        // continue to walk back along the correct path.
        navStack.length = idx + 1;
      } else {
        navStack.push(id);
      }
      // Always push a history entry so popstate fires on system-back
      history.pushState({ screen: id, depth: navStack.length }, '', '#' + id);
    };

    // Establish the initial history. Two entries for OUR page:
    //
    //   ┌─ external referrer       ← browser back here = leave the site
    //   ├─ replaced-hub (real)     ← anchored: where we restore on pop
    //   └─ sentinel-hub (current)  ← the "soft trap" that catches back
    //
    // Without the sentinel push, pressing back from the hub would
    // navigate the user OFF the page entirely — popstate never fires
    // because there's nothing for the browser to pop INTO within our
    // document. The sentinel gives back-press a target inside the
    // page, which fires popstate, which we use to open the logout
    // modal instead of letting the user leave.
    const initial = (document.querySelector('.screen.active') || {}).id || 'hubScreen';
    if (initial !== navStack[0]) {
      navStack[0] = initial;
    }
    history.replaceState({ screen: initial, depth: 1 }, '', '#' + initial);
    history.pushState({ screen: initial, depth: 1, sentinel: true }, '', '#' + initial);
  }

  // Helper: when navStack is back at the root (length 1) we need a
  // FRESH sentinel above us so the NEXT back press still fires
  // popstate. Called after a successful pop that lands on the hub,
  // and after the user dismisses/cancels the logout modal indirectly
  // (any back press while on hub).
  function ensureRootSentinel() {
    const top = navStack[navStack.length - 1];
    history.pushState({ screen: top, depth: 1, sentinel: true }, '', '#' + top);
  }

  // ---- Phone / system back button --------------------------------
  window.addEventListener('popstate', () => {
    if (!origShowScreen) return; // setup didn't complete; bail safely

    if (navStack.length > 1) {
      // Walk back one step in our app
      isPopping = true;
      try {
        navStack.pop();
        const target = navStack[navStack.length - 1];
        origShowScreen(target);
        // Returning to the hub: re-render so progress / assignments
        // reflect anything that may have changed mid-session.
        if (target === 'hubScreen' && typeof window.renderHub === 'function') {
          try { window.renderHub(); } catch (_) {}
        }
        // After landing back at the root, re-push a fresh sentinel so
        // the NEXT system-back press still triggers popstate (instead
        // of leaving the site).
        if (navStack.length === 1) {
          ensureRootSentinel();
        }
      } finally {
        isPopping = false;
      }
    } else {
      // navStack === root. The user pressed back while on the hub.
      // Show the logout modal AND re-push the sentinel so successive
      // back presses keep firing popstate (instead of leaving on the
      // very next press).
      ensureRootSentinel();
      if (typeof window.openLogoutModal === 'function') {
        window.openLogoutModal();
      } else {
        // Fallback: dispatch a click on the existing logout button
        // so we don't silently swallow the user's intent.
        const btn = document.querySelector('[onclick*="openLogoutModal"]');
        if (btn && typeof btn.click === 'function') btn.click();
      }
    }
  });

  // Run setup as early as possible. ui.js (which defines showScreen)
  // loads BEFORE this file in the page's script order, so showScreen
  // is already on window — no need to wait for DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOnce);
  } else {
    setupOnce();
  }
})();
