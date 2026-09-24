/* ============================================================
   APP RATING - "Rate Lingualab"
   ------------------------------------------------------------
   One small form, shared by both sides of the app:
     students  the profile menu row "Rate Lingualab" (js/profile-hub.js)
     teachers  the sidebar item "Rate Lingualab" (teacher-dashboard.html)
   Answers are read ONLY by the admin, in Admin > Feedback
   (teacher/js/feedback-admin.js). The form says so, because people rate
   more honestly when they know who will read it.

   ONE RATING PER PERSON, kept at appFeedback/{uid}. Opening the form again
   shows what you said last time, and saving replaces it - so the average is
   one voice per person, not whoever taps most.

   Stars 1-5, optional "what helps you most" chips (different lists for
   students and teachers), optional comment. The chip keys are mirrored in
   firestore.rules; tools/app-feedback-check.js fails if they drift.

   Demo accounts get no form: the rules refuse their write, and a
   stakeholder demo must not put ratings into the real numbers.
   ============================================================ */
(function () {
  'use strict';
  if (window.AppRating) return;

  var COLL = 'appFeedback';
  var STYLE_ID = 'ar-style';

  // [key, icon, label]. Keys are stored; labels are what people see.
  var LIKES = {
    student: [
      ['vocabulary', '📚', 'Vocabulary'],
      ['grammar',    '✏️', 'Grammar'],
      ['listening',  '🎧', 'Listening'],
      ['reading',    '📖', 'Reading'],
      ['writing',    '✍️', 'Writing'],
      ['speaking',   '🎤', 'Speaking'],
      ['classroom',  '🎮', 'Class games'],
      ['courses',    '🎓', 'Courses'],
      // Shown to every student, like the toggleable chips above: the toggle
      // and placement state only exist on the dashboard, and a student who
      // took the test can still credit it after placement is switched off.
      ['placement',  '🎯', 'Placement']
    ],
    teacher: [
      ['assignments', '📋', 'Assignments'],
      ['progress',    '📈', 'Student progress'],
      ['classroom',   '🎮', 'Class games'],
      ['writingai',   '🤖', 'Writing AI'],
      ['placement',   '🎯', 'Placement'],
      ['reports',     '📊', 'Reports']
    ]
  };
  var WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

  var state = { stars: 0, liked: [], existing: null, saving: false, user: null };

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
  function user() {
    try { return firebase.auth().currentUser; } catch (e) { return null; }
  }
  // The student pages publish window.currentStudentData; the teacher dashboard
  // keeps its user document in a top-level `let currentUserData` in
  // teacher/js/config.js, visible by name but not as a window property.
  function userDoc() {
    if (window.currentStudentData) return window.currentStudentData;
    try { if (typeof currentUserData !== 'undefined' && currentUserData) return currentUserData; } catch (e) {}
    return null;
  }
  // The document to use for THIS opening of the form: the page's own copy when
  // it has one, else the one open() read for itself.
  function currentDoc() { return state.user || userDoc(); }
  function roleOf(d) { return d && d.role === 'teacher' ? 'teacher' : 'student'; }
  function isDemo(d) { return !!(d && d.demoAccount === true); }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      // Above the profile hub's own layers, which it opens from.
      '.ar-layer{z-index:20000 !important;}',
      // .ll-dialog in css/brand.css carries shape and motion only; the colour
      // is this card's own, from the page's theme tokens.
      '#arLayer .ll-dialog.ar-card{width:min(500px,calc(100vw - 16px));max-width:min(500px,calc(100vw - 16px));',
      '  position:relative;text-align:left;background:var(--bg-card,#fff);color:var(--text-primary,#0f172a);',
      '  border:1px solid var(--border-color,rgba(59,130,246,.25));box-shadow:0 24px 70px rgba(0,0,0,.28);',
      '  max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow-y:auto;overscroll-behavior:contain;}',
      '.ar-x{position:absolute;top:10px;right:12px;width:36px;height:36px;border-radius:50%;border:0;',
      '  background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;opacity:.7;}',
      '.ar-x:hover{opacity:1;background:var(--bg-item,rgba(148,163,184,.18));}',
      '.ar-title{margin:0 0 4px;font-size:1.2rem;font-weight:800;}',
      '.ar-sub{margin:0 0 16px;font-size:.9rem;opacity:.8;line-height:1.45;}',
      '.ar-stars{display:flex;justify-content:center;gap:6px;margin:4px 0 2px;}',
      // 44px: a star is a tap target on a phone, not a decoration.
      '.ar-star{width:48px;height:48px;border:0;background:transparent;cursor:pointer;font-size:38px;line-height:1;',
      '  color:var(--border-color,#cbd5e1);transition:transform .12s;padding:0;}',
      '.ar-star.is-on{color:#f59e0b;}',
      '.ar-star:hover,.ar-star:focus-visible{transform:scale(1.12);outline:none;}',
      '.ar-star:focus-visible{text-shadow:0 0 0 3px rgba(37,99,235,.4);}',
      '.ar-word{text-align:center;font-weight:700;font-size:.95rem;min-height:1.4em;margin-bottom:14px;}',
      '.ar-q{display:block;font-weight:700;font-size:.92rem;margin:0 0 8px;}',
      '.ar-q small{font-weight:500;opacity:.7;}',
      '.ar-likes{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;}',
      '.ar-like{padding:7px 12px;border-radius:999px;cursor:pointer;font:inherit;font-size:.88rem;font-weight:600;',
      '  color:inherit;background:transparent;border:1.5px solid var(--border-color,rgba(59,130,246,.3));}',
      '.ar-like[aria-pressed="true"]{background:var(--accent-primary,#2563eb);border-color:var(--accent-primary,#2563eb);color:#fff;}',
      '.ar-input{width:100%;box-sizing:border-box;min-height:100px;resize:vertical;padding:11px 13px;border-radius:12px;',
      '  font:inherit;font-size:.95rem;line-height:1.45;color:inherit;background:var(--bg-item,rgba(120,120,150,.08));',
      '  border:1px solid var(--border-color,rgba(120,120,150,.35));}',
      '.ar-input:focus{outline:2px solid var(--accent-primary,#2563eb);outline-offset:1px;}',
      '.ar-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;}',
      '.ar-count{font-size:.8rem;opacity:.6;font-variant-numeric:tabular-nums;}',
      '.ar-send{padding:10px 22px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:700;',
      '  color:#fff;background:var(--accent-primary,#2563eb);}',
      '.ar-send:disabled{opacity:.5;cursor:default;}',
      '.ar-note{font-size:.82rem;opacity:.7;margin-top:10px;}',
      '.ar-err{margin-top:10px;padding:9px 12px;border-radius:10px;font-size:.88rem;background:rgba(239,68,68,.12);color:#b91c1c;}',
      '.ar-err[hidden]{display:none !important;}',
      '.ar-done{text-align:center;padding:10px 0 4px;}',
      '.ar-done .ar-big{font-size:2.2rem;letter-spacing:2px;color:#f59e0b;}',
      '@media (max-width:520px){',
      '  #arLayer .ll-dialog.ar-card{padding:22px 16px 16px;}',
      '  .ar-star{width:44px;height:44px;font-size:34px;}',
      // 16px stops iPhone Safari zooming the page when the box is tapped.
      '  .ar-input{font-size:16px;}',
      '}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function layer() {
    var ov = document.getElementById('arLayer');
    if (ov) return ov;
    injectStyle();
    ov = document.createElement('div');
    ov.id = 'arLayer';
    ov.className = 'modal-overlay ar-layer';
    ov.innerHTML = '<div class="ll-dialog ll-dialog-toggle ar-card" role="dialog" aria-modal="true" aria-labelledby="arTitle">'
      + '<button type="button" class="ar-x" aria-label="Close">×</button><div id="arBody"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || (e.target.closest && e.target.closest('.ar-x'))) { close(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.hasAttribute('data-ar-star')) { setStars(parseInt(b.getAttribute('data-ar-star'), 10)); return; }
      if (b.hasAttribute('data-ar-like')) { toggleLike(b); return; }
      if (b.hasAttribute('data-ar-send')) { save(b); return; }
      if (b.hasAttribute('data-ar-again')) { renderForm(); return; }
    });
    // Hovering previews a rating; leaving shows the chosen one again.
    ov.addEventListener('mouseover', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ar-star]') : null;
      if (b) paintStars(parseInt(b.getAttribute('data-ar-star'), 10));
    });
    ov.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('.ar-stars')) paintStars(state.stars);
    });
    ov.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'arComment') {
        var c = document.getElementById('arCount');
        if (c) c.textContent = e.target.value.length + ' / 1000';
      }
    });
    // WINDOW capture: runs before the profile hub's document-capture Escape
    // handler, which would otherwise close the panel UNDER this form (and
    // unlock the page scroll) while the form stayed open.
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !ov.classList.contains('active')) return;
      close();
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }, true);
    return ov;
  }

  function close() {
    var ov = document.getElementById('arLayer');
    if (ov) ov.classList.remove('active');
  }

  function paintStars(n) {
    var stars = document.querySelectorAll('#arBody [data-ar-star]');
    for (var i = 0; i < stars.length; i++) {
      var v = i + 1;
      stars[i].classList.toggle('is-on', v <= n);
      stars[i].setAttribute('aria-checked', v === state.stars ? 'true' : 'false');
    }
    var w = document.getElementById('arWord');
    if (w) w.textContent = n ? WORDS[n] : 'Tap a star';
  }
  function setStars(n) {
    state.stars = n;
    paintStars(n);
    var send = document.querySelector('#arBody [data-ar-send]');
    if (send) send.disabled = !n || state.saving;
  }
  function toggleLike(b) {
    var k = b.getAttribute('data-ar-like');
    var i = state.liked.indexOf(k);
    if (i === -1) state.liked.push(k); else state.liked.splice(i, 1);
    b.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
  }

  function renderForm() {
    var d = currentDoc();
    var role = roleOf(d);
    var ex = state.existing;
    var when = ex && ex.updatedAt && ex.updatedAt.toDate ? ex.updatedAt.toDate().toLocaleDateString() : '';
    var h = '<h3 class="ar-title" id="arTitle">⭐ Rate Lingualab</h3>'
      + '<p class="ar-sub">How is Lingualab working for you? Only the Lingualab admin sees your answer.</p>'
      + '<div class="ar-stars" role="radiogroup" aria-label="Your rating">';
    for (var i = 1; i <= 5; i++) {
      h += '<button type="button" class="ar-star" role="radio" aria-checked="false" data-ar-star="' + i + '" '
        + 'aria-label="' + i + (i === 1 ? ' star' : ' stars') + ' - ' + WORDS[i] + '">★</button>';
    }
    h += '</div><div class="ar-word" id="arWord" aria-live="polite">Tap a star</div>'
      + '<div class="ar-q">' + (role === 'teacher' ? 'What do you use most?' : 'What helps you most?')
      + ' <small>(optional - choose any)</small></div><div class="ar-likes">'
      + LIKES[role].map(function (c) {
        var on = state.liked.indexOf(c[0]) !== -1;
        return '<button type="button" class="ar-like" data-ar-like="' + c[0] + '" aria-pressed="' + on + '">'
          + esc(c[1] + ' ' + c[2]) + '</button>';
      }).join('')
      + '</div><label class="ar-q" for="arComment">Anything you would like to tell us? <small>(optional)</small></label>'
      + '<textarea id="arComment" class="ar-input" maxlength="1000" placeholder="What do you like? What should we improve?">'
      + esc((ex && ex.comment) || '') + '</textarea>'
      + '<div class="ar-foot"><span class="ar-count" id="arCount">' + (((ex && ex.comment) || '').length) + ' / 1000</span>'
      + '<button type="button" class="ar-send" data-ar-send disabled>' + (ex ? 'Update my rating' : 'Send rating') + '</button></div>'
      + (ex ? '<div class="ar-note">You rated Lingualab' + (when ? ' on ' + esc(when) : '') + '. Saving again replaces it.</div>' : '')
      + '<div class="ar-err" id="arErr" hidden></div>';
    document.getElementById('arBody').innerHTML = h;
    setStars(state.stars);
  }

  function renderDone() {
    var n = state.stars;
    document.getElementById('arBody').innerHTML = '<div class="ar-done">'
      + '<h3 class="ar-title" id="arTitle">Thank you!</h3>'
      + '<div class="ar-big" aria-label="' + n + ' stars">' + new Array(n + 1).join('★') + '</div>'
      + '<p class="ar-sub">Your rating is saved. You can change it any time from here.</p>'
      + '<button type="button" class="ar-send" data-ar-again>Change my rating</button></div>';
  }

  function showErr(t) {
    var e = document.getElementById('arErr');
    if (!e) return;
    e.textContent = t;
    e.hidden = !t;
  }

  function save(btn) {
    var u = user(), d = currentDoc(), fs = fdb();
    if (!state.stars) return;
    if (!u || !fs) { showErr('You are not signed in. Reload the page and try again.'); return; }
    if (!d) { showErr('Could not load your account. Check your connection and open this again.'); return; }
    var role = roleOf(d);
    var allowed = LIKES[role].map(function (c) { return c[0]; });
    var FV = firebase.firestore.FieldValue;
    var ta = document.getElementById('arComment');
    var data = {
      userId: u.uid,
      role: role,
      name: String(d.name || d.displayName || u.displayName || (u.email || '').split('@')[0] || '').slice(0, 100),
      email: u.email || '',
      studentClass: String(d.studentClass || '').slice(0, 40),
      level: String(d.level || '').slice(0, 40),
      module: String(d.module || '').slice(0, 60),
      stars: state.stars,
      liked: state.liked.filter(function (k) { return allowed.indexOf(k) !== -1; }),
      comment: ((ta && ta.value) || '').trim().slice(0, 1000),
      page: String((location.pathname || '').split('/').pop() || 'home').slice(0, 200),
      updatedAt: FV.serverTimestamp()
    };
    var ref = fs.collection(COLL).doc(u.uid);
    // Create or update is decided INSIDE a transaction, from the document as it
    // is now. Deciding from what open() read failed whenever that read had
    // failed (weak signal) or a second tab rated first: the form thought there
    // was no rating, sent a create with a new createdAt, and the rules - which
    // keep the first rating's date - refused every retry.
    var write = fs.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        if (snap.exists) {
          tx.update(ref, data);                  // createdAt stays what it was
        } else {
          tx.set(ref, Object.assign({}, data, { createdAt: FV.serverTimestamp() }));
        }
      });
    });
    state.saving = true;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    showErr('');
    write.then(function () {
      state.saving = false;
      state.existing = Object.assign({}, state.existing || {}, data, { updatedAt: null });
      renderDone();
    }).catch(function (e) {
      state.saving = false;
      btn.disabled = false;
      btn.textContent = state.existing ? 'Update my rating' : 'Send rating';
      showErr('Could not save that. Check your connection and try again.' + (e && e.code ? ' (' + e.code + ')' : ''));
    });
  }

  function open() {
    var u = user(), d = userDoc();
    if (!u || u.isAnonymous) return;
    if (isDemo(d)) return;                       // the rules refuse it anyway
    var ov = layer();
    state = { stars: 0, liked: [], existing: null, saving: false, user: d || null };
    document.getElementById('arBody').innerHTML = '<p class="ar-sub" style="padding:24px 0;text-align:center;">Loading...</p>';
    ov.classList.add('active');
    var fs = fdb();
    if (!fs) { renderForm(); return; }
    var mine = state;
    var reads = [fs.collection(COLL).doc(u.uid).get()];
    // Courses, Policy course and Placement load neither student/js/auth.js nor
    // teacher/js/config.js, so NO page variable holds the user's document there
    // - and save() used to refuse with "You are not signed in" on all three,
    // every time (found by review, 2026-09-23). Read it here instead: one
    // document, only on those pages.
    if (!d) reads.push(fs.collection('users').doc(u.uid).get());
    Promise.all(reads.map(function (p) { return p.catch(function () { return null; }); })).then(function (res) {
      if (state !== mine) return;                // closed and reopened meanwhile
      var fb = res[0], ud = res[1];
      if (ud && ud.exists) {
        state.user = ud.data();
        if (isDemo(state.user)) { close(); return; }
      }
      // What they said last time, so the form is an edit and not a second vote.
      if (fb && fb.exists) {
        var x = fb.data();
        state.existing = x;
        state.stars = x.stars || 0;
        state.liked = Array.isArray(x.liked) ? x.liked.slice() : [];
      }
      renderForm();
    });
  }

  // The teacher dashboard's sidebar item: shown only to accounts that can
  // actually rate. Hidden until the user document is known, so a demo login
  // never sees it appear and vanish.
  function wireTeacherButton() {
    var btn = document.getElementById('t2RateBtn');
    if (!btn) return;
    var tries = 0;
    (function wait() {
      var d = userDoc();
      if (!d) { if (++tries <= 120) setTimeout(wait, 500); return; }
      btn.style.display = isDemo(d) ? 'none' : '';
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireTeacherButton);
  else wireTeacherButton();

  window.AppRating = {
    open: open,
    // For the profile hub: whether to offer the row at all.
    available: function () { var d = userDoc(); return !isDemo(d); },
    LIKES: LIKES
  };
})();
