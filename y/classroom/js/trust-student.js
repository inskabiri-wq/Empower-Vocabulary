/* ============================================================
   TRUST NO ONE — Student client — Phase 1
   ----------------------------------------------------------------
   Flow:
     1. Land on page, optionally with ?code=XXXX prefilled.
     2. Type code + name → join.
     3. Wait in airlock for the teacher to launch.
     4. When session goes to 'liftoff' → show private role reveal
        (Crewmate or Impostor + co-impostors list if impostor).
     5. When session goes to 'playing' → vocab MCQ stream.
        Each correct answer: +N coins, +1 investigationsCompleted.
     6. When session goes to 'finished' → show personal final
        standing.

   Future phases (no UI here yet):
     • Clue cards drop in the play view (Phase 2)
     • Sabotage button (impostors only, Phase 2)
     • Meeting screen + voting (Phase 3)
     • Ghost mode UI when alive=false (Phase 4)
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

  // ── Music (same as host) ──────────────────────────────────
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
  let user         = null;
  let myUid        = null;
  let myName       = '';
  let myAvatar     = '🚀';
  let sessionCode  = null;
  let session      = null;
  let packData     = null;
  let myPlayer     = null;
  let allPlayers   = [];
  let questionQueue = [];
  let questionIndex = 0;
  let unsubs       = [];

  const AVATARS = ['🚀','🛰️','👽','🌙','⭐','💫','🪐','🌌','🌠','👾','🛸','🌟','✨','🌑','☄️'];
  function randomAvatar() { return AVATARS[Math.floor(Math.random() * AVATARS.length)]; }

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function setView(id) {
    ['join','waiting','liftoff','play','meeting','eject','ghost','done'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'trust-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Auth: anonymous ────────────────────────────────────────
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

  // ── Join flow ──────────────────────────────────────────────
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

    const sref = db.collection('trust_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { toast('Room not found', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { toast('That mission has ended', 'fail'); return; }

    // Pull pack for the question stream.
    try {
      const r = await fetch('classroom/data/heist-packs.json', { cache: 'no-store' });
      const j = await r.json();
      packData = (j.packs || []).find(p => p.id === session.packId);
      if (!packData) { toast('Question pack missing — refresh and try again', 'fail'); return; }
    } catch (e) {
      console.error('pack load', e);
      toast('Could not load the question pack', 'fail');
      return;
    }

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid,
        name: myName,
        avatar: myAvatar,
        role: null,             // assigned at liftoff
        alive: true,
        balance: 0,
        investigationsCompleted: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        sabotageCharges: 0,
        falseClueCharges: 0,
        meetingButtons: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('join', e);
      toast('Could not join: ' + e.message, 'fail');
      return;
    }

    subscribeSession();
    subscribePlayer();
    subscribePlayers();
    setView('waiting');
  }

  // ── Phase 3 state ──────────────────────────────────────────
  let activeMeetingId   = null;
  let unsubMeeting      = null;
  let unsubMeetingVotes = null;
  let meetingTimerInt   = null;
  let myVoteTarget      = null;       // 'skip' | uid of who I voted for | null
  let lastSeenMeetingId = null;       // so we don't re-open the same meeting

  // ── Phase 2: clue feed subscription + render ──────────────
  let unsubClues = null;
  let cluesCache = [];
  function subscribeClues() {
    if (unsubClues) return;
    unsubClues = db.collection('trust_sessions').doc(sessionCode).collection('clues')
      .orderBy('createdAt', 'desc').limit(40)
      .onSnapshot(snap => {
        cluesCache = snap.docs.map(d => d.data());
        renderClueFeed();
        // Phase 4: keep the ghost's feed live too — same data,
        // separate node; the function no-ops if the ghost view's
        // not in the DOM yet.
        renderGhostClueFeed();
      });
    unsubs.push(() => { if (unsubClues) { unsubClues(); unsubClues = null; } });
  }
  function renderClueFeed() {
    const el = document.getElementById('clueFeed');
    if (!el) return;
    if (!cluesCache.length) return;
    // Students don't see truth tags — that's the whole social-deduction
    // game. They just see the clue + time.
    el.innerHTML = cluesCache.map(c => {
      const t = c.createdAt && c.createdAt.toDate
        ? c.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      return `
        <div style="padding:7px 8px; border-bottom:1px dashed var(--t-border);
                    font-size:0.88em; display:flex; gap:8px; align-items:flex-start;">
          <span style="color:var(--t-text-mut); font-family:JetBrains Mono;
                       font-size:0.78em; min-width:46px;">${t}</span>
          <span style="flex:1; line-height:1.4;">${escHtml(c.text || '')}</span>
        </div>`;
    }).join('');
  }

  // ── Phase 2: sabotage + false-clue actions ────────────────
  async function doSabotage(targetUid, targetName) {
    if (!myPlayer || myPlayer.role !== 'impostor') return;
    if ((myPlayer.sabotageCharges || 0) <= 0) {
      toast('No sabotage charges left', 'fail'); return;
    }
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      // Optimistic charge decrement so the UI feels responsive. Host
      // doesn't validate this in Phase 2 (classroom-supervised).
      await sref.collection('players').doc(myUid).update({
        sabotageCharges: firebase.firestore.FieldValue.increment(-1)
      });
      // Write the pending sabotage; host resolves it.
      await sref.collection('sabotages').add({
        attackerUid: myUid,
        attackerName: myName,
        targetUid,
        targetName,
        effect: 'coin_penalty',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast(`💥 Sabotage filed against ${targetName}`, 'success');
    } catch (e) {
      console.error('sabotage', e);
      toast('Could not sabotage: ' + e.message, 'fail');
    }
  }
  async function plantClue(targetUid, targetName) {
    if (!myPlayer || myPlayer.role !== 'impostor') return;
    if ((myPlayer.falseClueCharges || 0) <= 0) {
      toast('No fake-clue charges left', 'fail'); return;
    }
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      await sref.collection('players').doc(myUid).update({
        falseClueCharges: firebase.firestore.FieldValue.increment(-1)
      });
      // Use a "suspicious behaviour" template so the false clue
      // actually has tactical value (frames an innocent crewmate).
      const templates = [
        `📉 ${targetName} keeps getting wrong answers.`,
        `👀 ${targetName} hasn't been spotted contributing recently.`,
        `⚠️ ${targetName} has been acting suspiciously.`,
        `⚡ ${targetName} is answering suspiciously fast.`
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      await sref.collection('clues').add({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',                 // rules require pending on create
        targetUid,
        targetName,
        text,
        kind: 'planted_suspicion',
        isTrue: false,
        injected: true,
        attackerUid: myUid
      });
      toast(`📝 Fake clue planted against ${targetName}`, 'success');
    } catch (e) {
      console.error('plantClue', e);
      toast('Could not plant clue: ' + e.message, 'fail');
    }
  }

  // ── Subscriptions ──────────────────────────────────────────
  function subscribeSession() {
    const sref = db.collection('trust_sessions').doc(sessionCode);
    const u = sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      const prevStatus = session && session.status;
      session = d;
      // Drive view changes off the session status.
      if (d.status === 'liftoff' && myPlayer && myPlayer.role) {
        showLiftoffIfPending();
      } else if (d.status === 'playing') {
        // Coming back from a meeting → return to play view + clear
        // any meeting state. If we just got ejected, the player-doc
        // subscription handles the ghost transition.
        if (prevStatus === 'meeting' || prevStatus === 'liftoff') {
          if (myPlayer && myPlayer.alive === false) {
            setView('ghost');
            renderGhostView();
          } else {
            enterPlay();
          }
        } else {
          enterPlay();
        }
        // Refresh the emergency button (cooldown might be active).
        refreshEmergencyBtn();
      } else if (d.status === 'meeting' && d.activeMeetingId) {
        // Don't re-open the same meeting if we just resolved it.
        if (d.activeMeetingId !== lastSeenMeetingId) {
          lastSeenMeetingId = d.activeMeetingId;
          openStudentMeetingView(d.activeMeetingId);
        }
      } else if (d.status === 'finished') {
        enterDone();
      }
    });
    unsubs.push(u);
  }
  function subscribePlayer() {
    const ref = db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid);
    const u = ref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      const prevAlive = myPlayer ? myPlayer.alive : true;
      myPlayer = d;
      updateStatusStrip();
      // Phase 2: keep the impostor-tools panel fresh as charges burn.
      refreshImpostorTools();
      // Phase 3: keep the emergency-meeting button state fresh.
      refreshEmergencyBtn();
      // Phase 4: ghost coin chip stays live (covers donations crediting
      // teammates AND own ghost-mode earnings).
      updateGhostCoins();
      // Phase 3: alive → false transition routes us to the ghost view
      // (unless we're currently in the meeting / eject reveal — those
      // own their own exit). The session-status handler picks us back
      // up when the meeting resolves and status flips to 'playing'.
      if (prevAlive !== false && d.alive === false) {
        const inMeeting = document.getElementById('view-meeting') &&
                          document.getElementById('view-meeting').style.display !== 'none';
        const inEject   = document.getElementById('view-eject') &&
                          document.getElementById('view-eject').style.display !== 'none';
        if (!inMeeting && !inEject) {
          setView('ghost');
          renderGhostView();
        }
      }
      // If role just got assigned and we're in waiting/liftoff, show briefing.
      if (session && session.status === 'liftoff' && d.role) {
        showLiftoffIfPending();
      }
    });
    unsubs.push(u);
  }
  function subscribePlayers() {
    const ref = db.collection('trust_sessions').doc(sessionCode).collection('players')
      .orderBy('joinedAt', 'asc');
    const u = ref.onSnapshot(snap => {
      allPlayers = snap.docs.map(d => d.data());
      renderRoster();
    });
    unsubs.push(u);
  }

  function updateStatusStrip() {
    const strip = document.getElementById('myStatusStrip');
    if (!strip || !myPlayer) return;
    if (!myPlayer.role) { strip.style.display = 'none'; return; }
    const role = myPlayer.role;
    strip.style.display = '';
    strip.innerHTML = `
      <span class="trust-chip ${role}">
        ${role === 'impostor' ? '🎭 Impostor' : '🛰️ Crewmate'}
      </span>
      <span class="trust-chip coins">💸 ${myPlayer.balance || 0}</span>
      <span class="trust-chip">🔬 ${myPlayer.investigationsCompleted || 0}</span>
    `;
  }

  // ── Liftoff briefing ───────────────────────────────────────
  let liftoffShown = false;
  function showLiftoffIfPending() {
    if (liftoffShown) return;
    if (!myPlayer || !myPlayer.role) return;
    liftoffShown = true;
    setView('liftoff');

    const role = myPlayer.role;
    const card = document.getElementById('liftoffRole');
    card.className = 'role-card ' + role;
    card.querySelector('.role-emoji').textContent = role === 'impostor' ? '🎭' : '🛰️';
    card.querySelector('.role-name').textContent  = role === 'impostor' ? 'Impostor' : 'Crewmate';

    const brief = document.getElementById('liftoffBrief');
    brief.textContent = role === 'impostor'
      ? 'Blend in. Answer questions like everyone else but sabotage when the time is right. Lie at meetings. Survive the votes — and don\'t let them outnumber you.'
      : 'Run investigations by answering vocab questions. Use clues and meetings to spot the impostors and vote them out before they outnumber the crew.';

    // Impostors see their fellow impostors.
    if (role === 'impostor') {
      const buddies = allPlayers.filter(p => p.role === 'impostor' && p.uid !== myUid);
      const bd = document.getElementById('impostorBuddies');
      if (buddies.length) {
        bd.innerHTML = 'Your fellow impostors: <strong>' +
          buddies.map(b => escHtml(b.avatar || '🎭') + ' ' + escHtml(b.name)).join(', ') +
          '</strong>';
        bd.style.display = '';
      } else {
        bd.innerHTML = '<strong>You\'re the only impostor.</strong> No backup — choose your sabotages well.';
        bd.style.display = '';
      }
    }
  }

  // ── Play phase ─────────────────────────────────────────────
  let playEntered = false;
  function enterPlay() {
    if (playEntered) return;
    playEntered = true;
    setView('play');

    // Build a shuffled question queue from the teacher's chosen source:
    // vocab (pack), grammar (bank), or mixed (both together). Grammar falls
    // back to the pack if the bank is missing, so the game can never stall.
    questionQueue = buildSourceQueue();
    questionIndex = 0;
    nextQuestion();

    // Phase 2: subscribe to the shared clue feed.
    subscribeClues();
    // If we're an impostor, reveal the tools panel.
    refreshImpostorTools();
    // Phase 3: surface the emergency-meeting button.
    refreshEmergencyBtn();
  }

  // Show / hide the impostor-tools panel based on role + role state.
  // Re-rendered every time the player doc updates so the charge counts
  // stay live.
  function refreshImpostorTools() {
    const panel = document.getElementById('impostorTools');
    if (!panel) return;
    if (!myPlayer || myPlayer.role !== 'impostor' || myPlayer.alive === false) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    const sabEl  = document.getElementById('sabCharges');
    const fakeEl = document.getElementById('fakeCharges');
    if (sabEl)  sabEl.textContent  = (myPlayer.sabotageCharges  || 0);
    if (fakeEl) fakeEl.textContent = (myPlayer.falseClueCharges || 0);

    const plantBtn = document.getElementById('plantClueBtn');
    if (plantBtn) {
      plantBtn.disabled = (myPlayer.falseClueCharges || 0) <= 0;
      plantBtn.style.opacity = plantBtn.disabled ? '0.5' : '1';
    }
  }
  // Grammar question queue — pulled from the generated grammar bank
  // (grammar-content.js is loaded on the trust student page). Each item
  // carries its own 4 options, so no pack distractors are needed.
  function buildGrammarQueue() {
    const GP = window.GRAMMAR_PRACTICE;
    const topics = (GP && GP.byLevel && GP.byLevel[session.grammarLevel]) || [];
    const unitOf = t => { const m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; };
    let list = topics;
    if (session.grammarUnit && session.grammarUnit !== 'all') {
      list = topics.filter(t => unitOf(t) === parseInt(session.grammarUnit, 10));
    }
    const out = [];
    list.forEach(t => (t.questions || []).forEach(q => out.push({
      gq: true, stem: q.stem, options: q.options, answer: q.answer
    })));
    return shuffleInPlace(out);
  }
  // Shared renderer for one question item (vocab pack word OR grammar item).
  function renderQuestionItem(item, stemEl, optBoxEl, onPick) {
    let opts;
    if (item.gq) {
      stemEl.innerHTML = escHtml(item.stem).replace(/_{2,}/,
        '<span style="display:inline-block;min-width:56px;border-bottom:3px solid var(--t-cyan-2,#22d3ee);vertical-align:bottom;"></span>');
      opts = shuffleInPlace(item.options.map((t, i) => ({ def: t, isCorrect: i === item.answer })));
    } else {
      const others = packData.words.filter(w => w.word !== item.word);
      shuffleInPlace(others);
      const distractors = others.slice(0, 3).map(w => w.def);
      opts = shuffleInPlace([item.def, ...distractors]).map(def => ({
        def, isCorrect: def === item.def
      }));
      stemEl.innerHTML = `What does <strong style="color:var(--t-cyan-2);">${escHtml(item.word)}</strong> mean?`;
    }
    optBoxEl.innerHTML = opts.map((o) => `
      <button type="button" class="trust-q-opt" data-correct="${o.isCorrect ? '1' : '0'}">
        ${escHtml(o.def)}
      </button>`).join('');
    optBoxEl.querySelectorAll('.trust-q-opt').forEach(btn => {
      btn.addEventListener('click', () => onPick(btn, item));
    });
  }
  // The right answer's display text, for the "Correct: ..." feedback.
  function correctTextOf(item) { return item.gq ? item.options[item.answer] : item.def; }
  // One shuffled queue honouring the session's question source
  // (vocab / grammar / mixed), with a pack fallback.
  function buildSourceQueue() {
    const src = (session && session.questionSource) || 'vocab';
    let queue = [];
    if (src === 'grammar' || src === 'mixed') {
      queue = buildGrammarQueue();
      // Mixed: cap the grammar share to the pack size so the blend is
      // roughly half vocabulary, half grammar (not 900 vs 20).
      if (src === 'mixed') queue = queue.slice(0, Math.max(packData.words.length, 20));
    }
    if (src !== 'grammar' || !queue.length) queue = queue.concat(packData.words);
    return shuffleInPlace(queue);
  }

  function nextQuestion() {
    if (!questionQueue.length) return;
    if (questionIndex >= questionQueue.length) {
      shuffleInPlace(questionQueue);
      questionIndex = 0;
    }
    const item = questionQueue[questionIndex++];
    renderQuestionItem(item, document.getElementById('qStem'), document.getElementById('qOpts'), onAnswer);
    document.getElementById('qFeedback').innerHTML = '';
    document.getElementById('qFeedback').className = 'trust-q-feedback';
  }
  async function onAnswer(btn, item) {
    document.querySelectorAll('#qOpts .trust-q-opt').forEach(b => b.disabled = true);
    const isRight = btn.dataset.correct === '1';
    btn.classList.add(isRight ? 'correct' : 'wrong');
    const fb = document.getElementById('qFeedback');
    const reward = (session && session.questionReward) || 10;
    if (isRight) {
      fb.className = 'trust-q-feedback ok';
      fb.textContent = `+ 💸${reward} · investigation logged`;
      try {
        await db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          balance: firebase.firestore.FieldValue.increment(reward),
          investigationsCompleted: firebase.firestore.FieldValue.increment(1),
          questionsAnswered: firebase.firestore.FieldValue.increment(1),
          questionsCorrect: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('balance', e); }
    } else {
      fb.className = 'trust-q-feedback no';
      fb.textContent = `Correct: ${correctTextOf(item)}`;
      try {
        await db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          questionsAnswered: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('balance', e); }
    }
    setTimeout(nextQuestion, 1200);
  }

  // ── Roster (live view, right side of play) ─────────────────
  function renderRoster() {
    const el = document.getElementById('rosterList');
    if (!el) return;
    const iAmImpostor = !!(myPlayer && myPlayer.role === 'impostor' && myPlayer.alive !== false);
    const haveSabCharges = iAmImpostor && (myPlayer.sabotageCharges || 0) > 0;
    el.innerHTML = allPlayers
      .filter(p => p.alive !== false)
      .map(p => {
        const isMe = p.uid === myUid;
        // Sabotage button — only visible to impostors, only on
        // crewmates (no friendly fire), only when we have charges.
        // The host's resolveSabotage applies the effect; we just
        // file the request.
        const sabBtn = (haveSabCharges && !isMe && p.role !== 'impostor')
          ? `<button type="button" class="trust-sab-btn"
                     data-uid="${escHtml(p.uid)}" data-name="${escHtml(p.name)}"
                     style="background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.4);
                            color: #fca5a5; border-radius: 6px; padding: 2px 6px;
                            font-size: 0.78em; font-family: inherit; cursor: pointer;
                            margin-left: 6px;">💥</button>`
          : '';
        // Impostors can see who their fellow impostors are (already
        // shown in liftoff); add a quiet 🎭 badge in the roster too.
        const impFlag = (iAmImpostor && p.role === 'impostor' && !isMe)
          ? '<span style="color: var(--t-amber-2); margin-left: 4px;" title="Fellow impostor">🎭</span>'
          : '';
        return `
          <div class="trust-roster-item">
            <div class="ava">${escHtml(p.avatar || '🚀')}</div>
            <div class="name">${escHtml(p.name)}${impFlag}${isMe ? ' <span style="color:var(--t-text-mut);">(you)</span>' : ''}</div>
            <div class="meta">🔬 ${p.investigationsCompleted || 0}${sabBtn}</div>
          </div>`;
      }).join('');
    // Wire up the sabotage buttons we just rendered.
    el.querySelectorAll('.trust-sab-btn').forEach(btn => {
      btn.addEventListener('click', () => openSabotageModal(btn.dataset.uid, btn.dataset.name));
    });
  }

  // ── Phase 2 modals ─────────────────────────────────────────
  function openSabotageModal(targetUid, targetName) {
    const bg = document.getElementById('sabotageModal');
    if (!bg) return;
    document.getElementById('sabTargetName').textContent = targetName;
    bg.classList.add('active');
    bg.style.display = '';
    const ok = document.getElementById('sabConfirm');
    const cn = document.getElementById('sabCancel');
    const close = () => {
      bg.classList.remove('active');
      bg.style.display = 'none';
      ok.removeEventListener('click', onOk);
      cn.removeEventListener('click', onCn);
    };
    const onOk = () => { close(); doSabotage(targetUid, targetName); };
    const onCn = () => close();
    ok.addEventListener('click', onOk);
    cn.addEventListener('click', onCn);
  }

  function openPlantClueModal() {
    if (!myPlayer || myPlayer.role !== 'impostor') return;
    if ((myPlayer.falseClueCharges || 0) <= 0) {
      toast('No fake-clue charges left', 'fail'); return;
    }
    const bg = document.getElementById('plantClueModal');
    if (!bg) return;
    const targetList = document.getElementById('plantClueTargets');
    // Only show CREWMATES as targets — framing a fellow impostor is
    // strategically counterproductive AND would out yourself.
    const targets = allPlayers.filter(p => p.alive !== false && p.role !== 'impostor' && p.uid !== myUid);
    if (!targets.length) {
      toast('No valid targets', 'fail'); return;
    }
    targetList.innerHTML = targets.map(p => `
      <button type="button" class="trust-btn" data-uid="${escHtml(p.uid)}" data-name="${escHtml(p.name)}"
              style="justify-content:flex-start; gap:10px;">
        <span style="font-size:1.2em;">${escHtml(p.avatar || '🚀')}</span>
        <span>${escHtml(p.name)}</span>
      </button>`).join('');
    bg.classList.add('active');
    bg.style.display = '';

    const close = () => {
      bg.classList.remove('active');
      bg.style.display = 'none';
      targetList.querySelectorAll('button').forEach(b => b.removeEventListener('click', onPick));
      document.getElementById('plantClueCancel').removeEventListener('click', onCn);
    };
    const onPick = (e) => {
      const btn = e.currentTarget;
      close();
      plantClue(btn.dataset.uid, btn.dataset.name);
    };
    const onCn = () => close();
    targetList.querySelectorAll('button').forEach(b => b.addEventListener('click', onPick));
    document.getElementById('plantClueCancel').addEventListener('click', onCn);
  }

  // ── Phase 3: emergency-meeting trigger from student side ──
  // Student creates the /meetings doc with status: 'open' — the
  // host's tab is listening for this and flips session.status to
  // 'meeting' (rules restrict session updates to the host).
  async function callEmergencyMeeting() {
    if (!myPlayer || myPlayer.alive === false) return;
    if ((myPlayer.meetingButtons || 0) <= 0) {
      toast('No emergency-meeting buttons left', 'fail'); return;
    }
    const cdMs = session && session.meetingCooldownUntil && session.meetingCooldownUntil.toMillis
      ? session.meetingCooldownUntil.toMillis() : 0;
    if (Date.now() < cdMs) {
      toast('Meeting cooldown active', 'fail'); return;
    }
    try {
      const sref = db.collection('trust_sessions').doc(sessionCode);
      await sref.collection('meetings').add({
        calledBy: myUid,
        calledByName: myName,
        reason: '',
        duration: 60,
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'open'
      });
      // Optimistically decrement my meeting-button count.
      await sref.collection('players').doc(myUid).update({
        meetingButtons: firebase.firestore.FieldValue.increment(-1)
      });
      toast('🚨 Meeting called!', 'success');
    } catch (e) {
      console.error('emergency', e);
      toast('Could not call meeting: ' + e.message, 'fail');
    }
  }

  // Update the emergency button's label / disabled state based on
  // remaining buttons + cooldown. Called from refreshImpostorTools
  // (mis-named, but it's the place we refresh per-player UI) and
  // from session updates.
  function refreshEmergencyBtn() {
    const btn  = document.getElementById('emergencyBtn');
    const hint = document.getElementById('emergencyHint');
    if (!btn || !hint || !myPlayer) return;
    // Hidden when dead or in a non-play view (let CSS handle that via view-* divs).
    if (myPlayer.alive === false) {
      btn.style.display = 'none';
      hint.style.display = 'none';
      return;
    }
    const buttonsLeft = (myPlayer.meetingButtons || 0);
    if (buttonsLeft <= 0) {
      btn.style.display = 'none';
      hint.style.display = '';
      hint.textContent = 'No emergency calls left.';
      return;
    }
    const cdMs = session && session.meetingCooldownUntil && session.meetingCooldownUntil.toMillis
      ? session.meetingCooldownUntil.toMillis() : 0;
    const cooldownSec = Math.max(0, Math.ceil((cdMs - Date.now()) / 1000));
    btn.style.display = '';
    hint.style.display = '';
    if (cooldownSec > 0) {
      btn.disabled = true;
      btn.style.opacity = '0.55';
      hint.textContent = `Cooldown ${cooldownSec}s · ${buttonsLeft} call${buttonsLeft === 1 ? '' : 's'} left`;
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      hint.textContent = `${buttonsLeft} emergency call${buttonsLeft === 1 ? '' : 's'} left`;
    }
  }

  // ── Phase 3: Meeting view ─────────────────────────────────
  function openStudentMeetingView(meetingId) {
    activeMeetingId = meetingId;
    myVoteTarget = null;
    if (unsubMeeting) unsubMeeting();
    if (unsubMeetingVotes) unsubMeetingVotes();
    setView('meeting');

    const sref = db.collection('trust_sessions').doc(sessionCode);
    const mref = sref.collection('meetings').doc(meetingId);

    unsubMeeting = mref.onSnapshot(doc => {
      const m = doc.data();
      if (!m) return;
      document.getElementById('meetingCalledBy').textContent = m.calledByName || '—';
      const rRow = document.getElementById('meetingReasonRow');
      if (rRow) rRow.textContent = m.reason ? `"${m.reason}"` : '';
      const startedAt = m.startedAt && m.startedAt.toMillis ? m.startedAt.toMillis() : null;
      if (startedAt && !meetingTimerInt) startMeetingTimer(startedAt, m.duration || 60);
      if (m.status === 'resolved') {
        if (meetingTimerInt) { clearInterval(meetingTimerInt); meetingTimerInt = null; }
        showStudentEjectReveal(m);
      }
    });
    unsubMeetingVotes = mref.collection('votes').onSnapshot(snap => {
      // We don't show live counts to students — but we do use this to
      // detect whether OUR vote landed (in case Firestore retry).
      const me = snap.docs.find(d => d.id === myUid);
      if (me) myVoteTarget = me.data().targetUid;
      renderStudentMeetingGrid();
    });
  }

  function startMeetingTimer(startedAtMs, duration) {
    const endMs = startedAtMs + duration * 1000;
    const el = document.getElementById('meetingTimer');
    const tick = () => {
      const r = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      if (el) {
        el.textContent = String(r);
        el.classList.toggle('warn', r <= 10);
      }
      if (r <= 0) {
        clearInterval(meetingTimerInt);
        meetingTimerInt = null;
      }
    };
    tick();
    meetingTimerInt = setInterval(tick, 1000);
  }

  function renderStudentMeetingGrid() {
    const grid = document.getElementById('meetingGrid');
    if (!grid) return;
    const iAmDead = myPlayer && myPlayer.alive === false;
    const alivePlayers = allPlayers.filter(p => p.alive !== false);
    const tiles = alivePlayers.map(p => {
      const isMe = p.uid === myUid;
      const isVotedFor = myVoteTarget === p.uid;
      return `
        <button type="button" class="meeting-tile ${isMe ? 'me' : ''} ${isVotedFor ? 'voted' : ''}"
                data-target="${escHtml(p.uid)}" data-name="${escHtml(p.name)}"
                ${isMe || iAmDead ? 'disabled' : ''}>
          <div class="ava">${escHtml(p.avatar || '🚀')}</div>
          <div class="name">${escHtml(p.name)}${isMe ? ' (you)' : ''}</div>
        </button>`;
    }).join('');
    const skipTile = `
      <button type="button" class="meeting-tile skip ${myVoteTarget === 'skip' ? 'voted' : ''}"
              data-target="skip" data-name="Skip"
              ${iAmDead ? 'disabled' : ''}>
        <div class="ava">🕊️</div>
        <div class="name">Skip vote</div>
      </button>`;
    grid.innerHTML = tiles + skipTile;

    // Update the "my vote" footer.
    const myVoteLine = document.getElementById('meetingMyVote');
    if (myVoteLine) {
      if (iAmDead) {
        myVoteLine.textContent = '👻 You\'ve been ejected — observing only.';
      } else if (myVoteTarget) {
        const t = myVoteTarget === 'skip' ? 'Skip' :
          (allPlayers.find(p => p.uid === myVoteTarget) || {}).name || 'someone';
        myVoteLine.textContent = `You voted for ${t}. (Tap another to change.)`;
      } else {
        myVoteLine.textContent = 'Pick a tile to lock in your vote.';
      }
    }

    grid.querySelectorAll('.meeting-tile:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => submitVote(btn.dataset.target, btn.dataset.name));
    });
  }

  async function submitVote(targetUid, targetName) {
    if (!activeMeetingId) return;
    try {
      await db.collection('trust_sessions').doc(sessionCode)
        .collection('meetings').doc(activeMeetingId)
        .collection('votes').doc(myUid).set({
          targetUid,
          targetName,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      myVoteTarget = targetUid;
      renderStudentMeetingGrid();
    } catch (e) {
      console.error('submitVote', e);
      toast('Could not submit vote: ' + e.message, 'fail');
    }
  }

  // ── Phase 3: Eject reveal (student) ────────────────────────
  function showStudentEjectReveal(meeting) {
    setView('eject');
    const card    = document.getElementById('ejectRoleCard');
    const avaEl   = document.getElementById('ejectAvatar');
    const nameEl  = document.getElementById('ejectName');
    const labelEl = document.getElementById('ejectRoleLabel');
    const head    = document.getElementById('ejectHeading');
    const storyEl = document.getElementById('ejectStory');
    if (meeting.ejectedUid) {
      card.className = 'role-card ' + (meeting.ejectedRole || 'crewmate');
      avaEl.textContent  = meeting.ejectedAvatar || '🚀';
      nameEl.textContent = meeting.ejectedName || 'Player';
      labelEl.textContent = `was ${meeting.ejectedRole === 'impostor' ? 'an IMPOSTOR' : 'a CREWMATE'}`;
      head.textContent = '🚀 Ejected!';
    } else {
      card.className = 'role-card crewmate';
      card.style.borderStyle = 'dashed';
      avaEl.textContent  = '🕊️';
      nameEl.textContent = 'No eject';
      labelEl.textContent = 'the crew skipped this vote';
      head.textContent = '🕊️ Vote skipped';
    }

    // Render the tally so students see how the room voted.
    const tally = meeting.tally || {};
    const tallyEl = document.getElementById('ejectTally');
    if (tallyEl) {
      const rows = Object.keys(tally).map(uid => {
        const name = uid === 'skip'
          ? 'Skip'
          : (allPlayers.find(p => p.uid === uid) || {}).name || '???';
        return `<span class="trust-chip" style="font-size: 0.9em;">${escHtml(name)}: ${tally[uid]}</span>`;
      });
      tallyEl.innerHTML = rows.join('');
    }

    let r = 5;
    storyEl.innerHTML = `Mission resumes in <span id="ejectCountdown">${r}</span>…`;
    const cdInt = setInterval(() => {
      r--;
      const el = document.getElementById('ejectCountdown');
      if (el) el.textContent = String(r);
      if (r <= 0) {
        clearInterval(cdInt);
        // Cleanup the meeting listeners now that the meeting is over.
        if (unsubMeeting)      { unsubMeeting();      unsubMeeting      = null; }
        if (unsubMeetingVotes) { unsubMeetingVotes(); unsubMeetingVotes = null; }
        activeMeetingId = null;
        // What comes next is driven by the session-status snapshot
        // handler: status will be either 'playing' (back to game) or
        // 'finished' (results). Nothing for us to do here.
      }
    }, 1000);
  }

  // ── Phase 4: Ghost continue-play ───────────────────────────
  // Ejected players keep answering questions for coins. Their answers
  // increment balance + accuracy counters but NOT investigationsCompleted,
  // so they can't sway the mission's win counter.
  let ghostQueue = [];
  let ghostIndex = 0;
  let ghostEntered = false;
  function renderGhostView() {
    const role = (myPlayer && myPlayer.role) || 'crewmate';
    const label = document.getElementById('ghostRoleLabel');
    if (label) label.textContent = role === 'impostor' ? 'an IMPOSTOR' : 'a CREWMATE';

    if (!ghostEntered) {
      ghostEntered = true;
      // Same question source as alive players. Independent queue so
      // we can recycle without disturbing the alive flow.
      ghostQueue = buildSourceQueue();
      ghostIndex = 0;
      nextGhostQuestion();
    }
    updateGhostCoins();
    renderGhostClueFeed();
  }
  function updateGhostCoins() {
    const el = document.getElementById('ghostCoins');
    if (el && myPlayer) el.textContent = (myPlayer.balance || 0);
  }
  function nextGhostQuestion() {
    if (!ghostQueue.length) return;
    if (ghostIndex >= ghostQueue.length) {
      shuffleInPlace(ghostQueue);
      ghostIndex = 0;
    }
    const item = ghostQueue[ghostIndex++];
    renderQuestionItem(item, document.getElementById('ghostQStem'), document.getElementById('ghostQOpts'), onGhostAnswer);
    const fb = document.getElementById('ghostQFeedback');
    fb.innerHTML = '';
    fb.className = 'trust-q-feedback';
  }
  async function onGhostAnswer(btn, item) {
    document.querySelectorAll('#ghostQOpts .trust-q-opt').forEach(b => b.disabled = true);
    const isRight = btn.dataset.correct === '1';
    btn.classList.add(isRight ? 'correct' : 'wrong');
    const fb = document.getElementById('ghostQFeedback');
    const reward = (session && session.questionReward) || 10;
    if (isRight) {
      fb.className = 'trust-q-feedback ok';
      fb.textContent = `+ 💸${reward} · added to your ghost stash`;
      try {
        // Ghost: balance + accuracy counters, but NO investigationsCompleted.
        await db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          balance: firebase.firestore.FieldValue.increment(reward),
          questionsAnswered: firebase.firestore.FieldValue.increment(1),
          questionsCorrect: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('ghost balance', e); }
    } else {
      fb.className = 'trust-q-feedback no';
      fb.textContent = `Correct: ${correctTextOf(item)}`;
      try {
        await db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          questionsAnswered: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('ghost balance', e); }
    }
    setTimeout(nextGhostQuestion, 1200);
  }
  // Ghost gets its own clue-feed pane (same data, different node).
  function renderGhostClueFeed() {
    const el = document.getElementById('ghostClueFeed');
    if (!el || !cluesCache.length) return;
    el.innerHTML = cluesCache.map(c => {
      const t = c.createdAt && c.createdAt.toDate
        ? c.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      return `
        <div style="padding:7px 8px; border-bottom:1px dashed var(--t-border);
                    font-size:0.88em; display:flex; gap:8px; align-items:flex-start;">
          <span style="color:var(--t-text-mut); font-family:JetBrains Mono;
                       font-size:0.78em; min-width:46px;">${t}</span>
          <span style="flex:1; line-height:1.4;">${escHtml(c.text || '')}</span>
        </div>`;
    }).join('');
  }

  // ── Phase 4: Coin donation ────────────────────────────────
  function openDonateModal() {
    if (!myPlayer || myPlayer.alive !== false) return;     // ghosts only
    const role = myPlayer.role;
    // Eligible recipients: alive AND same role.
    const targets = allPlayers.filter(p => p.alive !== false && p.role === role && p.uid !== myUid);
    if (!targets.length) {
      toast('No living teammates of your role.', 'fail');
      return;
    }
    const bg = document.getElementById('donateModal');
    if (!bg) return;
    const list = document.getElementById('donateTargets');
    let chosenUid = null, chosenName = '';
    list.innerHTML = targets.map(p => `
      <button type="button" class="trust-btn" data-uid="${escHtml(p.uid)}" data-name="${escHtml(p.name)}"
              style="justify-content:flex-start; gap:10px;">
        <span style="font-size:1.2em;">${escHtml(p.avatar || '🚀')}</span>
        <span style="flex:1; text-align:left;">${escHtml(p.name)}</span>
        <span style="color: var(--t-text-mut); font-size: 0.82em;">💸 ${p.balance || 0}</span>
      </button>`).join('');
    // Reset state
    document.getElementById('donateAmount').value = Math.min(50, myPlayer.balance || 0);
    const errEl = document.getElementById('donateError');
    errEl.style.display = 'none';
    errEl.textContent = '';
    bg.classList.add('active');
    bg.style.display = '';

    const tileBtns = list.querySelectorAll('button');
    const onTile = (e) => {
      tileBtns.forEach(b => b.style.borderColor = 'var(--t-border)');
      e.currentTarget.style.borderColor = 'var(--t-violet)';
      chosenUid = e.currentTarget.dataset.uid;
      chosenName = e.currentTarget.dataset.name;
    };
    tileBtns.forEach(b => b.addEventListener('click', onTile));

    const ok = document.getElementById('donateConfirm');
    const cn = document.getElementById('donateCancel');
    const close = () => {
      bg.classList.remove('active');
      bg.style.display = 'none';
      tileBtns.forEach(b => b.removeEventListener('click', onTile));
      ok.removeEventListener('click', onOk);
      cn.removeEventListener('click', onCn);
    };
    const onCn = () => close();
    const onOk = async () => {
      const amount = parseInt(document.getElementById('donateAmount').value, 10);
      if (!chosenUid) { errEl.style.display = ''; errEl.textContent = 'Pick a teammate.'; return; }
      if (!amount || amount < 10) { errEl.style.display = ''; errEl.textContent = 'Minimum donation is 💸10.'; return; }
      if (amount > (myPlayer.balance || 0)) { errEl.style.display = ''; errEl.textContent = `You only have 💸${myPlayer.balance || 0}.`; return; }
      ok.disabled = true; ok.textContent = 'Donating…';
      try {
        // Optimistic deduction so the donor feels the cost. Host
        // resolves and credits the recipient.
        await db.collection('trust_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          balance: firebase.firestore.FieldValue.increment(-amount)
        });
        await db.collection('trust_sessions').doc(sessionCode).collection('donations').add({
          donorUid: myUid, donorName: myName,
          recipientUid: chosenUid, recipientName: chosenName,
          amount, status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        toast(`🎁 💸${amount} sent to ${chosenName}`, 'success');
        close();
      } catch (e) {
        console.error('donate', e);
        errEl.style.display = ''; errEl.textContent = 'Could not donate: ' + e.message;
        ok.disabled = false; ok.textContent = 'Donate';
      }
    };
    ok.addEventListener('click', onOk);
    cn.addEventListener('click', onCn);
  }

  // ── Done view ──────────────────────────────────────────────
  function enterDone() {
    setView('done');
    const myRole = (myPlayer && myPlayer.role) || '—';
    const sorted = [...allPlayers].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const myRank = sorted.findIndex(p => p.uid === myUid);
    const finalEl = document.getElementById('myFinal');
    finalEl.innerHTML = `
      <div style="margin-bottom: 8px;">
        You were <strong style="color: ${myRole === 'impostor' ? 'var(--t-amber-2)' : 'var(--t-cyan-2)'};">
          ${myRole === 'impostor' ? '🎭 Impostor' : '🛰️ Crewmate'}
        </strong>
      </div>
      <div style="color: var(--t-text-mut);">
        Final coins: <strong style="color: var(--t-amber-2);">💸 ${(myPlayer && myPlayer.balance) || 0}</strong>
        · Investigations: <strong>${(myPlayer && myPlayer.investigationsCompleted) || 0}</strong>
        · Rank: <strong>#${myRank >= 0 ? myRank + 1 : '—'}</strong> of ${sorted.length}
      </div>
    `;
    unsubs.forEach(u => { try { u(); } catch (_) {} });
    unsubs = [];
  }

  // ── DOM wiring ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('bgMusic');
    if (audio) {
      audio.volume = 0.3;
      audio.loop = false;
      audio.addEventListener('ended', () => { if (musicPlaying) playRandomTrack(); });
    }
    // Code from ?code= in the URL.
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();

    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    // Phase 2: wire the "Plant a fake clue" button (impostors only).
    const plantBtn = document.getElementById('plantClueBtn');
    if (plantBtn) plantBtn.addEventListener('click', openPlantClueModal);
    // Phase 3: emergency-meeting button + cooldown ticker. The ticker
    // re-renders the button label/disabled state every second so the
    // student sees the cooldown countdown without depending on the
    // session.meetingCooldownUntil snapshot firing every tick.
    const emBtn = document.getElementById('emergencyBtn');
    if (emBtn) emBtn.addEventListener('click', async () => {
      const ok = await AppDialog.confirm(
        'This uses your only emergency button.',
        { title: 'Call an emergency meeting?', okLabel: 'Call meeting', icon: '🚨' });
      if (ok) callEmergencyMeeting();
    });
    setInterval(refreshEmergencyBtn, 1000);

    // Phase 4: ghost-mode donation trigger. Visible only on view-ghost.
    const donateBtn = document.getElementById('ghostDonateBtn');
    if (donateBtn) donateBtn.addEventListener('click', openDonateModal);

    setView('join');
  });

  // refresh-guard.js predicate — themed double-confirm on F5 / Ctrl+R
  // active during any in-flight Trust No One state (the post-eject
  // ghost view stays interactive, so protect it too).
  window.refreshGuardShouldProtect = () => {
    if (!session) return false;
    if (['liftoff','playing','meeting','eject'].indexOf(session.status) >= 0) return true;
    return false;
  };

  // beforeunload guard during play
  window.addEventListener('beforeunload', (e) => {
    if (session && session.status === 'playing'
        && document.getElementById('view-play')
        && document.getElementById('view-play').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
