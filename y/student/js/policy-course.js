/* ============================================================
   POLICY MINI COURSE - student controller
   ------------------------------------------------------------
   Coursera-style flow on top of window.POLICY_COURSE:
     overview -> lessons (step by step) -> module quiz -> ... -> final exam
     -> certificate (printable).

   Rules enforced here (config in policy-course-content.js):
     - Modules unlock in order (quiz of module N gates module N+1).
     - A test fails when wrong answers exceed config.maxWrong.
     - First fail of a test  -> restudy required (re-read the lessons).
     - Second fail and later -> the test is locked for config.banHours,
       anchored on the SERVER timestamp of the fail (lastFailAt), so
       changing the device clock or browser does not shorten the ban.

   Firestore:
     settings/policyCourse        { active, classes[], updatedAt, updatedBy }
     courseProgress/{uid}         { userId, userName, studentClass, courseId,
                                    modules.{id}.{passed,score,total,fails,
                                    restudy,lastFailAt,passedAt},
                                    finalExam.{...same}, certificate,
                                    lang, startedAt, updatedAt }
   ============================================================ */
(function () {
  'use strict';

  // ── Firebase ───────────────────────────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU",
    authDomain: "empower-vocabulary-practice.firebaseapp.com",
    projectId: "empower-vocabulary-practice",
    storageBucket: "empower-vocabulary-practice.firebasestorage.app",
    messagingSenderId: "136270199832",
    appId: "1:136270199832:web:174222066ef1cbdc8f576d"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const COURSE = window.POLICY_COURSE;
  const MAX_WRONG = (COURSE.config && COURSE.config.maxWrong) || 2;
  const BAN_HOURS = (COURSE.config && COURSE.config.banHours) || 48;

  // ── i18n ───────────────────────────────────────────────────
  let lang = localStorage.getItem('policyCourseLang') === 'tr' ? 'tr' : 'en';
  const STR = {
    dash:            { en: 'Dashboard', tr: 'Panel' },
    exit:            { en: 'Exit', tr: 'Çıkış' },
    back:            { en: 'Back', tr: 'Geri' },
    next:            { en: 'Next', tr: 'İleri' },
    backToDash:      { en: 'Back to dashboard', tr: 'Panele dön' },
    backToCourse:    { en: 'Back to course', tr: 'Kursa dön' },
    inactiveTitle:   { en: 'The course is not open yet', tr: 'Kurs henüz açık değil' },
    inactiveBody:    { en: 'Your teacher has not activated the Policy Course for your class yet. Check back later.', tr: 'Öğretmeniniz Politika Kursunu sınıfınız için henüz etkinleştirmedi. Daha sonra tekrar kontrol edin.' },
    step:            { en: 'Step', tr: 'Adım' },
    of:              { en: 'of', tr: '/' },
    goToQuiz:        { en: 'Go to the quiz', tr: 'Sınava geç' },
    finishRestudy:   { en: 'Finish restudy', tr: 'Tekrar çalışmayı bitir' },
    mistakesLeft:    { en: 'Mistakes left', tr: 'Kalan hata hakkı' },
    question:        { en: 'Question', tr: 'Soru' },
    locked:          { en: 'Locked', tr: 'Kilitli' },
    start:           { en: 'Start', tr: 'Başla' },
    continueLbl:     { en: 'Continue', tr: 'Devam et' },
    restudyFirst:    { en: 'Restudy required before retake', tr: 'Tekrar girmeden önce yeniden çalışma gerekli' },
    restudyBtn:      { en: 'Restudy the module', tr: 'Modülü yeniden çalış' },
    reviewAllBtn:    { en: 'Review all modules', tr: 'Tüm modülleri gözden geçir' },
    retakeBtn:       { en: 'Retake the quiz', tr: 'Sınava tekrar gir' },
    passed:          { en: 'Passed', tr: 'Geçildi' },
    quiz:            { en: 'Quiz', tr: 'Sınav' },
    finalExam:       { en: 'Final Exam', tr: 'Final Sınavı' },
    finalLockedHint: { en: 'Pass every module quiz to unlock the final exam.', tr: 'Final sınavının açılması için tüm modül sınavlarını geçin.' },
    bannedUntil:     { en: 'Locked. Try again in', tr: 'Kilitli. Tekrar deneme süresi:' },
    passTitle:       { en: 'Quiz passed!', tr: 'Sınav geçildi!' },
    passFinalTitle:  { en: 'Final exam passed!', tr: 'Final sınavı geçildi!' },
    failTitle:       { en: 'Not passed', tr: 'Geçilemedi' },
    failRestudyBody: { en: 'You made too many mistakes. Restudy the lessons, then you can retake the quiz.', tr: 'Çok fazla hata yaptınız. Dersleri yeniden çalışın, sonra sınava tekrar girebilirsiniz.' },
    failBanBody:     { en: 'You failed this test again, so it is now locked for 2 days. Use the time to restudy.', tr: 'Bu sınavda tekrar başarısız oldunuz; sınav 2 gün kilitlendi. Bu süreyi yeniden çalışmak için kullanın.' },
    yourScore:       { en: 'Your score', tr: 'Puanınız' },
    viewCert:        { en: 'View your certificate', tr: 'Sertifikanızı görüntüleyin' },
    certHeading:     { en: 'Certificate of Completion', tr: 'Tamamlama Sertifikası' },
    certPresented:   { en: 'This certificate is proudly presented to', tr: 'Bu sertifika aşağıdaki kişiye gururla takdim edilmiştir' },
    certScore:       { en: 'Final score', tr: 'Final puanı' },
    certDate:        { en: 'Date', tr: 'Tarih' },
    certId:          { en: 'Certificate ID', tr: 'Sertifika No' },
    printCert:       { en: 'Print / Save as PDF', tr: 'Yazdır / PDF kaydet' },
    correct:         { en: 'Correct!', tr: 'Doğru!' },
    wrong:           { en: 'Wrong.', tr: 'Yanlış.' },
    days:            { en: 'd', tr: 'g' },
    saveWarn:        { en: 'Progress could not be saved.', tr: 'İlerleme kaydedilemedi.' },
    modulesDone:     { en: 'modules passed', tr: 'modül geçildi' }
  };
  const T = k => (STR[k] && STR[k][lang]) || (STR[k] && STR[k].en) || k;
  const L = obj => (obj && (obj[lang] || obj.en)) || '';

  // ── State ──────────────────────────────────────────────────
  let user = null;
  let userDoc = null;          // users/{uid} data (name, class)
  let progress = null;         // courseProgress/{uid} data
  let lessonCtx = null;        // { steps, idx, title, forRestudy, testKey, afterQuiz }
  let quizCtx = null;          // { testKey, title, questions, idx, wrong, correct }
  let banTimer = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function show(viewId) {
    ['pcLoading', 'pcInactive', 'pcApp'].forEach(id => { $(id).style.display = (id === viewId || (viewId !== 'pcLoading' && viewId !== 'pcInactive' && id === 'pcApp')) ? '' : 'none'; });
    if (viewId === 'pcLoading' || viewId === 'pcInactive') $('pcApp').style.display = 'none';
  }
  function showMain(id) {
    ['pcOverview', 'pcLesson', 'pcQuiz', 'pcResult', 'pcCertificate'].forEach(m => { $(m).style.display = (m === id) ? '' : 'none'; });
    window.scrollTo(0, 0);
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.getAttribute('data-i18n')); });
    $('pcCourseTitle').textContent = L(COURSE.title);
    $('pcLangBtn').textContent = lang === 'tr' ? 'TR / EN' : 'EN / TR';
  }

  // ── Test-state helpers ─────────────────────────────────────
  function testState(key) { // key: module id or 'final'
    const node = (key === 'final')
      ? ((progress && progress.finalExam) || {})
      : ((progress && progress.modules && progress.modules[key]) || {});
    const fails = node.fails || 0;
    let bannedUntil = 0;
    if (fails >= 2 && node.lastFailAt && typeof node.lastFailAt.toMillis === 'function') {
      bannedUntil = node.lastFailAt.toMillis() + BAN_HOURS * 3600 * 1000;
    }
    return {
      passed: !!node.passed,
      score: node.score || 0,
      total: node.total || 0,
      fails,
      restudy: !!node.restudy,
      bannedUntil,
      bannedNow: bannedUntil > Date.now()
    };
  }
  function moduleUnlocked(idx) {
    for (let i = 0; i < idx; i++) if (!testState(COURSE.modules[i].id).passed) return false;
    return true;
  }
  function allModulesPassed() { return COURSE.modules.every(m => testState(m.id).passed); }
  function fmtRemaining(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return (d > 0 ? d + T('days') + ' ' : '') + h + 'h ' + m + 'm';
  }

  // ── Firestore writes (merge; failures must never break the UI) ──
  async function saveProgress(patch) {
    if (!user) return;
    patch.userId = user.uid;
    patch.userName = (userDoc && (userDoc.name || userDoc.displayName)) || user.displayName || user.email || 'Student';
    patch.studentClass = (userDoc && userDoc.studentClass) || '';
    patch.studentLevel = (userDoc && userDoc.studentLevel) || '';
    patch.courseId = COURSE.id;
    patch.lang = lang;
    patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await db.collection('courseProgress').doc(user.uid).set(patch, { merge: true });
    } catch (e) {
      console.warn('courseProgress save failed', e);
      if (typeof AppDialog !== 'undefined') AppDialog.alert(T('saveWarn'));
    }
  }
  async function reloadProgress() {
    try {
      const snap = await db.collection('courseProgress').doc(user.uid).get();
      progress = snap.exists ? snap.data() : null;
    } catch (e) { console.warn('progress reload', e); }
  }

  // ── OVERVIEW ───────────────────────────────────────────────
  function renderOverview() {
    if (banTimer) { clearInterval(banTimer); banTimer = null; }
    applyI18n();
    $('pcIntro').textContent = L(COURSE.intro);
    const total = COURSE.modules.length;
    const done = COURSE.modules.filter(m => testState(m.id).passed).length;
    const fin = testState('final');
    const pct = Math.round(((done + (fin.passed ? 1 : 0)) / (total + 1)) * 100);
    $('pcProgressFill').style.width = pct + '%';
    $('pcProgressLabel').textContent = done + ' / ' + total + ' ' + T('modulesDone') + (fin.passed ? ' · ' + T('finalExam') + ' ✓' : '');

    let html = '';
    COURSE.modules.forEach((m, i) => {
      const st = testState(m.id);
      const unlocked = moduleUnlocked(i);
      html += moduleCard(m.id, m.icon, L(m.title), st, unlocked, false, m.lessons.length, m.quiz.length);
    });
    // Final exam card
    const finUnlocked = allModulesPassed();
    html += moduleCard('final', '🏁', L(COURSE.finalExam.title), fin, finUnlocked, true, 0, COURSE.finalExam.questions.length);
    // Certificate card
    if (progress && progress.certificate && progress.certificate.certId) {
      html += `<div class="pc-module-card pc-cert-card" data-act="cert">
        <div class="pc-module-icon">📜</div>
        <div class="pc-module-info">
          <div class="pc-module-title">${esc(T('certHeading'))}</div>
          <div class="pc-module-sub">ID ${esc(progress.certificate.certId)}</div>
        </div>
        <button type="button" class="pc-btn pc-btn-gold" data-act="cert">${esc(T('viewCert'))}</button>
      </div>`;
    }
    $('pcModuleList').innerHTML = html;

    // Wire the actions
    $('pcModuleList').querySelectorAll('[data-act]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const act = el.getAttribute('data-act');
        const key = el.getAttribute('data-key');
        if (act === 'study') startLessons(key, false);
        if (act === 'restudy') startLessons(key, true);
        if (act === 'reviewAll') startReviewAll();
        if (act === 'quiz') startQuiz(key);
        if (act === 'cert') renderCertificate();
      });
    });

    // Live ban countdowns
    const banEls = $('pcModuleList').querySelectorAll('[data-ban-until]');
    if (banEls.length) {
      const tick = () => banEls.forEach(el => {
        const until = parseInt(el.getAttribute('data-ban-until'), 10);
        if (until <= Date.now()) { renderOverview(); return; }
        el.textContent = T('bannedUntil') + ' ' + fmtRemaining(until - Date.now());
      });
      tick();
      banTimer = setInterval(tick, 30000);
    }
    showMain('pcOverview');
  }

  function moduleCard(key, icon, title, st, unlocked, isFinal, lessonCount, qCount) {
    let stateHtml = '', action = '';
    if (!unlocked) {
      stateHtml = `<div class="pc-module-sub pc-muted">🔒 ${esc(T('locked'))}${isFinal ? ' · ' + esc(T('finalLockedHint')) : ''}</div>`;
    } else if (st.passed) {
      stateHtml = `<div class="pc-module-sub pc-ok">✅ ${esc(T('passed'))} · ${st.score}/${st.total}</div>`;
      if (!isFinal) action = `<button type="button" class="pc-btn pc-btn-ghost" data-act="study" data-key="${esc(key)}">${esc(T('continueLbl'))}</button>`;
    } else if (st.bannedNow) {
      stateHtml = `<div class="pc-module-sub pc-ban" data-ban-until="${st.bannedUntil}"></div>`;
      action = isFinal
        ? `<button type="button" class="pc-btn pc-btn-ghost" data-act="reviewAll">${esc(T('reviewAllBtn'))}</button>`
        : `<button type="button" class="pc-btn pc-btn-ghost" data-act="restudy" data-key="${esc(key)}">${esc(T('restudyBtn'))}</button>`;
    } else if (st.restudy) {
      stateHtml = `<div class="pc-module-sub pc-warn">📖 ${esc(T('restudyFirst'))}</div>`;
      action = isFinal
        ? `<button type="button" class="pc-btn pc-btn-primary" data-act="reviewAll">${esc(T('reviewAllBtn'))}</button>`
        : `<button type="button" class="pc-btn pc-btn-primary" data-act="restudy" data-key="${esc(key)}">${esc(T('restudyBtn'))}</button>`;
    } else {
      const meta = isFinal ? (qCount + ' Q') : (lessonCount + ' 📖 · ' + qCount + ' Q');
      stateHtml = `<div class="pc-module-sub pc-muted">${esc(meta)}</div>`;
      action = isFinal
        ? `<button type="button" class="pc-btn pc-btn-primary" data-act="quiz" data-key="final">${esc(T('start'))}</button>`
        : `<button type="button" class="pc-btn pc-btn-primary" data-act="study" data-key="${esc(key)}">${esc(T('start'))}</button>`;
    }
    return `<div class="pc-module-card${unlocked ? '' : ' pc-locked'}${isFinal ? ' pc-final-card' : ''}">
      <div class="pc-module-icon">${icon}</div>
      <div class="pc-module-info">
        <div class="pc-module-title">${esc(title)}</div>
        ${stateHtml}
      </div>
      ${action}
    </div>`;
  }

  // ── LESSONS ────────────────────────────────────────────────
  function startLessons(moduleId, forRestudy) {
    const mod = COURSE.modules.find(m => m.id === moduleId);
    if (!mod) return;
    lessonCtx = {
      steps: mod.lessons,
      idx: 0,
      moduleTitle: L(mod.title),
      forRestudy: !!forRestudy,
      testKey: moduleId,
      finalReview: false
    };
    renderLessonStep();
  }
  function startReviewAll() {
    // Final-exam restudy: every lesson of every module in one flow.
    const steps = [];
    COURSE.modules.forEach(m => m.lessons.forEach(ls => steps.push(ls)));
    lessonCtx = { steps, idx: 0, moduleTitle: L(COURSE.finalExam.title), forRestudy: true, testKey: 'final', finalReview: true };
    renderLessonStep();
  }
  // Optional lesson media. A lesson may carry:
  //   image: 'url' or { url, caption: {en,tr} }   -> inline picture
  //   video: a YouTube link                        -> embedded player
  //          (any other URL falls back to a "watch" link)
  //   link:  { url, label: {en,tr} }               -> external link
  function youTubeEmbed(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    // youtube-nocookie (privacy-enhanced) is less likely to be blocked by
    // browser tracking-prevention or privacy extensions than youtube.com.
    return m ? ('https://www.youtube-nocookie.com/embed/' + m[1]) : null;
  }
  function lessonMediaHtml(ls) {
    let extra = '';
    if (ls.image) {
      const im = (typeof ls.image === 'string') ? { url: ls.image } : ls.image;
      extra += '<figure class="pc-media"><img src="' + esc(im.url) + '" alt="" loading="lazy">' +
        (im.caption ? '<figcaption>' + esc(L(im.caption)) + '</figcaption>' : '') + '</figure>';
    }
    if (ls.video) {
      const emb = youTubeEmbed(ls.video);
      if (emb) {
        extra += '<div class="pc-video"><iframe src="' + esc(emb) + '" title="Lesson video" allow="accelerometer; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>';
        // Always offer a direct link too: if the embed is blocked (tracking
        // prevention, a privacy/ad extension, or a network firewall on
        // YouTube), the student can still open the video in a new tab.
        extra += '<p class="pc-video-fallback"><a class="pc-ext-link" href="' + esc(ls.video) + '" target="_blank" rel="noopener">&#9654; ' + (lang === 'tr' ? 'Video açılmıyor mu? YouTube\'da izleyin' : "Video not loading? Watch on YouTube") + '</a></p>';
      } else {
        extra += '<p><a class="pc-ext-link" href="' + esc(ls.video) + '" target="_blank" rel="noopener">&#9654; ' + (lang === 'tr' ? 'Videoyu izle' : 'Watch the video') + '</a></p>';
      }
    }
    if (ls.link && ls.link.url) {
      extra += '<p><a class="pc-ext-link" href="' + esc(ls.link.url) + '" target="_blank" rel="noopener">&#128279; ' + esc(L(ls.link.label) || ls.link.url) + '</a></p>';
    }
    return extra;
  }

  function renderLessonStep() {
    const c = lessonCtx;
    const ls = c.steps[c.idx];
    $('pcStepLabel').textContent = c.moduleTitle + ' · ' + T('step') + ' ' + (c.idx + 1) + ' ' + T('of') + ' ' + c.steps.length;
    $('pcLessonTitle').textContent = L(ls.title);
    $('pcLessonBody').innerHTML =
      L(ls.body).split(/\n\n+/).map(p => '<p>' + esc(p) + '</p>').join('') +
      lessonMediaHtml(ls);
    $('pcLessonPrev').style.visibility = c.idx === 0 ? 'hidden' : 'visible';
    const last = c.idx === c.steps.length - 1;
    $('pcLessonNext').textContent = last ? (c.forRestudy ? T('finishRestudy') : T('goToQuiz')) : T('next');
    showMain('pcLesson');
  }
  async function lessonNext() {
    const c = lessonCtx;
    if (c.idx < c.steps.length - 1) { c.idx++; renderLessonStep(); return; }
    // Finished the steps
    if (c.forRestudy) {
      const patch = {};
      if (c.testKey === 'final') patch.finalExam = { restudy: false };
      else patch.modules = { [c.testKey]: { restudy: false } };
      await saveProgress(patch);
      await reloadProgress();
      renderOverview();
    } else {
      startQuiz(c.testKey);
    }
  }

  // ── QUIZ ───────────────────────────────────────────────────
  function startQuiz(testKey) {
    const st = testState(testKey);
    if (st.bannedNow || (st.restudy && !st.passed)) { renderOverview(); return; }
    let questions, title;
    if (testKey === 'final') {
      if (!allModulesPassed()) { renderOverview(); return; }
      questions = COURSE.finalExam.questions;
      title = L(COURSE.finalExam.title);
    } else {
      const mod = COURSE.modules.find(m => m.id === testKey);
      if (!mod) return;
      questions = mod.quiz;
      title = L(mod.title) + ' · ' + T('quiz');
    }
    quizCtx = { testKey, title, questions, idx: 0, wrong: 0, correct: 0, answered: false };
    renderQuizQ();
  }
  function renderQuizQ() {
    const c = quizCtx;
    const q = c.questions[c.idx];
    c.answered = false;
    $('pcQuizTitle').textContent = c.title;
    $('pcQuizProgress').textContent = T('question') + ' ' + (c.idx + 1) + ' ' + T('of') + ' ' + c.questions.length;
    $('pcLives').textContent = T('mistakesLeft') + ': ' + (MAX_WRONG - c.wrong);
    $('pcQuizQ').textContent = L(q.q);
    $('pcQuizFeedback').innerHTML = '';
    // Reshuffle option order per render, remembering which is correct.
    const opts = q.options.map((o, i) => ({ text: L(o), correct: i === q.answer }));
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    $('pcQuizOpts').innerHTML = opts.map(o =>
      `<button type="button" class="pc-opt" data-correct="${o.correct ? '1' : '0'}">${esc(o.text)}</button>`).join('');
    $('pcQuizOpts').querySelectorAll('.pc-opt').forEach(btn => btn.addEventListener('click', () => answer(btn)));
    showMain('pcQuiz');
  }
  function answer(btn) {
    const c = quizCtx;
    if (c.answered) return;
    c.answered = true;
    const right = btn.getAttribute('data-correct') === '1';
    document.querySelectorAll('.pc-opt').forEach(b => { b.disabled = true; if (b.getAttribute('data-correct') === '1') b.classList.add('is-right'); });
    if (right) { c.correct++; btn.classList.add('is-right'); }
    else { c.wrong++; btn.classList.add('is-wrong'); $('pcLives').textContent = T('mistakesLeft') + ': ' + Math.max(0, MAX_WRONG - c.wrong); }
    $('pcQuizFeedback').innerHTML = `<div class="pc-feedback ${right ? 'ok' : 'no'}">${right ? T('correct') : T('wrong')}</div>`;
    setTimeout(() => {
      if (c.wrong > MAX_WRONG) { failTest(); return; }
      if (c.idx < c.questions.length - 1) { c.idx++; renderQuizQ(); }
      else { passTest(); }
    }, 900);
  }

  async function failTest() {
    const c = quizCtx;
    const prev = testState(c.testKey);
    const newFails = prev.fails + 1;
    const node = {
      fails: firebase.firestore.FieldValue.increment(1),
      restudy: true,
      lastFailAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await saveProgress(c.testKey === 'final' ? { finalExam: node } : { modules: { [c.testKey]: node } });
    await reloadProgress();
    const banned = newFails >= 2;
    $('pcResultCard').innerHTML = `
      <div class="pc-result-icon">${banned ? '⛔' : '📖'}</div>
      <h2>${esc(T('failTitle'))}</h2>
      <p>${esc(banned ? T('failBanBody') : T('failRestudyBody'))}</p>
      <p class="pc-muted">${esc(T('yourScore'))}: ${c.correct} / ${c.questions.length}</p>
      <button type="button" class="pc-btn pc-btn-primary" id="pcResultBack">${esc(T('backToCourse'))}</button>`;
    $('pcResultBack').addEventListener('click', renderOverview);
    showMain('pcResult');
  }

  async function passTest() {
    const c = quizCtx;
    const node = {
      passed: true,
      score: c.correct,
      total: c.questions.length,
      restudy: false,
      passedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const patch = (c.testKey === 'final') ? { finalExam: node } : { modules: { [c.testKey]: node } };
    let earnedCert = false;
    let newCertId = null, newCertName = null;
    if (c.testKey === 'final' && !(progress && progress.certificate && progress.certificate.certId)) {
      earnedCert = true;
      newCertId = 'EL-' + (user.uid || 'X').slice(0, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      newCertName = (userDoc && (userDoc.name || userDoc.displayName)) || user.displayName || user.email || 'Student';
      patch.certificate = {
        certId: newCertId,
        earnedAt: firebase.firestore.FieldValue.serverTimestamp(),
        name: newCertName,
        score: c.correct,
        total: c.questions.length
      };
    }
    if (!progress || !progress.startedAt) patch.startedAt = firebase.firestore.FieldValue.serverTimestamp();
    await saveProgress(patch);
    // Public verification record, keyed by the certificate code, so a
    // teacher can later fact-check a code + name (see /certificates rule).
    // Non-fatal: the certificate still works from courseProgress if this fails.
    if (earnedCert && newCertId) {
      try {
        await db.collection('certificates').doc(newCertId).set({
          certId: newCertId,
          uid: user.uid,
          name: newCertName,
          courseId: COURSE.id || 'ai-guidelines',
          courseName: L(COURSE.certificate && COURSE.certificate.courseName) || 'AI Use Guidelines',
          score: c.correct,
          total: c.questions.length,
          earnedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) { console.warn('certificate record write failed', e); }
    }
    await reloadProgress();
    $('pcResultCard').innerHTML = `
      <div class="pc-result-icon">🎉</div>
      <h2>${esc(c.testKey === 'final' ? T('passFinalTitle') : T('passTitle'))}</h2>
      <p class="pc-muted">${esc(T('yourScore'))}: ${c.correct} / ${c.questions.length}</p>
      ${earnedCert || c.testKey === 'final'
        ? `<button type="button" class="pc-btn pc-btn-gold" id="pcResultCert">${esc(T('viewCert'))}</button>`
        : ''}
      <button type="button" class="pc-btn pc-btn-primary" id="pcResultBack">${esc(T('backToCourse'))}</button>`;
    $('pcResultBack').addEventListener('click', renderOverview);
    const cb = $('pcResultCert');
    if (cb) cb.addEventListener('click', renderCertificate);
    showMain('pcResult');
  }

  // ── CERTIFICATE ────────────────────────────────────────────
  // Academic year for the statement: the student's registered year,
  // else derived from the earn date (Sep-Aug cycle).
  function academicYearOf(date) {
    const reg = userDoc && userDoc.academicYear;
    if (reg) return String(reg);
    const y = date.getFullYear();
    const start = (date.getMonth() + 1) >= 9 ? y : y - 1;
    return start + '-' + (start + 1);
  }
  function renderCertificate() {
    const cert = progress && progress.certificate;
    if (!cert || !cert.certId) { renderOverview(); return; }
    const when = (cert.earnedAt && typeof cert.earnedAt.toDate === 'function') ? cert.earnedAt.toDate() : new Date();

    $('pcCertName').textContent = cert.name || 'Student';

    // Statement: italic text with the course name in bold caps, like the
    // printed certificate. {course} / {year} placeholders, all escaped.
    const stmt = L(COURSE.certificate.statement) || '';
    const parts = stmt.split('{course}');
    const courseHtml = '<strong>' + esc(L(COURSE.certificate.courseName)) + '</strong>';
    $('pcCertStatement').innerHTML = parts
      .map(p => esc(p.replace('{year}', academicYearOf(when))))
      .join(courseHtml);

    // Signatories: a row of signature columns (name + title), built from
    // certificate.signatories. Falls back to the legacy single sign fields.
    const signRow = $('pcCertSignRow');
    if (signRow) {
      const sigs = Array.isArray(COURSE.certificate.signatories) && COURSE.certificate.signatories.length
        ? COURSE.certificate.signatories
        : [{ name: COURSE.certificate.signName || '', title: COURSE.certificate.signTitle || { en: '', tr: '' } }];
      signRow.innerHTML = sigs.map(s =>
        '<div class="pc-cert-sig">' +
          '<div class="pc-cert-sig-script">' + esc(s.name || '') + '</div>' +
          '<div class="pc-cert-sig-line"></div>' +
          '<div class="pc-cert-sig-name">' + esc(s.name || '') + '</div>' +
          '<div class="pc-cert-sig-title">' + esc(L(s.title) || '') + '</div>' +
        '</div>').join('');
    }

    $('pcCertScore').textContent = (cert.score != null ? cert.score + ' / ' + cert.total : '');
    $('pcCertDate').textContent = when.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    $('pcCertId').textContent = cert.certId;
    applyI18n();
    showMain('pcCertificate');
  }

  // ── Boot ───────────────────────────────────────────────────
  async function boot(u) {
    user = u;
    try {
      const [uSnap, cfgSnap, pSnap] = await Promise.all([
        db.collection('users').doc(u.uid).get(),
        db.collection('settings').doc('policyCourse').get(),
        db.collection('courseProgress').doc(u.uid).get()
      ]);
      userDoc = uSnap.exists ? uSnap.data() : {};
      progress = pSnap.exists ? pSnap.data() : null;
      const cfg = cfgSnap.exists ? cfgSnap.data() : null;
      // Assignment-style scoping (all / class / level / module / year);
      // course-target.js holds the shared check, legacy classes[] included.
      const activeForMe = (typeof window.courseActiveFor === 'function')
        ? window.courseActiveFor(cfg, userDoc)
        : !!(cfg && cfg.active);
      // Teachers/admins may always preview the course page.
      const isStaff = userDoc && (userDoc.role === 'teacher' || userDoc.role === 'admin');
      if (!activeForMe && !isStaff) { show('pcInactive'); applyI18n(); return; }

      $('pcStudentChip').textContent = (userDoc && (userDoc.name || userDoc.displayName)) || u.displayName || '';
      show('pcApp');
      renderOverview();
    } catch (e) {
      console.error('policy course boot', e);
      show('pcInactive');
      applyI18n();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Static wiring
    $('pcLangBtn').addEventListener('click', () => {
      lang = lang === 'en' ? 'tr' : 'en';
      localStorage.setItem('policyCourseLang', lang);
      applyI18n();
      // Re-render whichever view is open
      if ($('pcLesson').style.display !== 'none') renderLessonStep();
      else if ($('pcQuiz').style.display !== 'none') renderQuizQ();
      else if ($('pcCertificate').style.display !== 'none') renderCertificate();
      else renderOverview();
    });
    $('pcLessonNext').addEventListener('click', lessonNext);
    $('pcLessonPrev').addEventListener('click', () => { if (lessonCtx.idx > 0) { lessonCtx.idx--; renderLessonStep(); } });
    $('pcLessonExit').addEventListener('click', renderOverview);
    $('pcQuizExit').addEventListener('click', () => {
      // Leaving a quiz mid-way does NOT count as a fail; the questions
      // restart on the next attempt.
      if (typeof AppDialog !== 'undefined' && AppDialog.confirm) {
        AppDialog.confirm(lang === 'tr' ? 'Sınavdan çıkılsın mı? Cevaplar kaydedilmez.' : 'Leave the quiz? Your answers will not be saved.')
          .then(ok => { if (ok) renderOverview(); });
      } else { renderOverview(); }
    });
    $('pcCertBack').addEventListener('click', renderOverview);

    auth.onAuthStateChanged(u => {
      if (!u) { window.location.href = 'index.html'; return; }
      boot(u);
    });
  });
})();
