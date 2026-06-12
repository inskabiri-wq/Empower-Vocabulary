/* ============================================================
   REFRESH GUARD — shared across all classroom-mode student pages
   ----------------------------------------------------------------
   Intercepts F5 / Ctrl+R / Cmd+R keyboard shortcuts while a game
   is in flight and shows a themed two-step confirmation modal
   ("Are you sure?" → "Really? Your game will close.") before
   allowing the reload.

   The URL-bar refresh button can't be reliably intercepted
   (browsers don't expose it to keyboard handlers) — that path
   still fires the standard beforeunload native prompt which
   each game's student JS already wires up. The keyboard path
   was the more common accidental-refresh vector reported.

   Usage:
     1. <script src="classroom/js/refresh-guard.js"></script>
        from each classroom-{game}-student.html
     2. From the game's student JS, set:
          window.refreshGuardShouldProtect = () => boolean
        Return true when the game is in flight and the student
        should be double-confirmed before refreshing. The
        function is polled on each keydown; default = always
        protect, which is the safest fallback.

   The modal classes (.modal-overlay, .modal-content, etc.) live
   in classroom/css/styles.css and are guaranteed to be loaded
   on every classroom student page.
   ============================================================ */
(function () {
  'use strict';

  function shouldProtect() {
    try {
      if (typeof window.refreshGuardShouldProtect === 'function') {
        return !!window.refreshGuardShouldProtect();
      }
    } catch (_) {}
    return true;            // safer default if the host JS forgot to set the fn
  }

  function makeModal(title, message, okLabel, okIsDanger) {
    return new Promise(resolve => {
      const bg = document.createElement('div');
      bg.className = 'modal-overlay';
      bg.style.display = '';
      bg.innerHTML = `
        <div class="modal-content" style="max-width: 420px;">
          <h3 class="modal-title">${title}</h3>
          <p class="modal-message">${message}</p>
          <div class="modal-buttons">
            <button type="button" class="modal-btn modal-btn-cancel" data-r="0">Cancel</button>
            <button type="button" class="modal-btn modal-btn-confirm" data-r="1" ${okIsDanger ? 'style="background:linear-gradient(135deg,#ef4444,#f43f5e);box-shadow:0 8px 22px -10px rgba(239,68,68,0.6);"' : ''}>${okLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(bg);
      // Force reflow then add .active for the scale-in animation.
      void bg.offsetWidth;
      bg.classList.add('active');
      const cleanup = (val) => {
        bg.classList.remove('active');
        // Wait for the transition out before removing, so the closing
        // animation is visible.
        setTimeout(() => { try { bg.remove(); } catch (_) {} }, 220);
        resolve(val);
      };
      bg.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.dataset || !('r' in t.dataset)) {
          // Click on the overlay backdrop = cancel.
          if (t === bg) cleanup(false);
          return;
        }
        cleanup(t.dataset.r === '1');
      });
      // Focus the cancel button so a hasty Enter doesn't auto-confirm
      // a destructive default. Esc cancels.
      setTimeout(() => {
        const cn = bg.querySelector('[data-r="0"]');
        if (cn) cn.focus();
      }, 50);
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      };
      bg.addEventListener('keydown', onKey);
    });
  }

  async function runDoubleConfirm() {
    const ok1 = await makeModal(
      '⚠️ Refresh this tab?',
      'You\'re in the middle of a classroom game. Refreshing will disconnect you from the room.',
      'Yes, refresh',
      false
    );
    if (!ok1) return false;
    const ok2 = await makeModal(
      '🚪 Are you absolutely sure?',
      'This will close your session for good. You\'ll have to ask the teacher for the code again to rejoin.',
      'Close my game',
      true
    );
    return !!ok2;
  }

  let inFlight = false;
  function handler(e) {
    // F5
    const isF5 = e.key === 'F5';
    // Ctrl+R or Cmd+R (not Ctrl+Shift+R since that's force-reload —
    // also intercept it to be safe).
    const isCmdR = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R');
    if (!isF5 && !isCmdR) return;
    if (!shouldProtect()) return;
    e.preventDefault();
    e.stopPropagation();
    if (inFlight) return;        // user is already mid-prompt; don't stack
    inFlight = true;
    runDoubleConfirm().then(yes => {
      inFlight = false;
      if (yes) {
        // Programmatic reload — bypasses our handler since it doesn't
        // dispatch a key event.
        window.location.reload();
      }
    });
  }

  // Capture phase so we beat any page-level handlers that might also
  // intercept refresh keys.
  window.addEventListener('keydown', handler, true);
})();
