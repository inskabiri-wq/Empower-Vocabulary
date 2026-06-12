/* ============================================================
   HUB — multi-skill landing screen
   Renders the 6 skill cards, wires navigation to each skill screen.
   Designed to NOT touch any existing vocabulary code.
   ============================================================ */

(function () {
  'use strict';

  // ---- Skill registry ---------------------------------------------------
  // Each skill maps to the existing or future screen it opens.
  // `active: false` skills render as an empty card — clicking still routes
  // to the (empty) screen per the user's spec (no "Coming soon" label).
  // Per-skill accent colors. Grammar uses the warm orange from the
  // dashboard's xp token (#f59e0b); other skills pick distinct hues that
  // sit well on the dark teal surface without clashing.
  const SKILLS = [
    {
      id: 'vocabulary',
      name: 'Vocabulary',
      icon: '📚',
      screen: 'menuScreen',      // existing vocab menu — untouched
      accent: '#2dd4bf',         // teal (brand primary)
      active: true
    },
    {
      id: 'listening',
      name: 'Listening',
      icon: '🎧',
      screen: 'listeningScreen', // new skill home — built in step 3.3
      accent: '#38bdf8',         // sky blue
      active: true
    },
    {
      id: 'grammar',
      name: 'Grammar',
      icon: '✏️',
      screen: 'grammarScreen',   // empty shell — step 3.4
      accent: '#f59e0b',         // orange
      active: true
    },
    {
      id: 'reading',
      name: 'Reading',
      icon: '📖',
      screen: 'readingScreen',
      accent: '#fb7185',         // rose
      active: true
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: '✍️',
      screen: 'writingScreen',
      accent: '#a78bfa',         // violet
      active: false
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: '🎤',
      screen: 'speakingScreen',
      accent: '#fbbf24',         // amber
      active: false
    },
    // Classroom Mode — promoted from its old home inside the Vocabulary
    // activity grid. Now a peer of the six skills because it's a
    // delivery mode (teacher-led, multi-student, real-time) that cuts
    // across every skill, not a vocab-specific feature.
    //
    // Differs from the six skills:
    //   • `href` navigates externally to classroom-student.html — there
    //     is no in-page screen for it.
    //   • No progress ring (it's not a "your progress" thing — it's
    //     a live activity to join).
    //   • Renders with a "LIVE" pill chip instead of a percentage.
    {
      id: 'classroom',
      name: 'Classroom Mode',
      icon: '🎮',
      href: 'classroom-student.html',
      accent: '#a78bfa',         // violet — matches the live-class purple
      active: true,
      noProgress: true           // suppresses the conic-gradient ring fill
    },
    // Courses — Coursera-style mini courses (policy/onboarding etc.) with
    // module quizzes, a final exam and a printable certificate. Navigates
    // to the courses catalog page; each course is teacher-activated.
    {
      id: 'courses',
      name: 'Courses',
      icon: '🎓',
      href: 'courses.html',
      accent: '#14b8a6',         // teal-green
      active: true,
      noProgress: true,
      pill: 'CERT'               // pill chip text (defaults to LIVE)
    }
  ];

  // ---- Progress hook ---------------------------------------------------
  // Reads the `journeyStats` global populated by progress.js (averageScore
  // is an integer 0-100). Falls back to 0 if stats haven't loaded yet — the
  // observer below will re-render once they do.
  function getSkillProgress(skillId) {
    try {
      if (skillId === 'vocabulary'
          && typeof journeyStats !== 'undefined'
          && journeyStats
          && typeof journeyStats.averageScore === 'number') {
        return Math.max(0, Math.min(100, journeyStats.averageScore));
      }
    } catch (_) { /* journeyStats not defined yet */ }
    return 0;
  }

  function getSkillSubtitle(skillId) {
    try {
      if (skillId === 'vocabulary'
          && typeof journeyStats !== 'undefined'
          && journeyStats) {
        const words = journeyStats.totalWordsLearned || 0;
        if (words > 0) return `${words} words learned`;
      }
    } catch (_) {}
    if (skillId === 'vocabulary') return 'Your word sets';
    if (skillId === 'listening')  return 'Exams & practice';
    if (skillId === 'reading')    return 'Exams & practice';
    if (skillId === 'classroom')  return 'Join a live class game';
    if (skillId === 'grammar')    return 'Practice by level';
    if (skillId === 'courses')    return 'Mini courses & certificates';
    return '-';
  }

  // ---- Render ----------------------------------------------------------
  // NOTE: MutationObserver invokes this with (records, observer); we
  // ignore that arg — render always pulls fresh stats from journeyStats.
  function renderHub() {
    const grid = document.getElementById('hubGrid');
    if (!grid) return;

    grid.innerHTML = '';
    SKILLS.forEach(skill => {
      // Org-level feature toggle (settings/featureToggles via
      // feature-toggles.js). A switched-off skill stays VISIBLE but
      // grayed with a "Not activated" state - never removed.
      const toggles = window.featureToggles || {};
      const switchedOff = toggles[skill.id] === false;

      // Classroom Mode skips the conic-gradient progress fill — it's
      // a live activity, not a measurable skill. Other skills get
      // their averageScore as the ring fill.
      const pct = (skill.active && !skill.noProgress && !switchedOff) ? getSkillProgress(skill.id) : 0;
      let pctLabel;
      if (switchedOff) {
        pctLabel = '<span class="hub-live-pill hub-off-pill">OFF</span>';
      } else if (skill.noProgress) {
        // Pill chip in place of the percentage ("LIVE", "CERT", ...).
        pctLabel = '<span class="hub-live-pill">' + (skill.pill || 'LIVE') + '</span>';
      } else {
        pctLabel = skill.active ? `${pct}%` : '—';
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hub-card' +
        (skill.active ? '' : ' is-empty') +
        (switchedOff ? ' is-off' : '') +
        (skill.id === 'classroom' ? ' is-classroom' : '');
      btn.dataset.skill = skill.id;
      if (skill.screen) btn.dataset.screen = skill.screen;
      if (skill.href)   btn.dataset.href   = skill.href;
      btn.setAttribute('aria-label', `Open ${skill.name}`);
      btn.style.setProperty('--pct', String(pct));
      if (skill.accent) btn.style.setProperty('--skill-accent', skill.accent);

      btn.innerHTML = `
        <div class="hub-ring" style="--pct:${pct}">
          <span class="hub-icon" aria-hidden="true">${skill.icon}</span>
        </div>
        <div class="hub-meta">
          <div class="hub-name">${skill.name}</div>
          <div class="hub-sub">${switchedOff ? 'Not activated' : getSkillSubtitle(skill.id)}</div>
        </div>
        <div class="hub-pct">${pctLabel}</div>
      `;

      btn.addEventListener('click', () => {
        if (switchedOff) {
          if (typeof AppDialog !== 'undefined' && AppDialog.alert) {
            AppDialog.alert(skill.name + ' is not activated for your programme.');
          }
          return;
        }
        openSkill(skill);
      });
      grid.appendChild(btn);
    });
  }

  // ---- Navigation ------------------------------------------------------
  function openSkill(skill) {
    // Log activity first so we don't lose the event if href navigation
    // unloads the page before the log fires.
    try {
      if (typeof logActivity === 'function') {
        logActivity('skill_opened', { skill: skill.id });
      }
    } catch (_) {}

    // Classroom (or any future skill with an `href`) navigates to an
    // external page rather than swapping in-page screens.
    if (skill.href) {
      window.location.href = skill.href;
      return;
    }

    if (typeof showScreen !== 'function') {
      console.warn('[hub] showScreen() not available yet');
      return;
    }
    // If the target screen doesn't exist in the DOM yet, fail gracefully.
    if (!document.getElementById(skill.screen)) {
      console.warn(`[hub] screen #${skill.screen} not found`);
      return;
    }
    showScreen(skill.screen);
    // Re-opening a skill from the hub gives it a fresh start (e.g. grammar
    // practice resets to the level/topic list, never a half-finished drill).
    if (skill.id === 'grammar' && typeof window.renderGrammarScreen === 'function') {
      window.renderGrammarScreen();
    }
  }

  function backToHub() {
    if (typeof showScreen === 'function') {
      showScreen('hubScreen');
      renderHub(); // refresh progress each time we return
    }
  }

  // ---- Profile mirror --------------------------------------------------
  // avatar.js and progress.js write the logged-in user's name / XP / avatar
  // to fixed IDs on #menuScreen. The hub header needs the same data but
  // can't share those IDs (HTML forbids duplicates). We mirror values from
  // the canonical elements → Hub copies whenever they change. No change
  // needed to avatar.js or progress.js.
  const MIRROR_MAP = [
    { from: 'profileName',        to: 'profileNameHub',        kind: 'text' },
    { from: 'profileXP',          to: 'profileXPHub',          kind: 'text' },
    { from: 'profileXPLevel',     to: 'profileXPLevelHub',     kind: 'text' },
    { from: 'avatarDisplayEmoji', to: 'avatarDisplayEmojiHub', kind: 'text' },
    { from: 'avatarDisplay',      to: 'avatarDisplayHub',      kind: 'bgcolor' }
  ];

  function syncHubHeader() {
    MIRROR_MAP.forEach(({ from, to, kind }) => {
      const src = document.getElementById(from);
      const dst = document.getElementById(to);
      if (!src || !dst) return;
      if (kind === 'text') {
        dst.textContent = src.textContent;
      } else if (kind === 'bgcolor') {
        // Copy inline background (avatar.js sets style.background)
        dst.style.background = src.style.background || getComputedStyle(src).background;
      }
    });
  }

  function setupProfileObservers() {
    MIRROR_MAP.forEach(({ from, kind }) => {
      const src = document.getElementById(from);
      if (!src) return;
      const observer = new MutationObserver(syncHubHeader);
      observer.observe(src, {
        childList: true,       // text content changes
        characterData: true,   // text node mutations
        subtree: true,
        attributes: kind === 'bgcolor',
        attributeFilter: kind === 'bgcolor' ? ['style'] : undefined
      });
    });

    // Re-render skill rings when journey stats load/update
    // (progress.js writes to #journeyAccuracy inside #menuScreen)
    const journeyEl = document.getElementById('journeyAccuracy');
    if (journeyEl) {
      const journeyObs = new MutationObserver(renderHub);
      journeyObs.observe(journeyEl, {
        childList: true, characterData: true, subtree: true
      });
    }
  }

  // ---- Public API ------------------------------------------------------
  window.renderHub     = renderHub;
  window.backToHub     = backToHub;
  window.openSkill     = openSkill;
  window.syncHubHeader = syncHubHeader;

  // ---- Inject back-to-hub button into Vocabulary header ----------------
  // Vocabulary (#menuScreen) is the only skill screen whose HTML we don't
  // touch per user spec. We inject a "← Hub" button at runtime so the user
  // can still navigate home from inside Vocabulary.
  function injectVocabBackButton() {
    const menu = document.getElementById('menuScreen');
    if (!menu) return;
    // Guard against double-injection (hot reload / reinit)
    if (menu.querySelector('.skill-back-btn.js-injected')) return;

    const headerLeft = menu.querySelector('.dashboard-header .header-left');
    if (!headerLeft) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-back-btn js-injected';
    btn.setAttribute('aria-label', 'Back to hub');
    btn.style.alignSelf = 'flex-start';
    btn.style.marginBottom = '8px';
    btn.innerHTML = '<span class="chev" aria-hidden="true">←</span><span>Hub</span>';
    btn.addEventListener('click', backToHub);
    headerLeft.insertBefore(btn, headerLeft.firstChild);
  }

  // ---- Deep-link to skills via URL hash --------------------------------
  // Classroom pages (and any external link) can deep-link straight into a
  // specific skill screen by ending the URL with #vocabulary / #listening
  // etc. Without this, those links would always land on the hub and force
  // an extra click.
  function routeFromHash() {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (!hash) return;
    const match = SKILLS.find(s => s.id === hash);
    if (!match) return;
    // Only jump if the target screen actually exists in this page
    if (!document.getElementById(match.screen)) return;
    if (typeof showScreen !== 'function') return;
    showScreen(match.screen);
  }

  // ---- Boot ------------------------------------------------------------
  // Re-render when the org feature toggles arrive (feature-toggles.js).
  document.addEventListener('feature-toggles-ready', renderHub);

  document.addEventListener('DOMContentLoaded', () => {
    renderHub();
    syncHubHeader();
    setupProfileObservers();
    injectVocabBackButton();
    routeFromHash();
  });
  // Also respond to hash changes while the page is open (e.g. user edits URL)
  window.addEventListener('hashchange', routeFromHash);
})();
