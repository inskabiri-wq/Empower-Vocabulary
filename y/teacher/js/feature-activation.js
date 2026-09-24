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
    { id: 'vocabulary', icon: '📚', name: 'Vocabulary', group: 'Skills' },
    { id: 'listening',  icon: '🎧', name: 'Listening', group: 'Skills' },
    { id: 'grammar',    icon: '✏️', name: 'Grammar', group: 'Skills' },
    { id: 'reading',    icon: '📖', name: 'Reading', group: 'Skills' },
    { id: 'writing',    icon: '✍️', name: 'Writing', group: 'Skills' },
    { id: 'speaking',   icon: '🎤', name: 'Speaking', group: 'Skills' },
    { id: 'classroom',  icon: '🎮', name: 'Classroom Mode', group: 'Skills' },
    { id: 'courses',    icon: '🎓', name: 'Courses', group: 'Skills' },
    // Placement is OPT-IN (default off): the student tile shows only when this
    // toggle is explicitly ON and the student matches placementConfig.scope.
    { id: 'placement',  icon: '🎯', name: 'Placement Test', group: 'Skills' },
    // Individual classroom games - deactivating one hides its card from the
    // teacher's Classroom game picker (classroom-teacher.html).
    { id: 'game_vocabRace', icon: '🏁', name: 'Vocab Race', group: 'Classroom games' },
    { id: 'game_grammar',   icon: '🏁', name: 'Grammar Race', group: 'Classroom games' },
    { id: 'game_heist',     icon: '💰', name: 'The Heist', group: 'Classroom games' },
    { id: 'game_trust',     icon: '🕵️', name: 'Trust No One', group: 'Classroom games' },
    { id: 'game_reading',   icon: '📖', name: 'Reading Exam', group: 'Classroom games' },
    { id: 'game_listening', icon: '🎧', name: 'Listening Exam', group: 'Classroom games' },
    { id: 'game_tug',       icon: '🪢', name: 'Tug of War', group: 'Classroom games' },
    { id: 'game_bingo',     icon: '🎱', name: 'Vocab Bingo', group: 'Classroom games' },
    { id: 'game_scramble',  icon: '🔀', name: 'Sentence Scramble', group: 'Classroom games' },
    // The AI Quiz. Its launcher (#pickAiQuiz) and its gate entry
    // (game_aiquiz, in the toggle map at the foot of classroom-teacher.html)
    // both existed already - this row was the missing half, so the switch had
    // nothing to draw and an admin could never turn the game off.
    { id: 'game_aiquiz',    icon: '🤖', name: 'AI Quiz', group: 'Classroom games' },
    // Vocabulary practice modes - deactivating one hides its card from the
    // vocabulary screen (student dashboard).
    { id: 'mode_choice',        icon: '📋', name: 'Multiple Choice', group: 'Vocabulary modes' },
    { id: 'mode_match',         icon: '🎴', name: 'Match', group: 'Vocabulary modes' },
    { id: 'mode_reverse',       icon: '🎧', name: 'Listening Mode', group: 'Vocabulary modes' },
    { id: 'mode_spelling',      icon: '✏️', name: 'Spelling', group: 'Vocabulary modes' },
    { id: 'mode_fillblank',     icon: '📖', name: 'Fill in the Blank', group: 'Vocabulary modes' },
    { id: 'mode_order',         icon: '🧩', name: 'Word Order', group: 'Vocabulary modes' },
    { id: 'mode_pronunciation', icon: '🗣️', name: 'Pronunciation', group: 'Vocabulary modes' },
    { id: 'mode_unscramble',    icon: '🔡', name: 'Unscramble', group: 'Vocabulary modes' },
    // Grammar practice games - deactivating one hides it from the grammar Quest
    // Board picker + challenge rows (student dashboard grammar screen). Keys are
    // gmode_* so they never collide with the vocabulary mode_* keys above.
    { id: 'gmode_choice',     icon: '🎯', name: 'Multiple Choice', group: 'Grammar games' },
    { id: 'gmode_fill',       icon: '📝', name: 'Fill in the Blank', group: 'Grammar games' },
    { id: 'gmode_unscramble', icon: '🧩', name: 'Unscramble', group: 'Grammar games' }
  ];

  let toggles = {};   // settings/featureToggles data

  const $ = id => document.getElementById(id);

  // Cards styled with the admin v2 (t2) tokens so the panel matches the
  // Admin page's stat cards: surface bg, soft border, 12px radius.
  function card(f) {
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
  }

  function render() {
    const box = $('featureToggleList');
    if (!box) return;
    // Group the toggles into sections so the panel stays readable as it grows.
    const groups = [];
    FEATURES.forEach(f => {
      const name = f.group || 'Other';
      let g = groups.find(x => x.name === name);
      if (!g) { g = { name: name, items: [] }; groups.push(g); }
      g.items.push(f);
    });
    box.innerHTML = groups.map(g =>
      '<div style="grid-column:1 / -1; margin:8px 2px 0; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--t2-text-muted,#7d8590);">' + g.name + '</div>' +
      g.items.map(card).join('')
    ).join('');
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
