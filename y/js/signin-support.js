/* ============================================================
   Contact us on the sign-in page - a message without signing in
   ------------------------------------------------------------
   Someone who cannot sign in cannot reach Messages & help (js/profile-hub.js),
   and that is exactly the person who needs it most. This is the same guided
   conversation, opened by BOTH "Contact us" links on index.html (the footer
   and the Common questions dialog), with one extra step first: their name and
   email, typed and required.

   Why typed: there is no account here, so nothing can be read off a profile
   or a token. The email is also how the answer finds its way back. The admin
   answers in Admin > Messages; when the person can sign in with that address,
   the thread is waiting in Messages & help, in their profile menu. No email is
   sent. Nothing typed here is checked (anyone can type any name), and the
   admin's inbox says so.

   Why the admin only: a teacher is found through a class, and without an
   account there is no class. Sign-in trouble is the admin's anyway. So `to`
   is always 'admin' and the topics are a subset of the admin's topics in the
   hub, same keys, icons and words. The keys are also listed in the rules'
   sign-in branch (firestore.rules, supportMessages).

   No sign-in step, not even anonymous: index/js/main.js signs out any user
   without a university email. The message is written signed out, in one
   narrow shape the rules check field by field (source == 'signin'), and
   nobody signed out can read anything back.

   If this file does not load, the links fall back to openSupportMail(), the
   old mailto.
   ============================================================ */
(function () {
  'use strict';

  var ID = 'llSigninSupport';

  // Only the admin topics that make sense BEFORE signing in. "A mistake in a
  // question" and "an idea" both need the app open, which these people cannot
  // do. Same icons and words as the hub, so the admin reads what was picked.
  var SIGNIN_TOPICS = [
    { key: 'account',   icon: '🔐', label: 'My account or signing in' },
    { key: 'technical', icon: '🐞', label: 'The app is not working' },
    { key: 'other',     icon: '💬', label: 'Something else' }
  ];
  // These two carry the device, as in the hub: "which phone, which browser?"
  // is the admin's first question otherwise.
  var TECH = { account: true, technical: true };
  var SIGNIN_WHENS = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week',      label: 'This week' },
    { key: 'earlier',   label: 'Earlier' }
  ];
  var PLACEHOLDER = {
    account:   'What happens when you try to sign in? The exact error message helps.',
    technical: 'What did you tap, and what happened instead?',
    other:     'What do you need help with?'
  };
  var MAX = 2000;
  // The same test the rules make. Loose on purpose: it catches a typo like a
  // missing @, and does not argue with a real but unusual address.
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // What has been typed and chosen, kept while the page is open: a tap on the
  // backdrop or Escape must not throw away a half-written message. Sending or
  // "Start again" clears the message part; the name and email stay, because
  // the same person is still asking.
  var draft = { name: '', email: '', who: false, topic: '', when: '', text: '' };
  var touched = { name: false, email: false };
  var sent = null;          // a snapshot of the message that went, for the "Sent" view
  var sending = false;
  var opener = null;
  var root = null;
  var downOnBackdrop = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fdb() {
    try { if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore(); } catch (e) {}
    return null;
  }
  function topic(key) {
    for (var i = 0; i < SIGNIN_TOPICS.length; i++) if (SIGNIN_TOPICS[i].key === key) return SIGNIN_TOPICS[i];
    return null;
  }
  function whenLabel(key) {
    for (var i = 0; i < SIGNIN_WHENS.length; i++) if (SIGNIN_WHENS[i].key === key) return SIGNIN_WHENS[i].label;
    return '';
  }

  // ── the typed fields ──
  // Stored exactly as the rules check them: trimmed, the email lowercased
  // (the student side later finds it by comparing with the token's address,
  // lowercased too).
  function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function cleanEmail(s) { return String(s || '').trim().toLowerCase(); }
  function nameError(s) {
    var n = cleanName(s);
    if (!n) return 'Write your name.';
    if (n.length < 2) return 'Write your full name.';
    if (n.length > 100) return 'That is too long: 100 letters at most.';
    return '';
  }
  function emailError(s) {
    var e = cleanEmail(s);
    if (!e) return 'Write your email.';
    if (e.length > 120) return 'That is too long for an email address.';
    if (!EMAIL_RE.test(e)) return 'Check the address. It needs an @ and a dot after it, like you@university.edu';
    return '';
  }

  // Plain words, not a user-agent string, the same as the hub: a person reads
  // this, and "Android phone - Chrome" is what they need to reproduce it.
  function device() {
    var ua = (navigator && navigator.userAgent) || '';
    var kind = /iPad|Tablet/i.test(ua) ? 'tablet' : (/Mobi|Android|iPhone|iPod/i.test(ua) ? 'phone' : 'computer');
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    return ((os ? os + ' ' : '') + kind + ' - ' + br).slice(0, 120);
  }

  // ── look ──
  // Scoped under the dialog's id and written on the sign-in page's own tokens,
  // so it follows the page's dark default and its .light-mode. The dialog
  // itself is the page's .modal-overlay / .modal-card, like Terms and Common
  // questions, and the fields reuse the login form's .form-input.
  function css() {
    if (document.getElementById(ID + '-css')) return;
    var P = '#' + ID;
    var s = document.createElement('style');
    s.id = ID + '-css';
    s.textContent = [
      // Closed means gone. .modal-overlay only fades out and stops taking
      // clicks, which would leave these fields reachable with Tab and read out
      // by screen readers. visibility waits for the fade before it hides.
      P + '{visibility:hidden;transition:opacity .25s ease,visibility 0s linear .25s;}',
      P + '.open{visibility:visible;transition:opacity .25s ease,visibility 0s;}',
      P + ' .lls-card{max-width:560px;}',
      P + ' .lls-title{margin:0 34px 4px 0;font-size:1.25rem;line-height:1.3;color:var(--text-primary,inherit);}',
      P + ' .lls-sub{margin:0 0 8px;}',
      P + ' .lls-body{color:var(--text-primary,inherit);}',
      // The conversation: the app's lines left, the person's own right.
      P + ' .lls-line{display:flex;margin:8px 0;}',
      P + ' .lls-line.is-me{justify-content:flex-end;}',
      P + ' .lls-bubble{max-width:86%;padding:10px 13px;border-radius:16px;font-size:.93rem;line-height:1.45;',
      '  white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;}',
      P + ' .is-bot .lls-bubble{background:rgba(148,163,184,.16);border-top-left-radius:5px;}',
      P + ' .is-me .lls-bubble{background:var(--accent-primary,#3b82f6);color:#fff;border-top-right-radius:5px;}',
      P + ' .lls-edit{display:flex;justify-content:flex-end;margin:-4px 0 2px;}',
      // Choices: one group as wide as its widest choice, at the right, as in
      // the hub. The border is a fixed blue, not --border-color: on this page
      // that token is 6% white, and the pills would have no edge in the dark.
      P + ' .lls-chips{display:flex;flex-direction:column;align-items:stretch;gap:7px;',
      '  width:-moz-fit-content;width:fit-content;max-width:92%;margin:6px 0 10px auto;}',
      P + ' .lls-chip{display:block;text-align:right;box-sizing:border-box;padding:9px 14px;border-radius:18px;',
      '  cursor:pointer;font:inherit;font-size:.92rem;font-weight:600;color:var(--accent-primary,#3b82f6);',
      '  background:transparent;border:1.5px solid rgba(59,130,246,.45);}',
      P + ' .lls-chip:hover,' + P + ' .lls-chip:focus-visible{background:var(--accent-primary,#3b82f6);color:#fff;',
      '  border-color:var(--accent-primary,#3b82f6);outline:none;}',
      // The name and email step.
      P + ' .lls-form{margin:2px 0 6px;}',
      P + ' .lls-label{display:block;margin:12px 0 6px;font-size:.85rem;font-weight:600;color:var(--text-primary,inherit);}',
      // 16px, or an iPhone zooms the whole page when the field is tapped.
      P + ' .lls-input{display:block;width:100%;box-sizing:border-box;padding:12px 14px;font-size:16px;}',
      P + ' .lls-text{resize:vertical;min-height:120px;line-height:1.45;}',
      P + ' .lls-input[aria-invalid="true"]{border-color:var(--error,#ef4444);}',
      P + ' .lls-note{margin:6px 2px 0;font-size:.8rem;color:var(--text-secondary,inherit);}',
      P + ' .lls-msg{margin:6px 2px 0;font-size:.82rem;font-weight:600;line-height:1.4;color:var(--error,#ef4444);}',
      P + ' .lls-msg:empty{display:none;}',
      P + ' .lls-actions{display:flex;justify-content:flex-end;margin-top:14px;}',
      P + ' .lls-btn{padding:10px 22px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:.95rem;',
      '  font-weight:700;color:#fff;background:var(--accent-primary,#3b82f6);}',
      P + ' .lls-btn:disabled{opacity:.45;cursor:not-allowed;}',
      P + ' .lls-btn:focus-visible,' + P + ' .lls-link:focus-visible{outline:2px solid var(--accent-primary,#3b82f6);outline-offset:2px;}',
      // Writing the message.
      P + ' .lls-attach{font-size:.8rem;color:var(--text-secondary,inherit);margin:0 0 8px;}',
      P + ' .lls-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;}',
      P + ' .lls-count{font-size:.78rem;color:var(--text-secondary,inherit);font-variant-numeric:tabular-nums;}',
      P + ' .lls-link{background:none;border:0;padding:4px 0;cursor:pointer;font:inherit;font-size:.85rem;',
      '  font-weight:600;color:var(--accent-primary,#3b82f6);}',
      P + ' .lls-err{margin-top:10px;padding:9px 12px;border-radius:10px;font-size:.86rem;line-height:1.45;',
      '  background:rgba(239,68,68,.14);color:var(--error,#ef4444);}',
      P + ' .lls-err.is-wait{background:rgba(148,163,184,.16);color:var(--text-secondary,inherit);}',
      P + ' .lls-err[hidden]{display:none;}',
      P + ' .lls-err a{color:inherit;font-weight:700;}',
      // A phone, down to 320px: more of the width for the conversation.
      '@media (max-width:480px){',
      '  ' + P + '{padding:10px;}',
      '  ' + P + ' .lls-card{padding:20px 16px 16px;max-height:92vh;max-height:92dvh;}',
      '  ' + P + ' .lls-bubble{max-width:92%;}',
      '  ' + P + ' .lls-chips{max-width:100%;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── rendering ──
  function bot(html) {
    return '<div class="lls-line is-bot"><div class="lls-bubble">' + html + '</div></div>';
  }
  function me(html) {
    return '<div class="lls-line is-me"><div class="lls-bubble">' + html + '</div></div>';
  }
  function chips(field, items) {
    return '<div class="lls-chips">' + items.map(function (it) {
      return '<button type="button" class="lls-chip" data-lls-pick="' + field + '" data-val="' + esc(it.key) + '">'
        + esc((it.icon ? it.icon + ' ' : '') + it.label) + '</button>';
    }).join('') + '</div>';
  }
  function whoLine(name, email) {
    return me(esc('👤 ' + name) + '\n' + esc('📧 ' + email));
  }
  var INTRO = 'Hi! 👋\n<b>Who are you?</b>\nYour name and email, so the admin knows who is asking and can answer you.';

  // Step 1, the one the hub does not have. Continue stays disabled until both
  // fields are valid; a field says what is wrong once it has been left with
  // something in it (or Enter was pressed), not while the first letter is typed.
  function whoHtml() {
    var ne = nameError(draft.name), ee = emailError(draft.email);
    var sn = touched.name ? ne : '', se = touched.email ? ee : '';
    return '<div class="lls-form">'
      + '<label class="lls-label" for="llsName">Name and surname</label>'
      + '<input id="llsName" class="form-input lls-input" data-lls-field="name" type="text" maxlength="100"'
      + ' autocomplete="name" autocapitalize="words" aria-required="true" aria-describedby="llsNameMsg"'
      + (sn ? ' aria-invalid="true"' : '') + ' value="' + esc(draft.name) + '">'
      + '<div class="lls-msg" id="llsNameMsg" aria-live="polite">' + esc(sn) + '</div>'
      + '<label class="lls-label" for="llsEmail">Email you sign in with</label>'
      + '<input id="llsEmail" class="form-input lls-input" data-lls-field="email" type="email" maxlength="120"'
      + ' autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="you@university.edu"'
      + ' aria-required="true" aria-describedby="llsEmailNote llsEmailMsg"'
      + (se ? ' aria-invalid="true"' : '') + ' value="' + esc(draft.email) + '">'
      + '<div class="lls-note" id="llsEmailNote">Used only to answer this message.</div>'
      + '<div class="lls-msg" id="llsEmailMsg" aria-live="polite">' + esc(se) + '</div>'
      + '<div class="lls-actions"><button type="button" class="lls-btn" data-lls-continue'
      + (ne || ee ? ' disabled' : '') + '>Continue</button></div>'
      + '</div>';
  }

  function convoHtml() {
    var h = bot(INTRO);
    if (!draft.who) return h + whoHtml();
    h += whoLine(cleanName(draft.name), cleanEmail(draft.email));
    h += '<div class="lls-edit"><button type="button" class="lls-link" data-lls-edit>Change name or email</button></div>';
    h += bot('<b>What is it about?</b>');
    var t = topic(draft.topic);
    if (!t) return h + chips('topic', SIGNIN_TOPICS) + '<span data-lls-anchor></span>';
    h += me(esc(t.icon + ' ' + t.label));
    h += bot('<b>When did it happen?</b>');
    if (!whenLabel(draft.when)) {
      h += chips('when', SIGNIN_WHENS);
    } else {
      h += me(esc(whenLabel(draft.when)));
      h += bot(TECH[t.key]
        ? '<b>Tell us what happened.</b>\nYour device and browser are attached, so the problem is easier to find.'
        : '<b>Tell us more.</b>');
      if (TECH[t.key]) h += '<div class="lls-attach">📎 ' + esc(device()) + '</div>';
      h += '<textarea class="form-input lls-input lls-text" data-lls-field="text" rows="5" maxlength="' + MAX + '"'
        + ' aria-label="Your message" placeholder="' + esc(PLACEHOLDER[t.key] || PLACEHOLDER.other) + '">'
        + esc(draft.text) + '</textarea>'
        + '<div class="lls-foot"><span class="lls-count">' + draft.text.length + ' / ' + MAX + '</span>'
        + '<button type="button" class="lls-btn" data-lls-send>Send</button></div>'
        + '<div class="lls-err" role="alert" hidden></div>';
    }
    return h + '<span data-lls-anchor></span>'
      + '<button type="button" class="lls-link" data-lls-again>↺ Start again</button>';
  }

  // Drawn from the snapshot, not the draft: the draft is already cleared for
  // the next message.
  function sentHtml() {
    var t = topic(sent.topic) || SIGNIN_TOPICS[SIGNIN_TOPICS.length - 1];
    return bot(INTRO)
      + whoLine(sent.name, sent.email)
      + bot('<b>What is it about?</b>') + me(esc(t.icon + ' ' + t.label))
      + bot('<b>When did it happen?</b>') + me(esc(whenLabel(sent.when)))
      + me(esc(sent.text))
      + bot('Sent to the Lingualab admin. When you can sign in with <b>' + esc(sent.email)
        + '</b>, the answer will be in <b>Messages &amp; help</b>, in your profile menu.')
      + '<div class="lls-chips"><button type="button" class="lls-chip" data-lls-another>✏️ Write another message</button></div>'
      + '<span data-lls-anchor></span>';
  }

  function body() { return root && root.querySelector('[data-lls-body]'); }
  function render() {
    var b = body();
    if (!b) return;
    b.innerHTML = sent ? sentHtml() : convoHtml();
    scrollToStep();
  }

  // Keep the newest step in view, as a conversation does, by scrolling the
  // card only, never the page behind it. The first step starts at the top.
  function scrollToStep() {
    var card = root.querySelector('.lls-card');
    var a = root.querySelector('[data-lls-anchor]');
    if (!card) return;
    if (!a) { card.scrollTop = 0; return; }
    var over = a.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom + 16;
    if (over > 0) card.scrollTop += over;
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  // The first thing to do on the current step: the first field that still
  // needs something, a choice, the message, or "Write another message".
  function focusStep() {
    if (!isOpen()) return;
    if (!sent && !draft.who) {
      var nameIn = root.querySelector('[data-lls-field="name"]');
      var emailIn = root.querySelector('[data-lls-field="email"]');
      focusEl(!nameError(draft.name) && emailError(draft.email) ? emailIn : nameIn);
      return;
    }
    focusEl(root.querySelector('[data-lls-body] [data-lls-field="text"], [data-lls-body] .lls-chip'));
  }

  // Updates the messages and the Continue button in place: re-rendering would
  // take the caret out of the field being typed in.
  function refreshWho() {
    var ne = nameError(draft.name), ee = emailError(draft.email);
    [['name', 'llsNameMsg', ne], ['email', 'llsEmailMsg', ee]].forEach(function (f) {
      var shown = touched[f[0]] ? f[2] : '';
      var msg = document.getElementById(f[1]);
      var input = root.querySelector('[data-lls-field="' + f[0] + '"]');
      if (msg && msg.textContent !== shown) msg.textContent = shown;
      if (input) { if (shown) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    });
    var btn = root.querySelector('[data-lls-continue]');
    if (btn) btn.disabled = !!(ne || ee);
  }
  function tryContinue() {
    touched.name = true;
    touched.email = true;
    if (nameError(draft.name) || emailError(draft.email)) { refreshWho(); focusStep(); return; }
    draft.name = cleanName(draft.name);
    draft.email = cleanEmail(draft.email);
    draft.who = true;
    render();
    focusStep();
  }

  // One line under the message box: an error (with a way out by email when
  // sending failed), or a calm "still sending".
  function status(text, kind) {
    var el = root.querySelector('.lls-err');
    if (!el) return;
    el.className = 'lls-err' + (kind === 'wait' ? ' is-wait' : '');
    el.innerHTML = esc(text) + (kind === 'mail' && typeof window.openSupportMail === 'function'
      ? ' <a href="#" data-lls-mail>Email us instead</a>' : '');
    el.hidden = !text;
  }

  // ── sending ──
  function send(btn) {
    if (sending) return;
    var ta = root.querySelector('[data-lls-field="text"]');
    var text = String((ta && ta.value) || '').trim();
    if (!text) { status('Write your message first.'); focusEl(ta); return; }
    if (text.length > MAX) text = text.slice(0, MAX);
    var name = cleanName(draft.name), email = cleanEmail(draft.email);
    if (nameError(name) || emailError(email)) {
      draft.who = false; touched.name = true; touched.email = true;
      render(); focusStep();
      return;
    }
    var t = topic(draft.topic);
    if (!t || !whenLabel(draft.when)) { status('Choose what it is about and when it happened first.'); return; }
    if (navigator.onLine === false) { status('You are offline. Connect to the internet and try again.'); return; }
    var fs = fdb();
    if (!fs || !firebase.firestore.FieldValue) {
      status('The message service did not load. Reload the page and try again.', 'mail');
      return;
    }

    // Exactly the fields the rules allow for a sign-in page message, every
    // one of them, every time. No userId: there is no account to point at.
    var doc = {
      source: 'signin',
      name: name,
      email: email,
      to: 'admin',
      topic: t.key,
      when: draft.when,
      device: TECH[t.key] ? device() : '',
      page: 'index.html',
      message: text,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // One send at a time, and say so: on a slow connection a silent button
    // gets tapped until there are five copies. If the write is still queued
    // after a while (the SDK waits for the network), say that too.
    sending = true;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    status('');
    var slow = setTimeout(function () {
      status('Still sending. Check your connection, and keep this page open.', 'wait');
    }, 15000);
    fs.collection('supportMessages').add(doc).then(function () {
      clearTimeout(slow);
      sending = false;
      sent = { name: name, email: email, topic: t.key, when: draft.when, text: text };
      draft.topic = ''; draft.when = ''; draft.text = '';
      render();
      focusStep();
    }, function (e) {
      clearTimeout(slow);
      sending = false;
      btn.disabled = false;
      btn.textContent = 'Send';
      status('Could not send that. Check your connection and try again.'
        + (e && e.code ? ' (' + e.code + ')' : ''), 'mail');
    });
  }

  // ── events ──
  function onClick(e) {
    if (e.target === root) { if (downOnBackdrop) close(); return; }
    var b = e.target.closest ? e.target.closest('button, a[data-lls-mail]') : null;
    if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-lls-close')) { close(); return; }
    if (b.hasAttribute('data-lls-mail')) {
      e.preventDefault();
      if (typeof window.openSupportMail === 'function') window.openSupportMail(e);
      return;
    }
    // Nothing re-draws under a message that is on its way.
    if (sending) return;
    if (b.hasAttribute('data-lls-continue')) { tryContinue(); return; }
    if (b.hasAttribute('data-lls-edit')) { draft.who = false; render(); focusStep(); return; }
    if (b.hasAttribute('data-lls-pick')) {
      var field = b.getAttribute('data-lls-pick');
      var val = b.getAttribute('data-val');
      // A new topic clears the date after it, so a changed mind never carries
      // a stale answer into the message. The words typed so far are kept.
      if (field === 'topic' && topic(val)) { draft.topic = val; draft.when = ''; }
      if (field === 'when' && whenLabel(val)) draft.when = val;
      render();
      focusStep();
      return;
    }
    if (b.hasAttribute('data-lls-again')) { draft.topic = ''; draft.when = ''; draft.text = ''; render(); focusStep(); return; }
    if (b.hasAttribute('data-lls-another')) { sent = null; render(); focusStep(); return; }
    if (b.hasAttribute('data-lls-send')) { send(b); return; }
  }

  function onInput(e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-lls-field');
    if (!f) return;
    draft[f] = e.target.value;
    if (f === 'text') {
      var cnt = root.querySelector('.lls-count');
      if (cnt) cnt.textContent = e.target.value.length + ' / ' + MAX;
      return;
    }
    refreshWho();
  }
  function onLeave(e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-lls-field');
    if (f !== 'name' && f !== 'email') return;
    if (String(e.target.value || '').trim()) { touched[f] = true; refreshWho(); }
  }

  function focusables() {
    var list = root.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]');
    return Array.prototype.filter.call(list, function (el) { return el.getClientRects().length > 0; });
  }
  // Enter in the name or email field is Continue. Not while an input method
  // is composing a word: that Enter picks the word.
  function onKey(e) {
    if (e.key === 'Enter' && !e.isComposing && e.target.matches && e.target.matches('input[data-lls-field]')) {
      e.preventDefault();
      if (!sending) tryContinue();
    }
  }
  // Escape closes; Tab stays inside the dialog while it is open, the way a
  // modal behaves everywhere else.
  function onDocKey(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (!root.contains(at)) { e.preventDefault(); focusEl(first); return; }
    if (e.shiftKey && at === first) { e.preventDefault(); focusEl(last); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); focusEl(first); }
  }

  function build() {
    if (root) return root;
    css();
    root = document.createElement('div');
    root.id = ID;
    root.className = 'modal-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', ID + 'Title');
    root.innerHTML = '<div class="modal-card lls-card">'
      + '<button type="button" class="modal-close" data-lls-close aria-label="Close">&times;</button>'
      + '<h2 class="lls-title" id="' + ID + 'Title">Contact us</h2>'
      + '<p class="modal-muted lls-sub">A message to the Lingualab admin. You do not need to sign in.</p>'
      + '<div class="lls-body" data-lls-body></div>'
      + '</div>';
    document.body.appendChild(root);
    // A text selection that starts in the card and ends on the backdrop fires
    // its click on the backdrop. Only a press that STARTED there closes.
    root.addEventListener('mousedown', function (e) { downOnBackdrop = e.target === root; });
    root.addEventListener('touchstart', function (e) { downOnBackdrop = e.target === root; }, { passive: true });
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('focusout', onLeave);
    root.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onDocKey);
    return root;
  }

  function isOpen() { return !!(root && root.classList.contains('open')); }

  // Someone who cannot sign in has usually just typed their address into the
  // sign-in form (or their name into Register). Offered, not assumed: it is
  // shown in the fields, and nothing moves on until they press Continue.
  function prefill() {
    if (draft.who) return;
    function val(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }
    if (!draft.email) {
      var em = val('loginEmail') || val('regEmail');
      if (em && !emailError(em)) draft.email = cleanEmail(em);
    }
    if (!draft.name) {
      var nm = cleanName(val('regName'));
      if (nm && !nameError(nm)) draft.name = nm;
    }
  }

  function open(e) {
    if (e && e.preventDefault) e.preventDefault();
    // Opened from Common questions: that dialog steps aside for this one.
    var faq = document.getElementById('faqModal');
    if (faq) faq.classList.remove('open');
    build();
    opener = (e && e.currentTarget && e.currentTarget.focus) ? e.currentTarget : document.activeElement;
    // Focus cannot go back into the dialog that just closed; the footer link
    // is the same action, so it takes it.
    if (opener && opener.closest && opener.closest('.modal-overlay')) opener = document.querySelector('.footer-help a');
    prefill();
    if (!sending) render();
    root.classList.add('open');
    focusStep();
    return false;
  }

  function close() {
    if (!root) return;
    root.classList.remove('open');
    if (opener && document.contains(opener)) focusEl(opener);
  }

  window.LLSigninSupport = {
    open: open,
    TOPICS: SIGNIN_TOPICS,
    WHENS: SIGNIN_WHENS
  };
})();
