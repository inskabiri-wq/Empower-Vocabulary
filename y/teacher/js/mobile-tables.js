/* ============================================================
   TEACHER DASHBOARD - TABLES BECOME CARDS  (step 2 of the mobile plan)
   ------------------------------------------------------------
   The dashboard's tables are its real obstacle on a phone. The students table
   alone has eleven columns, and today's mobile treatment is `overflow-x: auto`
   - sideways scrolling, which makes reading one student a two-handed operation
   and comparing anything impossible.

   Below 768px every row becomes a card: the first cell is the card's heading,
   and each remaining cell shows its column name beside its value.

   WHY IT STAMPS LABELS INSTEAD OF THE RENDERERS DOING IT
   Eight modules build tables, several with inline styles and their own markup.
   Editing all of them would mean eight places to keep in step, and any new
   table would arrive un-converted. Reading the <th> row and stamping
   `data-label` onto each <td> catches every table, including ones written
   later, without touching a single renderer.

   These tables are rebuilt constantly - a filter changes, a snapshot lands - so
   a MutationObserver re-stamps rather than relying on one pass at load.

   Not every table should become cards: a two-column key/value table already
   reads fine and cards only make it longer. Only tables wide enough to be a
   problem are converted.
   ============================================================ */
(function () {
  'use strict';
  if (window.TeacherMobileTables) return;

  var BREAKPOINT = 768;
  var STYLE_ID = 'tmt-style';
  var MIN_COLS = 4;            // below this a table is readable as it is

  // A cell reading empty, a hyphen, an em dash or an en dash is a placeholder
  // rather than data. The two dashes come from char codes because the house
  // rule bans those characters in source, while this has to compare against
  // table DATA that may legitimately contain them.
  var PLACEHOLDERS = ['-', String.fromCharCode(8212), String.fromCharCode(8211)];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '@media (max-width:' + BREAKPOINT + 'px){',
      // The header row carries the labels, which are now on each cell.
      '  table.tmt-cards thead{position:absolute;width:1px;height:1px;overflow:hidden;',
      '    clip:rect(0 0 0 0);white-space:nowrap;}',
      '  table.tmt-cards,table.tmt-cards tbody,table.tmt-cards tr,table.tmt-cards td{',
      '    display:block;width:auto;}',
      // Kill the sideways scroll and any min-width a renderer set inline.
      '  table.tmt-cards{overflow-x:visible !important;min-width:0 !important;',
      '    border-collapse:separate;border-spacing:0;}',
      '  .tmt-scroll-reset{overflow-x:visible !important;}',

      '  table.tmt-cards tr{background:var(--t2-surface,#fff);',
      '    border:1px solid var(--t2-border,rgba(15,23,42,.12));border-radius:12px;',
      '    padding:12px 14px;margin:0 0 10px;box-shadow:0 1px 3px rgba(15,23,42,.05);}',
      '  table.tmt-cards td{border:none !important;padding:5px 0 !important;',
      '    display:flex;align-items:baseline;justify-content:space-between;gap:14px;',
      '    text-align:right;font-size:0.9rem;min-height:0;}',
      '  table.tmt-cards td::before{content:attr(data-label);flex:0 0 auto;',
      '    text-align:left;font-weight:600;font-size:0.78rem;',
      '    color:var(--t2-text-muted,#64748b);}',
      // The heading cell, and cells holding controls, span the card.
      '  table.tmt-cards td.tmt-title{display:block;text-align:left;font-weight:700;',
      '    font-size:1rem;color:var(--t2-text,#0f172a);padding:0 0 8px !important;',
      '    border-bottom:1px solid var(--t2-border,rgba(15,23,42,.08)) !important;',
      '    margin-bottom:6px;}',
      '  table.tmt-cards td.tmt-title::before{content:none;}',
      // A skipped counter column: a small muted badge above the heading, not a row.
      '  table.tmt-cards td.tmt-index{display:block;text-align:left;padding:0 !important;',
      '    font-size:0.72rem;font-weight:700;letter-spacing:.04em;',
      '    color:var(--t2-text-muted,#64748b);}',
      '  table.tmt-cards td.tmt-index::before{content:none;}',
      '  table.tmt-cards td.tmt-index + td.tmt-title{padding-top:2px !important;}',
      '  table.tmt-cards td.tmt-wide{display:block;text-align:left;padding-top:8px !important;}',
      '  table.tmt-cards td.tmt-wide::before{display:block;margin-bottom:5px;}',
      // An action column with a blank header would otherwise reserve an empty
      // label line above its button.
      '  table.tmt-cards td.tmt-wide[data-label=""]::before{display:none;}',
      // Label left, one compact control hard right, on a single row.
      '  table.tmt-cards td.tmt-control{align-items:center;}',
      '  table.tmt-cards td.tmt-control select,',
      '  table.tmt-cards td.tmt-control input{margin:0;min-width:0;max-width:62%;}',
      '  table.tmt-cards td.tmt-control input[type=checkbox],',
      '  table.tmt-cards td.tmt-control input[type=radio]{width:20px;height:20px;max-width:none;}',
      // An empty cell is noise on a card: no "Class" label above nothing.
      '  table.tmt-cards td.tmt-empty{display:none;}',
      '}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function headerLabels(table) {
    var head = table.tHead;
    var row = head ? head.rows[0] : null;
    if (!row) {
      // Some tables put the header row straight into the body.
      var first = table.rows[0];
      if (first && first.querySelector('th')) row = first;
    }
    if (!row) return null;
    var out = [];
    Array.prototype.forEach.call(row.cells, function (c) {
      // colspan means one header covers several columns; repeat it so the
      // indexes still line up with the body cells.
      var span = Math.max(1, c.colSpan || 1);
      var text = (c.textContent || '').replace(/\s+/g, ' ').trim();
      for (var i = 0; i < span; i++) out.push(text);
    });
    return out;
  }

  // Which column is the card's heading. Normally the first, but several tables
  // open with a counter ("#", "No"), and a card headed "1" tells you nothing.
  // In that case the counter becomes a small badge and the next column leads.
  function titleIndex(labels, row) {
    if (!row) return 0;
    for (var i = 0; i < row.cells.length && i < 2; i++) {
      var lbl = (labels[i] || '').toLowerCase();
      var txt = (row.cells[i].textContent || '').replace(/\s+/g, ' ').trim();
      var isCounter = /^(#|no\.?|nr\.?|s\/n|rank)$/.test(lbl) || /^\d{1,3}\.?$/.test(txt);
      if (!isCounter) return i;
    }
    return 0;
  }

  function stamp(table) {
    if (!table || table.getAttribute('data-tmt-skip') === '1') return;
    var labels = headerLabels(table);
    if (!labels || labels.length < MIN_COLS) { table.classList.remove('tmt-cards'); return; }

    var body = table.tBodies[0] || table;
    var ti = titleIndex(labels, body.rows[0]);
    Array.prototype.forEach.call(body.rows, function (tr) {
      if (tr.querySelector('th') && !tr.querySelector('td')) return;   // a header row
      Array.prototype.forEach.call(tr.cells, function (td, i) {
        var label = labels[i] != null ? labels[i] : '';
        td.setAttribute('data-label', label);
        var txt = (td.textContent || '').replace(/\s+/g, ' ').trim();
        var ctrls = td.querySelectorAll('button, a, select, input, textarea');
        var hasControls = ctrls.length > 0;

        // A SINGLE COMPACT CONTROL DOES NOT NEED A LINE OF ITS OWN.
        //
        // Giving every control cell the full width is what turned the Access
        // panel into a ragged column on a phone: "Preset" above a select,
        // "Writing AI" above a checkbox, six stacked label/control pairs per
        // card. A checkbox or a short select sits perfectly well at the right
        // of its own label, which is how every other row in the card reads.
        // Buttons and multi-control cells still get the full width, since a
        // centred action button squeezed against a label looks wrong.
        var lone = ctrls.length === 1 ? ctrls[0] : null;
        var tag = lone ? lone.tagName : '';
        var loneIsCompact = !!lone && (
          tag === 'SELECT' ||
          (tag === 'INPUT' && /^(checkbox|radio|text|number|url|email|search|date)$/i.test(lone.type || 'text'))
        );
        var needsOwnLine = hasControls && !loneIsCompact;

        // The heading cell - usually the student, the assignment or the word.
        td.classList.toggle('tmt-title', i === ti);
        // A skipped counter rides along with the heading as a small badge.
        td.classList.toggle('tmt-index', ti !== 0 && i < ti);
        // No label of its own, or a control that genuinely needs the room.
        var isDetail = i > ti;
        td.classList.toggle('tmt-wide', isDetail && (!label || needsOwnLine));
        // Labelled cell with one compact control: label left, control right.
        td.classList.toggle('tmt-control', isDetail && !!label && !needsOwnLine && hasControls);
        var isPlaceholder = !txt || PLACEHOLDERS.indexOf(txt) !== -1;
        td.classList.toggle('tmt-empty', isDetail && !hasControls && isPlaceholder);
      });
    });

    table.classList.add('tmt-cards');
    // A wrapper scrolling sideways would defeat the whole thing.
    var p = table.parentElement;
    if (p && /auto|scroll/.test(p.style.overflowX || '')) p.classList.add('tmt-scroll-reset');
  }

  function stampAll(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    Array.prototype.forEach.call(scope.querySelectorAll('table'), stamp);
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    // Coalesce: one re-render can replace dozens of rows, and stamping per
    // mutation would walk the same table many times over.
    setTimeout(function () { queued = false; stampAll(document); }, 60);
  }

  function boot() {
    if (!document.getElementById('t2sidebar')) return;   // teacher dashboard only
    injectStyle();
    stampAll(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  window.TeacherMobileTables = { refresh: function () { stampAll(document); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
