/* ============================================================
   SENTENCE SCRAMBLE - Teacher (host) controller
   ------------------------------------------------------------
   Synchronized rounds: everyone gets the SAME example sentence
   from datasets.json (verbatim - the bank's own sentences, 4-10
   words), word-scrambled. Students rebuild it on their phones;
   faster correct answers score more. The host advances rounds
   (auto on timer / all-submitted, or manually).

   Join flow is IDENTICAL to the other classroom games: 5-char
   code + qrserver QR in the lobby.

   /scramble_sessions/{code}
     { code, status: lobby|playing|finished, hostUid, hostName,
       level, unit, roundSec, rounds[{words[],answer,word}],
       roundIndex, roundStartAt, createdAt, startedAt, endedAt }
     /players/{uid} { uid, name, avatar, score, correct,
                      answered, lastRound, lastOk, joinedAt,
                      joinedRound - the roundIndex when they first joined,
                      roundResults { r<i>: bool } - written on Submit only }
   ============================================================ */
(function () {
  'use strict';

  // Firebase is started by js/firebase-init.js, which reads the project
  // from js/tenant.js. This file used to name one university directly, which would
  // have pointed every deployment at that same project.
  if (!firebase.apps.length) {
    throw new Error('scramble-teacher: js/tenant.js + js/firebase-init.js must load first.');
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

  let currentUser = null;
  let sessionCode = null;
  let settings = null;
  let vocabulary = null;
  let sessionData = null;
  let unsubPlayers = null;
  let unsubSession = null;
  let timerInterval = null;
  let gameInFlight = false;
  let advancing = false;
  let resultsShown = false;
  let lastPlayers = [];

  function setView(id) {
    document.documentElement.removeAttribute('data-mg-view');
    ['auto-creating', 'lobby', 'live', 'results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  // Boot ONCE. onAuthStateChanged can fire again on token refresh, and by
  // then history.replaceState has stripped ?auto=1 - re-running the handler
  // would bounce the host back to the hub mid-game.
  let booted = false;
  auth.onAuthStateChanged(async user => {
    if (!user) { if (!booted) window.location.replace('index.html'); return; }
    if (booted) return;
    booted = true;
    currentUser = user;
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? (doc.data().role || 'student') : 'student';
      if (role !== 'teacher' && role !== 'admin') {
        document.body.innerHTML = '<div style="padding:40px; text-align:center; color:#f1f5f9; font-family:sans-serif;">Teachers only.</div>';
        return;
      }
    } catch (e) { console.error('role check failed', e); }
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.displayName || user.email || 'Teacher';

    const params = new URLSearchParams(location.search);
    if (params.get('auto') !== '1') {
      window.location.replace('classroom-teacher.html');
      return;
    }
    settings = {
      level: params.get('lvl') || '',
      unit: params.get('unit') || 'all',
      roundCount: Math.max(3, Math.min(20, parseInt(params.get('rounds') || '10', 10))),
      roundSec: Math.max(15, Math.min(120, parseInt(params.get('sec') || '40', 10)))
    };
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    setView('auto-creating');
    try {
      const r = await fetch('datasets.json');
      vocabulary = await r.json();
    } catch (e) { console.warn('vocab load', e); }
    await createSession();
    if (!sessionCode) {
      MG.toast('Could not create the game - go back and try again.', 'fail');
      setTimeout(() => window.location.replace('classroom-teacher.html'), 2500);
    }
  });

  async function createSession() {
    const rounds = MG.scrambleRounds(vocabulary, settings.level, settings.unit, settings.roundCount);
    if (rounds.length < 3) { MG.toast('Not enough usable sentences at that level/unit.', 'fail'); return; }

    let code = MG.genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('scramble_sessions').doc(code).get();
      if (!exists.exists) break;
      code = MG.genCode();
    }
    const session = {
      code,
      status: 'lobby',
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      level: settings.level,
      unit: settings.unit,
      roundSec: settings.roundSec,
      rounds,
      roundIndex: -1,
      roundStartAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null
    };
    try {
      await db.collection('scramble_sessions').doc(code).set(session);
      sessionCode = code;
      sessionData = session;
      enterLobby(code);
    } catch (e) {
      console.error('createSession', e);
      MG.toast('Could not create the room: ' + e.message, 'fail');
    }
  }

  function enterLobby(code) {
    setView('lobby');
    document.getElementById('roomCode').textContent = code;
    const url = MG.joinUrl('classroom-scramble-student.html', code);
    const link = document.getElementById('joinUrl');
    if (link) { link.textContent = url; link.href = url; }
    const qr = document.getElementById('qrImg');
    if (qr) qr.src = MG.qrSrc(url, 240);
    document.getElementById('lobbyMeta').textContent =
      settings.level + ' · ' + (settings.unit === 'all' ? 'All units' : settings.unit) +
      ' · ' + sessionData.rounds.length + ' sentences · ' + settings.roundSec + 's each';

    // Re-entering the lobby (a second create, or a retry after a failed one)
    // would otherwise strand the previous roster listener. Null on the first
    // run, so this is a no-op then.
    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('scramble_sessions').doc(code).collection('players')
      .orderBy('joinedAt', 'asc')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderRoster(players);
      });
  }

  var _lastRoster = 0;
  function renderRoster(players) {
    // A student arrived. Throttled: a full cohort joining would otherwise
    // fire a cue per arrival. Guarded on GROWTH so a snapshot caused by a
    // score change stays silent.
    if (players.length > _lastRoster) MG.sfx('join', { throttle: 400 });
    _lastRoster = players.length;
    const el = document.getElementById('roster');
    const count = document.getElementById('rosterCount');
    if (count) count.textContent = players.length;
    if (!players.length) {
      el.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px; grid-column: 1/-1;">Waiting for students to join...</p>';
    } else {
      el.innerHTML = players.map(p => `
        <div class="player-card">
          <div class="player-avatar">${MG.escHtml(p.avatar || '🔀')}</div>
          <div class="player-name">${MG.escHtml(p.name)}</div>
          <div class="player-status ready">✓ Ready</div>
        </div>`).join('');
    }
    const btn = document.getElementById('startBtn');
    btn.disabled = players.length < 1;
    btn.textContent = players.length < 1 ? '▶️ Waiting for players...' : `▶️ Start (${players.length} players)`;
  }

  async function startGame() {
    if (!sessionCode) return;
    try {
      await db.collection('scramble_sessions').doc(sessionCode).update({
        status: 'playing',
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        roundIndex: 0,
        roundStartAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
    } catch (e) { MG.toast('Could not start: ' + e.message, 'fail'); }
  }

  function enterLive() {
    setView('live');
    const liveCode = document.getElementById('liveCode');
    if (liveCode) liveCode.textContent = sessionCode;
    const qr = document.getElementById('liveQrImg');
    if (qr) qr.src = MG.qrSrc(MG.joinUrl('classroom-scramble-student.html', sessionCode), 120, 2);

    unsubSession = db.collection('scramble_sessions').doc(sessionCode).onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      sessionData = d;
      if (d.status === 'finished') { showResults(); return; }
      renderRound(d);
      resetRoundTimer(d);
    });

    // Release the lobby listener before attaching the in-game one. Without
    // this both stayed live for the whole game, so every player write was
    // delivered and billed twice. Same shape as trust-teacher.js:475.
    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('scramble_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderLiveBoard(players);
        // Everyone answered this round -> advance early (small grace so
        // the last student sees their own feedback).
        const idx = sessionData ? sessionData.roundIndex : -1;
        if (idx >= 0 && players.length > 0 && players.every(p => (p.lastRound == null ? -1 : p.lastRound) >= idx)) {
          scheduleAdvance(1500);
        }
      });
  }

  function renderRound(d) {
    const idx = d.roundIndex == null ? -1 : d.roundIndex;
    const total = (d.rounds || []).length;
    const round = idx >= 0 ? d.rounds[idx] : null;
    document.getElementById('roundCount').textContent = idx < 0 ? 'Ready' : `Sentence ${idx + 1} of ${total}`;
    document.getElementById('roundAnswer').textContent = round ? round.answer : '';
    document.getElementById('roundWordChip').textContent = round ? ('key word: ' + round.word) : '';
    const btn = document.getElementById('nextRoundBtn');
    if (btn) btn.textContent = idx + 1 >= total ? '🏁 Finish after this one' : '⏭️ Next sentence';
  }

  function renderLiveBoard(players) {
    const idx = sessionData ? (sessionData.roundIndex == null ? -1 : sessionData.roundIndex) : -1;
    const submitted = players.filter(p => (p.lastRound == null ? -1 : p.lastRound) >= idx).length;
    document.getElementById('submitNote').textContent =
      idx < 0 ? '' : `${submitted} / ${players.length} submitted this sentence`;
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    document.getElementById('liveBoard').innerHTML = sorted.slice(0, 12).map((p, i) => {
      const done = (p.lastRound == null ? -1 : p.lastRound) >= idx;
      return `<div class="leaderboard-item">
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
        <div class="leaderboard-details" style="margin-right: 12px;">${done ? (p.lastOk ? '✅' : '❌') : '✏️'}</div>
        <div class="leaderboard-score">${p.score || 0}</div>
      </div>`;
    }).join('');
  }

  let advanceTimeout = null;
  function scheduleAdvance(delayMs) {
    if (advancing || advanceTimeout || resultsShown) return;
    advanceTimeout = setTimeout(() => { advanceTimeout = null; advanceRound(); }, delayMs);
  }

  function resetRoundTimer(d) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const idx = d.roundIndex == null ? -1 : d.roundIndex;
    if (idx < 0 || d.status !== 'playing') return;
    const startMs = d.roundStartAt && d.roundStartAt.toMillis ? d.roundStartAt.toMillis() : Date.now();
    const endMs = startMs + (d.roundSec || 40) * 1000;
    const el = document.getElementById('timer');
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      el.textContent = remaining + 's';
      el.classList.toggle('warning', remaining <= 10 && remaining > 5);
      el.classList.toggle('crit', remaining <= 5);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        scheduleAdvance(1200);
      }
    };
    tick();
    timerInterval = setInterval(tick, 500);
  }

  async function advanceRound() {
    // Never move a finished game on: a late answer used to be able to write
    // the next roundIndex onto a finished session and re-open its results.
    if (advancing || !sessionData || sessionData.status !== 'playing' || resultsShown) return;
    advancing = true;
    try {
      const idx = sessionData.roundIndex == null ? -1 : sessionData.roundIndex;
      if (idx + 1 >= (sessionData.rounds || []).length) {
        await endGame();
      } else {
        await db.collection('scramble_sessions').doc(sessionCode).update({
          roundIndex: idx + 1,
          roundStartAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) { console.error('advanceRound', e); }
    advancing = false;
  }

  async function endGame() {
    if (!sessionCode) return;
    try {
      await db.collection('scramble_sessions').doc(sessionCode).update({
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error('endGame', e); }
  }

  async function showResults() {
    // ONCE. The session listener fires "finished" twice - on the host's own
    // write and again when the server fills in endedAt - and each run read
    // every player again and re-drew the screen. resultsShown also stops a
    // late answer that lands during the wait below from counting as
    // "everyone answered" and advancing the game (scheduleAdvance and
    // advanceRound refuse once it is set).
    //
    // The listeners stay attached until the reads below have finished
    // (cleanup() at the end). Without persistence the SDK drops a detached
    // query's documents at once, so if the host's wifi is gone at this moment
    // the players read would come back empty from the cache.
    if (resultsShown) return;
    resultsShown = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
    gameInFlight = false;
    setView('results');
    try {
      // The sentence that was live when the game ended can still have an
      // answer in flight: a phone accepts Submit until the "finished" status
      // reaches it, and this runs on the host's own local write, before the
      // server has even confirmed it. When someone had not answered that
      // sentence yet, give their write a moment, so a last-second answer is
      // not listed as "no answer" and its points reach the podium and the
      // saved report. No wait when everyone had answered.
      const liveIdx = sessionData && sessionData.roundIndex != null ? sessionData.roundIndex : -1;
      if (liveIdx >= 0 && lastPlayers.some(p => (p.lastRound == null ? -1 : p.lastRound) < liveIdx)) {
        document.getElementById('sentenceReview').innerHTML =
          '<div style="padding: 14px; color: var(--text-muted);">Collecting the last answers...</div>';
        await new Promise(res => setTimeout(res, 1500));
      }
      const sref = db.collection('scramble_sessions').doc(sessionCode);
      const [playersSnap, sessSnap] = await Promise.all([
        sref.collection('players').orderBy('score', 'desc').get(),
        sref.get()
      ]);
      // An empty answer from the local cache while players were seen a moment
      // ago means the host is offline, not that the room was empty: use the
      // last players the live listener delivered, so the podium, the review
      // and the saved report are not blanked.
      const offlineEmpty = playersSnap.empty && playersSnap.metadata && playersSnap.metadata.fromCache && lastPlayers.length > 0;
      const players = offlineEmpty
        ? lastPlayers.slice().sort((a, b) => (b.score || 0) - (a.score || 0))
        : playersSnap.docs.map(d => d.data());
      const s = sessSnap.exists ? sessSnap.data() : {};

      if (window.saveGameReport) {
        window.saveGameReport(db, {
          game: 'scramble',
          mode: 'sentences',
          code: sessionCode,
          teacherId: s.hostUid || '',
          teacherName: s.hostName || '',
          level: s.level || '',
          unit: s.unit === 'all' ? 'All units' : String(s.unit || ''),
          wordCount: (s.rounds || []).length,
          players: players.map(p => ({ name: p.name || '', score: p.score || 0 }))
        });
      }

      renderPodium(players);
      document.getElementById('perPlayerBody').innerHTML = players.map((p, i) => {
        const answered = p.answered || 0;
        const acc = answered ? Math.round(((p.correct || 0) / answered) * 100) : 0;
        return `<div class="leaderboard-item">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
          <div class="leaderboard-details" style="margin-right: 12px;">${p.correct || 0} / ${answered} correct${answered ? ' · ' + acc + '%' : ''}</div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`;
      }).join('');

      // SENTENCE REVIEW, now with how the class actually did on each one.
      //
      // This used to list the sentences and nothing else, so the screen a
      // teacher discusses the round from could not say which sentence caused
      // trouble. Reading and Listening have had per-question bars for a
      // while; this is the same idea, from the per-round results students
      // now record.
      //
      // Rounds here are SYNCHRONIZED, not self-paced: every phone in the room
      // is shown the same sentence at the same time, so nobody falls behind.
      // A phone records a result only when Submit is pressed, so a missing
      // result means the student SAW the sentence and did not submit before
      // the round moved on (time ran out or Next was pressed). A student who
      // joined later is not counted for the sentences before they joined. This used to read "not reached", which a teacher testing alone
      // rightly found impossible. Only sentences after the one the game ended
      // on were never shown (endGame leaves roundIndex on the live sentence),
      // and those read "not played".
      //
      // The percentage is over submitted answers only, so a sentence nobody
      // answered reads "-", never "0%". The no-answer count sits under it
      // instead: a sentence most of the room could not finish in time is a
      // problem sentence too, and dropping those students made it read green.
      const lastShown = s.roundIndex == null ? -1 : s.roundIndex;
      document.getElementById('sentenceReview').innerHTML = (s.rounds || []).map((r, i) => {
        const key = 'r' + i;
        let attempted = 0, right = 0, present = 0;
        players.forEach((p) => {
          const rr = p.roundResults || {};
          // Counted only if they were in the room for this sentence AND answered
          // at least one sentence in the game. A late joiner never saw the
          // sentences before they joined (scramble-student.js writes
          // joinedRound). A player doc that never answered anything is usually
          // not a student at all: a second copy from reopening the link in
          // another browser, or a tab closed in the lobby. It used to add "1 no
          // answer" to every sentence.
          if ((p.joinedRound == null ? -1 : p.joinedRound) <= i && Object.keys(rr).length) present++;
          if (Object.prototype.hasOwnProperty.call(rr, key)) {
            attempted++;
            if (rr[key]) right++;
          }
        });
        const pct = attempted ? Math.round((right / attempted) * 100) : 0;
        // Red below half, amber to 79, green at 80+: the teacher should be able
        // to find the problem sentence without reading any numbers.
        const tone = !attempted ? 'none' : pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'bad';
        const wrong = attempted - right;
        const shown = i <= lastShown;
        const noAnswer = shown ? Math.max(0, present - attempted) : 0;
        const tip = shown
          ? `${right} right, ${wrong} wrong, ${noAnswer} no answer`
          : 'The game ended before this sentence';
        const count = attempted
          ? right + '/' + attempted + (noAnswer ? '<br>' + noAnswer + ' no answer' : '')
          : (shown ? 'no answers' : 'not played');
        return `<div class="sr-row">
          <div class="sr-n">${i + 1}</div>
          <div class="sr-body">
            <div class="sr-sentence">${MG.escHtml(r.answer)}</div>
            <div class="sr-word">${MG.escHtml(r.word)}</div>
          </div>
          <div class="sr-bar" title="${tip}">
            <div class="sr-fill sr-${tone}" style="width:${pct}%;"></div>
          </div>
          <div class="sr-pct sr-${tone}-text" title="${tip}">${attempted ? pct + '%' : '-'}</div>
          <div class="sr-count" title="${tip}">${count}</div>
        </div>`;
      }).join('');

      const dl = document.getElementById('downloadResultsBtn');
      if (dl) dl.onclick = () => {
        const rows = [['Rank', 'Name', 'Score', 'Correct', 'Answered', 'Accuracy %']];
        players.forEach((p, i) => {
          const answered = p.answered || 0;
          rows.push([i + 1, p.name || '', p.score || 0, p.correct || 0, answered,
            answered ? Math.round(((p.correct || 0) / answered) * 100) : 0]);
        });
        MG.downloadCsv(rows, `scramble-${sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`);
      };
    } catch (e) { console.error('showResults', e); }
    cleanup();
  }

  // Same podium component as the Vocab Race results (CSS handles order).
  function renderPodium(players) {
    const positions = ['first', 'second', 'third'];
    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('podium').innerHTML = players.slice(0, 3).map((p, i) => `
      <div class="podium-place ${positions[i]}">
        <div class="podium-rank" style="font-size: 2rem;">${medals[i]}</div>
        <div class="podium-name" style="font-weight: 600; margin-top: 6px;">${MG.escHtml(p.name)}</div>
        <div class="podium-score" style="color: var(--accent-primary); font-weight: 700; margin-top: 4px;">${p.score || 0} pts</div>
      </div>`).join('');
  }

  function cleanup() {
    if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
    if (unsubSession) { unsubSession(); unsubSession = null; }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('nextRoundBtn').addEventListener('click', () => {
      if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
      advanceRound();
    });
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await MG.ask('End the game?', 'Everyone moves to the results screen. This cannot be undone.', 'End game');
      if (ok) endGame();
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      MG.ask('Leave the game?', `A game is in progress. Leaving to ${label} stops the round timer - end the game first?`, 'Leave anyway')
        .then(ok => { if (ok) window.location.href = href; });
    }
    const b1 = document.getElementById('backToClassroom');
    const b2 = document.getElementById('backToDashboard');
    if (b1) b1.addEventListener('click', e => confirmLeave(e, 'Classroom Mode'));
    if (b2) b2.addEventListener('click', e => confirmLeave(e, 'the dashboard'));
  });

  window.addEventListener('beforeunload', e => {
    cleanup();
    if (gameInFlight) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
})();
