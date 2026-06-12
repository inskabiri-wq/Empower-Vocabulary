/* ============================================================
   Teacher Dashboard — Confusing Word Pairs (shared module)
   Lets teachers flag word pairs that students confuse (delete/remove,
   exercise/workout, etc.). The flagged pairs are stored at
   settings/confusingPairs in Firestore and read by student/js/games.js
   so those words stop appearing as distractors of each other.

   Public API:
     ConfusingPairs.mount(containerId)   — render the card into the
                                          DOM element with that id
     ConfusingPairs.reload()             — re-fetch from Firestore
                                          and re-render every mount

   Permissions (intentionally split so teachers can crowdsource but
   only admins can prune):
     • addPair    — any signed-in teacher (or admin)
     • removePair — admins only
   ============================================================ */

(function () {
  'use strict';

  // ── Module state ─────────────────────────────────────────────
  const State = {
    pairs: [],              // [{ a, b, note, by, byName, at }]
    mounts: new Set(),      // container IDs the card is rendered into
    loaded: false           // becomes true after first Firestore read
  };

  // ── Util ─────────────────────────────────────────────────────
  // Uses the existing global escapeHtml (defined in teacher/js/config.js).
  // Falls back to a minimal local impl so this module also works in
  // isolation if loaded out of order.
  function esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Use the existing toast modals from teacher/js/modals.js. They're
  // global functions; this module is a thin shim — if those are not
  // available (very early in load), fall back to console / alert.
  function ok(title, msg)   { if (typeof showSuccess === 'function') showSuccess(title, msg); else console.log(title, msg); }
  function err(title, msg)  { if (typeof showError   === 'function') showError(title, msg);   else alert(title + ': ' + msg); }
  function ask(icon, title, msg, btn, fn) {
    if (typeof showConfirm === 'function') showConfirm(icon, title, msg, btn, fn);
    else AppDialog.confirm(msg, { title: title, okLabel: btn, icon: icon, danger: true })
      .then(function (okv) { if (okv) fn(); });
  }

  function currentUser() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        return firebase.auth().currentUser || null;
      }
    } catch (_) {}
    return null;
  }
  function userIsAdmin() {
    return typeof isAdmin === 'function' ? !!isAdmin() : false;
  }

  // ── Render ───────────────────────────────────────────────────
  function html() {
    const pairs = State.pairs;
    const admin = userIsAdmin();
    const rows = pairs.length === 0
      ? `<div class="av-empty">No flagged pairs yet. Add the first one below — the system will stop offering these as wrong-answer options to each other.</div>`
      : `<table class="av-table av-cp-table">
           <thead>
             <tr>
               <th>Target word</th>
               <th>Confused with</th>
               <th>Flagged by</th>
               <th>Note</th>
               ${admin ? '<th class="av-th-narrow"></th>' : ''}
             </tr>
           </thead>
           <tbody>
             ${pairs.map(p => `
               <tr>
                 <td><span class="av-cp-word">${esc(p.a)}</span></td>
                 <td><span class="av-cp-word">${esc(p.b)}</span></td>
                 <td><span class="av-row-text">${esc(p.byName || p.by || '—')}</span></td>
                 <td><span class="av-row-text">${esc(p.note || '')}</span></td>
                 ${admin ? `<td class="av-th-narrow">
                   <button class="av-class-remove"
                           data-cp-action="remove"
                           data-cp-a="${esc(p.a)}"
                           data-cp-b="${esc(p.b)}"
                           title="Remove this pair"
                           aria-label="Remove">×</button>
                 </td>` : ''}
               </tr>
             `).join('')}
           </tbody>
         </table>`;

    return `
      <div class="av-card av-cp-card" data-cp-card="1">
        <div class="av-cp-head">
          <div>
            <div class="av-cp-title">🚩 Confusing word pairs</div>
            <div class="av-cp-sub">When two words are too close in meaning, flag them here. Multiple-choice and listening-mode questions will stop using either word as a distractor for the other.</div>
          </div>
          <span class="av-badge av-c-amber">${pairs.length}</span>
        </div>
        ${rows}
        <div class="av-cp-form">
          <input type="text" class="av-input av-cp-input" data-cp-field="a"
                 placeholder="Target word (e.g. delete)" maxlength="40" autocomplete="off"/>
          <input type="text" class="av-input av-cp-input" data-cp-field="b"
                 placeholder="Confused with (e.g. remove)" maxlength="40" autocomplete="off"/>
          <input type="text" class="av-input av-cp-input" data-cp-field="note"
                 placeholder="Optional note" maxlength="80" autocomplete="off"/>
          <button class="av-btn av-btn--solid" data-cp-action="add">+ Flag pair</button>
        </div>
        <div class="av-cp-hint">${admin
          ? "Order doesn't matter — the pair is bidirectional. Already-flagged pairs are ignored on duplicate submit."
          : "Order doesn't matter — the pair is bidirectional. Only admins can remove a flagged pair."
        }</div>
      </div>
    `;
  }

  function renderInto(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = html();
  }

  function renderAll() {
    State.mounts.forEach(id => renderInto(id));
  }

  // ── Firestore ────────────────────────────────────────────────
  async function load() {
    if (typeof db === 'undefined' || !db.collection) return;
    try {
      const doc = await db.collection('settings').doc('confusingPairs').get();
      const raw = doc.exists ? (doc.data().pairs || []) : [];
      State.pairs = raw.filter(p => p && p.a && p.b);
      State.loaded = true;
      renderAll();
    } catch (e) {
      console.warn('[confusing-pairs] load failed:', e);
      State.pairs = [];
      State.loaded = true;
      renderAll();
    }
  }
  function reload() { return load(); }

  async function addPair(cardEl) {
    // Any teacher can flag a pair — no admin gate here.
    const user = currentUser();
    if (!user) return err('Sign In Required', 'Please sign in before flagging pairs.');

    const aEl = cardEl.querySelector('[data-cp-field="a"]');
    const bEl = cardEl.querySelector('[data-cp-field="b"]');
    const nEl = cardEl.querySelector('[data-cp-field="note"]');
    if (!aEl || !bEl) return;

    const a = String(aEl.value || '').trim().toLowerCase();
    const b = String(bEl.value || '').trim().toLowerCase();
    const note = String((nEl && nEl.value) || '').trim();

    if (!a || !b) return err('Missing Words', 'Type both the target word and the word students confused it with.');
    if (a === b)  return err('Same Word', 'The two words must be different.');

    // Bidirectional duplicate-check
    const dup = State.pairs.some(p => {
      const pa = String(p.a || '').toLowerCase(), pb = String(p.b || '').toLowerCase();
      return (pa === a && pb === b) || (pa === b && pb === a);
    });
    if (dup) return err('Already Flagged', `'${a}' ↔ '${b}' is already on the list.`);

    try {
      const ref = db.collection('settings').doc('confusingPairs');
      const doc = await ref.get();
      const existing = doc.exists ? (doc.data().pairs || []) : [];
      const entry = {
        a, b,
        note: note || '',
        by:     user.email || '',
        byName: user.displayName || user.email || '',
        at:     Date.now()
      };
      const next = [...existing, entry];
      await ref.set({ pairs: next }, { merge: true });

      State.pairs = next;
      aEl.value = ''; bEl.value = ''; if (nEl) nEl.value = '';
      ok('Pair Flagged', `${a} ↔ ${b} will no longer appear as distractors of each other.`);

      if (typeof ActivityLogger !== 'undefined' && typeof ActivityConfig !== 'undefined') {
        try {
          await ActivityLogger.log(ActivityConfig.types.TEACHER_UPDATED, {
            action: 'confusing_pair_added', a, b, note
          });
        } catch (_) {}
      }

      renderAll();
      // Re-focus the first input in the SAME card so admins/teachers
      // can rapid-fire add multiple pairs.
      setTimeout(() => {
        const card = State.mounts.size > 0
          ? Array.from(State.mounts).map(id => document.getElementById(id)).filter(Boolean)[0]
          : null;
        if (card) {
          const focusEl = card.querySelector('[data-cp-field="a"]');
          if (focusEl) focusEl.focus();
        }
      }, 0);
    } catch (e) {
      console.error('Error adding confusing pair:', e);
      err('Error', 'Failed to flag: ' + (e?.message || e));
    }
  }

  async function removePair(a, b) {
    if (!userIsAdmin()) return err('Admin Only', 'Only administrators can remove a flagged pair. Ask your admin to remove it for you.');
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    ask('🗑️', 'Remove flagged pair?',
      `'${a}' ↔ '${b}' will start showing as a distractor again. Continue?`,
      'Yes, Remove',
      async () => {
        try {
          const ref = db.collection('settings').doc('confusingPairs');
          const doc = await ref.get();
          const existing = doc.exists ? (doc.data().pairs || []) : [];
          const next = existing.filter(p => {
            const pa = String(p.a || '').toLowerCase(), pb = String(p.b || '').toLowerCase();
            return !((pa === a && pb === b) || (pa === b && pb === a));
          });
          await ref.set({ pairs: next }, { merge: true });
          State.pairs = next;
          ok('Removed', `${a} ↔ ${b} is no longer flagged.`);
          if (typeof ActivityLogger !== 'undefined' && typeof ActivityConfig !== 'undefined') {
            try {
              await ActivityLogger.log(ActivityConfig.types.TEACHER_UPDATED, {
                action: 'confusing_pair_removed', a, b
              });
            } catch (_) {}
          }
          renderAll();
        } catch (e) {
          console.error('Error removing confusing pair:', e);
          err('Error', 'Failed to remove: ' + (e?.message || e));
        }
      }
    );
  }

  // ── Mount + event delegation ─────────────────────────────────
  function mount(containerId) {
    if (!containerId) return;
    State.mounts.add(containerId);
    if (State.loaded) {
      renderInto(containerId);
    } else {
      // First mount triggers the load — initial render is the empty
      // (loading) state, then renderAll() fires once data arrives.
      renderInto(containerId);
      load();
    }
  }

  // Single document-level listener handles every card on the page.
  // Each card is identified by data-cp-card="1".
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-cp-card]');
    if (!card) return;
    const trigger = e.target.closest('[data-cp-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-cp-action');
    if (action === 'add')    { addPair(card); return; }
    if (action === 'remove') { removePair(trigger.dataset.cpA, trigger.dataset.cpB); return; }
  });

  // Enter in any of the input fields = submit.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!e.target.matches || !e.target.matches('[data-cp-field]')) return;
    const card = e.target.closest('[data-cp-card]');
    if (!card) return;
    e.preventDefault();
    addPair(card);
  });

  // ── Public API ───────────────────────────────────────────────
  window.ConfusingPairs = { mount, reload, load };
})();
