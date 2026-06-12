/* ============================================================
   ACCOUNT GATE — runs after a successful auth, BEFORE we let the
   student land on the dashboard.
   ----------------------------------------------------------------
   Two checks:

     1. Yearly expiry.
        Accounts older than 365 days from `registeredAt` are flipped
        `active: false` and the student is signed out with a "contact
        administration" message. Already-inactive accounts get the
        same treatment without re-flipping.

     2. Bi-monthly verification due.
        If `now − lastVerifiedAt > 60 days` (or `lastVerifiedAt` is
        missing — legacy accounts), the student must re-confirm their
        level, class, module, and academic year on the dashboard.
        We don't block login for this case — we just set a sessionStorage
        flag and let the dashboard render a blocking modal.

   Returns an object so callers can decide what to do:
     { ok: true }                                          → proceed
     { ok: false, reason: 'expired'|'inactive',
       message: '…' }                                       → block + show
     { ok: true, needsVerification: true }                 → proceed, flag set

   Designed to be loaded as a plain <script> alongside firebase-
   compat (no module system). Exposes window.AccountGate. Callers:

     • index/js/main.js (login + Google sign-in)
     • index/js/auth.js (post-register / post-verify redirect)
     • student-dashboard.html (re-check on every dashboard load —
       belt-and-braces so a stale tab can't bypass the gate)
   ============================================================ */
(function () {
  'use strict';

  // Time windows in milliseconds. Centralized here so it's easy to
  // tweak later (e.g. tighter dev mode = 5 minutes).
  const ONE_YEAR_MS    = 365 * 24 * 60 * 60 * 1000;
  const SIXTY_DAYS_MS  =  60 * 24 * 60 * 60 * 1000;

  // Pull a JS Date out of a Firestore Timestamp, Firestore server
  // sentinel pending value (null), or a plain ISO string. Returns
  // null if we can't extract one.
  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v === 'number') return new Date(v);
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /**
   * Run the gate against a freshly-read user doc.
   *
   * @param  {firebase.firestore.Firestore} db
   * @param  {string} uid
   * @return {Promise<{ ok: boolean, reason?: string, message?: string, needsVerification?: boolean }>}
   */
  async function check(db, uid) {
    let userDoc;
    try {
      userDoc = await db.collection('users').doc(uid).get();
    } catch (e) {
      // Network / permissions failure — fail OPEN here so a transient
      // hiccup doesn't lock everyone out. Server-side rules still
      // enforce role/scope on every read & write downstream.
      console.warn('[account-gate] could not read user doc:', e);
      return { ok: true };
    }
    if (!userDoc.exists) return { ok: true };           // legacy / not-yet-created
    const u = userDoc.data() || {};

    // Teachers/admins are never gated (their workflow doesn't follow
    // the student modular curriculum).
    if (u.role === 'teacher' || u.role === 'admin') return { ok: true };

    // ── Check 1: explicit deactivation ─────────────────────────
    if (u.active === false) {
      return {
        ok: false,
        reason: 'inactive',
        message: 'Your account has been deactivated. Please contact your school administrator to reactivate it.'
      };
    }

    // ── Check 2: yearly expiry ─────────────────────────────────
    const reg = toDate(u.registeredAt) || toDate(u.createdAt);   // fallback for legacy users
    if (reg && (Date.now() - reg.getTime() > ONE_YEAR_MS)) {
      // First time we noticed: flip active to false so subsequent
      // logins short-circuit at Check 1.
      try {
        await db.collection('users').doc(uid).update({ active: false });
      } catch (e) {
        // If the write fails (rules / network), still return the
        // expired message — defence in depth.
        console.warn('[account-gate] could not flip active:', e);
      }
      return {
        ok: false,
        reason: 'expired',
        message: 'Your account has expired (one-year limit). Please contact your school administrator to renew it.'
      };
    }

    // ── Check 3: bi-monthly verification due ───────────────────
    // Legacy users without lastVerifiedAt also trip this (treated as
    // overdue, which is the safest fail-open default — they go
    // through the dashboard verification modal once, then they're set).
    const lastV = toDate(u.lastVerifiedAt);
    const verificationDue = !lastV || (Date.now() - lastV.getTime() > SIXTY_DAYS_MS);
    if (verificationDue) {
      try { sessionStorage.setItem('needsVerification', '1'); } catch (_) {}
      return { ok: true, needsVerification: true };
    }
    // Clear stale flag if we used to need verification and don't now.
    try { sessionStorage.removeItem('needsVerification'); } catch (_) {}
    return { ok: true };
  }

  // Tiny convenience: format a deactivation message into an inline
  // banner on the login page (or wherever the caller injects HTML).
  function renderInlineBlocker(message) {
    const w = document.createElement('div');
    w.className = 'account-gate-block';
    w.setAttribute('role', 'alert');
    w.style.cssText = [
      'background: rgba(239, 68, 68, 0.10)',
      'border: 1px solid rgba(239, 68, 68, 0.45)',
      'border-radius: 12px',
      'padding: 14px 18px',
      'margin: 14px 0',
      'color: #fecaca',
      'font-size: 0.95em',
      'line-height: 1.5'
    ].join(';');
    w.innerHTML = '<strong style="color:#fca5a5;">🔒 Account locked.</strong><br>' +
      (message || '').replace(/</g, '&lt;');
    return w;
  }

  window.AccountGate = { check, renderInlineBlocker };
})();
