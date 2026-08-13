/* ============================================================
   SKILL — Listening
   Lists listening activities (currently just the FSMEPT exam).
   Launching the exam reuses the existing listening-exam.js flow
   untouched — we only wrap the entry point.
   ============================================================ */

(function () {
  'use strict';

  // Exams shown on the Listening skill home.
  // Add more entries here as new exams / practice modes are built.
  const LISTENING_ACTIVITIES = [
    {
      id: 'fsmept-exam-1',
      examId: 'sample-fsmept',         // matches EXAM_REGISTRY listening id (for hide-from-practice)
      title: 'Listening Exam 1',
      subtitle: 'FSMEPT practice',
      icon: '🎧',
      handler: 'startListeningExam'    // existing global from listening-exam.js
    }
  ];

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Renders the SAME exam row Reading uses (.rd-exam-card, shared in
  // reading-exam.css). It used to build a small square .activity-card tile in a
  // 240px auto-fill grid, so the one listening exam sat in the corner as a
  // lonely box while Reading showed full-width rows - two exam screens with two
  // different boxes. The old card also set its background and border as INLINE
  // styles, which outrank any stylesheet, so no CSS could have aligned them.
  function renderListeningScreen() {
    const list = document.getElementById('listeningActivityGrid');
    if (!list) return;

    list.innerHTML = '';
    // Drop exams an admin marked "assignment-only" in Content controls
    // (still launchable from an assignment by id).
    const visible = LISTENING_ACTIVITIES.filter(a =>
      !(typeof window.isPracticeHidden === 'function' && window.isPracticeHidden('listening', a.examId || a.id)));
    if (!visible.length) {
      list.innerHTML = '<div class="rd-exam-empty">No listening practice is open right now. Your teacher may have reserved it for an assignment.</div>';
      return;
    }

    visible.forEach(act => {
      const card = document.createElement('div');
      card.className = 'rd-exam-card';
      card.innerHTML = `
        <div class="rd-exam-icon" aria-hidden="true">${act.icon}</div>
        <div class="rd-exam-meta">
          <div class="rd-exam-title">${escHtml(act.title)}</div>
          <div class="rd-exam-sub">${escHtml(act.subtitle || '')}</div>
        </div>
        <div class="rd-exam-modes">
          <button type="button" class="rd-exam-mode-btn timed">🎧 Start</button>
        </div>
      `;

      // The button is the control, exactly as on the Reading rows. The row
      // itself is not clickable there, so it is not clickable here either.
      card.querySelector('.rd-exam-mode-btn').addEventListener('click', () => {
        if (typeof window[act.handler] === 'function') {
          window[act.handler](act.examId);
        } else {
          console.warn(`[listening] handler ${act.handler}() not available`);
        }
      });

      list.appendChild(card);
    });
  }

  // Public API
  window.renderListeningScreen = renderListeningScreen;

  document.addEventListener('DOMContentLoaded', renderListeningScreen);
  // Re-render once the admin's content controls load (they arrive async,
  // after the first paint), so a hidden exam disappears from practice.
  document.addEventListener('content-controls-ready', renderListeningScreen);
})();
