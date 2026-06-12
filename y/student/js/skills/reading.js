/* ============================================================
   SKILL — Reading
   Renders the Reading skill home: a level pill row (A2/B1/B1+/B2)
   and a list of exam cards for the active level. Each card has
   two launch buttons — Timed (60 min) and Untimed practice — that
   delegate to openReadingExam() in reading-exam.js.

   Data source: window.READINGS_INDEX, owned by reading-exam.js.
   The home renders cards from that index; if a level has no exams
   we show an empty state instead.
   ============================================================ */

(function () {
  'use strict';

  // Level list is derived from EXAM_REGISTRY so adding a new level
  // (A1, C1, etc.) is a one-line edit there — no parallel update
  // here. Falls back to the historical list if the registry hasn't
  // loaded yet (race on cold boot).
  const LEVELS = (typeof window.EXAM_REGISTRY !== 'undefined' && typeof window.EXAM_REGISTRY.levelsFor === 'function')
    ? window.EXAM_REGISTRY.levelsFor('reading')
    : ['A1', 'A2', 'B1', 'B1+', 'B2'];

  // Track which level is currently shown. Default to B2 since that's
  // where our content lives today; if the student's profile level is
  // available we use that instead so they land on relevant content.
  let activeLevel = 'B2';

  function getProfileLevel() {
    try {
      const lvl = (window.selectedLevel || localStorage.getItem('level') || '').trim();
      if (LEVELS.indexOf(lvl) !== -1) return lvl;
    } catch (_) {}
    return null;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Render the level pill row. Highlights the active level.
  function renderLevels() {
    const el = document.getElementById('readingLevelTabs');
    if (!el) return;
    el.innerHTML = '';
    LEVELS.forEach(lvl => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rd-level-tab' + (lvl === activeLevel ? ' is-active' : '');
      btn.textContent = lvl;
      btn.setAttribute('aria-pressed', lvl === activeLevel ? 'true' : 'false');
      btn.addEventListener('click', () => {
        activeLevel = lvl;
        renderLevels();
        renderExamList();
      });
      el.appendChild(btn);
    });
  }

  // Render the exam cards for the active level. Empty state if none.
  function renderExamList() {
    const list = document.getElementById('readingExamList');
    if (!list) return;
    list.innerHTML = '';

    const idx = (window.READINGS_INDEX && window.READINGS_INDEX[activeLevel]) || [];
    if (!idx.length) {
      list.innerHTML = `
        <div class="rd-exam-empty">
          No exams yet for ${escHtml(activeLevel)} — coming soon.
        </div>`;
      return;
    }

    idx.forEach(meta => {
      const card = document.createElement('div');
      card.className = 'rd-exam-card';
      card.innerHTML = `
        <div class="rd-exam-icon" aria-hidden="true">📖</div>
        <div class="rd-exam-meta">
          <div class="rd-exam-title">${escHtml(meta.title)}</div>
          <div class="rd-exam-sub">${escHtml(meta.subtitle || '')}</div>
        </div>
        <div class="rd-exam-modes">
          <button type="button" class="rd-exam-mode-btn timed" data-mode="timed">⏱ Timed ${meta.timeLimitMin || 60} min</button>
          <button type="button" class="rd-exam-mode-btn" data-mode="untimed">📖 Untimed</button>
        </div>
      `;

      // Wire both mode buttons. We delegate to reading-exam.js's
      // openReadingExam(level, examId, mode), which handles loading
      // the JSON, building the screen, and starting the timer.
      card.querySelectorAll('.rd-exam-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-mode');
          if (typeof window.openReadingExam !== 'function') {
            console.warn('[reading] openReadingExam() not available');
            return;
          }
          // For TIMED mode, request fullscreen synchronously inside
          // the click handler so the user-gesture is preserved
          // (browsers reject requestFullscreen if it isn't directly
          // tied to a user activation). Fire-and-forget — we don't
          // await it because openReadingExam needs to run regardless.
          if (mode === 'timed') {
            const el = document.documentElement;
            const req = el.requestFullscreen || el.webkitRequestFullscreen ||
                        el.mozRequestFullScreen || el.msRequestFullscreen;
            if (req) { try { req.call(el); } catch (_) {} }
          }
          window.openReadingExam(activeLevel, meta.id, mode);

          // Activity log so the teacher dashboard can track engagement.
          try {
            if (typeof logActivity === 'function') {
              logActivity('reading_exam_started', {
                level: activeLevel, examId: meta.id, mode
              });
            }
          } catch (_) {}
        });
      });

      list.appendChild(card);
    });
  }

  function renderReadingScreen() {
    // Honor profile level on first render only — subsequent renders
    // (e.g. after picking a tab) keep the user's chosen level.
    const profile = getProfileLevel();
    if (profile && !window.__rdLevelTouched) {
      activeLevel = profile;
    }
    renderLevels();
    renderExamList();
  }

  // Mark the level as user-touched once the screen is shown so we
  // don't reset to profile every time they revisit.
  function markTouched() { window.__rdLevelTouched = true; }

  window.renderReadingScreen = renderReadingScreen;

  document.addEventListener('DOMContentLoaded', renderReadingScreen);

  // Re-render whenever the user navigates into the Reading screen,
  // so the exam index reflects any READINGS_INDEX updates and the
  // active level stays consistent. We hook showScreen() once.
  (function hookShowScreen() {
    if (typeof window.showScreen !== 'function') {
      // showScreen may not be defined yet at this point in load order.
      // Try again on next tick.
      setTimeout(hookShowScreen, 50);
      return;
    }
    if (window.__rdShowScreenHooked) return;
    window.__rdShowScreenHooked = true;
    const original = window.showScreen;
    window.showScreen = function (id) {
      const ret = original.apply(this, arguments);
      if (id === 'readingScreen') {
        markTouched();
        renderReadingScreen();
      }
      return ret;
    };
  })();
})();
