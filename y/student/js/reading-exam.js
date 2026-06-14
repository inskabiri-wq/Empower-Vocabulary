/* ============================================================
   READING EXAM ENGINE
   ----------------------------------------------------------------
   Loads a reading-exam JSON (e.g. student/data/readings/B2/exam-1.json),
   renders a split-pane exam screen (passage left, questions right —
   each independently scrollable), supports paragraph paging, scores
   the four scorable question types, and ships with the polish tools
   the user asked for: highlighter, per-question notes, flags, and a
   tracker grid.

   Public API (called from skills/reading.js):
     • openReadingExam(level, examId, mode)   mode = 'timed' | 'untimed'
     • closeReadingExam()
   ============================================================ */

(function () {
  'use strict';

  // ── Index of available exams per level ───────────────────────
  // Phase G refactor: this is now a thin DERIVATION over the
  // canonical SKILLS_CATALOG.reading in exam-registry.js. The
  // skill home page (skills/reading.js) and any external code
  // still read window.READINGS_INDEX, so we keep the shape
  // backward-compatible: { [level]: [ { id, file, ... }, ... ] }.
  //
  // To add a reading exam: edit exam-registry.js (single source
  // of truth), NOT this file.
  const READINGS_INDEX = (function () {
    if (typeof window.EXAM_REGISTRY === 'undefined') {
      console.warn('[reading-exam] EXAM_REGISTRY missing — exam list will be empty.');
      return {};
    }
    const out = {};
    window.EXAM_REGISTRY.levelsFor('reading').forEach(lvl => {
      // Only expose AVAILABLE exams to the runner — disabled
      // entries shouldn't appear to students.
      out[lvl] = window.EXAM_REGISTRY.examsForLevel('reading', lvl)
        .filter(e => e.available !== false);
    });
    return out;
  })();
  window.READINGS_INDEX = READINGS_INDEX;

  // ── Engine state ─────────────────────────────────────────────
  // Reset on every exam open. Single-exam-at-a-time semantics —
  // attempting to reopen while one is active replaces the state.
  let state = null;
  function freshState(exam, mode) {
    return {
      exam,
      mode,                                  // 'timed' | 'untimed'
      passageIdx: 0,
      answers: {},                           // answers[pIdx][sectionId][itemId] = value
      flags:   {},                           // flags["{pIdx}|{sectionId}|{itemId}"] = true
      notes:   {},                           // notes["{pIdx}|{sectionId}|{itemId}"] = "text"
      timeLeftSec: (mode === 'timed' ? (exam.timeLimitMin || 60) * 60 : null),
      timerHandle: null,
      timerPaused: false,
      tabSwitches: 0,                        // count of times student left tab during a timed exam
      submitted: false,
      startTs: Date.now()
    };
  }

  // ── Helpers ──────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function flagKey(pIdx, sId, iId) { return `${pIdx}|${sId}|${iId}`; }

  // Lenient compare for free-text grading: case-insensitive, trim,
  // strip leading articles ("a/an/the/one"), and strip punctuation.
  // Accepts an array of acceptable strings against a student input.
  function freeTextMatch(input, acceptable) {
    const norm = (s) => String(s || '')
      .toLowerCase()
      .trim()
      .replace(/^[\(\[\{]+|[\)\]\}\.\,\!\?\;\:]+$/g, '')   // outer punct
      .replace(/^(a|an|the|one)\s+/, '')                   // leading article
      .replace(/[\(\)\[\]\{\}\.\,\!\?\;\:'"]/g, '')        // inner punct
      .replace(/\s+/g, ' ')
      .trim();
    const u = norm(input);
    if (!u) return false;
    return (acceptable || []).some(a => norm(a) === u);
  }

  // ── Loader ───────────────────────────────────────────────────
  // Fetches the source JSON, then — if the index entry pins a
  // single `passageIndex` — slices the data down to that one passage
  // and overrides title/subtitle/timeLimit from the index. The
  // engine treats it as any other exam from there.
  async function loadExam(level, examId) {
    const list = READINGS_INDEX[level] || [];
    const meta = list.find(e => e.id === examId);
    if (!meta) throw new Error(`Reading exam not found: ${level}/${examId}`);
    const res = await fetch(meta.file);
    if (!res.ok) throw new Error(`Failed to load ${meta.file}: ${res.status}`);
    const raw = await res.json();
    if (typeof meta.passageIndex === 'number') {
      const p = raw.passages && raw.passages[meta.passageIndex];
      if (!p) throw new Error(`Passage ${meta.passageIndex} not found in ${meta.file}`);
      return {
        ...raw,
        id:           meta.id,
        title:        meta.title    || raw.title,
        subtitle:     meta.subtitle || raw.subtitle,
        timeLimitMin: meta.timeLimitMin || raw.timeLimitMin || 20,
        passages:     [p]
      };
    }
    return raw;
  }

  // ── Public entry ─────────────────────────────────────────────
  async function openReadingExam(level, examId, mode) {
    try {
      const exam = await loadExam(level, examId);
      state = freshState(exam, mode || 'untimed');
      buildAndShow();
      if (state.mode === 'timed') startTimer();
    } catch (e) {
      console.error('[reading] failed to open exam:', e);
      AppDialog.alert('Could not load the reading exam. Check the console for details.');
    }
  }
  window.openReadingExam = openReadingExam;

  function closeReadingExam() {
    if (!state) return;
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
    if (typeof showScreen === 'function') showScreen('readingScreen');
    state = null;
  }
  window.closeReadingExam = closeReadingExam;

  // ── Build screen ─────────────────────────────────────────────
  // The exam shell needs to escape the `.container` element (which uses
  // backdrop-filter and therefore becomes a containing block for any
  // position:fixed descendants — that's why the exam was rendering with
  // visible margins instead of filling the viewport). On first open we
  // detach #readingExamScreen and re-attach it directly under <body>.
  function ensurePortaled() {
    const root = document.getElementById('readingExamScreen');
    if (!root) return null;
    if (root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
    return root;
  }

  function buildAndShow() {
    const root = ensurePortaled();
    if (!root) return;
    root.innerHTML = renderShell();
    if (typeof showScreen === 'function') showScreen('readingExamScreen');
    applyReadingPrefs();          // load + apply saved theme/size
    applyLockdownAttr();          // sets data-lockdown on shell for timed mode
    wireLockdownListeners();      // installs blockers (gated by isLockdownActive)
    renderPassage();
    wireGlobalEvents(root);
    wireMainEvents();
  }

  // ── Reading preferences (font size + theme) ──────────────────
  // Persisted across sessions so a student doesn't have to re-pick
  // "Large + Sepia" every time they open an exam.
  const RD_PREF_KEY = 'rd-prefs-v1';
  const RD_PREF_DEFAULT = { size: 'M', theme: 'dark' };
  const RD_PREF_SIZES  = ['S', 'M', 'L', 'XL'];
  const RD_PREF_THEMES = ['dark', 'light', 'sepia', 'hc'];

  function readPrefs() {
    try {
      const raw = localStorage.getItem(RD_PREF_KEY);
      if (!raw) return { ...RD_PREF_DEFAULT };
      const parsed = JSON.parse(raw) || {};
      return {
        size:  RD_PREF_SIZES.indexOf(parsed.size) !== -1   ? parsed.size  : RD_PREF_DEFAULT.size,
        theme: RD_PREF_THEMES.indexOf(parsed.theme) !== -1 ? parsed.theme : RD_PREF_DEFAULT.theme
      };
    } catch (_) { return { ...RD_PREF_DEFAULT }; }
  }
  function writePrefs(p) {
    try { localStorage.setItem(RD_PREF_KEY, JSON.stringify(p)); } catch (_) {}
  }

  function applyReadingPrefs() {
    const p = readPrefs();
    const root = document.getElementById('readingExamScreen');
    if (!root) return;
    root.dataset.size  = p.size;
    root.dataset.theme = p.theme;
    // Highlight the active buttons in the panel.
    document.querySelectorAll('#rd-settings .rd-pref-btn').forEach(btn => {
      const pref = btn.dataset.pref;
      const val  = btn.dataset.value;
      const active = (pref === 'size' && val === p.size) ||
                     (pref === 'theme' && val === p.theme);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setPref(pref, value) {
    const p = readPrefs();
    if (pref === 'size'  && RD_PREF_SIZES.indexOf(value)  !== -1) p.size  = value;
    if (pref === 'theme' && RD_PREF_THEMES.indexOf(value) !== -1) p.theme = value;
    writePrefs(p);
    applyReadingPrefs();
  }

  function toggleSettingsPanel(forceState) {
    const panel = document.getElementById('rd-settings');
    if (!panel) return;
    if (typeof forceState === 'boolean') panel.hidden = !forceState;
    else panel.hidden = !panel.hidden;
  }

  // ── Lockdown / exam-mode ───────────────────────────────────
  // Active only for TIMED exams. Untimed practice stays relaxed so
  // students can copy, look up words, etc.
  //
  // What it blocks:
  //   • Right-click context menu
  //   • Drag & drop of text/images
  //   • Native copy / cut events (anywhere) and paste outside inputs
  //   • Keyboard shortcuts: Ctrl/Cmd + C, X, V, A, P, S, U
  //     (C/X/V/A still work inside form inputs so students can edit
  //     their own answers)
  //   • Text selection by user gesture (CSS user-select: none).
  //     Programmatic Range selection still works → app highlighter
  //     functions normally.
  //
  // Tab-switch / window-blur:
  //   • Pauses the timer (no time gained while away)
  //   • Increments state.tabSwitches
  //   • Shows a warning modal on return
  //   • Switch count is reported on the results screen

  function isLockdownActive() {
    return !!(state && state.mode === 'timed' && !state.submitted);
  }

  function applyLockdownAttr() {
    const shell = document.querySelector('#readingExamScreen .rd-shell');
    if (!shell) return;
    if (isLockdownActive()) shell.dataset.lockdown = '1';
    else delete shell.dataset.lockdown;
  }

  // Block-event helpers ────────────────────────────────────────
  function lockdownBlockEvent(e) {
    if (!isLockdownActive()) return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  function lockdownBlockOutsideInputs(e) {
    if (!isLockdownActive()) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea')) return; // allow inside fields
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  function lockdownBlockShortcut(e) {
    if (!isLockdownActive()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const k = (e.key || '').toLowerCase();

    // Always block these — page-level destructive / leak / search
    // shortcuts. Ctrl+F is included so students can't pop the
    // browser's find-in-page dialog to scan for answer keywords.
    if (k === 'f' || k === 'p' || k === 's' || k === 'u' || k === 'g') {
      e.preventDefault(); e.stopPropagation();
      return false;
    }
    // Block C / X / V / A only outside form fields, so students can
    // still edit their own answers.
    if (['c', 'x', 'v', 'a'].indexOf(k) !== -1) {
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea')) return;
      e.preventDefault(); e.stopPropagation();
      return false;
    }
  }

  // Timer pause / resume — preserves the current timeLeftSec.
  function pauseTimer() {
    if (state && state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      state.timerPaused = true;
    }
  }
  function resumeTimer() {
    if (state && state.timerPaused && state.timeLeftSec != null) {
      state.timerPaused = false;
      startTimer();
    }
  }

  // Tab-switch handler ─────────────────────────────────────────
  function onVisibilityChange() {
    if (!isLockdownActive()) return;
    if (document.hidden) {
      pauseTimer();
      state.tabSwitches = (state.tabSwitches || 0) + 1;
    } else {
      // Don't double-prompt if we're already showing the warning
      if (document.getElementById('rd-confirm-overlay')) return;
      showLockdownWarning();
    }
  }
  function onWindowBlur() {
    // Some browsers (and alt-tab on desktop) don't fire visibilitychange
    // but do fire blur. Mirror the same handling.
    if (!isLockdownActive() || document.hidden) return;
    pauseTimer();
    state.tabSwitches = (state.tabSwitches || 0) + 1;
  }
  function onWindowFocus() {
    if (!isLockdownActive() || !state.timerPaused) return;
    if (document.getElementById('rd-confirm-overlay')) return;
    showLockdownWarning();
  }

  function showLockdownWarning() {
    rdConfirm({
      title: 'You left the exam',
      message: `Tab switches: ${state.tabSwitches || 0}. The timer was paused while you were away. Click Resume to continue.`,
      confirmText: 'Resume',
      cancelText:  'Submit now',
      danger: true
    }).then(ok => {
      if (ok) resumeTimer();
      else submitExam(false);
    });
  }

  // Wire all lockdown listeners ONCE on the document, gated by
  // isLockdownActive() inside each handler. Registering on the
  // document with capture:true catches events before any input
  // can swallow them.
  function wireLockdownListeners() {
    if (document.documentElement.dataset.rdLockdownWired) return;
    document.documentElement.dataset.rdLockdownWired = '1';

    // Right-click → blocked
    document.addEventListener('contextmenu', (e) => {
      if (!isLockdownActive()) return;
      const root = document.getElementById('readingExamScreen');
      if (!root || !root.contains(e.target)) return;
      e.preventDefault();
    });

    // Drag — blocked (text + images)
    document.addEventListener('dragstart', (e) => {
      if (!isLockdownActive()) return;
      const root = document.getElementById('readingExamScreen');
      if (!root || !root.contains(e.target)) return;
      e.preventDefault();
    });

    // Copy / cut — blocked (anywhere inside the exam)
    document.addEventListener('copy', (e) => {
      if (!isLockdownActive()) return;
      const root = document.getElementById('readingExamScreen');
      if (!root || !root.contains(e.target)) return;
      e.preventDefault();
    });
    document.addEventListener('cut', (e) => {
      if (!isLockdownActive()) return;
      const root = document.getElementById('readingExamScreen');
      if (!root || !root.contains(e.target)) return;
      e.preventDefault();
    });
    // Paste — blocked outside inputs (so students can still paste in
    // answer fields if they want).
    document.addEventListener('paste', (e) => {
      if (!isLockdownActive()) return;
      const root = document.getElementById('readingExamScreen');
      if (!root || !root.contains(e.target)) return;
      if (e.target.closest && e.target.closest('input, textarea')) return;
      e.preventDefault();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', lockdownBlockShortcut, true);

    // Tab switch / blur / focus
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
  }

  function renderShell() {
    const ex = state.exam;
    // With one passage the tab strip is visual noise — hide it.
    // The single tab still renders so the tab-progress badge logic
    // (`#rd-tab-progress-0`) keeps working without conditional code,
    // but the <nav> wrapper is collapsed via the `is-single` modifier.
    const singlePassage = ex.passages.length <= 1;
    const tabs = ex.passages.map((p, i) =>
      `<button class="rd-tab${i === 0 ? ' is-active' : ''}" data-passage="${i}">
         <span class="rd-tab-num">${i + 1}</span>
         <span class="rd-tab-title">${escHtml(p.title)}</span>
         <span class="rd-tab-progress" id="rd-tab-progress-${i}">0/0</span>
       </button>`
    ).join('');

    const timer = state.mode === 'timed'
      ? `<div class="rd-timer" id="rd-timer">--:--</div>`
      : `<div class="rd-timer rd-timer-untimed">UNTIMED</div>`;

    return `
      <div class="rd-shell" data-view="reading">
        <header class="rd-header">
          <button class="rd-back" id="rd-back-btn" aria-label="Back to reading menu">← Exit</button>
          <div class="rd-title">
            <strong>${escHtml(ex.title)}</strong>
            <span class="rd-subtitle">${escHtml(ex.subtitle || '')}</span>
          </div>
          ${timer}
          <span class="rd-lockdown-pill" title="Lockdown is active. Copy, paste, right-click, find-in-page, and tab-switching are blocked.">🔒 Locked</span>
          <div class="rd-header-actions">
            <button class="rd-tool-btn" id="rd-settings-btn" title="Reading preferences" aria-label="Reading preferences">⚙</button>
            <button class="rd-tool-btn" id="rd-tracker-btn" title="Question tracker" aria-label="Question tracker">▦</button>
            <button class="rd-submit" id="rd-submit-btn">Submit</button>
          </div>
        </header>

        <!-- Reading preferences panel — anchored under the gear button.
             Lets the student adjust font size and colour theme on the
             fly. Choices persist to localStorage so the next exam
             opens with the same preferences. -->
        <div class="rd-settings" id="rd-settings" hidden>
          <div class="rd-settings-section">
            <div class="rd-settings-label">Text size</div>
            <div class="rd-settings-grid rd-settings-sizes">
              <button class="rd-pref-btn" data-pref="size" data-value="S"  type="button"><span class="rd-pref-aa rd-pref-aa-s">Aa</span><span class="rd-pref-name">Small</span></button>
              <button class="rd-pref-btn" data-pref="size" data-value="M"  type="button"><span class="rd-pref-aa rd-pref-aa-m">Aa</span><span class="rd-pref-name">Medium</span></button>
              <button class="rd-pref-btn" data-pref="size" data-value="L"  type="button"><span class="rd-pref-aa rd-pref-aa-l">Aa</span><span class="rd-pref-name">Large</span></button>
              <button class="rd-pref-btn" data-pref="size" data-value="XL" type="button"><span class="rd-pref-aa rd-pref-aa-xl">Aa</span><span class="rd-pref-name">X-Large</span></button>
            </div>
          </div>
          <div class="rd-settings-section">
            <div class="rd-settings-label">Theme</div>
            <div class="rd-settings-grid rd-settings-themes">
              <button class="rd-pref-btn rd-pref-theme rd-pref-theme-dark"   data-pref="theme" data-value="dark"   type="button"><span class="rd-pref-swatch"></span><span class="rd-pref-name">Dark</span></button>
              <button class="rd-pref-btn rd-pref-theme rd-pref-theme-light"  data-pref="theme" data-value="light"  type="button"><span class="rd-pref-swatch"></span><span class="rd-pref-name">Light</span></button>
              <button class="rd-pref-btn rd-pref-theme rd-pref-theme-sepia"  data-pref="theme" data-value="sepia"  type="button"><span class="rd-pref-swatch"></span><span class="rd-pref-name">Sepia</span></button>
              <button class="rd-pref-btn rd-pref-theme rd-pref-theme-hc"     data-pref="theme" data-value="hc"     type="button"><span class="rd-pref-swatch"></span><span class="rd-pref-name">Contrast</span></button>
            </div>
          </div>
          <div class="rd-settings-actions">
            <button class="rd-pref-reset" id="rd-pref-reset" type="button">Reset</button>
          </div>
        </div>

        <nav class="rd-tabs${singlePassage ? ' is-single' : ''}" role="tablist">${tabs}</nav>

        <!-- Mobile-only segmented switcher between Reading text and
             Questions. The two panes can't share a phone screen at a
             readable size, so we toggle between them on narrow widths.
             The switcher is hidden on tablet/desktop via the @media
             rule in CSS (≥ 720px). -->
        <div class="rd-view-switch" role="tablist" aria-label="Switch between reading and questions">
          <button class="rd-view-btn is-active" data-view="reading" type="button" role="tab" aria-selected="true">📖 Reading</button>
          <button class="rd-view-btn" data-view="questions" type="button" role="tab" aria-selected="false">✏️ Questions</button>
        </div>

        <main class="rd-main" id="rd-main">
          <!-- left + right panes injected by renderPassage() -->
        </main>

        <!-- Tracker drawer (hidden by default) -->
        <aside class="rd-tracker" id="rd-tracker" hidden>
          <div class="rd-tracker-header">
            <span>Question tracker</span>
            <button class="rd-tracker-close" id="rd-tracker-close">×</button>
          </div>
          <div class="rd-tracker-body" id="rd-tracker-body"></div>
        </aside>

        <!-- Highlighter mini-toolbar (appears on text selection).
             Chalky palette: warm cream / salmon / mint / stone blue.
             Swatch colours match what actually gets applied so the
             user knows exactly what they'll get. -->
        <div class="rd-highlight-bar" id="rd-highlight-bar" hidden>
          <button id="rd-hl-yellow" title="Highlight cream"  aria-label="Highlight cream"  style="background:#efd58a"></button>
          <button id="rd-hl-coral"  title="Highlight coral"  aria-label="Highlight coral"  style="background:#e6a89e"></button>
          <button id="rd-hl-green"  title="Highlight mint"   aria-label="Highlight mint"   style="background:#a8d8b9"></button>
          <button id="rd-hl-blue"   title="Highlight slate"  aria-label="Highlight slate"  style="background:#a3b8c9"></button>
          <button id="rd-hl-clear"  title="Clear highlight"  aria-label="Clear highlight">✕</button>
        </div>
      </div>
    `;
  }

  // ── Render the active passage (left + right panes) ───────────
  function renderPassage() {
    const main = document.getElementById('rd-main');
    if (!main) return;
    const p = state.exam.passages[state.passageIdx];

    // LEFT PANE — passage text. We inject the JSON's passageHtml as-is
    // (it was authored by us and includes the gap markers / strong tags).
    // The intro (Part A) is rendered ABOVE the passage when present.
    const introBlock = p.introHtml
      ? `<div class="rd-intro"><h4>Before you read</h4>${p.introHtml}</div>`
      : '';
    const subtitleBlock = p.subtitle
      ? `<p class="rd-passage-subtitle"><em>${escHtml(p.subtitle)}</em></p>`
      : '';

    const left = `
      <section class="rd-pane rd-pane-left" id="rd-pane-left">
        ${introBlock}
        <h2 class="rd-passage-title">${escHtml(p.title)}</h2>
        ${subtitleBlock}
        <div class="rd-passage" id="rd-passage">${p.passageHtml}</div>
      </section>
    `;

    // RIGHT PANE — questions. One panel per scorable section, plus the
    // optional Part F writing prompt at the bottom.
    const sectionsHtml = p.sections.map(sec => renderSection(sec)).join('');
    const right = `
      <section class="rd-pane rd-pane-right" id="rd-pane-right">
        ${sectionsHtml}
      </section>
    `;

    main.innerHTML = left + right;

    // Sync any answers we already have for this passage into the inputs.
    rehydrateAnswers();
    // Update the gap badges in the passage text from current answers.
    refreshGapBadges();
    // Refresh the per-tab progress count
    refreshTabProgress();
    // If tracker is open, refresh its grid
    refreshTracker();
    // NOTE: main's event delegation is wired ONCE in wireMainEvents()
    // (not here). Re-attaching on every renderPassage caused listeners
    // to stack and flag/note clicks to fire 2x, 3x, ... per click.
  }

  // ── Section renderers (one per question type) ────────────────
  // Each section is wrapped as an accordion. The head is a real
  // clickable surface (role=button + tabindex + aria-expanded) that
  // toggles `.is-collapsed` on the parent `.rd-section`. Default
  // state is expanded so first-paint behaviour is identical to the
  // pre-accordion build — the collapse is a student-initiated
  // "tuck this away now" affordance.
  function renderSection(sec) {
    const head = `
      <div class="rd-section">
        <div class="rd-section-head" role="button" tabindex="0" aria-expanded="true">
          <span class="rd-section-label">${escHtml(sec.label || '')}</span>
          <span class="rd-section-instructions">${escHtml(sec.instructions || '')}</span>
          <span class="rd-section-chevron" aria-hidden="true">▾</span>
        </div>
    `;
    let body = '';
    if      (sec.type === 'match-headings') body = renderMatchHeadings(sec);
    else if (sec.type === 'match-gaps')     body = renderMatchGaps(sec);
    else if (sec.type === 'mcq')            body = renderMCQ(sec);
    else if (sec.type === 'find-word')      body = renderFindWord(sec);
    else if (sec.type === 'free-text')      body = renderFreeText(sec);
    else if (sec.type === 'writing')        body = renderWriting(sec);
    else                                    body = `<p class="rd-warn">Unknown section type: ${escHtml(sec.type)}</p>`;
    return head + body + `</div>`;
  }

  function renderMatchHeadings(sec) {
    const opts = sec.options.map(o =>
      `<option value="${escHtml(o.id)}">${escHtml(o.id)}. ${escHtml(o.text)}</option>`
    ).join('');
    const rows = sec.items.map(it => `
      <div class="rd-q rd-q-row" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
        ${qSideTools(sec.id, it.id)}
        <div class="rd-q-label">${escHtml(it.label)}</div>
        <select class="rd-input rd-select" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
          <option value="">— choose —</option>
          ${opts}
        </select>
      </div>
    `).join('');
    return `<div class="rd-section-body">${rows}</div>`;
  }

  function renderMatchGaps(sec) {
    const opts = sec.options.map(o =>
      `<option value="${escHtml(o.id)}">${escHtml(o.id)}. ${escHtml(o.text)}</option>`
    ).join('');
    const rows = sec.items.map(it => `
      <div class="rd-q rd-q-row" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
        ${qSideTools(sec.id, it.id)}
        <div class="rd-q-label">${escHtml(it.label)}</div>
        <select class="rd-input rd-select rd-gap-select" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}" data-gap-id="${escHtml(it.id)}">
          <option value="">— choose —</option>
          ${opts}
        </select>
      </div>
    `).join('');
    return `<div class="rd-section-body">${rows}</div>`;
  }

  function renderMCQ(sec) {
    const items = sec.items.map((it, i) => {
      const opts = it.options.map(o => `
        <label class="rd-mcq-opt">
          <input type="radio" name="mcq-${escHtml(sec.id)}-${escHtml(it.id)}"
                 value="${escHtml(o.id)}"
                 data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
          <span class="rd-mcq-letter">${escHtml(o.id)}.</span>
          <span class="rd-mcq-text">${escHtml(o.text)}</span>
        </label>
      `).join('');
      // .rd-q-block is now its own accordion: stem stays visible, the
      // options list lives in a collapsible .rd-q-body.
      return `
        <div class="rd-q rd-q-block" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
          ${qSideTools(sec.id, it.id, true)}
          <div class="rd-q-stem"><span class="rd-q-num">${i + 1}.</span> ${escHtml(it.question)}</div>
          <div class="rd-q-body"><div class="rd-mcq">${opts}</div></div>
        </div>
      `;
    }).join('');
    return `<div class="rd-section-body">${items}</div>`;
  }

  function renderFindWord(sec) {
    const items = sec.items.map((it, i) => `
      <div class="rd-q rd-q-block" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
        ${qSideTools(sec.id, it.id, true)}
        <div class="rd-q-stem">
          <span class="rd-q-num">${i + 1}.</span>
          ${escHtml(it.definition)}
          ${it.paragraph ? `<span class="rd-paragraph-hint">(¶ ${it.paragraph})</span>` : ''}
        </div>
        <div class="rd-q-body">
          <input type="text" class="rd-input rd-text"
                 placeholder="Type the word…"
                 data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}"
                 autocomplete="off" autocorrect="off" spellcheck="false">
        </div>
      </div>
    `).join('');
    return `<div class="rd-section-body">${items}</div>`;
  }

  function renderFreeText(sec) {
    const items = sec.items.map((it, i) => `
      <div class="rd-q rd-q-block" data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}">
        ${qSideTools(sec.id, it.id, true)}
        <div class="rd-q-stem">
          <span class="rd-q-num">${i + 1}.</span>
          <strong>${escHtml(it.label)}</strong> refers to:
        </div>
        <div class="rd-q-body">
          <input type="text" class="rd-input rd-text"
                 placeholder="Type the answer…"
                 data-q="${escHtml(it.id)}" data-section="${escHtml(sec.id)}"
                 autocomplete="off">
        </div>
      </div>
    `).join('');
    return `<div class="rd-section-body">${items}</div>`;
  }

  function renderWriting(sec) {
    return `
      <div class="rd-section-body rd-section-writing">
        <p class="rd-writing-prompt"><em>${escHtml(sec.prompt || '')}</em></p>
        <textarea class="rd-input rd-textarea"
                  rows="6" placeholder="Type your answer here…"
                  data-q="prompt" data-section="${escHtml(sec.id)}"></textarea>
        <p class="rd-writing-note">This part is for practice — not auto-graded.</p>
      </div>
    `;
  }

  // Per-question side tools: flag + note toggle. The note popup is
  // dynamically created on demand and positioned next to the question.
  // Inline SVG icons (instead of unicode ⚑ / ✎) keep both buttons
  // optically the same size — the unicode pair has wildly different
  // intrinsic metrics so even centred they look mismatched. Both
  // SVGs use the same 14×14 viewBox + stroke style.
  const FLAG_SVG = '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V2"/><path d="M3 2.5h7l-1.5 2.5L10 7.5H3"/></svg>';
  const NOTE_SVG = '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 2.5h6l3 3v6h-9z"/><path d="M5 6.5h4M5 9h3"/></svg>';

  function qSideTools(sectionId, itemId, withChevron) {
    const fk = flagKey(state.passageIdx, sectionId, itemId);
    const flagged = !!state.flags[fk];
    const noted   = !!(state.notes[fk] && state.notes[fk].trim());
    // The chevron is an additional side-tool used only by block
    // questions (MCQ / find-word / free-text). Row-layout questions
    // (match-headings / match-gaps) are just label+dropdown and
    // wouldn't benefit from collapsing — they pass `false`.
    const chevronBtn = withChevron ? `
        <button class="rd-q-toggle" type="button"
                data-section="${escHtml(sectionId)}" data-q="${escHtml(itemId)}"
                title="Collapse this question"
                aria-label="Collapse this question"
                aria-expanded="true">▾</button>` : '';
    return `
      <div class="rd-q-tools">
        <button class="rd-flag${flagged ? ' is-on' : ''}"
                data-section="${escHtml(sectionId)}" data-q="${escHtml(itemId)}"
                title="Flag for review" aria-label="Flag for review">${FLAG_SVG}</button>
        <button class="rd-note${noted ? ' is-on' : ''}"
                data-section="${escHtml(sectionId)}" data-q="${escHtml(itemId)}"
                title="Note" aria-label="Add note">${NOTE_SVG}</button>
        ${chevronBtn}
      </div>
    `;
  }

  // ── Sync inputs ↔ state ──────────────────────────────────────
  function rehydrateAnswers() {
    const pAns = (state.answers[state.passageIdx] || {});
    Object.keys(pAns).forEach(sectionId => {
      const itemMap = pAns[sectionId];
      Object.keys(itemMap).forEach(qId => {
        const value = itemMap[qId];
        // selects + text inputs
        document.querySelectorAll(
          `.rd-input[data-section="${cssEscape(sectionId)}"][data-q="${cssEscape(qId)}"]`
        ).forEach(el => { el.value = value; });
        // radios (mcq)
        document.querySelectorAll(
          `input[type=radio][data-section="${cssEscape(sectionId)}"][data-q="${cssEscape(qId)}"]`
        ).forEach(el => { el.checked = (el.value === value); });
      });
    });
  }
  function cssEscape(s) {
    // Minimal CSS-attribute escape — IDs in our JSON are alphanumeric
    // with hyphens, but we still escape defensively.
    return String(s).replace(/(["\\\\])/g, '\\$1');
  }

  function setAnswer(sectionId, itemId, value) {
    const pIdx = state.passageIdx;
    state.answers[pIdx] = state.answers[pIdx] || {};
    state.answers[pIdx][sectionId] = state.answers[pIdx][sectionId] || {};
    state.answers[pIdx][sectionId][itemId] = value;
    refreshGapBadges();
    refreshTabProgress();
    refreshTracker();
  }

  function getAnswer(passageIdx, sectionId, itemId) {
    return ((state.answers[passageIdx] || {})[sectionId] || {})[itemId] || '';
  }

  // ── Gap badges in the passage (synced to gap-section answers) ─
  function refreshGapBadges() {
    const passage = document.getElementById('rd-passage');
    if (!passage) return;
    const sec = state.exam.passages[state.passageIdx].sections.find(s => s.type === 'match-gaps');
    if (!sec) return;
    const ansMap = ((state.answers[state.passageIdx] || {})[sec.id] || {});
    passage.querySelectorAll('.rd-gap').forEach(el => {
      const gid = el.dataset.gap;
      const chosen = ansMap[gid];
      if (chosen) {
        const opt = sec.options.find(o => o.id === chosen);
        el.classList.add('is-filled');
        // Show the chosen letter as a small badge — full sentence on hover via title
        el.innerHTML = `<span class="rd-gap-num">${escHtml(gid)}</span><span class="rd-gap-letter">${escHtml(chosen)}</span>`;
        el.setAttribute('title', opt ? opt.text : '');
      } else {
        el.classList.remove('is-filled');
        el.innerHTML = `<span class="rd-gap-num">${escHtml(gid)}</span>`;
        el.removeAttribute('title');
      }
    });
  }

  // ── Per-tab progress count "answered/total" ─────────────────
  function refreshTabProgress() {
    state.exam.passages.forEach((p, i) => {
      const el = document.getElementById(`rd-tab-progress-${i}`);
      if (!el) return;
      const counts = countPassageAnswers(i);
      el.textContent = `${counts.answered}/${counts.total}`;
    });
  }
  function countPassageAnswers(pIdx) {
    const passage = state.exam.passages[pIdx];
    let total = 0, answered = 0;
    passage.sections.forEach(sec => {
      if (sec.type === 'writing') return; // not counted in scorable progress
      sec.items.forEach(it => {
        total += 1;
        if (getAnswer(pIdx, sec.id, it.id)) answered += 1;
      });
    });
    return { total, answered };
  }

  // ── Tab switching ───────────────────────────────────────────
  function switchPassage(idx) {
    if (idx === state.passageIdx) return;
    state.passageIdx = idx;
    document.querySelectorAll('.rd-tab').forEach((t, i) => {
      t.classList.toggle('is-active', i === idx);
    });
    renderPassage();
  }

  // ── Timer (only in timed mode) ──────────────────────────────
  function startTimer() {
    const el = document.getElementById('rd-timer');
    if (!el) return;
    const tick = () => {
      if (!state || state.timeLeftSec == null) return;
      const m = Math.floor(state.timeLeftSec / 60);
      const s = state.timeLeftSec % 60;
      el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (state.timeLeftSec <= 0) {
        clearInterval(state.timerHandle);
        state.timerHandle = null;
        el.classList.add('rd-timer-out');
        // Auto-submit when time runs out
        submitExam(true);
        return;
      }
      // Visual warnings: under 10 min amber, under 2 min red
      if (state.timeLeftSec <= 120)      el.classList.add('rd-timer-critical');
      else if (state.timeLeftSec <= 600) el.classList.add('rd-timer-warning');
      state.timeLeftSec -= 1;
    };
    tick(); // paint immediately
    state.timerHandle = setInterval(tick, 1000);
  }

  // ── Tracker grid (drawer on the right) ──────────────────────
  // Sectioned layout: each passage is split into its scorable parts
  // (B / C / D / E …), each part gets a thin label and a row of cells
  // numbered 1..N. Letter prefixes were dropped per spec — the part
  // label tells you the section, the cell tells you the question
  // within that section.
  function refreshTracker() {
    const body = document.getElementById('rd-tracker-body');
    if (!body) return;

    // Pull the JSON's `sec.label` (e.g. "Part B") and shorten it for
    // the tracker — "Part B" → "B". Falls back to the section id if no
    // label is present.
    const shortPart = (sec) => {
      const lbl = String(sec.label || sec.id || '').trim();
      const m = lbl.match(/^Part\s+([A-Z0-9]+)/i);
      return m ? m[1].toUpperCase() : lbl.charAt(0).toUpperCase();
    };

    const html = state.exam.passages.map((p, pi) => {
      const sectionsHtml = p.sections
        .filter(sec => sec.type !== 'writing')
        .map(sec => {
          const cells = sec.items.map((it, ii) => {
            const ans = getAnswer(pi, sec.id, it.id);
            const fk = flagKey(pi, sec.id, it.id);
            const flagged = !!state.flags[fk];
            let cls = 'rd-track-cell';
            if (ans) cls += ' is-answered';
            if (flagged) cls += ' is-flagged';
            return `
              <button class="${cls}"
                      data-passage="${pi}" data-section="${escHtml(sec.id)}" data-q="${escHtml(it.id)}"
                      title="${escHtml(sec.label)} · Q${ii + 1}">
                ${ii + 1}
              </button>
            `;
          }).join('');
          return `
            <div class="rd-track-section">
              <span class="rd-track-section-label">${escHtml(shortPart(sec))}</span>
              <div class="rd-track-grid">${cells}</div>
            </div>
          `;
        }).join('');

      return `
        <div class="rd-track-passage">
          <div class="rd-track-passage-title">P${pi + 1}</div>
          ${sectionsHtml}
        </div>
      `;
    }).join('');
    body.innerHTML = html;
  }

  // ── Note popover — minimal: a textarea per question ─────────
  function toggleNote(sectionId, itemId, anchorEl) {
    const fk = flagKey(state.passageIdx, sectionId, itemId);
    // If already open near this question, close it
    const existing = document.getElementById('rd-note-popover');
    if (existing) {
      existing.remove();
      if (existing.dataset.for === fk) return;
    }
    const pop = document.createElement('div');
    pop.id = 'rd-note-popover';
    pop.dataset.for = fk;
    pop.innerHTML = `
      <textarea placeholder="Your note…">${escHtml(state.notes[fk] || '')}</textarea>
      <div class="rd-note-actions">
        <button class="rd-note-save">Save</button>
        <button class="rd-note-cancel">Cancel</button>
      </div>
    `;
    // Append INSIDE the exam screen so the popover inherits the
    // exam's CSS custom properties (--rd-text, --rd-bg, …). When it
    // was appended to <body> the variables were undefined and the
    // textarea text fell back to black on dark — invisible.
    const host = document.getElementById('readingExamScreen') || document.body;
    host.appendChild(pop);
    // Position near the anchor
    const r = anchorEl.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.top  = `${Math.min(window.innerHeight - 200, r.bottom + 6)}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 320, r.left - 100))}px`;

    pop.querySelector('.rd-note-save').addEventListener('click', () => {
      const ta = pop.querySelector('textarea');
      state.notes[fk] = ta.value;
      anchorEl.classList.toggle('is-on', !!(ta.value && ta.value.trim()));
      pop.remove();
    });
    pop.querySelector('.rd-note-cancel').addEventListener('click', () => pop.remove());
    pop.querySelector('textarea').focus();
  }

  // ── Highlighter ─────────────────────────────────────────────
  // Two pieces of state:
  //   • savedHighlightRange — the live selection we'll wrap when the
  //     user clicks a colour button. The button steals focus and
  //     collapses window.getSelection(), so we cache the range first.
  //   • activeHighlightEl   — an existing <span class="rd-hl"> the
  //     user clicked on. Lets the ✕ button know which highlight to
  //     unwrap when there is no live selection (i.e. the user just
  //     clicked a coloured word and clicked clear).
  let savedHighlightRange = null;
  let activeHighlightEl   = null;

  // Pick the most useful rect for positioning the bar.
  // A multi-line selection's getBoundingClientRect() spans both lines —
  // the bar would land between them, often visually disconnected from
  // either edge of the highlight. Using the LAST entry from
  // getClientRects() pins the bar to the end of the selection (where
  // the user's cursor finished), which is what people expect.
  // Returns null if every rect is degenerate (zero width AND zero
  // height) so callers can hide the bar instead of clamping to (8,8).
  function bestRectForBar(range) {
    if (!range) return null;
    let rects;
    try { rects = range.getClientRects(); } catch (_) { return null; }
    let last = null;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width >= 1 || r.height >= 1) last = r;
    }
    if (last) return last;
    // Fall back to the bounding rect once, in case the engine reports
    // the selection only via the aggregate.
    let br;
    try { br = range.getBoundingClientRect(); } catch (_) { return null; }
    if (br && (br.width >= 1 || br.height >= 1)) return br;
    return null;
  }

  function showHighlightBar(rect) {
    const bar = document.getElementById('rd-highlight-bar');
    if (!bar || !rect) return;
    bar.hidden = false;
    // Measure the bar so we can centre it above the selection.
    const barRect = bar.getBoundingClientRect();
    const barW = barRect.width  || 150;
    const barH = barRect.height || 36;

    // Centre horizontally on the selection, clamp inside the viewport.
    const desiredLeft = rect.left + (rect.width / 2) - (barW / 2);
    const left = Math.max(8, Math.min(window.innerWidth - barW - 8, desiredLeft));

    // Place above the selection; if there's no room above, place below.
    let top = rect.top - barH - 8;
    if (top < 8) top = rect.bottom + 8;

    bar.style.position = 'fixed';
    bar.style.top  = `${top}px`;
    bar.style.left = `${left}px`;
  }
  function hideHighlightBar() {
    const bar = document.getElementById('rd-highlight-bar');
    if (bar) bar.hidden = true;
    savedHighlightRange = null;
    activeHighlightEl   = null;
  }

  function highlightSelection(color) {
    // Prefer the saved range (set on mouseup) since clicking a button
    // can collapse window.getSelection() before this handler fires.
    let range = savedHighlightRange;
    if (!range) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      range = sel.getRangeAt(0);
    }
    const shell = document.querySelector('#readingExamScreen .rd-shell');
    if (!shell || !shell.contains(range.commonAncestorContainer)) return;

    const span = document.createElement('span');
    span.className = 'rd-hl';
    span.style.background = color;
    try { range.surroundContents(span); }
    catch (_) { /* selection crossed element boundaries — give up silently */ }

    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    hideHighlightBar();
  }

  // Unwrap a highlight. Looks at — in priority order:
  //   1. activeHighlightEl  — the highlight the user clicked
  //   2. The saved range's start node — the selection just made
  //   3. The current live selection — fallback for keyboard users
  function clearHighlight() {
    let target = activeHighlightEl;
    if (!target && savedHighlightRange) {
      target = ancestorHighlight(savedHighlightRange.startContainer);
    }
    if (!target) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) target = ancestorHighlight(sel.anchorNode);
    }
    if (!target) { hideHighlightBar(); return; }
    const parent = target.parentNode;
    while (target.firstChild) parent.insertBefore(target.firstChild, target);
    parent.removeChild(target);
    // Merge adjacent text nodes the unwrap created so future selections
    // don't fragment. Cheap enough on a small subtree.
    if (parent && parent.normalize) parent.normalize();
    hideHighlightBar();
  }
  // Walk up the DOM from `node` and return the nearest .rd-hl ancestor
  // (or `node` itself if it's a highlight span). Bounded by the shell.
  function ancestorHighlight(node) {
    if (!node) return null;
    const shell = document.querySelector('#readingExamScreen .rd-shell');
    let cur = node.nodeType === 3 ? node.parentNode : node;
    while (cur && cur !== shell) {
      if (cur.classList && cur.classList.contains('rd-hl')) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  // ── Custom in-app confirm modal ──────────────────────────────
  // Replaces window.confirm() so the prompt fits the exam's visual
  // language (no native browser dialog, which felt jarring) and so
  // we can theme it. Returns a Promise<boolean>. Lives inside the
  // exam screen so the CSS variables are in scope.
  function rdConfirm({ title, message, confirmText, cancelText, danger }) {
    return new Promise((resolve) => {
      const host = document.getElementById('readingExamScreen') || document.body;
      // Tear down a stale confirm if one is still hanging around
      const stale = document.getElementById('rd-confirm-overlay');
      if (stale) stale.remove();

      const overlay = document.createElement('div');
      overlay.id = 'rd-confirm-overlay';
      overlay.className = 'rd-confirm-overlay';
      overlay.innerHTML = `
        <div class="rd-confirm" role="dialog" aria-modal="true" aria-labelledby="rd-confirm-title">
          <div class="rd-confirm-icon ${danger ? 'is-danger' : ''}">${danger ? '⚠' : '?'}</div>
          <h3 id="rd-confirm-title" class="rd-confirm-title">${escHtml(title || 'Are you sure?')}</h3>
          <p class="rd-confirm-message">${escHtml(message || '')}</p>
          <div class="rd-confirm-actions">
            <button type="button" class="rd-confirm-cancel">${escHtml(cancelText || 'Cancel')}</button>
            <button type="button" class="rd-confirm-ok ${danger ? 'is-danger' : ''}">${escHtml(confirmText || 'Confirm')}</button>
          </div>
        </div>
      `;
      host.appendChild(overlay);

      const finish = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('.rd-confirm-cancel').addEventListener('click', () => finish(false));
      overlay.querySelector('.rd-confirm-ok').addEventListener('click',     () => finish(true));
      // Click on the dim backdrop also cancels.
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(false);
      });
      // Esc cancels, Enter confirms.
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      };
      overlay.addEventListener('keydown', onKey);
      // Focus the primary button so Enter works without an extra Tab.
      setTimeout(() => overlay.querySelector('.rd-confirm-ok').focus(), 0);
    });
  }

  // ── Submit & score ──────────────────────────────────────────
  async function submitExam(viaTimer) {
    if (!state || state.submitted) return;
    if (!viaTimer) {
      const counts = state.exam.passages.reduce((acc, p, i) => {
        const c = countPassageAnswers(i);
        acc.answered += c.answered;
        acc.total    += c.total;
        return acc;
      }, { answered: 0, total: 0 });
      const blank = counts.total - counts.answered;
      if (blank > 0) {
        const ok = await rdConfirm({
          title: 'Submit with unanswered questions?',
          message: `You have ${blank} unanswered question${blank === 1 ? '' : 's'}. They will be marked wrong.`,
          confirmText: 'Submit anyway',
          cancelText:  'Keep working',
          danger: true
        });
        if (!ok) return;
      }
    }
    state.submitted = true;
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
    applyLockdownAttr();          // drops data-lockdown so results screen is interactive
    const result = computeScore();
    // Persist to Firestore so the teacher dashboard can see the
    // attempt. Fire-and-forget — the results screen renders
    // immediately and the network write happens in the background.
    logReadingExamSession(result, viaTimer);
    showResults(result, viaTimer);
  }

  // ── Firebase session logging ─────────────────────────────────
  // Writes one row to the `sessions` collection per submitted reading
  // attempt. Same shape as the listening exam's logger so the teacher
  // dashboard's existing "sessions" pipeline picks it up automatically;
  // we just need to teach the dashboard about the new `activity:
  // 'reading-exam'` value (handled in teacher/js/* files).
  async function logReadingExamSession(result, viaTimer) {
    // Phase F: preview mode — teacher is just inspecting the exam,
    // don't pollute their session history / XP / activity log.
    if (window.__previewMode) {
      console.log('[preview] skipping reading session write');
      return;
    }
    if (typeof auth === 'undefined' || !auth.currentUser || !state) return;
    try {
      const elapsedSec = Math.max(0, Math.round((Date.now() - state.startTs) / 1000));
      // Denormalize student class / level / module onto every session
      // so the teacher dashboard's Firestore rules can scope per-doc
      // (see Phase B in DEPLOY.md). studentScopeFields() lives in
      // y/student/js/auth.js — exposed via window.
      const scope = (typeof studentScopeFields === 'function') ? studentScopeFields() : { studentClass:'', studentLevel:'', studentModule:'' };
      // Per-question detail for the teacher answer drill-down (QA #4):
      // flatten passages → sections → items into one uniform array.
      const rdItems = [];
      (result.perPassage || []).forEach(function (p) {
        (p.sections || []).forEach(function (s) {
          (s.items || []).forEach(function (it) {
            rdItems.push({
              q: it.label || it.itemId || '',
              a: (it.userAns == null ? '' : String(it.userAns)),
              correct: (it.correctAns == null ? '' : String(it.correctAns)),
              ok: !!it.isRight
            });
          });
        });
      });
      await db.collection('sessions').add({
        userId:        auth.currentUser.uid,
        userName:      auth.currentUser.displayName || auth.currentUser.email || 'Student',
        book:          typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
        activity:      'reading-exam',
        level:         state.exam.level || 'unknown',           // e.g. 'B2'
        unit:          state.exam.id || 'unknown',              // e.g. 'b2-r1'
        examTitle:     state.exam.title || '',                  // friendly label for the dashboard
        score:         result.totalCorrect,
        total:         result.totalQuestions,
        percentage:    result.totalPct,
        correctAnswers: result.totalCorrect,
        totalQuestions: result.totalQuestions,
        mode:          state.mode || 'untimed',                 // 'timed' | 'untimed'
        timeSpentSec:  elapsedSec,
        timeLimitSec:  state.mode === 'timed' ? (state.exam.timeLimitMin || 20) * 60 : null,
        autoSubmitted: !!viaTimer,                              // true if timer ran out
        tabSwitches:   state.tabSwitches || 0,                  // lockdown breach count
        wordsLearned:  [],
        answers:       { skill: 'reading', items: rdItems },    // per-question detail (QA #4)
        ...scope,                                               // studentClass / studentLevel / studentModule
        createdAt:     firebase.firestore.FieldValue.serverTimestamp()
      });

      // XP reward — same scale as the listening exam (1 XP per 10% scored).
      if (typeof addXP === 'function') addXP(Math.round(result.totalPct / 10));

      // Refresh the student's journey stats so the home screen updates
      // immediately when they navigate back.
      if (typeof loadJourneyStats === 'function') await loadJourneyStats();

      // Hook into the activity logger pipeline if present (mirrors the
      // listening exam — same call shape).
      if (typeof ActivityLogger !== 'undefined') {
        try {
          await ActivityLogger.logPracticeCompleted({
            book:     typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
            level:    state.exam.level || 'exam',
            unit:     state.exam.id || 'reading',
            activity: 'reading-exam',
            score:    result.totalPct,
            wordsCount: result.totalQuestions
          });
        } catch (_) { /* logger optional */ }
      }
    } catch (e) {
      console.error('Failed to log reading exam:', e);
    }
  }

  function computeScore() {
    const perPassage = state.exam.passages.map((p, pi) => {
      let correct = 0, total = 0;
      const sectionDetails = [];
      p.sections.forEach(sec => {
        if (sec.type === 'writing') return;
        let sCorrect = 0;
        const itemDetails = sec.items.map(it => {
          total += 1;
          const userAns = getAnswer(pi, sec.id, it.id);
          let isRight = false;
          if (sec.type === 'find-word' || sec.type === 'free-text') {
            isRight = freeTextMatch(userAns, it.acceptable || [it.answer]);
          } else {
            // match-headings, match-gaps, mcq → exact id compare (case-insensitive)
            isRight = !!userAns && userAns.toString().toLowerCase() === String(it.answer).toLowerCase();
          }
          if (isRight) { correct += 1; sCorrect += 1; }
          return { itemId: it.id, label: it.label || it.id, userAns, correctAns: it.answer, isRight };
        });
        sectionDetails.push({
          id: sec.id, label: sec.label, type: sec.type,
          correct: sCorrect, total: sec.items.length, items: itemDetails
        });
      });
      return {
        passageIdx: pi,
        title: p.title,
        correct, total,
        pct: total > 0 ? Math.round((correct / total) * 100) : 0,
        sections: sectionDetails
      };
    });
    const totalCorrect = perPassage.reduce((s, p) => s + p.correct, 0);
    const totalQuestions = perPassage.reduce((s, p) => s + p.total, 0);
    const totalPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return { perPassage, totalCorrect, totalQuestions, totalPct };
  }

  function showResults(result, viaTimer) {
    const root = document.getElementById('readingExamScreen');
    if (!root) return;

    const passageRows = result.perPassage.map(p => `
      <div class="rd-result-row">
        <div class="rd-result-row-head">
          <span class="rd-result-num">P${p.passageIdx + 1}</span>
          <span class="rd-result-title">${escHtml(p.title)}</span>
          <span class="rd-result-pct rd-pct-${p.pct >= 70 ? 'good' : p.pct >= 50 ? 'mid' : 'low'}">${p.correct}/${p.total} · ${p.pct}%</span>
        </div>
        <div class="rd-result-sections">
          ${p.sections.map(s => `
            <span class="rd-result-section">${escHtml(s.label)}: <strong>${s.correct}/${s.total}</strong></span>
          `).join('')}
        </div>
        <details class="rd-result-details">
          <summary>Show answers</summary>
          ${p.sections.map(s => `
            <div class="rd-result-section-detail">
              <div class="rd-result-section-title">${escHtml(s.label)} (${s.correct}/${s.total})</div>
              <ol class="rd-result-items">
                ${s.items.map(it => `
                  <li class="rd-result-item ${it.isRight ? 'is-right' : 'is-wrong'}">
                    <span class="rd-result-mark">${it.isRight ? '✓' : '✗'}</span>
                    <span class="rd-result-label">${escHtml(it.label)}</span>
                    <span class="rd-result-your">your: <em>${escHtml(it.userAns || '—')}</em></span>
                    ${it.isRight ? '' : `<span class="rd-result-correct">correct: <strong>${escHtml(it.correctAns)}</strong></span>`}
                  </li>
                `).join('')}
              </ol>
            </div>
          `).join('')}
        </details>
      </div>
    `).join('');

    const headline = viaTimer ? 'Time’s up!' : 'Exam submitted';
    const totalCls = result.totalPct >= 70 ? 'good' : result.totalPct >= 50 ? 'mid' : 'low';

    root.innerHTML = `
      <div class="rd-shell rd-results">
        <header class="rd-header">
          <button class="rd-back" id="rd-back-btn" aria-label="Back to reading menu">← Back</button>
          <div class="rd-title"><strong>${escHtml(state.exam.title)}</strong><span class="rd-subtitle">${escHtml(headline)}</span></div>
          <div class="rd-header-actions">
            <button class="rd-tool-btn" id="rd-retake-btn" title="Retake (resets answers)">↻ Retake</button>
          </div>
        </header>
        <main class="rd-results-main">
          <div class="rd-result-total">
            <div class="rd-result-total-num rd-pct-${totalCls}">${result.totalCorrect} / ${result.totalQuestions}</div>
            <div class="rd-result-total-pct">${result.totalPct}%</div>
            <div class="rd-result-total-label">Total score across ${state.exam.passages.length} passage${state.exam.passages.length === 1 ? '' : 's'}</div>
            ${state.mode === 'timed'
              ? `<div class="rd-result-meta">⏱ Timed exam · Tab switches: <strong>${state.tabSwitches || 0}</strong></div>`
              : ''}
          </div>
          <div class="rd-result-passages">${passageRows}</div>
        </main>
      </div>
    `;
    document.getElementById('rd-back-btn').addEventListener('click', closeReadingExam);
    document.getElementById('rd-retake-btn').addEventListener('click', () => {
      const lvl = state.exam.level;
      const id = state.exam.id;
      const mode = state.mode;
      // Tear down current state and re-open fresh
      state = null;
      openReadingExam(lvl, id, mode);
    });
  }

  // ── Wire events ─────────────────────────────────────────────
  // Bind ONCE per root element / document. Without these guards,
  // re-opening the exam (retake) accumulates duplicate listeners
  // and every click fires 2×, 3×, … times.
  function wireGlobalEvents(root) {
    if (root.dataset.rdWired === '1') return;
    root.dataset.rdWired = '1';

    // Back / submit / tracker / tabs (delegated)
    root.addEventListener('click', (e) => {
      const t = e.target;
      if (t.id === 'rd-back-btn') {
        // If exam is already submitted (e.g. on the results screen)
        // we just close — no confirmation needed.
        if (!state || state.submitted) { closeReadingExam(); return; }
        rdConfirm({
          title: 'Leave this exam?',
          message: 'Your answers in this attempt will be lost.',
          confirmText: 'Leave',
          cancelText:  'Stay',
          danger: true
        }).then(ok => { if (ok) closeReadingExam(); });
        return;
      }
      if (t.id === 'rd-submit-btn')  { submitExam(false); return; }
      if (t.id === 'rd-tracker-btn') { toggleTracker();   return; }
      if (t.id === 'rd-tracker-close') { toggleTracker(false); return; }

      // Settings panel — gear button toggles, pref buttons set,
      // reset clears to defaults.
      if (t.id === 'rd-settings-btn') { toggleSettingsPanel(); return; }
      if (t.id === 'rd-pref-reset')   { writePrefs({ ...RD_PREF_DEFAULT }); applyReadingPrefs(); return; }
      const prefBtn = t.closest && t.closest('.rd-pref-btn');
      if (prefBtn) {
        setPref(prefBtn.dataset.pref, prefBtn.dataset.value);
        return;
      }
      // Click outside the panel (and not the gear) → close it.
      const panel = document.getElementById('rd-settings');
      if (panel && !panel.hidden && !panel.contains(t) && t.id !== 'rd-settings-btn') {
        toggleSettingsPanel(false);
      }

      // Mobile pane switcher (Reading ↔ Questions).
      // Sets data-view on the shell; CSS uses [data-view="..."] to
      // hide the inactive pane on narrow screens. No-op on desktop
      // because the switcher is display:none there.
      const viewBtn = t.closest && t.closest('.rd-view-btn');
      if (viewBtn) {
        const v = viewBtn.dataset.view;
        const shell = document.querySelector('#readingExamScreen .rd-shell');
        if (shell) shell.setAttribute('data-view', v);
        document.querySelectorAll('.rd-view-btn').forEach(b => {
          const on = b.dataset.view === v;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        return;
      }

      const tab = t.closest && t.closest('.rd-tab');
      if (tab) {
        const idx = parseInt(tab.dataset.passage, 10);
        if (!isNaN(idx)) { switchPassage(idx); return; }
      }

      // Tracker cell click → jump to that passage / question.
      // Adds a brief teal pulse on the target so the student can see
      // exactly which question they landed on (without it the page
      // just scrolled and you had to hunt for the question).
      const cell = t.closest && t.closest('.rd-track-cell');
      if (cell) {
        const pIdx = parseInt(cell.dataset.passage, 10);
        if (!isNaN(pIdx) && pIdx !== state.passageIdx) switchPassage(pIdx);
        const sec = cell.dataset.section;
        const q = cell.dataset.q;
        // On mobile the panes are toggled via [data-view] — make sure
        // we land on the Questions pane so the target is visible.
        const shell = document.querySelector('#readingExamScreen .rd-shell');
        if (shell) {
          shell.setAttribute('data-view', 'questions');
          document.querySelectorAll('.rd-view-btn').forEach(b => {
            const on = b.dataset.view === 'questions';
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
        }
        // Render-on-passage-switch is synchronous in our flow but we
        // still defer one tick so the target node is in the DOM.
        setTimeout(() => {
          const el = document.querySelector(
            `[data-section="${sec}"][data-q="${q}"].rd-q`
          );
          if (!el) return;
          // If the target sits inside a collapsed accordion section,
          // expand it FIRST so the smooth-scroll lands on something
          // visible. Otherwise the scrollIntoView centers on a zero-
          // height container and the student sees nothing.
          const parentSec = el.closest('.rd-section');
          if (parentSec && parentSec.classList.contains('is-collapsed')) {
            parentSec.classList.remove('is-collapsed');
            const head = parentSec.querySelector('.rd-section-head');
            if (head) head.setAttribute('aria-expanded', 'true');
          }
          // Also expand the question itself if it's an individually
          // collapsed block question (.rd-q-block.is-collapsed).
          if (el.classList.contains('rd-q-block') && el.classList.contains('is-collapsed')) {
            el.classList.remove('is-collapsed');
            const qBtn = el.querySelector('.rd-q-toggle');
            if (qBtn) {
              qBtn.setAttribute('aria-expanded', 'true');
              qBtn.setAttribute('aria-label', 'Collapse this question');
            }
          }
          if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Strip any previous pulse on a different question so only
          // the most recent jump glows.
          document.querySelectorAll('.rd-q.is-jumped').forEach(n => n.classList.remove('is-jumped'));
          el.classList.add('is-jumped');
          // Match the CSS animation duration (1.6s) — drop the class so
          // the next jump can re-trigger the pulse cleanly.
          setTimeout(() => el.classList.remove('is-jumped'), 1600);
          // Move keyboard focus into the input/select for the question
          // when one exists. Lets keyboard users keep working without
          // an extra click.
          const focusable = el.querySelector('input, select, textarea');
          if (focusable && focusable.focus) {
            try { focusable.focus({ preventScroll: true }); } catch (_) { focusable.focus(); }
          }
        }, 60);
        toggleTracker(false);
        return;
      }

      // Highlight-bar buttons — chalky palette (mix of options A & C).
      // All four colours sit at similar luminance (~80%) so they read
      // as a matched chalk-pen set, while still being visible on the
      // dark passage with dark text overlaid.
      if (t.id === 'rd-hl-yellow') return highlightSelection('#efd58a');  // warm cream
      if (t.id === 'rd-hl-coral')  return highlightSelection('#e6a89e');  // chalk salmon
      if (t.id === 'rd-hl-green')  return highlightSelection('#a8d8b9');  // chalk mint
      if (t.id === 'rd-hl-blue')   return highlightSelection('#a3b8c9');  // chalk stone blue
      if (t.id === 'rd-hl-clear')  return clearHighlight();

      // Click on an existing highlight → show the bar above it so the
      // user can clear it. Without this branch, the only way to remove
      // a highlight was to re-select it (clunky).
      const hlEl = t.closest && t.closest('.rd-hl');
      if (hlEl) {
        const shell = document.querySelector('#readingExamScreen .rd-shell');
        if (shell && shell.contains(hlEl)) {
          activeHighlightEl   = hlEl;
          savedHighlightRange = null;        // no live selection — clear path uses activeHighlightEl
          const rect = hlEl.getBoundingClientRect();
          showHighlightBar(rect);
        }
      }
    });

    // Show the highlight bar after the user's selection is finalised.
    // Covers BOTH the passage on the left and the questions on the
    // right. Form controls (input/select/textarea/button) are skipped
    // so dragging to focus a field doesn't pop the bar.
    //
    // Why we don't use selectionchange:
    //   - It fires too eagerly during a drag → the bar flickers and
    //     occasionally locks onto a stale rect.
    //
    // Why we wait ~30ms instead of setTimeout(0):
    //   - On a double-click the browser fires mousedown→mouseup→click→
    //     mousedown→mouseup→dblclick. The word-selection lands during
    //     the second mouseup, but Webkit/Blink sometimes still reports
    //     a collapsed selection on the next microtask. 30ms is below
    //     human perception and reliably covers the gap.
    const SHOW_BAR_DELAY = 30;
    const tryShowBar = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // If the user just clicked an existing highlight (no live
        // selection, but activeHighlightEl is set), keep the bar so
        // they can press the ✕ to remove the highlight. Without this
        // guard, the queued tryShowBar would hide the bar 30ms after
        // the click handler showed it.
        if (activeHighlightEl) return;
        hideHighlightBar();
        return;
      }
      const shell = document.querySelector('#readingExamScreen .rd-shell');
      if (!shell) { hideHighlightBar(); return; }
      const range = sel.getRangeAt(0);
      if (!shell.contains(range.commonAncestorContainer)) {
        hideHighlightBar();
        return;
      }
      // Skip selections that originated from a form control — those
      // are typed values, not text the user wants to highlight.
      const anchor = sel.anchorNode;
      const anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
      if (anchorEl && anchorEl.closest('input, select, textarea, button')) {
        hideHighlightBar();
        return;
      }
      // bestRectForBar walks getClientRects() and returns the last
      // non-degenerate rect. Important for two cases:
      //   • Multi-line selections — the aggregate getBoundingClientRect
      //     spans both lines so the bar ends up between them, awkwardly.
      //   • Selections that touch an inline-span boundary — Chrome
      //     occasionally reports a 0×0 aggregate rect for one frame.
      const r = bestRectForBar(range);
      if (!r) { hideHighlightBar(); return; }
      // A fresh selection invalidates any previous "click on existing
      // highlight" target — otherwise clearing would unwrap the wrong span.
      activeHighlightEl   = null;
      savedHighlightRange = range.cloneRange();
      showHighlightBar(r);
    };

    let pendingShow = null;
    const scheduleShow = () => {
      if (pendingShow) clearTimeout(pendingShow);
      pendingShow = setTimeout(() => { pendingShow = null; tryShowBar(); }, SHOW_BAR_DELAY);
    };

    const onSelectMaybeShow = (ev) => {
      // A click on the bar itself shouldn't dismiss / re-position the bar
      const bar = document.getElementById('rd-highlight-bar');
      if (bar && bar.contains(ev.target)) return;
      scheduleShow();
    };
    // Tap-to-select-word for touch devices.
    // On phones the long-press gesture triggers the OS callout menu
    // (Define / Look Up / Translate), which fires before our handler
    // and breaks the highlight flow. We give touch users an alternate
    // gesture: a single tap on a word in the passage selects that word
    // programmatically and pops our colour bar above it. Drag-select
    // still works for users who want a multi-word range.
    const onTouchTapWord = (ev) => {
      // Only act on simple taps (one finger, no movement).
      if (!ev.changedTouches || ev.changedTouches.length !== 1) return;
      const t0 = ev.changedTouches[0];
      const passage = document.getElementById('rd-passage');
      if (!passage) return;
      // If the tap landed on an existing highlight, let the click
      // handler's `.rd-hl` branch take over (it sets activeHighlightEl
      // so the ✕ button can remove the highlight). Selecting a word
      // inside it would clobber that flow.
      const target = document.elementFromPoint(t0.clientX, t0.clientY);
      if (target && target.closest && target.closest('.rd-hl')) return;
      // Walk from touch coords to a text node; abort if the tap landed
      // outside the passage (e.g. on a question, button, gap pill).
      const point = caretRangeAt(t0.clientX, t0.clientY);
      if (!point || !passage.contains(point.startContainer)) return;
      const node = point.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      // Don't override an existing drag-selection — if the user
      // already has a non-collapsed selection, leave it alone.
      const sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed) return;
      // Expand the caret to the surrounding word.
      const wordRange = expandToWord(node, point.startOffset);
      if (!wordRange) return;
      sel.removeAllRanges();
      sel.addRange(wordRange);
      // Positioning happens in the queued scheduleShow → tryShowBar.
      scheduleShow();
    };

    // Document-level listeners are bound once and then guarded by a
    // sentinel on <html> so retakes don't add duplicates.
    if (!document.documentElement.dataset.rdSelWired) {
      document.documentElement.dataset.rdSelWired = '1';
      document.addEventListener('mouseup',  onSelectMaybeShow);
      document.addEventListener('touchend', onSelectMaybeShow);
      document.addEventListener('touchend', onTouchTapWord);
      // dblclick is the most reliable signal for "browser auto-selected
      // a word for me". On some browsers the mouseup that finalises the
      // word-selection fires BEFORE the selection actually lands, so the
      // mouseup-driven path occasionally sees a collapsed selection.
      // The dblclick listener fires after the selection is committed,
      // giving us a second chance to position the bar correctly.
      document.addEventListener('dblclick', onSelectMaybeShow);

      // Hide the bar when the user clicks outside the highlight zones.
      document.addEventListener('mousedown', (ev) => {
        const examScreen = document.getElementById('readingExamScreen');
        if (!examScreen || !examScreen.classList.contains('active')) return;
        const bar = document.getElementById('rd-highlight-bar');
        const shell = document.querySelector('#readingExamScreen .rd-shell');
        if (bar && bar.contains(ev.target)) return;     // clicking a colour
        if (shell && shell.contains(ev.target)) return; // starting a new selection inside the exam
        hideHighlightBar();
      });
    }
  }

  // Cross-browser caretRangeAt helper.
  // Firefox uses caretPositionFromPoint (returns CaretPosition);
  // Chrome / Safari use caretRangeFromPoint (returns Range). We
  // return a Range-like object exposing { startContainer, startOffset }.
  function caretRangeAt(x, y) {
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) return { startContainer: r.startContainer, startOffset: r.startOffset };
    }
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) return { startContainer: p.offsetNode, startOffset: p.offset };
    }
    return null;
  }

  // Expand a caret position inside a text node to the surrounding
  // word, then return a Range that selects exactly that word. Returns
  // null if the caret is on whitespace / punctuation only.
  function expandToWord(textNode, offset) {
    const text = textNode.nodeValue || '';
    if (!text) return null;
    const isWord = (ch) => /[\p{L}\p{N}'’\-]/u.test(ch);
    let start = Math.min(offset, text.length);
    let end   = start;
    // If the caret landed between two words (on whitespace), nudge
    // backwards once so we still pick up the trailing word.
    if (!isWord(text[start] || '') && start > 0 && isWord(text[start - 1])) start -= 1;
    if (!isWord(text[start] || '')) return null;
    while (start > 0 && isWord(text[start - 1])) start--;
    while (end < text.length && isWord(text[end])) end++;
    if (end <= start) return null;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    return range;
  }

  // Wire events on #rd-main ONCE per buildAndShow. The element is
  // preserved across renderPassage() calls (only innerHTML changes), so
  // we delegate from main rather than rebinding per render. Without
  // this, switching passages caused each click to fire 2×, 3×, … —
  // flag toggles cancelled themselves, note popovers reopened, etc.
  function wireMainEvents() {
    const main = document.getElementById('rd-main');
    if (!main || main.dataset.wired === '1') return;
    main.dataset.wired = '1';

    main.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.classList) return;
      if (t.classList.contains('rd-input') && t.tagName === 'SELECT') {
        setAnswer(t.dataset.section, t.dataset.q, t.value);
      } else if (t.type === 'radio' && t.dataset.section) {
        setAnswer(t.dataset.section, t.dataset.q, t.value);
      }
    });
    main.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.classList) return;
      if (t.classList.contains('rd-text') || t.classList.contains('rd-textarea')) {
        setAnswer(t.dataset.section, t.dataset.q, t.value);
      }
    });
    main.addEventListener('click', (e) => {
      if (!state) return;
      const flagBtn = e.target.closest && e.target.closest('.rd-flag');
      if (flagBtn) {
        const fk = flagKey(state.passageIdx, flagBtn.dataset.section, flagBtn.dataset.q);
        state.flags[fk] = !state.flags[fk];
        flagBtn.classList.toggle('is-on', !!state.flags[fk]);
        refreshTracker();
        return;
      }
      const noteBtn = e.target.closest && e.target.closest('.rd-note');
      if (noteBtn) {
        toggleNote(noteBtn.dataset.section, noteBtn.dataset.q, noteBtn);
        return;
      }
      // Per-question accordion chevron. Has to be checked BEFORE the
      // section-head fall-through so it doesn't accidentally toggle
      // the parent section.
      const qToggle = e.target.closest && e.target.closest('.rd-q-toggle');
      if (qToggle) {
        const qBlock = qToggle.closest('.rd-q-block');
        if (qBlock) {
          const willCollapse = !qBlock.classList.contains('is-collapsed');
          qBlock.classList.toggle('is-collapsed', willCollapse);
          qToggle.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
          qToggle.setAttribute('aria-label',
            willCollapse ? 'Expand this question' : 'Collapse this question');
          qToggle.setAttribute('title',
            willCollapse ? 'Click to expand this question' : 'Click to collapse this question');
        }
        return;
      }
      // Accordion section-header click. Ignore clicks on focusable
      // descendants (flag/note/chevron buttons handled above) —
      // `.closest()` catches the right element even if the student
      // clicks the label, instructions, or chevron text.
      const head = e.target.closest && e.target.closest('.rd-section-head');
      if (head) {
        const sec = head.closest('.rd-section');
        if (!sec) return;
        const willCollapse = !sec.classList.contains('is-collapsed');
        sec.classList.toggle('is-collapsed', willCollapse);
        head.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      }
    });
    // Keyboard support — Enter / Space on a focused section head
    // toggles the same accordion. role="button" + tabindex="0" on
    // the head element is what makes it tab-reachable.
    main.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const head = e.target.closest && e.target.closest('.rd-section-head');
      if (!head) return;
      e.preventDefault();
      head.click();
    });
  }

  function toggleTracker(forceState) {
    const drawer = document.getElementById('rd-tracker');
    if (!drawer) return;
    if (typeof forceState === 'boolean') drawer.hidden = !forceState;
    else drawer.hidden = !drawer.hidden;
    if (!drawer.hidden) refreshTracker();
  }

})();
