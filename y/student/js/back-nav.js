/* ============================================================
   STUDENT DASHBOARD - Phone-back-button integration
   ----------------------------------------------------------------
   Mobile users tapping the system back button used to fall out of
   the page entirely (since the dashboard is a SPA - no real history
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
       time - letting the browser do raw step-by-step popping would
       leave stale entries that visit "phantom" intermediate screens.
     • Every call to the existing `showScreen()` is intercepted; we
       update navStack and push a hashState so popstate fires when
       the system back button is pressed.
     • A small recursion guard (`isPopping`) prevents the popstate
       handler from re-pushing while we're navigating to the new top.
   ============================================================ */

(function () {
  'use strict';

  // The single source of truth for "where am I in the app" - root is
  // index 0 (hubScreen), top is the currently-active screen.
  const navStack = ['hubScreen'];
  let isPopping = false;

  // Capture the original showScreen so popstate can call it without
  // re-triggering our patched version's history side-effects.
  let origShowScreen = null;

  // Bounded retry. This used to loop every 30ms forever; on any page that
  // loads back-nav.js WITHOUT defining showScreen that is an immortal timer.
  var setupTries = 0;

  function setupOnce() {
    if (typeof window.showScreen !== 'function') {
      // ui.js may not have parsed yet - back off and retry. Cheap.
      if (++setupTries > 200) return;          // ~6s, then give up quietly
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
    // navigate the user OFF the page entirely - popstate never fires
    // because there's nothing for the browser to pop INTO within our
    // document. The sentinel gives back-press a target inside the
    // page, which fires popstate, which we use to open the logout
    // modal instead of letting the user leave.
    const initial = (document.querySelector('.screen.active') || {}).id || 'hubScreen';
    if (initial !== navStack[0]) {
      navStack[0] = initial;
    }
    history.replaceState({ screen: initial, depth: 1 }, '', '#' + initial);
    // NOTE: mobile Chrome ignores history entries a page pushes with NO user
    // gesture (its anti "history-trap" intervention), so a sentinel pushed here
    // at load time is skipped and the first Back press walks straight out of the
    // app. We arm the sentinel on the first real interaction instead, when the
    // push is user-activated and Back is reliably trapped. Desktop is unaffected.
    armSentinelOnFirstGesture(initial);
  }

  // ---- The sentinel ----------------------------------------------
  // A spare history entry above where the app actually is, so a system-back
  // press has something INSIDE this document to pop into and therefore fires
  // popstate instead of leaving the site.
  //
  // WHY IT IS RE-ARMED ON EVERY GESTURE, not pushed once:
  // Chrome (and Samsung Internet, which is Chromium) runs a "history
  // manipulation" intervention. An entry created by pushState is marked
  // SKIPPABLE if it was pushed without user activation and the user never
  // interacted with the page while on it. Back then skips straight past it -
  // and past the entry below - and the PWA closes. That is exactly the
  // reported symptom.
  //
  // The old code pushed once on the first gesture (correctly activated) but
  // every later re-push happened inside the popstate handler, which carries NO
  // user activation. So the first Back worked and each one after it was
  // skippable. Now the listeners stay attached for the life of the page and
  // re-arm whenever the sentinel has been consumed, so every sentinel that
  // matters was pushed during a real tap.
  var sentinelInPlace = false;
  var GESTURES = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];

  // `activated` records whether this push happened during a real user gesture.
  // Only an activated push is allowed to satisfy sentinelInPlace: a push made
  // without activation may be silently skipped by the browser, so treating it
  // as "covered" would suppress the gesture re-arm that actually works and put
  // us straight back to the app closing on Back.
  function pushSentinel(activated) {
    var top = navStack[navStack.length - 1];
    history.pushState({ screen: top, depth: navStack.length, sentinel: true }, '', '#' + top);
    if (activated) sentinelInPlace = true;
  }

  function armSentinelOnFirstGesture(initial) {
    if (!navStack[navStack.length - 1]) navStack[navStack.length - 1] = initial;
    function arm() {
      if (sentinelInPlace) return;             // already have one, do not stack
      pushSentinel(true);                      // inside a real gesture
    }
    // Capture phase so this runs before nav click handlers, and NOT removed
    // after the first call - see the note above.
    GESTURES.forEach(function (e) { window.addEventListener(e, arm, true); });
  }

  // Best-effort re-push straight after a pop. This one has no user activation,
  // so the browser may mark it skippable - it is a belt-and-braces entry for
  // the case where the user presses Back twice without touching anything in
  // between. The reliable re-arm is the gesture listener above, and any tap
  // (including dismissing the logout modal) triggers it.
  function ensureRootSentinel() {
    pushSentinel(false);                       // no activation available here
  }

  // ---- Phone / system back button --------------------------------
  window.addEventListener('popstate', () => {
    if (!origShowScreen) return; // setup didn't complete; bail safely

    // Whatever entry we were sitting on has just been popped, so any sentinel
    // is gone. Clearing this lets the next real tap push a properly
    // user-activated replacement.
    sentinelInPlace = false;

    // A screen can refuse to be left. The listening and reading exams do:
    // walking out mid-attempt loses the answers, and on a phone the system
    // back gesture is very easy to trigger by accident. The screen owns the
    // warning; we just re-push a history entry so the gesture is undone and
    // the student stays where they were.
    const leaving = navStack[navStack.length - 1];
    const guard = window.screenExitGuards && window.screenExitGuards[leaving];
    if (typeof guard === 'function' && guard() === false) {
      ensureRootSentinel();
      return;
    }

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
  // is already on window - no need to wait for DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOnce);
  } else {
    setupOnce();
  }
})();
