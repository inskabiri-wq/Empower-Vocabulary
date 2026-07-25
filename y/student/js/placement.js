/* ============================================================
   PLACEMENT TEST - runner (placement.html)
   ------------------------------------------------------------
   Full mock: Stage A grammar+vocab at B1 -> branch up/down ->
   Stage B at the branched band -> one COMPLETE reading exam +
   one COMPLETE listening exam (the real runners, reused via
   their submit hooks) -> recommendation A2/B1/B1+/B2.

   The recommendation is saved ONCE to /placementResults/{uid}
   (rules forbid update = one attempt) and NEVER touches the
   student profile. window.__previewMode = true so the exam
   runners skip their normal practice-session logging.
   ============================================================ */
(function () {
  'use strict';

  // The exam runners must not write practice sessions/XP for placement.
  window.__previewMode = true;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sample(a, n) { return shuffle(a).slice(0, n); }

  // Minimal screen switcher (listening-exam.js calls showScreen unguarded).
  // Unknown target ids (e.g. backFromExam -> 'listeningScreen', which only
  // exists on the dashboard) are ignored so the page never goes blank.
  window.showScreen = function (id) {
    var el = $(id); if (!el) return;
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    el.classList.add('active');
  };

  var LEVELS = ['A2', 'B1', 'B1+', 'B2'];

  var state = {
    user: null, userDoc: null,
    startTs: 0, inProgress: false,
    queue: [], qi: 0, stage: 'A', stageMeta: '',
    scores: { grammar: { correct: 0, total: 0 }, vocab: { correct: 0, total: 0 }, reading: null, listening: null },
    branch: '', provisional: '', final: '',
    vocabPool: null, afterContinue: null
  };

  // ── Question sources ─────────────────────────────────────────
  function grammarQs(levels, n) {
    var GP = window.GRAMMAR_PRACTICE;
    var pool = [];
    (levels || []).forEach(function (lvl) {
      var topics = (GP && GP.byLevel && GP.byLevel[lvl]) || [];
      topics.forEach(function (t) { t.questions.forEach(function (q) { pool.push({ kind: 'grammar', stem: q.stem, options: q.options, answer: q.answer }); }); });
    });
    return sample(pool, n);
  }

  function familyKey(w) { return String(w || '').toLowerCase().split(/\s+/).slice(0, 3).join(' '); }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Vocabulary questions are NEVER invented: word, definition and example
  // sentence come verbatim from datasets.json (the same wordlist the vocab
  // games use), STRICTLY at the rung's level - no cross-level fallback.
  //
  // DIFFICULTY (teacher decision): reading an English definition is too hard
  // below B1, so definition questions only appear from B1 upward. The A2
  // rung uses fill-in-the-blank instead (vocabGapQs): the dataset example
  // sentence with the word gapped out, options are 4 same-level words.
  function vocabQs(level, n) {
    var pool = (state.vocabPool || []).filter(function (w) { return w.level === level; });
    var picks = sample(pool, n);
    return picks.map(function (w) {
      var candidates = pool.filter(function (o) {
        return o.def !== w.def && familyKey(o.word) !== familyKey(w.word) && o.word !== w.word;
      });
      var samePos = candidates.filter(function (o) { return o.pos && w.pos && o.pos === w.pos; });
      var wrong = sample(samePos, 3);
      if (wrong.length < 3) {
        var used = wrong.slice();
        wrong = wrong.concat(sample(candidates.filter(function (o) { return used.indexOf(o) === -1; }), 3 - wrong.length));
      }
      var options = shuffle([w.def].concat(wrong.map(function (o) { return o.def; })));
      return {
        kind: 'vocab',
        stem: (w.ex ? 'Read the sentence and find the meaning of "' + w.word + '":\n"' + w.ex + '"'
                    : 'Find the meaning of "' + w.word + '":'),
        options: options,
        answer: options.indexOf(w.def)
      };
    });
  }

  // Easier format for the A2 rung: gap the word out of its own example
  // sentence, student picks the right word (same level, same POS and word
  // count preferred for the distractors, like the Fill in the Blank game).
  function vocabGapQs(level, n) {
    var pool = (state.vocabPool || []).filter(function (w) { return w.level === level; });
    var gappable = pool.filter(function (w) {
      return w.ex && new RegExp('\\b' + escapeRe(w.word) + '\\b', 'i').test(w.ex);
    });
    var picks = sample(gappable, n);
    return picks.map(function (w) {
      var sentence = w.ex.replace(new RegExp('\\b' + escapeRe(w.word) + '\\b', 'i'), '_____');
      var wc = w.word.trim().split(/\s+/).length;
      var candidates = pool.filter(function (o) {
        return o.word !== w.word && familyKey(o.word) !== familyKey(w.word) && o.def !== w.def;
      });
      var best = candidates.filter(function (o) {
        return o.pos && w.pos && o.pos === w.pos && o.word.trim().split(/\s+/).length === wc;
      });
      var wrong = sample(best, 3);
      if (wrong.length < 3) {
        var samePos = candidates.filter(function (o) { return wrong.indexOf(o) === -1 && o.pos && w.pos && o.pos === w.pos; });
        wrong = wrong.concat(sample(samePos, 3 - wrong.length));
      }
      if (wrong.length < 3) {
        wrong = wrong.concat(sample(candidates.filter(function (o) { return wrong.indexOf(o) === -1; }), 3 - wrong.length));
      }
      var options = shuffle([w.word].concat(wrong.map(function (o) { return o.word; })));
      return {
        kind: 'vocab',
        stem: 'Choose the word that completes the sentence:\n"' + sentence + '"',
        options: options,
        answer: options.indexOf(w.word)
      };
    });
  }

  function loadVocabPool() {
    if (state.vocabPool) return Promise.resolve();
    return fetch('datasets.json').then(function (r) { return r.json(); }).then(function (data) {
      var out = [];
      (function walk(o) {
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (o && typeof o === 'object') {
          if (o.word && o.def && o.level) out.push({ word: o.word, def: o.def, ex: o.ex || '', pos: o.pos || '', level: o.level });
          Object.keys(o).forEach(function (k) { walk(o[k]); });
        }
      })(data);
      state.vocabPool = out;
    });
  }

  // ── MC stage UI ──────────────────────────────────────────────
  function startStage(tag, meta, qs, onDone) {
    state.stage = tag; state.stageMeta = meta;
    state.queue = qs; state.qi = 0; state.onStageDone = onDone;
    showScreen('plStage');
    renderQ();
  }
  function renderQ() {
    var q = state.queue[state.qi];
    if (!q) { state.onStageDone && state.onStageDone(); return; }
    $('plStageMeta').textContent = state.stageMeta + ' · Question ' + (state.qi + 1) + ' of ' + state.queue.length;
    $('plBar').style.width = Math.round((state.qi / state.queue.length) * 100) + '%';
    $('plStem').textContent = q.stem;
    var box = $('plOpts');
    box.innerHTML = q.options.map(function (o, i) { return '<button type="button" class="pl-opt" data-i="' + i + '">' + esc(o) + '</button>'; }).join('');
    box.querySelectorAll('.pl-opt').forEach(function (b) {
      b.onclick = function () {
        var ok = parseInt(b.getAttribute('data-i'), 10) === q.answer;
        var s = state.scores[q.kind];
        s.total++; if (ok) s.correct++;
        state.qi++;
        renderQ();
      };
    });
  }

  function stagePct(sinceG, sinceV) {
    var g = state.scores.grammar, v = state.scores.vocab;
    var c = (g.correct - sinceG.c) + (v.correct - sinceV.c);
    var t = (g.total - sinceG.t) + (v.total - sinceV.t);
    return t ? (c / t) * 100 : 0;
  }
  function snap() { return { g: { c: state.scores.grammar.correct, t: state.scores.grammar.total }, v: { c: state.scores.vocab.correct, t: state.scores.vocab.total } }; }

  // ── Score screens (same UI as the reading exam results) ──────
  function pctCls(p) { return p >= 70 ? 'good' : p >= 50 ? 'mid' : 'low'; }
  function resultRow(tag, title, correct, total) {
    var p = total ? Math.round((correct / total) * 100) : 0;
    return '<div class="rd-result-row"><div class="rd-result-row-head">' +
      '<span class="rd-result-num">' + esc(tag) + '</span>' +
      '<span class="rd-result-title">' + esc(title) + '</span>' +
      '<span class="rd-result-pct rd-pct-' + pctCls(p) + '">' + correct + '/' + total + ' &middot; ' + p + '%</span>' +
      '</div></div>';
  }
  // The between-sections summary used to be plain text lines; the teacher
  // asked for the SAME result UI as the reading exam, so this reuses the
  // rd-result-* classes (reading-exam.css is already on the page).
  function showLadderScore() {
    var c = 0, t = 0;
    var rows = (state.rungs || []).map(function (r) {
      c += r.correct; t += r.total;
      return resultRow(r.band, 'Level ' + r.band + ' questions', r.correct, r.total);
    }).join('');
    var p = t ? Math.round((c / t) * 100) : 0;
    $('plScoreMain').innerHTML =
      '<div class="rd-result-total">' +
        '<div class="rd-result-total-num rd-pct-' + pctCls(p) + '">' + c + ' / ' + t + '</div>' +
        '<div class="rd-result-total-pct">' + p + '%</div>' +
        '<div class="rd-result-total-label">Total score across the ' + (state.rungs || []).length + ' language levels</div>' +
      '</div>' +
      '<div class="rd-result-passages" style="margin-top:14px;">' + rows + '</div>';
    $('plScoreNext').textContent = 'Next: a reading exam. Answer every question, then press Submit; a Continue button appears afterwards.';
    $('plScoreBtn').onclick = runReading;
    showScreen('plScore');
  }

  function between(title, body, next) {
    $('plBetweenTitle').textContent = title;
    $('plBetweenBody').textContent = body;
    $('plBetweenBtn').onclick = next;
    showScreen('plBetween');
  }

  // ── Exam picking ─────────────────────────────────────────────
  function pickExam(skill, wantLevel) {
    var REG = window.EXAM_REGISTRY;
    if (!REG) return null;
    var chain = [wantLevel, 'B1', 'A2', 'B2', 'A1'];
    for (var i = 0; i < chain.length; i++) {
      var lvl = chain[i];
      if (!lvl || REG.levelsFor(skill).indexOf(lvl) === -1) continue;
      var list = (REG.examsForLevel(skill, lvl) || []).filter(function (e) { return e.available !== false; });
      if (list.length) { var e = list[Math.floor(Math.random() * list.length)]; return { level: lvl, exam: e }; }
    }
    return null;
  }
  function readingLevelFor(band) { return band === 'B1+' ? 'B1' : band; }

  function showContinue(cb) {
    var b = $('plContinueBtn');
    b.style.display = 'inline-block';
    b.onclick = function () { b.style.display = 'none'; cb(); };
  }

  // ── Flow: CEFR LADDER ────────────────────────────────────────
  // Language questions climb the bands in order (A2 -> B1 -> B1+ -> B2),
  // grammar + vocabulary mixed inside each rung. Per-rung accuracy decides
  // the provisional band: the highest rung answered at >=60%.
  var RUNGS = [
    { band: 'A2', g: 8, v: 5 },
    { band: 'B1', g: 8, v: 5 },
    { band: 'B1+', g: 6, v: 4 },
    { band: 'B2', g: 6, v: 4 }
  ];
  // Activity trail: placement shows up in the teacher Activity tab through the
  // same pipeline as practice events (who started / completed, with details).
  function logAct(kind, details) {
    try {
      if (window.ActivityLogger && typeof ActivityLogger.log === 'function' && window.ActivityConfig) {
        var t = kind === 'start' ? ActivityConfig.types.PRACTICE_STARTED : ActivityConfig.types.PRACTICE_COMPLETED;
        ActivityLogger.log(t, Object.assign({ skill: 'placement' }, details || {}));
      }
    } catch (_) {}
  }
  function runLadder(idx) {
    if (idx === 0) { state.inProgress = true; state.startTs = Date.now(); state.rungs = []; logAct('start', {}); }
    if (idx >= RUNGS.length) {
      var prov = 'A2';
      state.rungs.forEach(function (r) { if (r.total && (r.correct / r.total) * 100 >= 60) prov = r.band; });
      state.provisional = prov;
      showLadderScore();
      return;
    }
    var rung = RUNGS[idx];
    var base = snap();
    var gLevels = rung.band === 'B1+' ? ['B1+'] : [rung.band];
    // A2 rung = fill-in-the-blank vocab; definition questions from B1 up.
    var vq = rung.band === 'A2' ? vocabGapQs(rung.band, rung.v) : vocabQs(rung.band, rung.v);
    startStage('L' + idx, 'Language ladder - level ' + rung.band + ' (' + (idx + 1) + ' of ' + RUNGS.length + ')',
      shuffle(grammarQs(gLevels, rung.g).concat(vq)), function () {
        var g = state.scores.grammar, v = state.scores.vocab;
        state.rungs.push({ band: rung.band, correct: (g.correct - base.g.c) + (v.correct - base.v.c), total: (g.total - base.g.t) + (v.total - base.v.t) });
        runLadder(idx + 1);
      });
  }
  // Config-driven exam choice: 'auto' (or empty) = random exam at the level
  // matched to the provisional band; a specific exam id = always that exam.
  function pickConfigured(skill, configuredId) {
    var REG = window.EXAM_REGISTRY;
    if (REG && configuredId && configuredId !== 'auto') {
      var lvls = REG.levelsFor(skill);
      for (var i = 0; i < lvls.length; i++) {
        var hit = (REG.examsForLevel(skill, lvls[i]) || []).find(function (e) { return e.id === configuredId; });
        if (hit) return { level: lvls[i], exam: hit };
      }
    }
    return pickExam(skill, readingLevelFor(state.provisional));
  }
  function runReading() {
    var pick = pickConfigured('reading', state.cfg && state.cfg.readingExamId);
    if (!pick || typeof window.openReadingExam !== 'function') { state.scores.reading = null; runListeningIntro(); return; }
    window.onReadingExamSubmitted = function (r) {
      state.scores.reading = { correct: Number(r && r.correct) || 0, total: Number(r && r.total) || 0 };
      showContinue(runListeningIntro);
    };
    window.openReadingExam(pick.level, pick.exam.id, 'untimed');
  }
  function runListeningIntro() {
    between('Reading done', 'Next: a listening exam. You will hear the audio and answer the questions, then Submit.', runListening);
  }
  function runListening() {
    var pick = pickConfigured('listening', state.cfg && state.cfg.listeningExamId);
    if (!pick || typeof window.startListeningExam !== 'function') { state.scores.listening = null; runWritingIntro(); return; }
    window.onListeningExamSubmitted = function (r) {
      state.scores.listening = { correct: Number(r && r.correct) || 0, total: Number(r && r.total) || 0 };
      showContinue(runWritingIntro);
    };
    window.startListeningExam(pick.exam.id);
  }
  // ── Writing rung ─────────────────────────────────────────────
  // The essay TEXT is always saved with the result for teacher review.
  // (The AI corrector is teacher-gated server-side, so "AI" mode means the
  // teacher runs the saved essay through the corrector afterwards.)
  function runWritingIntro() {
    if (state.cfg && state.cfg.writingMode === 'off') { finish(); return; }
    between('Listening done', 'Last part: a short piece of writing (about 100 words).', runWriting);
  }
  // Anti-cheat for the writing rung: no pasting text in, no copying the prompt
  // or essay out, no drag-drop, and Ctrl/Cmd+F/C/V/X are blocked while the
  // writing screen is open. (Typing only - same spirit as exam lockdown.)
  var writingGuarded = false;
  function guardWriting() {
    if (writingGuarded) return;
    writingGuarded = true;
    var ta = $('plWritingText');
    ['paste', 'copy', 'cut', 'drop', 'dragover', 'contextmenu'].forEach(function (ev) {
      ta.addEventListener(ev, function (e) { e.preventDefault(); });
    });
    document.addEventListener('keydown', function (e) {
      if (!$('plWriting').classList.contains('active')) return;
      var k = String(e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'f' || k === 'c' || k === 'v' || k === 'x' || k === 'p')) e.preventDefault();
    }, true);
  }
  function runWriting() {
    var prompt = (state.cfg && state.cfg.writingPrompt) ||
      'Some people prefer studying alone, others in groups. Which do you prefer, and why? Write about 100 words.';
    showScreen('plWriting');
    guardWriting();
    $('plWritingPrompt').textContent = prompt;
    $('plWritingSubmit').onclick = function () {
      var text = ($('plWritingText').value || '').trim();
      var words = text ? text.split(/\s+/).length : 0;
      if (words < 30) {
        if (window.AppDialog && AppDialog.alert) AppDialog.alert('Please write at least 30 words.'); else alert('Please write at least 30 words.');
        return;
      }
      state.writing = { prompt: prompt, text: text.slice(0, 6000), words: words, mode: (state.cfg && state.cfg.writingMode) || 'manual' };
      finish();
    };
  }

  function adjustByRL(band) {
    var r = state.scores.reading, l = state.scores.listening;
    var c = 0, t = 0;
    [r, l].forEach(function (x) { if (x && x.total) { c += x.correct; t += x.total; } });
    if (!t) return band;
    var pct = (c / t) * 100;
    var i = LEVELS.indexOf(band);
    if (pct >= 75 && i < LEVELS.length - 1) return LEVELS[i + 1];
    if (pct < 35 && i > 0) return LEVELS[i - 1];
    return band;
  }

  // Firestore rejects `undefined` anywhere in a document. Normalize every
  // section score to clean numbers (or null when the section never ran).
  function safeScore(x) {
    if (!x || !x.total) return null;
    return { correct: Number(x.correct) || 0, total: Number(x.total) || 0 };
  }
  function finish() {
    state.inProgress = false;
    state.final = adjustByRL(state.provisional);
    state.scores = {
      grammar: safeScore(state.scores.grammar), vocab: safeScore(state.scores.vocab),
      reading: safeScore(state.scores.reading), listening: safeScore(state.scores.listening)
    };
    var doc = {
      userId: state.user.uid,
      name: (state.userDoc && (state.userDoc.name || state.userDoc.displayName)) || state.user.displayName || '',
      studentClass: (state.userDoc && state.userDoc.studentClass) || '',
      profileLevel: (state.userDoc && state.userDoc.level) || '',
      at: firebase.firestore.FieldValue.serverTimestamp(),
      stagePath: 'ladder ' + (state.rungs || []).map(function (r) { return r.band + ' ' + r.correct + '/' + r.total; }).join(' > ') +
        ' => ' + state.provisional + (state.final !== state.provisional ? ' > RL adj ' + state.final : ''),
      rungs: state.rungs || [],
      writing: state.writing || null,
      sectionScores: state.scores,
      recommendedLevel: state.final,
      durationSec: Math.max(0, Math.round((Date.now() - state.startTs) / 1000))
    };
    var isStaffPreview = !!(state.userDoc && state.userDoc.role && state.userDoc.role !== 'student');
    var save = isStaffPreview
      ? Promise.resolve('preview')   // staff preview: never writes a result
      : db.collection('placementResults').doc(state.user.uid).set(doc);
    // Manual-review routing: the teacher grades placement essays in the SAME
    // grading screen as writing assignments, so a manual-mode essay is also
    // filed as a writingSubmissions doc ({uid}_placement, initial grading
    // fields null as the create rule requires). Fail-silent: a hiccup here
    // must never block the placement result itself.
    if (!isStaffPreview && state.writing && state.writing.mode === 'manual') {
      db.collection('writingSubmissions').doc(state.user.uid + '_placement').set({
        userId: state.user.uid,
        assignmentId: 'placement',
        userName: doc.name || '',
        studentClass: doc.studentClass || '',
        level: doc.profileLevel || '',
        responseText: state.writing.text,
        wordCount: state.writing.words,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        score: null, teacherComment: null, gradedBy: null, gradedAt: null,
        source: 'placement'
      }).catch(function (e) { console.warn('placement writing bridge', e); });
    }
    logAct('complete', { recommendedLevel: state.final, durationSec: doc.durationSec });
    Promise.resolve(save).catch(function (e) { console.warn('placement save', e); })
      .then(function () { showDone(state.final, doc); });
  }

  // Final screen: recommended level + the same per-section result rows the
  // reading exam shows (rd-result-* classes), instead of a plain text line.
  function showDone(level, doc) {
    $('plDoneLevel').textContent = level || '-';
    var s = (doc && doc.sectionScores) || state.scores;
    var rows = '';
    [['GR', 'Grammar', s.grammar], ['VO', 'Vocabulary', s.vocab], ['RD', 'Reading', s.reading], ['LI', 'Listening', s.listening]].forEach(function (x) {
      if (x[2] && x[2].total) rows += resultRow(x[0], x[1], Number(x[2].correct) || 0, Number(x[2].total) || 0);
    });
    var w = (doc && doc.writing) || state.writing;
    if (w && w.words) {
      rows += '<div class="rd-result-row"><div class="rd-result-row-head">' +
        '<span class="rd-result-num">WR</span>' +
        '<span class="rd-result-title">Writing</span>' +
        '<span class="rd-result-pct">' + (Number(w.words) || 0) + ' words &middot; sent to your teacher</span>' +
        '</div></div>';
    }
    $('plDoneDetail').innerHTML = rows
      ? '<div class="rd-result-passages" style="text-align:left;margin-top:6px;">' + rows + '</div>'
      : '';
    showScreen('plDone');
  }

  // ── Boot / gate ──────────────────────────────────────────────
  function boot(user) {
    state.user = user;
    Promise.all([
      db.collection('settings').doc('placementConfig').get(),
      db.collection('users').doc(user.uid).get(),
      db.collection('placementResults').doc(user.uid).get(),
      db.collection('settings').doc('featureToggles').get()
    ]).then(function (res) {
      var cfg = res[0].exists ? (res[0].data() || {}) : {};
      state.cfg = cfg;
      state.userDoc = res[1].exists ? res[1].data() : {};
      var existing = res[2].exists ? res[2].data() : null;
      var toggles = res[3].exists ? (res[3].data() || {}) : {};
      var isStaff = state.userDoc.role === 'teacher' || state.userDoc.role === 'admin';
      var eligible = isStaff || (toggles.placement === true &&
        ((typeof window.courseActiveFor === 'function') ? window.courseActiveFor({ active: true, scope: cfg.scope || {} }, state.userDoc) : true));
      if (existing) {
        showDone(existing.recommendedLevel, existing);
        $('plDoneDetail').insertAdjacentHTML('beforeend',
          '<div style="margin-top:12px;color:var(--text-muted,#94a3b8);font-size:0.92em;">You have already taken the placement test.</div>');
        return;
      }
      if (!eligible) {
        $('plIntroBody').textContent = 'The placement test is not open for your account right now. Ask your teacher.';
        return;
      }
      $('plIntroBody').innerHTML = 'This test finds your English level. The <b>language questions climb from A2 up to B2</b>, then you take a <b>reading exam</b>, a <b>listening exam</b>' + ((cfg.writingMode === 'off') ? '' : ' and a <b>short piece of writing</b>') + '. It takes about <b>60 minutes</b>. You can take it <b>once</b>' + (isStaff ? ' (staff preview: your run is not saved)' : '') + '. Find a quiet place, then start.';
      var btn = $('plStartBtn');
      btn.style.display = 'inline-block';
      btn.onclick = function () { loadVocabPool().then(function () { runLadder(0); }).catch(function () { runLadder(0); }); };
    }).catch(function (e) {
      $('plIntroBody').textContent = 'Could not load the placement test: ' + ((e && e.message) || 'error');
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (state.inProgress) { e.preventDefault(); e.returnValue = ''; }
  });

  // Universal exit button: themed confirm while a run is in progress
  // (abandoning saves nothing, so the attempt is not consumed).
  (function wireExit() {
    var b = $('plExitBtn'); if (!b) return;
    b.addEventListener('click', function () {
      var go = function () { state.inProgress = false; window.location.href = 'student-dashboard.html'; };
      if (!state.inProgress) { go(); return; }
      if (window.AppDialog && AppDialog.confirm) {
        AppDialog.confirm('Exit the placement test? Your progress will NOT be saved, and you can start again later.').then(function (ok) { if (ok) go(); });
      } else if (confirm('Exit the placement test? Progress will not be saved.')) go();
    });
  })();

  function waitAuth(tries) {
    tries = (tries == null) ? 40 : tries;
    var u = (window.auth && auth.currentUser) || null;
    if (u) { boot(u); return; }
    if (tries <= 0) { $('plIntroBody').textContent = 'Please sign in to Lingualab first, then open the placement test again.'; return; }
    setTimeout(function () { waitAuth(tries - 1); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { waitAuth(); });
  else waitAuth();
})();
