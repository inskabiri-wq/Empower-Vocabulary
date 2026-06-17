/* ============================================================
   SKILL — Listening
   Lists listening activities (currently just the FSMEPT exam).
   Launching the exam reuses the existing listening-exam.js flow
   untouched — we only wrap the entry point.
   ============================================================ */

(function () {
  'use strict';

  // Activities shown on the Listening skill home.
  // Add more entries here as new exams / practice modes are built.
  const LISTENING_ACTIVITIES = [
    {
      id: 'fsmept-exam-1',
      examId: 'sample-fsmept',         // matches EXAM_REGISTRY listening id (for hide-from-practice)
      title: 'Listening Exam 1',
      subtitle: 'FSMEPT practice',
      icon: '🎧',
      handler: 'startListeningExam',   // existing global from listening-exam.js
      accent: '129, 140, 248'          // indigo tint to match the old card
    }
  ];

  function renderListeningScreen() {
    const grid = document.getElementById('listeningActivityGrid');
    if (!grid) return;

    grid.innerHTML = '';
    // Drop exams an admin marked "assignment-only" in Content controls
    // (still launchable from an assignment by id).
    const visible = LISTENING_ACTIVITIES.filter(a =>
      !(typeof window.isPracticeHidden === 'function' && window.isPracticeHidden('listening', a.examId || a.id)));
    if (!visible.length) {
      grid.innerHTML = '<div class="rd-exam-empty" style="grid-column:1/-1;">No listening practice is open right now. Your teacher may have reserved it for an assignment.</div>';
      return;
    }
    visible.forEach(act => {
      const card = document.createElement('div');
      card.className = 'activity-card';
      card.style.background = `linear-gradient(135deg,rgba(${act.accent},0.12),rgba(${act.accent},0.05))`;
      card.style.border = `2px solid rgba(${act.accent},0.35)`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="icon game-badge"
             style="background:linear-gradient(135deg,rgba(${act.accent},0.25),rgba(${act.accent},0.18));
                    border-color:rgba(${act.accent},0.5);
                    box-shadow:0 4px 16px rgba(${act.accent},0.3)">
          ${act.icon}
        </div>
        <h3>${act.title}</h3>
        <p>${act.subtitle}</p>
      `;

      const launch = () => {
        if (typeof window[act.handler] === 'function') {
          window[act.handler]();
        } else {
          console.warn(`[listening] handler ${act.handler}() not available`);
        }
      };
      card.addEventListener('click', launch);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(); }
      });
      grid.appendChild(card);
    });
  }

  // Public API
  window.renderListeningScreen = renderListeningScreen;

  document.addEventListener('DOMContentLoaded', renderListeningScreen);
  // Re-render once the admin's content controls load (they arrive async,
  // after the first paint), so a hidden exam disappears from practice.
  document.addEventListener('content-controls-ready', renderListeningScreen);
})();
