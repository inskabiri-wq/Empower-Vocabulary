/* ============================================================
   AI QUIZ - host
   ------------------------------------------------------------
   A teacher-paced quiz on the AI Use Guidelines course. The room
   moves together: everyone sees question 5, everyone answers it,
   the teacher closes it, the ladder appears, next question.

   That is deliberately NOT how Vocab Race works. There, students
   race through the whole word list at their own speed, so there
   is no moment when the room is between questions and nothing for
   a ladder to attach to. Here the teacher owns the question
   number and the phones follow it.

   BUILT FOR A WHOLE COHORT (1000+), which drives three choices:

   1. THE QUESTIONS LIVE IN THEIR OWN DOCUMENT, read once by each
      phone. The session document that every student listens to
      holds only the question number, the phase and the timer, so
      it stays a few hundred bytes. Embedding 20 questions there
      would push the whole bank to every phone on every question
      change.

   2. THE LOBBY SHOWS A COUNT, not a card per student. Drawing one
      card per player is what makes a big room unusable: measured
      at 194 seconds of rendering for a 600-player game, because
      the list is rebuilt on every score write.

   3. THE LADDER IS A QUERY, not a listener: the top ten, once,
      when a question closes. Ten reads instead of one callback
      per student per answer.

   NO HISTORY IS KEPT. Only a live score per player. Nothing is
   written per answer, which halves the writes and means there is
   nothing to clean up afterwards.
   ============================================================ */
(function () {
  'use strict';

  if (!window.firebase || !firebase.apps.length) {
    throw new Error('aiquiz-teacher: js/tenant.js + js/firebase-init.js must load first.');
  }
  var auth = firebase.auth();
  var db = firebase.firestore();
  var BANK = window.AI_QUIZ;

  var COLL = 'aiquiz_sessions';
  var STUDENT_PAGE = 'classroom-aiquiz-student.html';

  var me = null;
  var code = null;
  var questions = [];          // the set this game asks
  var qIndex = -1;
  var seconds = 30;
  // 'both' | 'en' | 'tr'. Chosen on the setup screen and written on the room,
  // so the projector and every phone start in the same language. A room made
  // before this existed has no `lang` and is treated as 'en' - exactly what it
  // always showed.
  var lang = 'both';
  var LANG_LABEL = { both: 'English + Türkçe', en: 'English', tr: 'Türkçe' };

  // One text in the room's language. Every question, option and module title
  // is an { en, tr } pair (classroom/js/ai-quiz-questions.js); a plain string
  // is passed through, so nothing breaks if a pair is ever missing a side.
  function pick(o, l) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o[l] || o.en || o.tr || '';
  }
  // As HTML for the projector: one line, or with 'both' the Turkish on a
  // second, quieter line beneath the English.
  function biHtml(o) {
    if (lang === 'tr') return MG.escHtml(pick(o, 'tr'));
    if (lang === 'en') return MG.escHtml(pick(o, 'en'));
    var en = pick(o, 'en'), tr = pick(o, 'tr');
    return MG.escHtml(en) + (tr && tr !== en ? '<span class="aiq-tr">' + MG.escHtml(tr) + '</span>' : '');
  }
  var timerHandle = null;
  var playersUnsub = null;
  // Roster size at the last snapshot, so the join sound fires on arrivals and
  // stays quiet when the snapshot fires for something else (a score changing).
  var lastRosterCount = 0;
  // Which second the countdown last ticked on. runTimer polls every 250ms, so
  // without this each second would tick four times.
  var lastTickSecond = null;
  var closed = false;          // current question closed?

  // ── Surviving an accidental refresh ───────────────────────
  //
  // The host holds `code` and the question list in memory and nowhere else.
  // A reload used to drop both, and the room does not stop when the host's
  // tab does: every phone stays subscribed to a session document that will
  // now never advance, with no way for anyone to end it. In front of a
  // cohort that is unrecoverable, so the few fields needed to pick the game
  // back up are mirrored to localStorage and read on boot.
  var RESUME_KEY = 'aiquiz.host.resume';
  var RESUME_MAX_AGE = 6 * 60 * 60 * 1000;  // a stale entry must not hijack a new game

  function saveResume() {
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({
        code: code, questions: questions, seconds: seconds, lang: lang,
        qIndex: qIndex, at: Date.now()
      }));
    } catch (e) { /* private mode or quota: resuming is a nicety, not a requirement */ }
  }
  function clearResume() {
    try { localStorage.removeItem(RESUME_KEY); } catch (e) {}
  }
  function readResume() {
    try {
      var r = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null');
      if (!r || !r.code || !Array.isArray(r.questions) || !r.questions.length) return null;
      if (!r.at || Date.now() - r.at > RESUME_MAX_AGE) return null;
      return r;
    } catch (e) { return null; }
  }

  // Blocking validation gets the same card the rest of the app uses, rather
  // than a notice that slides away. A teacher who has to go and change
  // something should be interrupted; in-game feedback still uses MG.toast.
  function showAiqError(title, message, icon) {
    if (window.AppDialog && typeof AppDialog.alert === 'function') {
      return AppDialog.alert(message, { title: title, icon: icon || '⚠️' });
    }
    MG.toast(title + ' - ' + message, 'error');
  }

  var $ = function (id) { return document.getElementById(id); };
  var show = function (view) {
    ['setup', 'lobby', 'live', 'results'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.style.display = (v === view) ? '' : 'none';
    });
  };

  // ── Auth ──────────────────────────────────────────────────
  auth.onAuthStateChanged(function (user) {
    if (!user) { window.location.replace('index.html'); return; }
    me = user;
    var n = $('teacherName');
    if (n) n.textContent = user.displayName || user.email || '';
    if (window.MG && MG.setupMusic) MG.setupMusic();
    // THE SETUP SCREEN ALWAYS COMES UP. Resuming is OFFERED, never forced.
    //
    // The first version of this auto-resumed into the old room, and that was
    // wrong in the worst way: open the AI Quiz to set up a new quiz and you
    // landed in a lobby for a room you had walked away from, with no control
    // anywhere that goes back to setup. The page looked broken because, for
    // the thing you were trying to do, it was.
    buildSetup();
    offerResume();
  });

  // Offer to pick a live room back up, as a bar above the setup form. Every
  // condition has to hold: a recent entry, a session that still exists, is not
  // finished, and is OURS. Anything else silently clears and leaves setup
  // alone.
  async function offerResume() {
    var r = readResume();
    if (!r) return;
    var snap;
    try { snap = await db.collection(COLL).doc(r.code).get(); }
    catch (e) { return; }
    if (!snap.exists) { clearResume(); return; }
    var s = snap.data() || {};
    if (s.status === 'finished' || s.hostUid !== me.uid) { clearResume(); return; }

    var bar = $('resumeBar');
    if (!bar) return;
    // The bar has to explain itself. A teacher who opens this page to set up a
    // quiz and is shown a five-letter code has no idea where it came from, so
    // it says what happened, what state the room is in, and what each button
    // will do. "Quiz MVRTQ is still open" on its own answered none of that.
    var where = (typeof s.currentQuestion === 'number' && s.currentQuestion >= 0)
      ? 'It is part-way through, on question ' + (s.currentQuestion + 1) +
        ' of ' + (s.total || r.questions.length) + '.'
      : 'Nobody has started it - it is still sitting in the lobby.';
    bar.innerHTML =
      '<div class="aiq-resume">' +
        '<div>' +
          '<strong>You have a quiz room still open: ' + MG.escHtml(r.code) + '</strong><br>' +
          'You created it earlier and never ended it, so it is still live and any ' +
          'students who joined are still waiting on it. ' + where +
          '<br><span class="aiq-resume-hint">' +
            '<b>Go back to it</b> reopens that room where you left off. ' +
            '<b>Discard</b> closes it for everyone and leaves you here to set up a new one. ' +
            'If you are not sure, Discard is safe.' +
          '</span>' +
        '</div>' +
        '<div class="aiq-resume-btns">' +
          '<button type="button" id="resumeGoBtn" class="btn btn-success">Go back to it</button>' +
          '<button type="button" id="resumeDropBtn" class="btn btn-secondary">Discard</button>' +
        '</div>' +
      '</div>';
    bar.style.display = '';
    $('resumeGoBtn').addEventListener('click', function () {
      bar.style.display = 'none';
      resumeInto(r, s);
    });
    $('resumeDropBtn').addEventListener('click', async function () {
      // Close the room too, so the phones still listening are released rather
      // than left waiting on a host that is never coming back.
      try { await db.collection(COLL).doc(r.code).update({ status: 'finished', phase: 'revealed' }); }
      catch (e) { /* already gone, or not ours any more */ }
      clearResume();
      bar.style.display = 'none';
      MG.toast('Discarded quiz ' + r.code + '.', 'info');
    });
  }

  async function resumeInto(r, s) {
    code = r.code;
    questions = r.questions;
    seconds = r.seconds || s.seconds || 30;
    lang = r.lang || s.lang || 'en';
    var at = (typeof s.currentQuestion === 'number') ? s.currentQuestion : r.qIndex;
    qIndex = Math.min(Math.max(at, -1), questions.length - 1);

    if (qIndex < 0) { openLobby(); return; }

    renderQuestion();
    show('live');
    // A question still inside its window carries on with the time that is
    // actually left. Anything else comes back CLOSED, with the ladder up and
    // Next armed, which is always a safe place to stand: it cannot cut a live
    // question short and it cannot double-ask one.
    var left = (s.phase === 'asking' && s.questionEndsAt) ? s.questionEndsAt - Date.now() : 0;
    if (left > 1500) {
      closed = false;
      $('revealBtn').disabled = false;
      $('nextBtn').disabled = true;
      runTimer(s.questionEndsAt);
    } else {
      closed = true;
      $('revealBtn').disabled = true;
      await showLadder();
      $('nextBtn').disabled = false;
      $('nextBtn').textContent = (qIndex + 1 >= questions.length)
        ? '🏁 Show final results' : '⏭️ Next question';
    }
  }

  // ── Setup ─────────────────────────────────────────────────
  function buildSetup() {
    var wrap = $('moduleChecks');
    if (!wrap || !BANK) return;
    var mods = BANK.modules || {};
    wrap.innerHTML = Object.keys(mods).map(function (id) {
      var n = BANK.activeQuestions().filter(function (q) { return q.module === id; }).length;
      return '<label class="mg-module-check">' +
        '<input type="checkbox" value="' + MG.escHtml(id) + '" checked> ' +
        '<span>' + MG.escHtml(pick(mods[id], 'en')) + '</span>' +
        '<span class="mg-module-n">' + n + '</span></label>';
    }).join('');
    $('qCount').value = String((BANK.CONFIG && BANK.CONFIG.questionCount) || 20);
    $('qSeconds').value = String((BANK.CONFIG && BANK.CONFIG.secondsPerQuestion) || 30);
    show('setup');
  }

  function chosenModules() {
    return Array.prototype.slice
      .call(document.querySelectorAll('#moduleChecks input:checked'))
      .map(function (i) { return i.value; });
  }

  function pickQuestions() {
    var mods = chosenModules();
    var pool = BANK.activeQuestions().filter(function (q) {
      return mods.indexOf(q.module) !== -1;
    });
    var want = parseInt($('qCount').value, 10) || 20;
    // Fewer questions than asked for is not an error, it just means the
    // chosen modules do not hold that many. Say so rather than pad.
    return MG.sample(pool, Math.min(want, pool.length));
  }

  $('createBtn').addEventListener('click', function () {
    // SAY WHICH OF THE TWO THINGS WENT WRONG.
    //
    // "Pick at least one module" was shown for an empty question set whatever
    // the cause, so a teacher with every module ticked was told to tick a
    // module. There are two different failures here and they need two
    // different sentences: nothing selected, or nothing in what was selected.
    var mods = chosenModules();
    if (!mods.length) {
      showAiqError('Pick at least one module', 'Tick a module above, then create the room.', '\u{1F4DA}');
      return;
    }
    var picked = pickQuestions();
    if (!picked.length) {
      showAiqError('No questions in those modules',
        'The modules you ticked have no active questions. Tick another module, or turn some '
        + 'questions back on in classroom/js/ai-quiz-questions.js.', '\u{1F4ED}');
      return;
    }
    var want = parseInt($('qCount').value, 10) || 20;
    if (picked.length < want) {
      // Not a blocker: the game runs with what there is. A notice that fades
      // is right here, because nothing needs to be fixed first.
      MG.toast('Only ' + picked.length + ' questions in the modules you chose.', 'info');
    }
    seconds = parseInt($('qSeconds').value, 10) || 30;
    lang = LANG_LABEL[$('qLang') && $('qLang').value] ? $('qLang').value : 'both';
    createRoom(picked);
  });

  // THE RIGHT ANSWER IS FIRST IN EVERY QUESTION IN THE BANK.
  //
  // classroom/js/ai-quiz-questions.js writes `answer: 0` in all 22 questions,
  // because listing the correct option first is the readable way to author
  // them. Nothing shuffled them afterwards, so the first button on every
  // phone was always right and a student could score 100% by tapping A twenty
  // times without reading a word.
  //
  // Shuffled ONCE here, at room creation, and the remapped list becomes the
  // single source for all three consumers: what the host projects
  // (renderQuestion reads `questions`), what goes to meta/questions for the
  // phones, and what saveResume stores. Shuffling per client instead would
  // desynchronise the projector from the room.
  function shuffleOptions(q) {
    var opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length < 2) return q;
    var right = opts[q.answer];
    var mixed = MG.shuffle(opts);          // returns a copy, never mutates
    var at = mixed.indexOf(right);         // identity match: same objects
    var out = {};
    Object.keys(q).forEach(function (k) { out[k] = q[k]; });
    out.options = mixed;
    out.answer = at >= 0 ? at : q.answer;  // fall back rather than corrupt
    return out;
  }

  async function createRoom(picked) {
    code = MG.genCode();
    questions = picked.map(shuffleOptions);
    var ref = db.collection(COLL).doc(code);

    // The hot document: tiny, because every phone listens to it.
    await ref.set({
      code: code,
      status: 'waiting',
      currentQuestion: -1,
      phase: 'asking',
      questionEndsAt: null,
      total: picked.length,
      seconds: seconds,
      // The phones' starting language. They read it from the document they
      // already listen to, so this costs no extra read.
      lang: lang,
      // `hostUid`, not `createdBy`: the shared mini-game security rules
      // (_isMiniHost / _ownsMiniSession) key on this exact field name, so
      // using anything else would leave the host unable to run their own room.
      hostUid: me.uid,
      teacherName: me.displayName || me.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // The questions: read ONCE per phone, never pushed on updates.
    await ref.collection('meta').doc('questions').set({
      // `questions`, not `picked`: the shuffled list, so the phones and the
      // projector show the same options in the same order.
      items: questions.map(function (q) {
        return {
          id: q.id, module: q.module,
          q: q.q, options: q.options, answer: q.answer
        };
      })
    });

    saveResume();
    openLobby();
  }

  // ── Lobby ─────────────────────────────────────────────────
  function openLobby() {
    var url = MG.joinUrl(STUDENT_PAGE, code);
    $('roomCode').textContent = code;
    $('qrImg').src = MG.qrSrc(url, 220, 1);
    $('joinUrl').textContent = url;
    $('joinUrl').href = url;
    $('lobbyMeta').textContent = questions.length + ' questions · ' + seconds + 's each · ' + (LANG_LABEL[lang] || 'English');
    show('lobby');
    watchPlayers();
  }

  // A COUNT, never a card per player. See the note at the top of this file.
  function watchPlayers() {
    if (playersUnsub) playersUnsub();
    playersUnsub = db.collection(COLL).doc(code).collection('players')
      .onSnapshot(function (snap) {
        var n = snap.size;
        // Someone new arrived. THROTTLED HARD: at 1000 students this fires
        // hundreds of times in a minute, and an unthrottled chime would be a
        // machine gun while the host machine schedules oscillators instead of
        // drawing the roster. One blip per 400ms reads as "they are coming in"
        // without ever becoming the main event.
        if (window.LLSound && n > lastRosterCount) {
          LLSound.play('join', { throttle: 400 });
        }
        lastRosterCount = n;
        var c = $('rosterCount'); if (c) c.textContent = n;
        var r = $('roster');
        if (r) {
          r.innerHTML = '<div class="mg-player-count">' + n +
            '<span>' + (n === 1 ? 'student joined' : 'students joined') + '</span></div>';
        }
        var btn = $('startBtn');
        if (btn) {
          btn.disabled = n === 0;
          btn.textContent = n === 0 ? '▶️ Waiting for players...' : '▶️ Start quiz (' + n + ')';
        }
      });
  }

  $('startBtn').addEventListener('click', function () {
    // The one click that reliably precedes everything else, so it is also
    // where the audio context gets unlocked for the rest of the game.
    if (window.LLSound) { LLSound.warmUp(); LLSound.play('start'); }
    askQuestion(0);
  });

  // ── One question ──────────────────────────────────────────
  async function askQuestion(i) {
    qIndex = i;
    closed = false;
    // THE ROSTER LISTENER IS RELEASED THE MOMENT THE QUIZ STARTS.
    //
    // watchPlayers() listens to the whole players subcollection, and every
    // student's score write is a change to that collection. Left attached, a
    // 1000-player game delivers about a thousand callbacks per question -
    // twenty thousand across a game - each one a document read billed to the
    // project and a delta pushed down to the host's tab, all to maintain a
    // count that is only ever drawn in the lobby. It is released here and
    // re-attached only if the host returns to the lobby.
    if (playersUnsub) { playersUnsub(); playersUnsub = null; }
    var endsAt = Date.now() + seconds * 1000;
    await db.collection(COLL).doc(code).update({
      status: 'active',
      currentQuestion: i,
      phase: 'asking',
      questionEndsAt: endsAt
    });
    renderQuestion();
    show('live');
    $('revealBtn').disabled = false;
    $('nextBtn').disabled = true;
    runTimer(endsAt);
    watchAllAnswered();
    saveResume();
  }

  function renderQuestion() {
    var q = questions[qIndex];
    $('liveCode').textContent = code;
    $('liveQrImg').src = MG.qrSrc(MG.joinUrl(STUDENT_PAGE, code), 72, 0);
    // The projector's big counter, in the room's language like the question.
    var qEn = 'Question ' + (qIndex + 1) + ' of ' + questions.length;
    var qTr = 'Soru ' + (qIndex + 1) + ' / ' + questions.length;
    $('qProgress').textContent = lang === 'tr' ? qTr : (lang === 'en' ? qEn : qEn + ' / ' + qTr);
    var mod = BANK.modules && BANK.modules[q.module];
    $('qModule').textContent = mod ? pick(mod, lang === 'tr' ? 'tr' : 'en') : '';
    $('qText').innerHTML = biHtml(q.q);
    $('qOptions').innerHTML = q.options.map(function (o, k) {
      return '<div class="aiq-option" data-k="' + k + '">' +
        '<span class="aiq-key">' + 'ABCD'.charAt(k) + '</span>' +
        '<span class="aiq-label">' + biHtml(o) + '</span></div>';
    }).join('');
    $('liveBoard').innerHTML = '<div class="mg-quiet">The ladder appears when you close the question.</div>';
    $('answeredNote').textContent = '';
  }

  function runTimer(endsAt) {
    clearInterval(timerHandle);
    lastTickSecond = null;
    timerHandle = setInterval(function () {
      var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      $('timer').textContent = '⏱ ' + left;
      // Tick only the LAST FIVE seconds, and only once per second. Ticking a
      // whole 30-second question would be unbearable in a hall; the last five
      // are the ones that make people answer.
      if (window.LLSound && left > 0 && left <= 5 && left !== lastTickSecond) {
        lastTickSecond = left;
        LLSound.play('tickUrgent');
      }
      if (left <= 0) { clearInterval(timerHandle); closeQuestion(); }
    }, 250);
  }

  // ── Close the question early when EVERYONE has answered ──────
  //
  // A question used to end only when the host pressed Reveal or the clock ran
  // out, so a room that had all finished in eight seconds still sat there
  // watching a thirty-second timer.
  //
  // TWO THINGS THIS DELIBERATELY IS NOT.
  //
  // Not a count() aggregation. MEASURED against this app's SDK: count() is a
  // modular-SDK API and the COMPAT build does not expose it at any version,
  // 10.7.1 included, so `players.count is not a function`. The same finding is
  // already written up at teacher/js/config.js:238. A count()-based version
  // would have thrown into its own catch and silently never worked.
  //
  // Not the full roster listener either. askQuestion releases that on purpose,
  // because at 1000 students it delivers about a thousand callbacks per
  // question and twenty thousand across a game. Re-attaching it would undo the
  // one decision that makes this the safe game to run at the event.
  //
  // What it is: a listener FILTERED to the players who have answered THIS
  // question, so it delivers only the answers themselves, and only in rooms
  // small enough for that to be free. A class of 30 costs at most 30 deltas
  // per question. Above the threshold the feature stays off and the question
  // ends exactly as it always has, on the clock or on Reveal - which is also
  // the honest behaviour for a 1000-person hall, where someone always has a
  // locked phone and "everyone answered" would never fire anyway.
  // RAISED FROM 60 TO 400 ON 2026-09-22, after the real event.
  //
  // The orientation ran with 99 students, so the feature never armed and every
  // question sat out its full 20 seconds even once the room had finished
  // answering. That is the behaviour Alireza asked to change.
  //
  // 400 is a cost ceiling, not a correctness one. The filtered listener
  // delivers at most one delta per student per question, so 400 students over
  // 20 questions is about 8,000 extra reads - against a measured event total
  // of ~13,400 and a free daily allowance of 50,000. Beyond that the feature
  // still switches itself off, which remains the honest behaviour for a hall
  // of a thousand where somebody always has a locked phone and "everyone
  // answered" would never fire anyway.
  var AUTO_CLOSE_MAX_PLAYERS = 400;
  var answeredUnsub = null;

  function stopAnsweredWatch() {
    if (answeredUnsub) { answeredUnsub(); answeredUnsub = null; }
  }

  // EXPECTED IS RE-READ EVERY QUESTION. It used to be `lastRosterCount`, which
  // is written ONLY by the lobby listener - and askQuestion releases that
  // listener the instant the quiz starts. So the target froze at whatever the
  // room held when Start was pressed, for the whole game.
  //
  // At the 2026-09-22 event students joined over five and a half minutes
  // (11:40:02 to 11:45:28). Pressing Start at 60 would have closed every one
  // of the ten questions the moment those first 60 answered, cutting off the
  // 39 who arrived later. One `.get()` per question costs the same as the
  // listener deltas it replaces and cannot go stale.
  async function watchAllAnswered() {
    stopAnsweredWatch();
    var note = $('answeredNote');

    // Pin the question this run belongs to. The read below is a round trip,
    // and the host can close or advance during it.
    var forQuestion = qIndex;

    var expected = 0;
    try {
      var roster = await db.collection(COLL).doc(code).collection('players').get();
      expected = roster.size;
      lastRosterCount = expected;
    } catch (e) {
      expected = lastRosterCount;       // a failed count must not stall the game
    }

    // Moved on while that read was in flight? This run is stale - drop it, the
    // next question started its own.
    if (closed || qIndex !== forQuestion) return;

    if (!expected || expected > AUTO_CLOSE_MAX_PLAYERS) {
      if (note) note.textContent = '';
      return;
    }
    answeredUnsub = db.collection(COLL).doc(code).collection('players')
      .where('answeredQ', '==', forQuestion)
      .onSnapshot(function (snap) {
        if (closed || qIndex !== forQuestion) { stopAnsweredWatch(); return; }
        var done = snap.size;
        if (note) note.textContent = done + ' of ' + expected + ' answered';
        if (done >= expected) {
          if (note) note.textContent = 'Everyone answered';
          stopAnsweredWatch();
          closeQuestion();
        }
      }, function () {
        // A failed listener must never stall the game. The timer and the
        // Reveal button remain the authority.
        stopAnsweredWatch();
      });
  }

  $('revealBtn').addEventListener('click', function () { closeQuestion(); });

  async function closeQuestion() {
    if (closed) return;
    closed = true;
    clearInterval(timerHandle);
    stopAnsweredWatch();
    // Time is up / the host revealed. One sound for both, because to the room
    // they are the same moment: answering has stopped.
    if (window.LLSound) LLSound.play('end');
    $('revealBtn').disabled = true;

    await db.collection(COLL).doc(code).update({ phase: 'revealed' });

    // Mark the right answer on the host screen.
    var q = questions[qIndex];
    var opts = document.querySelectorAll('#qOptions .aiq-option');
    for (var i = 0; i < opts.length; i++) {
      if (parseInt(opts[i].getAttribute('data-k'), 10) === q.answer) {
        opts[i].classList.add('is-correct');
      }
    }

    await showLadder();
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = (qIndex + 1 >= questions.length)
      ? '🏁 Show final results' : '⏭️ Next question';
  }

  // TEN READS, once. Not a listener over every player.
  async function showLadder() {
    var snap = await db.collection(COLL).doc(code).collection('players')
      .orderBy('score', 'desc').limit(10).get();
    var rows = snap.docs.map(function (d, i) {
      var p = d.data();
      return '<div class="leaderboard-item">' +
        '<span class="leaderboard-rank">' + (i + 1) + '</span>' +
        '<span class="leaderboard-name">' + MG.escHtml(p.name || 'Student') + '</span>' +
        '<span class="leaderboard-score">' + (p.score || 0) + '</span></div>';
    }).join('');
    $('liveBoard').innerHTML = rows || '<div class="mg-quiet">No answers yet.</div>';
  }

  $('nextBtn').addEventListener('click', function () {
    if (qIndex + 1 >= questions.length) { endGame(); return; }
    askQuestion(qIndex + 1);
  });

  $('endBtn').addEventListener('click', async function () {
    var ok = await MG.ask('End the game?', 'Students will see the final ladder.', 'End');
    if (ok) endGame();
  });

  // ── Results ───────────────────────────────────────────────
  async function endGame() {
    clearInterval(timerHandle);
    if (window.LLSound) LLSound.play('win');
    await db.collection(COLL).doc(code).update({
      status: 'finished', phase: 'revealed'
    });
    if (playersUnsub) { playersUnsub(); playersUnsub = null; }
    clearResume();

    // EVERYONE, NOT THE TOP 20.
    //
    // This was `.limit(20)` with a hardcoded "Top 20" heading. At the real
    // event on 2026-09-22 that meant 79 of 99 students could not find
    // themselves on the final screen - the room played the whole quiz and
    // then four out of five people were simply absent from the result.
    //
    // 300 is a render cap, not a data one: it bounds the DOM on a weak
    // projector laptop and the report document, and it is comfortably above
    // any room this is used for. The read itself is one query - 99 reads
    // instead of 20 is nothing against the ~13,400 a whole event costs.
    var RESULTS_MAX = 300;
    var snap = await db.collection(COLL).doc(code).collection('players')
      .orderBy('score', 'desc').limit(RESULTS_MAX).get();
    var players = snap.docs.map(function (d) { return d.data(); });

    // Say what is actually on screen, rather than claiming a fixed number.
    var heading = $('resultsHeading');
    if (heading) {
      heading.textContent = (players.length >= RESULTS_MAX)
        ? ('Top ' + RESULTS_MAX)
        : ('All ' + players.length + (players.length === 1 ? ' player' : ' players'));
    }

    // Report to the single reporting home, like every other classroom game.
    // The AI Quiz was the one host that filed nothing, so its sessions never
    // appeared in Admin - Reports. Fail-silent by design: a reporting hiccup
    // must never take down the results screen in front of a room.
    if (window.saveGameReport) {
      window.saveGameReport(db, {
        game: 'aiquiz',
        mode: 'ai-course',
        code: code,
        teacherId: me.uid,
        teacherName: me.displayName || me.email || '',
        level: '', unit: 'AI Use Guidelines',
        outcome: players.length ? (players[0].name || 'Student') + ' won' : 'No players',
        wordCount: questions.length,
        players: players.map(function (p) {
          return { name: p.name || '', score: p.score || 0 };
        })
      });
    }

    // THE PODIUM CLASSES HAVE TO MATCH THE SHARED STYLESHEET.
    //
    // This emitted `podium-place podium-first`, but classroom/css/styles.css
    // keys on `.podium-place.first` - so NONE of the podium rules applied:
    // not the gold gradient on first, not the `order` that puts the winner in
    // the middle, not the stepped padding that makes it look like a podium at
    // all. It rendered three identical flat boxes. `.podium-block` was not
    // styled anywhere either, so the rank was a bare number.
    //
    // bingo, scramble and tug all emit `podium-place ${positions[i]}` with
    // positions = ['first','second','third'] and look correct. This now
    // matches them exactly, including the medal in .podium-rank.
    var MEDALS = ['🥇', '🥈', '🥉'];
    $('podium').innerHTML = players.slice(0, 3).map(function (p, i) {
      var place = ['first', 'second', 'third'][i];
      return '<div class="podium-place ' + place + '">' +
        '<div class="podium-rank">' + MEDALS[i] + '</div>' +
        '<div class="podium-name">' + MG.escHtml(p.name || 'Student') + '</div>' +
        '<div class="podium-score">' + (p.score || 0) + '</div></div>';
    }).join('');

    $('perPlayerBody').innerHTML = players.map(function (p, i) {
      return '<div class="leaderboard-item">' +
        '<span class="leaderboard-rank">' + (i + 1) + '</span>' +
        '<span class="leaderboard-name">' + MG.escHtml(p.name || 'Student') + '</span>' +
        '<span class="leaderboard-score">' + (p.score || 0) + '</span></div>';
    }).join('') || '<div class="mg-quiet">Nobody scored.</div>';

    show('results');
  }

  $('newGameBtn').addEventListener('click', function () { window.location.reload(); });
})();
