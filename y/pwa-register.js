/* ============================================================
   EMPOWER LAB — PWA registration
   ------------------------------------------------------------
   Registers the service worker. Resilient + feature-detected:
   a failure here NEVER breaks the page (the app works exactly
   the same with or without the SW — the SW is pure enhancement).

   Update behaviour: when a NEW service worker takes control after
   a deploy, the page reloads ONCE so the student lands on the
   latest version with no manual hard-refresh. On the very first
   install we deliberately do NOT reload (avoids a pointless
   first-load refresh).

   To fully remove the PWA later: delete service-worker.js +
   manifest.json + this file + the few <link>/<script> tags, OR
   call navigator.serviceWorker.controller.postMessage('UNREGISTER').
   ============================================================ */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    // Was this page already controlled by a SW when it loaded?
    //   • false → first-ever install. Don't reload on controllerchange.
    //   • true  → an UPDATE is taking over → reload once to get fresh.
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;

    navigator.serviceWorker.register('/service-worker.js')
      .catch(function (err) {
        // Non-fatal. Page keeps working without offline/install.
        if (window.console && console.warn) {
          console.warn('[pwa] service worker registration failed (non-fatal):',
            err && err.message ? err.message : err);
        }
      });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) return;   // first install — nothing to refresh
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
})();
