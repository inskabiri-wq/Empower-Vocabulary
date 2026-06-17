/* ============================================================
   CLASSROOM TIMER  -  teacher widget
   ------------------------------------------------------------
   A self-contained countdown + stopwatch a teacher can run during
   a live class activity and project on the board. No dependencies,
   no assets: the end-of-countdown beep is generated with WebAudio,
   the alert is a CSS screen-flash. Injects its own floating launch
   button + overlay + styles on load.

   Drop-in: just add <script src=".../js/classroom-timer.js"> to any
   teacher-facing page. Exposes window.ClassTimer.open() / .close().
   ============================================================ */
(function () {
  'use strict';
  if (window.ClassTimer) return;

  var STYLE = [
    '.ct-launch{position:fixed;left:18px;bottom:18px;z-index:99980;display:inline-flex;align-items:center;gap:7px;',
    'font-family:system-ui,Segoe UI,sans-serif;font-size:14px;font-weight:800;color:#fff;background:#2563eb;',
    'border:none;border-radius:999px;padding:11px 16px;cursor:grab;touch-action:none;user-select:none;box-shadow:0 6px 20px rgba(37,99,235,.45);}',
    '.ct-launch:hover{background:#1d4ed8;}',
    '.ct-launch.ct-dragging{cursor:grabbing;opacity:.9;}',
    '.ct-overlay{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;',
    'background:rgba(2,6,23,.82);backdrop-filter:blur(3px);font-family:system-ui,Segoe UI,sans-serif;}',
    '.ct-card{background:#0f172a;border:1px solid #1e293b;border-radius:18px;padding:22px 26px 26px;',
    'width:min(440px,92vw);box-shadow:0 24px 70px rgba(0,0,0,.6);text-align:center;}',
    '.ct-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
    '.ct-modes{display:flex;gap:6px;}',
    '.ct-mode{font-family:inherit;font-size:13px;font-weight:700;color:#94a3b8;background:transparent;',
    'border:1px solid #334155;border-radius:999px;padding:6px 14px;cursor:pointer;}',
    '.ct-mode.active{color:#fff;background:#2563eb;border-color:#2563eb;}',
    '.ct-x{background:transparent;border:none;color:#94a3b8;font-size:26px;line-height:1;cursor:pointer;}',
    '.ct-x:hover{color:#fff;}',
    '.ct-time{font-variant-numeric:tabular-nums;font-weight:800;color:#f1f5f9;font-size:84px;line-height:1.05;margin:6px 0 14px;letter-spacing:2px;}',
    '.ct-presets{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;}',
    '.ct-preset{font-family:inherit;font-size:13px;font-weight:700;color:#cbd5e1;background:#1e293b;',
    'border:1px solid #334155;border-radius:10px;padding:8px 12px;cursor:pointer;min-width:46px;}',
    '.ct-preset:hover{background:#293548;}',
    '.ct-controls{display:flex;gap:10px;justify-content:center;}',
    '.ct-btn{font-family:inherit;font-size:15px;font-weight:800;color:#e2e8f0;background:#1e293b;',
    'border:1px solid #334155;border-radius:12px;padding:11px 22px;cursor:pointer;}',
    '.ct-btn:hover{background:#293548;}',
    '.ct-primary{background:#22c55e;border-color:#22c55e;color:#062a14;}',
    '.ct-primary.running{background:#f59e0b;border-color:#f59e0b;color:#3a2503;}',
    /* Project (board) mode: digits fill the screen, chrome hidden */
    '.ct-overlay.ct-project .ct-card{background:transparent;border:none;box-shadow:none;width:96vw;}',
    '.ct-overlay.ct-project .ct-head,.ct-overlay.ct-project .ct-presets{display:none;}',
    '.ct-overlay.ct-project .ct-time{font-size:min(34vw,52vh);margin:0 0 24px;}',
    '.ct-overlay.ct-project .ct-x-exit{display:inline-flex;}',
    '.ct-x-exit{display:none;}',
    /* End-of-countdown flash */
    '@keyframes ctFlash{0%,100%{background:rgba(2,6,23,.82);}25%,75%{background:rgba(239,68,68,.55);}50%{background:rgba(239,68,68,.85);}}',
    '.ct-overlay.ct-flash{animation:ctFlash .5s linear 3;}'
  ].join('');

  var state = { mode: 'countdown', setMs: 5 * 60000, remainingMs: 5 * 60000, elapsedMs: 0, running: false, raf: null, last: 0 };
  var els = {};

  function injectStyle() {
    if (document.getElementById('ctStyle')) return;
    var s = document.createElement('style');
    s.id = 'ctStyle'; s.textContent = STYLE;
    document.head.appendChild(s);
  }
  function fmt(ms) {
    ms = Math.max(0, ms);
    var tot = Math.round(ms / 1000), m = Math.floor(tot / 60), s = tot % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function build() {
    if (els.ov) return;
    injectStyle();
    // The floating launch button can be suppressed (e.g. on the teacher
    // dashboard, where the Widgets tray is the entry point) by setting
    // window.CLASS_TIMER_NO_FAB before this script loads. The overlay is
    // still built, so window.ClassTimer.open() works either way.
    if (!window.CLASS_TIMER_NO_FAB) {
      var btn = document.createElement('button');
      btn.id = 'ctLaunch'; btn.className = 'ct-launch'; btn.type = 'button'; btn.innerHTML = '⏱ Timer'; btn.title = 'Class timer (drag to move)';
      document.body.appendChild(btn);
      makeDraggable(btn);
    }

    var ov = document.createElement('div');
    ov.id = 'ctOverlay'; ov.className = 'ct-overlay'; ov.style.display = 'none';
    ov.innerHTML =
      '<div class="ct-card">' +
        '<div class="ct-head">' +
          '<div class="ct-modes">' +
            '<button type="button" class="ct-mode active" data-mode="countdown">Countdown</button>' +
            '<button type="button" class="ct-mode" data-mode="stopwatch">Stopwatch</button>' +
          '</div>' +
          '<button type="button" class="ct-x" id="ctClose" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ct-time" id="ctTime">05:00</div>' +
        '<div class="ct-presets" id="ctPresets">' +
          [1, 3, 5, 10, 15].map(function (m) { return '<button type="button" class="ct-preset" data-min="' + m + '">' + m + 'm</button>'; }).join('') +
          '<button type="button" class="ct-preset" data-delta="-60">&minus;1</button>' +
          '<button type="button" class="ct-preset" data-delta="60">+1</button>' +
        '</div>' +
        '<div class="ct-controls">' +
          '<button type="button" class="ct-btn ct-primary" id="ctStart">Start</button>' +
          '<button type="button" class="ct-btn" id="ctReset">Reset</button>' +
          '<button type="button" class="ct-btn" id="ctProject">&#9974; Project</button>' +
          '<button type="button" class="ct-btn ct-x-exit" id="ctExitProject">&times; Exit</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    els.ov = ov; els.time = ov.querySelector('#ctTime'); els.presets = ov.querySelector('#ctPresets'); els.start = ov.querySelector('#ctStart');

    ov.querySelector('#ctClose').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelectorAll('.ct-mode').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
    els.presets.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ct-preset') : null;
      if (!b) return;
      if (b.hasAttribute('data-min')) { state.setMs = parseInt(b.getAttribute('data-min'), 10) * 60000; state.remainingMs = state.setMs; stop(); render(); }
      else if (b.hasAttribute('data-delta')) { state.setMs = Math.max(0, state.setMs + parseInt(b.getAttribute('data-delta'), 10) * 1000); state.remainingMs = state.setMs; stop(); render(); }
    });
    els.start.addEventListener('click', toggleRun);
    ov.querySelector('#ctReset').addEventListener('click', resetCurrent);
    ov.querySelector('#ctProject').addEventListener('click', toggleProject);
    ov.querySelector('#ctExitProject').addEventListener('click', toggleProject);
    document.addEventListener('keydown', function (e) {
      if (!els.ov || els.ov.style.display === 'none') return;
      if (e.key === 'Escape') { if (els.ov.classList.contains('ct-project')) toggleProject(); else close(); }
    });
    render();
  }

  function makeDraggable(btn) {
    // Restore a saved position (persisted across sessions).
    try {
      var p = JSON.parse(localStorage.getItem('ct_pos') || 'null');
      if (p && typeof p.left === 'number' && typeof p.top === 'number') {
        btn.style.left = p.left + 'px'; btn.style.top = p.top + 'px';
        btn.style.right = 'auto'; btn.style.bottom = 'auto';
      }
    } catch (_) {}
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    btn.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false;
      var r = btn.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      btn.classList.add('ct-dragging');
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    });
    btn.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      var nx = Math.max(4, Math.min(window.innerWidth - btn.offsetWidth - 4, ox + dx));
      var ny = Math.max(4, Math.min(window.innerHeight - btn.offsetHeight - 4, oy + dy));
      btn.style.left = nx + 'px'; btn.style.top = ny + 'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto';
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false; btn.classList.remove('ct-dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
      if (moved) { try { localStorage.setItem('ct_pos', JSON.stringify({ left: parseInt(btn.style.left, 10), top: parseInt(btn.style.top, 10) })); } catch (_) {} }
    }
    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', endDrag);
    // A real click (no drag) opens the timer; a drag does not.
    btn.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); return; }
      open();
    });
  }

  function setMode(m) {
    stop(); state.mode = m;
    if (m === 'countdown') state.remainingMs = state.setMs; else state.elapsedMs = 0;
    els.ov.querySelectorAll('.ct-mode').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-mode') === m); });
    els.presets.style.display = (m === 'countdown') ? '' : 'none';
    render();
  }
  function toggleRun() { state.running ? stop() : start(); }
  function start() {
    if (state.running) return;
    if (state.mode === 'countdown' && state.remainingMs <= 0) state.remainingMs = state.setMs;
    state.running = true; state.last = performance.now();
    els.start.textContent = 'Pause'; els.start.classList.add('running');
    tick();
  }
  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    if (els.start) { els.start.textContent = 'Start'; els.start.classList.remove('running'); }
  }
  function resetCurrent() {
    stop();
    if (state.mode === 'countdown') state.remainingMs = state.setMs; else state.elapsedMs = 0;
    render();
  }
  function tick() {
    state.raf = requestAnimationFrame(function (now) {
      if (!state.running) return;
      var dt = now - state.last; state.last = now;
      if (state.mode === 'countdown') {
        state.remainingMs -= dt;
        if (state.remainingMs <= 0) { state.remainingMs = 0; render(); fireDone(); stop(); return; }
      } else {
        state.elapsedMs += dt;
      }
      render();
      tick();
    });
  }
  function render() {
    if (!els.time) return;
    els.time.textContent = fmt(state.mode === 'countdown' ? state.remainingMs : state.elapsedMs);
  }
  function fireDone() { beep(3); flash(); }
  function flash() {
    els.ov.classList.remove('ct-flash');
    void els.ov.offsetWidth;
    els.ov.classList.add('ct-flash');
    setTimeout(function () { els.ov.classList.remove('ct-flash'); }, 1700);
  }
  function toggleProject() {
    var on = els.ov.classList.toggle('ct-project');
    try {
      if (on && els.ov.requestFullscreen) els.ov.requestFullscreen();
      else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    } catch (_) { /* fullscreen optional */ }
  }
  function beep(times) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx(), t0 = ctx.currentTime;
      for (var i = 0; i < times; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        o.connect(g); g.connect(ctx.destination);
        var s = t0 + i * 0.38;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.4, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.32);
        o.start(s); o.stop(s + 0.34);
      }
      setTimeout(function () { try { ctx.close(); } catch (_) {} }, times * 400 + 200);
    } catch (_) { /* audio optional */ }
  }
  function open() { build(); els.ov.style.display = 'flex'; render(); }
  function close() {
    stop();
    if (els.ov.classList.contains('ct-project')) toggleProject();
    els.ov.style.display = 'none';
  }

  window.ClassTimer = { open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
