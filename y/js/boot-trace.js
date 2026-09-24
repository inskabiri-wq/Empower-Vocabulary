/* ============================================================
   BOOT TRACE - prove what actually redraws, and how many times
   ------------------------------------------------------------
   Opt-in only: add ?boot=1 to the dashboard URL. Nothing loads or runs
   otherwise, so students never see it.

       https://<site>/student-dashboard.html?boot=1

   WHY THIS EXISTS
   "The dashboard refreshes twice" has been diagnosed four times from reading
   code, and four times the fix was partial. Reading code finds causes I can
   imagine; it cannot find the one I cannot. This measures the effect instead.

   A MutationObserver on each container is the ground truth for "it visibly
   redrew": it does not care which function ran, whether the trigger was auth,
   a snapshot, or an event. If #hubGrid is rewritten twice, the student sees the
   tiles change twice, full stop.

   WHAT TO DO WITH IT
   Open the dashboard with ?boot=1, DO NOT touch the screen, wait until it has
   settled (about ten seconds), then press "copy report" and send it over. The
   line that matters is any container with a rewrite count above 1, and the gap
   between its timestamps - that gap is the flash.

   Reads nothing from Firestore and writes nothing anywhere. Pure observation.
   ============================================================ */
(function () {
  'use strict';

  try {
    if (!/[?&]boot=1\b/.test(location.search)) return;
  } catch (_) { return; }

  var T0 = (window.performance && performance.now) ? performance.now() : 0;
  var now = function () {
    return Math.round(((window.performance && performance.now) ? performance.now() : 0) - T0);
  };

  // What we watch, and why each one is in the list.
  var TARGETS = [
    { id: 'hubGrid',              label: 'hub tiles' },
    { id: 'assignmentsContainer', label: 'assignments' }
  ];
  // Class-based targets have no single id. The seal took the place of the
  // welcome avatar, which was removed from the page.
  var CLASS_TARGETS = [
    { sel: '.avatar-display', label: 'profile icon' },
    { sel: '#hubScreen [data-org-mark]', label: 'seal' }
  ];

  var log = [];                    // { t, what, detail }
  var counts = {};                 // label -> number of rewrites
  var stamps = {};                 // label -> [ms, ms, ...]

  function record(label, detail) {
    counts[label] = (counts[label] || 0) + 1;
    (stamps[label] = stamps[label] || []).push(now());
    log.push({ t: now(), what: label, detail: detail || '' });
    paint();
  }

  // ── 1. DOM rewrites: the ground truth ────────────────────────────────────
  function watch(node, label) {
    if (!node || node.__bootWatched) return;
    node.__bootWatched = true;
    try {
      new MutationObserver(function (muts) {
        // Coalesce: one innerHTML assignment fires many records in one tick,
        // and that is ONE redraw, not thirty. Count a burst as a single event.
        var added = 0, text = 0;
        muts.forEach(function (m) {
          if (m.type === 'childList') added += m.addedNodes.length + m.removedNodes.length;
          else text++;
        });
        if (!added && !text) return;
        if (node.__bootTick) return;              // already counted this tick
        node.__bootTick = true;
        setTimeout(function () { node.__bootTick = false; }, 0);
        record(label, added + ' node(s)');
      }).observe(node, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
  }

  // ── 2. The re-render announcement four modules listen to ─────────────────
  try {
    document.addEventListener('feature-toggles-ready', function () {
      record('event: feature-toggles-ready', 'hub + placement + assignments + grammar re-render');
    }, true);
  } catch (_) {}

  // 2b. The boot hold lifting (student-dashboard.html <head>): why, and when
  // each signal arrived, so a phone report shows which piece is the long pole.
  // A hold that lifted before this file parsed (an early script error) has
  // already set data-hub-boot, so it is read from there instead.
  try {
    var hubRevealed = function (why) {
      var H = window.LLHubBoot;
      record('hub revealed', (why || '?') + ' ' + JSON.stringify(H ? H.timings() : {}) +
        (H && /^cap/.test(why || '') ? ' waiting on ' + H.pending().join(',') : ''));
    };
    var early = document.documentElement.getAttribute('data-hub-boot');
    if (early) hubRevealed(early);
    else document.addEventListener('ll-hub-revealed', function (e) {
      hubRevealed(((e && e.detail) || {}).why);
    });
  } catch (_) {}

  // ── 3. Auth callbacks. Firebase fires these more than once per session ───
  function hookAuth(tries) {
    var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
    if (!a || typeof a.onAuthStateChanged !== 'function') {
      if (tries > 0) setTimeout(function () { hookAuth(tries - 1); }, 100);
      return;
    }
    try {
      a.onAuthStateChanged(function (u) {
        record('auth: onAuthStateChanged', u ? 'signed in' : 'signed out');
      });
    } catch (_) {}
  }
  hookAuth(40);

  // ── The panel ────────────────────────────────────────────────────────────
  var box, body;
  function build() {
    box = document.createElement('div');
    box.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:min(92vw,420px);' +
      'max-height:60vh;overflow:auto;background:rgba(15,23,42,0.94);color:#e2e8f0;' +
      'font:12px/1.45 ui-monospace,Consolas,monospace;padding:10px 12px;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,0.35);';
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px">boot trace &middot; ?boot=1</div>' +
      '<div id="btBody"></div>' +
      '<button id="btCopy" style="margin-top:8px;width:100%;min-height:34px;cursor:pointer;' +
      'font:inherit;border-radius:7px;border:1px solid rgba(255,255,255,.25);' +
      'background:transparent;color:inherit">copy report</button>';
    (document.body || document.documentElement).appendChild(box);
    body = box.querySelector('#btBody');
    box.querySelector('#btCopy').addEventListener('click', function () {
      var r = report();
      try {
        navigator.clipboard.writeText(r);
        box.querySelector('#btCopy').textContent = 'copied';
      } catch (_) { alert(r); }
    });
    paint();
  }

  function paint() {
    if (!body) return;
    var html = '';
    Object.keys(counts).forEach(function (k) {
      var n = counts[k];
      var bad = /^(hub tiles|assignments|profile icon|seal)$/.test(k) && n > 1;
      html += '<div style="color:' + (bad ? '#f87171' : '#4ade80') + '">' +
              (bad ? '! ' : '  ') + k + '  x' + n +
              '  <span style="opacity:.65">[' + (stamps[k] || []).join('ms, ') + 'ms]</span></div>';
    });
    if (!html) html = '<div style="opacity:.7">watching...</div>';
    body.innerHTML = html;
  }

  function report() {
    var lines = ['Lingualab boot trace', 'page   ' + location.pathname + location.search, ''];
    lines.push('REDRAWS (anything above x1 is a visible refresh)');
    Object.keys(counts).forEach(function (k) {
      lines.push('  ' + k + '  x' + counts[k] + '  at ' + (stamps[k] || []).join('ms, ') + 'ms');
    });
    lines.push('', 'TIMELINE');
    log.forEach(function (e) {
      lines.push('  ' + String(e.t).padStart(6) + 'ms  ' + e.what + (e.detail ? '  (' + e.detail + ')' : ''));
    });
    lines.push('', 'ua  ' + navigator.userAgent);
    return lines.join('\n');
  }

  function start() {
    build();
    TARGETS.forEach(function (t) { watch(document.getElementById(t.id), t.label); });
    CLASS_TARGETS.forEach(function (t) {
      var n = document.querySelector(t.sel);
      if (n) watch(n, t.label);
    });

    // Containers can be created after this runs, so keep looking for a while
    // rather than silently watching nothing - a missing observer would read as
    // "zero redraws", which is the most misleading answer possible.
    var tries = 60;
    var iv = setInterval(function () {
      TARGETS.forEach(function (t) { watch(document.getElementById(t.id), t.label); });
      CLASS_TARGETS.forEach(function (t) {
        var n = document.querySelector(t.sel);
        if (n) watch(n, t.label);
      });
      if (--tries <= 0) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
