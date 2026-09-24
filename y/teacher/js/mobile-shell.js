/* ============================================================
   TEACHER DASHBOARD - PHONE SHELL  (step 1 of the mobile plan)
   ------------------------------------------------------------
   The dashboard is a 220px fixed sidebar beside a wide content column. That
   shape cannot work on a phone, which is the whole reason a blocking gate was
   put in front of it.

   This replaces the sidebar with a bottom tab bar below 768px: four
   destinations plus More. It does NOT touch the desktop layout, and it does not
   convert any tab's contents - that is step 2 onward. It is the frame the rest
   drops into.

   IT READS THE SIDEBAR RATHER THAN LISTING TABS ITSELF.
   Every entry is built from the real `.t2-nav-item` elements, so the bar cannot
   drift from the navigation it mirrors: a tab added, renamed or removed there
   shows up here for free. That is the same reason the profile hub is one module
   rather than thirteen copies.

   ROLE-GATED ITEMS ARE HANDLED. Placement and Admin ship as
   `style="display:none"` and are revealed later by placement-admin.js /
   config.js once the account is known. A MutationObserver re-syncs the bar when
   that happens, so a teacher who is not an admin never sees an Admin tab and
   one who is does not have to reload to get it.
   ============================================================ */
(function () {
  'use strict';
  if (window.TeacherMobileShell) return;

  var BREAKPOINT = 768;
  var STYLE_ID   = 'tms-style';
  // The four that earn a permanent slot. Everything else goes behind More.
  var PRIMARY    = ['overview', 'students', 'assignments', 'activity'];

  function mq() {
    try { return window.matchMedia('(max-width: ' + BREAKPOINT + 'px)'); } catch (_) { return null; }
  }
  function isPhone() { var m = mq(); return !!(m && m.matches); }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '@media (max-width:' + BREAKPOINT + 'px){',
      // The sidebar is the thing that does not fit. Hidden, not deleted - the
      // bar mirrors it, and the role-gating JS still writes to it.
      '  .t2-sidebar{display:none !important;}',
      // Only the SHELL stops being a row. `.t2-main` stays a flex column: it is
      // what supplies the 20px gap between the header and the content, and
      // making it a block silently dropped that (the header sat on the cards).
      '  .t2-shell{display:block !important;}',
      // `scrollbar-gutter: stable` reserves a classic scrollbar's width so
      // expanding a row cannot shift the desktop layout sideways. Phones use
      // overlay scrollbars, so there is nothing to reserve and the gutter just
      // makes the right margin wider than the left.
      // THE BOTTOM PADDING GOES ON `.t2-main`, WHICH IS THE ACTUAL SCROLLER.
      //
      // This dashboard is a fixed-viewport shell, not a scrolling page:
      // `body.t2-active` is `overflow: hidden`, `.container` is `height: 100vh`
      // and `.t2-main` carries `overflow-y: auto`. So padding on `body` buys
      // nothing at all - the body never scrolls - and the last 64px of every
      // tab stayed underneath the tab bar with no way to reach it.
      '  .t2-main{padding:16px 14px calc(64px + env(safe-area-inset-bottom,0px)) !important;',
      '    scrollbar-gutter:auto !important;}',
      // body carries a 20px page padding and `.t2-main` its own 14px, so a phone
      // was losing 34px a side - 17% of a 390px screen - to a doubled gutter.
      // One gutter, from `.t2-main`. Only `.container` is affected: every other
      // body-level element here is a fixed-position modal.
      '  body{padding-left:0 !important;padding-right:0 !important;}',
      // Once .t2-active is on, `.container` is a 100vh box, so ANY body padding
      // pushes its bottom edge below the viewport. body carries 20px top and
      // bottom from teacher/css/styles.css, which put the end of the scroller
      // 40px past the screen and left the last 13px of content stuck under the
      // tab bar however far you scrolled. The shell must fill the viewport
      // exactly, and the bar clearance belongs on `.t2-main`, which is what
      // actually scrolls.
      '  body.t2-active{padding:0 !important;}',
      // Only while the page is still an ordinary scrolling document, i.e. the
      // loading phase before config.js adds .t2-active.
      '  body:not(.t2-active){padding-bottom:calc(64px + env(safe-area-inset-bottom,0px)) !important;}',
      // The header must share the column's gutter, not add its own - 14px of
      // extra indent here is what made it look off against the cards below.
      // Stacked, so the period select lines up with the title instead of
      // hanging on a wrapped line of its own.
      '  .t2-page-header{flex-direction:column;align-items:stretch;gap:10px;}',
      '  .t2-page-header h1{font-size:1.05rem;}',
      '  .t2-header-actions{width:100%;}',
      '  .t2-header-actions > *{flex:1 1 auto;min-width:0;}',
      // The section header is title + filters side by side. On a phone the title
      // takes the row and the filters take the next one.
      '  .section-header{flex-direction:column;align-items:stretch;}',
      // Five filters stacked one per row cost about 250px of screen before the
      // first student. Two columns halves that; a search box keeps the full row.
      // minmax(0, 1fr), never a bare 1fr. A grid track's automatic minimum is
      // min-content, so a select whose longest option is wider than half the
      // row (for example "All Activities") grew its track and pushed the
      // second column off the screen.
      '  .filters{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));',
      '    gap:8px;width:100%;}',
      '  .filters > *{width:100%;min-width:0;}',
      '  .filters .search-input{grid-column:1 / -1;}',
      // A select is sized by its longest OPTION, not by the chosen one, so
      // without this the control still reports a min-content width of the
      // widest entry ("Listening Exam practice") and pushes its own column
      // wider than the screen.
      '  .filters select,.filters .filter-select{min-width:0;max-width:100%;',
      '    text-overflow:ellipsis;}',
      // Four filter pills (All / Admins / Teachers / Unassigned) need about
      // 460px, so on a phone they always wrap. Left to flex they went three
      // then one, which reads as a mistake; a 2x2 grid reads as a layout.
      '  .av-toolbar-pills{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;}',
      '  .av-pill{width:100%;min-width:0;text-align:center;justify-content:center;}',
      '  .av-toolbar-spacer{display:none;}',
      // The Admin sub-nav is eight pills (Teachers, Features, Access, Demo
      // accounts and the rest). Left to wrap they made four ragged rows of
      // different lengths, and each was only 35px tall. One swipeable row
      // instead, matching the skill strip, with real tap targets.
      // QUALIFIED WITH `body`, and it has to be.
      //
      // teacher-dashboard.html declares `#adminSubNav{flex-wrap:wrap}` in a
      // <style> block inside the BODY (around line 1781). This stylesheet is
      // appended to <head>, so it comes EARLIER in document order, and with
      // both selectors at the same specificity the page's wrap won every time.
      // The result on a phone was the eight pills in three ragged rows of
      // 3/3/2 - exactly what this rule was written to prevent, silently not
      // applying since it was written.
      '  body #adminSubNav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;',
      '    overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;',
      '    scroll-snap-type:x proximity;padding-bottom:2px;}',
      '  body #adminSubNav::-webkit-scrollbar{height:0;width:0;}',
      '  body #adminSubNav .admin-subtab{flex:0 0 auto;scroll-snap-align:start;',
      '    min-height:44px;display:inline-flex;align-items:center;}',
      '  .av-search{width:100%;}',
      '  .av-search .av-search-input{width:100%;box-sizing:border-box;}',
      // The skill pills declare `flex-wrap:wrap` AND `overflow-x:auto`, which
      // cancel out: wrapping means there is never anything to scroll, so seven
      // pills become three stacked rows. One swipeable row instead.
      '  .skill-filter-strip{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;',
      '    -webkit-overflow-scrolling:touch;scrollbar-width:none;',
      // A little end padding plus scroll-snap, so the last pill is never left
      // half-clipped at the edge looking like a rendering fault rather than
      // something you can swipe.
      '    scroll-snap-type:x proximity;padding-right:14px;}',
      '  .skill-filter-strip::-webkit-scrollbar{height:0;width:0;}',
      '  .skill-pill{flex:0 0 auto;scroll-snap-align:start;}',
      '  .tms-bar{display:flex !important;}',
      // THE BAR OUTRANKED EVERY DIALOG ON THE PAGE.
      //
      // `.modal-overlay` is z-index 1000 (css/brand.css) and this bar is 9980,
      // so all thirteen dialogs on the dashboard - logout, delete, the
      // assignment forms, every confirm - rendered UNDERNEATH it on a phone.
      // The drill-down escaped only because `.sd-overlay` happens to be 10000.
      // Raised above the bar and the More sheet, but kept well below the
      // widgets tray and timer (99964+) so their existing order is unchanged.
      '  .modal-overlay{z-index:9990;}',
      // And hide the bar outright while a dialog is up, so a tab underneath it
      // cannot be tapped through: switching tabs behind an open dialog leaves
      // the dialog stranded over the wrong screen. Every dialog here opens by
      // adding `.active` (the shared layer also honours `.open`), so this
      // catches all of them. If `:has()` is unavailable the rule is simply
      // dropped and the z-index above still keeps the dialog visible.
      '  body:has(.modal-overlay.active) .tms-bar,',
      '  body:has(.modal-overlay.open) .tms-bar,',
      '  body:has(.sd-overlay.active) .tms-bar{display:none !important;}',
      '}',

      '.tms-bar{display:none;position:fixed;left:0;right:0;bottom:0;z-index:9980;',
      'align-items:stretch;background:var(--t2-surface,#fff);',
      'border-top:1px solid var(--t2-border,rgba(15,23,42,.12));',
      'padding-bottom:env(safe-area-inset-bottom,0px);',
      'box-shadow:0 -2px 14px rgba(15,23,42,.08);}',
      '.tms-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;gap:3px;padding:8px 4px;border:none;background:none;cursor:pointer;',
      'font:inherit;font-size:11px;font-weight:600;color:var(--t2-text-muted,#64748b);',
      // 44px is the smallest comfortable touch target; the label sits under it.
      'min-height:56px;-webkit-tap-highlight-color:transparent;}',
      '.tms-tab .tms-ico{width:22px;height:22px;display:flex;align-items:center;justify-content:center;}',
      '.tms-tab .tms-ico svg{width:22px;height:22px;}',
      '.tms-tab.is-active{color:var(--t2-accent,#2563eb);}',
      '.tms-lbl{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

      // The More sheet. A sheet rather than a menu: it rises from the bar it
      // belongs to, and a phone thumb is already down there.
      '.tms-sheet{position:fixed;inset:0;z-index:9981;display:none;}',
      '.tms-sheet.open{display:block;}',
      '.tms-scrim{position:absolute;inset:0;background:rgba(15,23,42,.45);}',
      '.tms-panel{position:absolute;left:0;right:0;bottom:0;background:var(--t2-surface,#fff);',
      'border-radius:18px 18px 0 0;padding:10px 10px calc(14px + env(safe-area-inset-bottom,0px));',
      'max-height:78vh;overflow-y:auto;overscroll-behavior:contain;',
      'box-shadow:0 -8px 30px rgba(15,23,42,.22);}',
      '.tms-grab{width:38px;height:4px;border-radius:99px;background:var(--t2-border,rgba(15,23,42,.18));',
      'margin:2px auto 10px;}',
      '.tms-item{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;',
      'padding:13px 14px;border:none;background:none;border-radius:12px;cursor:pointer;',
      'font:inherit;font-size:15px;font-weight:600;color:var(--t2-text,#0f172a);text-align:left;',
      'text-decoration:none;}',
      '.tms-item:active{background:var(--t2-surface-2,rgba(15,23,42,.06));}',
      '.tms-item .tms-ico{width:22px;height:22px;flex:none;}',
      '.tms-sep{height:1px;background:var(--t2-border,rgba(15,23,42,.10));margin:8px 6px;}',
      // The More row and what it opens (Widgets, Display, Rate Lingualab).
      '.tms-chev{display:inline-flex;opacity:.7;transition:transform .15s;}',
      '.tms-more[aria-expanded="true"] .tms-chev{transform:rotate(180deg);}',
      '.tms-sub{margin:0 0 4px 22px;padding-left:6px;border-left:1px solid var(--t2-border,rgba(15,23,42,.10));}',
      '.tms-sub[hidden]{display:none !important;}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  // ── Read the sidebar ─────────────────────────────────────────────────────
  // An entry is only offered if the sidebar is actually offering it: anything
  // the role-gating has left display:none stays out of the bar too.
  function visibleItems() {
    var side = document.getElementById('t2sidebar');
    if (!side) return [];
    var out = [];
    Array.prototype.forEach.call(side.querySelectorAll('.t2-nav-item'), function (el) {
      if (el.style.display === 'none') return;
      var label = el.querySelector('.label');
      out.push({
        el: el,
        tab: el.getAttribute('data-tab') || null,
        label: label ? label.textContent.trim() : (el.textContent || '').trim(),
        icoHtml: (el.querySelector('.ico') || {}).innerHTML || '',
        // The sidebar's More row and the rows it opens (Widgets, Display,
        // Rate Lingualab). The sheet shows the same group: a More row that
        // opens them in place, rather than the sidebar's own toggle, which is
        // hidden on a phone.
        isMoreToggle: el.hasAttribute('data-more-toggle'),
        inMore: !!(el.closest && el.closest('.t2-more-group'))
      });
    });
    return out;
  }

  function activate(item) {
    // CLICK THE SIDEBAR ROW, including for tabs.
    //
    // This used to call window.switchTab(tab) directly for tab items and return
    // early. That switched the tab but never fired the row's own click event,
    // and modules listen for exactly that: placement-admin.js binds its first
    // load to a click on .t2-nav-item[data-tab="placement"], so on a phone the
    // Placement panel sat on "Loading placement panel..." forever, because
    // nothing ever asked it to load.
    //
    // Clicking the real row runs its onclick (which calls switchTab anyway) AND
    // every other listener, which is the whole point of mirroring the sidebar
    // rather than reimplementing it. A display:none element still dispatches.
    closeSheet();
    item.el.click();
    if (item.tab) {
      syncActive();
      // The scroller is .t2-main, not the window: this dashboard is a fixed
      // 100vh shell (body.t2-active is overflow:hidden).
      var main = document.querySelector('.t2-main');
      if (main) main.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────
  var barEl = null, sheetEl = null;

  function build() {
    injectStyle();
    if (!barEl) {
      barEl = document.createElement('nav');
      barEl.className = 'tms-bar';
      barEl.id = 'tmsBar';
      barEl.setAttribute('aria-label', 'Dashboard sections');
      document.body.appendChild(barEl);
    }
    if (!sheetEl) {
      sheetEl = document.createElement('div');
      sheetEl.className = 'tms-sheet';
      sheetEl.id = 'tmsSheet';
      sheetEl.innerHTML = '<div class="tms-scrim"></div>' +
        '<div class="tms-panel" role="dialog" aria-modal="true" aria-label="More">' +
        '<div class="tms-grab"></div><div class="tms-list"></div></div>';
      document.body.appendChild(sheetEl);
      sheetEl.querySelector('.tms-scrim').addEventListener('click', closeSheet);
    }
    render();
  }

  function render() {
    if (!barEl) return;
    var items = visibleItems();
    var primary = [], rest = [];
    items.forEach(function (it) {
      if (it.tab && PRIMARY.indexOf(it.tab) !== -1) primary.push(it);
      else rest.push(it);
    });
    // Keep the declared order of PRIMARY, not the sidebar's, so the bar does not
    // reshuffle when a role-gated row appears above them.
    primary.sort(function (a, b) { return PRIMARY.indexOf(a.tab) - PRIMARY.indexOf(b.tab); });

    barEl.innerHTML = '';
    primary.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tms-tab';
      b.setAttribute('data-tms-tab', it.tab);
      b.innerHTML = '<span class="tms-ico">' + it.icoHtml + '</span>' +
                    '<span class="tms-lbl">' + it.label + '</span>';
      b.addEventListener('click', function () { activate(it); });
      barEl.appendChild(b);
    });

    if (rest.length) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'tms-tab';
      more.id = 'tmsMore';
      more.innerHTML = '<span class="tms-ico">' + dotsSvg() + '</span><span class="tms-lbl">More</span>';
      more.addEventListener('click', openSheet);
      barEl.appendChild(more);
    }

    var list = sheetEl.querySelector('.tms-list');
    list.innerHTML = '';
    var grouped = rest.filter(function (it) { return it.inMore; });
    rest.forEach(function (it, i) {
      if (it.inMore) return;                  // drawn inside the More group below
      // Logout is the destructive one; keep it last and set apart.
      var isLogout = /log\s?out/i.test(it.label);
      if (isLogout && i > 0) list.appendChild(sep());
      if (it.isMoreToggle) {
        if (!grouped.length) return;          // nothing to open
        list.appendChild(moreGroup(it, grouped));
        return;
      }
      list.appendChild(itemButton(it, isLogout));
    });
    syncActive();
  }

  function itemButton(it, isLogout) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tms-item';
    b.innerHTML = '<span class="tms-ico">' + it.icoHtml + '</span><span>' + it.label + '</span>';
    if (isLogout) b.style.color = '#dc2626';
    b.addEventListener('click', function () { activate(it); });
    return b;
  }

  // The More row and the rows it opens, in place. Its open state lives here
  // for the page's life, so re-renders (a role row appearing) keep it.
  var moreOpen = false;
  function moreGroup(toggle, items) {
    var wrap = document.createElement('div');
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'tms-item tms-more';
    head.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
    head.innerHTML = '<span class="tms-ico">' + dotsSvg() + '</span><span style="flex:1;">' + toggle.label +
      '</span><span class="tms-chev" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 12 15 18 9"/></svg></span>';
    var sub = document.createElement('div');
    sub.className = 'tms-sub';
    sub.hidden = !moreOpen;
    items.forEach(function (it) { sub.appendChild(itemButton(it, false)); });
    head.addEventListener('click', function () {
      moreOpen = !moreOpen;
      sub.hidden = !moreOpen;
      head.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
    });
    wrap.appendChild(head);
    wrap.appendChild(sub);
    return wrap;
  }

  function sep() { var d = document.createElement('div'); d.className = 'tms-sep'; return d; }
  function dotsSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/>' +
      '<circle cx="19" cy="12" r="1.6"/></svg>';
  }

  function syncActive() {
    if (!barEl) return;
    var active = null;
    var cur = document.querySelector('.t2-nav-item.active');
    if (cur) active = cur.getAttribute('data-tab');
    Array.prototype.forEach.call(barEl.querySelectorAll('[data-tms-tab]'), function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tms-tab') === active);
    });
  }

  function openSheet() { if (sheetEl) sheetEl.classList.add('open'); }
  function closeSheet() { if (sheetEl) sheetEl.classList.remove('open'); }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetEl && sheetEl.classList.contains('open')) {
      e.preventDefault();
      closeSheet();
    }
  });

  function boot() {
    if (!document.getElementById('t2sidebar')) return;   // not the dashboard
    build();

    // Placement and Admin are revealed later, once the role is known. Watch for
    // it instead of guessing a delay.
    try {
      var side = document.getElementById('t2sidebar');
      var obs = new MutationObserver(function () { render(); });
      obs.observe(side, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
    } catch (_) {}

    // The sidebar rows drive the active state, so mirror whatever they say.
    document.addEventListener('click', function () { setTimeout(syncActive, 0); }, true);
  }

  window.TeacherMobileShell = {
    refresh: render,
    isPhone: isPhone,
    _open: openSheet,
    _close: closeSheet
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
