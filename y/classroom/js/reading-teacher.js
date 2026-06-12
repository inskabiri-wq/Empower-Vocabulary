/* ============================================================
   READING CLASSROOM — Teacher (host) controller
   ----------------------------------------------------------------
   Architecture mirrors the Trust No One host:
     • Teacher's tab is the REFEREE (no Cloud Functions).
     • Host fetches the exam JSON locally, strips out the answer
       key + passageHtml before writing the student-safe
       manifest to Firestore.
     • Students read ONLY the safe manifest from /reading_sessions
       /{code}.questionsManifest — they never get the answer key
       and never fetch the source JSON via Firestore.
     • Scoring happens host-side: this tab compares each student's
       /answers subcollection against the in-memory answer key.
     • At reveal time, the host writes the answer key to
       session.revealedAnswers — students then render per-question
       breakdown for class discussion.

   Firestore shape:
     /reading_sessions/{code}
       { code, status: 'lobby' | 'live' | 'revealed' | 'finished',
         hostUid, hostName,
         examLevel, examId, examTitle, examSubtitle,
         passageTitle, passageSubtitle,
         questionsManifest: { sections: [...] },   // no answers
         totalQuestions, timeLimitSec, discussionPhase,
         revealedAnswers: { 'sectionId__itemId': 'correctAnswer' },
         createdAt, startedAt, endedAt, revealedAt }
       /players/{uid}
         { uid, name, avatar,
           submitted: boolean, submittedAt,
           score, correctCount,
           joinedAt }
         /answers/{questionId}              ('sectionId__itemId')
           { sectionId, itemId, value, updatedAt }
   ============================================================ */
(function () {
  'use strict';

  // ── Firebase init ──────────────────────────────────────────
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
  const db   = firebase.firestore();

  // ── State ──────────────────────────────────────────────────
  let currentUser    = null;
  let sessionCode    = null;
  let examData       = null;          // FULL exam (with answers) — host only
  let answerKey      = null;          // { 'sectionId__itemId': correctValue }
  let unsubPlayers   = null;
  let unsubSession   = null;
  let unsubAnswers   = {};            // map of uid → unsubscribe fn
  let timerInterval  = null;
  let gameInFlight   = false;
  let allPlayersCache = [];
  let allAnswersCache = {};           // map of "uid__sectionId__itemId" → value

  // ── Projector-safe eye toggle ──────────────────────────────
  // OFF by default — the teacher's screen is safe to mirror to the
  // class projector (no green/red dots, no scores, no answer key).
  // Toggling ON reveals everything. State persisted to localStorage
  // so it survives reloads within the same browser.
  const EYES_KEY = 'reading-classroom-eyes-on';
  let eyesOn = (() => {
    try { return localStorage.getItem(EYES_KEY) === '1'; } catch (_) { return false; }
  })();
  function setEyes(on) {
    eyesOn = !!on;
    try { localStorage.setItem(EYES_KEY, eyesOn ? '1' : '0'); } catch (_) {}
    applyEyesUI();
    // Re-render so the dots / stats / answer-key reflect the new state.
    renderProgressGrid();
    renderAnswerKey();
  }
  function applyEyesUI() {
    const btn   = document.getElementById('eyesToggleBtn');
    const icon  = document.getElementById('eyesIcon');
    const lbl   = document.getElementById('eyesLabel');
    const chip  = document.getElementById('projectorSafeChip');
    const akDet = document.getElementById('answerKeyDetails');
    if (btn) btn.setAttribute('aria-pressed', eyesOn ? 'true' : 'false');
    if (icon) icon.textContent = eyesOn ? '👁' : '🙈';
    if (lbl)  lbl.textContent  = eyesOn ? 'Hide answers' : 'Show answers';
    // The "📺 Projector-safe" chip only shows when eyes are off.
    if (chip) chip.style.display = eyesOn ? 'none' : '';
    // Answer-key panel is hidden entirely when eyes are off.
    if (akDet) akDet.style.display = eyesOn ? '' : 'none';
  }

  // ── Avatar helpers ─────────────────────────────────────────
  const AVATARS = ['📖','📚','📝','✏️','📓','📔','📕','📗','📘','📙','📰','🔖','📑'];
  function avatarFor(seed) {
    // Stable per-name avatar (so the same student always gets the same icon).
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return AVATARS[Math.abs(h) % AVATARS.length];
  }

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function generateCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let out = '';
    for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'reading-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  function setView(id) {
    document.documentElement.removeAttribute('data-reading-view');
    ['auto-creating','lobby','live','results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }
  function ask(title, msg, okLabel) {
    return new Promise(resolve => {
      const bg = document.getElementById('readingConfirm');
      const titleEl = document.getElementById('readingConfirmTitle');
      const msgEl   = document.getElementById('readingConfirmMsg');
      const okBtn   = document.getElementById('readingConfirmOk');
      const cnBtn   = document.getElementById('readingConfirmCancel');
      if (!bg) return resolve(window.confirm(msg));
      titleEl.textContent = title || 'Are you sure?';
      msgEl.textContent   = msg   || '';
      okBtn.textContent   = okLabel || 'Confirm';
      bg.classList.add('active');
      bg.style.display = '';
      const cleanup = (val) => {
        bg.classList.remove('active');
        bg.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cnBtn.removeEventListener('click', onCancel);
        resolve(val);
      };
      const onOk     = () => cleanup(true);
      const onCancel = () => cleanup(false);
      okBtn.addEventListener('click', onOk);
      cnBtn.addEventListener('click', onCancel);
    });
  }

  // ── Auth gate ──────────────────────────────────────────────
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.replace('index.html');
      return;
    }
    currentUser = user;
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? (doc.data().role || 'student') : 'student';
      if (role !== 'teacher' && role !== 'admin') {
        document.body.innerHTML =
          '<div style="padding:40px; text-align:center; color:#f1f5f9; font-family:sans-serif;">Teachers only.</div>';
        return;
      }
    } catch (e) {
      console.error('role check failed', e);
    }
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.displayName || user.email || 'Teacher';

    const params = new URLSearchParams(location.search);
    if (params.get('auto') === '1') {
      const settings = {
        level: params.get('level') || '',
        examId: params.get('exam') || '',
        durationMin: parseInt(params.get('dur') || '20', 10),
        discussionPhase: parseInt(params.get('disc') || '1', 10) === 1
      };
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
      setView('auto-creating');
      await createSession(settings);
      if (!sessionCode) {
        window.location.replace('classroom-teacher.html');
      }
      return;
    }
    window.location.replace('classroom-teacher.html');
  });

  // ── Load + sanitize exam ───────────────────────────────────
  // Fetches the full exam JSON from the source file, builds the
  // student-safe manifest (no answer key, no passageHtml) for
  // writing to Firestore, and caches the answer key in memory.
  async function loadAndSanitizeExam(level, examId) {
    if (typeof window.EXAM_REGISTRY === 'undefined') {
      throw new Error('Exam registry missing');
    }
    const meta = window.EXAM_REGISTRY.find('reading', examId);
    if (!meta) throw new Error(`Exam not found: ${level}/${examId}`);
    const res = await fetch(meta.file);
    if (!res.ok) throw new Error(`Failed to load ${meta.file}: ${res.status}`);
    const raw = await res.json();

    // Resolve which passage (most are passageIndex: 0).
    let passage;
    if (typeof meta.passageIndex === 'number') {
      passage = raw.passages && raw.passages[meta.passageIndex];
    } else {
      passage = raw.passages && raw.passages[0];
    }
    if (!passage) throw new Error('Passage missing in exam JSON');

    // Build the safe manifest + the parallel answer key.
    // We only emit sections of supported types (mcq / match-gaps /
    // match-headings / find-word). Other types (free-text / writing)
    // would require teacher grading after the fact — out of scope here.
    const safeSections = [];
    const akey = {};
    const supported = new Set(['mcq', 'match-gaps', 'match-headings', 'find-word']);

    (passage.sections || []).forEach(sec => {
      if (!supported.has(sec.type)) return;   // skip ungradeable types
      const safeSec = {
        id: sec.id,
        type: sec.type,
        label: sec.label || '',
        instructions: sec.instructions || ''
      };
      if (sec.type === 'match-gaps' || sec.type === 'match-headings') {
        // Section-level options are shared by all items in this section.
        safeSec.options = (sec.options || []).map(o => ({ id: o.id, text: o.text }));
      }
      safeSec.items = (sec.items || []).map(it => {
        const safeItem = { id: it.id };
        if (sec.type === 'mcq') {
          safeItem.question = it.question || '';
          safeItem.options  = (it.options || []).map(o => ({ id: o.id, text: o.text }));
        } else if (sec.type === 'match-gaps' || sec.type === 'match-headings') {
          safeItem.label = it.label || '';
        } else if (sec.type === 'find-word') {
          safeItem.definition = it.definition || '';
        }
        // Bank the correct answer in the host-only key.
        const k = sec.id + '__' + it.id;
        akey[k] = {
          type: sec.type,
          answer: it.answer || null,
          acceptable: it.acceptable || null
        };
        return safeItem;
      });
      // Only include sections that have at least one item.
      if (safeSec.items.length) safeSections.push(safeSec);
    });

    const totalQuestions = Object.keys(akey).length;
    if (!totalQuestions) {
      throw new Error('This exam has no auto-gradable questions');
    }

    return {
      meta,
      passageTitle:    passage.title || raw.title || 'Reading',
      passageSubtitle: passage.subtitle || raw.subtitle || '',
      passageHtml:     passage.passageHtml || '',
      questionsManifest: { sections: safeSections },
      totalQuestions,
      answerKey: akey
    };
  }

  // ── Create session ─────────────────────────────────────────
  async function createSession(settings) {
    let exam;
    try {
      exam = await loadAndSanitizeExam(settings.level, settings.examId);
    } catch (e) {
      console.error('loadAndSanitizeExam', e);
      toast('Could not load the exam: ' + e.message, 'fail');
      return;
    }
    examData = exam;
    answerKey = exam.answerKey;

    // Generate unique 4-letter room code.
    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('reading_sessions').doc(code).get();
      if (!exists.exists) break;
      code = generateCode();
    }

    const session = {
      code,
      status: 'lobby',
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      examLevel: settings.level,
      examId: exam.meta.id,
      examTitle: exam.meta.title || '',
      examSubtitle: exam.meta.subtitle || '',
      passageTitle: exam.passageTitle,
      passageSubtitle: exam.passageSubtitle,
      // The student-safe manifest. NO answer keys. NO passage text.
      questionsManifest: exam.questionsManifest,
      totalQuestions: exam.totalQuestions,
      timeLimitSec: Math.max(0, (settings.durationMin || 0) * 60),
      discussionPhase: !!settings.discussionPhase,
      revealedAnswers: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null,
      revealedAt: null
    };

    try {
      await db.collection('reading_sessions').doc(code).set(session);
      sessionCode = code;
      enterLobby(code);
    } catch (e) {
      console.error('createSession', e);
      toast('Could not create the room: ' + e.message, 'fail');
    }
  }

  // ── Lobby ──────────────────────────────────────────────────
  function enterLobby(code) {
    setView('lobby');

    document.getElementById('roomCode').textContent = code;
    const url = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}classroom-reading-student.html?code=${encodeURIComponent(code)}`;
    const urlEl = document.getElementById('joinUrl');
    if (urlEl) { urlEl.textContent = url; urlEl.href = url; }
    const qrImg = document.getElementById('qrImg');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;
    const ttl = document.getElementById('lobbyExamTitle');
    if (ttl) ttl.textContent = examData.meta.title || 'Reading exam';

    unsubPlayers = db.collection('reading_sessions').doc(code).collection('players')
      .orderBy('joinedAt', 'asc')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        renderRoster(players);
      });
  }
  function renderRoster(players) {
    const el = document.getElementById('roster');
    const count = document.getElementById('rosterCount');
    if (count) count.textContent = players.length;
    if (!players.length) {
      el.innerHTML = '<p style="color: var(--text-muted, #6b7280); text-align: center; padding: 20px; grid-column: 1/-1;">Waiting for students to join…</p>';
      const btn = document.getElementById('startBtn');
      btn.disabled = true;
      btn.textContent = '📖 Need at least 1 student to start';
      return;
    }
    el.innerHTML = players.map(p => `
      <div class="player-card">
        <div class="player-avatar">${escHtml(p.avatar || avatarFor(p.name || ''))}</div>
        <div class="player-name">${escHtml(p.name)}</div>
        <div class="player-status ready">✓ Ready</div>
      </div>`).join('');
    const btn = document.getElementById('startBtn');
    btn.disabled = false;
    btn.textContent = `📖 Start exam (${players.length} student${players.length === 1 ? '' : 's'})`;
  }

  // ── Start exam ─────────────────────────────────────────────
  async function startExam() {
    if (!sessionCode) return;
    try {
      await db.collection('reading_sessions').doc(sessionCode).update({
        status: 'live',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
    } catch (e) {
      console.error('startExam', e);
      toast('Could not start the exam: ' + e.message, 'fail');
    }
  }

  // ── Live host view ─────────────────────────────────────────
  function enterLive() {
    setView('live');
    document.getElementById('liveCode').textContent = sessionCode;

    // Render the passage on the host's projector pane.
    renderPassagePane();
    // Render the host-only answer key reference.
    renderAnswerKey();

    if (unsubSession) unsubSession();
    unsubSession = db.collection('reading_sessions').doc(sessionCode)
      .onSnapshot(doc => {
        const d = doc.data();
        if (!d) return;
        if (d.status === 'finished') showResults();
        const startedAt = d.startedAt && d.startedAt.toMillis ? d.startedAt.toMillis() : null;
        if (startedAt && !timerInterval && d.timeLimitSec > 0) {
          startTimer(startedAt, d.timeLimitSec);
        } else if (d.timeLimitSec === 0) {
          const el = document.getElementById('liveTimer');
          if (el) el.textContent = '∞';
        }
      });

    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('reading_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        allPlayersCache = players;
        // Subscribe to each player's /answers if we haven't already.
        // We need the answers to score them in real time.
        players.forEach(p => {
          if (unsubAnswers[p.uid]) return;
          unsubAnswers[p.uid] = db.collection('reading_sessions').doc(sessionCode)
            .collection('players').doc(p.uid).collection('answers')
            .onSnapshot(ansnap => {
              ansnap.docs.forEach(adoc => {
                const a = adoc.data();
                const k = p.uid + '__' + adoc.id;
                allAnswersCache[k] = a.value;
              });
              renderProgressGrid();
            });
        });
        // Drop subscriptions for players who left (rare in classroom).
        Object.keys(unsubAnswers).forEach(uid => {
          if (!players.find(p => p.uid === uid)) {
            try { unsubAnswers[uid](); } catch (_) {}
            delete unsubAnswers[uid];
          }
        });
        renderProgressGrid();
        updateSubmittedCounter();
      });
  }

  function renderPassagePane() {
    if (!examData) return;
    const t = document.getElementById('passageTitle');
    const s = document.getElementById('passageSubtitle');
    const body = document.getElementById('passageBody');
    if (t) t.textContent = examData.passageTitle || 'Passage';
    if (s) s.textContent = examData.passageSubtitle || '';
    if (body) body.innerHTML = examData.passageHtml || '';
  }

  function renderAnswerKey() {
    const el = document.getElementById('answerKeyBody');
    if (!el || !examData) return;
    const rows = [];
    examData.questionsManifest.sections.forEach(sec => {
      rows.push(`<div class="ak-section"><strong>${escHtml(sec.label || sec.id)}</strong> <span style="color:var(--r-text-mut); font-size:0.85em;">(${sec.type})</span></div>`);
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        const a = answerKey[k];
        let ans = '';
        if (a) {
          if (sec.type === 'mcq' || sec.type === 'match-gaps' || sec.type === 'match-headings') {
            ans = String(a.answer || '—').toUpperCase();
          } else if (sec.type === 'find-word') {
            ans = a.answer || '—';
          }
        }
        rows.push(`<div class="ak-row"><span class="ak-id">${escHtml(it.id)}</span><span class="ak-ans">${escHtml(ans)}</span></div>`);
      });
    });
    el.innerHTML = rows.join('');
  }

  // Lenient compare for free-text grading — case-insensitive,
  // strip leading articles + punctuation, accept any item in
  // the acceptable[] array.
  function freeTextMatch(input, ak) {
    const norm = (s) => String(s || '')
      .toLowerCase()
      .trim()
      .replace(/^[\(\[\{]+|[\)\]\}\.\,\!\?\;\:]+$/g, '')
      .replace(/^(a|an|the|one)\s+/, '')
      .replace(/[\(\)\[\]\{\}\.\,\!\?\;\:'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const u = norm(input);
    if (!u) return false;
    const candidates = ak.acceptable && ak.acceptable.length
      ? ak.acceptable
      : (ak.answer ? [ak.answer] : []);
    return candidates.some(a => norm(a) === u);
  }

  // Score one student against the in-memory answer key. Returns
  // { score: 0-100, correct: N, total: M, perQ: { questionId: bool } }.
  function scoreStudent(uid) {
    const total = Object.keys(answerKey).length;
    let correct = 0;
    const perQ = {};
    Object.keys(answerKey).forEach(k => {
      const a = answerKey[k];
      const studentValue = allAnswersCache[uid + '__' + k];
      let isRight = false;
      if (studentValue != null && studentValue !== '') {
        if (a.type === 'mcq' || a.type === 'match-gaps' || a.type === 'match-headings') {
          isRight = String(studentValue).toLowerCase() === String(a.answer || '').toLowerCase();
        } else if (a.type === 'find-word') {
          isRight = freeTextMatch(studentValue, a);
        }
      }
      if (isRight) correct++;
      perQ[k] = isRight;
    });
    const score = total ? Math.round((correct / total) * 100) : 0;
    return { score, correct, total, perQ };
  }

  function renderProgressGrid() {
    const grid = document.getElementById('progressGrid');
    const totalEl = document.getElementById('liveTotalStudents');
    if (totalEl) totalEl.textContent = String(allPlayersCache.length);
    const liveProg = document.getElementById('liveProgressCount');
    if (liveProg) liveProg.textContent = `${allPlayersCache.length} student${allPlayersCache.length === 1 ? '' : 's'}`;
    if (!grid) return;
    if (!allPlayersCache.length) {
      grid.innerHTML = '<div class="progress-empty">Students will appear here as they answer.</div>';
      return;
    }
    const totalQ = Object.keys(answerKey).length;
    grid.innerHTML = allPlayersCache.map(p => {
      const { score, correct } = scoreStudent(p.uid);
      // Count how many they've answered (vs. correct).
      let answered = 0;
      Object.keys(answerKey).forEach(k => {
        if (allAnswersCache[p.uid + '__' + k] != null && allAnswersCache[p.uid + '__' + k] !== '') answered++;
      });
      const submitted = !!p.submitted;
      const submittedClass = submitted ? 'submitted' : '';
      // Per-question dots. When eyes are OFF (projector-safe default),
      // we ONLY signal answered/unanswered with a neutral colour —
      // no green/red, so the projected screen can't be reverse-engineered
      // by students staring at it. With eyes ON the host sees the
      // right/wrong colours.
      const dots = Object.keys(answerKey).map(k => {
        const has = allAnswersCache[p.uid + '__' + k] != null && allAnswersCache[p.uid + '__' + k] !== '';
        if (!has) return '<span class="ak-dot empty"></span>';
        if (!eyesOn) return '<span class="ak-dot answered"></span>';
        // Eyes on — show right/wrong.
        const isRight = (function () {
          const a = answerKey[k];
          const v = allAnswersCache[p.uid + '__' + k];
          if (a.type === 'mcq' || a.type === 'match-gaps' || a.type === 'match-headings') {
            return String(v).toLowerCase() === String(a.answer || '').toLowerCase();
          } else if (a.type === 'find-word') {
            return freeTextMatch(v, a);
          }
          return false;
        })();
        return `<span class="ak-dot ${isRight ? 'right' : 'wrong'}"></span>`;
      }).join('');
      // Stats line — answered count is always safe to show; correct
      // + percentage are gated behind eyes-on.
      const statsHtml = eyesOn
        ? `<span class="pt-stat">${answered}/${totalQ} answered</span>
           <span class="pt-stat strong">${correct}/${totalQ} correct</span>
           <span class="pt-stat">${score}%</span>`
        : `<span class="pt-stat">${answered}/${totalQ} answered</span>`;
      return `
        <div class="progress-tile ${submittedClass}">
          <div class="pt-head">
            <span class="pt-ava">${escHtml(p.avatar || avatarFor(p.name || ''))}</span>
            <span class="pt-name">${escHtml(p.name)}</span>
            ${submitted ? '<span class="pt-submitted">✓ submitted</span>' : ''}
          </div>
          <div class="pt-stats">
            ${statsHtml}
          </div>
          <div class="pt-dots">${dots}</div>
        </div>`;
    }).join('');
  }

  function updateSubmittedCounter() {
    const subCount = allPlayersCache.filter(p => p.submitted).length;
    const el = document.getElementById('liveSubmittedCount');
    if (el) el.textContent = String(subCount);
  }

  function startTimer(startedAtMs, durationSec) {
    const endMs = startedAtMs + durationSec * 1000;
    const el = document.getElementById('liveTimer');
    const tick = () => {
      const r = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      const m = Math.floor(r / 60);
      const s = String(r % 60).padStart(2, '0');
      if (el) el.textContent = `${m}:${s}`;
      if (r <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Auto-end the exam when the timer hits zero.
        endExam().catch(() => {});
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  // ── Reveal ─────────────────────────────────────────────────
  // Host clicks "Reveal answers" → writes the answer key to
  // session.revealedAnswers + flips status to 'revealed'. Student
  // tabs pick this up and render the per-question breakdown.
  async function revealAnswers() {
    if (!sessionCode || !answerKey) return;
    // Strip out the .acceptable[] (only the host's grader needed
    // those) — students see the canonical .answer for display.
    const revealed = {};
    Object.keys(answerKey).forEach(k => {
      revealed[k] = answerKey[k].answer || '';
    });
    try {
      await db.collection('reading_sessions').doc(sessionCode).update({
        status: 'revealed',
        revealedAnswers: revealed,
        revealedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Also persist each student's score so the revealed view can
      // show consistent numbers even after the host closes their tab.
      const batch = db.batch();
      const sref = db.collection('reading_sessions').doc(sessionCode);
      allPlayersCache.forEach(p => {
        const { score, correct } = scoreStudent(p.uid);
        batch.update(sref.collection('players').doc(p.uid), { score, correctCount: correct });
      });
      await batch.commit();
      toast('🔓 Answers revealed to the class', 'success');
    } catch (e) {
      console.error('revealAnswers', e);
      toast('Could not reveal: ' + e.message, 'fail');
    }
  }

  // ── End exam + results ─────────────────────────────────────
  async function endExam() {
    if (!sessionCode) return;
    try {
      // Final-score persistence (idempotent — reveal already did it
      // if we passed through that state, but we re-do it here so
      // "end without reveal" also captures scores).
      const sref = db.collection('reading_sessions').doc(sessionCode);
      const batch = db.batch();
      allPlayersCache.forEach(p => {
        const { score, correct } = scoreStudent(p.uid);
        batch.update(sref.collection('players').doc(p.uid), { score, correctCount: correct });
      });
      batch.update(sref, {
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();
    } catch (e) {
      console.error('endExam', e);
    }
  }

  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameInFlight = false;
    setView('results');

    try {
      const sref = db.collection('reading_sessions').doc(sessionCode);
      const psnap = await sref.collection('players').orderBy('score', 'desc').get();
      const players = psnap.docs.map(d => d.data());

      // Mission stats grid
      const totalQ = Object.keys(answerKey).length;
      const totalStudents = players.length;
      const totalSubmitted = players.filter(p => p.submitted).length;
      const avgScore = players.length
        ? Math.round(players.reduce((s, p) => s + (p.score || 0), 0) / players.length)
        : 0;
      const top = players[0] || null;
      const statsEl = document.getElementById('resultsStats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="stat-tile"><div class="stat-num">${totalStudents}</div><div class="stat-lbl">👥 Students</div></div>
          <div class="stat-tile"><div class="stat-num">${totalSubmitted}</div><div class="stat-lbl">📤 Submitted</div></div>
          <div class="stat-tile"><div class="stat-num">${avgScore}%</div><div class="stat-lbl">📊 Avg score</div></div>
          <div class="stat-tile"><div class="stat-num">${totalQ}</div><div class="stat-lbl">❓ Questions</div></div>
          <div class="stat-tile"><div class="stat-num">${top ? Math.round(top.score || 0) + '%' : '—'}</div><div class="stat-lbl">🥇 Top</div></div>
        `;
      }

      const titleEl = document.getElementById('resultsTitle');
      const subEl   = document.getElementById('resultsSub');
      if (titleEl) titleEl.textContent = 'Exam complete';
      if (subEl)   subEl.textContent   = `${totalSubmitted} of ${totalStudents} students submitted · class average ${avgScore}%.`;

      // Per-question breakdown — for each question, what % of students
      // got it right + which option was the most common choice.
      const perQEl = document.getElementById('perQuestionGrid');
      if (perQEl) {
        const rows = [];
        examData.questionsManifest.sections.forEach(sec => {
          rows.push(`<div class="per-q-section-h">${escHtml(sec.label || sec.id)} — <span style="color:var(--r-text-mut); font-weight:400;">${sec.type}</span></div>`);
          sec.items.forEach(it => {
            const k = sec.id + '__' + it.id;
            const ak = answerKey[k];
            let rightCount = 0;
            let answeredCount = 0;
            const dist = Object.create(null);
            allPlayersCache.forEach(p => {
              const v = allAnswersCache[p.uid + '__' + k];
              if (v == null || v === '') return;
              answeredCount++;
              dist[String(v).toLowerCase()] = (dist[String(v).toLowerCase()] || 0) + 1;
              let isRight = false;
              if (ak.type === 'mcq' || ak.type === 'match-gaps' || ak.type === 'match-headings') {
                isRight = String(v).toLowerCase() === String(ak.answer || '').toLowerCase();
              } else if (ak.type === 'find-word') {
                isRight = freeTextMatch(v, ak);
              }
              if (isRight) rightCount++;
            });
            const pct = answeredCount ? Math.round((rightCount / answeredCount) * 100) : 0;
            rows.push(`
              <div class="per-q-row">
                <div class="per-q-id">${escHtml(it.id)}</div>
                <div class="per-q-ans">→ <strong>${escHtml(String(ak.answer || ''))}</strong></div>
                <div class="per-q-bar">
                  <div class="per-q-bar-fill" style="width:${pct}%;"></div>
                </div>
                <div class="per-q-pct">${pct}% (${rightCount}/${answeredCount})</div>
              </div>`);
          });
        });
        perQEl.innerHTML = rows.join('');
      }

      // Per-student table
      const tbody = document.getElementById('resultsTable');
      tbody.innerHTML = players.map((p, i) => `
        <tr class="${p.submitted ? '' : 'unsubmitted'}">
          <td>${i + 1}</td>
          <td>${escHtml(p.avatar || avatarFor(p.name || ''))} ${escHtml(p.name)}</td>
          <td><strong>${p.score || 0}%</strong></td>
          <td>${p.correctCount || 0} / ${totalQ}</td>
          <td>${p.submitted ? '✓' : '—'}</td>
        </tr>`).join('');
    } catch (e) {
      console.error('showResults', e);
    }
    cleanupListeners();
  }

  function cleanupListeners() {
    if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
    if (unsubSession) { unsubSession(); unsubSession = null; }
    Object.keys(unsubAnswers).forEach(uid => {
      try { unsubAnswers[uid](); } catch (_) {}
    });
    unsubAnswers = {};
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ── DOM wiring ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', startExam);
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await ask('End the exam?',
        'All in-progress students will be stopped and the results screen will open.',
        'End exam');
      if (ok) endExam();
    });
    document.getElementById('revealBtn').addEventListener('click', async () => {
      const ok = await ask('Reveal answers?',
        'Students will see the per-question breakdown. The exam is still live until you click End exam.',
        'Reveal');
      if (ok) revealAnswers();
    });
    // Projector-safe eye toggle — default OFF (set once on load via
    // applyEyesUI). Clicking flips the saved state + re-renders the
    // progress grid and answer-key panel.
    const eyesBtn = document.getElementById('eyesToggleBtn');
    if (eyesBtn) eyesBtn.addEventListener('click', () => setEyes(!eyesOn));
    applyEyesUI();
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });

    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      ask('Leave the exam?',
        `An exam is in progress. Leaving to ${label} will leave students hanging.`,
        'Leave anyway').then(ok => { if (ok) window.location.href = href; });
    }
    const b1 = document.getElementById('backToClassroom');
    const b2 = document.getElementById('backToDashboard');
    if (b1) b1.addEventListener('click', (e) => confirmLeave(e, 'Classroom Mode'));
    if (b2) b2.addEventListener('click', (e) => confirmLeave(e, 'the dashboard'));
  });

  window.addEventListener('beforeunload', (e) => {
    cleanupListeners();
    if (gameInFlight) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
})();
