/* Student Dashboard - Main Entry Point */

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen) return;
  
  if (e.key === 'Escape') {
    backToMenu();
    return;
  }
  
  const screenId = activeScreen.id;
  
  if (['choiceScreen', 'reverseScreen', 'fillblankScreen'].includes(screenId)) {
    if (e.key >= '1' && e.key <= '4') {
      const btns = activeScreen.querySelectorAll('.choice-btn:not([disabled])');
      const idx = parseInt(e.key) - 1;
      if (btns[idx]) btns[idx].click();
    }
    if (e.key === 'Enter') {
      const nextBtn = activeScreen.querySelector('.action-btn[style*="inline"]');
      if (nextBtn) nextBtn.click();
    }
  }
  
  if (screenId === 'spellingScreen') {
    if (e.key === 'Enter') {
      const checkBtn = document.getElementById('spellingCheck');
      const nextBtn = document.getElementById('spellingNext');
      if (checkBtn.style.display !== 'none') checkBtn.click();
      else if (nextBtn.style.display !== 'none') nextBtn.click();
    }
  }
  
  if (screenId === 'orderScreen' && e.key === 'Enter') {
    const checkBtn = document.getElementById('orderCheck');
    const nextBtn = document.getElementById('orderNext');
    if (checkBtn.style.display !== 'none') checkBtn.click();
    else if (nextBtn.style.display !== 'none') nextBtn.click();
  }

  if (screenId === 'unscrambleScreen' && e.key === 'Enter') {
    const checkBtn = document.getElementById('unscrambleCheck');
    const nextBtn = document.getElementById('unscrambleNext');
    if (checkBtn.style.display !== 'none') checkBtn.click();
    else if (nextBtn.style.display !== 'none') nextBtn.click();
  }
});

// INIT
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initSpeech();

  // Restore book selection from localStorage
  const savedBook = localStorage.getItem('selectedBook') || 'empower';
  selectedBook = savedBook; // Make sure the variable is set

  const bookSelect = document.getElementById('bookSelect');
  if (bookSelect) {
    bookSelect.value = savedBook;
  }

  populateUnitSelector();
  updateWordCount();
  loadProfile();

  // Dashboard v2 pill-select wiring (no-op if pills absent)
  if (typeof wireDashboardPills === 'function') wireDashboardPills();

  // Update activity cards based on selected book
  setTimeout(() => {
    updateActivityCards();
  }, 100);

  // Phase F: preview mode (teacher previewing a student exam).
  // URL: student-dashboard.html?preview=1&previewSkill=reading|listening
  //      &previewLevel=B2&previewExam=b2-r1&previewMode=untimed
  // When present:
  //   • window.__previewMode = true (exam runners skip session writes)
  //   • Purple banner pinned to the top with a Close button
  //   • Auto-call the matching open-exam function once it's ready
  // The teacher is logged in as themselves — their dashboard data may
  // look odd because they're not a student, but the EXAM itself
  // renders fine (it doesn't need student-profile fields).
  _previewModeBoot();
});

function _previewModeBoot() {
  let params;
  try { params = new URLSearchParams(window.location.search); }
  catch (_) { return; }
  if (params.get('preview') !== '1') return;

  const skill  = params.get('previewSkill');
  const level  = params.get('previewLevel') || 'exam';
  const examId = params.get('previewExam');
  const mode   = params.get('previewMode') || 'untimed';
  if (!skill || !examId) return;

  window.__previewMode = true;
  _injectPreviewBanner();

  // Wait for the matching runner to load. The exam JS files self-
  // register their open functions on window via inline script tags,
  // but the order of script execution vs DOMContentLoaded isn't
  // guaranteed for deferred scripts. Poll with a sane cap.
  const fnName = (skill === 'reading') ? 'openReadingExam'
                : (skill === 'listening') ? 'startListeningExam'
                : null;
  if (!fnName) {
    console.warn('[preview] Unknown skill:', skill);
    return;
  }

  let attempts = 60; // ≈ 6 seconds at 100ms
  (function poll() {
    if (typeof window[fnName] === 'function') {
      try {
        if (skill === 'reading')   window.openReadingExam(level, examId, mode);
        if (skill === 'listening') window.startListeningExam(examId);
      } catch (e) {
        console.error('[preview] Failed to open exam:', e);
      }
      return;
    }
    if (--attempts <= 0) {
      console.warn('[preview] ' + fnName + ' never became available');
      return;
    }
    setTimeout(poll, 100);
  })();
}

function _injectPreviewBanner() {
  if (document.getElementById('previewModeBanner')) return;
  const b = document.createElement('div');
  b.id = 'previewModeBanner';
  b.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: white; padding: 10px 16px;
    text-align: center; font-weight: 700;
    font-size: 0.88em; letter-spacing: 0.05em;
    box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center; gap: 14px;
  `;
  b.innerHTML = `
    <span>👁 PREVIEW MODE — Teacher view · nothing is saved</span>
    <button type="button" id="previewModeCloseBtn"
      style="background: rgba(255,255,255,0.20); color: white;
             border: 1px solid rgba(255,255,255,0.40);
             padding: 4px 12px; border-radius: 6px;
             cursor: pointer; font-weight: 600; font-size: 0.92em;">
      ✕ Close
    </button>
  `;
  document.body.appendChild(b);
  // Push everything below the banner so it doesn't overlap content.
  document.body.style.paddingTop = (b.offsetHeight + 4) + 'px';
  b.querySelector('#previewModeCloseBtn').addEventListener('click', () => {
    // Same pattern as the writing-exam preview close — try window.close()
    // (works for tabs we opened ourselves), fall back to history back.
    try { window.close(); } catch (_) {}
    if (!window.closed) window.history.back();
  });
}
