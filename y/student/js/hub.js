/* ============================================================
   HUB - multi-skill landing screen
   Renders the 6 skill cards, wires navigation to each skill screen.
   Designed to NOT touch any existing vocabulary code.
   ============================================================ */

(function () {
  'use strict';

  // ---- Skill registry ---------------------------------------------------
  // Each skill maps to the existing or future screen it opens.
  // `active: false` skills render as an empty card - clicking still routes
  // to the (empty) screen per the user's spec (no "Coming soon" label).
  // Per-skill accent colors. One blue family since the white-and-blue repaint:
  // the tiles used to be teal / orange / sky / rose / violet / amber, which was
  // the single biggest source of colour in the app. Stepping through the blue
  // ladder keeps the eight tiles distinguishable from each other without
  // bringing a second hue back. All eight clear 3:1 contrast on white.
  const SKILLS = [
    {
      id: 'vocabulary',
      name: 'Vocabulary',
      icon: '📚',
      screen: 'menuScreen',      // existing vocab menu - untouched
      accent: '#1d4ed8',         // blue-700
      active: true
    },
    {
      id: 'grammar',
      name: 'Grammar',
      icon: '✏️',
      screen: 'grammarScreen',   // empty shell - step 3.4
      accent: '#2563eb',         // blue-600
      active: true
    },
    {
      id: 'listening',
      name: 'Listening',
      icon: '🎧',
      screen: 'listeningScreen', // new skill home - built in step 3.3
      accent: '#0284c7',         // sky-600
      active: true
    },
    {
      id: 'reading',
      name: 'Reading',
      icon: '📖',
      screen: 'readingScreen',
      accent: '#3b82f6',         // blue-500
      active: true
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: '✍️',
      screen: 'writingScreen',
      accent: '#1e40af',         // blue-800
      active: false
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: '🎤',
      screen: 'speakingScreen',
      accent: '#0369a1',         // sky-700
      active: false
    },
    // Classroom Mode - promoted from its old home inside the Vocabulary
    // activity grid. Now a peer of the six skills because it's a
    // delivery mode (teacher-led, multi-student, real-time) that cuts
    // across every skill, not a vocab-specific feature.
    //
    // Differs from the six skills:
    //   • `href` navigates externally to classroom-student.html - there
    //     is no in-page screen for it.
    //   • No progress ring (it's not a "your progress" thing - it's
    //     a live activity to join).
    //   • Renders with a "LIVE" pill chip instead of a percentage.
    {
      id: 'classroom',
      name: 'Classroom Mode',
      icon: '🎮',
      href: 'classroom-student.html',
      accent: '#60a5fa',         // blue-400
      active: true,
      noProgress: true           // suppresses the conic-gradient ring fill
    },
    // Courses - Coursera-style mini courses (policy/onboarding etc.) with
    // module quizzes, a final exam and a printable certificate. Navigates
    // to the courses catalog page; each course is teacher-activated.
    {
      id: 'courses',
      name: 'Courses',
      icon: '🎓',
      href: 'courses.html',
      accent: '#075985',         // sky-800
      active: true,
      noProgress: true,
      pill: 'CERT'               // pill chip text (defaults to LIVE)
    }
  ];

  // ---- Progress hook ---------------------------------------------------
  // Reads the `journeyStats` global populated by progress.js. Each skill uses
  // its OWN accuracy from journeyStats.bySkill (grammar, reading, listening
  // and writing used to be hardcoded to 0 here, so their rings never moved no
  // matter how much the student practised). Falls back to 0 if stats haven't
  // loaded yet - the observer below re-renders once they do.
  function getSkillProgress(skillId) {
    try {
      if (typeof journeyStats === 'undefined' || !journeyStats) return 0;
      const b = journeyStats.bySkill && journeyStats.bySkill[skillId];
      if (b && typeof b.pct === 'number') return Math.max(0, Math.min(100, b.pct));
      // Stats cached by an older build have no bySkill map. Keep the previous
      // behaviour for vocabulary until the fresh Firestore read lands.
      if (skillId === 'vocabulary' && typeof journeyStats.averageScore === 'number') {
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
  // ignore that arg - render always pulls fresh stats from journeyStats.
  // Have the org feature toggles landed yet? Until they have we do NOT know
  // which skills this university switched off.
  //
  // This used to render the full grid on DOMContentLoaded with
  // `window.featureToggles || {}` - an empty object, which reads as "everything
  // is active" - and then re-render a moment later when the real toggles
  // arrived, removing the deactivated tiles. That is the flash: every tile
  // appears, then some vanish. Rendering skeletons until we actually know means
  // the first grid a student sees is already the right one.
  let togglesReady = false;

  function renderSkeletons(grid) {
    // Same count as the real grid would be, so the block does not resize when
    // the tiles replace it.
    const n = SKILLS.length;
    let html = '';
    for (let i = 0; i < n; i++) {
      html += '<div class="hub-card as-skeleton" aria-hidden="true">'
            + '<div class="hub-ring"></div>'
            + '<div class="hub-meta"><div class="sk-line sk-line-lg"></div>'
            + '<div class="sk-line sk-line-sm"></div></div></div>';
    }
    grid.innerHTML = html;
  }

  // What the grid would look like right now, as a short string. If it matches
  // the last render, there is nothing to do.
  //
  // renderHub() is called from several places - the toggles arriving, returning
  // to the hub, and a MutationObserver watching the journey stats, which fire
  // whenever Firestore delivers them. Each call did `grid.innerHTML = ''` and
  // rebuilt every tile, so a trigger that changed NOTHING still produced a
  // visible rebuild. That is the other half of "the tiles refresh twice".
  //
  // Guarding on the output rather than on each caller means any future trigger
  // is free too, and a call that genuinely changes something still repaints.
  function gridSignature() {
    const toggles = window.featureToggles || {};
    const hideInactive = !!(window.Tenant && window.Tenant.feature('hideInactiveTiles', false));
    return SKILLS.map(s => {
      const off = toggles[s.id] === false;
      if (off && hideInactive) return '';                       // not rendered
      const pct = (s.active && !s.noProgress && !off) ? getSkillProgress(s.id) : 0;
      return s.id + (off ? ':off' : ':on') + ':' + pct;
    }).join('|');
  }

  // WHICH TILES EXIST, ignoring their numbers. When only the percentages have
  // moved this is unchanged, and that is the common case: the first paint
  // draws 0% because Firestore has not answered, then the real numbers arrive.
  // Priming from a cache hides that, but only for someone who has visited
  // before - a first-ever sign-in still had nothing to prime from and still
  // saw the grid torn down and rebuilt. So the structure is tracked separately
  // from the values, and a values-only change is applied IN PLACE.
  function structureSignature() {
    const toggles = window.featureToggles || {};
    const hideInactive = !!(window.Tenant && window.Tenant.feature('hideInactiveTiles', false));
    return SKILLS.map(s => {
      const off = toggles[s.id] === false;
      if (off && hideInactive) return '';
      return s.id + (off ? ':off' : ':on') + (s.active ? ':a' : ':i');
    }).join('|');
  }
  let lastSignature = null;
  let lastStructure = null;

  // Update the numbers on tiles that are already on screen. No node is
  // removed, so there is no teardown and nothing flashes.
  function updateHubValues(grid) {
    const toggles = window.featureToggles || {};
    SKILLS.forEach((skill) => {
      const btn = grid.querySelector('.hub-card[data-skill="' + skill.id + '"]');
      if (!btn) return;
      const switchedOff = toggles[skill.id] === false;
      const pct = (skill.active && !skill.noProgress && !switchedOff) ? getSkillProgress(skill.id) : 0;

      btn.style.setProperty('--pct', String(pct));
      const ring = btn.querySelector('.hub-ring');
      if (ring) ring.style.setProperty('--pct', String(pct));

      // Only the plain percentage is rewritten. The OFF and LIVE/CERT pills
      // belong to the structure, and that has not changed if we are here.
      const pctEl = btn.querySelector('.hub-pct');
      if (pctEl && !switchedOff && !skill.noProgress) pctEl.textContent = skill.active ? (pct + '%') : '-';

      // The subtitle carries a number too ("N words learned"), so it moves
      // with the percentages and would otherwise stay stale.
      const subEl = btn.querySelector('.hub-sub');
      if (subEl && !switchedOff) subEl.textContent = getSkillSubtitle(skill.id);
    });
  }

  function renderHub() {
    const grid = document.getElementById('hubGrid');
    if (!grid) return;

    // `window.featureToggles != null` means feature-toggles.js primed them from
    // the last visit's saved copy at parse time, so we DO know which skills
    // this university switched off and can draw the real grid immediately.
    // Skeletons are only for the case where we genuinely do not know yet: a
    // first-ever sign-in on this device. Note `!= null` on purpose - an empty
    // object is a real answer ("nothing switched off") and must not be confused
    // with "no answer".
    if (!togglesReady && window.featureToggles == null) { renderSkeletons(grid); return; }

    const sig = gridSignature();
    // Also require the grid to still hold real tiles: if something else wiped
    // it (or we are coming off skeletons) we must rebuild even on a match.
    const hasRealTiles = !!grid.querySelector('.hub-card:not(.as-skeleton)');
    if (sig === lastSignature && hasRealTiles) return;

    // SAME TILES, DIFFERENT NUMBERS: patch them and leave the DOM alone.
    // This is what the arrival of the Firestore stats looks like, and it used
    // to wipe the grid and rebuild it - the visible "loads twice".
    const struct = structureSignature();
    if (hasRealTiles && struct === lastStructure) {
      lastSignature = sig;
      updateHubValues(grid);
      return;
    }

    lastSignature = sig;
    lastStructure = struct;

    grid.innerHTML = '';
    SKILLS.forEach(skill => {
      // Org-level feature toggle (settings/featureToggles via
      // feature-toggles.js) says whether this university bought the skill.
      const toggles = window.featureToggles || {};
      const switchedOff = toggles[skill.id] === false;

      /* What a switched-off skill LOOKS like differs per university, so it is
         a named capability rather than an `if (Tenant.id === ...)`.

           false (FSMVU, and the default) - the tile stays on screen, greyed,
                 labelled "Not activated". Students can see what exists.
           true  (Ozyegin)                - the tile is not rendered at all,
                 so the grid closes up and a skill they did not buy never
                 advertises itself to their students.

         Default is false so FSMVU behaves exactly as it does today. */
      const hideInactive = !!(window.Tenant && window.Tenant.feature('hideInactiveTiles', false));
      if (switchedOff && hideInactive) return;

      // Classroom Mode skips the conic-gradient progress fill - it's
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
        pctLabel = skill.active ? `${pct}%` : '-';
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
        // Only reachable where hideInactiveTiles is false, since the tile is
        // not rendered at all when it is true.
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
    // Real tiles are on screen (the skeleton branch above returned early):
    // one of the signals the boot hold in student-dashboard.html waits for.
    try { if (window.LLHubBoot) LLHubBoot.ready('tiles'); } catch (_) {}
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
    btn.setAttribute('aria-label', 'Back to dashboard');
    btn.style.alignSelf = 'flex-start';
    btn.style.marginBottom = '8px';
    btn.innerHTML = '<span class="chev" aria-hidden="true">←</span><span>Dashboard</span>';
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
  // The org feature toggles have arrived: now we can draw the real grid.
  document.addEventListener('feature-toggles-ready', () => {
    togglesReady = true;
    renderHub();
  });

  // Safety net for the case where feature-toggles.js is BLOCKED OR NEVER LOADS.
  // It fires the event itself even when the Firestore read fails, so in any
  // normal run this timer is dead code.
  //
  // 8s, not the 3s it used to be, and that matters: feature-toggles.js now
  // holds its first announcement until the SERVER snapshot lands (the cached
  // one can say "every skill is active" and produce exactly the tile flash this
  // is all about), falling back to the cache at 3.5s if the device is offline.
  // At 3s this timer beat that fallback on any slow connection and forced the
  // wrong grid anyway - the same bug by a different route. It must stay safely
  // above 3.5s.
  setTimeout(() => {
    if (togglesReady) return;
    togglesReady = true;
    renderHub();
  }, 8000);

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
