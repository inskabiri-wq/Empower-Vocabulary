/* ============================================================
   APP DISPLAY SETTINGS - shared controller (every page)
   ------------------------------------------------------------
   The text-size / line-spacing controls from the writing exam,
   made app-wide. One saved preference follows the user across
   the student hub, teacher dashboard, assignments, courses,
   exams and the classroom pages.

   Load this in <head> (see the note below) so the saved scale is
   applied BEFORE first paint - otherwise a student who chose A++
   sees the page render small and then jump.

   Self-contained: injects its own launcher + panel, so a page
   only needs the stylesheet link and this script. Pages that
   already own their own display controls (the writing and
   reading exams) opt out with:
       <body data-app-settings="off">

   Storage: localStorage['ll-display'] = {"scale":"1.15","line":"loose"}
   Nothing is written to Firestore, so this costs nothing to run.
   ============================================================ */
(function () {
  'use strict';
  if (window.AppSettings) return;

  var KEY = 'll-display';
  var SCALES = [
    { v: '0.9',  label: 'A',   title: 'Smaller', size: '0.8rem' },
    { v: '1',    label: 'A',   title: 'Default', size: '0.95rem' },
    { v: '1.15', label: 'A',   title: 'Larger',  size: '1.12rem' },
    { v: '1.3',  label: 'A',   title: 'Largest', size: '1.3rem' }
  ];
  var LINES = [
    { v: 'tight',   label: 'Tight' },
    { v: 'default', label: 'Normal' },
    { v: 'loose',   label: 'Loose' }
  ];
  // Theme reuses the app's EXISTING light mode: `body.light-mode` plus the
  // localStorage key 'theme', which the student dashboard already wrote. We
  // deliberately do not invent a second mechanism; this row is now the only
  // theme control in the app, so nothing can disagree with it.
  // The writing exam's four palettes, now app-wide.
  var THEMES = [
    { v: 'dark',     label: 'Dark' },
    { v: 'light',    label: 'Light' },
    { v: 'sepia',    label: 'Sepia' },
    { v: 'contrast', label: 'Contrast' }
  ];
  // Editor font families, taken over from the writing exam's own panel.
  var FONTS = [
    { v: 'serif', label: 'Serif' },
    { v: 'sans',  label: 'Sans' },
    { v: 'mono',  label: 'Mono' }
  ];
  var FONT_FAMILIES = {
    serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
    sans:  "'Inter', 'Segoe UI', system-ui, sans-serif",
    mono:  "'JetBrains Mono', Menlo, Consolas, monospace"
  };
  var DEFAULTS = { scale: '1', line: 'default', theme: 'dark', font: '' };

  function read() {
    var theme = DEFAULTS.theme;
    // 'theme' is the app's own pre-existing key (ui.js). Read it, don't shadow it.
    try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'sepia' || t === 'contrast') theme = t; } catch (_) {}
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        scale: p.scale || DEFAULTS.scale,
        line:  p.line  || DEFAULTS.line,
        theme: theme,
        font:  p.font  || DEFAULTS.font
      };
    } catch (_) { return { scale: DEFAULTS.scale, line: DEFAULTS.line, theme: theme }; }
  }
  function write(prefs) {
    try { localStorage.setItem(KEY, JSON.stringify({ scale: prefs.scale, line: prefs.line, font: prefs.font })); } catch (_) {}
    // Theme keeps living under the app's original key so ui.js stays in sync.
    try { localStorage.setItem('theme', prefs.theme || 'dark'); } catch (_) {}
  }

  // ── Apply (runs immediately, before the DOM exists) ────────
  // Only touches documentElement, so it is safe in <head>.
  function apply(prefs) {
    var root = document.documentElement;
    root.style.setProperty('--app-scale', String(prefs.scale || '1'));
    if (prefs.line && prefs.line !== 'default') root.setAttribute('data-app-line', prefs.line);
    else root.removeAttribute('data-app-line');
    applyTheme(prefs.theme);
    applyFont(prefs.font);
  }
  // Writing editor only, as it always was. The panel does not expose a font
  // control any more: it was never asked for, and applying it app-wide changed
  // the typography of every page.
  function applyFont(f) {
    var root = document.documentElement;
    root.removeAttribute('data-app-font');
    var ed = document.getElementById('wrEditor');
    if (ed && f && FONT_FAMILIES[f]) ed.style.fontFamily = FONT_FAMILIES[f];
  }
  // Toggles the SAME class the app's existing light mode uses, so the gear's
  // original Dark Mode row and this control drive one thing, not two.
  // <body> may not exist yet when this file runs in <head>; the mount step
  // re-applies once it does.
  function applyTheme(t) {
    if (!document.body) return;
    var b = document.body;
    // Light reuses the app's existing class (144 rules already written for it);
    // sepia / contrast are token overrides in app-settings.css.
    b.classList.toggle('light-mode', t === 'light');
    b.classList.toggle('theme-sepia', t === 'sepia');
    b.classList.toggle('theme-contrast', t === 'contrast');
  }

  var current = read();
  apply(current);

  // ── UI ─────────────────────────────────────────────────────
  var el = {};

  function gearSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<circle cx="12" cy="12" r="3"/>'
      + '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 '
      + '1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 '
      + '1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 '
      + '4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 '
      + '1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06'
      + 'A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  }

  // The game pages' own music button carries the current state in its text
  // ("Music on" / a muted glyph), so mirror it rather than track state twice.
  function musicLabel() {
    var b = document.getElementById('musicBtn');
    var t = b ? (b.textContent || '').trim() : '';
    return t || 'Music';
  }

  // ── Page-owned switches (Sound effects / Turkish hints) ────
  // NOT a second settings system. The panel calls the page's OWN
  // toggleSound() / toggleTurkish() and reads the same localStorage keys those
  // functions write - the same contract the Music row uses for toggleMusic().
  // The student dashboard used to render these as its own bespoke rows inside
  // its own modal, which is why its settings box looked nothing like the panel
  // every other page shows. They are ordinary panel sections now, so there is
  // one settings surface in the app instead of two.
  // Presentation is the dashboard's ORIGINAL one, deliberately: icon, name,
  // description, sliding switch. Turning them into On/Off button pairs threw
  // away the icons and read as a downgrade. Only the HOST changed - they live
  // in the shared panel now instead of a dashboard-only modal - and the styling
  // moved into app-settings.css so the row looks the same wherever it appears.
  var SWITCHES = [
    {
      key: 'sound', fn: 'toggleSound', store: 'soundEnabled', def: true,
      name: 'Sound Effects', desc: 'Play sounds for correct/incorrect answers',
      icon: '🔊', iconOff: '🔇'
    },
    {
      key: 'turkish', fn: 'toggleTurkish', store: 'turkishEnabled', def: false,
      name: 'Turkish Hints', desc: 'Show Turkish translations (A2 level)',
      icon: '🇹🇷', iconOff: '🇹🇷'
    }
  ];
  function switchDef(key) {
    for (var i = 0; i < SWITCHES.length; i++) if (SWITCHES[i].key === key) return SWITCHES[i];
    return null;
  }
  function switchAvailable(s) { return typeof window[s.fn] === 'function'; }
  function switchOn(s) {
    try {
      var v = localStorage.getItem(s.store);
      return v === null ? s.def : v === 'true';
    } catch (_) { return s.def; }
  }
  function switchesHtml() {
    var rows = SWITCHES.filter(switchAvailable).map(function (s) {
      var on = switchOn(s);
      return '<div class="as-switch' + (on ? ' on' : '') + '" data-switch="' + s.key + '"'
        + ' role="switch" tabindex="0" aria-checked="' + (on ? 'true' : 'false') + '">'
        + '<span class="as-switch-ic" aria-hidden="true">' + (on ? s.icon : s.iconOff) + '</span>'
        + '<span class="as-switch-txt">'
        + '<span class="as-switch-name">' + s.name + '</span>'
        + '<span class="as-switch-desc">' + s.desc + '</span>'
        + '</span>'
        + '<span class="as-switch-track" aria-hidden="true"></span>'
        + '</div>';
    }).join('');
    return rows ? '<div class="as-section as-switches">' + rows + '</div>' : '';
  }

  function rowHtml(items, attr, activeVal) {
    return items.map(function (it) {
      var on = String(it.v) === String(activeVal);
      var style = it.size ? ' style="font-size:' + it.size + '"' : '';
      var title = it.title ? ' title="' + it.title + '"' : '';
      return '<button type="button" data-' + attr + '="' + it.v + '"'
        + (on ? ' class="active"' : '') + style + title
        + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + it.label + '</button>';
    }).join('');
  }


  // ── The gear's look, applied from JS ────────────────────────
  // Stylesheets could not settle this. Whether a gear matched depended on
  // which CSS version that page had loaded, what tokens it defined, and the
  // order its own stylesheets came in - so the same rule produced a slate box
  // on one page, a dark box on another and a blue one on a third.
  //
  // An inline declaration marked important outranks EVERY author rule on the
  // page, including other !important rules. Painting each gear directly is the
  // only way to guarantee they are the same object everywhere, and it cannot
  // be undone by a stale or unexpected stylesheet.
  var GEAR_STYLE = {
    'box-sizing': 'border-box',
    'width': '44px', 'height': '44px', 'min-width': '44px', 'padding': '0',
    'border-radius': '12px',
    'background': '#1c2a42',
    'border': '1px solid rgba(59,130,246,0.25)',
    'color': '#c4b5fd',
    'display': 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'box-shadow': 'none',
    'cursor': 'pointer'
  };
  function paintGear(g) {
    if (!g) return;
    for (var k in GEAR_STYLE) {
      if (Object.prototype.hasOwnProperty.call(GEAR_STYLE, k)) {
        g.style.setProperty(k, GEAR_STYLE[k], 'important');
      }
    }
    // Inline !important also outranks a CSS :hover rule, so the highlight had
    // to come back the same way it is painted: on the element itself.
    g.style.setProperty('transition', 'background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease', 'important');
    if (!g.__asHover) {
      g.__asHover = true;
      g.addEventListener('mouseenter', function () {
        g.style.setProperty('background', '#243450', 'important');
        g.style.setProperty('border-color', 'rgba(59,130,246,0.55)', 'important');
        g.style.setProperty('color', '#ddd6fe', 'important');
        g.style.setProperty('transform', 'translateY(-1px)', 'important');
      });
      g.addEventListener('mouseleave', function () {
        g.style.setProperty('background', GEAR_STYLE.background, 'important');
        g.style.setProperty('border', GEAR_STYLE.border, 'important');
        g.style.setProperty('color', GEAR_STYLE.color, 'important');
        g.style.setProperty('transform', 'none', 'important');
      });
    }
    var svg = g.querySelector('svg');
    if (svg) {
      svg.style.setProperty('width', '20px', 'important');
      svg.style.setProperty('height', '20px', 'important');
      svg.style.setProperty('stroke', 'currentColor', 'important');
      svg.style.setProperty('fill', 'none', 'important');
    }
  }


  // Every settings gear in the app gets its artwork and its box painted here,
  // so a page never supplies its own. There is one mount path now, so the sweep
  // can no longer be skipped on a page (which is how the dashboard once ended
  // up keeping a gear nobody else had).
  function styleAllGears() {

    // EVERY gear on the page gets the same artwork - not just the ones still
    // showing the emoji. The previous sweep only replaced elements whose text
    // contained the U+2699 glyph, so any gear that already had different
    // artwork was skipped and stayed visibly different. A settings button is
    // identified by intent (it opens settings), never by what it happens to
    // contain right now.
    var gears = [];
    Array.prototype.push.apply(gears, document.querySelectorAll('[data-app-settings-open]'));
    Array.prototype.forEach.call(document.querySelectorAll('button, a'), function (el) {
      var oc = (el.getAttribute('onclick') || '') + ' ' + (el.getAttribute('title') || '')
             + ' ' + (el.getAttribute('aria-label') || '');
      var isGear = /openSettingsModal|display settings|settings/i.test(oc)
                || /⚙/.test(el.textContent || '')
                || el.classList.contains('header-icon-btn');
      if (isGear && gears.indexOf(el) === -1) gears.push(el);
    });
    gears.forEach(function (g) {
      if (g !== el.launch) {
        var slot = g.querySelector('.ico') || g;
        slot.innerHTML = gearSvg();
        g.classList.add('as-gearicon');
      }
      paintGear(g);
    });
    if (el.launch) paintGear(el.launch);
  }

  // `needLauncher` false = the page already has its own gear, so the floating
  // one is never put in the document at all.
  //
  // It used to be created and then hidden with el.launch.style.display='none'.
  // That silently failed: the gear block at the bottom of app-settings.css sets
  // `display: inline-flex !important` on .as-launch.as-launch, and an
  // !important author rule outranks a non-important inline style. So the
  // dashboard grew a second wheel floating over its top-left corner. An element
  // that was never appended cannot be un-hidden by any stylesheet.
  function build(needLauncher) {
    var launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'as-launch';
    launch.id = 'appSettingsLaunch';
    launch.setAttribute('aria-label', 'Display settings');
    launch.setAttribute('title', 'Display settings');
    launch.innerHTML = gearSvg();

    var overlay = document.createElement('div');
    overlay.className = 'as-overlay';

    var panel = document.createElement('aside');
    panel.className = 'as-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Display settings');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML =
      '<div class="as-head"><h3>Display</h3>'
      + '<button type="button" class="as-x" aria-label="Close">✕</button></div>'
      + sectionsHtml();

    if (needLauncher) document.body.appendChild(launch);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    el = {
      launch: needLauncher ? launch : null, overlay: overlay, panel: panel,
      close: panel.querySelector('.as-x'),
      reset: panel.querySelector('.as-reset'),
      rows: panel.querySelectorAll('.as-row[data-row]')
    };
  }

  // Light mode is REAL CSS (`.light-mode` rules), and today it only covers the
  // student dashboard. Offering a Light button on a page with no light rules
  // would just produce an unreadable page, so the Theme row is shown only when
  // the page actually loads light-mode styles. As more areas get tokenised the
  // row appears there on its own - no code change needed.

  function sectionsHtml() {
    return ''
      // Sound / Turkish first, matching the order the dashboard's old modal
      // used, so a student sees the same list in the same place as before.
      + switchesHtml()
      // All four themes, on every page, always. Light used to be dropped where
      // the app's hand-written `.light-mode` rules were absent - which was most
      // of the app - so the panel's contents changed from page to page. Light
      // is now a complete token set like the other three, so it works
      // everywhere and the row never varies.
      + '<div class="as-section"><div class="as-label">Theme</div>'
      + '<div class="as-row" data-row="theme">'
      + rowHtml(THEMES, 'theme', current.theme)
      + '</div></div>'
      + '<div class="as-section"><div class="as-label">Text size</div>'
      + '<div class="as-row" data-row="scale">' + rowHtml(SCALES, 'scale', current.scale) + '</div></div>'
      + '<div class="as-section"><div class="as-label">Line spacing</div>'
      + '<div class="as-row" data-row="line">' + rowHtml(LINES, 'line', current.line) + '</div></div>'
      // Music: only on the classroom game pages, which own #musicBtn and a
      // global toggleMusic(). The panel drives THAT control rather than a
      // second audio system, so the two can never disagree. The page's own
      // floating music button is hidden on mount - one control, in the wheel.
      + (document.getElementById('musicBtn')
          ? '<div class="as-section"><div class="as-label">Music</div>'
            + '<div class="as-row"><button type="button" class="as-music">' + musicLabel() + '</button>'
            + (document.getElementById('volumeSlider') || window.nextTrack
                ? '<button type="button" class="as-music-next" title="Next track">Next</button>' : '')
            + '</div>'
            + (document.getElementById('volumeSlider')
                ? '<input type="range" class="as-music-vol" min="0" max="100" '
                  + 'aria-label="Music volume" style="width:100%;margin-top:10px">' : '')
            + '</div>'
          : '')
      + '<div class="as-section"><div class="as-label">Preview</div>'
      + '<div class="as-preview">The quick brown fox jumps over the lazy dog.</div></div>'
      + '<div class="as-section"><div class="as-row">'
      + '<button type="button" class="as-reset">Reset to defaults</button></div></div>'
      + '<div class="as-note">Saved on this device and used across the whole app.</div>';
  }

  function open()  {
    el.overlay.classList.add('open');
    el.panel.classList.add('open');
    if (el.close) el.close.focus();
  }
  function close() {
    el.overlay.classList.remove('open');
    el.panel.classList.remove('open');
    if (el.launch) el.launch.focus();
  }

  function markRow(row, key, val) {
    Array.prototype.forEach.call(row.children, function (b) {
      var on = b.getAttribute('data-' + key) === String(val);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function syncRows() {
    Array.prototype.forEach.call(el.rows, function (row) {
      var key = row.getAttribute('data-row');
      markRow(row, key, current[key]);
    });
  }

  function wire() {
    if (el.launch) el.launch.addEventListener('click', open);
    el.close.addEventListener('click', close);
    el.overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.panel.classList.contains('open')) close();
    });
    wireRows();
    wireSwitches();
    wireMusic();
  }

  // Drive the page's own toggle function, then re-read the key it wrote so the
  // buttons can never disagree with the page. Clicking the already-active side
  // is a no-op rather than a second toggle.
  function markSwitch(row, s) {
    var on = switchOn(s);
    row.classList.toggle('on', on);
    row.setAttribute('aria-checked', on ? 'true' : 'false');
    var ic = row.querySelector('.as-switch-ic');
    if (ic) ic.textContent = on ? s.icon : s.iconOff;
  }
  function wireSwitches() {
    if (!el.panel) return;
    Array.prototype.forEach.call(el.panel.querySelectorAll('.as-switch[data-switch]'), function (row) {
      var s = switchDef(row.getAttribute('data-switch'));
      if (!s) return;
      function flip() {
        if (switchAvailable(s)) window[s.fn]();
        markSwitch(row, s);
      }
      row.addEventListener('click', flip);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
      });
    });
  }

  // Music lives in the wheel on game pages: our button calls the page's own
  // toggleMusic(), then re-reads its label so the two stay identical. The
  // page's floating music button is hidden so there is only one control.
  function wireMusic() {
    var host = el.panel && el.panel.querySelector('.as-music');
    var pageBtn = document.getElementById('musicBtn');
    if (!host || !pageBtn) return;
    // Hide the WHOLE floating cluster, not just the play button: it also holds
    // a next-track button and a volume slider, and hiding one of three left the
    // pill on screen looking broken.
    var cluster = pageBtn.closest('.music-control') || pageBtn;
    cluster.style.display = 'none';
    host.addEventListener('click', function () {
      if (typeof window.toggleMusic === 'function') window.toggleMusic();
      host.textContent = musicLabel();
    });
    // Bring the other two controls across so nothing is lost.
    var next = el.panel.querySelector('.as-music-next');
    if (next) next.addEventListener('click', function () {
      if (typeof window.nextTrack === 'function') window.nextTrack();
    });
    var vol = el.panel.querySelector('.as-music-vol');
    var pageVol = document.getElementById('volumeSlider');
    if (vol && pageVol) {
      vol.value = pageVol.value;
      vol.addEventListener('input', function () {
        pageVol.value = vol.value;
        if (typeof window.setVolume === 'function') window.setVolume(vol.value);
      });
    }
  }

  function wireRows() {
    Array.prototype.forEach.call(el.rows, function (row) {
      var key = row.getAttribute('data-row');
      row.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var v = btn.getAttribute('data-' + key);
        if (!v) return;
        current[key] = v;
        apply(current);
        write(current);
        markRow(row, key, v);
      });
    });

    el.reset.addEventListener('click', function () {
      current = { scale: DEFAULTS.scale, line: DEFAULTS.line, theme: DEFAULTS.theme, font: DEFAULTS.font };
      apply(current);
      try { localStorage.removeItem(KEY); } catch (_) {}
      try { localStorage.setItem('theme', 'dark'); } catch (_) {}
      syncRows();
    });
  }

  // There used to be a SECOND mount path here: the student dashboard owned a
  // #settingsModal, so instead of this panel it got these controls injected into
  // its own modal as extra rows. One control, two presentations - a centred
  // "Settings" box with hand-written Sound / Turkish / Dark Mode rows on the
  // dashboard, and this panel everywhere else. They drifted, which is exactly
  // what "make them the same" was about. That path is gone: the dashboard's
  // modal was deleted, its two switches became ordinary sections (see SWITCHES),
  // and every page now opens this one panel through a [data-app-settings-open]
  // gear. Do not add a second surface back.

  // Put the wheel INSIDE the page's own header as its first item, rather than
  // adding a second bar above it. The previous attempt injected a bar on top
  // of the classroom header and produced two stacked headers - worse, not
  // better. A page keeps its own header; the wheel simply joins it, on the
  // left, exactly as it already sits on the dashboard.
  var HEADER_SELECTORS = ['header.header', '.pc-header', '.cor-header', 'header'];
  // Four classroom games (heist, trust, listening, reading - student AND
  // teacher) have no <header> at all; their page chrome is a `.<game>-top` bar
  // inside the game shell. Those pages were the only ones left with no
  // Lingualab mark and a gear floating over the artwork.
  //
  // These bars repeat: a page uses `.heist-top` for its chrome AND again inside
  // a later view. Only the FIRST in document order is the page header, so this
  // list is resolved by document order and never by visibility - at mount the
  // chrome bar can be the hidden one if a game view is showing.
  var GAME_BAR_SELECTORS = ['.heist-top', '.trust-top', '.listening-top', '.reading-top'];
  // '.dashboard-header' is deliberately NOT in that list: the student dashboard
  // carries six of them (one per skill screen, five of them hidden) and those
  // screens are off limits. There the floating top-left launcher stays, which
  // is the position every in-header wheel lines up with anyway.
  function pageHeader() {
    for (var i = 0; i < HEADER_SELECTORS.length; i++) {
      var found = document.querySelectorAll(HEADER_SELECTORS[i]);
      if (!found.length) continue;
      for (var j = 0; j < found.length; j++) {
        if (found[j].offsetParent !== null) return found[j];
      }
      // Courses keeps its whole app hidden until Firestore answers, so its
      // header measures as invisible at mount. With a single candidate there
      // is nothing to get wrong, so use it rather than falling back to the
      // floating gear and looking different once the page appears.
      if (found.length === 1) return found[0];
    }
    for (var k = 0; k < GAME_BAR_SELECTORS.length; k++) {
      var bar = document.querySelector(GAME_BAR_SELECTORS[k]);
      if (bar) return bar;
    }
    return null;
  }
  // ── The Lingualab lockup, on every page that lacked one ────
  // The skill screens open with a graduation-cap mark, the word "Lingualab",
  // and the page name on a line beneath it. Placement, the course pages and the
  // 18 classroom game pages opened with only their own title, so they read as
  // separate products. They get the same lockup here rather than in 20 files.
  //
  // The page's OWN title element is MOVED (not copied, not rebuilt) into the
  // lockup as its subtitle, so ids like #pcCourseTitle and anything the page
  // updates at runtime keep working.
  function capSvg() {
    return '<svg class="ll-brand-cap" viewBox="0 0 28 28" fill="none" aria-hidden="true">'
      + '<defs><linearGradient id="llBrandCap" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">'
      + '<stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#fb923c"/></linearGradient></defs>'
      + '<polygon points="14,3 27,10 14,17 1,10" fill="url(#llBrandCap)"/>'
      + '<path d="M7 12.5v6a7 7 0 0 0 14 0v-6" fill="url(#llBrandCap)" opacity="0.75"/>'
      + '<line x1="27" y1="10" x2="27" y2="19" stroke="url(#llBrandCap)" stroke-width="2.2" stroke-linecap="round"/>'
      + '<circle cx="27" cy="21.5" r="2.5" fill="#f59e0b"/></svg>';
  }
  var TITLE_SELECTORS = [
    '.header-title', '.pc-header-title', '.ll-header-title', '.cor-header-title',
    '.heist-brand', '.trust-brand', '.listening-brand', '.reading-brand'
  ];
  // `after` is the last control already placed on the left (the wheel, or the
  // last nav button), so a bar with no title of its own still gets the lockup
  // in the right place instead of at the far end with the actions.
  function addBrand(h, after) {
    if (h.querySelector('.ll-brand')) return;
    var title = null;
    for (var i = 0; i < TITLE_SELECTORS.length && !title; i++) title = h.querySelector(TITLE_SELECTORS[i]);
    var brand = document.createElement('div');
    brand.className = 'll-brand';
    brand.innerHTML = '<span class="ll-brand-name">' + capSvg() + 'Lingualab</span>';
    if (title && h.contains(title)) {
      title.parentNode.insertBefore(brand, title);
      title.classList.add('ll-brand-sub');
      brand.appendChild(title);
    } else if (after && after.parentNode === h) {
      h.insertBefore(brand, after.nextSibling);
    } else {
      h.insertBefore(brand, h.firstChild);
    }
  }

  function placeInHeader() {
    if (!el.launch) return false;
    var h = pageHeader();
    if (!h) return false;
    el.launch.classList.add('as-inheader');
    // The header keeps its own layout except for one thing: several of these
    // bars are space-between, which would centre the page title once a third
    // child appears. as-hosthdr pins the title beside the wheel instead.
    h.classList.add('as-hosthdr');
    h.insertBefore(el.launch, h.firstChild);
    // Nav controls (Dashboard / Exit / Back / Logout) join the wheel on the
    // LEFT, in every header. Courses already kept its Dashboard link on the
    // left while classroom kept its in the right-hand cluster, so the same
    // control sat on opposite sides depending on the page. They now always
    // follow the wheel, in the order the page declared them.
    var after = el.launch;
    Array.prototype.forEach.call(h.querySelectorAll('.ll-navbtn'), function (b) {
      after.parentNode.insertBefore(b, after.nextSibling);
      after = b;
    });
    addBrand(h, after);
    return true;
  }

  function mount() {
    // Opt-out for pages that already have their own display controls.
    if (document.body && document.body.getAttribute('data-app-settings') === 'off') return;
    if (document.getElementById('appSettingsLaunch') || document.querySelector('.as-panel')) return;
    applyTheme(current.theme);          // <body> exists now

    // A page can offer its OWN entry point (a header button, a sidebar row) by
    // marking it data-app-settings-open. The student and teacher dashboards do.
    // Decided BEFORE anything is built, so a page that has its own gear never
    // gets a floating one created, appended, styled or placed - there is
    // nothing to suppress afterwards.
    var openers = document.querySelectorAll('[data-app-settings-open]');
    build(openers.length === 0);
    wire();
    if (!openers.length) placeInHeader();
    styleAllGears();

    Array.prototype.forEach.call(openers, function (o) {
      // Give every opener the SAME inline gear the floating launcher uses.
      // Pages were hand-writing a "gear" emoji, which renders differently on
      // each OS (pale and flat on Windows) so the wheel looked wrong on those
      // pages while matching everywhere else. Owning the icon here means a
      // page only supplies the attribute, never the artwork.
      var slot = o.querySelector('.ico') || o;
      if (/⚙/.test(slot.textContent || '')) slot.innerHTML = gearSvg();
      o.classList.add('as-opener');
      o.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.AppSettings = {
    get: function () { return { scale: current.scale, line: current.line }; },
    set: function (prefs) {
      current = { scale: (prefs && prefs.scale) || current.scale, line: (prefs && prefs.line) || current.line };
      apply(current); write(current);
      if (el.rows) syncRows();
    },
    open: open, close: close
  };
})();
