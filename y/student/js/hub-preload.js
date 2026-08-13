/* ============================================================
   HUB PRELOAD - one batch of reads, started as early as possible
   ------------------------------------------------------------
   Before this, each widget on the hub waited for auth and THEN
   started its own reads: the placement tile fetched
   settings/placementConfig, settings/featureToggles and
   placementResults/{uid}; assignments fetched the profile again.
   Those batches ran one after another, behind the hub's own reads,
   so the tiles painted first and placement / assignments landed a
   beat later and pushed the layout down.

   This starts every one of them in a SINGLE parallel batch the
   moment auth resolves, and hands out the promises. A widget that
   asks for a document it needs gets the already-in-flight read
   instead of issuing a second one.

   It does not add a single read - it removes duplicates (the user
   document is fetched once here and shared) and overlaps the rest.

   Usage:  LLPreload.get('placementConfig').then(...)
   ============================================================ */
(function () {
  'use strict';
  if (window.LLPreload) return;

  var cache = {};
  var started = false;

  function db_() {
    if (typeof db !== 'undefined' && db) return db;
    return (window.firebase && firebase.firestore) ? firebase.firestore() : null;
  }

  // Every document the hub's widgets need, read at once.
  function start(user) {
    if (started || !user) return;
    var d = db_();
    if (!d) return;
    started = true;

    cache.placementConfig = d.collection('settings').doc('placementConfig').get();
    cache.featureToggles  = d.collection('settings').doc('featureToggles').get();
    cache.placementResult = d.collection('placementResults').doc(user.uid).get();
    // auth.js caches the student profile on window; only read it if it is absent.
    cache.userDoc = window.currentStudentData
      ? Promise.resolve({ exists: true, data: function () { return window.currentStudentData; } })
      : d.collection('users').doc(user.uid).get();

    // A rejected promise nobody has attached to yet is an unhandled rejection.
    // Widgets attach their own handlers; this keeps the console clean until then.
    Object.keys(cache).forEach(function (k) {
      cache[k] = cache[k].catch(function (e) { return { exists: false, _error: e, data: function () { return null; } }; });
    });
  }

  window.LLPreload = {
    // Returns the in-flight read, or null if preload never ran (caller falls
    // back to its own fetch, so this can only help, never break a widget).
    get: function (key) { return cache[key] || null; },
    ready: function () { return started; },
    start: start
  };

  // Kick off as soon as we know who the user is.
  function wait() {
    var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
    if (!a) { setTimeout(wait, 40); return; }
    if (a.currentUser) { start(a.currentUser); return; }
    a.onAuthStateChanged(function (u) { if (u) start(u); });
  }
  wait();
})();
