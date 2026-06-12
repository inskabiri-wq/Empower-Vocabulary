/* ============================================================
   APP DIALOG — one themed alert / confirm / prompt for the
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
       safety) — never throws.
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
      + 'justify-content:center;padding:18px;background:rgba(8,12,24,.74);backdrop-filter:blur(6px);'
      + '-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .18s ease;}'
      + '.appdlg-overlay.in{opacity:1;}'
      + '.appdlg-card{width:100%;max-width:420px;background:linear-gradient(180deg,rgba(17,24,40,.98),rgba(11,15,28,.99));'
      + 'border:1.5px solid rgba(148,163,184,.22);border-radius:18px;padding:24px 24px 20px;'
      + 'box-shadow:0 30px 80px rgba(0,0,0,.6);color:#f1f5f9;'
      + "font-family:'Poppins',-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;"
      + 'transform:scale(.94);opacity:0;transition:transform .2s cubic-bezier(.34,1.4,.64,1),opacity .15s;'
      + 'max-height:calc(100vh - 36px);overflow-y:auto;}'
      + '.appdlg-overlay.in .appdlg-card{transform:scale(1);opacity:1;}'
      + '.appdlg-icon{font-size:2.2em;line-height:1;margin-bottom:8px;}'
      + '.appdlg-title{margin:0 0 8px;font-size:1.2em;font-weight:800;letter-spacing:-.01em;'
      + 'background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;background-clip:text;'
      + '-webkit-text-fill-color:transparent;}'
      + '.appdlg-title.danger{background:linear-gradient(135deg,#fb7185,#f59e0b);-webkit-background-clip:text;'
      + 'background-clip:text;-webkit-text-fill-color:transparent;}'
      + '.appdlg-msg{margin:0 0 16px;color:#cbd5e1;line-height:1.55;font-size:.96em;white-space:pre-wrap;}'
      + '.appdlg-input{width:100%;box-sizing:border-box;margin:0 0 16px;padding:11px 13px;border-radius:10px;'
      + 'border:1.5px solid rgba(148,163,184,.3);background:rgba(15,23,42,.7);color:#f1f5f9;font:inherit;font-size:1em;}'
      + '.appdlg-input:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25);}'
      + '.appdlg-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}'
      + '.appdlg-btn{flex:1 1 auto;min-width:104px;max-width:200px;padding:11px 20px;border-radius:10px;'
      + 'border:1.5px solid rgba(148,163,184,.28);background:rgba(15,23,42,.5);color:#e2e8f0;'
      + 'font:inherit;font-weight:600;font-size:.95em;cursor:pointer;'
      + 'transition:filter .15s,transform .08s,border-color .15s;}'
      + '.appdlg-btn:hover{filter:brightness(1.12);}'
      + '.appdlg-btn:active{transform:translateY(1px);}'
      + '.appdlg-btn.cancel:hover{border-color:rgba(148,163,184,.55);}'
      + '.appdlg-btn.ok{background:linear-gradient(135deg,#6366f1,#a78bfa);border-color:transparent;color:#fff;'
      + 'box-shadow:0 8px 22px -10px rgba(99,102,241,.7);}'
      + '.appdlg-btn.ok.danger{background:linear-gradient(135deg,#ef4444,#f43f5e);box-shadow:0 8px 22px -10px rgba(239,68,68,.65);}'
      + '@media (max-width:480px){.appdlg-btn{flex:1 1 100%;max-width:none;}}'
      + '@media (prefers-reduced-motion:reduce){.appdlg-overlay,.appdlg-card{transition:none;}}';
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
    overlay.innerHTML = '<div class="appdlg-card" role="dialog" aria-modal="true">'
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
    }
  };
})();
