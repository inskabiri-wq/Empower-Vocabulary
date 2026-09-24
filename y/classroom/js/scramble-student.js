/* ============================================================
   SENTENCE SCRAMBLE - Student client
   ------------------------------------------------------------
   Synchronized rounds: the session doc carries the scrambled
   sentence; every phone shows the same one at the same time.
   Tap word chips to build the sentence (duplicate words are
   tracked by position, not text), then Submit. Correct =
   100 pts + 2 per second left on the clock.
   ============================================================ */
(function () {
  'use strict';

  // Firebase is started by js/firebase-init.js, which reads the project
  // from js/tenant.js. This file used to name one university directly, which would
  // have pointed every deployment at that same project.
  if (!firebase.apps.length) {
    throw new Error('scramble-student: js/tenant.js + js/firebase-init.js must load first.');
  }
  const auth = firebase.auth();
  const db = firebase.firestore();

  // LOCAL TESTING ONLY: same emulator opt-in as the other classroom pages
  // (localhost + localStorage.useEmulators='1'). See tools/README-emulator-e2e.md.
  try {
    if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
        localStorage.getItem('useEmulators') === '1') {
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8080);
      console.warn('[emulator] connected to LOCAL Auth (9099) + Firestore (8080)');
    }
  } catch (e) { /* never block app boot */ }

  MG.setupMusic([
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
  ]);

  let myUid = null;
  let myName = '';
  let myAvatar = '🔀';
  let sessionCode = null;
  let session = null;
  let myScore = 0;
  let renderedRound = -1;    // which roundIndex the board currently shows
  let submittedRound = -1;   // which roundIndex I already submitted
  let builtIdx = [];         // indices into round.words, in tap order
  let countdownInt = null;
  let unsubs = [];

  const AVATARS = ['🦊', '🐯', '🐼', '🐧', '🦁', '🐸', '🐙', '🦉', '🐢', '🐝', '🐳', '🦄', '🐺', '🐰', '🦝'];

  function setView(id) {
    ['join', 'wait', 'play', 'done'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  async function ensureAuth() {
    if (auth.currentUser) { myUid = auth.currentUser.uid; return; }
    try {
      const cred = await auth.signInAnonymously();
      myUid = cred.user.uid;
    } catch (e) {
      console.error('anon auth', e);
      MG.toast(e && e.code === 'auth/operation-not-allowed'
        ? 'Anonymous sign-in is disabled. Ask your teacher.'
        : 'Could not sign you in: ' + (e.message || e), 'fail');
    }
  }

  async function joinRoom() {
    await ensureAuth();
    if (!myUid) return;
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    const name = document.getElementById('nameInput').value.trim().slice(0, 24);
    if (!code) { MG.toast('Enter the game code', 'fail'); return; }
    if (!name) { MG.toast('Enter your name', 'fail'); return; }

    const sref = db.collection('scramble_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { MG.toast('Game not found - check the code', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { MG.toast('That game has ended', 'fail'); return; }

    // A new room in the same page starts from nothing.
    if (code !== sessionCode) { renderedRound = -1; submittedRound = -1; myScore = 0; }
    sessionCode = code;
    myName = name;
    myAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    // REJOINING MUST NOT WIPE THE GAME SO FAR.
    //
    // A reload keeps the same uid, so it lands on this student's existing
    // player document. The join used to write score 0, answered 0 and
    // lastRound -1 over it (merge does not protect a field it writes): the
    // real score was lost on the teacher's board, and the phone forgot the
    // sentence already submitted, so it could be submitted twice or be called
    // "not submitted" while the teacher's review counted it. Same fix as the
    // AI Quiz: an existing player keeps everything and only the name changes;
    // a new one starts from zero.
    try {
      const pref = sref.collection('players').doc(myUid);
      const mine = await pref.get();
      if (mine.exists) {
        const p = mine.data() || {};
        myAvatar = p.avatar || myAvatar;
        myScore = Number(p.score) || 0;
        document.getElementById('myScore').textContent = myScore;
        const rr = p.roundResults || {};
        const live = session.roundIndex == null ? -1 : session.roundIndex;
        submittedRound = Math.max(typeof p.lastRound === 'number' ? p.lastRound : -1,
          Object.prototype.hasOwnProperty.call(rr, 'r' + live) ? live : -1);
        await pref.set({ name: myName, avatar: myAvatar }, { merge: true });
      } else {
        // joinedRound: the sentence that was live when they arrived (-1 in the
        // lobby). The teacher's review does not count a late joiner as "no
        // answer" for the sentences before it. Written once, here, so a
        // reload (the branch above) never moves it.
        await pref.set({
          uid: myUid, name: myName, avatar: myAvatar,
          score: 0, correct: 0, answered: 0, lastRound: -1, lastOk: false,
          joinedRound: session.roundIndex == null ? -1 : session.roundIndex,
          joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch (e) { MG.toast('Could not join: ' + e.message, 'fail'); return; }

    setView('wait');
    subscribe();
    if (session.status === 'playing') enterPlay();
  }

  function subscribe() {
    const sref = db.collection('scramble_sessions').doc(sessionCode);
    unsubs.push(sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) { MG.toast('The game was cancelled', 'fail'); setView('join'); return; }
      session = d;
      if (d.status === 'playing') enterPlay();
      if (d.status === 'finished') enterDone();
    }));
  }

  function enterPlay() {
    setView('play');
    const idx = session.roundIndex == null ? -1 : session.roundIndex;
    if (idx >= 0 && idx !== renderedRound) renderRound(idx);
  }

  function roundEndMs() {
    const startMs = session.roundStartAt && session.roundStartAt.toMillis
      ? session.roundStartAt.toMillis() : Date.now();
    return startMs + (session.roundSec || 40) * 1000;
  }

  function renderRound(idx) {
    // The round moved on before this phone submitted. Nothing is recorded for
    // it (a result is written on Submit only), so say so instead of silently
    // swapping the sentence: the teacher's review lists it as "no answer".
    // A phone that slept can come back several sentences later, so name every
    // sentence it missed, not only the one it had on screen.
    if (renderedRound >= 0) {
      const firstMissed = submittedRound < renderedRound ? renderedRound : renderedRound + 1;
      const lastMissed = idx - 1;
      if (firstMissed === lastMissed) {
        MG.toast('Sentence ' + (firstMissed + 1) + ' was not submitted - moving on.', 'fail');
      } else if (firstMissed < lastMissed) {
        MG.toast('Sentences ' + (firstMissed + 1) + ' to ' + (lastMissed + 1) + ' were not submitted - moving on.', 'fail');
      }
    }
    renderedRound = idx;
    builtIdx = [];
    const round = session.rounds[idx];
    document.getElementById('roundLabel').textContent = `Sentence ${idx + 1} of ${session.rounds.length}`;
    document.getElementById('roundResult').innerHTML = '';
    document.getElementById('submitBtn').style.display = '';
    document.getElementById('submitBtn').disabled = false;
    // Back after a reload on a sentence already answered: it is counted, so
    // say so rather than offer a Submit that would do nothing.
    if (submittedRound >= idx) {
      document.getElementById('submitBtn').style.display = 'none';
      document.getElementById('roundResult').innerHTML =
        '<div style="color: var(--text-secondary);">Your answer for this sentence is in. Wait for the next one.</div>';
    }
    renderChips(round);
    startCountdown();
  }

  function startCountdown() {
    if (countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    const el = document.getElementById('countdown');
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((roundEndMs() - Date.now()) / 1000));
      el.textContent = remaining + 's';
      el.classList.toggle('warning', remaining <= 10 && remaining > 5);
      el.classList.toggle('crit', remaining <= 5);
      if (remaining <= 0 && countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    };
    tick();
    countdownInt = setInterval(tick, 500);
  }

  // Chips are tracked by POSITION (data-idx), so sentences with the
  // same word twice stay buildable.
  function renderChips(round) {
    const line = document.getElementById('answerLine');
    const pool = document.getElementById('chipPool');
    line.innerHTML = builtIdx.map(i =>
      `<button type="button" class="scr-chip" data-idx="${i}">${MG.escHtml(round.words[i])}</button>`).join('') ||
      '<span style="color: var(--text-muted); padding: 4px 6px;">Tap the words below in the right order...</span>';
    pool.innerHTML = round.words.map((w, i) =>
      builtIdx.indexOf(i) === -1
        ? `<button type="button" class="scr-chip" data-idx="${i}">${MG.escHtml(w)}</button>`
        : '').join('');
    pool.querySelectorAll('.scr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (submittedRound >= renderedRound) return;
        builtIdx.push(parseInt(chip.dataset.idx, 10));
        renderChips(round);
      });
    });
    line.querySelectorAll('.scr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (submittedRound >= renderedRound) return;
        builtIdx = builtIdx.filter(i => i !== parseInt(chip.dataset.idx, 10));
        renderChips(round);
      });
    });
  }

  async function submit() {
    const idx = renderedRound;
    if (idx < 0 || submittedRound >= idx) return;
    const round = session.rounds[idx];
    if (builtIdx.length !== round.words.length) {
      MG.toast('Use every word first.', 'fail');
      return;
    }
    submittedRound = idx;
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').style.display = 'none';

    const built = builtIdx.map(i => round.words[i]).join(' ');
    const ok = built === round.answer;
    const secondsLeft = Math.max(0, Math.ceil((roundEndMs() - Date.now()) / 1000));
    const points = ok ? 100 + secondsLeft * 2 : 0;
    myScore += points;
    document.getElementById('myScore').textContent = myScore;

    const res = document.getElementById('roundResult');
    res.innerHTML = ok
      ? `<div class="scr-result-ok">✅ Correct! +${points}</div>`
      : `<div class="scr-result-no">❌ Not quite.</div><div style="color: var(--text-secondary); margin-top: 6px;">Correct: "${MG.escHtml(round.answer)}"</div>`;

    try {
      // PER-ROUND RESULT, in the SAME write.
      //
      // Only totals were kept - correct, answered, and the LAST round's
      // outcome - so the results screen could say "3 / 10 correct" but could
      // never say WHICH sentence anyone got wrong. The per-sentence breakdown
      // the host now shows was impossible because the data never existed.
      //
      // A dotted path adds one boolean to a nested map on the player's own
      // document. Same single write per answer, so no extra cost and no extra
      // contention: at 20 rounds it is 20 booleans.
      var patch = {
        score: firebase.firestore.FieldValue.increment(points),
        correct: firebase.firestore.FieldValue.increment(ok ? 1 : 0),
        answered: firebase.firestore.FieldValue.increment(1),
        lastRound: idx,
        lastOk: ok
      };
      patch['roundResults.r' + idx] = ok;
      await db.collection('scramble_sessions').doc(sessionCode).collection('players').doc(myUid).update(patch);
    } catch (e) { console.error('submit update', e); }
  }

  async function enterDone() {
    setView('done');
    if (countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    try {
      const snap = await db.collection('scramble_sessions').doc(sessionCode)
        .collection('players').orderBy('score', 'desc').get();
      const players = snap.docs.map(d => d.data());
      const mine = players.findIndex(p => p.uid === myUid);
      const me = mine >= 0 ? players[mine] : null;
      document.getElementById('doneRank').textContent = mine >= 0 ? `#${mine + 1} of ${players.length}` : '-';
      document.getElementById('doneScore').textContent = ((me && me.score) || myScore) + ' pts';
      document.getElementById('doneStats').textContent =
        me ? `${me.correct || 0} of ${me.answered || 0} sentences correct` : '';
      document.getElementById('doneList').innerHTML = players.slice(0, 10).map((p, i) => `
        <div class="leaderboard-item ${p.uid === myUid ? 'current-user' : ''}">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`).join('');
    } catch (e) { console.error('done', e); }
    unsubs.forEach(u => { try { u(); } catch (_) {} });
    unsubs = [];
  }

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();
    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    document.getElementById('submitBtn').addEventListener('click', submit);
  });

  window.refreshGuardShouldProtect = () => !!(session && session.status === 'playing');
  window.addEventListener('beforeunload', e => {
    if (session && session.status === 'playing'
        && document.getElementById('view-play')
        && document.getElementById('view-play').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
