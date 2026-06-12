/* ============================================================
   TRUST NO ONE — Teacher (host) controller — Phase 1
   ----------------------------------------------------------------
   Same trust model as The Heist: teacher's tab is the referee.
   Phase 1 scope (this build):
     • Auto-create session from URL params (no manual form here)
     • Lobby + QR + roster
     • Role assignment when host hits Start (impostors random)
     • 8-second liftoff briefing with full crew list visible to host
     • Live host board with role, investigations counter, accuracy
     • End-mission → results screen

   Future phases will add:
     • Clue stream + sabotage actions (Phase 2)
     • Meeting + voting + eject (Phase 3)
     • Ghost mode + win conditions + final podium (Phase 4)

   Firestore shape (this phase):
     /trust_sessions/{code}
       { code, status, hostUid, hostName, packId, packName,
         settings: { numImpostors, target, reliability, reward,
                     duration, studentMeetings, meetingCooldown },
         questionReward, durationSec,
         createdAt, startedAt, endedAt }
       /players/{uid}
         { uid, name, avatar, role, alive, balance,
           investigationsCompleted, questionsAnswered, questionsCorrect,
           sabotageCharges, falseClueCharges, meetingButtons,
           joinedAt }
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

  // ── Background music (mirrors Heist + Vocab Race) ──────────
  const musicTracks = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
  ];
  let musicPlaying = false;
  let currentTrackIndex = -1;
  function playRandomTrack() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    let idx = Math.floor(Math.random() * musicTracks.length);
    if (idx === currentTrackIndex) idx = (idx + 1) % musicTracks.length;
    currentTrackIndex = idx;
    audio.src = musicTracks[idx];
    audio.load();
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  }
  window.toggleMusic = function () {
    const audio = document.getElementById('bgMusic');
    const btn   = document.getElementById('musicBtn');
    if (!audio || !btn) return;
    if (musicPlaying) {
      audio.pause(); btn.textContent = '🎵'; btn.classList.remove('playing');
    } else {
      playRandomTrack(); btn.textContent = '🔊'; btn.classList.add('playing');
    }
    musicPlaying = !musicPlaying;
  };
  window.nextTrack = function () { if (musicPlaying) playRandomTrack(); };
  window.setVolume = function (val) {
    const audio = document.getElementById('bgMusic');
    if (audio) audio.volume = (Number(val) || 0) / 100;
  };

  // ── State ──────────────────────────────────────────────────
  let currentUser     = null;
  let packs           = [];
  let activePack      = null;
  let sessionCode     = null;
  let unsubPlayers    = null;
  let unsubSession    = null;
  let unsubSabotages  = null;          // Phase 2 — pending sabotages from impostors
  let timerInterval   = null;
  let clueInterval    = null;          // Phase 2 — fires the clue engine every N seconds
  let liftoffTimer    = null;
  let gameInFlight    = false;

  // Snapshot of player history used to detect "streaks" / "slumps".
  // Keyed by uid → { lastAnswered, lastCorrect, recentCorrect: [bool,bool,…] }.
  // The host's subscription updates these on every player-doc change.
  const playerHistory = Object.create(null);

  // ── Phase 3 state ─────────────────────────────────────────
  let unsubActiveMeeting = null;       // listens to /meetings/{activeMeetingId}
  let unsubMeetingVotes  = null;       // listens to /meetings/{activeMeetingId}/votes
  let meetingTimerInt    = null;       // 1s tick for the countdown
  let meetingCooldownInt = null;       // 1s tick for the cooldown banner
  let allPlayersCache    = [];         // last roster snapshot, used by meeting UI

  // ── Phase 4 state ─────────────────────────────────────────
  let unsubDonations    = null;        // listens to /donations status=pending
  let cachedSession     = null;        // last session snapshot — used for win check
  let winFired          = false;       // guard so we don't double-fire the win

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function generateCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'trust-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  function setView(id) {
    document.documentElement.removeAttribute('data-trust-view');
    ['auto-creating','lobby','liftoff','live','meeting','eject','results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  // Themed confirm modal — used for End-mission etc.
  function ask(title, msg, okLabel) {
    return new Promise(resolve => {
      const bg   = document.getElementById('trustConfirm');
      const titleEl = document.getElementById('trustConfirmTitle');
      const msgEl   = document.getElementById('trustConfirmMsg');
      const okBtn   = document.getElementById('trustConfirmOk');
      const cnBtn   = document.getElementById('trustConfirmCancel');
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
    // Teacher role check (matches Heist host behaviour).
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

    await loadPacks();

    // Auto-create from URL params. Pre-paint sync in the HTML already
    // shows the "Preparing mission…" placeholder so there's no flash.
    const params = new URLSearchParams(location.search);
    if (params.get('auto') === '1') {
      const settings = {
        packId: params.get('pack') || '',
        numImpostors:     parseInt(params.get('imp') || '2', 10),
        target:           parseInt(params.get('tgt') || '10', 10),
        reliability:      parseFloat(params.get('rel') || '0.75'),
        questionReward:   parseInt(params.get('rew') || '10', 10),
        durationMin:      parseInt(params.get('dur') || '15', 10),
        studentMeetings:  parseInt(params.get('sm')  || '1', 10) === 1,
        meetingCooldown:  parseInt(params.get('cd')  || '30', 10),
        // Investigation-question source: vocab (pack, default), grammar,
        // or mixed (both).
        questionSource:   ['grammar', 'mixed'].indexOf(params.get('qsrc')) >= 0 ? params.get('qsrc') : 'vocab',
        grammarLevel:     params.get('glv') || '',
        grammarUnit:      params.get('gun') || 'all'
      };
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
      setView('auto-creating');
      await createSession(settings);
      if (!sessionCode) {
        // creation failed — fall back to picker so the teacher can retry
        window.location.replace('classroom-teacher.html');
      }
      return;
    }

    // Manual entry (shouldn't happen — the pre-paint script bounces
    // out — but defensive fallback).
    window.location.replace('classroom-teacher.html');
  });

  async function loadPacks() {
    try {
      const r = await fetch('classroom/data/heist-packs.json', { cache: 'no-store' });
      const j = await r.json();
      packs = j.packs || [];
    } catch (e) {
      console.error('pack load failed', e);
      toast('Could not load hint packs', 'fail');
    }
  }

  // ── Create session ─────────────────────────────────────────
  async function createSession(settings) {
    activePack = packs.find(p => p.id === settings.packId);
    if (!activePack) { toast('Hint pack missing — bouncing back to picker', 'fail'); return; }

    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('trust_sessions').doc(code).get();
      if (!exists.exists) break;
      code = generateCode();
    }

    const session = {
      code,
      status: 'lobby',
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      packId: activePack.id,
      packName: activePack.name,
      // Trust draws questions from the same shape as Heist's packs.
      // The full questions list is left out of the session doc; clients
      // re-fetch the pack JSON to get definitions + distractors.
      settings: {
        numImpostors:     settings.numImpostors,
        target:           settings.target,
        reliability:      settings.reliability,
        questionReward:   settings.questionReward,
        durationSec:      settings.durationMin * 60,
        studentMeetings:  settings.studentMeetings,
        meetingCooldown:  settings.meetingCooldown
      },
      // Mirror these at the top of the doc so client code that
      // doesn't crack open .settings still works.
      questionReward: settings.questionReward,
      questionSource: settings.questionSource || 'vocab',
      grammarLevel:   settings.grammarLevel || '',
      grammarUnit:    settings.grammarUnit || 'all',
      durationSec:    settings.durationMin * 60,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt:   null
    };

    try {
      await db.collection('trust_sessions').doc(code).set(session);
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
    const url = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}classroom-trust-student.html?code=${encodeURIComponent(code)}`;
    const urlEl = document.getElementById('joinUrl');
    if (urlEl) { urlEl.textContent = url; urlEl.href = url; }
    const qrImg = document.getElementById('qrImg');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;

    unsubPlayers = db.collection('trust_sessions').doc(code).collection('players')
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
      btn.textContent = '🚀 Need at least 4 players to launch';
      return;
    }
    // Reuse the Vocab-Race .player-card markup so visually the lobby
    // is identical to the other games.
    el.innerHTML = players.map(p => `
      <div class="player-card">
        <div class="player-avatar">${escHtml(p.avatar || '🚀')}</div>
        <div class="player-name">${escHtml(p.name)}</div>
        <div class="player-status ready">✓ Ready</div>
      </div>`).join('');
    // Need at least 4 players for the social-deduction mechanic to work
    // (else there aren't enough crewmates to make voting meaningful).
    const btn = document.getElementById('startBtn');
    const ok = players.length >= 4;
    btn.disabled = !ok;
    btn.textContent = ok
      ? `🚀 Launch mission (${players.length} players)`
      : `🚀 Need at least 4 players to launch (${players.length}/4)`;
  }

  // ── Start: assign roles, run briefing, go live ────────────
  async function startGame() {
    if (!sessionCode) return;
    try {
      // Pull current players, pick N impostors at random, write roles.
      const sref = db.collection('trust_sessions').doc(sessionCode);
      const snap = await sref.collection('players').orderBy('joinedAt', 'asc').get();
      const players = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      if (players.length < 4) { toast('Need at least 4 players', 'fail'); return; }

      const sdoc = await sref.get();
      const settings = (sdoc.data() && sdoc.data().settings) || {};
      const N = Math.min(settings.numImpostors || 2, Math.floor(players.length / 2));

      // Fisher-Yates shuffle to pick impostors fairly.
      const idxs = players.map((_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }
      const impostorSet = new Set(idxs.slice(0, N).map(i => players[i].uid));

      // Atomic batch write of all roles + initial counters.
      const batch = db.batch();
      players.forEach(p => {
        const isImp = impostorSet.has(p.uid);
        batch.update(sref.collection('players').doc(p.uid), {
          role:                     isImp ? 'impostor' : 'crewmate',
          alive:                    true,
          investigationsCompleted:  0,
          balance:                  0,
          questionsAnswered:        0,
          questionsCorrect:         0,
          sabotageCharges:          isImp ? 2 : 0,
          falseClueCharges:         isImp ? 1 : 0,
          meetingButtons:           (settings.studentMeetings ? 1 : 0)
        });
      });
      batch.update(sref, {
        status: 'liftoff',
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // Phase 4: lock the crewmate count at launch so the
        // investigations-target win condition is target × this count
        // (not target × however-many-survive-the-meeting). Stops the
        // game shrinking the bar when impostors eject crewmates.
        initialCrewmates: players.length - N,
        initialImpostors: N
      });
      await batch.commit();

      gameInFlight = true;
      enterLiftoff(players, impostorSet);
    } catch (e) {
      console.error('startGame', e);
      toast('Could not launch: ' + e.message, 'fail');
    }
  }

  function enterLiftoff(players, impostorSet) {
    setView('liftoff');

    // Host's briefing shows ALL roles — they need to moderate.
    const list = document.getElementById('liftoffRoster');
    list.innerHTML = players.map(p => {
      const isImp = impostorSet.has(p.uid);
      return `
        <div style="display:flex; align-items:center; gap:8px;
                    background: var(--t-surface-2);
                    border: 1px solid ${isImp ? 'rgba(245,158,11,0.4)' : 'rgba(6,182,212,0.4)'};
                    border-radius: 10px; padding: 8px 12px;">
          <span style="font-size:1.3em;">${escHtml(p.avatar || '🚀')}</span>
          <span style="flex:1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(p.name)}</span>
          <span class="trust-chip ${isImp ? 'impostor' : 'crewmate'}" style="font-size:0.7em;">
            ${isImp ? '🎭 Impostor' : '🛰️ Crewmate'}
          </span>
        </div>`;
    }).join('');

    // 8-second countdown, then flip status to 'playing' so students
    // exit their briefing and start answering questions.
    let remaining = 8;
    const cd = document.getElementById('liftoffCountdown');
    cd.textContent = `Game starts in ${remaining}…`;
    liftoffTimer = setInterval(async () => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(liftoffTimer);
        liftoffTimer = null;
        try {
          await db.collection('trust_sessions').doc(sessionCode).update({ status: 'playing' });
        } catch (e) { console.error('liftoff → playing', e); }
        enterLive();
      } else {
        cd.textContent = `Game starts in ${remaining}…`;
      }
    }, 1000);
  }

  // ── Live host view ─────────────────────────────────────────
  function enterLive() {
    setView('live');
    document.getElementById('liveCode').textContent = sessionCode;

    if (unsubSession) unsubSession();
    unsubSession = db.collection('trust_sessions').doc(sessionCode)
      .onSnapshot(doc => {
        const d = doc.data();
        if (!d) return;
        cachedSession = d;
        if (d.status === 'finished') showResults();
        const startedAt = d.startedAt && d.startedAt.toMillis ? d.startedAt.toMillis() : null;
        if (startedAt && !timerInterval) startTimer(startedAt, d.durationSec);

        // Phase 3: react to status transitions so the host's view
        // tracks meetings + ejects alongside the students.
        if (d.status === 'meeting' && d.activeMeetingId) {
          openHostMeetingView(d.activeMeetingId);
        } else if (d.status === 'playing') {
          // Coming OUT of a meeting (or first entry) — make sure
          // we're showing the live board.
          const liveVisible = document.getElementById('view-live') &&
                              document.getElementById('view-live').style.display !== 'none';
          if (!liveVisible) {
            setView('live');
            document.getElementById('liveCode').textContent = sessionCode;
          }
          // Drive the cooldown banner from the session field.
          startCooldownTickerHost(d.meetingCooldownUntil);
        }
      });

    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('trust_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        allPlayersCache = players;
        // Maintain a per-player history so the clue engine can detect
        // "got the last 3 right" / "just got 2 wrong" patterns without
        // re-reading the whole player doc each tick.
        snap.docChanges().forEach(ch => {
          const p = ch.doc.data();
          const prev = playerHistory[p.uid] || { lastAnswered: 0, lastCorrect: 0, recent: [] };
          const ansDelta = (p.questionsAnswered || 0) - (prev.lastAnswered || 0);
          const corDelta = (p.questionsCorrect  || 0) - (prev.lastCorrect  || 0);
          // If they answered more questions since last snapshot, append
          // boolean(s) to `recent` reflecting whether each was correct.
          // We only know the aggregate, so we approximate: assume all
          // ansDelta answers were either correct-correct… or
          // mostly-correct etc., split by corDelta.
          for (let i = 0; i < ansDelta; i++) {
            const isCorrect = i < corDelta;
            prev.recent.push(isCorrect);
          }
          while (prev.recent.length > 6) prev.recent.shift();
          prev.lastAnswered = p.questionsAnswered || 0;
          prev.lastCorrect  = p.questionsCorrect  || 0;
          playerHistory[p.uid] = prev;
        });
        renderLiveBoard(players);
        // Phase 4: investigations-target win check fires every time a
        // player doc updates. Cheap — early-bails if game's done.
        checkInvestigationsWin(players);
      });

    // Phase 4: listen for pending donations from ghosts. Each pending
    // doc fires a transaction that credits the recipient (or refunds
    // the donor if the recipient died in-flight).
    if (unsubDonations) unsubDonations();
    unsubDonations = db.collection('trust_sessions').doc(sessionCode).collection('donations')
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          resolveDonation(ch.doc.id, ch.doc.data()).catch(err =>
            console.error('resolveDonation', err)
          );
        });
      });

    // Phase 3: listen for newly-opened meetings. When a STUDENT
    // calls an emergency meeting they can only create the /meetings
    // doc — they can't flip session.status (rules block non-host
    // writes to the session doc). So the host's tab detects the new
    // meeting and flips status here.
    db.collection('trust_sessions').doc(sessionCode).collection('meetings')
      .where('status', '==', 'open')
      .onSnapshot(snap => {
        snap.docChanges().forEach(async ch => {
          if (ch.type !== 'added') return;
          const meetingId = ch.doc.id;
          const sref = db.collection('trust_sessions').doc(sessionCode);
          const sdoc = await sref.get();
          const sdata = sdoc.data() || {};
          // Already in a meeting? Ignore (race protection — should be
          // rare because the cooldown banner disables new triggers).
          if (sdata.status === 'meeting' && sdata.activeMeetingId) return;
          // Cooldown still in effect? Ignore the trigger and log.
          const cdMs = sdata.meetingCooldownUntil && sdata.meetingCooldownUntil.toMillis
            ? sdata.meetingCooldownUntil.toMillis() : 0;
          if (Date.now() < cdMs) {
            console.warn('meeting created during cooldown — ignoring', meetingId);
            return;
          }
          try {
            await sref.update({ status: 'meeting', activeMeetingId: meetingId });
          } catch (e) { console.error('meeting status flip', e); }
        });
      });

    // Phase 2: subscribe to pending sabotages — apply each as the
    // referee. Effect = 💸20 from target + a public clue firing.
    if (unsubSabotages) unsubSabotages();
    unsubSabotages = db.collection('trust_sessions').doc(sessionCode).collection('sabotages')
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          resolveSabotage(ch.doc.id, ch.doc.data()).catch(err =>
            console.error('resolveSabotage', err)
          );
        });
      });

    // Phase 2: clue cadence. Every 60s while playing, fire ONE clue
    // visible to all players. Reliability slider determines TRUE vs
    // random. Single-clue cadence is the Gimkit model (shared feed).
    if (clueInterval) clearInterval(clueInterval);
    clueInterval = setInterval(() => {
      fireScheduledClue().catch(err => console.error('fireScheduledClue', err));
    }, 60 * 1000);
    // Fire once early so the feed isn't empty for the first minute.
    setTimeout(() => fireScheduledClue().catch(err => console.error(err)), 8 * 1000);

    // Subscribe to the clue feed so the host can watch it live.
    db.collection('trust_sessions').doc(sessionCode).collection('clues')
      .orderBy('createdAt', 'desc').limit(40)
      .onSnapshot(snap => {
        const list = snap.docs.map(d => d.data());
        renderClueFeed(list);
      });
  }
  function renderClueFeed(clues) {
    const el = document.getElementById('clueFeed');
    const count = document.getElementById('clueCount');
    if (!el) return;
    if (count) {
      const total = clues.length;
      const injected = clues.filter(c => c.injected).length;
      count.textContent = total
        ? `${total} clues · ${injected} planted`
        : '';
    }
    if (!clues.length) return;
    el.innerHTML = clues.map(c => {
      const t = c.createdAt && c.createdAt.toDate
        ? c.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      // Host-only debug: tag whether the clue was true / false / injected.
      // Students never see these tags — just the text.
      const tag = c.injected
        ? '<span style="background:rgba(245,158,11,0.18); color:var(--t-amber-2); border:1px solid rgba(245,158,11,0.4); padding:1px 6px; border-radius:999px; font-size:9px; font-weight:800; letter-spacing:0.08em;">PLANTED</span>'
        : (c.isTrue
            ? '<span style="background:rgba(6,182,212,0.14); color:var(--t-cyan-2); border:1px solid rgba(6,182,212,0.4); padding:1px 6px; border-radius:999px; font-size:9px; font-weight:800; letter-spacing:0.08em;">TRUE</span>'
            : '<span style="background:rgba(99,102,241,0.14); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4); padding:1px 6px; border-radius:999px; font-size:9px; font-weight:800; letter-spacing:0.08em;">NOISE</span>');
      return `
        <div style="padding:8px 10px; border-bottom:1px dashed var(--t-border);
                    font-size:0.9em; display:flex; gap:8px; align-items:flex-start;">
          <span style="color:var(--t-text-mut); font-family:JetBrains Mono; font-size:0.8em; min-width:62px;">${t}</span>
          <span style="flex:1; line-height:1.4;">${escHtml(c.text || '')}</span>
          ${tag}
        </div>`;
    }).join('');
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
        // Phase 4: timer hit zero with no win condition — flag this
        // as stalemate so the results banner can call it out.
        endGame('stalemate_time').catch(() => {});
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }
  function renderLiveBoard(players) {
    const tbody = document.getElementById('liveBoard');
    const sorted = [...players].sort((a, b) =>
      (b.investigationsCompleted || 0) - (a.investigationsCompleted || 0)
    );
    let totalInvestigations = 0;
    tbody.innerHTML = sorted.map((p, i) => {
      const role = p.role || '—';
      const alive = p.alive !== false;
      totalInvestigations += (p.investigationsCompleted || 0);
      const acc = (p.questionsAnswered || 0)
        ? Math.round((p.questionsCorrect || 0) / (p.questionsAnswered || 1) * 100) + '%'
        : '—';
      return `
        <tr class="${alive ? '' : 'ghost'}">
          <td>${i + 1}</td>
          <td><span style="display:inline-flex; align-items:center; justify-content:center;
                          width:22px; height:22px; border-radius:50%;
                          background: linear-gradient(135deg, var(--t-cyan), var(--t-violet));
                          font-size:11px; margin-right:6px; vertical-align:middle;">
            ${escHtml(p.avatar || '🚀')}</span>${escHtml(p.name)}</td>
          <td class="role-cell ${role}">${role === 'impostor' ? '🎭 Impostor' : '🛰️ Crewmate'}</td>
          <td>${alive ? '✅ Alive' : '👻 Ghost'}</td>
          <td>${p.investigationsCompleted || 0}</td>
          <td>${p.balance || 0}</td>
          <td>${acc}</td>
        </tr>`;
    }).join('');
    const tot = document.getElementById('liveProgress');
    if (tot) tot.textContent = totalInvestigations;
  }

  // ── Phase 2: Clue engine ───────────────────────────────────
  // Called on a 60s interval while the session is in 'playing'.
  // Generates ONE clue based on real player stats (high probability,
  // per the reliability slider) or a noisy template (otherwise).
  // Writes the clue to /clues; students subscribe and render.
  async function fireScheduledClue() {
    if (!sessionCode) return;
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      const sdoc = await sref.get();
      const s = sdoc.data();
      if (!s || s.status !== 'playing') return;
      const reliability = (s.settings && s.settings.reliability) || 0.75;

      const playersSnap = await sref.collection('players').get();
      const alivePlayers = playersSnap.docs
        .map(d => d.data())
        .filter(p => p.alive !== false);
      if (alivePlayers.length < 2) return;

      // Coin-flip the reliability — TRUE clue from real stats, or
      // FALSE clue from a random template.
      const isTrue = Math.random() < reliability;
      const clue = isTrue
        ? generateTrueClue(alivePlayers)
        : generateFalseClue(alivePlayers);
      if (!clue) return;

      await sref.collection('clues').add({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'resolved',
        targetUid: clue.targetUid,
        targetName: clue.targetName,
        text:       clue.text,
        kind:       clue.kind,
        isTrue,
        injected:   false
      });
    } catch (e) {
      console.error('fireScheduledClue', e);
    }
  }

  // Pick the most "noteworthy" thing from a player's recent activity.
  // Falls back to an inactive/streak template if nothing stands out.
  function generateTrueClue(alivePlayers) {
    const ranked = [...alivePlayers].sort((a, b) => (b.questionsAnswered || 0) - (a.questionsAnswered || 0));
    for (const p of ranked) {
      const h = playerHistory[p.uid];
      if (!h || !h.recent || !h.recent.length) continue;
      const last3 = h.recent.slice(-3);
      const last2 = h.recent.slice(-2);
      const allRight = last3.length === 3 && last3.every(x => x);
      const allWrong = last2.length === 2 && last2.every(x => !x);
      if (allRight) {
        return {
          targetUid: p.uid, targetName: p.name, kind: 'streak_pos',
          text: `🔥 ${p.name} just got 3 in a row correct.`
        };
      }
      if (allWrong) {
        return {
          targetUid: p.uid, targetName: p.name, kind: 'streak_neg',
          text: `📉 ${p.name} just got 2 wrong in a row.`
        };
      }
    }
    // Nobody had a strong recent pattern — fall back to a leader/lagger
    // observation on aggregate stats.
    if (ranked.length) {
      const leader = ranked[0];
      const investigator = [...alivePlayers].sort((a, b) =>
        (b.investigationsCompleted || 0) - (a.investigationsCompleted || 0)
      )[0];
      if ((leader.questionsAnswered || 0) > 4) {
        return {
          targetUid: investigator.uid, targetName: investigator.name, kind: 'top_investigator',
          text: `🛰️ ${investigator.name} has logged ${investigator.investigationsCompleted || 0} investigations.`
        };
      }
    }
    return null;
  }

  // Random plausible-looking clue about a random player. Reliability
  // slider says how often these fire vs the TRUE ones.
  function generateFalseClue(alivePlayers) {
    const FALSE_TEMPLATES = [
      { kind: 'streak_neg',    text: p => `📉 ${p.name} keeps getting wrong answers.` },
      { kind: 'streak_pos',    text: p => `🔥 ${p.name} is on a hot streak.` },
      { kind: 'sabotage_trail',text: p => `⚠️ Someone may have interfered with ${p.name}'s investigation.` },
      { kind: 'inactive',      text: p => `👀 ${p.name} hasn't been spotted contributing recently.` },
      { kind: 'fast',          text: p => `⚡ ${p.name} is answering suspiciously fast.` },
      { kind: 'slow',          text: p => `🐢 ${p.name} is moving slowly.` }
    ];
    const p = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const t = FALSE_TEMPLATES[Math.floor(Math.random() * FALSE_TEMPLATES.length)];
    return {
      targetUid: p.uid, targetName: p.name, kind: t.kind, text: t.text(p)
    };
  }

  // ── Phase 2: Sabotage resolver ─────────────────────────────
  // Listens for /sabotages/{id} where status === 'pending'.
  // Applies the effect (💸20 from the target) and creates a tied
  // sabotage_trail clue so the room has a visible signal.
  async function resolveSabotage(sabId, sab) {
    const sref = db.collection('trust_sessions').doc(sessionCode);
    const sabRef = sref.collection('sabotages').doc(sabId);
    const targetRef = sref.collection('players').doc(sab.targetUid);
    try {
      let amountTaken = 0;
      let targetName  = sab.targetName || '';
      await db.runTransaction(async tx => {
        const tSnap = await tx.get(targetRef);
        if (!tSnap.exists) return;
        const t = tSnap.data();
        // Don't tax a player who's already dead in the water (alive=false)
        // — they can't really be "sabotaged".
        if (t.alive === false) return;
        const bal = Math.max(0, t.balance || 0);
        amountTaken = Math.min(20, bal);
        targetName = t.name || targetName;
        tx.update(targetRef, { balance: bal - amountTaken });
        tx.update(sabRef, {
          status: 'resolved',
          amountTaken,
          resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      // Fire a sabotage_trail clue. Always shown as a "true" clue
      // since SOMETHING really happened; whether students can decode
      // who's behind it is the social-deduction game.
      await sref.collection('clues').add({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'resolved',
        targetUid: sab.targetUid,
        targetName,
        text: `⚠️ Someone tampered with ${targetName}'s investigation.`,
        kind: 'sabotage_trail',
        isTrue: true,
        injected: false
      });
    } catch (e) {
      console.error('resolveSabotage', e);
    }
  }

  // ── Phase 3: Meeting trigger ───────────────────────────────
  // Host clicks "Call meeting" or a student emergency button writes
  // a meeting doc. Either way, the host fires `openMeeting` which
  // creates the meeting + flips session.status to 'meeting'.
  async function openMeeting(calledByUid, calledByName, reason) {
    if (!sessionCode) return;
    const sref = db.collection('trust_sessions').doc(sessionCode);
    try {
      // Cooldown guard — don't open a meeting if the previous one's
      // cooldown is still ticking. (Belt-and-braces; the buttons that
      // call this are already disabled by the same check.)
      const sdoc = await sref.get();
      const sdata = sdoc.data() || {};
      const cdMs  = sdata.meetingCooldownUntil && sdata.meetingCooldownUntil.toMillis
        ? sdata.meetingCooldownUntil.toMillis() : 0;
      if (Date.now() < cdMs) {
        toast(`Meeting cooldown active (${Math.ceil((cdMs - Date.now())/1000)}s)`, 'fail');
        return;
      }
      // Create the meeting doc.
      const ref = await sref.collection('meetings').add({
        calledBy: calledByUid,
        calledByName: calledByName,
        reason: reason || '',
        duration: 60,
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'open'
      });
      // Flip session into meeting state.
      await sref.update({
        status: 'meeting',
        activeMeetingId: ref.id
      });
    } catch (e) {
      console.error('openMeeting', e);
      toast('Could not start meeting: ' + e.message, 'fail');
    }
  }

  // Open the host's view-meeting screen and subscribe to the meeting
  // + its votes so the live tally on the host updates in real time.
  function openHostMeetingView(meetingId) {
    setView('meeting');
    const sref = db.collection('trust_sessions').doc(sessionCode);
    const mref = sref.collection('meetings').doc(meetingId);

    if (unsubActiveMeeting) unsubActiveMeeting();
    unsubActiveMeeting = mref.onSnapshot(doc => {
      const m = doc.data();
      if (!m) return;
      document.getElementById('meetingCalledByHost').textContent = m.calledByName || '—';
      const rRow = document.getElementById('meetingReasonRowHost');
      rRow.textContent = m.reason ? `"${m.reason}"` : '';
      // Start the local countdown the first time we see startedAt.
      const startedAt = m.startedAt && m.startedAt.toMillis ? m.startedAt.toMillis() : null;
      if (startedAt && !meetingTimerInt) startMeetingTimer(startedAt, m.duration || 60, meetingId);
      if (m.status === 'resolved') {
        // Move to eject reveal — host owns the reveal animation.
        if (meetingTimerInt) { clearInterval(meetingTimerInt); meetingTimerInt = null; }
        showHostEjectReveal(m);
      }
    });

    if (unsubMeetingVotes) unsubMeetingVotes();
    unsubMeetingVotes = mref.collection('votes').onSnapshot(snap => {
      const votes = snap.docs.map(d => ({ voterUid: d.id, ...d.data() }));
      renderHostMeetingGrid(votes);
    });
  }

  // Live tally + tile rendering during the meeting (host POV).
  // Tiles show vote counts here (host-only — students don't see counts
  // until reveal).
  function renderHostMeetingGrid(votes) {
    const grid = document.getElementById('meetingGridHost');
    if (!grid) return;
    const tally = Object.create(null);
    votes.forEach(v => { if (v.targetUid) tally[v.targetUid] = (tally[v.targetUid] || 0) + 1; });
    const aliveList = allPlayersCache.filter(p => p.alive !== false);
    const tiles = aliveList.map(p => `
      <div class="meeting-tile" style="cursor:default;">
        <span class="vote-count ${tally[p.uid] ? 'show' : ''}">${tally[p.uid] || 0}</span>
        <div class="ava">${escHtml(p.avatar || '🚀')}</div>
        <div class="name">${escHtml(p.name)}</div>
      </div>`).join('');
    const skipCount = tally['skip'] || 0;
    const skipTile = `
      <div class="meeting-tile skip" style="cursor:default;">
        <span class="vote-count ${skipCount ? 'show' : ''}">${skipCount}</span>
        <div class="ava">🕊️</div>
        <div class="name">Skip vote</div>
      </div>`;
    grid.innerHTML = tiles + skipTile;
  }

  function startMeetingTimer(startedAtMs, duration, meetingId) {
    const endMs = startedAtMs + duration * 1000;
    const el = document.getElementById('meetingTimerHost');
    const tick = () => {
      const r = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      if (el) {
        el.textContent = String(r);
        el.classList.toggle('warn', r <= 10);
      }
      if (r <= 0) {
        clearInterval(meetingTimerInt);
        meetingTimerInt = null;
        resolveMeeting(meetingId).catch(err => console.error('resolveMeeting', err));
      }
    };
    tick();
    meetingTimerInt = setInterval(tick, 1000);
  }

  // Read all votes, tally, pick winner (random tiebreak), apply
  // ejection if not 'skip', flip session back to playing, then
  // (back in the snapshot handler) trigger the eject reveal.
  async function resolveMeeting(meetingId) {
    if (!sessionCode) return;
    const sref = db.collection('trust_sessions').doc(sessionCode);
    const mref = sref.collection('meetings').doc(meetingId);
    try {
      const mdoc = await mref.get();
      if (!mdoc.exists || mdoc.data().status === 'resolved') return;  // race guard

      const votesSnap = await mref.collection('votes').get();
      const tally = Object.create(null);
      votesSnap.forEach(v => {
        const t = v.data().targetUid;
        if (t) tally[t] = (tally[t] || 0) + 1;
      });
      let highest = -1;
      let winners = [];
      for (const uid of Object.keys(tally)) {
        if (tally[uid] > highest) { highest = tally[uid]; winners = [uid]; }
        else if (tally[uid] === highest) { winners.push(uid); }
      }
      // Skip wins all ties (no one is ejected — safer default).
      let ejectedUid = null;
      let ejectedName = '';
      let ejectedRole = null;
      let ejectedAvatar = '';
      if (winners.length && winners[0] !== 'skip' && !winners.includes('skip')) {
        // If there's a clean winner that isn't skip, eject them.
        const target = winners[Math.floor(Math.random() * winners.length)];
        const targetPlayer = allPlayersCache.find(p => p.uid === target);
        if (targetPlayer) {
          ejectedUid    = target;
          ejectedName   = targetPlayer.name;
          ejectedRole   = targetPlayer.role;
          ejectedAvatar = targetPlayer.avatar || '🚀';
          // Flip alive=false on the ejected player.
          await sref.collection('players').doc(target).update({ alive: false });
        }
      }

      // Set cooldown for the next meeting.
      const cdSec = (await sref.get()).data().settings?.meetingCooldown || 30;
      const cooldownUntil = new Date(Date.now() + cdSec * 1000);

      // Mark meeting resolved with the tally + ejection metadata.
      await mref.update({
        status: 'resolved',
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
        tally,
        ejectedUid,
        ejectedName,
        ejectedRole,
        ejectedAvatar
      });

      // Check win conditions on the new player roster.
      const playersSnap = await sref.collection('players').get();
      const players = playersSnap.docs.map(d => d.data());
      const aliveCrew = players.filter(p => p.alive !== false && p.role === 'crewmate').length;
      const aliveImp  = players.filter(p => p.alive !== false && p.role === 'impostor').length;
      if (aliveImp === 0) {
        // Crewmate victory.
        await sref.update({
          status: 'finished',
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
          winner: 'crewmates',
          activeMeetingId: null
        });
        return;
      }
      if (aliveImp >= aliveCrew) {
        // Impostor victory.
        await sref.update({
          status: 'finished',
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
          winner: 'impostors',
          activeMeetingId: null
        });
        return;
      }

      // No game-ending result — flip back to playing with cooldown.
      // The student snapshot handlers will see status flip back and
      // route them through the eject-reveal then back to the question
      // stream. Host's onSnapshot in this file does the same.
      await sref.update({
        status: 'playing',
        activeMeetingId: null,
        meetingCooldownUntil: firebase.firestore.Timestamp.fromDate(cooldownUntil)
      });
    } catch (e) {
      console.error('resolveMeeting', e);
    }
  }

  // After resolveMeeting runs, the meeting doc is updated with the
  // ejection result. This handler triggers the host's reveal screen
  // for a few seconds before automatically dropping back to live.
  function showHostEjectReveal(meeting) {
    setView('eject');
    const headingEl = document.getElementById('ejectHeadingHost');
    const card      = document.getElementById('ejectRoleCardHost');
    const avaEl     = document.getElementById('ejectAvatarHost');
    const nameEl    = document.getElementById('ejectNameHost');
    const labelEl   = document.getElementById('ejectRoleLabelHost');
    const storyEl   = document.getElementById('ejectStoryHost');
    const cdEl      = document.getElementById('ejectCountdownHost');

    if (meeting.ejectedUid) {
      card.className = 'role-card ' + (meeting.ejectedRole || 'crewmate');
      avaEl.textContent  = meeting.ejectedAvatar || '🚀';
      nameEl.textContent = meeting.ejectedName || 'Player';
      labelEl.textContent = `was ${meeting.ejectedRole === 'impostor' ? 'an IMPOSTOR' : 'a CREWMATE'}`;
      headingEl.textContent = '🚀 Ejected!';
    } else {
      // Skip won — no one ejected.
      card.className = 'role-card crewmate';
      card.style.borderStyle = 'dashed';
      avaEl.textContent  = '🕊️';
      nameEl.textContent = 'No eject';
      labelEl.textContent = 'the crew skipped this vote';
      headingEl.textContent = '🕊️ Vote skipped';
    }

    let r = 5;
    storyEl.innerHTML = `Mission resumes in <span id="ejectCountdownHost">${r}</span>…`;
    const cdInt = setInterval(() => {
      r--;
      const el = document.getElementById('ejectCountdownHost');
      if (el) el.textContent = String(r);
      if (r <= 0) {
        clearInterval(cdInt);
        // Sub-cleanup of the meeting listeners — the next meeting
        // re-subscribes via openHostMeetingView.
        if (unsubActiveMeeting) { unsubActiveMeeting(); unsubActiveMeeting = null; }
        if (unsubMeetingVotes)  { unsubMeetingVotes();  unsubMeetingVotes  = null; }
        setView('live');
      }
    }, 1000);
  }

  // Cooldown countdown on the host's banner.
  function startCooldownTickerHost(cooldownUntilTs) {
    if (meetingCooldownInt) { clearInterval(meetingCooldownInt); meetingCooldownInt = null; }
    const banner = document.getElementById('meetingCooldownBanner');
    const sec    = document.getElementById('meetingCooldownSecs');
    const btn    = document.getElementById('callMeetingBtn');
    if (!banner || !sec || !btn) return;
    const endMs = cooldownUntilTs && cooldownUntilTs.toMillis ? cooldownUntilTs.toMillis() : 0;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      if (remaining <= 0) {
        banner.style.display = 'none';
        btn.disabled = false;
        clearInterval(meetingCooldownInt);
        meetingCooldownInt = null;
        return;
      }
      banner.style.display = '';
      sec.textContent = String(remaining);
      btn.disabled = true;
    };
    tick();
    if (endMs > Date.now()) meetingCooldownInt = setInterval(tick, 1000);
  }

  // ── Phase 4: Donation resolver ─────────────────────────────
  // Ghosts optimistically deduct their own balance and write a
  // pending /donations doc. Host's transaction credits the recipient
  // (or refunds the donor if the recipient died in-flight).
  async function resolveDonation(donId, don) {
    if (!sessionCode || !don) return;
    const sref   = db.collection('trust_sessions').doc(sessionCode);
    const donRef = sref.collection('donations').doc(donId);
    const recRef = sref.collection('players').doc(don.recipientUid);
    const donorRef = sref.collection('players').doc(don.donorUid);
    const amount = Math.max(0, parseInt(don.amount, 10) || 0);
    if (!amount) {
      await donRef.update({
        status: 'rejected', reason: 'bad_amount',
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return;
    }
    try {
      await db.runTransaction(async tx => {
        const rSnap = await tx.get(recRef);
        if (!rSnap.exists) {
          // Recipient vanished — refund the donor.
          tx.update(donorRef, {
            balance: firebase.firestore.FieldValue.increment(amount)
          });
          tx.update(donRef, {
            status: 'rejected', reason: 'recipient_missing',
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
        const r = rSnap.data();
        // Defensive: only credit if recipient is alive AND same role
        // as the donor (matches the rule the student-side enforces).
        const donorSnap = await tx.get(donorRef);
        const donorData = donorSnap.exists ? donorSnap.data() : null;
        const sameRole  = donorData && donorData.role && r.role === donorData.role;
        if (r.alive === false || !sameRole) {
          tx.update(donorRef, {
            balance: firebase.firestore.FieldValue.increment(amount)
          });
          tx.update(donRef, {
            status: 'rejected',
            reason: r.alive === false ? 'recipient_dead' : 'role_mismatch',
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
        tx.update(recRef, {
          balance: firebase.firestore.FieldValue.increment(amount)
        });
        tx.update(donRef, {
          status: 'resolved',
          resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (e) {
      console.error('resolveDonation', e);
    }
  }

  // ── Phase 4: Investigations-target win condition ───────────
  // Sum of alive-crewmate investigations vs. target × initialCrewmates.
  // If met, fire crewmate victory and flip status to finished.
  async function checkInvestigationsWin(players) {
    if (!sessionCode || winFired || !cachedSession) return;
    if (cachedSession.status === 'finished') return;
    const target  = (cachedSession.settings && cachedSession.settings.target) || 0;
    const initial = cachedSession.initialCrewmates || 0;
    if (!target || !initial) return;
    const aliveCrewInv = players
      .filter(p => p.alive !== false && p.role === 'crewmate')
      .reduce((s, p) => s + (p.investigationsCompleted || 0), 0);
    if (aliveCrewInv < target * initial) return;
    winFired = true;
    try {
      await db.collection('trust_sessions').doc(sessionCode).update({
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
        winner: 'crewmates',
        winReason: 'investigations'
      });
    } catch (e) {
      console.error('checkInvestigationsWin', e);
      winFired = false;
    }
  }

  // ── End / results ──────────────────────────────────────────
  async function endGame(reason) {
    if (!sessionCode) return;
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      const sdoc = await sref.get();
      const cur  = sdoc.data() || {};
      const update = {
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // Don't overwrite a winner that's already been set (meeting
      // resolver or investigations-target check might have got there
      // first).
      if (!cur.winner) {
        update.winner    = reason === 'stalemate_time' ? 'stalemate' : 'aborted';
        update.winReason = reason || 'manual';
      }
      await sref.update(update);
    } catch (e) {
      console.error('endGame', e);
    }
  }
  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameInFlight = false;
    setView('results');
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      const sdoc = await sref.get();
      const s = sdoc.data() || {};
      const winner = s.winner || 'aborted';
      const winReason = s.winReason || '';

      // ── Winner banner ───────────────────────────────────
      const banner = document.getElementById('resultsBanner');
      const winIconEl  = document.getElementById('winIcon');
      const winTitleEl = document.getElementById('winTitle');
      const winSubEl   = document.getElementById('winSub');
      if (banner && winIconEl && winTitleEl && winSubEl) {
        // Clear any prior win class.
        banner.classList.remove('win-crewmates', 'win-impostors', 'win-stalemate', 'win-aborted');
        if (winner === 'crewmates') {
          banner.classList.add('win-crewmates');
          winIconEl.textContent = '🛰️';
          winTitleEl.textContent = 'Crewmates win!';
          winSubEl.textContent = winReason === 'investigations'
            ? 'The crew completed enough investigations to expose the mission.'
            : 'Every impostor has been ejected.';
        } else if (winner === 'impostors') {
          banner.classList.add('win-impostors');
          winIconEl.textContent = '🎭';
          winTitleEl.textContent = 'Impostors win!';
          winSubEl.textContent = 'The impostors outnumber the crew. Trust nobody.';
        } else if (winner === 'stalemate') {
          banner.classList.add('win-stalemate');
          winIconEl.textContent = '⏱️';
          winTitleEl.textContent = 'Stalemate — time\'s up';
          winSubEl.textContent = 'The mission timer ran out before either side could close it out.';
        } else {
          banner.classList.add('win-aborted');
          winIconEl.textContent = '🏁';
          winTitleEl.textContent = 'Mission ended';
          winSubEl.textContent = 'The host ended the mission early.';
        }
      }

      // ── Players: split + sort by balance ────────────────
      const psnap = await sref.collection('players').orderBy('balance', 'desc').get();
      const players = psnap.docs.map(d => d.data());
      const crewmates = players.filter(p => p.role === 'crewmate');
      const impostors = players.filter(p => p.role === 'impostor');

      const renderPodium = (target, list) => {
        const el = document.getElementById(target);
        if (!el) return;
        if (!list.length) {
          el.innerHTML = '<div class="podium-empty">No players on this team.</div>';
          return;
        }
        // Top 3 by balance.
        const top = list.slice(0, 3);
        el.innerHTML = top.map((p, i) => {
          const acc = (p.questionsAnswered || 0)
            ? Math.round((p.questionsCorrect || 0) / (p.questionsAnswered || 1) * 100)
            : 0;
          return `
            <div class="podium-row place-${i + 1} ${p.alive === false ? 'ghost' : ''}">
              <div class="podium-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
              <div class="podium-ava">${escHtml(p.avatar || '🚀')}</div>
              <div class="podium-name">${escHtml(p.name)}${p.alive === false ? ' <span class="ghost-tag">👻</span>' : ''}</div>
              <div class="podium-stats">
                <span>💸 ${p.balance || 0}</span>
                <span>🔬 ${p.investigationsCompleted || 0}</span>
                <span>${acc}% acc.</span>
              </div>
            </div>`;
        }).join('');
      };
      renderPodium('podiumCrewmates', crewmates);
      renderPodium('podiumImpostors', impostors);

      // ── Mission stats grid ──────────────────────────────
      // Lightweight aggregate from already-loaded collections; one
      // extra get per stat is fine on results screen.
      const [cluesSnap, sabsSnap, meetsSnap, donsSnap] = await Promise.all([
        sref.collection('clues').get(),
        sref.collection('sabotages').get(),
        sref.collection('meetings').get(),
        sref.collection('donations').get()
      ]);
      const totalClues       = cluesSnap.size;
      const plantedClues     = cluesSnap.docs.filter(d => d.data().injected).length;
      const totalSabs        = sabsSnap.size;
      const totalMeetings    = meetsSnap.size;
      const totalDons        = donsSnap.docs.filter(d => d.data().status === 'resolved').length;
      const totalDonAmount   = donsSnap.docs
        .filter(d => d.data().status === 'resolved')
        .reduce((sum, d) => sum + (d.data().amount || 0), 0);
      const totalInvest      = players.reduce((s, p) => s + (p.investigationsCompleted || 0), 0);

      const statsEl = document.getElementById('resultsStats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="stat-tile"><div class="stat-num">${totalInvest}</div><div class="stat-lbl">🔬 Investigations</div></div>
          <div class="stat-tile"><div class="stat-num">${totalMeetings}</div><div class="stat-lbl">🚨 Meetings</div></div>
          <div class="stat-tile"><div class="stat-num">${totalClues}</div><div class="stat-lbl">🕵️ Clues fired</div></div>
          <div class="stat-tile"><div class="stat-num">${plantedClues}</div><div class="stat-lbl">📝 Fake clues planted</div></div>
          <div class="stat-tile"><div class="stat-num">${totalSabs}</div><div class="stat-lbl">💥 Sabotages</div></div>
          <div class="stat-tile"><div class="stat-num">${totalDons} <span class="stat-num-sub">(💸${totalDonAmount})</span></div><div class="stat-lbl">🎁 Donations</div></div>
        `;
      }

      // ── Per-player table (collapsible) ─────────────────
      const tbody = document.getElementById('resultsTable');
      tbody.innerHTML = players.map((p, i) => {
        const role = p.role || '—';
        const acc = (p.questionsAnswered || 0)
          ? Math.round((p.questionsCorrect || 0) / (p.questionsAnswered || 1) * 100) + '%'
          : '—';
        return `
          <tr class="${p.alive === false ? 'ghost' : ''}">
            <td>${i + 1}</td>
            <td>${escHtml(p.avatar || '🚀')} ${escHtml(p.name)}${p.alive === false ? ' <span style="opacity:0.6;">👻</span>' : ''}</td>
            <td class="role-cell ${role}">
              ${role === 'impostor' ? '🎭 Impostor' : '🛰️ Crewmate'}
            </td>
            <td>${p.balance || 0}</td>
            <td>${p.investigationsCompleted || 0}</td>
            <td>${acc}</td>
          </tr>`;
      }).join('');
    } catch (e) {
      console.error('showResults', e);
    }
    cleanupListeners();
  }
  function cleanupListeners() {
    if (unsubPlayers)       { unsubPlayers();       unsubPlayers       = null; }
    if (unsubSession)       { unsubSession();       unsubSession       = null; }
    if (unsubSabotages)     { unsubSabotages();     unsubSabotages     = null; }
    if (unsubDonations)     { unsubDonations();     unsubDonations     = null; }
    if (unsubActiveMeeting) { unsubActiveMeeting(); unsubActiveMeeting = null; }
    if (unsubMeetingVotes)  { unsubMeetingVotes();  unsubMeetingVotes  = null; }
    if (clueInterval)       { clearInterval(clueInterval);     clueInterval     = null; }
    if (meetingTimerInt)    { clearInterval(meetingTimerInt);  meetingTimerInt  = null; }
    if (meetingCooldownInt) { clearInterval(meetingCooldownInt); meetingCooldownInt = null; }
  }

  // ── DOM wiring ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('bgMusic');
    if (audio) {
      audio.volume = 0.3;
      audio.loop = false;
      audio.addEventListener('ended', () => { if (musicPlaying) playRandomTrack(); });
    }
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await ask('End the mission?',
        'All players go to the results screen. This cannot be undone.',
        'End mission');
      if (ok) endGame();
    });
    // Phase 3: Host-initiated meeting.
    const callBtn = document.getElementById('callMeetingBtn');
    if (callBtn) callBtn.addEventListener('click', async () => {
      const ok = await ask('Call a meeting?',
        'All players will be pulled to the meeting screen. They\'ll vote for 60 seconds.',
        'Call meeting');
      if (ok) openMeeting(currentUser.uid, currentUser.displayName || 'Teacher', '');
    });
    // Phase 3: Host-initiated early-end of the active meeting.
    const forceEnd = document.getElementById('forceEndMeetingBtn');
    if (forceEnd) forceEnd.addEventListener('click', async () => {
      const ok = await ask('End meeting early?',
        'Votes will be tallied immediately with whatever has been submitted so far.',
        'End now');
      if (ok) {
        // Pull active meeting id from the session doc and resolve.
        try {
          const s = await db.collection('trust_sessions').doc(sessionCode).get();
          const mid = s.data() && s.data().activeMeetingId;
          if (mid) await resolveMeeting(mid);
        } catch (e) { console.error('force end', e); }
      }
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });

    // Back-link confirmations when a game is in flight.
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      ask('Leave the mission?',
        `A game is in progress. Leaving to ${label} will leave students hanging.`,
        'Leave anyway').then(ok => { if (ok) window.location.href = href; });
    }
    const b1 = document.getElementById('backToClassroom');
    const b2 = document.getElementById('backToDashboard');
    if (b1) b1.addEventListener('click', (e) => confirmLeave(e, 'Classroom Mode'));
    if (b2) b2.addEventListener('click', (e) => confirmLeave(e, 'the dashboard'));
  });

  window.addEventListener('beforeunload', (e) => {
    cleanupListeners();
    if (liftoffTimer) clearInterval(liftoffTimer);
    if (timerInterval) clearInterval(timerInterval);
    if (gameInFlight) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
})();
