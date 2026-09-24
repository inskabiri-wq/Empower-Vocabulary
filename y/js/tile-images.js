/* ============================================================
   Optional per-tile artwork on the student hub
   ------------------------------------------------------------
   Drop y/img/skill-tiles/skill-tile-<skillId>.webp (or .jpg / .png / .svg)
   and that tile picks it up. Delete the file and the tile goes back to the
   design it has today. No code change either way - see y/img/README.md.

   WHY A PROBE RATHER THAN PLAIN CSS
   `background-image: url(...)` in the stylesheet would mean every tile without
   an image requests a file that 404s on every single page load, and any typo
   in a filename fails silently with no way to tell it apart from "no image
   wanted". Loading each candidate first and only applying one that actually
   decoded means a missing file can never leave a broken or half-painted tile.

   The answer is cached in sessionStorage, so the probe runs once per tab
   instead of on every hub render - and renders are frequent, since the grid
   rebuilds whenever progress or the org feature toggles change.
   ============================================================ */
(function () {
  'use strict';

  var DIR = '/img/skill-tiles/';
  var EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];
  var CACHE_KEY = 'll-tile-img-v1';

  var cache = {};
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cache = parsed;
    }
  } catch (_) {}

  function saveCache() {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  // Resolves to a usable url, or '' when this skill simply has no artwork.
  function findImage(id) {
    if (Object.prototype.hasOwnProperty.call(cache, id)) {
      return Promise.resolve(cache[id]);
    }
    var i = 0;
    function tryNext() {
      if (i >= EXTS.length) { cache[id] = ''; saveCache(); return Promise.resolve(''); }
      var url = DIR + 'skill-tile-' + id + '.' + EXTS[i++];
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(url); };
        img.onerror = function () { resolve(null); };
        img.src = url;
      }).then(function (ok) {
        if (ok) { cache[id] = ok; saveCache(); return ok; }
        return tryNext();
      });
    }
    return tryNext();
  }

  function apply(card) {
    var id = card.dataset && card.dataset.skill;
    if (!id) return;
    if (card.dataset.tileImgDone === '1') return;   // already handled this node
    card.dataset.tileImgDone = '1';
    findImage(id).then(function (url) {
      if (!url) return;
      card.style.setProperty('--tile-img', 'url("' + url + '")');
      card.classList.add('has-tile-img');
    });
  }

  function sweep() {
    var cards = document.querySelectorAll('.hub-card[data-skill]:not(.as-skeleton)');
    for (var i = 0; i < cards.length; i++) apply(cards[i]);
  }

  function start() {
    sweep();
    // hub.js rebuilds the grid on its own schedule (toggles arriving, progress
    // changing, returning to the hub), and every rebuild makes fresh nodes that
    // have never been through apply(). Watching the grid is what keeps the
    // artwork attached across those rebuilds.
    var grid = document.getElementById('hubGrid');
    if (grid) new MutationObserver(sweep).observe(grid, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // So the harness (and a future settings toggle) can re-run the probe.
  window.refreshTileImages = function () {
    cache = {};
    saveCache();
    var cards = document.querySelectorAll('.hub-card[data-skill]');
    for (var i = 0; i < cards.length; i++) cards[i].dataset.tileImgDone = '';
    sweep();
  };
})();
