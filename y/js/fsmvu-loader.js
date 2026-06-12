/* ============================================================
   FSMVÜ Loader — tiny helper for a full-screen page loader.
   Self-injects css/fsmvu-loader.css, so a page only needs:
       <script src="js/fsmvu-loader.js"></script>
   then:
       FSMVULoader.show();                         // progress ring + "Loading"
       FSMVULoader.show({ variant:'splash', label:'Welcome' });
       FSMVULoader.hide();
   variant ∈ progress | breathe | shimmer | rotate | draw | splash
   ============================================================ */
(function () {
  if (window.FSMVULoader) return;

  function ensureCSS() {
    if (document.querySelector('link[data-fsmvu-loader]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/css/fsmvu-loader.css';
    l.setAttribute('data-fsmvu-loader', '');
    document.head.appendChild(l);
  }

  // Markup for an inline loader of the given variant. Use this to drop a
  // seal loader into any container (returns an HTML string).
  function markup(variant) {
    switch (variant) {
      case 'progress':
        return '<div class="fsmvu-loader fsmvu-loader--progress">' +
                 '<div class="fsmvu-ring-wrap">' +
                   '<span class="fsmvu-track"></span>' +
                   '<span class="fsmvu-arc"></span>' +
                   '<span class="fsmvu-seal"></span>' +
                 '</div></div>';
      case 'shimmer':
        return '<div class="fsmvu-loader fsmvu-loader--shimmer"><span class="fsmvu-gloss"></span></div>';
      case 'rotate':
        return '<div class="fsmvu-loader fsmvu-loader--rotate">' +
                 '<span class="fsmvu-seal fsmvu-ring"></span>' +
                 '<span class="fsmvu-seal fsmvu-emblem"></span>' +
               '</div>';
      case 'splash':
      case 'draw':
        return '<div class="fsmvu-loader fsmvu-loader--' + variant + '"></div>';
      default: // breathe / undefined → the bare (default) loader
        return '<div class="fsmvu-loader"></div>';
    }
  }

  var overlayEl = null;

  var API = {
    markup: markup,
    /* Show a full-screen overlay loader. opts = { variant, label } */
    show: function (opts) {
      opts = opts || {};
      ensureCSS();
      API.hide();
      var ov = document.createElement('div');
      ov.className = 'fsmvu-overlay';
      ov.setAttribute('role', 'status');
      ov.setAttribute('aria-live', 'polite');
      var label = (opts.label != null) ? opts.label : 'Loading';
      var safe = String(label).replace(/[<>&]/g, '');
      ov.innerHTML = markup(opts.variant || 'progress') +
                     (safe ? '<div class="fsmvu-cap">' + safe + '</div>' : '');
      (document.body || document.documentElement).appendChild(ov);
      overlayEl = ov;
      return ov;
    },
    hide: function () {
      overlayEl = null;
      var nodes = document.querySelectorAll('.fsmvu-overlay');
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    }
  };

  window.FSMVULoader = API;
})();
