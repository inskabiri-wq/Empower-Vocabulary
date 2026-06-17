/* ============================================================
   WIDGETS TRAY  -  teacher dashboard launcher
   ------------------------------------------------------------
   A small docked "Widgets" launcher (bottom-left) that opens
   floating classroom widgets. First widget is the Class Timer;
   add more to the WIDGETS array below and they appear automatically.
   Self-contained: injects its own styles + launcher + popover.

   Pair with: set window.CLASS_TIMER_NO_FAB = true before loading
   classroom-timer.js so the timer's own floating button is hidden
   here (the tray is the single entry point on the dashboard).
   ============================================================ */
(function () {
  'use strict';
  if (window.WidgetsTray) return;

  // Register widgets here. `open()` runs when the chip is clicked.
  var WIDGETS = [
    {
      id: 'timer', icon: '⏱', name: 'Class Timer', desc: 'Countdown / stopwatch for the board',
      open: function () { if (window.ClassTimer && window.ClassTimer.open) window.ClassTimer.open(); }
    }
    // Future widgets (dice, random name picker, noise meter, ...) go here.
  ];

  var STYLE = [
    '.wt-launch{position:fixed;left:18px;bottom:18px;z-index:99970;display:inline-flex;align-items:center;gap:7px;',
    'font-family:system-ui,Segoe UI,sans-serif;font-size:14px;font-weight:800;color:#fff;background:#0f172a;',
    'border:1px solid #334155;border-radius:999px;padding:10px 15px;cursor:pointer;box-shadow:0 6px 20px rgba(2,6,23,.5);}',
    '.wt-launch:hover{background:#1e293b;}',
    '.wt-pop{position:fixed;z-index:99971;width:240px;background:#0f172a;border:1px solid #1e293b;',
    'border-radius:14px;padding:10px;box-shadow:0 18px 50px rgba(0,0,0,.55);font-family:system-ui,Segoe UI,sans-serif;display:none;}',
    '.wt-pop.open{display:block;}',
    '.wt-pop-title{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#64748b;padding:4px 8px 8px;}',
    '.wt-item{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:transparent;border:none;',
    'border-radius:10px;padding:9px 10px;cursor:pointer;color:#e2e8f0;font-family:inherit;}',
    '.wt-item:hover{background:#1e293b;}',
    '.wt-item-ic{font-size:20px;line-height:1;}',
    '.wt-item-name{font-size:14px;font-weight:700;}',
    '.wt-item-desc{font-size:11px;color:#94a3b8;margin-top:1px;}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('wtStyle')) return;
    var s = document.createElement('style'); s.id = 'wtStyle'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function build() {
    if (document.getElementById('wtPop')) return;
    injectStyle();

    // Prefer an in-page trigger (the dashboard's sidebar "Widgets" item) so the
    // launcher lives above Empower Lab. If none exists (other pages), fall back
    // to a docked bottom-left launcher button.
    var sidebarBtn = document.getElementById('wtSidebarBtn');
    var launch = sidebarBtn;
    if (!launch) {
      launch = document.createElement('button');
      launch.id = 'wtLaunch'; launch.className = 'wt-launch'; launch.type = 'button';
      launch.innerHTML = '🧰 Widgets'; launch.title = 'Classroom widgets';
      document.body.appendChild(launch);
    }

    var pop = document.createElement('div');
    pop.id = 'wtPop'; pop.className = 'wt-pop';
    pop.innerHTML = '<div class="wt-pop-title">Widgets</div>' + WIDGETS.map(function (w) {
      return '<button type="button" class="wt-item" data-wid="' + w.id + '">' +
        '<span class="wt-item-ic">' + w.icon + '</span>' +
        '<span><span class="wt-item-name">' + w.name + '</span>' +
        (w.desc ? '<span class="wt-item-desc" style="display:block;">' + w.desc + '</span>' : '') + '</span>' +
      '</button>';
    }).join('');
    document.body.appendChild(pop);

    // Float the popover next to its trigger. For the sidebar item it appears to
    // the right (clamped on-screen); for the docked fallback it sits above it.
    function place() {
      var r = launch.getBoundingClientRect();
      pop.style.visibility = 'hidden'; pop.classList.add('open');
      var pw = pop.offsetWidth || 240, ph = pop.offsetHeight || 200;
      pop.classList.remove('open'); pop.style.visibility = '';
      var left, top;
      if (sidebarBtn) {
        left = r.right + 10; top = r.top;
        if (left + pw > window.innerWidth - 8) left = Math.max(8, r.left - pw - 10);
      } else {
        left = r.left; top = r.top - ph - 8;
      }
      top = Math.min(Math.max(8, top), window.innerHeight - ph - 8);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }

    function open() { place(); pop.classList.add('open'); }
    function close() { pop.classList.remove('open'); }
    function toggle() { if (pop.classList.contains('open')) close(); else open(); }

    launch.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.wt-item') : null;
      if (!b) return;
      var w = WIDGETS.find(function (x) { return x.id === b.getAttribute('data-wid'); });
      close();
      if (w && typeof w.open === 'function') w.open();
    });
    document.addEventListener('click', function (e) {
      if (!pop.classList.contains('open')) return;
      if (e.target === launch || launch.contains(e.target) || pop.contains(e.target)) return;
      close();
    });
    window.addEventListener('resize', function () { if (pop.classList.contains('open')) place(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  window.WidgetsTray = { build: build };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
