/* ============================================================
   LISTENING CLASSROOM — Teacher (host) controller
   ----------------------------------------------------------------
   Architecturally identical to reading-teacher.js — same
   no-leak posture, same client-side grading, same reveal flow.
   Differences:
     • Left pane is an <audio> element instead of a passage div.
     • Host controls play/pause/restart/seek; replay counter
       enforced by `replayPolicy`.
     • Audio URL pulled from EXAM_REGISTRY at runtime, NEVER
       written to Firestore (so students never see it).
     • Host advances `activeQuestionKey` on the session doc so
       students' phones can highlight the current Q.
     • Host writes `audioStatus` + `replayCount` to the session
       so students can render the live status string.

   Question content lives in LISTENING_EXAMS (loaded by the host
   page via student/js/listening-exam.js). It's declared `const`
   at script scope, so it's accessible by bare name from this IIFE
   — NOT on `window`. (That bug bit us in Phase 3 — Create button
   bounced back to the picker because the check was `window.LISTENING_EXAMS`,
   always undefined.)  Each exam has sections of type
   'truefalse' | 'mcq' | 'fillblank'.
   ============================================================ */
(function () {
  'use strict';

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
  let examData       = null;          // { meta, audioUrl, questionsManifest, totalQuestions, answerKey }
  let answerKey      = null;
  let replayPolicy   = 'teacher';
  let replayCount    = 0;
  let qMarkerBroadcast = true;
  let audioEl        = null;
  let audioStartedOnce = false;
  let unsubPlayers   = null;
  let unsubSession   = null;
  let unsubAnswers   = {};
  let timerInterval  = null;
  let gameInFlight   = false;
  let allPlayersCache = [];
  let allAnswersCache = {};

  // ── Projector-safe eye toggle (same pattern as reading-teacher.js) ──
  const EYES_KEY = 'listening-classroom-eyes-on';
  let eyesOn = (() => {
    try { return localStorage.getItem(EYES_KEY) === '1'; } catch (_) { return false; }
  })();
  function setEyes(on) {
    eyesOn = !!on;
    try { localStorage.setItem(EYES_KEY, eyesOn ? '1' : '0'); } catch (_) {}
    applyEyesUI();
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
    if (chip) chip.style.display = eyesOn ? 'none' : '';
    if (akDet) akDet.style.display = eyesOn ? '' : 'none';
  }
  let qKeyOrder      = [];            // ordered list of "sectionId__itemId"
  let activeQIndex   = -1;            // -1 means "none broadcast"

  const AVATARS = ['🎧','🎶','🎵','🎤','📻','🔉','🔊','🎼','🎙️','📢','📣'];
  function avatarFor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return AVATARS[Math.abs(h) % AVATARS.length];
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function fmtTime(secs) {
    if (!isFinite(secs)) return '--:--';
    secs = Math.max(0, Math.floor(secs));
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  function generateCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let out = '';
    for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'listening-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  function setView(id) {
    document.documentElement.removeAttribute('data-listening-view');
    ['auto-creating','lobby','live','results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }
  function ask(title, msg, okLabel) {
    return new Promise(resolve => {
      const bg = document.getElementById('listeningConfirm');
      const titleEl = document.getElementById('listeningConfirmTitle');
      const msgEl   = document.getElementById('listeningConfirmMsg');
      const okBtn   = document.getElementById('listeningConfirmOk');
      const cnBtn   = document.getElementById('listeningConfirmCancel');
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
        durationMin: parseInt(params.get('dur') || '30', 10),
        discussionPhase: parseInt(params.get('disc') || '1', 10) === 1,
        qMarker: parseInt(params.get('qmark') || '1', 10) === 1,
        replayPolicy: params.get('policy') || 'teacher'
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
  // Look up the audio path from EXAM_REGISTRY and the question
  // content from LISTENING_EXAMS (both loaded by the host HTML).
  // Build the student-safe manifest with all `answer` fields
  // stripped; bank the answer key in memory only.
  function loadAndSanitizeExam(level, examId) {
    if (typeof window.EXAM_REGISTRY === 'undefined') {
      throw new Error('Exam registry missing');
    }
    // LISTENING_EXAMS is `const` at script scope (not on window).
    // typeof on an undeclared identifier returns 'undefined' without
    // throwing — perfect for this check.
    if (typeof LISTENING_EXAMS === 'undefined') {
      throw new Error('Listening exam content missing — load student/js/listening-exam.js');
    }
    const meta = window.EXAM_REGISTRY.find('listening', examId);
    if (!meta) throw new Error(`Exam not found: ${level}/${examId}`);
    const fullExam = LISTENING_EXAMS.find(e => e.id === examId);
    if (!fullExam) throw new Error(`Listening content missing for ${examId}`);

    const supported = new Set(['mcq', 'truefalse', 'fillblank']);
    const safeSections = [];
    const akey = {};
    const orderedKeys = [];

    (fullExam.sections || []).forEach((sec, secIdx) => {
      if (!supported.has(sec.type)) return;
      // Derive a stable section id since listening-exam.js uses
      // `title` not `id` for sections. Fall back to position-based.
      const secId = sec.id || ('sec' + (secIdx + 1));
      const safeSec = {
        id: secId,
        type: sec.type,
        label: sec.title || sec.label || ('Section ' + (secIdx + 1)),
        instructions: sec.instruction || sec.instructions || ''
      };
      // For listening MCQs, options are strings (not {id,text}).
      // We map them to {id: 'a'/'b'/'c'/'d', text: '…'}.
      // For truefalse, we synthesize the option list here.
      safeSec.items = (sec.questions || sec.items || []).map(it => {
        const safeItem = { id: it.id, text: it.text || it.question || '' };
        if (sec.type === 'mcq') {
          safeItem.options = (it.options || []).map((opt, i) => {
            if (typeof opt === 'string') {
              return { id: String.fromCharCode(97 + i), text: opt };
            }
            return { id: opt.id, text: opt.text };
          });
        }
        // truefalse + fillblank don't need extra option metadata —
        // student-side renderer will inject T/F radios or text input.
        const k = secId + '__' + it.id;
        akey[k] = {
          type: sec.type,
          answer: it.answer || null
        };
        orderedKeys.push(k);
        return safeItem;
      });
      if (safeSec.items.length) safeSections.push(safeSec);
    });

    const totalQuestions = Object.keys(akey).length;
    if (!totalQuestions) {
      throw new Error('This exam has no auto-gradable questions');
    }

    return {
      meta,
      audioUrl: meta.audio || fullExam.audio || '',
      title: fullExam.title || meta.title || '',
      subtitle: meta.subtitle || '',
      questionsManifest: { sections: safeSections },
      totalQuestions,
      answerKey: akey,
      orderedKeys
    };
  }

  // ── Create session ─────────────────────────────────────────
  async function createSession(settings) {
    let exam;
    try {
      exam = loadAndSanitizeExam(settings.level, settings.examId);
    } catch (e) {
      console.error('loadAndSanitizeExam', e);
      toast('Could not load the exam: ' + e.message, 'fail');
      return;
    }
    examData     = exam;
    answerKey    = exam.answerKey;
    qKeyOrder    = exam.orderedKeys.slice();
    replayPolicy = settings.replayPolicy || 'teacher';
    qMarkerBroadcast = !!settings.qMarker;

    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('listening_sessions').doc(code).get();
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
      examTitle: exam.title,
      examSubtitle: exam.subtitle,
      questionsManifest: exam.questionsManifest,
      totalQuestions: exam.totalQuestions,
      timeLimitSec: Math.max(0, (settings.durationMin || 0) * 60),
      discussionPhase: !!settings.discussionPhase,
      qMarkerBroadcast: !!settings.qMarker,
      replayPolicy,
      // Audio playback state — host updates as audio plays.
      audioStatus: 'idle',              // idle | playing | paused | ended
      replayCount: 0,
      activeQuestionKey: null,          // null = no broadcast
      revealedAnswers: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null,
      revealedAt: null
    };

    try {
      await db.collection('listening_sessions').doc(code).set(session);
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
    const url = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}classroom-listening-student.html?code=${encodeURIComponent(code)}`;
    const urlEl = document.getElementById('joinUrl');
    if (urlEl) { urlEl.textContent = url; urlEl.href = url; }
    const qrImg = document.getElementById('qrImg');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;
    const ttl = document.getElementById('lobbyExamTitle');
    if (ttl) ttl.textContent = examData.title || 'Listening exam';
    const hint = document.getElementById('lobbyReplayHint');
    if (hint) {
      hint.textContent = (
        replayPolicy === 'once'      ? '🔒 Once-only playback — no replays allowed.' :
        replayPolicy === 'unlimited' ? '♾️ Unlimited replays available.' :
                                        '🎚️ Teacher-controlled playback.'
      );
    }

    unsubPlayers = db.collection('listening_sessions').doc(code).collection('players')
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
      btn.textContent = '🎧 Need at least 1 student to start';
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
    btn.textContent = `🎧 Start exam (${players.length} student${players.length === 1 ? '' : 's'})`;
  }

  // ── Start exam ─────────────────────────────────────────────
  async function startExam() {
    if (!sessionCode) return;
    try {
      await db.collection('listening_sessions').doc(sessionCode).update({
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
    setupAudio();
    renderAnswerKey();
    updatePolicyChip();

    if (unsubSession) unsubSession();
    unsubSession = db.collection('listening_sessions').doc(sessionCode)
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
    unsubPlayers = db.collection('listening_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        allPlayersCache = players;
        players.forEach(p => {
          if (unsubAnswers[p.uid]) return;
          unsubAnswers[p.uid] = db.collection('listening_sessions').doc(sessionCode)
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

  // ── Audio control ──────────────────────────────────────────
  function setupAudio() {
    audioEl = document.getElementById('hostAudio');
    if (!audioEl || !examData.audioUrl) return;
    audioEl.src = examData.audioUrl;
    // Audio metadata might not be loaded yet — wait for it.
    audioEl.addEventListener('loadedmetadata', () => {
      const dur = audioEl.duration;
      const durEl  = document.getElementById('audioDuration');
      const seekEl = document.getElementById('audioSeek');
      if (durEl)  durEl.textContent  = fmtTime(dur);
      if (seekEl) seekEl.max         = String(dur);
    });
    audioEl.addEventListener('timeupdate', () => {
      const curEl  = document.getElementById('audioCurrent');
      const seekEl = document.getElementById('audioSeek');
      const fillEl = document.getElementById('audioProgressFill');
      if (curEl)  curEl.textContent  = fmtTime(audioEl.currentTime);
      if (seekEl && !seekEl.dataset.seeking) seekEl.value = String(audioEl.currentTime);
      if (fillEl && audioEl.duration) {
        fillEl.style.width = ((audioEl.currentTime / audioEl.duration) * 100) + '%';
      }
    });
    audioEl.addEventListener('play', () => {
      updatePlayPauseIcon();
      // Count a replay only when restarting from the very beginning
      // AFTER the first play (initial play doesn't count).
      writeAudioStatus('playing');
    });
    audioEl.addEventListener('pause', () => {
      updatePlayPauseIcon();
      if (!audioEl.ended) writeAudioStatus('paused');
    });
    audioEl.addEventListener('ended', () => {
      updatePlayPauseIcon();
      writeAudioStatus('ended');
    });

    // Title display
    const tt = document.getElementById('audioTitle');
    const ts = document.getElementById('audioSubtitle');
    if (tt) tt.textContent = examData.title;
    if (ts) ts.textContent = examData.subtitle;
  }
  function updatePlayPauseIcon() {
    const icon = document.getElementById('playPauseIcon');
    if (!icon || !audioEl) return;
    icon.textContent = audioEl.paused ? '▶' : '⏸';
  }
  function updatePolicyChip() {
    const chip = document.getElementById('policyChip');
    if (!chip) return;
    chip.textContent = (
      replayPolicy === 'once'      ? 'Policy: once only' :
      replayPolicy === 'unlimited' ? 'Policy: unlimited' :
                                      'Policy: teacher-controlled'
    );
  }
  // Enforce the replay policy before allowing play. Returns true
  // if play is OK to start; false if blocked (with a toast).
  function canPlay() {
    if (!audioEl) return false;
    if (replayPolicy !== 'once') return true;
    // 'once' means: the audio can play through ONCE. Pause/resume
    // is fine, but restarting from the beginning after `ended` is
    // blocked.
    if (audioStartedOnce && audioEl.ended) {
      toast('Replay disabled by policy (once only).', 'fail');
      return false;
    }
    return true;
  }
  function togglePlayPause() {
    if (!audioEl) return;
    if (audioEl.paused) {
      if (!canPlay()) return;
      audioStartedOnce = true;
      audioEl.play().catch(err => {
        console.error('play', err);
        toast('Could not play the audio: ' + err.message, 'fail');
      });
    } else {
      audioEl.pause();
    }
  }
  function restartAudio() {
    if (!audioEl) return;
    if (replayPolicy === 'once' && audioStartedOnce) {
      toast('Replay disabled by policy (once only).', 'fail');
      return;
    }
    audioEl.currentTime = 0;
    // Bump replay counter if this isn't the initial play.
    if (audioStartedOnce) {
      replayCount++;
      const rEl = document.getElementById('replayCountVal');
      if (rEl) rEl.textContent = String(replayCount);
      try {
        db.collection('listening_sessions').doc(sessionCode).update({
          replayCount
        });
      } catch (_) {}
    }
    audioEl.play().catch(() => {});
  }
  function skipBy(seconds) {
    if (!audioEl) return;
    audioEl.currentTime = Math.max(0, Math.min(audioEl.duration || 0, audioEl.currentTime + seconds));
  }
  async function writeAudioStatus(status) {
    if (!sessionCode) return;
    try {
      const update = { audioStatus: status };
      if (status === 'playing' && !audioStartedOnce) {
        // First-ever play timestamp recorded once.
        update.audioFirstPlayedAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      await db.collection('listening_sessions').doc(sessionCode).update(update);
    } catch (e) { /* swallow — not fatal */ }
  }

  // ── Q-marker ───────────────────────────────────────────────
  // Broadcast which question students should focus on right now.
  // The student client reads session.activeQuestionKey and scrolls
  // the matching item into view + highlights it.
  function setQMarker(idx) {
    if (!qMarkerBroadcast) {
      toast('Q-marker broadcast is off for this exam.', 'fail');
      return;
    }
    activeQIndex = idx;
    let key = null;
    if (idx >= 0 && idx < qKeyOrder.length) key = qKeyOrder[idx];
    const lbl = document.getElementById('qMarkerLabel');
    if (lbl) {
      lbl.textContent = key
        ? `Now on: ${key.replace('__', ' · ')}  (${idx + 1} / ${qKeyOrder.length})`
        : 'No Q broadcast';
    }
    try {
      db.collection('listening_sessions').doc(sessionCode).update({
        activeQuestionKey: key
      });
    } catch (_) {}
  }
  function nextQ() { setQMarker(Math.min(qKeyOrder.length - 1, activeQIndex + 1)); }
  function prevQ() { setQMarker(Math.max(-1, activeQIndex - 1)); }
  function clearQ() { setQMarker(-1); }

  // ── Answer key + progress grid (host-only) ─────────────────
  function renderAnswerKey() {
    const el = document.getElementById('answerKeyBody');
    if (!el || !examData) return;
    const rows = [];
    examData.questionsManifest.sections.forEach(sec => {
      rows.push(`<div class="ak-section"><strong>${escHtml(sec.label || sec.id)}</strong> <span style="color:var(--l-text-mut); font-size:0.85em;">(${sec.type})</span></div>`);
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        const a = answerKey[k];
        const ans = a ? String(a.answer || '—') : '—';
        rows.push(`<div class="ak-row"><span class="ak-id">${escHtml(it.id)}</span><span class="ak-ans">${escHtml(ans.toUpperCase ? ans.toUpperCase() : ans)}</span></div>`);
      });
    });
    el.innerHTML = rows.join('');
  }

  // Grading helpers
  function gradeOne(uid, key) {
    const a = answerKey[key];
    if (!a) return false;
    const v = allAnswersCache[uid + '__' + key];
    if (v == null || v === '') return false;
    if (a.type === 'truefalse' || a.type === 'mcq') {
      return String(v).toLowerCase() === String(a.answer || '').toLowerCase();
    }
    if (a.type === 'fillblank') {
      // Lenient: case-insensitive trim, strip basic punctuation.
      const norm = (s) => String(s || '').toLowerCase().trim()
        .replace(/^[\(\[\{]+|[\)\]\}\.\,\!\?\;\:]+$/g, '')
        .replace(/^(a|an|the|one)\s+/, '')
        .replace(/[\(\)\[\]\{\}\.\,\!\?\;\:'"]/g, '')
        .replace(/\s+/g, ' ').trim();
      return norm(v) === norm(a.answer || '');
    }
    return false;
  }
  function scoreStudent(uid) {
    const total = Object.keys(answerKey).length;
    let correct = 0;
    Object.keys(answerKey).forEach(k => { if (gradeOne(uid, k)) correct++; });
    const score = total ? Math.round((correct / total) * 100) : 0;
    return { score, correct, total };
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
      let answered = 0;
      Object.keys(answerKey).forEach(k => {
        const v = allAnswersCache[p.uid + '__' + k];
        if (v != null && v !== '') answered++;
      });
      const submitted = !!p.submitted;
      const submittedClass = submitted ? 'submitted' : '';
      const dots = Object.keys(answerKey).map(k => {
        const v = allAnswersCache[p.uid + '__' + k];
        if (v == null || v === '') return '<span class="ak-dot empty"></span>';
        // Projector-safe: only show answered/unanswered when eyes off.
        if (!eyesOn) return '<span class="ak-dot answered"></span>';
        const isRight = gradeOne(p.uid, k);
        return `<span class="ak-dot ${isRight ? 'right' : 'wrong'}"></span>`;
      }).join('');
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
          <div class="pt-stats">${statsHtml}</div>
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
        endExam().catch(() => {});
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  // ── Reveal ─────────────────────────────────────────────────
  async function revealAnswers() {
    if (!sessionCode || !answerKey) return;
    const revealed = {};
    Object.keys(answerKey).forEach(k => {
      revealed[k] = answerKey[k].answer || '';
    });
    try {
      await db.collection('listening_sessions').doc(sessionCode).update({
        status: 'revealed',
        revealedAnswers: revealed,
        revealedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const batch = db.batch();
      const sref = db.collection('listening_sessions').doc(sessionCode);
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

  async function endExam() {
    if (!sessionCode) return;
    try {
      const sref = db.collection('listening_sessions').doc(sessionCode);
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
      // Stop the audio if it's still playing.
      if (audioEl) { try { audioEl.pause(); } catch (_) {} }
    } catch (e) {
      console.error('endExam', e);
    }
  }

  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameInFlight = false;
    setView('results');
    try {
      const sref = db.collection('listening_sessions').doc(sessionCode);
      const psnap = await sref.collection('players').orderBy('score', 'desc').get();
      const players = psnap.docs.map(d => d.data());

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
          <div class="stat-tile"><div class="stat-num">${replayCount}</div><div class="stat-lbl">🔁 Replays</div></div>
          <div class="stat-tile"><div class="stat-num">${top ? Math.round(top.score || 0) + '%' : '—'}</div><div class="stat-lbl">🥇 Top</div></div>
        `;
      }

      const titleEl = document.getElementById('resultsTitle');
      const subEl   = document.getElementById('resultsSub');
      if (titleEl) titleEl.textContent = 'Exam complete';
      if (subEl)   subEl.textContent   = `${totalSubmitted} of ${totalStudents} students submitted · class average ${avgScore}%.`;

      const perQEl = document.getElementById('perQuestionGrid');
      if (perQEl) {
        const rows = [];
        examData.questionsManifest.sections.forEach(sec => {
          rows.push(`<div class="per-q-section-h">${escHtml(sec.label || sec.id)} — <span style="color:var(--l-text-mut); font-weight:400;">${sec.type}</span></div>`);
          sec.items.forEach(it => {
            const k = sec.id + '__' + it.id;
            const ak = answerKey[k];
            let rightCount = 0;
            let answeredCount = 0;
            allPlayersCache.forEach(p => {
              const v = allAnswersCache[p.uid + '__' + k];
              if (v == null || v === '') return;
              answeredCount++;
              if (gradeOne(p.uid, k)) rightCount++;
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
    // Projector-safe eye toggle (default OFF, localStorage persisted).
    const eyesBtn = document.getElementById('eyesToggleBtn');
    if (eyesBtn) eyesBtn.addEventListener('click', () => setEyes(!eyesOn));
    applyEyesUI();
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });

    // Audio controls
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.getElementById('restartBtn').addEventListener('click', restartAudio);
    document.getElementById('back10Btn').addEventListener('click', () => skipBy(-10));
    document.getElementById('fwd10Btn').addEventListener('click', () => skipBy(10));
    const seek = document.getElementById('audioSeek');
    if (seek) {
      // Mark seeking so timeupdate doesn't fight the user input.
      seek.addEventListener('input',  () => { seek.dataset.seeking = '1'; });
      seek.addEventListener('change', () => {
        if (audioEl) audioEl.currentTime = parseFloat(seek.value) || 0;
        delete seek.dataset.seeking;
      });
    }

    // Q-marker
    document.getElementById('qPrevBtn').addEventListener('click', prevQ);
    document.getElementById('qNextBtn').addEventListener('click', nextQ);
    document.getElementById('qClearBtn').addEventListener('click', clearQ);

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
