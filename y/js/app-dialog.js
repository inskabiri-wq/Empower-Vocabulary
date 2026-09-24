/* ============================================================
   APP DIALOG - one themed alert / confirm / prompt for the
   whole app. Replaces the ugly native browser dialogs with a
   consistent dark-glass modal (same structure + look as the
   classroom .modal-* modals).

   Usage (all return Promises):
     AppDialog.alert('Saved!')                       → resolves void
     AppDialog.alert('Done', { title: 'Success' })
     AppDialog.confirm('Delete this?')               → resolves true/false
     AppDialog.confirm('End game?', { okLabel: 'End', danger: true })
     AppDialog.prompt('Your name?', { value: '' })   → resolves string | null
     AppDialog.prompt('Password', { password: true })

   Design notes:
     • Self-injects its own scoped CSS (.appdlg-*) on first use, so
       no per-page <link> is needed and the classes can NEVER collide
       with a page's existing .modal-* styles.
     • Enter = confirm/OK, Esc = cancel, backdrop click = cancel.
     • Falls back to native dialogs if the DOM isn't available (SSR
       safety) - never throws.
     • Only ONE dialog shows at a time; calls queue.
   ============================================================ */
(function () {
  'use strict';
  if (window.AppDialog) return;   // singleton

  var STYLE_ID = 'appdlg-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '.appdlg-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;'
      // Backdrop matched to the shared .modal-overlay in css/brand.css: the app
      // had three different treatments (blur 8px, blur 6px, blur 4px) and two
      // different fade lengths, so dialogs dimmed the page by different amounts.
      + 'justify-content:center;padding:18px;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);'
      + '-webkit-backdrop-filter:blur(8px);opacity:0;'
      + 'transition:opacity var(--ll-dlg-dur,.3s) ease;}'
      + '.appdlg-overlay.in{opacity:1;}'
      // Size and radius come from .ll-dialog in css/brand.css (loaded by every
      // page that loads this file), so this card is the same shape as the
      // logout modals and the reading exam's. Only colour lives here.
      // The motion reads the shared tokens rather than its own numbers, so it
      // uses the same curve and duration as the rest - it used to be a 0.2s
      // scale(.94) with a different easing, which is why it moved differently.
      + '.appdlg-card{background:linear-gradient(180deg,rgba(17,24,40,.98),rgba(11,15,28,.99));'
      + 'border:1.5px solid rgba(148,163,184,.22);'
      + 'box-shadow:0 30px 80px rgba(0,0,0,.6);color:#f1f5f9;'
      + "font-family:var(--ll-font);text-align:center;"
      + 'transform:var(--ll-dlg-from,scale(.9) translateY(20px));opacity:0;'
      + 'transition:transform var(--ll-dlg-dur,.3s) var(--ll-dlg-ease,cubic-bezier(.34,1.56,.64,1)),opacity .15s;'
      + 'max-height:calc(100vh - 36px);overflow-y:auto;}'
      + '.appdlg-overlay.in .appdlg-card{transform:scale(1) translateY(0);opacity:1;}'
      + '.appdlg-icon{font-size:2.2em;line-height:1;margin-bottom:8px;}'
      + '.appdlg-title{margin:0 0 8px;font-size:1.2em;font-weight:800;letter-spacing:-.01em;'
      + 'background:linear-gradient(135deg,#60a5fa,#60a5fa);-webkit-background-clip:text;background-clip:text;'
      + '-webkit-text-fill-color:transparent;}'
      + '.appdlg-title.danger{background:linear-gradient(135deg,#fb7185,#e11d48);-webkit-background-clip:text;'
      + 'background-clip:text;-webkit-text-fill-color:transparent;}'
      + '.appdlg-msg{margin:0 0 16px;color:#cbd5e1;line-height:1.55;font-size:.96em;white-space:pre-wrap;}'
      + '.appdlg-input{width:100%;box-sizing:border-box;margin:0 0 16px;padding:11px 13px;border-radius:10px;'
      + 'border:1.5px solid rgba(148,163,184,.3);background:rgba(15,23,42,.7);color:#f1f5f9;font:inherit;font-size:1em;}'
      + '.appdlg-input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.25);}'
      + '.appdlg-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}'
      // flex-basis 0, NOT auto. With `auto` each button starts at the width of
      // its own text and grows from there, so "Stay" could never come out the
      // same width as "Log out". A zero basis gives both the same starting
      // width, so they always finish equal.
      // The numbers here are the ones in css/brand.css for the markup dialogs
      // (.ll-dialog .modal-buttons .modal-btn); change the two together or the
      // built-on-open dialogs drift away from the built-in-markup ones again.
      + '.appdlg-btn{flex:1 1 0;min-width:110px;max-width:200px;min-height:48px;padding:12px 22px;border-radius:10px;'
      + 'border:1.5px solid rgba(148,163,184,.28);background:rgba(15,23,42,.5);color:#e2e8f0;'
      + 'font:inherit;font-weight:600;font-size:.95em;cursor:pointer;'
      + 'transition:filter .15s,transform .08s,border-color .15s;}'
      + '.appdlg-btn:hover{filter:brightness(1.12);}'
      + '.appdlg-btn:active{transform:translateY(1px);}'
      + '.appdlg-btn.cancel:hover{border-color:rgba(148,163,184,.55);}'
      + '.appdlg-btn.ok{background:linear-gradient(135deg,#2563eb,#60a5fa);border-color:transparent;color:#fff;'
      + 'box-shadow:0 8px 22px -10px rgba(37,99,235,.7);}'
      + '.appdlg-btn.ok.danger{background:linear-gradient(135deg,#ef4444,#f43f5e);box-shadow:0 8px 22px -10px rgba(239,68,68,.65);}'
      + '@media (max-width:480px){.appdlg-btn{flex:1 1 100%;max-width:none;}}'
      + '@media (prefers-reduced-motion:reduce){.appdlg-overlay,.appdlg-card{transition:none;}}'

      // LIGHT MODE.
      //
      // Every colour above is a dark literal with no light counterpart, so on
      // the repainted white app this dialog rendered as a dark navy box in the
      // middle of a light page: "Missing level / Pick a level first" arrived
      // looking like it belonged to a different product. The card is the most
      // visible shared component in the app, and it was the last one still
      // painting itself dark.
      //
      // Only the SURFACES flip. The accent, the danger red and the motion are
      // unchanged, so the dialog is recognisably the same object in either
      // theme.
      + '.light-mode .appdlg-overlay{background:rgba(15,23,42,.45);}'
      + '.light-mode .appdlg-card{background:#ffffff;'
      + 'border:1.5px solid #cbd8e8;box-shadow:0 30px 80px rgba(15,23,42,.28);color:#0f172a;}'
      + '.light-mode .appdlg-msg{color:#334155;}'
      + '.light-mode .appdlg-input{background:#ffffff;border-color:#cbd8e8;color:#0f172a;}'
      // ONLY the secondary button is repainted.
      //
      // The first attempt at this styled `.light-mode .appdlg-btn`, which has
      // the same specificity as `.appdlg-btn.ok` and comes later in the sheet,
      // so it quietly won and stripped the primary button of its blue. The
      // result was white text on a near-white pill: the OK button was the
      // least readable thing on the screen.
      + '.light-mode .appdlg-btn.cancel{background:#eef3fa;border-color:#c3d2e6;color:#1e293b;}'
      + '.light-mode .appdlg-btn.cancel:hover{background:#e2eaf6;border-color:#94a3b8;}'
      // Primary and danger keep their gradient in both themes, stated again
      // here so no later light rule can flatten them by accident.
      + '.light-mode .appdlg-btn.ok{background:linear-gradient(135deg,#2563eb,#3b82f6);'
      + 'border-color:transparent;color:#ffffff;box-shadow:0 8px 22px -10px rgba(37,99,235,.8);}'
      + '.light-mode .appdlg-btn.ok.danger{background:linear-gradient(135deg,#dc2626,#ef4444);'
      + 'box-shadow:0 8px 22px -10px rgba(220,38,38,.7);}'
      // The title uses background-clip:text, so it needs a colour that carries
      // on white rather than the pale blue that reads as disabled.
      + '.light-mode .appdlg-title{background:linear-gradient(135deg,#1d4ed8,#2563eb);'
      + '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}'
      + '.light-mode .appdlg-title.danger{background:linear-gradient(135deg,#dc2626,#e11d48);'
      + '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  var queue = [];
  var active = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function run(opts) {
    return new Promise(function (resolve) {
      queue.push({ opts: opts, resolve: resolve });
      pump();
    });
  }
  function pump() {
    if (active || !queue.length) return;
    if (!document || !document.body) { // not ready → native fallback
      var job0 = queue.shift();
      resolveNative(job0); pump(); return;
    }
    active = true;
    var job = queue.shift();
    show(job.opts, function (result) {
      active = false;
      job.resolve(result);
      pump();
    });
  }

  function resolveNative(job) {
    var o = job.opts;
    try {
      if (o.kind === 'alert') { window.alert(o.message); job.resolve(); }
      else if (o.kind === 'confirm') { job.resolve(window.confirm(o.message)); }
      else { job.resolve(window.prompt(o.message, o.value || '')); }
    } catch (e) { job.resolve(o.kind === 'confirm' ? false : (o.kind === 'prompt' ? null : undefined)); }
  }

  function show(o, done) {
    injectStyle();
    var overlay = document.createElement('div');
    overlay.className = 'appdlg-overlay';
    var dangerCls = o.danger ? ' danger' : '';
    var iconHtml = o.icon ? '<div class="appdlg-icon">' + esc(o.icon) + '</div>' : '';
    var titleHtml = o.title ? '<h3 class="appdlg-title' + dangerCls + '">' + esc(o.title) + '</h3>' : '';
    var msgHtml = o.message ? '<p class="appdlg-msg">' + esc(o.message) + '</p>' : '';
    var inputHtml = '';
    if (o.kind === 'prompt') {
      inputHtml = '<input class="appdlg-input" type="' + (o.password ? 'password' : 'text') + '"'
        + ' value="' + esc(o.value || '') + '"'
        + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>';
    }
    var btns = '';
    if (o.kind === 'alert') {
      btns = '<button type="button" class="appdlg-btn ok' + dangerCls + '" data-r="ok">' + esc(o.okLabel || 'OK') + '</button>';
    } else {
      btns = '<button type="button" class="appdlg-btn cancel" data-r="cancel">' + esc(o.cancelLabel || 'Cancel') + '</button>'
           + '<button type="button" class="appdlg-btn ok' + dangerCls + '" data-r="ok">' + esc(o.okLabel || 'OK') + '</button>';
    }
    overlay.innerHTML = '<div class="appdlg-card ll-dialog" role="dialog" aria-modal="true">'
      + iconHtml + titleHtml + msgHtml + inputHtml
      + '<div class="appdlg-btns">' + btns + '</div></div>';
    document.body.appendChild(overlay);
    // reflow → animate in
    void overlay.offsetWidth;
    overlay.classList.add('in');

    var input = overlay.querySelector('.appdlg-input');
    var okBtn = overlay.querySelector('[data-r="ok"]');
    if (input) { setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 60); }
    else if (okBtn) { setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 60); }

    function finish(result) {
      overlay.classList.remove('in');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () { try { overlay.remove(); } catch (e) {} }, 200);
      done(result);
    }
    function ok() {
      if (o.kind === 'alert') return finish(undefined);
      if (o.kind === 'confirm') return finish(true);
      return finish(input ? input.value : '');     // prompt
    }
    function cancel() {
      if (o.kind === 'alert') return finish(undefined);
      if (o.kind === 'confirm') return finish(false);
      return finish(null);                          // prompt cancelled
    }
    overlay.addEventListener('click', function (e) {
      var t = e.target;
      if (t === overlay) return cancel();           // backdrop
      var r = t.getAttribute && t.getAttribute('data-r');
      if (r === 'ok') return ok();
      if (r === 'cancel') return cancel();
    });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter') {
        // For prompt, Enter in the field submits. For alert/confirm, Enter = OK.
        if (o.kind !== 'prompt' || document.activeElement === input || document.activeElement === okBtn) {
          e.preventDefault(); ok();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
  }

  window.AppDialog = {
    alert: function (message, opts) {
      opts = opts || {};
      return run({ kind: 'alert', message: message, title: opts.title || '', icon: opts.icon || '',
                   okLabel: opts.okLabel, danger: !!opts.danger });
    },
    confirm: function (message, opts) {
      opts = opts || {};
      return run({ kind: 'confirm', message: message, title: opts.title || 'Are you sure?',
                   icon: opts.icon || '', okLabel: opts.okLabel || 'Confirm',
                   cancelLabel: opts.cancelLabel || 'Cancel', danger: !!opts.danger });
    },
    prompt: function (message, opts) {
      opts = opts || {};
      return run({ kind: 'prompt', message: message, title: opts.title || '', icon: opts.icon || '',
                   value: opts.value || '', placeholder: opts.placeholder || '',
                   password: !!opts.password, okLabel: opts.okLabel || 'OK',
                   cancelLabel: opts.cancelLabel || 'Cancel' });
    },

    /* HOLD A CONFIRM MODAL OPEN WHILE SOMETHING FINISHES.
     *
     * Both dashboards used to call closeLogoutModal() as the FIRST line of
     * confirmLogout(), then sign out. That exposed the live, fully clickable
     * dashboard for as long as the sign-out took - on the student side that
     * also included an awaited Firestore write, so roughly a second in which
     * a student could open a game, or the next person on a shared machine
     * could click into the account that is on its way out.
     *
     * Keeping the overlay up is the fix; this puts it into a visible working
     * state so the wait reads as progress instead of a stuck button.
     *
     * Every step is guarded: this runs on the way out of a session and must
     * never be the reason a logout fails.
     */
    busy: function (modalId, label) {
      try {
        var m = document.getElementById(modalId || 'logoutModal');
        if (!m) return;
        m.classList.add('is-busy');
        var btns = m.querySelectorAll('.modal-btn, button');
        for (var i = 0; i < btns.length; i++) {
          btns[i].disabled = true;
          btns[i].setAttribute('aria-disabled', 'true');
          // The confirm button carries the message; the cancel one just fades.
          if (/confirm|delete|danger|ok/i.test(btns[i].className)) {
            if (!btns[i].hasAttribute('data-idle-label')) {
              btns[i].setAttribute('data-idle-label', btns[i].textContent);
            }
            btns[i].textContent = label || 'Signing out...';
          }
        }
      } catch (_) { /* never block the sign-out */ }
    },

    // Undo busy(). Needed because the sign-out CAN fail: without this the
    // modal would sit there with both buttons dead and no way to retry or
    // cancel, which is worse than the delay it replaced.
    unbusy: function (modalId) {
      try {
        var m = document.getElementById(modalId || 'logoutModal');
        if (!m) return;
        m.classList.remove('is-busy');
        var btns = m.querySelectorAll('.modal-btn, button');
        for (var i = 0; i < btns.length; i++) {
          btns[i].disabled = false;
          btns[i].removeAttribute('aria-disabled');
          var idle = btns[i].getAttribute('data-idle-label');
          if (idle !== null) { btns[i].textContent = idle; btns[i].removeAttribute('data-idle-label'); }
        }
      } catch (_) {}
    },

    // Is a modal mid-flight? Backdrop and Escape handlers ask this so a
    // stray click cannot dismiss the overlay and expose the page during the
    // exact window the overlay exists to cover.
    isBusy: function (modalId) {
      try {
        var m = document.getElementById(modalId || 'logoutModal');
        return !!(m && m.classList.contains('is-busy'));
      } catch (_) { return false; }
    }
  };
})();
