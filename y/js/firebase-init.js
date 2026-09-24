/* ============================================================
   FIREBASE INIT - start Firebase once, for the right university.
   ------------------------------------------------------------
   Every page used to carry its own copy of the Firebase config:
   27 files, all repeating the same apiKey and projectId. That is
   what made a second university a 27-file edit instead of a
   one-line setting.

   Now there is one copy, in js/tenant.js, chosen by web address.
   A page loads:

       <script src="js/tenant.js"></script>
       <script src="js/firebase-init.js"></script>

   after the Firebase SDK scripts and before any page code, and
   gets `firebase.app()`, `firebase.auth()` and `firebase.firestore()`
   already pointed at the correct project.

   SAFETY: NO FALLBACK HERE, ON PURPOSE.
   Everywhere else in this migration a missing setting falls back to
   the old hard-coded value, because the worst case is cosmetic. This
   setting is the exception, and it is worth understanding why.

   If a page failed to load js/tenant.js and this file quietly fell
   back to FSMVU, then that page - possibly a page being served to a
   DIFFERENT university - would connect its users to FSMVU's database.
   A broken page is an inconvenience. Two universities sharing one
   database is a data breach.

   So when the tenant config is missing this refuses to start Firebase
   and says so loudly. Fail closed, never fail into someone else's data.

   This file is deliberately dependency-free and runs immediately.
   It does not create globals other than the Firebase ones the app
   already expects.
   ============================================================ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.error('firebase-init: the Firebase SDK must load before this file.');
    return;
  }

  var cfg = window.Tenant && window.Tenant.get('firebase', null);

  if (!cfg || !cfg.projectId) {
    // Deliberately fatal. See the note above: guessing a project here
    // could point one university's users at another's data.
    console.error('firebase-init: no tenant config. This page must load '
      + 'js/tenant.js BEFORE js/firebase-init.js. Firebase was NOT started.');
    return;
  }

  // Idempotent: several pages pull in more than one script that used to
  // initialise Firebase, so re-running must never throw.
  if (!firebase.apps.length) firebase.initializeApp(cfg);

  // Handy for support: which university and which project is this page on?
  window.FIREBASE_PROJECT_ID = cfg.projectId;

  // LOCAL TESTING ONLY: talk to the Firebase emulators instead of production.
  // Runs only when BOTH are true: the page is served from localhost AND the
  // tester has set localStorage.useEmulators = '1'. Production domains and
  // normal local previews are untouched. See y/tools/README-emulator-e2e.md.
  //
  // WHY IT IS HERE and not only in the two config.js files. student/js/config.js
  // and teacher/js/config.js have carried this block for a while, which covered
  // 10 of the 32 pages. The other 22 - app.html, courses, placement,
  // writing-exam, and most of the classroom pages - load only this file, so
  // they could never be driven against the emulator and could not be tested
  // logged in at all. Putting it here covers every page that starts Firebase.
  //
  // IT MUST RUN HERE, right after initializeApp. Firestore refuses settings
  // changes once the client has started ("Firestore has already been started
  // and its settings can no longer be changed"), so this is the last safe
  // moment. That failure is also the reason it cannot be bolted on later from
  // a page script.
  //
  // The 10 pages that also load a config.js now call useEmulator TWICE.
  // MEASURED on a fresh app instance before any query: the second call is a
  // no-op for both auth and firestore, so the duplicate is harmless and those
  // files are left alone rather than edited for the sake of tidiness.
  try {
    if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
        localStorage.getItem('useEmulators') === '1') {
      firebase.auth().useEmulator('http://127.0.0.1:9099');
      firebase.firestore().useEmulator('127.0.0.1', 8080);
      console.warn('[emulator] connected to LOCAL Auth (9099) + Firestore (8080)');
    }
  } catch (e) { /* never block app boot */ }
})();
