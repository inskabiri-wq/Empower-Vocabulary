/* ============================================================
   org-registry.js  —  Phase H
   Client-side mirror of /settings/organizations.

   Single source of truth for "which email domains are allowed
   to register" + "which can host teachers". Shared between:
     • Registration page (index.html)        — pre-auth email check
     • Admin dashboard (teacher-dashboard)   — org management UI
     • Any other code that needs domain info

   The rule layer enforces the same data — this module is for UX
   (showing the user a friendly error before submit). Tampering
   with this client cache CAN'T grant access; Firestore rules
   re-check against the real /settings/organizations on every
   write attempt.

   Hardcoded fallback: if the settings doc doesn't exist (or
   hasn't been seeded yet), we fall back to the original FSM
   domains so the live deployment never locks anyone out. This
   matches the grandfather clause in firestore.rules.

   Public API (window.OrgRegistry):
     • allowedDomains()          → ['fsm.edu.tr', 'stu.fsm.edu.tr', ...]
     • teacherEligibleDomains()  → subset of allowedDomains
     • list()                    → full org records with metadata
     • checkEmail(email)         → { ok, domain, org, reason }
     • subscribe(cb)             → live updates (returns unsub fn)
     • ready                     → Promise<void> resolves once first load is in
   ============================================================ */

(function () {
  'use strict';

  // ── Hardcoded fallback. Matches the grandfather branch in
  // firestore.rules — if the settings doc is missing, we still
  // treat these as allowed so existing FSM users can log in.
  const FALLBACK = {
    list: [
      { name: 'FSM University (Staff)',    domain: 'fsm.edu.tr',     active: true, teacherEligible: true },
      { name: 'FSM University (Students)', domain: 'stu.fsm.edu.tr', active: true, teacherEligible: false }
    ],
    activeDomains:          ['fsm.edu.tr', 'stu.fsm.edu.tr'],
    teacherEligibleDomains: ['fsm.edu.tr']
  };

  // Internal state — overwritten by the live snapshot. Always
  // an object with the three keys above; never null after the
  // first frame.
  let _state = FALLBACK;
  let _unsub = null;
  const _subscribers = new Set();
  let _resolveReady;
  const _ready = new Promise((res) => { _resolveReady = res; });

  function _emit() {
    _subscribers.forEach((cb) => {
      try { cb(_state); } catch (e) { console.error('[OrgRegistry] subscriber threw:', e); }
    });
  }

  // Normalize a doc into the shape we care about. Tolerant to
  // partial / missing fields so a half-typed admin write doesn't
  // throw — we just fall back to defaults for whatever's missing.
  function _normalize(data) {
    if (!data || typeof data !== 'object') return FALLBACK;
    const list = Array.isArray(data.list) ? data.list.filter(o => o && o.domain) : [];
    const activeDomains = Array.isArray(data.activeDomains)
      ? data.activeDomains.filter(d => typeof d === 'string' && d.length > 0)
      : list.filter(o => o.active !== false).map(o => String(o.domain).toLowerCase());
    const teacherEligibleDomains = Array.isArray(data.teacherEligibleDomains)
      ? data.teacherEligibleDomains.filter(d => typeof d === 'string' && d.length > 0)
      : list.filter(o => o.active !== false && o.teacherEligible === true)
            .map(o => String(o.domain).toLowerCase());
    // ALWAYS union the fallback FSM domains in so the existing
    // deployment can never accidentally lock itself out — mirrors
    // the hardcoded grandfather in firestore.rules.
    const merged = {
      list,
      activeDomains:          Array.from(new Set([...FALLBACK.activeDomains,          ...activeDomains])),
      teacherEligibleDomains: Array.from(new Set([...FALLBACK.teacherEligibleDomains, ...teacherEligibleDomains]))
    };
    return merged;
  }

  // Wire up a live listener. Lazy — only attaches once `init()`
  // is called (typically by the page that needs the data).
  function init() {
    if (_unsub) return _ready;   // already started
    if (typeof db === 'undefined') {
      console.warn('[OrgRegistry] db is not defined yet; will retry shortly');
      setTimeout(init, 200);
      return _ready;
    }
    try {
      _unsub = db.collection('settings').doc('organizations').onSnapshot(
        (snap) => {
          _state = snap.exists ? _normalize(snap.data()) : FALLBACK;
          _emit();
          if (_resolveReady) { _resolveReady(); _resolveReady = null; }
        },
        (err) => {
          console.warn('[OrgRegistry] snapshot error — falling back to defaults:', err.message || err);
          _state = FALLBACK;
          _emit();
          if (_resolveReady) { _resolveReady(); _resolveReady = null; }
        }
      );
    } catch (e) {
      console.warn('[OrgRegistry] init failed — using defaults:', e);
      _state = FALLBACK;
      if (_resolveReady) { _resolveReady(); _resolveReady = null; }
    }
    return _ready;
  }

  function teardown() {
    if (_unsub) { try { _unsub(); } catch (_) {} _unsub = null; }
  }

  // ── Helpers ────────────────────────────────────────────────
  function allowedDomains()         { return _state.activeDomains.slice(); }
  function teacherEligibleDomains() { return _state.teacherEligibleDomains.slice(); }
  function list()                   { return _state.list.slice(); }

  // Parse an email and tell the caller whether it's accepted.
  // Returns { ok: bool, domain: string|null, org: object|null, reason: string }.
  // Defensive — handles null/empty/malformed strings without throwing.
  function checkEmail(email) {
    if (!email || typeof email !== 'string') {
      return { ok: false, domain: null, org: null, reason: 'Email is empty.' };
    }
    const e = email.trim().toLowerCase();
    const parts = e.split('@');
    if (parts.length !== 2 || !parts[1]) {
      return { ok: false, domain: null, org: null, reason: 'Email format is invalid.' };
    }
    const domain = parts[1];
    if (_state.activeDomains.indexOf(domain) === -1) {
      return {
        ok: false,
        domain,
        org: null,
        reason: 'This domain is not authorized to register. Allowed domains: ' +
                _state.activeDomains.map(d => '@' + d).join(', ')
      };
    }
    const org = _state.list.find(o => String(o.domain).toLowerCase() === domain) || null;
    return { ok: true, domain, org, reason: '' };
  }

  // Subscribe to live updates. Returns an unsubscribe function.
  function subscribe(cb) {
    if (typeof cb !== 'function') return () => {};
    _subscribers.add(cb);
    // Fire once immediately with current state so subscribers
    // don't have to handle "what if I subscribed after init?"
    try { cb(_state); } catch (e) { console.error(e); }
    return () => { _subscribers.delete(cb); };
  }

  window.OrgRegistry = {
    init, teardown,
    allowedDomains, teacherEligibleDomains, list,
    checkEmail, subscribe,
    ready: _ready,
    // Exposed for the admin UI's "factory reset" affordance — read-only.
    FALLBACK: Object.freeze(JSON.parse(JSON.stringify(FALLBACK)))
  };

  // Auto-init when the page loads and the SDK is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 50));
  } else {
    setTimeout(init, 50);
  }
})();
