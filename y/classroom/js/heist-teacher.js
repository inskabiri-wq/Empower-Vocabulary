/* ============================================================
   THE HEIST — Teacher (host) controller
   ----------------------------------------------------------------
   The teacher's browser is the REFEREE for this game. Why:
     • No Cloud Functions are available on the current plan, so we
       can't put authoritative logic server-side.
     • The teacher is always physically present and always has the
       page open, so their tab is a reliable trust anchor.

   Responsibilities of this referee:
     • Generate the room code + create session doc
     • Stream the question list (sampled from the chosen hint pack)
     • Listen for `hacks` write requests from students, look up the
       target's password (in /passwords subcollection), validate,
       transfer coins, and mark the hack `resolved`.
     • Tick the game timer and flip status → 'finished' at end.

   Firestore shape (root):
     /heist_sessions/{code}
       { code, status, hostUid, hostName, packId, passwordChoices,
         heistFee, questionReward, durationSec, startedAt, endedAt }
       /players/{uid}
         { uid, name, avatar, balance, joinedAt,
           questionsAnswered, questionsCorrect,
           timesHacked, hacksAttempted, hacksSuccessful, stolenTotal }
       /passwords/{uid}                       ← restricted by rules
         { word }
       /hacks/{autoId}                        ← write-by-attacker
         { attackerUid, attackerName, targetUid, targetName,
           guess, status:'pending'|'resolved',
           success, amountStolen, feeBurned, createdAt, resolvedAt }
   ============================================================ */

(function () {
  'use strict';

  // ── Firebase init (same project as the rest of the app) ────
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

  // ── Background music ───────────────────────────────────────
  // Same track list / behaviour as the Vocab Race classroom. Exposed
  // on window so the inline onclick handlers on the music-control
  // buttons in the HTML can reach them (the rest of this file is
  // wrapped in an IIFE so functions aren't global by default).
  // Heist-flavoured track set — different songs than Vocab Race /
  // Trust classrooms use, so the heist has its own sonic identity
  // ("vault-cracking heist movie" vibe).
  const musicTracks = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'
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
      audio.pause();
      btn.textContent = '🎵';
      btn.classList.remove('playing');
    } else {
      playRandomTrack();
      btn.textContent = '🔊';
      btn.classList.add('playing');
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
  let packs           = [];          // loaded from heist-packs.json
  let activePack      = null;
  let sessionCode     = null;
  let unsubPlayers    = null;
  let unsubHacks      = null;
  let unsubSession    = null;
  let timerInterval   = null;
  // Tracks whether a game is "live in progress" — set true once the
  // host hits Start, set false on results/cleanup. Drives the
  // beforeunload warning + the back-link confirmations so the teacher
  // doesn't accidentally nuke a class mid-round.
  let gameInFlight    = false;

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function generateCode() {
    // 4-char alpha (no 0/O/1/I confusion). 26^4 = 456,976 options,
    // collision-check on create.
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'heist-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  function setView(id) {
    // First setView call wins back control from the pre-paint inline
    // CSS rule (html[data-heist-view="…"] #view-… { display: block !important }).
    // Strip the attribute so inline style.display now takes effect.
    document.documentElement.removeAttribute('data-heist-view');
    ['auto-creating', 'lobby-setup', 'lobby-waiting', 'live', 'results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  // ── Auth gate ──────────────────────────────────────────────
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.replace('index.html');
      return;
    }
    currentUser = user;
    // Verify teacher role — we don't want students hosting Heist
    // games from a stolen URL.
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? (doc.data().role || 'student') : 'student';
      if (role !== 'teacher' && role !== 'admin') {
        document.body.innerHTML = '<div style="padding:40px; text-align:center; color:#f1f5f9; font-family:sans-serif;">Teachers only.</div>';
        return;
      }
    } catch (e) {
      console.error('role check failed', e);
    }
    // Show the user's name in the brand area
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.displayName || user.email || 'Teacher';
    await loadPacks();

    // Auto-create path. classroom-teacher.html's inline Heist setup
    // form hands off to this page via URL params (auto=1). When we
    // see those, we pre-fill the hidden form fields and immediately
    // call createSession() — but show a "Creating room…" placeholder
    // INSTEAD of the setup view so the teacher doesn't see the form
    // flash for a frame before the lobby loads.
    const params = new URLSearchParams(location.search);
    if (params.get('auto') === '1') {
      const packId = params.get('pack') || '';
      const dur    = parseInt(params.get('dur') || '10', 10);
      const rew    = parseInt(params.get('rew') || '10', 10);
      const fee    = parseInt(params.get('fee') || '30', 10);
      // EARN-question source: vocab (pack definitions, default), grammar,
      // or mixed (both). Passwords/hints always come from the pack.
      qSource = ['grammar', 'mixed'].indexOf(params.get('qsrc')) >= 0 ? params.get('qsrc') : 'vocab';
      gLevel  = params.get('glv') || '';
      gUnit   = params.get('gun') || 'all';
      const packSel = document.getElementById('packSelect');
      const durEl   = document.getElementById('duration');
      const rewEl   = document.getElementById('questionReward');
      const feeEl   = document.getElementById('heistFee');
      if (packSel && packId) packSel.value = packId;
      if (durEl) durEl.value = dur;
      if (rewEl) rewEl.value = rew;
      if (feeEl) feeEl.value = fee;
      // Clean the URL so a browser refresh doesn't re-trigger an
      // auto-create. replaceState keeps the back stack intact so
      // browser-back still lands on classroom-teacher.html.
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
      // Show the "Setting up the heist…" placeholder — NOT the setup
      // form. createSession() will switch to lobby-waiting on success.
      setView('auto-creating');
      await createSession();
      // If createSession failed, sessionCode is still null. Drop the
      // teacher onto the setup form so they can retry manually
      // instead of being stuck on the placeholder.
      if (!sessionCode) setView('lobby-setup');
      return;
    }

    // Standalone path — no ?auto=1 and no active session in memory.
    // This means the teacher either hit a legacy bookmark or
    // refreshed the page mid-flight (which loses session state).
    // Rather than maintain a duplicate setup form that looks different
    // from the rest of Classroom Mode, redirect them back to the
    // unified picker. The inline form on classroom-teacher.html is
    // the ONLY way to launch a heist now.
    window.location.replace('classroom-teacher.html');
  });

  // ── Load hint packs once ───────────────────────────────────
  async function loadPacks() {
    try {
      const r = await fetch('classroom/data/heist-packs.json', { cache: 'no-store' });
      const j = await r.json();
      packs = j.packs || [];
      const sel = document.getElementById('packSelect');
      sel.innerHTML = packs.map(p =>
        `<option value="${escHtml(p.id)}">${escHtml(p.name)} (${p.words.length} words)</option>`
      ).join('');
    } catch (e) {
      console.error('pack load failed', e);
      toast('Could not load hint packs', 'fail');
    }
  }

  // ── Create session ─────────────────────────────────────────
  // EARN-question source for the session (set by the ?auto=1 URL params).
  let qSource = 'vocab';
  let gLevel  = '';
  let gUnit   = 'all';

  async function createSession() {
    const packId       = document.getElementById('packSelect').value;
    const durationMin  = parseInt(document.getElementById('duration').value, 10);
    const heistFee     = parseInt(document.getElementById('heistFee').value, 10);
    const questionRew  = parseInt(document.getElementById('questionReward').value, 10);

    activePack = packs.find(p => p.id === packId);
    if (!activePack) { toast('Pick a hint pack', 'fail'); return; }
    if (!(durationMin > 0)) { toast('Set a positive duration', 'fail'); return; }

    // Collision-check a few times before giving up.
    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('heist_sessions').doc(code).get();
      if (!exists.exists) break;
      code = generateCode();
    }

    const passwordChoices = activePack.words.map(w => w.word);

    const session = {
      code,
      status: 'lobby',                     // lobby → playing → finished
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      packId,
      packName: activePack.name,
      passwordChoices,
      heistFee,
      questionReward: questionRew,
      questionSource: qSource,             // 'vocab' (pack defs) or 'grammar'
      grammarLevel: gLevel,
      grammarUnit: gUnit,
      durationSec: durationMin * 60,
      heistRewardPct: 0.5,                 // attacker takes half
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null
    };

    try {
      await db.collection('heist_sessions').doc(code).set(session);
      sessionCode = code;
      enterLobby(code);
    } catch (e) {
      console.error('createSession', e);
      toast('Could not create the room: ' + e.message, 'fail');
    }
  }

  // ── Lobby (waiting for players + passwords) ────────────────
  function enterLobby(code) {
    setView('lobby-waiting');

    document.getElementById('roomCode').textContent = code;
    const url = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}classroom-heist-student.html?code=${encodeURIComponent(code)}`;
    const urlEl = document.getElementById('joinUrl');
    urlEl.textContent = url;
    urlEl.href = url;

    // QR code uses qrserver — same pattern as the existing classroom.
    // Students point their phone camera at the QR → opens the heist
    // join page with the code already filled in. Faster than typing
    // a 4-letter code 25 times across the classroom.
    const qrImg = document.getElementById('qrImg');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;
    }

    // Live player roster
    unsubPlayers = db.collection('heist_sessions').doc(code).collection('players')
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
      document.getElementById('startBtn').disabled = true;
      document.getElementById('startBtn').textContent = '▶️ Waiting for players…';
      return;
    }
    // Use the Vocab-Race `.player-card` markup so the heist lobby
    // looks identical to the vocab race lobby — same avatar circle,
    // same status pill underneath. We swap the status text out for
    // the heist-specific "Vault Set" / "Locking…" state.
    el.innerHTML = players.map(p => {
      const ready = !!p.passwordSet;
      const statusClass = ready ? 'finished' : 'ready';
      const statusText  = ready ? '🔒 Vault Set' : '⏳ Locking…';
      return `
        <div class="player-card">
          <div class="player-avatar">${escHtml(p.avatar || '🦊')}</div>
          <div class="player-name">${escHtml(p.name)}</div>
          <div class="player-status ${statusClass}">${statusText}</div>
        </div>`;
    }).join('');
    // Only allow start when everyone has set their password.
    const ready = players.filter(p => p.passwordSet).length;
    const everyoneReady = players.length > 0 && ready === players.length;
    const btn = document.getElementById('startBtn');
    btn.disabled = !everyoneReady;
    btn.textContent = everyoneReady
      ? `▶️ Start the Heist (${players.length} players)`
      : `▶️ Waiting for passwords (${ready}/${players.length})`;
  }

  // ── Start the game ─────────────────────────────────────────
  async function startGame() {
    if (!sessionCode) return;
    try {
      await db.collection('heist_sessions').doc(sessionCode).update({
        status: 'playing',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
    } catch (e) {
      console.error('startGame', e);
      toast('Could not start the game: ' + e.message, 'fail');
    }
  }

  // ── Live referee loop ──────────────────────────────────────
  function enterLive() {
    setView('live');

    // Mirror the room code + QR into the live header so late joiners
    // can still scan during the game. Build the join URL the same way
    // enterLobby() did. Also wire the click-to-enlarge overlay.
    const liveCode = document.getElementById('liveCode');
    if (liveCode) liveCode.textContent = sessionCode;
    const url = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}classroom-heist-student.html?code=${encodeURIComponent(sessionCode)}`;
    const qrSmall = document.getElementById('liveQrImg');
    const qrBig   = document.getElementById('liveQrBig');
    const qrSrcSm = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(url)}`;
    const qrSrcLg = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encodeURIComponent(url)}`;
    if (qrSmall) qrSmall.src = qrSrcSm;
    if (qrBig)   qrBig.src   = qrSrcLg;
    const liveQrCode = document.getElementById('liveQrCode');
    if (liveQrCode) liveQrCode.textContent = sessionCode;

    // Toggle overlay open / close. One-time wire-up per game.
    const toggleBtn = document.getElementById('liveQrToggle');
    const overlay   = document.getElementById('liveQrOverlay');
    if (toggleBtn && overlay && !toggleBtn.dataset.wired) {
      toggleBtn.dataset.wired = '1';
      toggleBtn.addEventListener('click', () => { overlay.style.display = 'flex'; });
      overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
    }

    // Subscribe to session for status changes (in case host hits End)
    unsubSession = db.collection('heist_sessions').doc(sessionCode)
      .onSnapshot(doc => {
        const d = doc.data();
        if (!d) return;
        if (d.status === 'finished') showResults();
        const startedAt = d.startedAt && d.startedAt.toMillis ? d.startedAt.toMillis() : null;
        if (startedAt && !timerInterval) startTimer(startedAt, d.durationSec);
      });

    // Subscribe to players for the live board
    unsubPlayers = db.collection('heist_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        renderLiveBoard(players);
      });

    // Subscribe to PENDING hacks — referee action queue
    unsubHacks = db.collection('heist_sessions').doc(sessionCode).collection('hacks')
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          resolveHack(ch.doc.id, ch.doc.data()).catch(err =>
            console.error('resolveHack', err)
          );
        });
      });
  }

  function startTimer(startedAtMs, durationSec) {
    const endMs = startedAtMs + durationSec * 1000;
    const el = document.getElementById('timer');
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
      el.classList.toggle('warn', remaining <= 60 && remaining > 15);
      el.classList.toggle('crit', remaining <= 15);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        endGame().catch(() => {});
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function renderLiveBoard(players) {
    const sorted = [...players].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const tbody = document.getElementById('liveBoard');
    tbody.innerHTML = sorted.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><span class="ava">${escHtml(p.avatar || '🦊')}</span>${escHtml(p.name)}</td>
        <td>💸 ${p.balance || 0}</td>
        <td>${p.questionsCorrect || 0} / ${p.questionsAnswered || 0}</td>
        <td>${p.hacksSuccessful || 0} / ${p.hacksAttempted || 0}</td>
        <td>${p.timesHacked || 0}</td>
      </tr>
    `).join('');
  }

  // ── Referee: resolve one pending hack ─────────────────────
  async function resolveHack(hackId, hack) {
    const sessionRef = db.collection('heist_sessions').doc(sessionCode);
    const hackRef = sessionRef.collection('hacks').doc(hackId);
    const pwRef = sessionRef.collection('passwords').doc(hack.targetUid);
    const attackerRef = sessionRef.collection('players').doc(hack.attackerUid);
    const targetRef   = sessionRef.collection('players').doc(hack.targetUid);

    try {
      const pwSnap = await pwRef.get();
      const correct = pwSnap.exists ? (pwSnap.data().word || '').toLowerCase() : '';
      const guess = (hack.guess || '').toLowerCase();
      const success = !!correct && guess === correct;

      // Capture the stolen amount OUTSIDE the transaction closure so
      // we can use it in the event log line below. The closure assigns
      // into this var on the success branch.
      let stolen = 0;

      await db.runTransaction(async tx => {
        const aSnap = await tx.get(attackerRef);
        const tSnap = await tx.get(targetRef);
        if (!aSnap.exists || !tSnap.exists) return;
        const a = aSnap.data();
        const t = tSnap.data();

        const fee = hack.feeBurned || 0;

        if (success) {
          // Take half of target's CURRENT balance — but READ it inside
          // the transaction (already done via tx.get(targetRef)) so
          // concurrent successful hacks against the same target serialize.
          // Without this, two attackers cracking the same target in the
          // same tick would each see the FULL balance, both transfer
          // half, and the target would end at -50%.
          //
          // Belt-and-braces: also Math.max(0, …) so we can never push
          // a balance negative if some legacy race already produced
          // a negative starting state.
          const tBal = Math.max(0, t.balance || 0);
          stolen = Math.floor(tBal * 0.5);
          tx.update(attackerRef, {
            balance: (a.balance || 0) + stolen,
            hacksSuccessful: (a.hacksSuccessful || 0) + 1,
            hacksAttempted:  (a.hacksAttempted  || 0) + 1,
            stolenTotal:     (a.stolenTotal     || 0) + stolen
          });
          tx.update(targetRef, {
            balance: tBal - stolen,
            timesHacked: (t.timesHacked || 0) + 1
          });
        } else {
          // Burn the fee (already deducted from attacker on the client
          // side as an optimistic deduction — we just confirm here. We
          // do NOT deduct again, otherwise the fee gets charged twice.)
          tx.update(attackerRef, {
            hacksAttempted: (a.hacksAttempted || 0) + 1
          });
        }

        tx.update(hackRef, {
          status: 'resolved',
          success,
          amountStolen: stolen,
          feeBurned: fee,
          resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      addEvent(
        `${hack.attackerName} ${success ? 'cracked' : 'failed to crack'} ${hack.targetName}'s vault` +
          (success ? ` and stole 💸${stolen}` : ''),
        success ? 'success' : 'fail'
      );

      // ── Vault rotation after a successful crack ──
      // Without this, the attacker (or anyone who saw the now-known
      // hint+word pair) could spam the same vault indefinitely with
      // a 100% crack rate. Pick a new random word from the pack +
      // its matching tabooHint, then quietly update both the
      // password doc and the player's `vaultHint`. The next attacker
      // sees the new hint and has to start the crack from scratch.
      // Skipped if the pack only has one word (degenerate config).
      if (success && activePack && Array.isArray(activePack.words) && activePack.words.length > 1) {
        try {
          const currentLower = correct;
          const candidates = activePack.words.filter(w =>
            (w.word || '').toLowerCase() !== currentLower
          );
          if (candidates.length > 0) {
            const next = candidates[Math.floor(Math.random() * candidates.length)];
            // Two separate writes — `passwords/{uid}` is private (only
            // owner + host can read), `players/{uid}.vaultHint` is the
            // public hint everyone trying to hack reads. Both must
            // update together so the new hint actually corresponds to
            // the new password.
            await pwRef.set({ word: next.word });
            await targetRef.update({ vaultHint: next.tabooHint || '' });
            addEvent(
              `🔄 ${hack.targetName}'s vault rotated — new password + new hint`,
              'info'
            );
          }
        } catch (e) {
          // Non-fatal — the hack itself already resolved. Worst case
          // the vault keeps the old password until the next host
          // restart; better than crashing the resolver loop.
          console.warn('vault rotation failed (non-fatal):', e);
        }
      }
    } catch (e) {
      console.error('referee error', e);
    }
  }

  function addEvent(text, kind) {
    const log = document.getElementById('eventLog');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'event ' + (kind || '');
    div.textContent = text;
    log.prepend(div);
    // Keep last 30 entries
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  // ── End the game ───────────────────────────────────────────
  async function endGame() {
    if (!sessionCode) return;
    try {
      await db.collection('heist_sessions').doc(sessionCode).update({
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('endGame', e);
    }
  }

  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameInFlight = false;  // game is over → back-links no longer prompt
    setView('results');
    try {
      const sref = db.collection('heist_sessions').doc(sessionCode);
      // Pull players + the full hack log in parallel.
      const [playersSnap, hacksSnap] = await Promise.all([
        sref.collection('players').orderBy('balance', 'desc').get(),
        sref.collection('hacks').where('status', '==', 'resolved').get()
      ]);
      const players = playersSnap.docs.map(d => d.data());
      const hacks   = hacksSnap.docs.map(d => d.data())
        .sort((a, b) => {
          const ta = a.resolvedAt && a.resolvedAt.toMillis ? a.resolvedAt.toMillis() : 0;
          const tb = b.resolvedAt && b.resolvedAt.toMillis ? b.resolvedAt.toMillis() : 0;
          return ta - tb;
        });

      renderPodium(players);
      renderPerPlayer(players);
      renderHackLog(hacks);
      wireCsvDownload(players);
    } catch (e) {
      console.error('showResults', e);
    }
    cleanupListeners();
  }

  function renderPodium(players) {
    const podium = document.getElementById('podium');
    const ranks = ['first', 'second', 'third'];
    const order = [1, 0, 2]; // visual: 2nd-1st-3rd
    podium.innerHTML = order.map(i => {
      const p = players[i];
      if (!p) return '<div class="pod"></div>';
      return `
        <div class="pod ${ranks[i]}">
          <div class="rank">#${i + 1}</div>
          <div style="font-size:1.6em;">${escHtml(p.avatar || '🦊')}</div>
          <div style="font-weight:700; margin-top:4px;">${escHtml(p.name)}</div>
          <div style="color:var(--heist-gold-2); font-weight:800; margin-top:6px;">💸 ${p.balance || 0}</div>
        </div>`;
    }).join('');
  }

  function renderPerPlayer(players) {
    const body = document.getElementById('perPlayerBody');
    body.innerHTML = players.map((p, i) => {
      const answered  = p.questionsAnswered || 0;
      const correct   = p.questionsCorrect  || 0;
      const acc       = answered ? Math.round((correct / answered) * 100) : 0;
      const reward    = (session && session.questionReward) || 0;
      const earned    = correct * reward;
      const stolen    = p.stolenTotal       || 0;
      const hAtt      = p.hacksAttempted    || 0;
      const hOk       = p.hacksSuccessful   || 0;
      const hacked    = p.timesHacked       || 0;
      // Subtle tier coloring on the row's #-cell for the top 3 so the
      // eye can scan to the podium positions in the breakdown too.
      const tierColor = i === 0 ? 'var(--heist-gold-2)'
                      : i === 1 ? 'var(--heist-text)'
                      : i === 2 ? 'rgba(180,83,9,0.9)'
                      : 'var(--heist-text-mut)';
      return `
        <tr style="border-bottom: 1px solid var(--heist-border);">
          <td style="padding:8px 10px; font-weight:800; color:${tierColor};">#${i + 1}</td>
          <td style="padding:8px 10px;">
            <span style="display:inline-flex; align-items:center; justify-content:center;
                         width:24px; height:24px; border-radius:50%;
                         background: linear-gradient(135deg, var(--heist-cyan), var(--heist-violet));
                         font-size:12px; margin-right:8px; vertical-align:middle;">
              ${escHtml(p.avatar || '🦊')}
            </span>${escHtml(p.name)}
          </td>
          <td style="padding:8px 10px; color:var(--heist-gold-2); font-weight:700;">💸 ${p.balance || 0}</td>
          <td style="padding:8px 10px;">💸 ${earned}</td>
          <td style="padding:8px 10px; color:${stolen > 0 ? 'var(--heist-green)' : 'var(--heist-text-mut)'};">
            ${stolen > 0 ? '+💸 ' + stolen : '—'}
          </td>
          <td style="padding:8px 10px;">${correct} / ${answered}</td>
          <td style="padding:8px 10px;">${answered ? acc + '%' : '—'}</td>
          <td style="padding:8px 10px;">${hOk} / ${hAtt}</td>
          <td style="padding:8px 10px; color:${hacked > 0 ? 'var(--heist-red)' : 'var(--heist-text-mut)'};">
            ${hacked > 0 ? hacked : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderHackLog(hacks) {
    const log = document.getElementById('hackLog');
    const count = document.getElementById('hackLogCount');
    if (count) count.textContent = hacks.length
      ? `(${hacks.length} attempts, ${hacks.filter(h => h.success).length} successful)`
      : '';
    if (!hacks.length) return; // keeps the placeholder
    log.innerHTML = hacks.map(h => {
      const t = h.resolvedAt && h.resolvedAt.toDate
        ? h.resolvedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      const icon = h.success ? '✅' : '❌';
      const color = h.success ? 'var(--heist-green)' : 'var(--heist-red)';
      const verdict = h.success
        ? `cracked <strong>${escHtml(h.targetName)}</strong> and stole <strong>💸${h.amountStolen || 0}</strong>`
        : `failed to crack <strong>${escHtml(h.targetName)}</strong> (guessed "<em>${escHtml(h.guess || '')}</em>", lost 💸${h.feeBurned || 0})`;
      return `
        <div style="padding: 8px 10px; border-bottom: 1px dashed var(--heist-border);
                    display:flex; align-items:baseline; gap:8px; font-size: 0.92em;">
          <span style="color:${color}; font-size:1.1em;">${icon}</span>
          <span style="color: var(--heist-text-mut); font-family: JetBrains Mono;
                       font-size: 0.85em; min-width: 70px;">${t}</span>
          <span><strong>${escHtml(h.attackerName)}</strong> ${verdict}</span>
        </div>`;
    }).join('');
  }

  function wireCsvDownload(players) {
    const btn = document.getElementById('downloadResultsBtn');
    if (!btn) return;
    btn.onclick = () => {
      const reward = (session && session.questionReward) || 0;
      const rows = [
        ['Rank','Name','Avatar','Coins','Earned (questions)','Stolen (hacks)',
         'Questions Correct','Questions Answered','Accuracy %',
         'Hacks Successful','Hacks Attempted','Times Hacked']
      ];
      players.forEach((p, i) => {
        const answered = p.questionsAnswered || 0;
        const correct  = p.questionsCorrect  || 0;
        const acc = answered ? Math.round((correct / answered) * 100) : 0;
        rows.push([
          i + 1, p.name || '', p.avatar || '',
          p.balance || 0, correct * reward, p.stolenTotal || 0,
          correct, answered, acc,
          p.hacksSuccessful || 0, p.hacksAttempted || 0, p.timesHacked || 0
        ]);
      });
      const csv = rows.map(r => r.map(cell => {
        const s = String(cell == null ? '' : cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `heist-${sessionCode}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  function cleanupListeners() {
    if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
    if (unsubHacks)   { unsubHacks();   unsubHacks   = null; }
    if (unsubSession) { unsubSession(); unsubSession = null; }
  }

  // ── Themed confirm modal — replaces window.confirm() ──────
  // The browser dialog jars against the dark cyber-bank aesthetic.
  // This wires up #heistConfirm in the HTML with a Promise-based API
  // so the existing call sites read like `if (await ask(...)) {}`.
  function ask(title, msg, okLabel) {
    return new Promise(resolve => {
      const bg     = document.getElementById('heistConfirm');
      const titleEl= document.getElementById('heistConfirmTitle');
      const msgEl  = document.getElementById('heistConfirmMsg');
      const okBtn  = document.getElementById('heistConfirmOk');
      const cnBtn  = document.getElementById('heistConfirmCancel');
      if (!bg) return resolve(window.confirm(msg));  // graceful fallback
      titleEl.textContent = title || 'Are you sure?';
      msgEl.textContent   = msg   || '';
      okBtn.textContent   = okLabel || 'Confirm';
      bg.style.display = 'flex';
      const cleanup = (val) => {
        bg.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cnBtn.removeEventListener('click', onCancel);
        bg.removeEventListener('click', onBgClick);
        resolve(val);
      };
      const onOk     = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBgClick= (e) => { if (e.target === bg) cleanup(false); };
      okBtn.addEventListener('click', onOk);
      cnBtn.addEventListener('click', onCancel);
      bg.addEventListener('click', onBgClick);
    });
  }

  // ── Wire DOM ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Music init — match the Vocab Race classroom behaviour:
    // moderate default volume, no loop (advance to next random track).
    const audio = document.getElementById('bgMusic');
    if (audio) {
      audio.volume = 0.3;
      audio.loop = false;
      audio.addEventListener('ended', () => { if (musicPlaying) playRandomTrack(); });
    }

    document.getElementById('createBtn').addEventListener('click', createSession);
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await ask(
        'End the heist?',
        'All players will be moved to the results screen. This cannot be undone.',
        'End game'
      );
      if (ok) endGame();
    });
    // "Run another round" used to reload the heist page, which dumped
    // the teacher onto the now-deleted standalone setup view. Send
    // them back to the unified Classroom Mode picker instead — one
    // click to land on the Heist card again with their previous pack
    // / settings remembered by the browser.
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });

    // Back-link confirmations. If a game is live (gameInFlight), the
    // teacher might be one mis-click away from killing the whole class.
    // Wrap the breadcrumb + dashboard anchors so they ask first.
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      ask(
        'Leave the heist?',
        `A game is in progress. Leaving to ${label} will leave students in the lobby — the game will keep running on Firestore, but you won't be refereeing hack attempts from this tab. End the game first?`,
        'Leave anyway'
      ).then(ok => { if (ok) window.location.href = href; });
    }
    const b1 = document.getElementById('backToClassroom');
    const b2 = document.getElementById('backToDashboard');
    if (b1) b1.addEventListener('click', (e) => confirmLeave(e, 'Classroom Mode'));
    if (b2) b2.addEventListener('click', (e) => confirmLeave(e, 'the dashboard'));
  });

  // beforeunload guard — the *browser's* close/back button. Modern
  // browsers ignore custom strings (they show their own generic
  // "Leave site?" prompt), but setting returnValue is what triggers
  // the dialog. We only enable it during a live game so the teacher
  // doesn't get nagged on the setup/lobby screens.
  window.addEventListener('beforeunload', (e) => {
    cleanupListeners();
    if (gameInFlight) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
