/* ============================================================
   contrast-audit.js - paste into the console on any app screen

     __audit()            -> array of failures, worst first
     __audit('.selector') -> only inside that subtree

   Reports text whose contrast against its own background is below the
   WCAG AA threshold (4.5:1, or 3:1 for large text). Written during the
   white-and-blue repaint, where the failure mode was invisible text.

   THREE MISTAKES THIS HAS ALREADY MADE, all fixed here, all worth knowing
   because they produce SILENT wrong answers rather than errors:

   1. It used to start the background walk at the element's PARENT. Text sits
      on its own background first, so every filled button reported as
      white-on-white. Now it starts at the element.

   2. It only parsed `rgba()` stops inside background-image. A card painted
      `linear-gradient(#ffffff, #f7faff)` therefore looked transparent, the walk
      carried on past it to a dark ancestor, and white-on-white text was scored
      as white-on-dark - a PASS. Hex stops are parsed now.

   3. It read only the FIRST background layer. CSS paints layers first-on-top,
      so an opaque base sitting under a translucent overlay was never seen and
      dark game backgrounds scored as white. Layers composite bottom-up now.

   Emoji-only and gradient-clipped text are skipped: their computed `color`
   does not describe what is painted.
   ============================================================ */
(function () {
  'use strict';

  function parse(c) {
    var s = String(c);
    var m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    return null;
  }

  // Split a multi-layer background-image on TOP-LEVEL commas only (commas inside
  // gradient() parentheses do not separate layers).
  function layers(bgImage) {
    var out = [], depth = 0, start = 0;
    for (var i = 0; i < bgImage.length; i++) {
      var ch = bgImage[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) { out.push(bgImage.slice(start, i)); start = i + 1; }
    }
    out.push(bgImage.slice(start));
    return out;
  }

  // The colour an element's background-image contributes.
  //
  // MISTAKE 3: this used to take the first colour of the whole string. CSS
  // paints background layers FIRST-ON-TOP, so the opaque base of
  // `radial-gradient(rgba(37,99,235,.1), transparent), linear-gradient(#07101e...)`
  // is the LAST layer. Reading the first layer returned a 10%-alpha blue, the
  // walk treated the element as see-through, carried on to the root and
  // defaulted to white - so the classroom games' dark backgrounds were scored
  // as white and their light text reported as unreadable. Composite bottom-up.
  function imageColor(bgImage) {
    if (!bgImage || bgImage === 'none') return null;
    var ls = layers(bgImage), acc = null;
    for (var i = ls.length - 1; i >= 0; i--) {
      var m = ls[i].match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,6}\b/);
      if (!m) continue;
      var c = parse(m[0]);
      if (!c || c.a <= 0) continue;
      acc = acc ? over(c, acc) : c;
      if (acc.a >= 0.999) return acc;
    }
    return acc;
  }

  // Proper source-over. This used to hardcode `a: 1`, which is only correct when
  // the lower layer is already opaque. Compositing two TRANSLUCENT layers - two
  // faint radial overlays on a game background - therefore produced a fully
  // saturated colour, and the harness's own paragraph was reported as sitting on
  // solid blue. Alpha has to accumulate.
  function over(fg, bg) {
    var a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a: a
    };
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  function bgOf(el) {
    var acc = null, n = el;
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n);
      var c = parse(cs.backgroundColor);
      var g = imageColor(cs.backgroundImage);
      // The image paints OVER the background-color; it does not replace it.
      // `background: <gradients>, #f6f8fb` puts the solid in background-color
      // and the gradients in background-image, so replacing threw the base away.
      if (g && g.a > 0) c = (c && c.a > 0) ? over(g, c) : g;
      if (c && c.a > 0) acc = acc ? over(acc, c) : c;
      if (acc && acc.a >= 0.999) return acc;
      n = n.parentElement;
    }
    return acc && acc.a >= 0.999 ? acc : { r: 255, g: 255, b: 255, a: 1 };
  }

  var EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍\s←-⇿✀-➿·•×■]+$/u;

  window.__audit = function (scope) {
    var root = scope ? document.querySelector(scope) : document;
    if (!root) return 'scope not found: ' + scope;
    var out = [];
    root.querySelectorAll('*').forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent') return;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      var txt = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; })
        .map(function (n) { return n.textContent.trim(); }).join(' ').trim();
      if (txt.length < 2 || EMOJI.test(txt)) return;
      var fg = parse(cs.color);
      if (!fg || fg.a === 0) return;
      var bg = bgOf(el);
      var cr = ratio(over(fg, bg), bg);
      var px = parseFloat(cs.fontSize);
      var need = (px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700)) ? 3 : 4.5;
      if (cr >= need) return;
      out.push({
        ratio: +cr.toFixed(2), need: need, px: Math.round(px),
        text: txt.slice(0, 34),
        sel: (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '<' + el.tagName.toLowerCase() + '>'),
        color: cs.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')'
      });
    });
    var seen = {};
    return out.filter(function (o) {
      var k = o.sel + o.color;
      if (seen[k]) return false;
      seen[k] = 1; return true;
    }).sort(function (a, b) { return a.ratio - b.ratio; });
  };

  console.log('contrast-audit ready. Run __audit() or __audit(".learning-map-modal")');
})();
