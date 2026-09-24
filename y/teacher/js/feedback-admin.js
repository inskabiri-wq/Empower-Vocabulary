/* ============================================================
   FEEDBACK - Admin > Feedback, the "Rate Lingualab" answers
   ------------------------------------------------------------
   Students rate from their profile menu, teachers from the sidebar
   (js/app-rating.js). One rating per person at appFeedback/{uid}; rating
   again replaces it. Only the admin can read these (firestore.rules), and
   this panel is only built for the admin.

   What it shows:
     - the average, how many people rated, and the 5-to-1 star breakdown
     - students and teachers separately, because they rate different things
     - which parts people value most (the "what helps you most" chips)
     - every rating, newest first, with who wrote it - filterable by role,
       by stars, and to only those with a written comment

   Read on demand when the tab is opened, never streamed. No export here:
   exports live in Admin > Reports only.
   ============================================================ */
(function () {
  'use strict';

  var COLL = 'appFeedback';
  var WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  var st = { docs: null, role: '', stars: '', withComment: false, loading: false };

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
  function box() { return document.querySelector('[data-feedback-admin]'); }

  // Chip labels come from js/app-rating.js, so a chip renamed there is renamed
  // here too. The fallback only matters if that script failed to load.
  function likeLabel(key) {
    var L = (window.AppRating && window.AppRating.LIKES) || {};
    var all = (L.student || []).concat(L.teacher || []);
    for (var i = 0; i < all.length; i++) if (all[i][0] === key) return all[i][1] + ' ' + all[i][2];
    return key;
  }
  function millis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    return 0;
  }
  function ago(ts) {
    var ms = millis(ts);
    if (!ms) return '';
    var mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    if (days < 14) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ms).toLocaleDateString();
  }
  function stars(n) {
    n = Math.max(0, Math.min(5, n | 0));
    return '<span class="fb-stars" aria-label="' + n + ' of 5 stars">'
      + new Array(n + 1).join('★') + '<span class="fb-off">' + new Array(6 - n).join('★') + '</span></span>';
  }
  function avg(list) {
    if (!list.length) return null;
    var s = 0;
    list.forEach(function (d) { s += d.stars || 0; });
    return Math.round((s / list.length) * 10) / 10;
  }

  function load() {
    var el = box();
    var fs = fdb();
    if (!el) return;
    if (!fs) { el.innerHTML = '<div class="fb-empty">Firestore is not ready yet. Reload the page.</div>'; return; }
    if (st.loading) return;
    st.loading = true;
    if (!st.docs) el.innerHTML = '<div class="fb-empty">Loading…</div>';
    fs.collection(COLL).orderBy('updatedAt', 'desc').limit(1000).get().then(function (snap) {
      st.loading = false;
      st.docs = snap.docs.map(function (d) { return d.data(); });
      render();
    }).catch(function (e) {
      st.loading = false;
      el.innerHTML = '<div class="fb-empty">Could not load feedback: ' + esc((e && e.message) || e) + '</div>';
    });
  }

  function render() {
    var el = box();
    if (!el || !st.docs) return;
    var all = st.docs;
    if (!all.length) {
      el.innerHTML = '<div class="fb-empty">No ratings yet. Students rate from their profile menu ("Rate Lingualab"); teachers from the sidebar.</div>';
      return;
    }
    var byRole = st.role ? all.filter(function (d) { return d.role === st.role; }) : all;
    var students = all.filter(function (d) { return d.role === 'student'; });
    var teachers = all.filter(function (d) { return d.role === 'teacher'; });

    // ── summary: of whoever the role filter shows ──
    var a = avg(byRole);
    var dist = [0, 0, 0, 0, 0, 0];
    byRole.forEach(function (d) { dist[d.stars || 0]++; });
    var h = '<div class="fb-summary">'
      + '<div class="fb-avg"><div class="fb-avg-n">' + (a == null ? '-' : a.toFixed(1)) + '</div>'
      + stars(Math.round(a || 0))
      + '<div class="fb-avg-sub">' + byRole.length + (byRole.length === 1 ? ' rating' : ' ratings') + '</div></div>'
      + '<div class="fb-dist">';
    for (var s = 5; s >= 1; s--) {
      var pct = byRole.length ? Math.round((dist[s] / byRole.length) * 100) : 0;
      h += '<div class="fb-row"><span class="fb-row-l">' + s + ' ★</span>'
        + '<span class="fb-bar"><span style="width:' + pct + '%"></span></span>'
        + '<span class="fb-row-n">' + dist[s] + '</span></div>';
    }
    h += '</div><div class="fb-split">'
      + '<div><b>Students</b><span>' + (avg(students) == null ? 'no ratings' : avg(students).toFixed(1) + ' ★ from ' + students.length) + '</span></div>'
      + '<div><b>Teachers</b><span>' + (avg(teachers) == null ? 'no ratings' : avg(teachers).toFixed(1) + ' ★ from ' + teachers.length) + '</span></div>'
      + '</div></div>';

    // ── what people value ──
    var counts = {};
    byRole.forEach(function (d) { (d.liked || []).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; }); });
    var top = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; });
    if (top.length) {
      h += '<div class="fb-valued"><div class="fb-h">What helps people most</div><div class="fb-chips">'
        + top.map(function (k) { return '<span class="fb-chip">' + esc(likeLabel(k)) + ' <b>' + counts[k] + '</b></span>'; }).join('')
        + '</div></div>';
    }

    // ── filters ──
    h += '<div class="fb-bar-f">'
      + '<select class="ll-select" data-fb="role" aria-label="Who"><option value="">Everyone</option>'
      + '<option value="student"' + (st.role === 'student' ? ' selected' : '') + '>Students</option>'
      + '<option value="teacher"' + (st.role === 'teacher' ? ' selected' : '') + '>Teachers</option></select>'
      + '<select class="ll-select" data-fb="stars" aria-label="Stars"><option value="">All ratings</option>';
    for (var k = 5; k >= 1; k--) h += '<option value="' + k + '"' + (String(st.stars) === String(k) ? ' selected' : '') + '>' + k + ' ★ - ' + WORDS[k] + '</option>';
    h += '</select><label class="fb-check"><input type="checkbox" data-fb="withComment"' + (st.withComment ? ' checked' : '') + '> Only with a comment</label>';

    var shown = byRole.filter(function (d) {
      if (st.stars && String(d.stars) !== String(st.stars)) return false;
      if (st.withComment && !String(d.comment || '').trim()) return false;
      return true;
    });
    h += '<span class="fb-count">' + shown.length + (shown.length === 1 ? ' rating' : ' ratings') + '</span></div>';

    // ── the ratings ──
    h += '<div class="fb-list">' + (shown.length ? shown.map(function (d) {
      var who = [d.studentClass, d.level, d.module].filter(Boolean).map(esc);
      if (d.email) who.push(esc(d.email));
      return '<div class="fb-card">'
        + '<div class="fb-top">' + stars(d.stars) + '<span class="fb-word">' + esc(WORDS[d.stars] || '') + '</span>'
        + '<span class="fb-when">' + esc(ago(d.updatedAt)) + '</span></div>'
        + '<div class="fb-who"><b>' + esc(d.name || '(no name)') + '</b>'
        + '<span class="fb-role fb-role-' + (d.role === 'teacher' ? 'teacher' : 'student') + '">' + (d.role === 'teacher' ? 'Teacher' : 'Student') + '</span>'
        + (who.length ? ' <small>' + who.join(' &middot; ') + '</small>' : '') + '</div>'
        + ((d.liked && d.liked.length) ? '<div class="fb-chips">' + d.liked.map(function (x) { return '<span class="fb-chip">' + esc(likeLabel(x)) + '</span>'; }).join('') + '</div>' : '')
        + (String(d.comment || '').trim() ? '<div class="fb-comment">' + esc(d.comment) + '</div>' : '')
        + '</div>';
    }).join('') : '<div class="fb-empty">Nothing matches these filters.</div>') + '</div>';

    el.innerHTML = h;
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('[data-feedback-admin]')) return;
    var k = t.getAttribute('data-fb');
    if (k === 'withComment') st.withComment = !!t.checked;
    else if (k === 'role' || k === 'stars') st[k] = t.value;
    render();
  });

  // Loaded each time the Feedback sub-tab is opened, admin only.
  document.addEventListener('click', function (e) {
    if (!amAdmin()) return;
    var b = e.target.closest ? e.target.closest('[data-target="feedbackPanel"]') : null;
    if (b) load();
  });

  window.FeedbackAdmin = { load: load };
})();
