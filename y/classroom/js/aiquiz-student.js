/* ============================================================
   AI QUIZ - student
   ------------------------------------------------------------
   Follows the teacher's question number. The phone never decides
   which question is showing; it reads `currentQuestion` from the
   session document and displays that one.

   COST PER STUDENT, PER QUESTION: exactly one write, to their own
   player document. Nothing is written per answer, so no history
   is kept and there is nothing to clean up afterwards.

   The questions are read ONCE, from their own document, not from
   the session document. The session document is what every phone
   in the room listens to, so it is kept to a few hundred bytes:
   the question number, the phase and the timer.

   SCORING is done on the phone: a flat score for a correct answer
   plus a bonus that decays as the clock runs down. That is the
   same trust model as the other classroom games, which is fine
   for a room where the teacher can see the screen, and it keeps
   the write to a single increment.
   ============================================================ */
(function () {
  'use strict';

  if (!window.firebase || !firebase.apps.length) {
    throw new Error('aiquiz-student: js/tenant.js + js/firebase-init.js must load first.');
  }
  var auth = firebase.auth();
  var db = firebase.firestore();

  var COLL = 'aiquiz_sessions';

  var me = null;
  var code = null;
  var myRef = null;
  var questions = null;        // read once
  var shownIndex = -1;
  var answeredIndex = -1;      // the last question this phone answered
  var myScore = 0;
  var sessionUnsub = null;
  var timerHandle = null;

  var $ = function (id) { return document.getElementById(id); };
  var currentView = 'join';
  var show = function (view) {
    currentView = view;
    ['join', 'wait', 'q', 'ladder'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.style.display = (v === view) ? '' : 'none';
    });
  };

  // ── TWO LANGUAGES ─────────────────────────────────────────────────────────
  // Every question and option is an { en, tr } pair in the bank, and those
  // pairs reach the phone already (meta/questions carries both). The teacher
  // picks the room's language on the setup screen - 'both', 'en' or 'tr' - and
  // this phone starts in it; the switch in the header lets a student choose
  // for themselves, remembered on this phone.
  //
  // A room made before this existed has no `lang`: treated as 'en', which is
  // exactly what it always showed. Before joining there is no room yet, so the
  // join screen shows both.
  //
  // Switching NEVER rebuilds the answer buttons - it only swaps their text -
  // so an answer already given, and its right/wrong colouring, is never lost.
  var LANG_KEY = 'aiq-lang';
  var sessionLang = null;
  var lastFeedback = null;          // { correct, gained } for the question on screen
  var ladderMode = null;            // 'between' | 'finished'

  var STR = {
    appTitle:     { en: 'AI Quiz', tr: 'YZ Testi' },
    joinTitle:    { en: 'Join the Quiz', tr: 'Teste katıl' },
    joinSub:      { en: 'Enter the session code from your teacher', tr: 'Öğretmeninizin verdiği oturum kodunu girin' },
    codeLabel:    { en: 'Session Code', tr: 'Oturum kodu' },
    nameLabel:    { en: 'Your Name', tr: 'Adınız' },
    namePh:       { en: 'e.g. Alex', tr: 'ör. Ayşe' },
    joinBtn:      { icon: '🎟️', en: 'Join Quiz', tr: 'Teste katıl' },
    joining:      { icon: '⏳', en: 'Joining...', tr: 'Katılınıyor...' },
    inTitle:      { en: "You're in!", tr: 'Katıldınız!' },
    waitStart:    { en: 'Waiting for your teacher to start the quiz...', tr: 'Öğretmeninizin testi başlatması bekleniyor...' },
    playingAs:    { en: 'Playing as', tr: 'Oyuncu adınız' },
    question:     { en: 'Question {n} of {t}', tr: 'Soru {n} / {t}' },
    module:       { en: 'Module {m}', tr: 'Modül {m}' },
    correct:      { en: 'Correct  +{p}', tr: 'Doğru  +{p}' },
    wrong:        { en: 'Not this time', tr: 'Bu sefer olmadı' },
    yourScore:    { icon: '🏆', en: 'Your score', tr: 'Puanınız' },
    waitNext:     { en: 'Waiting for the next question...', tr: 'Sonraki soru bekleniyor...' },
    finished:     { icon: '🏁', en: 'Finished', tr: 'Bitti' },
    lookBoard:    { en: 'Look at the board for the winners.', tr: 'Kazananlar için tahtaya bakın.' },
    errCode:      { en: 'Enter the session code.', tr: 'Oturum kodunu girin.' },
    errName:      { en: 'Enter your name.', tr: 'Adınızı girin.' },
    errConnecting:{ en: 'Still connecting - try again in a moment.', tr: 'Hâlâ bağlanıyor - birazdan tekrar deneyin.' },
    errNoQuiz:    { en: 'No quiz with that code.', tr: 'Bu kodla bir test yok.' },
    errFinished:  { en: 'That quiz has finished.', tr: 'Bu test bitti.' },
    errQuestions: { en: 'Could not load the questions. Check your connection and tap Join again.',
                    tr: 'Sorular yüklenemedi. Bağlantınızı kontrol edip tekrar Katıl düğmesine dokunun.' },
    errOffline:   { en: 'No connection right now. Check your wifi and tap Join again.',
                    tr: 'Şu anda bağlantı yok. Wi-Fi bağlantınızı kontrol edip tekrar Katıl düğmesine dokunun.' },
    errPerm:      { en: 'Could not join that quiz. Check the code and tap Join again.',
                    tr: 'Bu teste katılınamadı. Kodu kontrol edip tekrar Katıl düğmesine dokunun.' },
    errJoin:      { en: 'Could not join. Tap Join again.', tr: 'Katılınamadı. Tekrar Katıl düğmesine dokunun.' },
    errLost:      { en: 'Lost the connection to the quiz. Reload the page to rejoin.',
                    tr: 'Testle bağlantı koptu. Tekrar katılmak için sayfayı yenileyin.' },
    errAnon:      { en: 'Anonymous sign-in is disabled. Ask your teacher.', tr: 'Anonim giriş kapalı. Öğretmeninize sorun.' },
    errSignIn:    { en: 'Could not sign you in: ', tr: 'Giriş yapılamadı: ' }
  };

  function chosenLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (v === 'en' || v === 'tr' || v === 'both') return v;
    } catch (e) {}
    return null;
  }
  function lang() { return chosenLang() || sessionLang || 'both'; }

  // The phone's own words. With 'both', English then Turkish.
  function t(key, vars) {
    var e = STR[key];
    if (!e) return key;
    var l = lang();
    var text = l === 'tr' ? e.tr : (l === 'en' ? e.en : (e.en === e.tr ? e.en : e.en + ' / ' + e.tr));
    if (vars) Object.keys(vars).forEach(function (k) { text = text.split('{' + k + '}').join(String(vars[k])); });
    return (e.icon ? e.icon + ' ' : '') + text;
  }
  // A question or an option. With 'both', the Turkish on a quieter second line.
  function pairHtml(o) {
    if (o == null) return '';
    if (typeof o === 'string') return MG.escHtml(o);
    var l = lang();
    if (l === 'tr') return MG.escHtml(o.tr || o.en || '');
    if (l === 'en') return MG.escHtml(o.en || o.tr || '');
    var en = o.en || '', tr = o.tr || '';
    return MG.escHtml(en || tr) + (en && tr && tr !== en ? '<span class="aiq-tr">' + MG.escHtml(tr) + '</span>' : '');
  }

  // Repaint every word on screen in the current language, touching text only.
  function applyLang() {
    var l = lang();
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    if (!joining) setJoinBusy(false);
    Array.prototype.forEach.call(document.querySelectorAll('[data-aiq-lang]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-aiq-lang') === l ? 'true' : 'false');
    });
    document.documentElement.setAttribute('lang', l === 'tr' ? 'tr' : 'en');

    var q = questions && questions[shownIndex];
    if (currentView === 'q' && q) {
      $('qProgress').textContent = t('question', { n: shownIndex + 1, t: questions.length });
      $('qModule').textContent = q.module ? t('module', { m: String(q.module).replace(/^m/, '') }) : '';
      $('qText').innerHTML = pairHtml(q.q);
      Array.prototype.forEach.call(document.querySelectorAll('.aiq-answer'), function (b) {
        var k = parseInt(b.getAttribute('data-k'), 10);
        var label = b.querySelector('.aiq-label');
        if (label && q.options[k]) label.innerHTML = pairHtml(q.options[k]);
      });
      if (lastFeedback) {
        $('qFeedback').textContent = lastFeedback.correct ? t('correct', { p: lastFeedback.gained }) : t('wrong');
      }
    }
    if (currentView === 'ladder' && ladderMode) {
      $('ladderTitle').textContent = t(ladderMode === 'finished' ? 'finished' : 'yourScore');
      $('ladderNote').textContent = t(ladderMode === 'finished' ? 'lookBoard' : 'waitNext');
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-aiq-lang]') : null;
    if (!b) return;
    try { localStorage.setItem(LANG_KEY, b.getAttribute('data-aiq-lang')); } catch (err) {}
    applyLang();
  });

  // ANONYMOUS SIGN-IN, like every other mini-game here.
  //
  // The other seven join screens (bingo, heist, listening, reading, scramble,
  // trust, tug) all call signInAnonymously, and this one must match: an
  // orientation is exactly the case where a thousand people do not have
  // accounts yet, and sending them to a login page first would end the game
  // before it started.
  //
  // What that means for security: anyone holding the 5-character code can
  // join. The code is 5 characters from a 32-character alphabet, so guessing
  // one is impractical, and no history is kept, so there is nothing to steal.
  // It also means a score cannot be tied to a real student record, which is
  // the trade the other games already make.
  // STARTED ON PAGE LOAD, NOT ON THE JOIN BUTTON, AND RETRIED.
  //
  // A thousand phones scanning the same QR within a couple of minutes means a
  // thousand brand new anonymous accounts, and a hall full of people sits
  // behind a handful of shared campus addresses - which is the exact shape
  // Firebase Auth throttles. Two things follow.
  //
  // Signing in when the page OPENS spends the seconds the student takes to
  // read the screen and type their name, so a throttled attempt has room to
  // succeed before anyone presses Join. Doing it on the click put the whole
  // room's sign-ins into the same instant as the whole room's writes.
  //
  // And a refusal is retried with exponential backoff plus jitter. Without
  // the jitter every throttled phone would wait the same interval and come
  // back as one synchronised burst, which is how a queue turns into a
  // thundering herd.
  var authPromise = null;

  function ensureAuth() {
    if (auth.currentUser) { me = auth.currentUser; return Promise.resolve(); }
    if (!authPromise) authPromise = attemptAuth(0);
    return authPromise;
  }

  function attemptAuth(n) {
    return auth.signInAnonymously().then(function (cred) {
      me = cred.user;
    }).catch(function (e) {
      var c = (e && e.code) || '';
      if (c === 'auth/operation-not-allowed') {
        authPromise = null;
        MG.toast(t('errAnon'), 'error');
        return;
      }
      var retryable = c === 'auth/too-many-requests' ||
                      c === 'auth/network-request-failed' ||
                      c === 'auth/internal-error';
      if (retryable && n < 5) {
        // 0.8s, 1.6s, 3.2s, 6.4s, 12.8s, each plus up to a second of jitter.
        var wait = 800 * Math.pow(2, n) + Math.random() * 1000;
        return new Promise(function (go) { setTimeout(go, wait); })
          .then(function () { return attemptAuth(n + 1); });
      }
      authPromise = null;
      MG.toast(t('errSignIn') + (e.message || e), 'error');
    });
  }

  function boot() {
    // Music is BACK (2026-09-22). It was switched off for the orientation
    // because a multi-MB track per phone was the one thing the venue wifi
    // could not spare. The event ran, the wifi held, and he wants it back.
    if (window.MG && MG.setupMusic) MG.setupMusic();
    var u = auth.currentUser;
    var nameEl = $('nameInput');
    if (nameEl && !nameEl.value && u && u.displayName) nameEl.value = u.displayName;
    // A QR scan carries the code, so the student only types their name.
    var fromUrl = new URLSearchParams(location.search).get('code');
    if (fromUrl) $('codeInput').value = String(fromUrl).toUpperCase();
    show('join');
    // Get the account out of the way while they are still typing.
    ensureAuth();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  $('joinBtn').addEventListener('click', join);
  $('codeInput').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // THE ONE READ THAT MUST NOT FAIL QUIETLY.
  //
  // This used to be a single un-retried `.get()` in join(). One transient
  // failure on congested venue wifi left `questions` empty for the WHOLE
  // game, and renderQuestion's `if (!q) show('wait')` then parked that phone
  // on the waiting screen for ever: no error, no way back, and its session
  // listener kept working so everything looked connected. Reported live from
  // a room on 2026-09-21 as "some questions were not loading for some
  // phones". It is not a scale problem - it would do this with 20 students.
  //
  // Three attempts with backoff plus jitter, the same shape as attemptAuth
  // above and for the same reason: without the jitter every failing phone
  // retries in the same instant and the burst repeats.
  //
  // An empty `items` is treated as a failure, not as a valid empty quiz. A
  // quiz with no questions cannot be played, so there is nothing to lose by
  // retrying, and a document that has not finished replicating reads exactly
  // like that.
  async function readQuestions(ref) {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var qs = await ref.collection('meta').doc('questions').get();
        var items = (qs.exists && qs.data().items) || [];
        if (items.length) return items;
      } catch (e) { /* fall through and retry */ }
      if (attempt < 2) {
        var wait = 400 * Math.pow(2, attempt) + Math.random() * 300;
        await new Promise(function (go) { setTimeout(go, wait); });
      }
    }
    return [];
  }

  // WHAT A STUDENT IS TOLD WHEN JOINING FAILS.
  //
  // The SDK's own text is accurate and useless: "Failed to get document
  // because the client is offline" is not something a nineteen-year-old on a
  // phone in a crowded hall can act on. These say what to DO instead.
  function friendlyJoinError(e) {
    var msg = String((e && e.message) || e || '');
    if (/offline|network|unavailable|deadline|timeout/i.test(msg)) {
      return t('errOffline');
    }
    if (/permission|insufficient/i.test(msg)) {
      return t('errPerm');
    }
    return t('errJoin');
  }

  // ONE JOIN AT A TIME, AND THE BUTTON HAS TO SAY SO.
  //
  // join() is async and was fully re-entrant while the button gave no
  // feedback whatsoever. On half-open wifi - connected, routing, but nothing
  // coming back - Firestore takes about ten seconds to give up, and for all
  // of that the button looks completely dead. A student taps it again. And
  // again. Each tap started ANOTHER ten-second join holding its own network
  // operation, and each one eventually stacked another error on the pile.
  // Measured: two taps 150ms apart produced two concurrent joins and two
  // identical toasts.
  var joining = false;
  function setJoinBusy(busy) {
    var b = $('joinBtn');
    if (!b) return;
    b.disabled = busy;
    b.textContent = busy ? t('joining') : t('joinBtn');
  }

  async function join() {
    if (joining) return;

    var c = ($('codeInput').value || '').trim().toUpperCase();
    var name = ($('nameInput').value || '').trim();
    if (!c) { MG.toast(t('errCode'), 'error'); return; }
    if (!name) { MG.toast(t('errName'), 'error'); return; }

    joining = true;
    setJoinBusy(true);

    // EVERY await below is inside this try. Without it a single rejected
    // promise killed join() silently and the Join button simply appeared to
    // do nothing, which is indistinguishable from a dead tap.
    try {
      await ensureAuth();
      if (!me) { MG.toast(t('errConnecting'), 'error'); return; }

      var ref = db.collection(COLL).doc(c);
      var snap = await ref.get();
      if (!snap.exists) { MG.toast(t('errNoQuiz'), 'error'); return; }
      if (snap.data().status === 'finished') { MG.toast(t('errFinished'), 'error'); return; }
      // The room's language, from the document just read - no extra read.
      sessionLang = snap.data().lang || 'en';
      applyLang();

      code = c;
      myRef = ref.collection('players').doc(me.uid);

      // REJOINING MUST NOT WIPE THE SCORE.
      //
      // This used to write `score: 0`, and `merge: true` does NOT protect a
      // field you are explicitly writing - it merges fields, it does not skip
      // them. Anonymous auth restores the same uid on reload, so the write
      // landed on the student's existing player document and reset their real
      // score in Firestore, not just on screen.
      //
      // increment(0) has exactly the semantics wanted: it creates the field as
      // 0 when it is absent, and leaves any existing value untouched.
      await myRef.set({
        name: name,
        score: firebase.firestore.FieldValue.increment(0),
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Read it back so the phone shows what they actually have. Without this
      // the database would be right while the header still said 0, and every
      // later increment would be correct but under-reported on screen.
      try {
        var mine = await myRef.get();
        myScore = (mine.exists && Number(mine.data().score)) || 0;
        var sc = $('myScore');
        if (sc) sc.textContent = myScore;
      } catch (e) { /* display only - never block the join */ }

      // Read the questions ONCE, but retried. They never change during a game.
      questions = await readQuestions(ref);
      if (!questions.length) {
        // Never park them on a waiting screen holding an empty bank - that is
        // the exact silent failure this exists to remove. Clearing code and
        // myRef also releases the refresh guard, so tapping Join again (or
        // reloading) is clean rather than warning them about leaving.
        code = null;
        myRef = null;
        MG.toast(t('errQuestions'), 'error');
        return;
      }

      $('waitName').textContent = name;
      show('wait');
      watchSession();
    } catch (e) {
      code = null;
      myRef = null;
      MG.toast(friendlyJoinError(e), 'error');
    } finally {
      // Always release, on every path. A student who fails to join must get
      // a live button back, and one who succeeds has already moved to the
      // waiting view where this button is not visible anyway.
      joining = false;
      setJoinBusy(false);
    }
  }

  // Only guard the refresh once they are actually in a room. Before that a
  // reload costs nothing, and a confirmation on the join screen would just be
  // one more thing between a student and the game.
  window.refreshGuardShouldProtect = function () { return !!(code && myRef); };

  // THE LISTENER THAT MUST NEVER DIE QUIETLY.
  //
  // This had no error callback at all, while the host's listeners have had
  // one from the start. onSnapshot without one means a listener that drops is
  // gone for good: the phone keeps its question bank, keeps looking connected,
  // and simply never hears another word from the room. It sits on the waiting
  // screen for the rest of the game.
  //
  // MEASURED AT THE REAL EVENT, 2026-09-22, room SUZNC: of 99 students, 9
  // never answered a single question, and the same 9 names appear twice in
  // the roster - they gave up and rejoined. Their player documents exist with
  // their names, so the JOIN worked. They were deaf, not absent.
  //
  // So: re-attach on error, with backoff and jitter, up to a bounded number of
  // attempts. Jitter for the same reason as everywhere else here - a whole
  // room dropping at once must not come back as one synchronised burst.
  var watchRetries = 0;
  var watchTimer = null;

  function watchSession() {
    if (sessionUnsub) { try { sessionUnsub(); } catch (e) {} sessionUnsub = null; }
    if (watchTimer) { clearTimeout(watchTimer); watchTimer = null; }
    if (!code) return;

    sessionUnsub = db.collection(COLL).doc(code).onSnapshot(function (snap) {
      watchRetries = 0;               // a delivered snapshot means we are healthy again
      if (!snap.exists) return;
      var s = snap.data();

      // The host resuming a room keeps its language; a change is repainted.
      if ((s.lang || 'en') !== sessionLang) { sessionLang = s.lang || 'en'; applyLang(); }

      if (s.status === 'finished') { finish(); return; }
      if (s.status !== 'active' || s.currentQuestion == null || s.currentQuestion < 0) {
        show('wait');
        return;
      }

      if (s.phase === 'asking') {
        if (s.currentQuestion !== shownIndex) {
          shownIndex = s.currentQuestion;
          renderQuestion(s);
        }
        return;
      }

      if (s.phase === 'revealed') { betweenQuestions(); }
    }, function (err) {
      // The listener is dead. Firestore will not revive it on its own.
      if (sessionUnsub) { try { sessionUnsub(); } catch (e) {} sessionUnsub = null; }
      if (watchRetries >= 6) {
        MG.toast(t('errLost'), 'error');
        return;
      }
      var wait = 700 * Math.pow(2, watchRetries) + Math.random() * 600;
      watchRetries++;
      watchTimer = setTimeout(watchSession, wait);
    });
  }

  // SECOND SAFETY NET, and the one that turns a permanent failure into a
  // temporary one.
  //
  // Being asked to show a question we do not hold means the bank is empty or
  // short. The old code silently fell back to the waiting screen and stayed
  // there for the rest of the game. Now it re-fetches once per question and
  // draws as soon as the bank arrives, so a phone that lost the read at join
  // time heals itself at the next question instead of being dead for good.
  //
  // Guarded so the snapshot listener firing repeatedly cannot stack fetches.
  var recovering = false;
  async function recoverQuestions(s) {
    if (recovering || !code) return;
    recovering = true;
    try {
      var items = await readQuestions(db.collection(COLL).doc(code));
      if (items.length) {
        questions = items;
        // Only draw if the question the host is ON is now available, and only
        // while they are still asking it - landing mid-reveal would show a
        // question the room has already finished.
        if (questions[shownIndex] && s && s.phase === 'asking') renderQuestion(s);
      }
    } catch (e) { /* stay on the waiting screen and try again next question */ }
    recovering = false;
  }

  function renderQuestion(s) {
    clearInterval(timerHandle);
    var q = questions[shownIndex];
    if (!q) { show('wait'); recoverQuestions(s); return; }

    lastFeedback = null;
    $('qProgress').textContent = t('question', { n: shownIndex + 1, t: questions.length });
    $('qModule').textContent = q.module ? t('module', { m: String(q.module).replace(/^m/, '') }) : '';
    $('qText').innerHTML = pairHtml(q.q);
    $('qFeedback').textContent = '';
    $('qFeedback').className = 'aiq-feedback';

    $('answers').innerHTML = q.options.map(function (o, k) {
      return '<button type="button" class="aiq-answer" data-k="' + k + '">' +
        '<span class="aiq-key">' + 'ABCD'.charAt(k) + '</span>' +
        '<span class="aiq-label">' + pairHtml(o) + '</span></button>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('.aiq-answer'), function (b) {
      b.addEventListener('click', function () { answer(parseInt(b.getAttribute('data-k'), 10), s); });
    });

    show('q');
    runTimer(s.questionEndsAt, s.seconds || 30);
  }

  function runTimer(endsAt, total) {
    clearInterval(timerHandle);
    if (!endsAt) { $('timer').textContent = ''; return; }
    timerHandle = setInterval(function () {
      var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      $('timer').textContent = '⏱ ' + left;
      if (left <= 0) { clearInterval(timerHandle); lockAnswers(); }
    }, 250);
  }

  function lockAnswers() {
    Array.prototype.forEach.call(document.querySelectorAll('.aiq-answer'), function (b) {
      b.disabled = true;
    });
  }

  async function answer(k, s) {
    if (answeredIndex === shownIndex) return;    // one answer per question
    answeredIndex = shownIndex;
    lockAnswers();

    var q = questions[shownIndex];
    var correct = k === q.answer;

    // Speed bonus decays across the question's own clock.
    var total = (s.seconds || 30) * 1000;
    var leftMs = Math.max(0, (s.questionEndsAt || 0) - Date.now());
    var frac = total > 0 ? Math.max(0, Math.min(1, leftMs / total)) : 0;
    var gained = correct ? (100 + Math.round(50 * frac)) : 0;

    var btns = document.querySelectorAll('.aiq-answer');
    for (var i = 0; i < btns.length; i++) {
      var kk = parseInt(btns[i].getAttribute('data-k'), 10);
      if (kk === q.answer) btns[i].classList.add('is-correct');
      else if (kk === k) btns[i].classList.add('is-wrong');
    }
    var fb = $('qFeedback');
    lastFeedback = { correct: correct, gained: gained };
    fb.textContent = correct ? t('correct', { p: gained }) : t('wrong');
    fb.className = 'aiq-feedback ' + (correct ? 'is-correct' : 'is-wrong');

    if (gained) {
      myScore += gained;
      $('myScore').textContent = myScore;
    }
    // STILL ONE WRITE PER ANSWER, but now it happens for a wrong answer too.
    //
    // It used to return early when nothing was gained, so a wrong answer wrote
    // nothing at all and the host had no way to tell "everyone has answered"
    // from "nobody has". `answeredQ` is that signal, and the host counts it
    // with an aggregation rather than by listening to every player, so this
    // stays one write per student per question and adds no per-answer traffic
    // to the host. increment(0) is a no-op on the score.
    myRef.update({
      score: firebase.firestore.FieldValue.increment(gained),
      answeredQ: shownIndex
    }).catch(function () { /* a lost point is not worth interrupting the game */ });
  }

  function betweenQuestions() {
    clearInterval(timerHandle);
    ladderMode = 'between';
    $('ladderTitle').textContent = t('yourScore');
    $('ladderScore').textContent = myScore;
    $('ladderNote').textContent = t('waitNext');
    show('ladder');
  }

  async function finish() {
    clearInterval(timerHandle);
    if (sessionUnsub) { sessionUnsub(); sessionUnsub = null; }
    ladderMode = 'finished';
    $('ladderTitle').textContent = t('finished');
    $('ladderScore').textContent = myScore;
    $('ladderNote').textContent = t('lookBoard');
    show('ladder');
  }

  // The join screen, in both languages until a room says otherwise.
  applyLang();
})();
