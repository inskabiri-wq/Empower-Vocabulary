/* ============================================================
   LINGUALAB - PWA registration
   ------------------------------------------------------------
   Registers the service worker. Resilient + feature-detected:
   a failure here NEVER breaks the page (the app works exactly
   the same with or without the SW - the SW is pure enhancement).

   Update behaviour: registration only. The page is never reloaded
   from here. HTML is served network-first and assets are versioned
   with ?v=N, so a deploy is already picked up on the next
   navigation; reloading on top of that only produced a second load
   that raced the sign-in redirect. See the note further down.

   To fully remove the PWA later: delete service-worker.js +
   manifest.json + this file + the few <link>/<script> tags, OR
   call navigator.serviceWorker.controller.postMessage('UNREGISTER').
   ============================================================ */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(function (err) {
        // Non-fatal. Page keeps working without offline/install.
        if (window.console && console.warn) {
          console.warn('[pwa] service worker registration failed (non-fatal):',
            err && err.message ? err.message : err);
        }
      });

    // NO reload on controllerchange. This used to call location.reload() when a
    // new worker took over, and it is what made the app load twice on every
    // open and land unpredictably on either the dashboard or the login page.
    //
    // Two things made the reload both useless and harmful:
    //
    // 1. It was never needed. service-worker.js serves HTML NETWORK-FIRST, so
    //    every navigation already fetches the current page, and the assets it
    //    references carry ?v=N, so a bumped asset is a different URL that misses
    //    the cache anyway. There was nothing stale left for the reload to fix.
    //
    // 2. It raced the sign-in redirect. The worker calls skipWaiting() on
    //    install and clients.claim() on activate, so after any deploy it takes
    //    control within the first moments of the very first page - exactly when
    //    index/js/main.js is doing location.replace() to the right dashboard.
    //    Whichever landed first decided where the app ended up, which is why it
    //    was random.
    //
    // The new worker still controls the page the moment it claims it, and every
    // later navigation uses it. Nothing about freshness depends on reloading.
  });
})();
