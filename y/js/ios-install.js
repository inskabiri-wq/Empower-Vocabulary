/* ============================================================
   iOS "Add to Home Screen" prompt
   ------------------------------------------------------------
   Android fires `beforeinstallprompt` and the browser offers to install by
   itself. iOS never has. On iPhone the ONLY way to install a PWA is Share ->
   Add to Home Screen, done by hand, and nothing on the page tells a student
   that - so on iPhone the app is just a website unless someone shows them.
   This is that instruction, shown once, at the moment it applies.

   Two iOS-specific traps this has to handle:

   1. Only SAFARI can install. Chrome, Firefox and Edge on iOS are all Safari
      underneath but none of them expose Add to Home Screen, so telling a
      student in Chrome to "tap Share" sends them looking for a button that is
      not there. They get a different message: open it in Safari first.

   2. iPadOS 13+ reports itself as a Mac. `/iPad/` in the user agent misses
      every modern iPad, so the touch-points check below is what actually
      catches them.

   Self-contained on purpose: the styles are injected here rather than living
   in a stylesheet, because index.html (the PWA start_url, and the page this
   most needs to appear on) does not load css/app-settings.css. Everything is
   expressed in tokens, so it follows light / dark / sepia / contrast without
   needing a light-mode counterpart rule.
   ============================================================ */
(function () {
  'use strict';

  var DISMISS_KEY = 'll-ios-install-dismissed';

  function isIOS() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ masquerades as a Mac; a Mac has no touch screen.
    return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  }

  // Every iOS browser is Safari underneath, so the engine cannot tell us apart.
  // The wrappers each add their own token to the user agent, and Safari is the
  // one with none of them.
  function isRealSafari() {
    var ua = navigator.userAgent || '';
    return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  }

  function isInstalled() {
    // navigator.standalone is the iOS-only signal; the media query covers the
    // rest and is harmless here.
    if (navigator.standalone === true) return true;
    try {
      return window.matchMedia('(display-mode: standalone)').matches;
    } catch (_) { return false; }
  }

  function dismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  }
  function remember() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
  }

  var CSS =
    '.ll-ios-sheet{position:fixed;left:0;right:0;bottom:0;z-index:100001;' +
      'padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));' +
      'background:var(--bg-card,#fff);color:var(--text-primary,#0f172a);' +
      'border-top:1px solid var(--border-color,#e3e9f2);' +
      'border-radius:18px 18px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,0.18);' +
      'font-family:var(--ll-font);animation:ll-ios-up .28s ease both;}' +
    '@keyframes ll-ios-up{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
    '.ll-ios-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}' +
    '.ll-ios-mark{width:26px;height:26px;flex-shrink:0;}' +
    '.ll-ios-title{font-size:1rem;font-weight:800;margin:0;}' +
    '.ll-ios-step{display:flex;align-items:flex-start;gap:9px;font-size:0.875rem;' +
      'line-height:1.45;color:var(--text-secondary,#475569);margin:7px 0;}' +
    '.ll-ios-n{flex:0 0 20px;height:20px;border-radius:50%;font-size:0.72rem;font-weight:800;' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'background:var(--accent-primary,#2563eb);color:#fff;margin-top:1px;}' +
    '.ll-ios-share{display:inline-block;vertical-align:-3px;width:15px;height:15px;}' +
    '.ll-ios-actions{display:flex;gap:10px;margin-top:14px;}' +
    '.ll-ios-btn{flex:1;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.9375rem;' +
      'padding:11px;border-radius:11px;border:1px solid var(--border-color,#e3e9f2);' +
      'background:transparent;color:var(--text-secondary,#475569);}';

  // The iOS share glyph, so a student is looking for the right button.
  var SHARE_SVG =
    '<svg class="ll-ios-share" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"/></svg>';

  function sheet(safari) {
    var box = document.createElement('div');
    box.className = 'll-ios-sheet';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Install Lingualab');

    var body = safari
      ? '<div class="ll-ios-step"><span class="ll-ios-n">1</span>' +
          '<span>Tap the Share button ' + SHARE_SVG + ' at the bottom of Safari.</span></div>' +
        '<div class="ll-ios-step"><span class="ll-ios-n">2</span>' +
          '<span>Scroll down and choose <strong>Add to Home Screen</strong>.</span></div>' +
        '<div class="ll-ios-step"><span class="ll-ios-n">3</span>' +
          '<span>Tap <strong>Add</strong>. Lingualab opens like an app from then on.</span></div>'
      : '<div class="ll-ios-step"><span class="ll-ios-n">!</span>' +
          '<span>On iPhone and iPad only <strong>Safari</strong> can install an app. ' +
          'Open this page in Safari, then use Share ' + SHARE_SVG +
          ' and <strong>Add to Home Screen</strong>.</span></div>';

    box.innerHTML =
      '<div class="ll-ios-head">' +
        '<img class="ll-ios-mark" src="/lingualab-mark.svg" alt="">' +
        '<h2 class="ll-ios-title">Install Lingualab</h2>' +
      '</div>' + body +
      '<div class="ll-ios-actions"><button type="button" class="ll-ios-btn">Not now</button></div>';

    box.querySelector('.ll-ios-btn').addEventListener('click', function () {
      remember();
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    return box;
  }

  function show() {
    if (!isIOS() || isInstalled() || dismissed()) return;
    if (document.querySelector('.ll-ios-sheet')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.appendChild(sheet(isRealSafari()));
  }

  // Deliberately not instant. Landing on a login screen and being handed an
  // install instruction before the page has even settled reads as a popup.
  function start() { setTimeout(show, 1200); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // So a "How do I install this?" link can bring it back after a dismissal.
  window.showIOSInstall = function () {
    try { localStorage.removeItem(DISMISS_KEY); } catch (_) {}
    show();
  };
})();
