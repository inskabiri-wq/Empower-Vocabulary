/* ============================================================
   FEATURE TOGGLES - student dashboard loader
   ------------------------------------------------------------
   Reads settings/featureToggles once after sign-in and exposes it
   as window.featureToggles, then tells hub.js to re-render so
   deactivated tiles show their grayed "Not activated" state.
   A missing doc or a load error means everything stays active.
   Uses the dashboard's global `db` + `auth`.
   ============================================================ */
(function () {
  'use strict';

  // Hide any vocabulary practice MODE cards an admin deactivated
  // (settings/featureToggles.mode_*). 3 cards have ids; the other 5 only have an
  // inline startActivity('X') handler, so we match those by the onclick string.
  var MODE_BY_ID = { mode_spelling: 'spellingCard', mode_fillblank: 'fillblankCard', mode_order: 'orderCard' };
  var MODE_BY_ACT = { mode_match: 'match', mode_choice: 'choice', mode_reverse: 'reverse', mode_pronunciation: 'pronunciation', mode_unscramble: 'unscramble' };
  function applyModeGating() {
    var ft = window.featureToggles || {};
    Object.keys(MODE_BY_ID).forEach(function (k) {
      if (ft[k] === false) { var e = document.getElementById(MODE_BY_ID[k]); if (e) e.style.display = 'none'; }
    });
    var cards = document.querySelectorAll('.activity-card');
    Object.keys(MODE_BY_ACT).forEach(function (k) {
      if (ft[k] !== false) return;
      cards.forEach(function (card) {
        var oc = card.getAttribute('onclick') || '';
        if (oc.indexOf("startActivity('" + MODE_BY_ACT[k] + "')") !== -1) card.style.display = 'none';
      });
    });
  }

  // LIVE, not a one-shot get().
  //
  // This used to be `.get()`, which reads the document once at sign-in. Two
  // things followed from that, and together they are the "I have to refresh
  // twice to see whether it is on or off" complaint:
  //   1. A teacher flipping a switch changed nothing on a page that was
  //      already open - the student had to reload at all.
  //   2. Firestore's offline cache can answer that first `get()` from cache,
  //      so reload #1 could still show the OLD value and only reload #2 showed
  //      the new one.
  // onSnapshot removes both: the switch takes effect immediately, with no
  // refresh, and there is no cache-then-server race to lose. It REPLACES the
  // read rather than adding one - a single listener on one small document.
  var unsub = null;
  var lastPublished = null;                  // serialised copy of what we last announced
  var haveServer = false;                    // has a SERVER snapshot landed yet?
  var offlineTimer = null;

  // ---- Remembering the toggles between visits -------------------------
  // Waiting for the server snapshot removed the WRONG-tiles flash, but it left
  // a real cost: the hub sits on skeletons for a whole round trip, and on a
  // phone on campus wifi that is long enough to read as "it loaded twice"
  // anyway. The toggles change perhaps a few times a term, so last visit's copy
  // is almost always today's answer.
  //
  // Priming from it means a returning student gets the CORRECT grid in the very
  // first paint: no skeletons, no repaint. If the server then disagrees - a
  // teacher did flip something - publish() fires and the grid repaints once,
  // which is honest and rare. A first-ever sign-in has nothing cached and still
  // waits on skeletons, which is the right thing to show when we genuinely do
  // not know yet.
  //
  // This runs at PARSE time, not on DOMContentLoaded, so window.featureToggles
  // is already populated before hub.js does its first render.
  var LS_KEY = 'll-feature-toggles';

  function readCache() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      // Must be a plain object. Anything else (an array, a string, null) would
      // read as toggles and quietly mis-gate the grid.
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
    } catch (_) { return null; }
  }

  function writeCache(v) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (_) {}
  }

  // NB the second argument to JSON.stringify is a REPLACER, not a sort. An
  // array of the object's own keys happens to give a stable key order, which is
  // what is wanted here, but it is not "sorting" the object and it would
  // silently drop nested keys if this document ever gains any.
  function sigOf(v) {
    return JSON.stringify(v || {}, Object.keys(v || {}).sort());
  }

  (function prime() {
    if (window.featureToggles != null) return;   // something already set them
    var cached = readCache();
    if (!cached) return;
    window.featureToggles = cached;

    // SEED THE PUBLISHED SIGNATURE, not just the toggles.
    //
    // This line is the whole fix for "everything refreshes twice". Priming from
    // the cache paints the correct grid immediately, but lastPublished stayed
    // null, so the first SERVER snapshot always compared unequal - even when it
    // agreed with the cache to the byte - and published. hub.js,
    // placement-tile.js and student-assignments.js all re-render on that event,
    // which is exactly the profile icon, the classroom tile and the assignment
    // card all visibly redrawing a moment after the page had settled.
    //
    // Nothing has re-rendered yet at parse time and hub.js reads
    // window.featureToggles directly on its first render, so there is no event
    // to fire here - only a signature to remember, so that a server snapshot
    // which CONFIRMS the cache stays silent. A server snapshot that genuinely
    // differs still publishes and still repaints, which is correct and rare.
    lastPublished = sigOf(cached);
  })();

  function publish(next) {
    // ONLY announce a real change. A trigger that changes nothing must not
    // make the hub repaint, because a repaint is visible.
    var sig = sigOf(next);
    if (sig === lastPublished) return;
    lastPublished = sig;
    // hub.js, placement-tile.js and student-assignments.js re-render on this.
    document.dispatchEvent(new CustomEvent('feature-toggles-ready'));
  }

  function load() {
    if (unsub) return;                       // never attach twice

    // Offline fallback. If no SERVER snapshot ever arrives (the student is on a
    // dead connection) we must still let the hub draw, or it sits on skeletons
    // forever. Deliberately shorter than hub.js's own safety net so that this
    // path, which at least has the cached toggles, always wins the race.
    offlineTimer = setTimeout(function () {
      if (haveServer) return;
      haveServer = true;                     // stop suppressing; cache is all we will get
      publish(window.featureToggles || {});
    }, 3500);

    unsub = db.collection('settings').doc('featureToggles')
      .onSnapshot(function (snap) {
        var next = snap.exists ? (snap.data() || {}) : {};
        window.featureToggles = next;
        try { applyModeGating(); } catch (e) { console.warn('mode gating', e); }

        // WAIT FOR THE SERVER SNAPSHOT BEFORE THE FIRST ANNOUNCEMENT.
        //
        // onSnapshot delivers twice: once from the local cache, then again from
        // the server. The previous guard compared the two payloads and dropped
        // the second if they matched - which fixed the case where they DO
        // match, and did nothing for the case that actually bites.
        //
        // On a fresh sign-in they routinely differ. The cache often has no copy
        // of settings/featureToggles at all, so snap.exists is false and `next`
        // is {} - and an empty toggle map reads as "every skill is active".
        // That publishes a full grid, and the server snapshot a moment later
        // publishes the real, smaller one. That is precisely the reported
        // "logs in, refreshes once, then again, and hides the tiles".
        //
        // So the first announcement now waits for metadata.fromCache to be
        // false. The student's first grid is then the correct grid, with
        // skeletons (not wrong tiles) shown while we wait. Once the server has
        // answered we stop suppressing, so a teacher flipping a switch still
        // reaches an open page instantly.
        if (!haveServer && snap.metadata && snap.metadata.fromCache) return;
        haveServer = true;
        if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }

        // Only a SERVER answer is worth remembering for next time.
        writeCache(next);
        publish(next);
      }, function (e) {
        console.warn('featureToggles', e);
        // A listener that fails must not leave the app with no toggles at all:
        // absent means "everything active", which is the safe default. It also
        // must not leave the hub waiting on a server snapshot that is never
        // coming, so this releases the suppression and cancels the fallback.
        haveServer = true;
        if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
        if (!window.featureToggles) window.featureToggles = {};
        publish(window.featureToggles);
      });
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 500); return; }
    const waitAuth = (tries) => {
      if (auth.currentUser) { load(); return; }
      if (tries <= 0) return;
      setTimeout(() => waitAuth(tries - 1), 500);
    };
    waitAuth(40);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
