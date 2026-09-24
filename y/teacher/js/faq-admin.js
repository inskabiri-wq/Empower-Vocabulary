/* ============================================================
   FAQ - Admin > FAQ, where the common questions are written
   ------------------------------------------------------------
   One document per question at faqs/{id}; students read the published ones
   in Messages & help, and the sign-in page shows the ones marked for it
   (js/faq.js). Only the admin reads drafts and only the admin writes
   (firestore.rules), and this panel is only built for the admin.

   Each question has:
     q, a        the question and its answer (plain text, 200 / 3000 chars)
     topic       a Messages & help topic, or 'general' - the Messages & help
                 box shows the questions on the topic a student picks before
                 they write, so it is worth choosing well
     published   shown to students; a draft is seen here only
     onLogin     also on the sign-in page - for sign-in trouble, which is
                 the one thing a student who cannot sign in needs
     order       position in the list (the arrows)

   "Add starter questions" writes a few questions about signing in and the
   app as DRAFTS: nothing reaches a student until it is read and published.
   Read on demand when the tab is opened, never streamed.
   ============================================================ */
(function () {
  'use strict';

  var COLL = 'faqs';
  var st = { list: null, loading: false, busy: false, editing: null, show: '', flash: '' };

  // Written from what the sign-in page and the dashboard actually do (see
  // index/js/main.js and student/js/set-password.js). Drafts, for review.
  var STARTERS = [
    { topic: 'account', onLogin: true, q: 'I did not get the verification email.',
      a: 'Check your spam or junk folder first.\n\nIf it is not there, go to the sign-in page, type your email and password and tap Sign In. You will be offered a new link: tap "Resend link", open the newest email, click the link, then sign in again.' },
    { topic: 'account', onLogin: true, q: 'I forgot my password.',
      a: 'On the sign-in page, type your email address in the Email box, then tap "Forgot password?". We email you a link to choose a new password.\n\nIf it does not arrive in a few minutes, check your spam folder.' },
    { topic: 'account', onLogin: true, q: 'Which email address do I use?',
      a: 'Your university email address. Personal addresses (Gmail, Hotmail and so on) cannot register or sign in.\n\nIf you are not sure which address is yours, ask your department.' },
    { topic: 'account', onLogin: true, q: 'Can I sign in with Google?',
      a: 'Yes, if your university email is a Google account. Tap "Continue with Google" and choose your university account. A personal Google account is not accepted.' },
    { topic: 'account', onLogin: false, q: 'How do I change my password?',
      a: 'On your dashboard, tap your profile picture at the top and choose "Change password".' },
    { topic: 'account', onLogin: false, q: 'My class, level or module is wrong.',
      a: 'Open Messages & help, choose "Lingualab admin", then "My account or signing in", and write the correct class, level and module. We will fix it for you.' },
    { topic: 'technical', onLogin: false, q: 'The app looks old, or a fix has not reached me.',
      a: 'Close Lingualab completely and open it again, or refresh the page. If you added Lingualab to your home screen, close it from your recent apps and open it again. This loads the newest version.' },
    { topic: 'content', onLogin: false, q: 'I found a mistake in a question.',
      a: 'Thank you! Open Messages & help, choose "Lingualab admin", then "A mistake in a question", and tell us the unit, the exercise and the question number.' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fdb() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (e) {}
    try { if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore(); } catch (e) {}
    return null;
  }
  function amAdmin() {
    try { return typeof isAdmin === 'function' && isAdmin(); } catch (e) { return false; }
  }
  function myEmail() {
    try { return (firebase.auth().currentUser || {}).email || ''; } catch (e) { return ''; }
  }
  function box() { return document.querySelector('[data-faq-admin]'); }
  function topics() { return (window.LLFaq && LLFaq.TOPICS) || [{ key: 'general', icon: '❓', label: 'General' }]; }
  function topicOf(key) {
    var all = topics();
    for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return all[0];
  }
  function stamp(extra) {
    var FV = firebase.firestore.FieldValue;
    return Object.assign({ updatedAt: FV.serverTimestamp(), updatedBy: myEmail() }, extra || {});
  }

  // ── data ──
  function load() {
    var el = box();
    var fs = fdb();
    if (!el) return;
    if (!fs) { el.innerHTML = '<div class="faq-empty">Firestore is not ready yet. Reload the page.</div>'; return; }
    if (st.loading) return;
    st.loading = true;
    if (!st.list) el.innerHTML = '<div class="faq-empty">Loading…</div>';
    fs.collection(COLL).get().then(function (snap) {
      st.loading = false;
      st.list = snap.docs.map(function (d) { return { id: d.id, data: d.data() || {} }; });
      st.list.sort(function (a, b) {
        return ((a.data.order || 0) - (b.data.order || 0)) || String(a.data.q || '').localeCompare(String(b.data.q || ''));
      });
      render();
    }).catch(function (e) {
      st.loading = false;
      el.innerHTML = '<div class="faq-empty">Could not load the questions: ' + esc((e && e.message) || e) + '</div>';
    });
  }
  function nextOrder() {
    var max = 0;
    (st.list || []).forEach(function (f) { if ((f.data.order || 0) > max) max = f.data.order; });
    return Math.min(99999, max + 10);
  }
  function find(id) {
    for (var i = 0; i < (st.list || []).length; i++) if (st.list[i].id === id) return st.list[i];
    return null;
  }

  // ── rendering ──
  function formHtml(f) {
    var d = (f && f.data) || { q: '', a: '', topic: 'general', published: false, onLogin: false };
    var opts = topics().map(function (t) {
      return '<option value="' + esc(t.key) + '"' + (d.topic === t.key ? ' selected' : '') + '>' + esc(t.icon + ' ' + t.label) + '</option>';
    }).join('');
    return '<div class="faq-form" data-faq-form="' + esc(f ? f.id : 'new') + '">'
      + '<label class="faq-label" for="faqQ">Question</label>'
      + '<input id="faqQ" class="faq-in" data-faq-in="q" maxlength="200" placeholder="What a student would ask, in their words" value="' + esc(d.q) + '">'
      + '<label class="faq-label" for="faqA">Answer</label>'
      + '<textarea id="faqA" class="faq-in faq-ta" data-faq-in="a" maxlength="3000" rows="6" placeholder="Plain text. Line breaks are kept, and a web address becomes a link.">' + esc(d.a) + '</textarea>'
      + '<div class="faq-count" data-faq-count>' + String(d.a || '').length + ' / 3000</div>'
      + '<div class="faq-row">'
      + '<div><label class="faq-label" for="faqT">Topic</label>'
      + '<select id="faqT" class="ll-select" data-faq-in="topic">' + opts + '</select>'
      + '<div class="faq-hint">In Messages &amp; help, students who pick this topic see this question before they write.</div></div>'
      + '<div class="faq-checks">'
      + '<label class="faq-check"><input type="checkbox" data-faq-in="published"' + (d.published ? ' checked' : '') + '> Show to students</label>'
      + '<label class="faq-check"><input type="checkbox" data-faq-in="onLogin"' + (d.onLogin ? ' checked' : '') + '> Also on the sign-in page</label>'
      + '<div class="faq-hint">The sign-in page is for sign-in problems: people there cannot sign in yet.</div>'
      + '</div></div>'
      + '<div class="faq-err" data-faq-err hidden></div>'
      + '<div class="faq-actions">'
      + '<button type="button" class="faq-btn" data-faq-cancel>Cancel</button>'
      + '<button type="button" class="faq-btn primary" data-faq-save>' + (f ? 'Save changes' : 'Add question') + '</button>'
      + '</div></div>';
  }

  function cardHtml(f, i, n, canMove) {
    var d = f.data;
    var t = topicOf(d.topic);
    if (st.editing === f.id) return '<div class="faq-card is-editing">' + formHtml(f) + '</div>';
    return '<div class="faq-card' + (d.published ? '' : ' is-draft') + '" data-faq-id="' + esc(f.id) + '">'
      + '<div class="faq-top">'
      + '<span class="faq-n">' + (i + 1) + '</span>'
      + '<span class="faq-tag">' + esc(t.icon + ' ' + t.label) + '</span>'
      + (d.published ? '<span class="faq-tag is-live">Shown to students</span>' : '<span class="faq-tag is-draft">Draft</span>')
      + (d.onLogin ? '<span class="faq-tag is-login">Sign-in page</span>' : '')
      + '</div>'
      + '<div class="faq-q">' + esc(d.q) + '</div>'
      + '<div class="faq-a">' + esc(d.a) + '</div>'
      + '<div class="faq-actions">'
      + '<button type="button" class="faq-btn" data-faq-move="-1" title="Move up" aria-label="Move up"' + (!canMove || i === 0 ? ' disabled' : '') + '>↑</button>'
      + '<button type="button" class="faq-btn" data-faq-move="1" title="Move down" aria-label="Move down"' + (!canMove || i === n - 1 ? ' disabled' : '') + '>↓</button>'
      + '<button type="button" class="faq-btn" data-faq-edit>Edit</button>'
      + '<button type="button" class="faq-btn' + (d.published ? '' : ' primary') + '" data-faq-toggle>' + (d.published ? 'Hide from students' : 'Show to students') + '</button>'
      + '<button type="button" class="faq-btn danger" data-faq-delete>Delete</button>'
      + '</div></div>';
  }

  function render() {
    var el = box();
    if (!el || !st.list) return;
    var all = st.list;
    var live = all.filter(function (f) { return f.data.published; }).length;
    var login = all.filter(function (f) { return f.data.published && f.data.onLogin; }).length;

    var h = '<div class="faq-bar">'
      + '<button type="button" class="faq-btn primary" data-faq-new' + (st.editing ? ' disabled' : '') + '>+ New question</button>'
      + '<button type="button" class="faq-btn" data-faq-starters' + (st.busy ? ' disabled' : '') + '>Add starter questions</button>'
      + '<select class="ll-select" data-faq-show aria-label="Show">'
      + '<option value="">All questions</option>'
      + '<option value="live"' + (st.show === 'live' ? ' selected' : '') + '>Shown to students</option>'
      + '<option value="draft"' + (st.show === 'draft' ? ' selected' : '') + '>Drafts</option>'
      + '<option value="login"' + (st.show === 'login' ? ' selected' : '') + '>On the sign-in page</option>'
      + '</select>'
      + '<span class="faq-sum">' + live + ' shown to students &middot; ' + login + ' on the sign-in page &middot; ' + (all.length - live) + (all.length - live === 1 ? ' draft' : ' drafts') + '</span>'
      + (st.flash ? '<span class="faq-flash" role="status">✓ ' + esc(st.flash) + '</span>' : '')
      + '</div>';

    if (st.editing === 'new') h += '<div class="faq-card is-editing">' + formHtml(null) + '</div>';

    if (!all.length) {
      if (st.editing !== 'new') {
        h += '<div class="faq-empty">No questions yet. Write one with <b>+ New question</b>, or tap <b>Add starter questions</b> for '
          + STARTERS.length + ' ready-made ones about signing in and the app. Starters arrive as drafts: read them, change what you like, then show them to students.</div>';
      }
      el.innerHTML = h;
      return;
    }

    // The arrows move a question within the WHOLE list, so they only make
    // sense while the whole list is on screen.
    var shown = all.filter(function (f) {
      if (st.show === 'live') return f.data.published;
      if (st.show === 'draft') return !f.data.published;
      if (st.show === 'login') return f.data.published && f.data.onLogin;
      return true;
    });
    h += '<div class="faq-list">' + (shown.length ? shown.map(function (f) {
      return cardHtml(f, all.indexOf(f), all.length, !st.show);
    }).join('') : '<div class="faq-empty">Nothing matches this filter.</div>') + '</div>';
    el.innerHTML = h;
  }

  function formErr(text) {
    var e = document.querySelector('[data-faq-admin] [data-faq-err]');
    if (!e) return;
    e.textContent = text;
    e.hidden = !text;
  }

  // ── writes ──
  function save(btn) {
    var form = btn.closest('[data-faq-form]');
    var id = form.getAttribute('data-faq-form');
    var get = function (k) { return form.querySelector('[data-faq-in="' + k + '"]'); };
    var q = get('q').value.trim();
    var a = get('a').value.trim();
    var topic = get('topic').value;
    var published = !!get('published').checked;
    var onLogin = !!get('onLogin').checked;
    if (q.length < 3) { formErr('Write the question (at least 3 characters).'); return; }
    if (!a) { formErr('Write the answer.'); return; }
    formErr('');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    var fs = fdb();
    var FV = firebase.firestore.FieldValue;
    var data = { q: q, a: a, topic: topic, published: published, onLogin: onLogin };
    var write = id === 'new'
      ? fs.collection(COLL).add(stamp(Object.assign(data, { order: nextOrder(), createdAt: FV.serverTimestamp() })))
      : fs.collection(COLL).doc(id).update(stamp(data));
    write.then(function () {
      st.editing = null;
      toast(id === 'new' ? 'Question added' : 'Saved');
      load();
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = id === 'new' ? 'Add question' : 'Save changes';
      formErr('Could not save: ' + ((e && e.message) || e));
    });
  }

  function toggle(id) {
    var f = find(id);
    if (!f || st.busy) return;
    st.busy = true;
    fdb().collection(COLL).doc(id).update(stamp({ published: !f.data.published })).then(function () {
      st.busy = false;
      toast(f.data.published ? 'Hidden from students' : 'Now shown to students');
      load();
    }).catch(function (e) { st.busy = false; alertMsg('Could not change it: ' + ((e && e.message) || e)); });
  }

  // Renumbers the whole list 10, 20, 30... in the new order and writes only
  // the questions whose number changed. Swapping two numbers would do nothing
  // when two questions share one, which starters added together can.
  function move(id, dir) {
    if (st.busy || !st.list) return;
    var list = st.list.slice();
    var i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === id) i = k;
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    var fs = fdb();
    var batch = fs.batch();
    var n = 0;
    list.forEach(function (f, idx) {
      var want = (idx + 1) * 10;
      if (f.data.order !== want) { batch.update(fs.collection(COLL).doc(f.id), stamp({ order: want })); n++; }
    });
    if (!n) return;
    st.busy = true;
    batch.commit().then(function () { st.busy = false; load(); })
      .catch(function (e) { st.busy = false; alertMsg('Could not move it: ' + ((e && e.message) || e)); });
  }

  function remove(id) {
    var f = find(id);
    if (!f) return;
    var ask = (window.AppDialog && AppDialog.confirm)
      ? AppDialog.confirm('Delete "' + f.data.q + '"? Students will no longer see it. This cannot be undone.',
          { title: 'Delete this question?', okLabel: 'Delete', cancelLabel: 'Keep it', danger: true })
      : Promise.resolve(window.confirm('Delete this question? This cannot be undone.'));
    ask.then(function (yes) {
      if (!yes) return;
      fdb().collection(COLL).doc(id).delete().then(function () { toast('Deleted'); load(); })
        .catch(function (e) { alertMsg('Could not delete it: ' + ((e && e.message) || e)); });
    });
  }

  // Skips any starter whose question is already in the list, so pressing the
  // button twice does not add everything twice.
  function addStarters() {
    if (st.busy || !st.list) return;
    var have = {};
    st.list.forEach(function (f) { have[String(f.data.q || '').trim().toLowerCase()] = true; });
    var todo = STARTERS.filter(function (s) { return !have[s.q.toLowerCase()]; });
    if (!todo.length) { alertMsg('The starter questions are already in the list.'); return; }
    var fs = fdb();
    var FV = firebase.firestore.FieldValue;
    var batch = fs.batch();
    var order = nextOrder();
    todo.forEach(function (s) {
      batch.set(fs.collection(COLL).doc(), stamp({
        q: s.q, a: s.a, topic: s.topic, onLogin: s.onLogin, published: false,
        order: Math.min(99999, order), createdAt: FV.serverTimestamp()
      }));
      order += 10;
    });
    st.busy = true;
    render();
    batch.commit().then(function () {
      st.busy = false;
      toast(todo.length + (todo.length === 1 ? ' starter question' : ' starter questions') + ' added as drafts');
      load();
    }).catch(function (e) { st.busy = false; render(); alertMsg('Could not add them: ' + ((e && e.message) || e)); });
  }

  // A short "done" note in the toolbar. Shown by the next render (every write
  // reloads the list) and removed on its own, without a re-render that could
  // rebuild a form the admin has started typing in.
  var flashTimer = null;
  function toast(text) {
    st.flash = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      st.flash = '';
      var el = document.querySelector('[data-faq-admin] .faq-flash');
      if (el) el.remove();
    }, 4000);
  }
  function alertMsg(text) {
    if (window.AppDialog && AppDialog.alert) AppDialog.alert(text, { title: 'FAQ' });
    else window.alert(text);
  }

  // ── events ──
  document.addEventListener('click', function (e) {
    if (!amAdmin()) return;
    var tab = e.target.closest ? e.target.closest('[data-target="faqPanel"]') : null;
    if (tab) { load(); return; }
    var b = e.target.closest ? e.target.closest('[data-faq-admin] button') : null;
    if (!b || b.disabled) return;
    var card = b.closest('[data-faq-id]');
    var id = card ? card.getAttribute('data-faq-id') : null;
    if (b.hasAttribute('data-faq-new'))      { st.editing = 'new'; render(); focusForm(); return; }
    if (b.hasAttribute('data-faq-starters')) { addStarters(); return; }
    if (b.hasAttribute('data-faq-cancel'))   { st.editing = null; render(); return; }
    if (b.hasAttribute('data-faq-save'))     { save(b); return; }
    if (b.hasAttribute('data-faq-edit'))     { st.editing = id; render(); focusForm(); return; }
    if (b.hasAttribute('data-faq-toggle'))   { toggle(id); return; }
    if (b.hasAttribute('data-faq-delete'))   { remove(id); return; }
    if (b.hasAttribute('data-faq-move'))     { move(id, parseInt(b.getAttribute('data-faq-move'), 10)); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('[data-faq-admin]')) return;
    if (t.hasAttribute('data-faq-show')) { st.show = t.value; render(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('[data-faq-admin] [data-faq-in="a"]')) return;
    var c = t.closest('[data-faq-form]').querySelector('[data-faq-count]');
    if (c) c.textContent = t.value.length + ' / 3000';
  });
  function focusForm() {
    var q = document.querySelector('[data-faq-admin] [data-faq-in="q"]');
    if (!q) return;
    try { q.scrollIntoView({ block: 'center' }); } catch (e) {}
    try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); }
  }

  window.FaqAdmin = { load: load, STARTERS: STARTERS };
})();
