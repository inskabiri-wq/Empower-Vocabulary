/* ============================================================
   PLACEMENT TEST - student hub tile
   ------------------------------------------------------------
   Shows a Placement card on the hub grid ONLY when
   settings/placementConfig is active AND the signed-in student
   matches its scope (shared check: course-target.js). One
   attempt: when /placementResults/{uid} exists, the card shows
   the recommended level instead of a start state (the runner
   page also refuses a second run; rules block overwrites).
   Self-healing: hub.js rebuilds #hubGrid on re-render, so a
   MutationObserver re-appends the card whenever it vanishes.
   ============================================================ */
(function () {
  'use strict';

  var state = null; // { done: bool, level: 'B1' } once eligible
  // Set when the live toggle says placement is off and this tenant hides
  // inactive tiles. ensureCard() checks it, so an in-flight boot() that
  // resolves AFTER the switch was flipped cannot put the card back.
  var suppressed = false;

  function db_() { return (typeof db !== 'undefined') ? db : (window.firebase && firebase.firestore ? firebase.firestore() : null); }

  function buildCard() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-card' + (state.off ? ' is-off' : '');
    btn.id = 'placementHubCard';
    btn.dataset.skill = 'placement';
    btn.setAttribute('aria-label', 'Open Placement Test');
    btn.style.setProperty('--pct', '0');
    btn.style.setProperty('--skill-accent', '#1e40af');
    // Same convention as every other feature-toggled skill. Where the tenant
    // sets hideInactiveTiles the card is not built at all (see boot()); this
    // grayed "Not activated" state is what the other tenants get.
    var sub = state.off ? 'Not activated'
      : (state.done ? ('Completed - recommended ' + state.level) : 'Find your English level');
    var pill = state.off ? '<span class="hub-live-pill hub-off-pill">OFF</span>'
      : '<span class="hub-live-pill">' + (state.done ? 'DONE' : 'TEST') + '</span>';
    btn.innerHTML =
      '<div class="hub-ring" style="--pct:0"><span class="hub-icon" aria-hidden="true">🎯</span></div>' +
      '<div class="hub-meta"><div class="hub-name">Placement</div>' +
      '<div class="hub-sub">' + sub + '</div></div>' +
      '<div class="hub-pct">' + pill + '</div>';
    btn.addEventListener('click', function () {
      if (state.off) {
        if (typeof AppDialog !== 'undefined' && AppDialog.alert) AppDialog.alert('The Placement Test is not activated for your programme.');
        return;
      }
      try { if (typeof logActivity === 'function') logActivity('skill_opened', { skill: 'placement' }); } catch (_) {}
      window.location.href = 'placement.html';
    });
    return btn;
  }

  function ensureCard() {
    if (suppressed || !state) return;
    var grid = document.getElementById('hubGrid');
    if (!grid || document.getElementById('placementHubCard')) return;
    var ph = document.getElementById('placementHubSkeleton');
    if (ph) ph.remove();                       // real card replaces the placeholder
    grid.appendChild(buildCard());
  }

  // Hold the slot from the first paint. Without this the tile popped in after
  // its reads, a beat behind the skill cards that need no network at all.
  // Removed either when the real card arrives or when the student turns out
  // not to be in scope for the placement test.
  function ensureSkeleton() {
    var grid = document.getElementById('hubGrid');
    if (!grid || document.getElementById('placementHubSkeleton')
        || document.getElementById('placementHubCard')) return;
    var s = document.createElement('div');
    s.id = 'placementHubSkeleton';
    s.className = 'hub-card as-skeleton';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<div class="hub-ring"></div>'
      + '<div class="hub-meta"><div class="sk-line sk-line-lg"></div>'
      + '<div class="sk-line sk-line-sm"></div></div>';
    grid.appendChild(s);
  }
  function dropSkeleton() {
    var ph = document.getElementById('placementHubSkeleton');
    if (ph) ph.remove();
  }

  function boot(user) {
    var d = db_();
    if (!d || !user) return;
    // auth.js already cached this student's document. Reuse it instead of
    // re-reading: one less document in this batch, and the remaining reads
    // are no longer paced by the slowest of four.
    var cached = window.currentStudentData;
    // Prefer the batch hub-preload.js already has in flight; only issue our
    // own reads if it never ran. Same documents either way - this just stops
    // us queueing a second round behind the hub's.
    var P = window.LLPreload;
    Promise.all([
      (P && P.get('placementConfig')) || d.collection('settings').doc('placementConfig').get(),
      cached ? Promise.resolve(null) : ((P && P.get('userDoc')) || d.collection('users').doc(user.uid).get()),
      (P && P.get('placementResult')) || d.collection('placementResults').doc(user.uid).get(),
      (P && P.get('featureToggles')) || d.collection('settings').doc('featureToggles').get()
    ]).then(function (res) {
      var cfg = res[0].exists ? (res[0].data() || {}) : {};
      var userDoc = cached ? cached : (res[1] && res[1].exists ? (res[1].data() || {}) : {});
      // Prefer the value feature-toggles.js holds. Its own read here is a
      // plain .get(), which Firestore is free to answer from the OFFLINE CACHE,
      // so on a fresh sign-in it can come back empty or stale - and this card
      // then paints from it and gets corrected a moment later by the
      // 'feature-toggles-ready' handler below. That is the placement card's own
      // copy of the tile flash. window.featureToggles is primed at parse time
      // from the last visit and replaced by a SERVER snapshot, so when it is
      // known it is the better answer. The read stays as the fallback for the
      // very first sign-in on a device.
      var toggles = (window.featureToggles != null)
        ? window.featureToggles
        : (res[3].exists ? (res[3].data() || {}) : {});
      // Staff (teacher / admin) see the card too. It used to be students-only,
      // so on an admin account the skeleton painted and was pulled a moment
      // later - the tile "appeared for a second then disappeared". Staff also
      // bypass targeting below, since scope is written in terms of students.
      var isStaff = userDoc.role === 'teacher' || userDoc.role === 'admin';
      // TARGETING (placementConfig.scope) decides WHO gets the card at all;
      // the Admin > Features toggle decides its state: ON = live, OFF (or not
      // yet enabled) = hidden where hideInactiveTiles is set, grayed otherwise.
      // ACTIVATION is authoritative. This used to pass a hardcoded
      // `active: true` into courseActiveFor, so placementConfig.active was
      // read by nobody and turning the switch OFF in the admin panel changed
      // nothing at all - the card stayed up regardless.
      if (cfg.active !== true) { dropSkeleton(); return; }
      // TARGETING then decides WHO among students gets it. Staff bypass it so
      // they can preview; they do not bypass the activation switch above.
      var inScope = (typeof window.courseActiveFor === 'function')
        ? window.courseActiveFor({ active: true, scope: cfg.scope || {} }, userDoc)
        : true;
      if (!inScope && !isStaff) { dropSkeleton(); return; }
      var r = res[2].exists ? (res[2].data() || {}) : null;
      var placementOff = toggles.placement !== true;
      // The placement card builds itself and appends to the hub grid, so it
      // never went through hub.js and never learned about hideInactiveTiles.
      // Every other tile disappears when its skill is switched off; this one
      // stayed as a greyed "Not activated" card, which is why deactivation
      // "worked for everything except placement". Same rule for both now.
      var hideInactive = !!(window.Tenant && window.Tenant.feature('hideInactiveTiles', false));
      if (placementOff && hideInactive) { suppressed = true; dropSkeleton(); return; }
      state = { off: placementOff, done: !!r, level: (r && r.recommendedLevel) || '' };
      ensureCard();
      // hub.js wipes the grid on every render - put the card back each time.
      var grid = document.getElementById('hubGrid');
      if (grid) new MutationObserver(function () { ensureCard(); }).observe(grid, { childList: true });
    }).catch(function () { dropSkeleton(); })
      // Card added, or ruled out: the placement slot is settled either way.
      .then(function () { try { if (window.LLHubBoot) LLHubBoot.ready('placement'); } catch (_) {} });
  }

  // feature-toggles.js is a LIVE listener now, so the placement switch can flip
  // while the page is open. Without this the card kept whatever state it read
  // at sign-in while every other tile updated around it.
  document.addEventListener('feature-toggles-ready', function () {
    if (!booted) return;                       // boot() has not read config yet
    var ft = window.featureToggles || {};
    var off = ft.placement !== true;
    var hideInactive = !!(window.Tenant && window.Tenant.feature('hideInactiveTiles', false));
    if (off && hideInactive) {
      suppressed = true;
      var card = document.getElementById('placementHubCard');
      if (card) card.remove();
      dropSkeleton();
      return;
    }
    suppressed = false;
    if (state) { state.off = off; ensureCard(); }
  });

  // Wait for sign-in by LISTENING, not by polling. This used to wake up every
  // 400ms and ask "is the user here yet?", so the card sat idle for up to
  // 400ms after auth resolved before its reads even started - which is why it
  // appeared noticeably later than the other hub cards. onAuthStateChanged
  // fires the moment the session is restored. Exactly the same four reads.
  var booted = false;
  function start(user) {
    if (booted || !user) return;
    booted = true;
    // boot() appends to #hubGrid, so make sure the grid exists first.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { ensureSkeleton(); boot(user); });
    } else {
      ensureSkeleton();
      boot(user);
    }
  }
  function watchAuth(tries) {
    tries = (tries == null) ? 25 : tries;
    var a = (typeof auth !== 'undefined') ? auth
      : (window.firebase && firebase.auth ? firebase.auth() : null);
    if (!a) {                                    // SDK not parsed yet (rare)
      if (tries > 0) setTimeout(function () { watchAuth(tries - 1); }, 100);
      return;
    }
    if (a.currentUser) { start(a.currentUser); return; }
    a.onAuthStateChanged(function (u) { start(u); });
  }
  watchAuth();
})();
