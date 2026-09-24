/* ============================================================
   MINIGAME CORE - shared helpers for the small classroom games
   (Tug of War, Vocab Bingo, Sentence Scramble)
   ------------------------------------------------------------
   One home for the plumbing every mini-game repeats: escaping,
   shuffling, room codes, QR join URLs, toasts, background music,
   CSV download, and the QUESTION BUILDERS. Content is NEVER
   invented here - vocabulary questions come verbatim from
   datasets.json and grammar questions from GRAMMAR_PRACTICE
   (the same banks solo practice uses), honoring the classroom
   content controls (cc-classroom.js) and the difficulty rule:
   English-definition questions only from B1 up - A2 gets
   fill-in-the-blank built from the word's own example sentence.

   Load AFTER cc-classroom.js (teacher pages) and BEFORE the
   per-game script. Exposes window.MG.
   ============================================================ */
(function () {
  'use strict';

  var MG = {};

  MG.escHtml = function (s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  MG.shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  MG.sample = function (a, n) { return MG.shuffle(a).slice(0, n); };

  // 5-char code: distinct from Heist/Trust (4) and Vocab Race (6), so
  // the universal join page can route by length alone.
  MG.genCode = function () {
    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    var out = '';
    for (var i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };

  MG.joinUrl = function (studentPage, code) {
    return location.origin + location.pathname.replace(/[^/]+$/, '') +
      studentPage + '?code=' + encodeURIComponent(code);
  };
  MG.qrSrc = function (url, size, margin) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size +
      '&margin=' + (margin == null ? 8 : margin) + '&data=' + encodeURIComponent(url);
  };

  MG.toast = function (msg, kind) {
    var el = document.createElement('div');
    el.className = 'mg-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  };

  // Background music - same wiring as the other classroom games; each
  // game passes its own SoundHelix set for a distinct sonic identity.
  /* Game sound effects. Thin wrapper over js/sound.js so a host game has one
     obvious call and never has to check whether the engine loaded.
     Separate from setupMusic below: that is streamed background music with
     its own button, this is short synthesised cues.

     STUDENT PAGES DELIBERATELY DO NOT LOAD js/sound.js, so MG.sfx is a no-op
     there. That is the design, not an oversight: these games run on a
     projector with a room full of phones, and a cue on every device would be
     a thousand chimes at once. Sound belongs on the host screen. */
  MG.sfx = function (type, opts) {
    if (window.LLSound) return window.LLSound.play(type, opts);
    return false;
  };
  // Call from the first real click of a game. Browsers only let audio start
  // from a user gesture, so without this the first cue is swallowed.
  MG.sfxWarmUp = function () { if (window.LLSound) window.LLSound.warmUp(); };

  /* The default background playlist.
     Six of the fourteen game pages passed their own copy of exactly this
     list; the other eight passed nothing and got a button that threw. One
     list here means every page behaves the same and there is one place to
     change it - which is where it will need changing, because these are
     streamed from soundhelix.com, a third-party demo site, and hosting them
     ourselves is the obvious later improvement. */
  MG.DEFAULT_MUSIC = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'
  ];

  MG.setupMusic = function (tracks) {
    var playing = false, current = -1;

    // CALLED WITH NOTHING? Use the default list.
    //
    // Eight pages called MG.setupMusic() with no argument while still
    // carrying a 🎵 button wired to toggleMusic(). Pressing it ran
    // playRandom(), which read `tracks.length` on undefined - a TypeError, on
    // the host page for a 1000-student event. They get the shared playlist
    // now instead of a dead button.
    //
    // An EXPLICIT empty array still means "this page has no music": the
    // button is hidden and every entry point is a no-op, so a page can opt
    // out deliberately without a crash.
    if (tracks === undefined || tracks === null) tracks = MG.DEFAULT_MUSIC;
    tracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    if (!tracks.length) {
      window.toggleMusic = function () {};
      window.nextTrack = function () {};
      window.setVolume = function () {};
      document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('musicBtn');
        if (btn) btn.style.display = 'none';
      });
      return;
    }

    function playRandom() {
      var audio = document.getElementById('bgMusic');
      if (!audio) return;
      var idx = Math.floor(Math.random() * tracks.length);
      if (idx === current) idx = (idx + 1) % tracks.length;
      current = idx;
      audio.src = tracks[idx];
      audio.load();
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
    window.toggleMusic = function () {
      var audio = document.getElementById('bgMusic');
      var btn = document.getElementById('musicBtn');
      if (!audio || !btn) return;
      if (playing) { audio.pause(); btn.textContent = '🎵'; btn.classList.remove('playing'); }
      else { playRandom(); btn.textContent = '🔊'; btn.classList.add('playing'); }
      playing = !playing;
    };
    window.nextTrack = function () { if (playing) playRandom(); };
    window.setVolume = function (val) {
      var audio = document.getElementById('bgMusic');
      if (audio) audio.volume = (Number(val) || 0) / 100;
    };
    document.addEventListener('DOMContentLoaded', function () {
      var audio = document.getElementById('bgMusic');
      if (audio) {
        audio.volume = 0.3;
        audio.loop = false;
        audio.addEventListener('ended', function () { if (playing) playRandom(); });
      }
    });
  };

  MG.downloadCsv = function (rows, filename) {
    var csv = rows.map(function (r) {
      return r.map(function (cell) {
        var s = String(cell == null ? '' : cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Themed confirm - Promise<boolean>. Uses the SAME .confirm-modal
  // component every classroom page uses (classroom/css/styles.css), so
  // the dialog looks identical to the rest of Classroom Mode.
  MG.ask = function (title, msg, okLabel) {
    return new Promise(function (resolve) {
      var bg = document.createElement('div');
      bg.className = 'confirm-modal active';
      bg.style.zIndex = '4000';
      bg.innerHTML =
        '<div class="confirm-modal-box">' +
          '<div class="confirm-modal-icon">⚠️</div>' +
          '<h3 class="confirm-modal-title">' + MG.escHtml(title || 'Are you sure?') + '</h3>' +
          '<p class="confirm-modal-text">' + MG.escHtml(msg || '') + '</p>' +
          '<div class="confirm-modal-buttons">' +
            '<button type="button" class="btn btn-secondary" data-act="cancel">Cancel</button>' +
            '<button type="button" class="btn btn-danger" data-act="ok">' + MG.escHtml(okLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(bg);
      function done(val) { try { bg.remove(); } catch (_) {} resolve(val); }
      bg.addEventListener('click', function (e) {
        if (e.target === bg) done(false);
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') done(true);
        if (act === 'cancel') done(false);
      });
    });
  };

  MG.escapeRe = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  function familyKey(w) { return String(w || '').toLowerCase().split(/\s+/).slice(0, 3).join(' '); }

  // ── Content pools (verbatim from the banks - nothing invented) ──
  // Vocabulary entries at a level (+ optional "Unit N" filter), minus
  // any word-list the admin hid from classroom.
  MG.vocabPool = function (vocabulary, level, unit) {
    if (!vocabulary || !vocabulary[level]) return [];
    var pool = vocabulary[level].filter(function (w) { return w && w.word && w.def; });
    if (unit && unit !== 'all') pool = pool.filter(function (w) { return w.unit === unit; });
    if (typeof window.ccClassroomVocabUnitHidden === 'function') {
      pool = pool.filter(function (w) { return !window.ccClassroomVocabUnitHidden(level, w.unit); });
    }
    return pool.map(function (w) {
      return { word: w.word, def: w.def, ex: w.ex || '', pos: w.pos || '', unit: w.unit || '' };
    });
  };

  // Words whose example sentence contains the word verbatim - the only
  // ones a gap question can be built from.
  MG.gappable = function (pool) {
    return pool.filter(function (w) {
      return w.ex && new RegExp('\\b' + MG.escapeRe(w.word) + '\\b', 'i').test(w.ex);
    });
  };
  MG.gapSentence = function (w) {
    return w.ex.replace(new RegExp('\\b' + MG.escapeRe(w.word) + '\\b', 'i'), '_____');
  };

  function pickDistractors(pool, w, count, wantWords) {
    var candidates = pool.filter(function (o) {
      return o.word !== w.word && o.def !== w.def && familyKey(o.word) !== familyKey(w.word);
    });
    var samePos = candidates.filter(function (o) { return o.pos && w.pos && o.pos === w.pos; });
    var wrong = MG.sample(samePos, count);
    if (wrong.length < count) {
      var used = wrong.slice();
      wrong = wrong.concat(MG.sample(candidates.filter(function (o) { return used.indexOf(o) === -1; }), count - wrong.length));
    }
    return wrong.map(function (o) { return wantWords ? o.word : o.def; });
  }

  // Vocabulary MCQs. DIFFICULTY RULE: A2 gets fill-in-the-blank (pick
  // the word that completes its own example sentence); B1 and up get
  // meaning questions (pick the definition). Options always come from
  // the same level's bank.
  MG.vocabMCQs = function (vocabulary, level, unit, count) {
    var pool = MG.vocabPool(vocabulary, level, unit);
    var out = [];
    if (level === 'A2') {
      MG.sample(MG.gappable(pool), count).forEach(function (w) {
        var options = MG.shuffle([w.word].concat(pickDistractors(pool, w, 3, true)));
        out.push({
          stem: 'Choose the word that completes the sentence:\n"' + MG.gapSentence(w) + '"',
          options: options,
          answer: options.indexOf(w.word)
        });
      });
    } else {
      MG.sample(pool, count).forEach(function (w) {
        var options = MG.shuffle([w.def].concat(pickDistractors(pool, w, 3, false)));
        out.push({
          stem: (w.ex ? 'Read the sentence and find the meaning of "' + w.word + '":\n"' + w.ex + '"'
                      : 'Find the meaning of "' + w.word + '":'),
          options: options,
          answer: options.indexOf(w.def)
        });
      });
    }
    return out;
  };

  // Grammar MCQs from the generated bank (same one solo practice and
  // Grammar Race use), minus classroom-hidden topics.
  MG.grammarMCQs = function (level, unit, count) {
    var GP = window.GRAMMAR_PRACTICE;
    if (!GP || !GP.byLevel || !GP.byLevel[level]) return [];
    var unitOf = function (t) { var m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; };
    var topics = GP.byLevel[level];
    if (typeof window.ccClassroomGrammarHidden === 'function') {
      topics = topics.filter(function (t) { return !window.ccClassroomGrammarHidden(t.id); });
    }
    if (unit && unit !== 'all') topics = topics.filter(function (t) { return unitOf(t) === parseInt(unit, 10); });
    var qs = [];
    topics.forEach(function (t) {
      (t.questions || []).forEach(function (q) {
        qs.push({ stem: q.stem, options: q.options, answer: q.answer });
      });
    });
    return MG.sample(qs, count);
  };

  // Mixed = half vocabulary + half grammar, shuffled. `unit` is the
  // numeric grammar unit ('all' or N); vocab uses 'Unit N'.
  MG.mixedMCQs = function (vocabulary, level, unit, count) {
    var halfG = Math.ceil(count / 2);
    var vUnit = (unit && unit !== 'all') ? ('Unit ' + unit) : 'all';
    var g = MG.grammarMCQs(level, unit, halfG);
    var v = MG.vocabMCQs(vocabulary, level, vUnit, count - g.length);
    return MG.shuffle(g.concat(v)).slice(0, count);
  };

  // Sentences for the Scramble game: the bank's own example sentences,
  // 4-10 words long (playable on a phone), each carrying its target word.
  MG.scrambleRounds = function (vocabulary, level, unit, count) {
    var pool = MG.vocabPool(vocabulary, level, unit).filter(function (w) {
      if (!w.ex) return false;
      var n = w.ex.trim().split(/\s+/).length;
      return n >= 4 && n <= 10;
    });
    return MG.sample(pool, count).map(function (w) {
      var answer = w.ex.trim().replace(/\s+/g, ' ');
      var words = answer.split(' ');
      var scrambled = MG.shuffle(words);
      // Never present the sentence already in order.
      for (var tries = 0; tries < 5 && scrambled.join(' ') === answer && words.length > 1; tries++) {
        scrambled = MG.shuffle(words);
      }
      return { words: scrambled, answer: answer, word: w.word };
    });
  };

  window.MG = MG;
})();
