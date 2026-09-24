/* ============================================================
   MESSAGES - the staff inbox for student messages
   ------------------------------------------------------------
   Students write from the profile hub ("Messages & help", js/profile-hub.js)
   and choose WHO it goes to (their teacher or the admin), WHAT it is about
   and WHEN it happened. Staff answer HERE, inside the dashboard. No email is
   involved anywhere: the answer appears in the student's profile hub, signed
   with the name and role of whoever wrote it.

   ONE module, TWO homes - where they live is the owner's decision:
     admin    Admin > Messages (#messagesPanel)  every message, both recipients
     teacher  the Overview page (#t2messagesPanel) messages sent to teachers
              from THIS teacher's own classes
   The admin does not get the Overview card: Admin > Messages is theirs.

   What a teacher can read is bounded twice. firestore.rules never lets a
   teacher read a message addressed to the admin (a student may be writing
   about them). Within messages addressed to teachers, the query is narrowed
   to the teacher's classes here, the same convention config.js uses for
   students - the rules cannot prove a per-class get() for a query.

   Read on demand, never streamed. A live listener on a queue nobody is
   watching most of the day is reads for nothing.

   Someone who CANNOT sign in writes from the sign-in page instead
   (js/signin-support.js). Those messages carry source 'signin', always go to
   the admin (so teachers never see them), and have no account behind them:
   no userId, class, level or module, and a name and email that were typed.
   The card says so, and the answer reaches them once they sign in with that
   email.

   The topic, `when` and recipient keys are mirrored in js/profile-hub.js
   and firestore.rules; tools/support-topics-check.js fails if they drift.
   ============================================================ */
(function () {
  'use strict';

  var COLL = 'supportMessages';

  var TOPICS = {
    lesson:    { icon: '📖', label: 'Lesson or homework question', to: 'teacher' },
    grade:     { icon: '📝', label: 'My grade or score',           to: 'teacher' },
    absence:   { icon: '📅', label: 'Absence or a missed class',   to: 'teacher' },
    technical: { icon: '🐞', label: 'The app is not working',      to: 'admin' },
    account:   { icon: '🔐', label: 'My account or signing in',    to: 'admin' },
    content:   { icon: '❌', label: 'A mistake in a question',     to: 'admin' },
    idea:      { icon: '💡', label: 'An idea or feedback',         to: 'admin' },
    other:     { icon: '💬', label: 'Something else',              to: 'both' }
  };
  var WHENS = { today: 'today', yesterday: 'yesterday', week: 'this week', earlier: 'earlier' };
  var RECIPIENTS = ['teacher', 'admin'];

  var homes = {};

  // ── small helpers ──────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Nothing in the app sets window.db; config.js declares `const db` at the
  // top level, which other scripts can see by name but not as window.db.
  function fdb() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (e) {}
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore();
    } catch (e) {}
    return null;
  }
  function user() {
    try { if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser; } catch (e) {}
    try { return firebase.auth().currentUser; } catch (e) { return null; }
  }
  function profileDoc() {
    try { return (typeof currentUserData !== 'undefined' && currentUserData) || null; } catch (e) { return null; }
  }
  function amAdmin() {
    try { return typeof isAdmin === 'function' && isAdmin(); } catch (e) { return false; }
  }

  // Who is answering. The email and role are checked by firestore.rules
  // against the signed-in account, so "Answered by" cannot be forged; the name
  // is what the student reads.
  function me() {
    var u = user() || {};
    var d = profileDoc() || {};
    var email = u.email || '';
    var name = d.name || d.displayName || u.displayName || email.split('@')[0] || 'Staff';
    return { uid: u.uid, email: email, name: String(name).slice(0, 80), role: amAdmin() ? 'admin' : 'teacher' };
  }

  function scope() {
    var d = profileDoc() || {};
    return {
      classes: Array.isArray(d.assignedClasses) ? d.assignedClasses.filter(Boolean) : [],
      year: d.assignedYear || '',
      module: d.assignedModule || ''
    };
  }
  function hasScope(s) { return s.classes.length > 0 || !!s.year || !!s.module; }
  // AND, exactly as config.js narrows students: every scope the teacher has
  // must match.
  function inScope(d) {
    var s = scope();
    if (s.classes.length && s.classes.indexOf(d.studentClass) === -1) return false;
    if (s.year && d.level !== s.year) return false;
    if (s.module && d.module !== s.module) return false;
    return true;
  }

  function millis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    var d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  function ago(ts) {
    var ms = millis(ts);
    if (!ms) return 'just now';
    var mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ms).toLocaleDateString();
  }
  function staffName(by) {
    if (!by) return 'staff';
    return (by.name || 'Staff') + ' (' + (by.role === 'admin' ? 'Admin' : 'Teacher') + ')';
  }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || 'the student'; }
  function stateOf(d) { return d.status === 'answered' ? 'answered' : 'open'; }
  // A message written before the recipient choice existed has no `to`. The
  // rules treat that as admin-only, the card's tag already said "To admin" -
  // but the filter compared the raw field, so "Sent to admin" HID it. Found on
  // production data (one such message exists). Both now read this.
  function toOf(d) { return d.to === 'teacher' ? 'teacher' : 'admin'; }

  // ── homes ──────────────────────────────────────────────────────────────
  function mount(kind) {
    var el = document.querySelector('[data-msgbox="' + kind + '"]');
    if (!el) return null;
    if (!homes[kind]) {
      // `keep`: cards acted on since the last full render. They stay on screen
      // even when they no longer match the filter (an answered card under
      // "Waiting"), so nothing vanishes mid-action - and the count counts them,
      // because a count that says 0 beside a visible card reads as broken.
      homes[kind] = { kind: kind, el: el, docs: null, status: 'open', topic: '', to: '', cls: '',
                      open: {}, replies: {}, keep: {}, drafts: {}, loading: false };
    }
    return homes[kind];
  }

  function query(home) {
    var fs = fdb();
    if (home.kind === 'admin') {
      return fs.collection(COLL).orderBy('createdAt', 'desc').limit(300).get();
    }
    // `to == teacher` is REQUIRED, not an optimisation: firestore.rules only
    // lets a teacher read messages addressed to teachers, and a query that
    // could return anything else is refused outright. Equality filters only,
    // so no composite index is needed; the newest-first sort is done here.
    var s = scope();
    var q = fs.collection(COLL).where('to', '==', 'teacher');
    // 'in' takes at most 30 values. Teachers have one to five classes.
    if (s.classes.length) q = q.where('studentClass', 'in', s.classes.slice(0, 30));
    else if (s.year) q = q.where('level', '==', s.year);
    else if (s.module) q = q.where('module', '==', s.module);
    return q.get();
  }

  function load(home) {
    if (!home || home.loading) return;
    var fs = fdb();
    if (!fs) { home.el.innerHTML = '<div class="msg-empty">Firestore is not ready yet. Reload the page.</div>'; return; }
    home.loading = true;
    if (!home.docs) home.el.innerHTML = '<div class="msg-empty">Loading…</div>';
    query(home).then(function (snap) {
      home.loading = false;
      var docs = snap.docs.map(function (d) { return { id: d.id, data: d.data() }; });
      if (home.kind === 'teacher') docs = docs.filter(function (m) { return inScope(m.data); });
      docs.sort(function (a, b) {
        return millis(b.data.lastReplyAt || b.data.createdAt) - millis(a.data.lastReplyAt || a.data.createdAt);
      });
      home.docs = docs;
      render(home);
      publishCount(home);
    }).catch(function (e) {
      home.loading = false;
      home.el.innerHTML = '<div class="msg-empty">Could not load messages: ' + esc((e && e.message) || e) + '</div>';
    });
  }

  function publishCount(home) {
    var open = (home.docs || []).filter(function (m) { return stateOf(m.data) === 'open'; }).length;
    var badge = document.getElementById(home.kind === 'admin' ? 'msgUnread' : 't2msgCount');
    if (!badge) return;
    if (home.kind === 'admin') {
      badge.textContent = String(open);
      badge.hidden = open === 0;
    } else {
      badge.textContent = open === 1 ? '1 waiting' : open + ' waiting';
      badge.className = 't2-badge ' + (open ? 'warning' : 'info');
      badge.hidden = false;           // it ships hidden until a real count exists
    }
  }

  // ── rendering ──────────────────────────────────────────────────────────
  function visible(home) {
    return (home.docs || []).filter(function (m) {
      var d = m.data;
      if (home.keep[m.id]) return true;
      if (home.status !== 'all' && stateOf(d) !== home.status) return false;
      if (home.topic && d.topic !== home.topic) return false;
      if (home.to && toOf(d) !== home.to) return false;
      // A sign-in page message has no class, so any class filter hides it
      // (and the class list below skips it); every status count includes it.
      if (home.cls && d.studentClass !== home.cls) return false;
      return true;
    });
  }

  function barHtml(home) {
    var docs = home.docs || [];
    var n = { open: 0, answered: 0, all: docs.length };
    docs.forEach(function (m) { n[stateOf(m.data)]++; });

    var h = '<div class="msg-bar"><div class="msg-filters">';
    [['open', 'Waiting'], ['answered', 'Answered'], ['all', 'All']].forEach(function (p) {
      h += '<button type="button" class="msg-filter' + (home.status === p[0] ? ' active' : '') + '" data-mf-status="' + p[0] + '">'
        + p[1] + '<span class="n">' + n[p[0]] + '</span></button>';
    });
    h += '</div>';

    // Topics a teacher can actually receive, or every topic for the admin.
    var topicKeys = Object.keys(TOPICS).filter(function (k) {
      return home.kind === 'admin' || TOPICS[k].to !== 'admin';
    });
    h += '<select class="ll-select" data-mf="topic" aria-label="Topic"><option value="">All topics</option>'
      + topicKeys.map(function (k) {
        return '<option value="' + k + '"' + (home.topic === k ? ' selected' : '') + '>' + esc(TOPICS[k].icon + ' ' + TOPICS[k].label) + '</option>';
      }).join('') + '</select>';

    if (home.kind === 'admin') {
      h += '<select class="ll-select" data-mf="to" aria-label="Sent to"><option value="">Sent to anyone</option>'
        + '<option value="teacher"' + (home.to === 'teacher' ? ' selected' : '') + '>Sent to teachers</option>'
        + '<option value="admin"' + (home.to === 'admin' ? ' selected' : '') + '>Sent to admin</option></select>';
    }

    var classes = [];
    docs.forEach(function (m) {
      var c = m.data.studentClass;
      if (c && classes.indexOf(c) === -1) classes.push(c);
    });
    classes.sort();
    if (classes.length > 1) {
      h += '<select class="ll-select" data-mf="cls" aria-label="Class"><option value="">All classes</option>'
        + classes.map(function (c) {
          return '<option value="' + esc(c) + '"' + (home.cls === c ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('') + '</select>';
    }

    var shown = visible(home).length;
    h += '<span class="msg-count">' + shown + (shown === 1 ? ' message' : ' messages') + '</span></div>';
    return h;
  }

  function lineHtml(r) {
    var staff = r.authorRole === 'teacher' || r.authorRole === 'admin';
    var by = staff ? staffName({ name: r.authorName, role: r.authorRole }) : (r.authorName || 'Student') + ' (Student)';
    return '<div class="msg-line ' + (staff ? 'is-staff' : 'is-student') + '"><div class="msg-bubble">'
      + '<span class="msg-by">' + esc(by) + '</span>' + esc(r.text)
      + '<span class="msg-at">' + esc(ago(r.createdAt)) + '</span></div></div>';
  }

  function cardHtml(home, m) {
    var d = m.data;
    var id = m.id;
    var answered = stateOf(d) === 'answered';
    var t = TOPICS[d.topic] || { icon: '💬', label: 'Message' };
    var expanded = !!home.open[id];
    // Written on the sign-in page, with no account: the name and email are
    // whatever was typed, so staff are told before they rely on either.
    var fromSignin = d.source === 'signin';

    var sub = [d.studentClass, d.level, d.module].filter(Boolean).map(esc);
    if (d.email) sub.push(esc(d.email));
    var who = esc(d.name || '(no name)') + (sub.length ? ' <small>' + sub.join(' &middot; ') + '</small>' : '');

    var tags = '<span class="msg-tag">' + esc(t.icon + ' ' + t.label) + '</span>';
    if (home.kind === 'admin') {
      var toT = toOf(d) === 'teacher';
      tags += '<span class="msg-tag ' + (toT ? 'to-teacher' : 'to-admin') + '">' + (toT ? 'To teacher' : 'To admin') + '</span>';
    }
    if (fromSignin) tags += '<span class="msg-tag from-signin">Sign-in page</span>';
    if (d.when && WHENS[d.when]) tags += '<span class="msg-tag">Happened ' + esc(WHENS[d.when]) + '</span>';
    // On a teacher's Overview card, a bare page name ("student-dashboard.html")
    // tells the teacher nothing and cost a whole row of tags on a phone; the
    // device line (a technical report) still shows, and the admin sees both.
    var attachPage = home.kind === 'teacher' && !d.device ? '' : d.page;
    if (d.device || attachPage) tags += '<span class="msg-tag">📎 ' + esc([d.device, attachPage].filter(Boolean).join(' · ')) + '</span>';

    var state = answered
      // The name only when it was recorded: the first version of the inbox
      // closed messages without one, and "Answered by staff" read as a person.
      ? '<span class="msg-state is-answered">✓ Answered' + (d.answeredBy ? ' by ' + esc(staffName(d.answeredBy)) : '')
        + (d.answeredAt ? ' &middot; ' + esc(ago(d.answeredAt)) : '') + '</span>'
      : '<span class="msg-state is-open">● Waiting for an answer</span>';
    var count = d.replyCount ? ' &middot; ' + d.replyCount + (d.replyCount === 1 ? ' reply' : ' replies') : '';

    var h = '<div class="msg-card ' + (answered ? 'is-answered' : 'is-open') + (expanded ? ' is-expanded' : '') + '" data-id="' + esc(id) + '">'
      + '<div class="msg-top"><div class="msg-who">' + who + '</div>'
      + '<div class="msg-when">' + esc(ago(d.createdAt)) + '</div></div>'
      + '<div class="msg-tags">' + tags + '</div>'
      + (fromSignin ? '<div class="msg-note">Name and email were typed on the sign-in page, not checked against an account.</div>' : '')
      + '<div class="msg-body">' + esc(d.message || '') + '</div>'
      + '<div class="msg-foot"><span>' + state + '<span class="msg-state">' + count + '</span></span>'
      + '<button type="button" class="msg-btn" data-mf-toggle="' + esc(id) + '">'
      + (expanded ? 'Close' : (answered ? 'Open thread' : 'Open and answer')) + '</button></div>';

    if (expanded) {
      var reps = home.replies[id];
      h += '<div class="msg-thread">';
      if (!reps) h += '<div class="msg-empty">Loading the thread…</div>';
      else if (!reps.length) h += '<div class="msg-at">No answers yet.</div>';
      else h += reps.map(lineHtml).join('');
      // The draft is put back on every render. The card is rebuilt when the
      // thread arrives, on a filter change and after every action, and each
      // rebuild used to throw away whatever the teacher had started typing.
      // A sign-in page message has no account to answer INTO yet: the answer
      // is read in Messages & help once they sign in with the typed email.
      var ph = fromSignin
        ? 'Write your answer. They will see it in Messages & help when they sign in with ' + (d.email || 'their email') + '.'
        : 'Write your answer to ' + firstName(d.name) + '. They will see it in the app, with your name.';
      h += '<textarea class="msg-input" data-mf-text="' + esc(id) + '" maxlength="2000" '
        + 'placeholder="' + esc(ph) + '">'
        + esc(home.drafts[id] || '') + '</textarea>'
        + '<div class="msg-actions">'
        + (answered
          ? '<button type="button" class="msg-btn" data-mf-reopen="' + esc(id) + '">Mark as waiting</button>'
          : '<button type="button" class="msg-btn" data-mf-done="' + esc(id) + '">Mark answered without a reply</button>')
        + '<button type="button" class="msg-btn primary" data-mf-reply="' + esc(id) + '">Send answer</button>'
        + '</div><div class="msg-err" hidden></div></div>';
    }
    return h + '</div>';
  }

  // The teacher's Overview card shows this many, newest first, and a
  // "Show N more" button for the rest. It sits right under the numbers now, and
  // on a phone the list has no height cap, so a teacher with a dozen waiting
  // messages scrolled past all of them before reaching Needs Attention
  // (2026-09-24 review). Two on a phone, where each card is taller. The
  // admin's own inbox page is not capped.
  function compactLimit() {
    try { return window.matchMedia('(max-width: 768px)').matches ? 2 : 3; } catch (e) { return 3; }
  }

  function render(home) {
    if (!home || !home.el) return;
    // A full render is a fresh look at the filters: nothing is held over.
    home.keep = {};
    var all = visible(home);
    var shown = all;
    var more = '';
    var limit = compactLimit();
    if (home.kind === 'teacher' && all.length > limit) {
      if (home.showAll) {
        more = '<button type="button" class="msg-btn msg-more" data-mf-less>Show fewer</button>';
      } else {
        // An open card stays on screen even past the limit.
        shown = all.filter(function (m, i) { return i < limit || home.open[m.id]; });
        var rest = all.length - shown.length;
        if (rest > 0) more = '<button type="button" class="msg-btn msg-more" data-mf-more>Show ' + rest + ' more</button>';
      }
    }
    var list = shown.length
      ? shown.map(function (m) { return cardHtml(home, m); }).join('') + more
      : '<div class="msg-empty">' + (home.docs && home.docs.length
          ? 'Nothing matches these filters.'
          : (home.kind === 'admin'
            ? 'No messages yet. Students send them from "Messages & help" in their profile menu.'
            : 'No messages from your students yet. They send them from "Messages & help" in their profile menu.'))
        + '</div>';
    home.el.innerHTML = barHtml(home) + '<div class="msg-list">' + list + '</div>';
  }

  // One card only. Re-rendering the whole list after an answer would, under
  // the "Waiting" filter, make the card vanish the moment it was answered -
  // before the teacher has even seen that it went.
  function renderCard(home, id) {
    var m = find(home, id);
    var el = home.el.querySelector('.msg-card[data-id="' + cssEsc(id) + '"]');
    if (!m || !el) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = cardHtml(home, m);
    el.parentNode.replaceChild(tmp.firstChild, el);
    // The counts in the bar move too.
    var bar = home.el.querySelector('.msg-bar');
    if (bar) {
      var fresh = document.createElement('div');
      fresh.innerHTML = barHtml(home);
      bar.parentNode.replaceChild(fresh.firstChild, bar);
    }
    publishCount(home);
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function find(home, id) {
    var out = null;
    (home.docs || []).forEach(function (m) { if (m.id === id) out = m; });
    return out;
  }
  function cardErr(home, id, text) {
    var el = home.el.querySelector('.msg-card[data-id="' + cssEsc(id) + '"] .msg-err');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  // ── actions ────────────────────────────────────────────────────────────
  function loadReplies(home, id) {
    var fs = fdb();
    if (!fs) return;
    fs.collection(COLL).doc(id).collection('replies').orderBy('createdAt').get().then(function (snap) {
      home.replies[id] = snap.docs.map(function (d) { return d.data(); });
      if (home.open[id]) renderCard(home, id);
    }).catch(function (e) {
      home.replies[id] = [];
      if (home.open[id]) { renderCard(home, id); cardErr(home, id, 'Could not load the thread: ' + ((e && e.message) || e)); }
    });
  }

  function answer(home, id, btn) {
    var m = find(home, id);
    var ta = home.el.querySelector('[data-mf-text="' + cssEsc(id) + '"]');
    var text = ((ta && ta.value) || '').trim();
    if (!m) return;
    if (!text) { cardErr(home, id, 'Write the answer first.'); return; }
    var who = me();
    var fs = fdb();
    if (!who.uid || !fs) { cardErr(home, id, 'You are not signed in. Reload the page.'); return; }

    var FV = firebase.firestore.FieldValue;
    var ref = fs.collection(COLL).doc(id);
    var by = { name: who.name, email: who.email, role: who.role };
    // The reply and the bookkeeping in ONE batch, so the student's list can
    // never say "answered" without the answer being there, or the reverse.
    var batch = fs.batch();
    batch.set(ref.collection('replies').doc(), {
      text: text,
      authorUid: who.uid,
      authorName: who.name,
      authorEmail: who.email,
      authorRole: who.role,
      createdAt: FV.serverTimestamp()
    });
    batch.update(ref, {
      status: 'answered',
      answeredBy: by,
      answeredAt: FV.serverTimestamp(),
      lastReplyAt: FV.serverTimestamp(),
      studentUnread: true,
      replyCount: FV.increment(1)
    });
    btn.disabled = true;
    btn.textContent = 'Sending…';
    batch.commit().then(function () {
      home.keep[id] = true;
      m.data.status = 'answered';
      m.data.answeredBy = by;
      m.data.answeredAt = null;             // reads as "just now"
      m.data.lastReplyAt = null;
      m.data.studentUnread = true;
      m.data.replyCount = (m.data.replyCount || 0) + 1;
      delete home.drafts[id];               // sent: nothing left to restore
      home.replies[id] = (home.replies[id] || []).concat([{
        text: text, authorName: who.name, authorRole: who.role, createdAt: null
      }]);
      renderCard(home, id);
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Send answer';
      cardErr(home, id, 'Could not send: ' + ((e && e.message) || e));
    });
  }

  function setStatus(home, id, to, btn) {
    var m = find(home, id);
    var fs = fdb();
    if (!m || !fs) return;
    var FV = firebase.firestore.FieldValue;
    var patch = { status: to };
    var who = me();
    if (to === 'answered') {
      patch.answeredBy = { name: who.name, email: who.email, role: who.role };
      patch.answeredAt = FV.serverTimestamp();
    }
    btn.disabled = true;
    fs.collection(COLL).doc(id).update(patch).then(function () {
      home.keep[id] = true;
      m.data.status = to;
      if (patch.answeredBy) { m.data.answeredBy = patch.answeredBy; m.data.answeredAt = null; }
      renderCard(home, id);
    }).catch(function (e) {
      btn.disabled = false;
      cardErr(home, id, 'Could not update: ' + ((e && e.message) || e));
    });
  }

  // ── events: delegated, because every render replaces the markup ─────────
  function homeFor(target) {
    var box = target && target.closest ? target.closest('[data-msgbox]') : null;
    return box ? homes[box.getAttribute('data-msgbox')] : null;
  }

  document.addEventListener('click', function (e) {
    var home = homeFor(e.target);
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!home || !b) return;
    if (b.hasAttribute('data-mf-status')) {
      home.status = b.getAttribute('data-mf-status');
      home.showAll = false;
      render(home);
      return;
    }
    if (b.hasAttribute('data-mf-more')) { home.showAll = true; render(home); return; }
    if (b.hasAttribute('data-mf-less')) { home.showAll = false; render(home); return; }
    var id;
    if ((id = b.getAttribute('data-mf-toggle'))) {
      home.open[id] = !home.open[id];
      // FRESH every time it is opened, not once per page. The cached copy
      // hid a student's follow-up until the whole page was reloaded, because
      // re-opening the card showed the thread as it was the first time. One
      // small query per open is the price of never answering a stale thread.
      if (home.open[id]) delete home.replies[id];
      renderCard(home, id);
      if (home.open[id]) loadReplies(home, id);
      if (home.open[id]) {
        var ta = home.el.querySelector('[data-mf-text="' + cssEsc(id) + '"]');
        if (ta) { try { ta.focus({ preventScroll: true }); } catch (_) {} }
        // Bring the opened card into view. In the Overview card the list
        // scrolls inside a short box on a laptop, and the reply box of a card
        // near its foot used to sit below it, out of sight.
        var card = home.el.querySelector('.msg-card[data-id="' + cssEsc(id) + '"]');
        if (card && card.scrollIntoView) { try { card.scrollIntoView({ block: 'nearest' }); } catch (_) {} }
      }
      return;
    }
    if ((id = b.getAttribute('data-mf-reply')))  { answer(home, id, b); return; }
    if ((id = b.getAttribute('data-mf-done')))   { setStatus(home, id, 'answered', b); return; }
    if ((id = b.getAttribute('data-mf-reopen'))) { setStatus(home, id, 'open', b); return; }
  });

  document.addEventListener('input', function (e) {
    var ta = e.target;
    if (!ta || !ta.matches || !ta.matches('textarea[data-mf-text]')) return;
    var home = homeFor(ta);
    if (home) home.drafts[ta.getAttribute('data-mf-text')] = ta.value;
  });

  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel || !sel.matches || !sel.matches('select[data-mf]')) return;
    var home = homeFor(sel);
    if (!home) return;
    home[sel.getAttribute('data-mf')] = sel.value;
    home.showAll = false;
    render(home);
  });

  // ── admin: loaded when Admin > Messages is opened ───────────────────────
  // The unread badge on that sub-tab is worth having before it is opened, so
  // one load runs when Admin itself is opened.
  document.addEventListener('click', function (e) {
    if (!amAdmin()) return;
    var t = e.target.closest ? e.target.closest('[data-target="messagesPanel"]') : null;
    if (t) { load(mount('admin')); return; }
    var a = e.target.closest ? e.target.closest('[data-tab="admin"]') : null;
    if (a) {
      var h = mount('admin');
      if (h && !h.docs) setTimeout(function () { load(h); }, 300);
    }
  });
  window.loadSupportMessages = function () { if (amAdmin()) load(mount('admin')); };

  // ── teacher: the Overview card, shown only to a non-admin teacher ────────
  // Waits for config.js to have the teacher's own document, because the scope
  // (classes / year / module) is what decides both whether the card appears
  // and which messages it asks for.
  var waited = 0;
  function start() {
    var u = user();
    var d = profileDoc();
    if (!u || !d) {
      if (++waited <= 300) setTimeout(start, 400);   // up to two minutes on a slow link
      return;
    }
    if (amAdmin()) return;                           // Admin > Messages is theirs
    if (d.role !== 'teacher' || !hasScope(scope())) return;
    // DEMO LOGINS NEVER SEE REAL STUDENTS' MESSAGES. demo.teacher@fsm.edu.tr
    // was found assigned to B125, a real class - so the stakeholder login would
    // have shown real students' messages on this card. firestore.rules refuses
    // the read for a demo account as well; this just keeps the card away
    // instead of showing an error.
    if (d.demoAccount === true) return;
    var panel = document.getElementById('t2messagesPanel');
    var home = mount('teacher');
    if (!panel || !home) return;
    panel.hidden = false;
    home.el.classList.add('is-compact');
    load(home);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // For the harness and the gates, not for pages.
  window.MessagesInbox = { TOPICS: TOPICS, WHENS: WHENS, RECIPIENTS: RECIPIENTS, homes: homes, load: load, mount: mount };
})();
