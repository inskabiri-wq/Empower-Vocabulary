/* ============================================================
   PERF HUD - measure the lag on the device that has it
   ------------------------------------------------------------
   Opt-in only: add ?perf=1 to any page URL. Nothing loads or runs otherwise,
   so students never see it and it costs nothing in normal use.

       https://<site>/student-dashboard.html?perf=1

   WHY THIS EXISTS
   The teacher's Galaxy Tab is laggy and I cannot feel it from here. Three
   rounds of reasoning from the code found real problems (backdrop blur, two
   animations repainting every frame, the whole dashboard booting twice) but
   guessing a fourth time is worse than measuring. This turns "still laggy"
   into numbers taken on the actual hardware.

   WHAT THE NUMBERS MEAN
     fps        frames per second, averaged over the last second. 60 is smooth,
                below ~45 feels sluggish, below 30 is obviously janky.
     worst      the longest single gap between frames in the last second, in ms.
                One 300ms gap is felt as a stutter even if the average looks ok.
     long       tasks over 50ms that blocked the main thread in the last second.
                Anything above 0 while you are NOT touching the screen means
                something is running that should not be.
     idle       whether the last second had any long task at all. A page doing
                nothing should read idle.

   The reading that matters most: open the hub, DO NOT TOUCH the screen, and
   watch for ten seconds. A page at rest should sit near the display's refresh
   rate with long=0. If fps is low while idle, something is animating or
   recomputing continuously.
   ============================================================ */
(function () {
  'use strict';

  try {
    if (!/[?&]perf=1\b/.test(location.search)) return;
  } catch (_) { return; }

  var box, frames = 0, worst = 0, lastT = 0, longTasks = 0, secs = 0;
  var fpsHistory = [];

  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function build() {
    box = el('div',
      'position:fixed;right:8px;bottom:8px;z-index:2147483647;' +
      'background:rgba(15,23,42,0.92);color:#e2e8f0;font:12px/1.45 ui-monospace,Consolas,monospace;' +
      'padding:10px 12px;border-radius:10px;min-width:190px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,0.35);pointer-events:auto;');
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px">perf &middot; ?perf=1</div>' +
      '<div id="phFps">fps  --</div>' +
      '<div id="phWorst">worst --</div>' +
      '<div id="phLong">long --</div>' +
      '<div id="phDev" style="margin-top:6px;opacity:.7;font-size:11px"></div>' +
      '<button id="phCopy" style="margin-top:8px;width:100%;min-height:34px;cursor:pointer;' +
      'font:inherit;border-radius:7px;border:1px solid rgba(255,255,255,.25);' +
      'background:transparent;color:inherit">copy report</button>';
    (document.body || document.documentElement).appendChild(box);

    var d = box.querySelector('#phDev');
    var dpr = window.devicePixelRatio || 1;
    d.textContent =
      Math.round(screen.width * dpr) + 'x' + Math.round(screen.height * dpr) +
      '  dpr' + (Math.round(dpr * 100) / 100) +
      '  cores' + (navigator.hardwareConcurrency || '?') +
      (navigator.deviceMemory ? '  ram' + navigator.deviceMemory + 'g' : '');

    box.querySelector('#phCopy').addEventListener('click', function () {
      var r = report();
      try {
        navigator.clipboard.writeText(r);
        box.querySelector('#phCopy').textContent = 'copied';
      } catch (_) {
        // Clipboard is blocked on some Android browsers over http. Show it so
        // it can at least be screenshotted.
        alert(r);
      }
    });
  }

  function report() {
    var sorted = fpsHistory.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return [
      'Lingualab perf report',
      'page      ' + location.pathname + location.search,
      'screen    ' + Math.round(screen.width * (devicePixelRatio || 1)) + 'x' +
                     Math.round(screen.height * (devicePixelRatio || 1)) +
                     ' dpr' + (Math.round((devicePixelRatio || 1) * 100) / 100),
      'cores     ' + (navigator.hardwareConcurrency || '?') +
                     (navigator.deviceMemory ? '  ram ' + navigator.deviceMemory + 'GB' : ''),
      'seconds   ' + secs,
      'fps med   ' + median,
      'fps min   ' + (sorted[0] || 0),
      'fps max   ' + (sorted[sorted.length - 1] || 0),
      'longtasks ' + totalLong + ' total over ' + secs + 's',
      'ua        ' + navigator.userAgent
    ].join('\n');
  }

  var totalLong = 0;

  function tick(t) {
    if (lastT) {
      var gap = t - lastT;
      if (gap > worst) worst = gap;
      frames++;
    }
    lastT = t;
    requestAnimationFrame(tick);
  }

  function everySecond() {
    if (!box) return;
    secs++;
    fpsHistory.push(frames);
    var fpsEl = box.querySelector('#phFps');
    fpsEl.textContent = 'fps  ' + frames;
    fpsEl.style.color = frames >= 50 ? '#4ade80' : (frames >= 35 ? '#fbbf24' : '#f87171');

    var wEl = box.querySelector('#phWorst');
    wEl.textContent = 'worst ' + Math.round(worst) + 'ms';
    wEl.style.color = worst <= 33 ? '#4ade80' : (worst <= 100 ? '#fbbf24' : '#f87171');

    var lEl = box.querySelector('#phLong');
    lEl.textContent = 'long ' + longTasks + (longTasks ? '' : '  (idle)');
    lEl.style.color = longTasks ? '#f87171' : '#4ade80';

    frames = 0; worst = 0; longTasks = 0;
  }

  function start() {
    build();
    requestAnimationFrame(tick);
    setInterval(everySecond, 1000);
    // Long tasks are the direct measure of "the main thread was blocked".
    try {
      var po = new PerformanceObserver(function (list) {
        var n = list.getEntries().length;
        longTasks += n; totalLong += n;
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch (_) { /* not supported: the fps figure still tells the story */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
