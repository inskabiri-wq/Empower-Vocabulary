/* ============================================================
   READING CLASSROOM — Student client
   ----------------------------------------------------------------
   The no-leak design lives in this file. Critical rules:

     • NEVER fetch the source exam JSON. We read ONLY the
       student-safe manifest from session.questionsManifest, which
       the host's tab generated with the answer key stripped out.

     • NEVER show ✓/✗ after the student picks. Selected = brand
       violet, never green/red. No sounds, no animation on tap.

     • NEVER show a running score, hint, or correctness signal
       while the exam is live. Only the submitted-score-card is
       shown after Submit, and even that is just a raw total
       (no per-question detail).

     • Students can change any answer until they tap Submit.
       Each change writes to /answers/{questionId} via .set().

     • After session.status flips to 'revealed', AND the session
       has discussionPhase: true, route the student to the
       revealed view where they CAN see per-question breakdown
       (because the teacher has explicitly released it).
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
  let myAvatar    = '📖';
  let sessionCode = null;
  let session     = null;
  let manifest    = null;            // questionsManifest from session
  let myAnswers   = {};              // sectionId__itemId → value (local mirror)
  let unsubs      = [];
  let submitted   = false;
  let examTimerInt = null;

  const AVATARS = ['📖','📚','📝','✏️','📓','📔','📕','📗','📘','📙','📰','🔖','📑'];
  function randomAvatar() { return AVATARS[Math.floor(Math.random() * AVATARS.length)]; }

  // ── Helpers ───────────────────────────────────────────────
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
    el.className = 'reading-toast ' + (kind || '');
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
        toast('Anonymous sign-in is disabled. Ask your teacher to enable it in Firebase Console.', 'fail');
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

    const sref = db.collection('reading_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { toast('Room not found', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { toast('That exam has ended', 'fail'); return; }
    manifest = session.questionsManifest || null;
    if (!manifest) { toast('Exam not ready yet — try again in a moment.', 'fail'); return; }

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid,
        name: myName,
        avatar: myAvatar,
        submitted: false,
        score: 0,
        correctCount: 0,
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
      <span class="reading-chip">${escHtml(myAvatar)} ${escHtml(myName)}</span>
      <span class="reading-chip" id="myStatusChip">${submitted ? '✓ submitted' : 'in progress'}</span>
    `;
  }

  // ── Subscriptions ─────────────────────────────────────────
  function subscribeSession() {
    const sref = db.collection('reading_sessions').doc(sessionCode);
    const u = sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      const prevStatus = session && session.status;
      session = d;
      // Status transitions drive the view.
      if (d.status === 'live' && prevStatus !== 'live') {
        // Teacher started the exam.
        enterExam();
      }
      if (d.status === 'revealed') {
        // Teacher revealed answers.
        if (submitted) {
          if (d.discussionPhase !== false) {
            enterRevealed();
          }
          // discussionPhase=false → student stays on submitted view
          // until session.status=finished routes them to done.
        } else {
          // Edge case: teacher revealed before this student submitted.
          // Treat as auto-submit (use whatever they currently have).
          submitFinal(true);
        }
      }
      if (d.status === 'finished') {
        // If revealed has been shown, leave them on that. Otherwise
        // route to 'done' so they don't sit on an unending exam.
        if (!submitted) submitFinal(true);
        const onRevealed = document.getElementById('view-revealed') &&
                           document.getElementById('view-revealed').style.display !== 'none';
        if (!onRevealed) setView('done');
        if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }
      }
    });
    unsubs.push(u);
  }
  function subscribePlayer() {
    const ref = db.collection('reading_sessions').doc(sessionCode).collection('players').doc(myUid);
    const u = ref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      submitted = !!d.submitted;
      const chip = document.getElementById('myStatusChip');
      if (chip) chip.textContent = submitted ? '✓ submitted' : 'in progress';
      // Keep the submitted-card numbers fresh.
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
  // Local mirror of /answers — keeps the selected/typed values
  // sticky across refreshes. Reading my own answers is allowed
  // by the rules; the host needs this same path to grade.
  function subscribeMyAnswers() {
    const ref = db.collection('reading_sessions').doc(sessionCode)
      .collection('players').doc(myUid).collection('answers');
    const u = ref.onSnapshot(snap => {
      snap.docs.forEach(d => {
        myAnswers[d.id] = d.data().value;
      });
      // If we're on the exam view, refresh the selected/typed
      // state of any rendered inputs so the UI reflects what's
      // saved (handy after a refresh).
      reflectAnswersInUI();
      updateAnsweredCount();
    });
    unsubs.push(u);
  }

  // ── Exam view ─────────────────────────────────────────────
  let examRendered = false;
  function enterExam() {
    setView('exam');
    if (!examRendered) {
      renderExamShell();
      examRendered = true;
    }
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
            // Auto-submit on time-out.
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
    if (ttl) ttl.textContent = session.examTitle || 'Reading Exam';

    const tot = document.getElementById('totalCount');
    if (tot) tot.textContent = String(session.totalQuestions || 0);

    const wrap = document.getElementById('examSections');
    if (!wrap) return;

    wrap.innerHTML = (manifest.sections || []).map(sec => {
      // Section header — wrapped as an accordion. The whole body
      // (instructions + items) lives inside `.exam-section-body` so
      // collapsing it animates cleanly without disturbing the header.
      // Defaults to expanded so the page behaves exactly as before
      // unless the student opts in by clicking a section header.
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
      // Per-type item renderers — each `.exam-item` is now its own
      // accordion: the stem stays visible; the answer area (.exam-options
      // / .exam-select / .exam-text) wraps in `.exam-item-body` and
      // collapses when the student taps the per-question chevron. The
      // stem text remains independently selectable because only the
      // chevron itself is the click target.
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        // Shared "stem + per-question chevron" header for every
        // question type. Branded rose, button-shaped, obviously
        // interactive.
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
              ${stemHead(`<strong>${escHtml(it.id)}.</strong> ${escHtml(it.question || '')}`)}
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
        } else if (sec.type === 'match-gaps' || sec.type === 'match-headings') {
          // Drop-down picker — student picks from sec.options.
          out += `
            <div class="exam-item" data-q="${escHtml(k)}">
              ${stemHead(`<strong>${escHtml(it.label || it.id)}</strong>`)}
              <div class="exam-item-body">
                <select class="exam-select" data-key="${escHtml(k)}">
                  <option value="">— pick —</option>
                  ${(sec.options || []).map(o => `
                    <option value="${escHtml(o.id)}">${escHtml(o.id).toUpperCase()}. ${escHtml(o.text)}</option>
                  `).join('')}
                </select>
              </div>
            </div>`;
        } else if (sec.type === 'find-word') {
          out += `
            <div class="exam-item" data-q="${escHtml(k)}">
              ${stemHead(`<strong>${escHtml(it.id)}.</strong> ${escHtml(it.definition || '')}`)}
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

    // Accordion behaviour — section-level: click the section header
    // to collapse the whole part. Question-level: click the per-
    // question chevron to collapse just that answer area. Both
    // default to expanded so first-load behaviour is unchanged.
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
        // Don't bubble into any parent — section header etc.
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

    // Wire change handlers
    wrap.querySelectorAll('.exam-opt input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (submitted) return;
        const k = radio.name;
        saveAnswer(k, radio.value);
        // Visual sticky state — only "selected" styling, never
        // green/red, never any correctness signal. This is the
        // core leak-prevention rule.
        const grp = wrap.querySelectorAll(`input[name="${CSS.escape(k)}"]`);
        grp.forEach(r => {
          const lbl = r.closest('.exam-opt');
          if (lbl) lbl.classList.toggle('is-selected', r.checked);
        });
      });
    });
    wrap.querySelectorAll('.exam-select').forEach(sel => {
      sel.addEventListener('change', () => {
        if (submitted) return;
        saveAnswer(sel.dataset.key, sel.value);
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

  // Re-sync the rendered inputs with myAnswers (after Firestore
  // snapshots fire). Idempotent — safe to call any time.
  function reflectAnswersInUI() {
    const wrap = document.getElementById('examSections');
    if (!wrap) return;
    Object.keys(myAnswers).forEach(k => {
      const v = myAnswers[k];
      if (v == null) return;
      // Radio
      const radio = wrap.querySelector(`input[name="${CSS.escape(k)}"][value="${CSS.escape(String(v))}"]`);
      if (radio) {
        radio.checked = true;
        const lbl = radio.closest('.exam-opt');
        if (lbl) lbl.classList.add('is-selected');
      }
      // Select
      const select = wrap.querySelector(`select.exam-select[data-key="${CSS.escape(k)}"]`);
      if (select) select.value = v;
      // Text
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
      await db.collection('reading_sessions').doc(sessionCode)
        .collection('players').doc(myUid)
        .collection('answers').doc(key)
        .set({
          sectionId: secId,
          itemId,
          value,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
      console.error('saveAnswer', e);
    }
  }

  // ── Submit ────────────────────────────────────────────────
  // `auto`: true when called from a timeout or teacher-reveal path
  //   (skips the confirm dialog).
  async function submitFinal(auto) {
    if (submitted || !sessionCode || !myUid) return;
    if (!auto) {
      const ok = await new Promise(resolve => {
        const bg = document.getElementById('readingConfirm');
        const titleEl = document.getElementById('readingConfirmTitle');
        const msgEl   = document.getElementById('readingConfirmMsg');
        const okBtn   = document.getElementById('readingConfirmOk');
        const cnBtn   = document.getElementById('readingConfirmCancel');
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
      await db.collection('reading_sessions').doc(sessionCode)
        .collection('players').doc(myUid)
        .update({
          submitted: true,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      submitted = true;
      if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }
      setView('submitted');
      // Initial scores update — the host's grader writes back to
      // /players/{uid}.score on reveal/end, but we want to show a
      // placeholder immediately. We'll keep showing 0 until the
      // host's snapshot writes the real score back, at which point
      // subscribePlayer updates the DOM.
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
    const correct = (function () {
      // Compute from revealed answers + my answers. (Host has
      // already written score to player doc, but doing it here too
      // means the breakdown numbers are immediately consistent.)
      const reveal = (session && session.revealedAnswers) || {};
      let c = 0;
      Object.keys(reveal).forEach(k => {
        const expected = reveal[k];
        const mine = myAnswers[k];
        if (mine == null || mine === '' || expected == null) return;
        // Lenient compare for find-word; exact (case-insensitive) for others.
        // We rely on the host's grader as the ultimate source of truth — this
        // is a display-side approximation.
        if (String(mine).toLowerCase().trim() === String(expected).toLowerCase().trim()) {
          c++;
        }
      });
      return c;
    })();
    const rs = document.getElementById('revealScore');
    const rt = document.getElementById('revealTotal');
    const rp = document.getElementById('revealPercent');
    if (rs) rs.textContent = String(correct);
    if (rt) rt.textContent = String(totalQ);
    if (rp && totalQ) rp.textContent = Math.round((correct / totalQ) * 100) + '%';

    // Per-question breakdown
    const list = document.getElementById('revealList');
    if (!list || !manifest) return;
    const reveal = (session && session.revealedAnswers) || {};
    const rows = [];
    manifest.sections.forEach(sec => {
      rows.push(`<h4 class="reveal-section-h">${escHtml(sec.label || sec.id)}</h4>`);
      sec.items.forEach(it => {
        const k = sec.id + '__' + it.id;
        const expected = reveal[k] || '';
        const mine = myAnswers[k] || '';
        const isRight = mine && expected &&
          (String(mine).toLowerCase().trim() === String(expected).toLowerCase().trim());
        // Pretty label for the student's choice + the correct one.
        const fmt = (val) => {
          if (sec.type === 'mcq' && val) {
            const opt = (it.options || []).find(o => o.id === val);
            return opt ? `${val.toUpperCase()}. ${opt.text}` : val;
          }
          if ((sec.type === 'match-gaps' || sec.type === 'match-headings') && val) {
            const opt = (sec.options || []).find(o => o.id === val);
            return opt ? `${val.toUpperCase()}. ${opt.text}` : val;
          }
          return val || '(no answer)';
        };
        rows.push(`
          <div class="reveal-row ${isRight ? 'right' : (mine ? 'wrong' : 'empty')}">
            <div class="reveal-row-id">${escHtml(it.id)}</div>
            <div class="reveal-row-body">
              <div class="reveal-q">${escHtml(it.question || it.label || it.definition || '')}</div>
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

  // refresh-guard.js polls this predicate on every F5 / Ctrl+R / Cmd+R
  // keydown. Returning true triggers the themed two-step confirmation.
  // Active during the exam itself AND the submitted/revealed states
  // so students don't lose their reveal screen by accident.
  window.refreshGuardShouldProtect = () => {
    if (!session) return false;
    if (session.status === 'live')     return true;
    if (session.status === 'revealed') return true;
    return false;
  };

  window.addEventListener('beforeunload', (e) => {
    // Block accidental refresh during an active in-progress exam.
    if (session && session.status === 'live' && !submitted
        && document.getElementById('view-exam')
        && document.getElementById('view-exam').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
