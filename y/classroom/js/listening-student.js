/* ============================================================
   LISTENING CLASSROOM — Student client
   ----------------------------------------------------------------
   Same no-leak rules as the Reading Classroom student.
   Differences:
     • No passage rendering anywhere.
     • Subscribe to session.audioStatus + render a live "Playing
       now" / "Paused" / "Audio finished" hint.
     • Subscribe to session.activeQuestionKey and, when it changes,
       scroll the matching question into view + add a glowing
       highlight ring (sky-blue, never green/red).
     • Section types: 'truefalse', 'mcq', 'fillblank' (listening's
       three; the renderer maps these to radios / radios / text).
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

  // ── State ─────────────────────────────────────────────────
  let user        = null;
  let myUid       = null;
  let myName      = '';
  let myAvatar    = '🎧';
  let sessionCode = null;
  let session     = null;
  let manifest    = null;
  let myAnswers   = {};
  let unsubs      = [];
  let submitted   = false;
  let examTimerInt = null;
  let lastActiveQKey = null;

  const AVATARS = ['🎧','🎶','🎵','🎤','📻','🔉','🔊','🎼','🎙️','📢','📣'];
  function randomAvatar() { return AVATARS[Math.floor(Math.random() * AVATARS.length)]; }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function setView(id) {
    ['join','waiting','exam','submitted','revealed','done'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'listening-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Auth ──────────────────────────────────────────────────
  async function ensureAuth() {
    if (auth.currentUser) { user = auth.currentUser; myUid = user.uid; return; }
    try {
      const cred = await auth.signInAnonymously();
      user = cred.user; myUid = user.uid;
    } catch (e) {
      console.error('anon auth', e);
      if (e && e.code === 'auth/operation-not-allowed') {
        toast('Anonymous sign-in is disabled. Ask your teacher to enable it.', 'fail');
      } else {
        toast('Could not sign you in: ' + (e.message || e), 'fail');
      }
    }
  }

  // ── Join ──────────────────────────────────────────────────
  async function joinRoom() {
    await ensureAuth();
    if (!myUid) return;

    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    const name = document.getElementById('nameInput').value.trim().slice(0, 24);
    if (!code) { toast('Enter a room code', 'fail'); return; }
    if (!name) { toast('Enter your name', 'fail'); return; }

    sessionCode = code;
    myName = name;
    myAvatar = randomAvatar();

    const sref = db.collection('listening_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { toast('Room not found', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { toast('That exam has ended', 'fail'); return; }
    manifest = session.questionsManifest || null;
    if (!manifest) { toast('Exam not ready yet — try again in a moment.', 'fail'); return; }

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid, name: myName, avatar: myAvatar,
        submitted: false, score: 0, correctCount: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('join', e);
      toast('Could not join: ' + e.message, 'fail');
      return;
    }

    subscribeSession();
    subscribePlayer();
    subscribeMyAnswers();
    setIdStrip();
    setView(session.status === 'live' ? 'exam' : 'waiting');
    if (session.status === 'live') enterExam();
  }

  function setIdStrip() {
    const el = document.getElementById('myIdStrip');
    if (!el) return;
    el.style.display = '';
    el.innerHTML = `
      <span class="listening-chip">${escHtml(myAvatar)} ${escHtml(myName)}</span>
      <span class="listening-chip" id="myStatusChip">${submitted ? '✓ submitted' : 'in progress'}</span>
    `;
  }

  // ── Subscriptions ─────────────────────────────────────────
  function subscribeSession() {
    const sref = db.collection('listening_sessions').doc(sessionCode);
    const u = sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      const prevStatus = session && session.status;
      const prevActiveKey = session && session.activeQuestionKey;
      session = d;

      if (d.status === 'live' && prevStatus !== 'live') enterExam();

      if (d.status === 'revealed') {
        if (submitted) {
          if (d.discussionPhase !== false) enterRevealed();
        } else {
          submitFinal(true);
        }
      }
      if (d.status === 'finished') {
        if (!submitted) submitFinal(true);
        const onRevealed = document.getElementById('view-revealed') &&
                           document.getElementById('view-revealed').style.display !== 'none';
        if (!onRevealed) setView('done');
        if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }
      }

      // Audio status hint string
      updateAudioStatusHint();

      // Q-marker — only if broadcast is enabled by the host.
      if (d.qMarkerBroadcast !== false && d.activeQuestionKey !== prevActiveKey) {
        lastActiveQKey = d.activeQuestionKey;
        applyQMarker(d.activeQuestionKey);
      }
    });
    unsubs.push(u);
  }
  function subscribePlayer() {
    const ref = db.collection('listening_sessions').doc(sessionCode).collection('players').doc(myUid);
    const u = ref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      submitted = !!d.submitted;
      const chip = document.getElementById('myStatusChip');
      if (chip) chip.textContent = submitted ? '✓ submitted' : 'in progress';
      if (submitted) {
        const totalQ = (session && session.totalQuestions) || 0;
        const fs = document.getElementById('finalScore');
        const ft = document.getElementById('finalTotal');
        const fp = document.getElementById('finalPercent');
        if (fs) fs.textContent = String(d.correctCount || 0);
        if (ft) ft.textContent = String(totalQ);
        if (fp && totalQ) fp.textContent = Math.round(((d.correctCount || 0) / totalQ) * 100) + '%';
      }
    });
    unsubs.push(u);
  }
  function subscribeMyAnswers() {
    const ref = db.collection('listening_sessions').doc(sessionCode)
      .collection('players').doc(myUid).collection('answers');
    const u = ref.onSnapshot(snap => {
      snap.docs.forEach(d => { myAnswers[d.id] = d.data().value; });
      reflectAnswersInUI();
      updateAnsweredCount();
    });
    unsubs.push(u);
  }

  // ── Audio status hint ─────────────────────────────────────
  // Renders the live string under the exam title — pure UI affordance
  // so students know whether the audio is currently playing.
  function updateAudioStatusHint() {
    const row = document.getElementById('audioStatusRow');
    const txt = document.getElementById('audioStatusText');
    const dot = document.getElementById('audioStatusDot');
    if (!row || !txt || !dot || !session) return;
    const s = session.audioStatus || 'idle';
    const replays = session.replayCount || 0;
    row.dataset.status = s;
    dot.className = 'audio-status-dot status-' + s;
    if (s === 'playing') {
      txt.textContent = `🔊 Audio is playing${replays > 0 ? ` · replay ${replays}` : ''}`;
    } else if (s === 'paused') {
      txt.textContent = `⏸ Audio paused${replays > 0 ? ` · replay ${replays}` : ''}`;
    } else if (s === 'ended') {
      txt.textContent = `✅ Audio finished${replays > 0 ? ` · ${replays} replay${replays === 1 ? '' : 's'} used` : ''}`;
    } else {
      txt.textContent = 'Listen for your teacher to start the audio.';
    }
  }

  // ── Q-marker ──────────────────────────────────────────────
  // When the host advances the active question key, scroll the
  // matching exam item into view and add a sky-blue highlight ring.
  // The highlight is purely an attention nudge — it doesn't reveal
  // correctness in any way.
  function applyQMarker(key) {
    const wrap = document.getElementById('examSections');
    if (!wrap) return;
    wrap.querySelectorAll('.exam-item.is-active-q').forEach(el => el.classList.remove('is-active-q'));
    if (!key) return;
    const el = wrap.querySelector(`.exam-item[data-q="${CSS.escape(key)}"]`);
    if (!el) return;
    // Auto-expand the parent section AND the question itself if they
    // were collapsed — otherwise the Q-marker would land inside a
    // zero-height container and the student wouldn't see anything.
    const parentSec = el.closest('.exam-section');
    if (parentSec && parentSec.classList.contains('is-collapsed')) {
      parentSec.classList.remove('is-collapsed');
      const head = parentSec.querySelector('.exam-section-h');
      if (head) head.setAttribute('aria-expanded', 'true');
    }
    if (el.classList.contains('is-collapsed')) {
      el.classList.remove('is-collapsed');
      const btn = el.querySelector('.exam-item-toggle');
      if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Collapse this question');
      }
    }
    el.classList.add('is-active-q');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Exam view ─────────────────────────────────────────────
  let examRendered = false;
  function enterExam() {
    setView('exam');
    if (!examRendered) {
      renderExamShell();
      examRendered = true;
    }
    updateAudioStatusHint();
    // Apply any pending Q-marker from initial session snapshot.
    if (session && session.activeQuestionKey) applyQMarker(session.activeQuestionKey);

    // Timer
    if (session && session.timeLimitSec > 0 && session.startedAt && session.startedAt.toMillis) {
      const endMs = session.startedAt.toMillis() + session.timeLimitSec * 1000;
      const el = document.getElementById('examTimer');
      const val = document.getElementById('examTimerVal');
      if (el && val) {
        el.style.display = '';
        const tick = () => {
          const r = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
          const m = Math.floor(r / 60);
          const s = String(r % 60).padStart(2, '0');
          val.textContent = `${m}:${s}`;
          if (r <= 0) {
            if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }
            if (!submitted) submitFinal(true);
          }
        };
        tick();
        if (examTimerInt) clearInterval(examTimerInt);
        examTimerInt = setInterval(tick, 1000);
      }
    }
  }

  function renderExamShell() {
    if (!manifest) return;
    const ttl = document.getElementById('examTitle');
    if (ttl) ttl.textContent = session.examTitle || 'Listening Exam';

    const tot = document.getElementById('totalCount');
    if (tot) tot.textContent = String(session.totalQuestions || 0);

    const wrap = document.getElementById('examSections');
    if (!wrap) return;

    wrap.innerHTML = (manifest.sections || []).map(sec => {
      // Accordion-wrapped section — clicking the header collapses the
      // body. Defaults to expanded so first-paint behaviour is
      // identical to the pre-accordion build. Mirrors the reading
      // classroom pattern exactly.
      let out = `
        <div class="exam-section">
          <button type="button" class="exam-section-h" aria-expanded="true">
            <span class="exam-section-label">${escHtml(sec.label || sec.id)}</span>
            <span class="exam-section-type">${escHtml(sec.type)}</span>
            <span class="exam-section-chevron" aria-hidden="true">▾</span>
          </button>
          <div class="exam-section-body">
          ${sec.instructions ? `<div class="exam-section-instr">${escHtml(sec.instructions)}</div>` : ''}
      `;
      // Per-question accordion — same pattern as reading classroom.
      // Each .exam-item gets a stem (with a chevron button at the
      // right) + a wrapped .exam-item-body holding the answer area.
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        const stemHead = (label) => `
          <div class="exam-item-stem">
            <span class="exam-item-stem-text">${label}</span>
            <button type="button" class="exam-item-toggle"
                    aria-expanded="true"
                    aria-label="Collapse this question"
                    title="Click to collapse this question">▾</button>
          </div>`;
        if (sec.type === 'mcq') {
          out += `
            <div class="exam-item" data-q="${escHtml(k)}">
              ${stemHead(`<strong>${escHtml(it.id)}.</strong> ${escHtml(it.text || '')}`)}
              <div class="exam-item-body">
                <div class="exam-options">
                  ${(it.options || []).map(o => `
                    <label class="exam-opt" data-value="${escHtml(o.id)}">
                      <input type="radio" name="${escHtml(k)}" value="${escHtml(o.id)}">
                      <span class="exam-opt-label">${escHtml(o.id).toUpperCase()}</span>
                      <span class="exam-opt-text">${escHtml(o.text)}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>`;
        } else if (sec.type === 'truefalse') {
          out += `
            <div class="exam-item" data-q="${escHtml(k)}">
              ${stemHead(`<strong>${escHtml(it.id)}.</strong> ${escHtml(it.text || '')}`)}
              <div class="exam-item-body">
                <div class="exam-options exam-options-tf">
                  <label class="exam-opt" data-value="T">
                    <input type="radio" name="${escHtml(k)}" value="T">
                    <span class="exam-opt-label">T</span>
                    <span class="exam-opt-text">True</span>
                  </label>
                  <label class="exam-opt" data-value="F">
                    <input type="radio" name="${escHtml(k)}" value="F">
                    <span class="exam-opt-label">F</span>
                    <span class="exam-opt-text">False</span>
                  </label>
                </div>
              </div>
            </div>`;
        } else if (sec.type === 'fillblank') {
          out += `
            <div class="exam-item" data-q="${escHtml(k)}">
              ${stemHead(`<strong>${escHtml(it.id)}.</strong> ${escHtml(it.text || '')}`)}
              <div class="exam-item-body">
                <input type="text" class="exam-text" data-key="${escHtml(k)}" placeholder="Type your answer here…">
              </div>
            </div>`;
        }
      });
      // Close .exam-section-body, then close .exam-section.
      out += `</div></div>`;
      return out;
    }).join('');

    // Accordion behaviour — section-level + per-question.
    wrap.querySelectorAll('.exam-section-h').forEach(head => {
      head.addEventListener('click', () => {
        const sec = head.closest('.exam-section');
        if (!sec) return;
        const willCollapse = !sec.classList.contains('is-collapsed');
        sec.classList.toggle('is-collapsed', willCollapse);
        head.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      });
    });
    wrap.querySelectorAll('.exam-item-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('.exam-item');
        if (!item) return;
        const willCollapse = !item.classList.contains('is-collapsed');
        item.classList.toggle('is-collapsed', willCollapse);
        btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
        btn.setAttribute('aria-label',
          willCollapse ? 'Expand this question' : 'Collapse this question');
      });
    });

    wrap.querySelectorAll('.exam-opt input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (submitted) return;
        const k = radio.name;
        saveAnswer(k, radio.value);
        const grp = wrap.querySelectorAll(`input[name="${CSS.escape(k)}"]`);
        grp.forEach(r => {
          const lbl = r.closest('.exam-opt');
          if (lbl) lbl.classList.toggle('is-selected', r.checked);
        });
      });
    });
    wrap.querySelectorAll('.exam-text').forEach(inp => {
      let deb = null;
      inp.addEventListener('input', () => {
        if (submitted) return;
        clearTimeout(deb);
        deb = setTimeout(() => saveAnswer(inp.dataset.key, inp.value.trim()), 400);
      });
    });

    reflectAnswersInUI();
    updateAnsweredCount();
  }

  function reflectAnswersInUI() {
    const wrap = document.getElementById('examSections');
    if (!wrap) return;
    Object.keys(myAnswers).forEach(k => {
      const v = myAnswers[k];
      if (v == null) return;
      const radio = wrap.querySelector(`input[name="${CSS.escape(k)}"][value="${CSS.escape(String(v))}"]`);
      if (radio) {
        radio.checked = true;
        const lbl = radio.closest('.exam-opt');
        if (lbl) lbl.classList.add('is-selected');
      }
      const text = wrap.querySelector(`input.exam-text[data-key="${CSS.escape(k)}"]`);
      if (text && text.value === '') text.value = v;
    });
  }

  function updateAnsweredCount() {
    const el = document.getElementById('answeredCount');
    if (!el) return;
    const total = (session && session.totalQuestions) || 0;
    const answered = Object.keys(myAnswers).filter(k => {
      const v = myAnswers[k];
      return v != null && v !== '';
    }).length;
    el.textContent = String(Math.min(answered, total));
  }

  async function saveAnswer(key, value) {
    if (!sessionCode || !myUid) return;
    myAnswers[key] = value;
    updateAnsweredCount();
    try {
      const [secId, itemId] = key.split('__');
      await db.collection('listening_sessions').doc(sessionCode)
        .collection('players').doc(myUid)
        .collection('answers').doc(key)
        .set({
          sectionId: secId, itemId, value,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
      console.error('saveAnswer', e);
    }
  }

  // ── Submit ────────────────────────────────────────────────
  async function submitFinal(auto) {
    if (submitted || !sessionCode || !myUid) return;
    if (!auto) {
      const ok = await new Promise(resolve => {
        const bg = document.getElementById('listeningConfirm');
        const titleEl = document.getElementById('listeningConfirmTitle');
        const msgEl   = document.getElementById('listeningConfirmMsg');
        const okBtn   = document.getElementById('listeningConfirmOk');
        const cnBtn   = document.getElementById('listeningConfirmCancel');
        if (!bg) return resolve(window.confirm('Submit your answers?'));
        titleEl.textContent = 'Submit your answers?';
        msgEl.textContent   = 'You cannot change them after this. Your score will be visible to your teacher.';
        okBtn.textContent   = 'Submit';
        bg.classList.add('active');
        bg.style.display = '';
        const cleanup = (v) => {
          bg.classList.remove('active');
          bg.style.display = 'none';
          okBtn.removeEventListener('click', onOk);
          cnBtn.removeEventListener('click', onCn);
          resolve(v);
        };
        const onOk = () => cleanup(true);
        const onCn = () => cleanup(false);
        okBtn.addEventListener('click', onOk);
        cnBtn.addEventListener('click', onCn);
      });
      if (!ok) return;
    }
    try {
      await db.collection('listening_sessions').doc(sessionCode)
        .collection('players').doc(myUid)
        .update({
          submitted: true,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      submitted = true;
      if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }
      setView('submitted');
      const totalQ = (session && session.totalQuestions) || 0;
      const ft = document.getElementById('finalTotal');
      if (ft) ft.textContent = String(totalQ);
    } catch (e) {
      console.error('submitFinal', e);
      toast('Could not submit: ' + e.message, 'fail');
    }
  }

  // ── Revealed view ─────────────────────────────────────────
  function enterRevealed() {
    setView('revealed');
    const totalQ = (session && session.totalQuestions) || 0;
    const reveal = (session && session.revealedAnswers) || {};

    // Use same lenient compare as host for fillblank; exact for others.
    const norm = (s) => String(s || '').toLowerCase().trim()
      .replace(/^[\(\[\{]+|[\)\]\}\.\,\!\?\;\:]+$/g, '')
      .replace(/^(a|an|the|one)\s+/, '')
      .replace(/[\(\)\[\]\{\}\.\,\!\?\;\:'"]/g, '')
      .replace(/\s+/g, ' ').trim();

    let correct = 0;
    Object.keys(reveal).forEach(k => {
      const expected = reveal[k];
      const mine = myAnswers[k];
      if (mine == null || mine === '' || expected == null) return;
      if (norm(mine) === norm(expected)) correct++;
    });
    const rs = document.getElementById('revealScore');
    const rt = document.getElementById('revealTotal');
    const rp = document.getElementById('revealPercent');
    if (rs) rs.textContent = String(correct);
    if (rt) rt.textContent = String(totalQ);
    if (rp && totalQ) rp.textContent = Math.round((correct / totalQ) * 100) + '%';

    const list = document.getElementById('revealList');
    if (!list || !manifest) return;
    const rows = [];
    manifest.sections.forEach(sec => {
      rows.push(`<h4 class="reveal-section-h">${escHtml(sec.label || sec.id)}</h4>`);
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        const expected = reveal[k] || '';
        const mine = myAnswers[k] || '';
        const isRight = mine && expected && (norm(mine) === norm(expected));
        // Pretty label
        const fmt = (val) => {
          if (sec.type === 'mcq' && val) {
            const opt = (it.options || []).find(o => o.id === val);
            return opt ? `${String(val).toUpperCase()}. ${opt.text}` : val;
          }
          if (sec.type === 'truefalse' && val) {
            const txt = String(val).toUpperCase() === 'T' ? 'True' : 'False';
            return `${String(val).toUpperCase()}. ${txt}`;
          }
          return val || '(no answer)';
        };
        rows.push(`
          <div class="reveal-row ${isRight ? 'right' : (mine ? 'wrong' : 'empty')}">
            <div class="reveal-row-id">${escHtml(it.id)}</div>
            <div class="reveal-row-body">
              <div class="reveal-q">${escHtml(it.text || '')}</div>
              <div class="reveal-mine"><span class="reveal-lbl">You:</span> ${escHtml(fmt(mine))}</div>
              ${isRight ? '' : `<div class="reveal-correct"><span class="reveal-lbl">Correct:</span> ${escHtml(fmt(expected))}</div>`}
            </div>
            <div class="reveal-row-mark">${isRight ? '✓' : (mine ? '✗' : '·')}</div>
          </div>`);
      });
    });
    list.innerHTML = rows.join('');
  }

  // ── DOM wiring ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();

    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    document.getElementById('submitBtn').addEventListener('click', () => submitFinal(false));

    setView('join');
  });

  // refresh-guard.js predicate — themed double-confirm on F5 / Ctrl+R
  // active during live exam + revealed states.
  window.refreshGuardShouldProtect = () => {
    if (!session) return false;
    if (session.status === 'live')     return true;
    if (session.status === 'revealed') return true;
    return false;
  };

  window.addEventListener('beforeunload', (e) => {
    if (session && session.status === 'live' && !submitted
        && document.getElementById('view-exam')
        && document.getElementById('view-exam').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
