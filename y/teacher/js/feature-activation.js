/* ============================================================
   FEATURE ACTIVATION - admin panel (#tab-admin)
   ------------------------------------------------------------
   Per-organization on/off switches for every student hub tile,
   stored in settings/featureToggles: { vocabulary: false, ... }.
   A missing key means ACTIVE. Writes are admin-only (the general
   /settings rule); the Admin tab itself is admin-only too.

   Deactivating never deletes anything: the student hub renders the
   tile grayed with a "Not activated" state (hub.js + feature-toggles.js)
   and all progress data stays untouched.
   ============================================================ */
(function () {
  'use strict';

  const FEATURES = [
    { id: 'vocabulary', icon: '📚', name: 'Vocabulary' },
    { id: 'listening',  icon: '🎧', name: 'Listening' },
    { id: 'grammar',    icon: '✏️', name: 'Grammar' },
    { id: 'reading',    icon: '📖', name: 'Reading' },
    { id: 'writing',    icon: '✍️', name: 'Writing' },
    { id: 'speaking',   icon: '🎤', name: 'Speaking' },
    { id: 'classroom',  icon: '🎮', name: 'Classroom Mode' },
    { id: 'courses',    icon: '🎓', name: 'Courses' }
  ];

  let toggles = {};   // settings/featureToggles data

  const $ = id => document.getElementById(id);

  // Cards styled with the admin v2 (t2) tokens so the panel matches the
  // Admin page's stat cards: surface bg, soft border, 12px radius.
  function render() {
    const box = $('featureToggleList');
    if (!box) return;
    box.innerHTML = FEATURES.map(f => {
      const on = toggles[f.id] !== false;
      return `<div style="display:flex; align-items:center; gap:12px; padding:16px 18px;
                   background: var(--t2-surface, #161b22);
                   border: 1px solid ${on ? 'var(--t2-border, #30363d)' : 'rgba(125,133,144,0.45)'};
                   border-radius: 12px; ${on ? '' : 'opacity:0.75;'}">
        <span style="font-size:22px; line-height:1;">${f.icon}</span>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; font-size:14px; color: var(--t2-text, #e6edf3);">${f.name}</div>
          <div style="font-size:11px; font-weight:600; margin-top:2px; color:${on ? 'var(--t2-green, #22c55e)' : 'var(--t2-text-muted, #7d8590)'};">${on ? 'Active' : 'Not activated'}</div>
        </div>
        <button type="button" class="ft-toggle" data-fid="${f.id}"
          style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:500;
                 color: var(--t2-text-muted, #7d8590); background: transparent;
                 border: 1px solid var(--t2-border, #30363d); border-radius: 20px;
                 padding: 5px 14px; transition: all 0.15s;">${on ? 'Deactivate' : 'Activate'}</button>
      </div>`;
    }).join('');
    box.querySelectorAll('.ft-toggle').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.color = 'var(--t2-text, #e6edf3)'; btn.style.borderColor = 'var(--t2-text-muted, #7d8590)'; });
      btn.addEventListener('mouseleave', () => { btn.style.color = 'var(--t2-text-muted, #7d8590)'; btn.style.borderColor = 'var(--t2-border, #30363d)'; });
      btn.addEventListener('click', () => flip(btn.getAttribute('data-fid')));
    });
  }

  async function flip(fid) {
    const u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return;
    const turningOff = toggles[fid] !== false;
    if (turningOff && typeof AppDialog !== 'undefined' && AppDialog.confirm) {
      const f = FEATURES.find(x => x.id === fid);
      const ok = await AppDialog.confirm('Deactivate ' + (f ? f.name : fid) + '? Students will see it as "Not activated". Nothing is deleted and all progress is kept.');
      if (!ok) return;
    }
    try {
      await db.collection('settings').doc('featureToggles').set({
        [fid]: !turningOff,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: u.uid
      }, { merge: true });
      toggles[fid] = !turningOff;
      render();
    } catch (e) {
      console.error('feature toggle', e);
      if (typeof AppDialog !== 'undefined') AppDialog.alert('Could not save (admin only): ' + e.message);
    }
  }

  async function load() {
    try {
      const snap = await db.collection('settings').doc('featureToggles').get();
      toggles = snap.exists ? (snap.data() || {}) : {};
    } catch (e) { console.warn('featureToggles load', e); }
    render();
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 400); return; }
    if (!$('featureToggleList')) return;
    const waitAuth = () => {
      if (auth.currentUser) { load(); return; }
      setTimeout(waitAuth, 500);
    };
    waitAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
