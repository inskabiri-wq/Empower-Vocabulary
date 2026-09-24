/* ============================================================
   LLSound - the app's one sound engine.
   ------------------------------------------------------------
   WHY THIS FILE EXISTS

   The engine used to live in student/js/ui.js, which is loaded by exactly
   ONE page (student-dashboard.html). A second, drifting copy was pasted
   inline into app.html. So:

     - the nine classroom games had no sound at all, because playSound()
       simply did not exist on those pages
     - the "Sound Effects" switch in the shared settings panel appears on 32
       pages and controlled two of them
     - any fix had to be made twice

   Everything is SYNTHESISED with the Web Audio API. No audio files, so this
   costs no bandwidth, works offline, and needs nothing precached.

   USE
       LLSound.play('correct');
       LLSound.play('join', { throttle: 120 });   // see THROTTLING
       LLSound.enabled()            -> boolean, from the shared setting
       LLSound.setEnabled(true)

   The three original sounds (correct / incorrect / complete) are moved here
   unchanged, note for note, so vocabulary sounds exactly as it did.
   ============================================================ */
(function () {
  'use strict';
  if (window.LLSound) return;               // never install twice

  var STORE_KEY = 'soundEnabled';           // the key the settings panel writes
  var VOL_KEY = 'soundVolume';              // 0-100, DEFAULT 100

  /* VOLUME.
     Every cue's gain is multiplied by this. The default is 100, which
     multiplies by exactly 1, so an installation that never touches the
     slider sounds bit-for-bit as it did before the control existed.
     It matters in a hall: through speakers the gap between "audible at the
     back" and "painful at the front" is wide, and on/off is a blunt answer. */
  function volume() {
    try {
      var v = parseInt(localStorage.getItem(VOL_KEY), 10);
      if (!isFinite(v)) return 1;                     // never set: full
      return Math.max(0, Math.min(100, v)) / 100;
    } catch (_) { return 1; }
  }
  function setVolume(v) {
    try {
      v = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
      localStorage.setItem(VOL_KEY, String(v));
    } catch (_) {}
  }

  /* ── The shared AudioContext ──────────────────────────────────────────
     Browsers cap concurrent contexts (Chrome around 6) and suspend any
     created before a user gesture. A context per call meant silent first
     clicks and, in a long session, "context was not allowed to start" with
     dropped audio. One context, resumed lazily, fixes both.              */
  var ctx = null;
  function getCtx() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    } catch (e) { return null; }
  }

  function enabled() {
    try { return localStorage.getItem(STORE_KEY) !== 'false'; }   // default ON
    catch (_) { return true; }
  }
  function setEnabled(v) {
    try { localStorage.setItem(STORE_KEY, v ? 'true' : 'false'); } catch (_) {}
  }

  /* ── THROTTLING ───────────────────────────────────────────────────────
     A lobby filling with 1000 students would fire 1000 join sounds. Even at
     a few per second that is a machine gun, and the host machine would be
     scheduling oscillators instead of drawing the roster. A throttled sound
     plays at most once per window and silently drops the rest.           */
  var lastPlayed = {};
  function throttled(type, ms) {
    if (!ms) return false;
    var now = Date.now();
    if (lastPlayed[type] && (now - lastPlayed[type]) < ms) return true;
    lastPlayed[type] = now;
    return false;
  }

  // One note. Everything below is built from this.
  function tone(c, out, freq, startAt, dur, peak, wave) {
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.connect(g); g.connect(out);
    osc.type = wave || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime + startAt);
    g.gain.setValueAtTime(peak, c.currentTime + startAt);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + startAt + dur);
    osc.start(c.currentTime + startAt);
    osc.stop(c.currentTime + startAt + dur);
  }
  function master(c, peak, dur) {
    var g = c.createGain();
    g.connect(c.destination);
    // Scaled here, once per cue, rather than in every tone(): this is the only
    // node all of them pass through.
    g.gain.setValueAtTime(peak * volume(), c.currentTime);
    // The decay target is scaled too. Left at a fixed 0.01 it would be ABOVE
    // the starting level at low volumes, so a ramp meant to fade out would
    // ramp up instead.
    if (dur) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.01 * volume()), c.currentTime + dur);
    return g;
  }

  var SOUNDS = {
    // ── The three originals, unchanged ────────────────────────────────
    correct: function (c) {
      var m = master(c, 0.3, 0.5);
      tone(c, m, 659.25, 0,    0.4,  0.4);   // E5
      tone(c, m, 1318.5, 0,    0.25, 0.15);  // E6 brightness
      tone(c, m, 830.6,  0.05, 0.3,  0.1);   // G#5 major third
    },
    incorrect: function (c) {
      var m = master(c, 0.15, 0.35);
      tone(c, m, 440,    0,    0.15, 0.3);   // A4
      tone(c, m, 349.23, 0.12, 0.23, 0.25);  // F4, gentle descent
    },
    complete: function (c) {
      var m = master(c, 0.25);
      [[523.25, 0, 0.6], [659.25, 0.1, 0.5], [783.99, 0.2, 0.4], [1046.5, 0.3, 0.5]]
        .forEach(function (n) {
          tone(c, m, n[0], n[1], n[2], 0.3);
          tone(c, m, n[0] * 2, n[1], n[2] * 0.7, 0.08);
        });
      setTimeout(function () {
        // Scaled like master()'s own ramp: a fixed floor would sit ABOVE the
        // starting level at low volume and fade the sound UP.
        try { m.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.01 * volume()), c.currentTime + 1); } catch (_) {}
      }, 600);
    },

    // ── New, for the classroom games ──────────────────────────────────
    // Deliberately SHORT and quiet. These play in a hall through speakers,
    // often many times a minute, and anything with a tail turns into mush.

    // A student appeared in the lobby. Tiny, high, barely there - it will
    // fire hundreds of times and must never become the main event.
    join: function (c) {
      var m = master(c, 0.10, 0.14);
      tone(c, m, 1046.5, 0, 0.10, 0.5);
    },
    // The round is starting. Two rising notes, confident, not a fanfare.
    start: function (c) {
      var m = master(c, 0.22, 0.45);
      tone(c, m, 523.25, 0,    0.22, 0.45);  // C5
      tone(c, m, 783.99, 0.13, 0.30, 0.45);  // G5
    },
    // One second of the countdown. Dry and percussive so ten in a row read
    // as a rhythm rather than a chord.
    tick: function (c) {
      var m = master(c, 0.16, 0.09);
      tone(c, m, 880, 0, 0.07, 0.5, 'triangle');
    },
    // The last few seconds. Same shape, higher and sharper - urgency comes
    // from pitch, not volume, so it does not just get louder.
    tickUrgent: function (c) {
      var m = master(c, 0.2, 0.1);
      tone(c, m, 1174.7, 0, 0.08, 0.6, 'triangle');
    },
    // Time is up / the round closed.
    end: function (c) {
      var m = master(c, 0.24, 0.6);
      tone(c, m, 587.33, 0,    0.28, 0.5);   // D5
      tone(c, m, 440,    0.16, 0.40, 0.45);  // A4, falling
    },
    // Points landed. Very short so it can follow a fast stream of answers.
    score: function (c) {
      var m = master(c, 0.18, 0.2);
      tone(c, m, 987.77, 0,    0.12, 0.5);   // B5
      tone(c, m, 1318.5, 0.06, 0.14, 0.35);  // E6
    },
    // Somebody won / the leaderboard is revealed.
    win: function (c) {
      var m = master(c, 0.26, 1.1);
      [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], [1318.5, 0.5]]
        .forEach(function (n) { tone(c, m, n[0], n[1], 0.5, 0.34); });
    },
    // A caught impostor, a failed heist, a lost round. Low and brief; this
    // is a game result, not an error.
    fail: function (c) {
      var m = master(c, 0.2, 0.55);
      tone(c, m, 311.13, 0,   0.3, 0.45, 'triangle');  // Eb4
      tone(c, m, 233.08, 0.2, 0.35, 0.4, 'triangle');  // Bb3
    }
  };

  /* Play one sound.
     opts.throttle - milliseconds; drop repeats inside that window.
     opts.force    - play even when the user has sound switched off. Nothing
                     uses this today; it exists so a future "test sound"
                     button in settings can demo the effect being toggled. */
  function play(type, opts) {
    opts = opts || {};
    try {
      if (!opts.force && !enabled()) return false;
      // Volume 0 is silence, and it must SHORT-CIRCUIT rather than play at
      // gain 0: an exponential ramp cannot reach or start from zero, so
      // scheduling one there is an invalid value the browser may throw on.
      if (!opts.force && volume() === 0) return false;
      var fn = SOUNDS[type];
      if (!fn) return false;
      if (throttled(type, opts.throttle)) return false;
      var c = getCtx();
      if (!c) return false;
      fn(c);
      return true;
    } catch (e) {
      // A sound is never worth breaking a page for, and a classroom game is
      // the worst possible place to throw.
      return false;
    }
  }

  window.LLSound = {
    play: play,
    enabled: enabled,
    setEnabled: setEnabled,
    volume: function () { return Math.round(volume() * 100); },   // 0-100
    setVolume: setVolume,
    types: function () { return Object.keys(SOUNDS); },
    // Exposed for the settings panel: unlocks audio on the click that flips
    // the switch, so the first game sound is not swallowed.
    warmUp: function () { getCtx(); }
  };

  /* ── window.toggleSound ───────────────────────────────────────────────
     The settings panel decides whether to show the Sound Effects switch by
     asking `typeof window.toggleSound === 'function'`. That function existed
     only in student/js/ui.js and inline in app.html - two pages. So on every
     classroom HOST page the switch was absent, and after the volume slider
     was added under it, that was absent too.

     Which put the control furthest from the person who needs it: the teacher
     running a game through hall speakers had no way to mute or turn down the
     cues from the page making them, and had to open the student dashboard.

     Defining it here means it exists wherever the engine does.

     IT IS DELIBERATELY OVERWRITTEN on the two pages that have their own.
     Both load their version AFTER this file (student-dashboard: this at line
     27, ui.js at 1089; app.html: this at 686, its own at 1070), and a later
     function declaration replaces this property. Theirs do more - they also
     update an on-page #soundToggle button and its icon - so letting them win
     keeps those pages behaving exactly as they do today. This is the fallback
     for every other page, not a replacement.                              */
  if (typeof window.toggleSound !== 'function') {
    window.toggleSound = function () {
      var next = !enabled();
      setEnabled(next);
      // Unlock audio on the very gesture that switched it on, or the first
      // cue afterwards is swallowed by the browser's autoplay rules.
      if (next) getCtx();
      return next;
    };
  }
})();
