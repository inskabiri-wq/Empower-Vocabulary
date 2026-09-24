/* ============================================================
   FAQ - common questions, one list shown in two places
   ------------------------------------------------------------
   The admin writes the questions in Admin > FAQ (teacher/js/faq-admin.js);
   each one is a document at faqs/{id}. Students read them in:

     - Messages & help (js/profile-hub.js): a "Common questions" page with a
       search box, and - before a student writes a message - the questions on
       the topic they just picked, so an answer that already exists is found
       first and nobody waits a day for it.
     - the sign-in page (index.html): only the questions the admin marked
       "also on the sign-in page". Someone who cannot sign in cannot reach
       Messages & help, and sign-in trouble is exactly what they have.

   Anyone may READ a published question, signed in or not (firestore.rules);
   a draft is the admin's only, and only the admin writes. Every query here
   carries published == true, which is what lets the rules allow it.

   The topic keys are the Messages & help topics plus 'general'. They are
   listed in firestore.rules too; tools/faq-check.js fails if they drift.
   ============================================================ */
(function () {
  'use strict';

  var TOPICS = [
    { key: 'general',   icon: '❓', label: 'General' },
    { key: 'account',   icon: '🔐', label: 'Your account and signing in' },
    { key: 'technical', icon: '🐞', label: 'When the app is not working' },
    { key: 'content',   icon: '❌', label: 'Mistakes in questions' },
    { key: 'lesson',    icon: '📖', label: 'Lessons and homework' },
    { key: 'grade',     icon: '📝', label: 'Grades and scores' },
    { key: 'absence',   icon: '📅', label: 'Absences' },
    { key: 'idea',      icon: '💡', label: 'Ideas and feedback' },
    { key: 'other',     icon: '💬', label: 'Something else' }
  ];
  function topic(key) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].key === key) return TOPICS[i];
    return TOPICS[0];
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fdb() {
    try { if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore(); } catch (e) {}
    return null;
  }

  // ── data ──
  // Read once per page and kept: the list is small and changes rarely, and a
  // student opening Messages & help twice should not pay for it twice. A
  // failed read is forgotten so the next opening tries again.
  var cache = {};
  function load(which) {
    which = which === 'login' ? 'login' : 'all';
    if (cache[which]) return cache[which];
    var fs = fdb();
    if (!fs) return Promise.resolve([]);
    var q = fs.collection('faqs').where('published', '==', true);
    if (which === 'login') q = q.where('onLogin', '==', true);
    cache[which] = q.get().then(function (snap) {
      var list = snap.docs.map(function (d) {
        var x = d.data() || {};
        return { id: d.id, q: String(x.q || ''), a: String(x.a || ''),
                 topic: x.topic || 'general', order: typeof x.order === 'number' ? x.order : 9999 };
      }).filter(function (f) { return f.q && f.a; });
      list.sort(function (a, b) { return (a.order - b.order) || a.q.localeCompare(b.q); });
      return list;
    }, function (e) {
      delete cache[which];
      throw e;
    });
    return cache[which];
  }

  // ── search ──
  // Every word must appear somewhere in the question or the answer. Accents
  // and Turkish dotted / dotless i are folded, so "sifre" finds "şifre" and a
  // capital I typed on a Turkish keyboard still matches.
  function norm(s) {
    var t = String(s || '').toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t;
  }
  function search(list, term) {
    var words = norm(term).split(/\s+/).filter(Boolean);
    if (!words.length) return list.slice();
    return list.filter(function (f) {
      var hay = norm(f.q + ' ' + f.a);
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
  }
  function forTopic(list, key) {
    return list.filter(function (f) { return f.topic === key; });
  }

  // ── rendering ──
  // Answers are plain text: line breaks are kept, and a web address becomes a
  // link. Nothing the admin types is ever treated as HTML.
  function answerHtml(a) {
    return esc(a).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
    });
  }
  function itemsHtml(list) {
    return list.map(function (f) {
      return '<details class="llfaq-item"><summary>' + esc(f.q) + '</summary>'
        + '<div class="llfaq-a">' + answerHtml(f.a) + '</div></details>';
    }).join('');
  }
  // Grouped under topic headings, in the order of TOPICS.
  function groupedHtml(list) {
    var h = '';
    TOPICS.forEach(function (t) {
      var items = forTopic(list, t.key);
      if (!items.length) return;
      h += '<div class="llfaq-group"><div class="llfaq-gh">' + esc(t.icon + ' ' + t.label) + '</div>'
        + itemsHtml(items) + '</div>';
    });
    return h;
  }

  // One small stylesheet, shared by both places. Written on the tokens both
  // the student pages and the sign-in page define, with fallbacks.
  function css() {
    if (document.getElementById('llfaq-css')) return;
    var s = document.createElement('style');
    s.id = 'llfaq-css';
    s.textContent = [
      '.llfaq-item{border:1px solid var(--border-color,rgba(120,120,150,.3));border-radius:12px;margin:0 0 7px;',
      '  background:var(--bg-item,rgba(120,120,150,.08));}',
      '.llfaq-item>summary{cursor:pointer;list-style:none;padding:11px 38px 11px 13px;position:relative;',
      '  font-weight:650;font-size:.94em;line-height:1.4;color:var(--text-primary,inherit);}',
      '.llfaq-item>summary::-webkit-details-marker{display:none;}',
      '.llfaq-item>summary::after{content:"+";position:absolute;right:14px;top:50%;transform:translateY(-50%);',
      '  font-size:1.2em;font-weight:700;opacity:.55;}',
      '.llfaq-item[open]>summary::after{content:"\\2212";}',
      '.llfaq-item>summary:focus-visible{outline:2px solid var(--accent-primary,#3b82f6);outline-offset:1px;border-radius:12px;}',
      '.llfaq-a{padding:0 13px 12px;font-size:.92em;line-height:1.55;white-space:pre-wrap;word-break:break-word;',
      '  color:var(--text-secondary,inherit);}',
      '.llfaq-a a{color:var(--accent-primary,#3b82f6);}',
      '.llfaq-group{margin:0 0 12px;}',
      '.llfaq-gh{font-size:.78em;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin:0 0 7px;}',
      '.llfaq-search{width:100%;box-sizing:border-box;padding:10px 13px;border-radius:12px;font:inherit;font-size:16px;',
      '  color:inherit;background:var(--bg-item,rgba(120,120,150,.10));border:1px solid var(--border-color,rgba(120,120,150,.35));',
      '  margin:0 0 12px;}',
      '.llfaq-search:focus{outline:2px solid var(--accent-primary,#3b82f6);outline-offset:1px;}',
      '.llfaq-none{padding:14px 4px;font-size:.92em;opacity:.75;}',
      // the sign-in page dialog
      '#faqModal .modal-card{max-width:620px;}',
      '#faqModal .llfaq-title{margin:0 34px 6px 0;font-size:1.25rem;color:var(--text-primary);}',
      '#faqModal .llfaq-sub{margin:0 0 14px;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── the sign-in page ──
  // The link stays hidden until there is at least one question to show, so
  // it never leads to an empty box.
  function wireLogin() {
    var slot = document.querySelector('[data-login-faq]');
    var modal = document.getElementById('faqModal');
    if (!slot || !modal) return;
    css();
    var list = [];
    var input = modal.querySelector('.llfaq-search');
    var box = modal.querySelector('[data-faq-list]');
    function paint() {
      var found = search(list, input ? input.value : '');
      box.innerHTML = found.length ? itemsHtml(found)
        : '<div class="llfaq-none">Nothing matches that. Try other words, or contact us below.</div>';
    }
    function open(e) {
      if (e) e.preventDefault();
      if (input) input.value = '';
      paint();
      modal.classList.add('open');
      if (input) { try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); } }
    }
    function close() { modal.classList.remove('open'); }
    load('login').then(function (l) {
      list = l;
      if (list.length) slot.hidden = false;
    }, function () { /* no link rather than a broken one */ });
    slot.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-faq-open]')) open(e);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || (e.target.closest && e.target.closest('[data-faq-close]'))) close();
    });
    if (input) input.addEventListener('input', paint);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }

  window.LLFaq = {
    TOPICS: TOPICS,
    topic: topic,
    load: load,
    search: search,
    forTopic: forTopic,
    itemsHtml: itemsHtml,
    groupedHtml: groupedHtml,
    css: css,
    esc: esc
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireLogin);
  else wireLogin();
})();
