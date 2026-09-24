/* ============================================================
   FSMVÜ Loader - tiny helper for a full-screen page loader.
   Self-injects css/fsmvu-loader.css, so a page only needs:
       <script src="js/fsmvu-loader.js"></script>
   then:
       FSMVULoader.show();                         // progress ring + "Loading"
       FSMVULoader.show({ variant:'splash', label:'Welcome' });
       FSMVULoader.hide();
   variant ∈ progress | breathe | shimmer | rotate | draw | splash
             | dial   (tick dial - 12 ticks sweeping round a still mark)
             | orbit  (the wordmark circling the mark; opts.word to change it)
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

  // Unique per call. The circling-word variant needs an id on its <path> for
  // <textPath> to point at, and two loaders on one page sharing one id makes
  // the second one reference the first one's geometry.
  var uid = 0;

  // Markup for an inline loader of the given variant. Use this to drop a
  // seal loader into any container (returns an HTML string).
  function markup(variant, opts) {
    opts = opts || {};
    switch (variant) {
      case 'dial': {
        // 12 ticks, each carrying its index so one CSS rule places and
        // staggers all of them. See css/fsmvu-loader.css "TICK DIAL".
        var ticks = '';
        for (var i = 0; i < 12; i++) ticks += '<i style="--i:' + i + '"></i>';
        return '<div class="fsmvu-loader fsmvu-loader--dial">' +
                 '<span class="fsmvu-ticks">' + ticks + '</span>' +
                 '<span class="fsmvu-seal fsmvu-emblem"></span>' +
               '</div>';
      }
      case 'orbit': {
        var id = 'fsmvuOrbit' + (++uid);
        var word = String(opts.word || 'Lingualab').replace(/[<>&]/g, '');
        // Repeated so the ring reads as continuous rather than one word with a
        // long gap behind it.
        //
        // textLength pins the run to the FULL circumference (2·pi·62 = 390 in
        // viewBox units, matching the r=62 arc below). Without it the text ends
        // wherever its natural width lands - measured at 301 of 390 for three
        // repeats - and the ring turns with a bald patch in it. Pinning also
        // makes the result font-independent: whatever --ll-font resolves to, the
        // word ring still closes.
        var run = (word + ' · ').repeat(4);
        return '<div class="fsmvu-loader fsmvu-loader--orbit">' +
                 '<svg class="fsmvu-orbit" viewBox="0 0 152 152" aria-hidden="true">' +
                   '<defs><path id="' + id + '" fill="none" ' +
                     'd="M76,14 a62,62 0 1,1 -0.01,0"/></defs>' +
                   '<text><textPath href="#' + id + '" xlink:href="#' + id + '" ' +
                     'textLength="390" lengthAdjust="spacing">' +
                     run + '</textPath></text>' +
                 '</svg>' +
                 '<span class="fsmvu-seal fsmvu-emblem"></span>' +
               '</div>';
      }
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
      ov.innerHTML = markup(opts.variant || 'progress', opts) +
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
