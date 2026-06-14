/* ============================================================
   EMPOWER LAB — Service Worker (PWA)
   ------------------------------------------------------------
   Goal: installable + fast repeat-opens + offline shell, WITHOUT
   ever serving a stale version after you deploy, and WITHOUT
   touching live data or auth.

   Strategy:
     • HTML pages  → NETWORK-FIRST. Always fetch the latest page;
       fall back to cache only when truly offline. Students never
       get stuck on an old page.
     • Static files (css/js/png/woff/json) → CACHE-FIRST within the
       current version, so repeat opens are instant. The cache name
       is VERSIONED — bump CACHE_VERSION on each meaningful deploy
       and the `activate` step purges the old cache, so a new deploy
       refreshes assets cleanly.
     • Firebase / Google / any cross-origin request → NOT touched.
       Passes straight to the network, so scores, assignments, auth,
       and real-time data are NEVER cached or stale.
     • GET only. POST/PUT/etc. pass straight through.

   Kill-switch: post 'UNREGISTER' to the SW (or just bump the
   version) to wipe caches. See pwa-register.js comments.

   ⚠️  When you deploy a change, bump CACHE_VERSION below (e.g. v1 → v2)
       so returning students pick up the new static assets. HTML is
       always network-first so pages are fresh regardless.
   ============================================================ */

const CACHE_VERSION = 'v46';
const CACHE_NAME = 'empower-shell-' + CACHE_VERSION;
const CACHE_PREFIX = 'empower-shell-';

// Tiny precache — just the login entry + manifest/icon so the very
// first offline open shows something. Everything else is cached
// on-demand as the student navigates. Kept minimal so install is fast.
const PRECACHE = [
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// ── Install: precache the shell, activate immediately ──────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => { /* precache failure is non-fatal */ })
  );
});

// ── Activate: purge old version caches, take control ───────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── Fetch: route by request type ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GETs. Everything else (form posts, Firestore writes via
  // XHR/fetch) goes straight to network, untouched.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Cross-origin (Firebase, Google, gstatic, fonts CDN, soundhelix…)
  // → never intercept. Live data + auth always hit the network direct.
  if (url.origin !== self.location.origin) return;

  // HTML navigations → NETWORK-FIRST. Fresh page every time online;
  // cached fallback (or the cached index shell) when offline.
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Stash a copy for offline fallback.
        try {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        } catch (_) {}
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Same-origin static assets → CACHE-FIRST (instant), fall back to
  // network, and cache the network response for next time.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        try {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        } catch (_) {}
      }
      return fresh;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});

// ── Kill-switch / manual update hooks ──────────────────────────
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
    return;
  }
  if (data === 'UNREGISTER' || (data && data.type === 'UNREGISTER')) {
    event.waitUntil((async () => {
      try { await self.registration.unregister(); } catch (_) {}
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});
