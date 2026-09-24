/* Student Dashboard - Speech & Pronunciation */

// SPEECH
function initSpeech() {
  if (!speechSynthesis) {
    document.getElementById('ttsWarning').style.display = 'block';
  } else {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.getVoices();
      logAvailableVoices(); // Debug: log voices when they load
    };
    speechSynthesis.getVoices();
    logAvailableVoices(); // Debug: log voices on init
  }
}

// DEBUG: List all available voices to console
function logAvailableVoices() {
  const voices = speechSynthesis.getVoices();
  console.log(`📢 Available voices (${voices.length} total):`);
  voices.forEach((voice, index) => {
    const type = voice.lang.startsWith('en-GB') ? '🇬🇧 UK' :
                 voice.lang.startsWith('en-US') ? '🇺🇸 US' :
                 voice.lang.startsWith('en') ? '🌍 EN' : '❓';
    const quality = scoreVoiceQuality(voice);
    console.log(`  ${index}: ${type} "${voice.name}" (${voice.lang}) - quality ${quality}`);
  });

  // Summary
  const ukVoices = voices.filter(v => v.lang.startsWith('en-GB'));
  const usVoices = voices.filter(v => v.lang.startsWith('en-US'));
  console.log(`📊 Summary: ${ukVoices.length} UK voices, ${usVoices.length} US voices`);
}

// ============================================================
// Voice quality scoring
//   Web Speech voices vary wildly in quality across browsers /
//   OSes. Modern Edge exposes Microsoft's neural cloud voices
//   ("Online (Natural)") which sound nearly human; older Windows
//   SAPI voices ("David"/"Zira") sound robotic. We score every
//   available voice and pick the highest-scoring one matching the
//   selected accent - so Edge users automatically get neural
//   voices, macOS/iOS users get Premium voices, and everyone
//   else still falls back gracefully.
// ============================================================
function scoreVoiceQuality(v) {
  if (!v || !v.name) return 0;
  const name = v.name.toLowerCase();
  let score = 0;

  // 🏆 Microsoft Edge neural cloud voices - best widely-available
  // free option. Typical name: "Microsoft Aria Online (Natural) -
  // English (United States)". The "(Natural)" tag is the giveaway.
  if (name.includes('online (natural)') || name.includes('natural)')) score += 100;
  else if (name.includes('online')) score += 70; // older "online" variants

  // 🍎 Apple Premium / Enhanced - macOS & iOS Safari ship these
  // via the Speech preference pane / system download.
  if (name.includes('(premium)') || /\bpremium\b/.test(name)) score += 85;
  if (name.includes('(enhanced)') || /\benhanced\b/.test(name)) score += 65;

  // 🔬 Google Cloud neural / wavenet (rare in Chrome but possible)
  if (name.includes('wavenet') || name.includes('neural2') || /\bneural\b/.test(name)) score += 75;

  // 🎙️ Modern Microsoft local-neural voices (Windows 11 / Edge)
  // These are notably better than legacy SAPI5 voices but not as
  // good as the cloud "Online" variants.
  const modernMSNames = ['aria', 'jenny', 'guy', 'davis', 'tony', 'jane',
                         'libby', 'ryan', 'sonia', 'thomas', 'maisie'];
  if (modernMSNames.some(n => name.includes(n))) score += 35;

  // 🍎 Apple system voices (no premium tag) - Samantha/Alex are
  // surprisingly good even without enhancement.
  const appleSystem = ['samantha', 'siri', 'alex', 'fred', 'victoria',
                       'allison', 'ava', 'tom', 'susan', 'karen',
                       'daniel', 'fiona', 'moira', 'tessa'];
  if (appleSystem.some(n => name.includes(n))) score += 25;

  // 🤖 Penalize the robotic legacy SAPI voices on Windows
  if (name.includes('david') || name.includes('zira') || name.includes('mark') ||
      name.includes('hazel') || name.includes('sapi')) score -= 25;

  // Cloud voices (localService === false) tend to be higher fidelity
  if (v.localService === false) score += 15;

  // Slight bias against the platform default - it's almost always
  // the most basic option.
  if (v.default) score -= 3;

  return score;
}

// Find the best voice matching a target language code.
// `targetLang` can be 'en-GB' or 'en-US'; we accept both '-' and '_'
// separators (some platforms use one, others use the other).
function pickBestVoice(targetLang) {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Honor the user's explicit choice from settings, if it's still
  // available in the current voice list.
  try {
    const savedURI = localStorage.getItem('preferredVoiceURI');
    if (savedURI) {
      const exact = voices.find(v => v.voiceURI === savedURI);
      if (exact) return exact;
    }
  } catch (_) { /* localStorage unavailable */ }

  const tgt = (targetLang || 'en-US').toLowerCase().replace('_', '-');
  const tgtPrefix = tgt.split('-')[0];

  // Bucket voices by how well they match the target language.
  const exactLang = voices.filter(v => (v.lang || '').toLowerCase().replace('_', '-') === tgt);
  const sameRegion = voices.filter(v =>
    (v.lang || '').toLowerCase().replace('_', '-').startsWith(tgt));
  const sameLanguage = voices.filter(v =>
    (v.lang || '').toLowerCase().startsWith(tgtPrefix));

  const pools = [exactLang, sameRegion, sameLanguage]
    .filter(p => p.length)
    .map(p => p.slice().sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a)));

  return (pools[0] && pools[0][0]) || voices[0] || null;
}

function speak(text) {
  if (!speechSynthesis) return;
  // Guard: empty/whitespace-only text still schedules a silent utterance on
  // the synth queue, which can cause a tiny stutter before the next real
  // speak. Skip it outright.
  if (!text || !String(text).trim()) return;

  speechSynthesis.cancel();

  // Voices may not be loaded yet (async in Chrome). Wait for them before speaking.
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.onvoiceschanged = null;
      speak(text);
    };
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);

  // Pick the highest-quality voice matching the requested accent
  // automatically - see scoreVoiceQuality() for the ranking. Edge
  // users land on Microsoft "Online (Natural)" neural voices,
  // macOS/iOS users land on Apple Premium voices, everyone else
  // gets the best available. Never the robotic SAPI defaults if
  // anything better is in the list.
  const targetLang = selectedAccent === 'UK' ? 'en-GB' : 'en-US';
  const targetVoice = pickBestVoice(targetLang);

  if (targetVoice) {
    utter.voice = targetVoice;
    console.log(`🎙️ Voice: "${targetVoice.name}" (${targetVoice.lang}) - quality ${scoreVoiceQuality(targetVoice)}`);
  } else {
    console.warn('⚠️ No matching voice found - using browser default');
  }

  utter.lang = targetLang;
  // Slightly slower default helps comprehension for ESL learners.
  // Neural voices already have natural prosody, so we don't need to
  // slow them down as much; keep 0.9 as a reasonable middle ground.
  utter.rate = 0.9;
  utter.pitch = 1;

  // Chrome race: speechSynthesis.cancel() is async, and calling speak()
  // in the same tick sometimes discards the new utterance - user clicks
  // the speaker, nothing plays. A tiny defer lets cancel finish first.
  // 50ms is imperceptible and well below human reaction to a button press.
  setTimeout(() => {
    try { speechSynthesis.speak(utter); } catch (e) { /* no-op */ }
  }, 50);
}

// Cancel any in-flight TTS when the user navigates away or the tab goes
// into the background. Without this, a word can keep pronouncing itself
// over the next screen (e.g., click Back mid-speech → still talking).
window.addEventListener('pagehide', () => {
  if (window.speechSynthesis) {
    try { speechSynthesis.cancel(); } catch (e) { /* no-op */ }
  }
});

function setAccent(accent) {
  selectedAccent = accent;
  localStorage.setItem('accent', accent);
  document.getElementById('accentUS').classList.toggle('active', accent === 'US');
  document.getElementById('accentUK').classList.toggle('active', accent === 'UK');
  
  if (document.getElementById('pronunciationScreen').classList.contains('active') && currentWords[currentIndex]) {
    speak(currentWords[currentIndex].word);
  }
}

function initAccentButtons() {
  document.getElementById('accentUS').classList.toggle('active', selectedAccent === 'US');
  document.getElementById('accentUK').classList.toggle('active', selectedAccent === 'UK');
}

// PRONUNCIATION ACTIVITY
function initPronunciation() {
  initAccentButtons();
  pronTrackReset();
  // The microphone only appears where the browser can actually use it.
  var mic = document.getElementById('pronMicBtn');
  var note = document.getElementById('pronMicNote');
  var on = pronSupported();
  if (mic) mic.style.display = on ? '' : 'none';
  if (note) note.style.display = on ? '' : 'none';
  loadPronunciation();
  showScreen('pronunciationScreen');
}

function speakWord() {
  const cur = currentWords[currentIndex];
  speak(cur.word);
}

function loadPronunciation() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  document.getElementById('pronWord').textContent = cur.word;
  document.getElementById('pronPOS').textContent = cur.pos || '';
  
  const trEl = document.getElementById('pronTR');
  if (turkishEnabled && selectedLevel === 'A2' && cur.tr) {
    trEl.textContent = `🇹🇷 ${cur.tr}`;
    trEl.classList.add('visible');
  } else {
    trEl.classList.remove('visible');
  }
  
  document.getElementById('pronDef').textContent = cur.def;
  document.getElementById('pronExample').textContent = cur.ex;
  document.getElementById('pronCurrent').textContent = currentIndex + 1;
  document.getElementById('pronTotal').textContent = currentWords.length;
  setProgress('pronProgress', currentIndex + 1, currentWords.length);
  
  setTimeout(() => speak(cur.word), 300);
}

function nextPronunciation() {
  // Stop any live recogniser before moving on, or it reports the next word's
  // attempt against the previous word.
  if (pronSR) { try { pronSR.stop(); } catch (e) {} pronSR = null; }
  pronSetResult('', '');
  currentIndex++;
  loadPronunciation();
}

/* ============================================================
   SAYING THE WORD - optional, and marked generously
   ------------------------------------------------------------
   Until now this activity captured nothing: it spoke a word and the
   student pressed Next. That is why it had no score, why the teacher
   dashboard could show no right/wrong for it, and why its sessions
   are saved unscored.

   A microphone changes that, but browser speech recognition is a
   blunt instrument for a learner. It is trained on fluent speech, so
   a Turkish speaker pronouncing "thorough" perfectly well can still
   come back as "through" or "borough". Marking hard on that would
   discourage exactly the students who most need the practice. Three
   rules follow from it:

     1. SAYING THE WORD IS OPTIONAL. Listen-and-repeat still works as
        before. The button is an offer, not a gate.
     2. ONLY ATTEMPTED WORDS COUNT. Skipping is not a wrong answer,
        and a session where nothing was attempted stays unscored, so
        it cannot drag a student's average down.
     3. MARKED GENEROUSLY. An exact match, a match after stripping
        articles, or an edit distance within a quarter of the word's
        length all count as correct - the point is whether the word
        was recognisable, not whether the recogniser was perfect.

   Unsupported browsers (Safari, Firefox) never see the button.
   ============================================================ */

var pronSR = null;             // the live recognition object
var pronDetails = [];          // { q, picked, correct, ok } per ATTEMPTED word
var pronAttempted = 0, pronCorrect = 0;

function pronSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function pronTrackReset() { pronDetails = []; pronAttempted = 0; pronCorrect = 0; }

// auth.js reads these when writing the session document.
window.getPronDetails = function () { return pronDetails.slice(0, 20); };
window.getPronStats = function () {
  return { attempted: pronAttempted, correct: pronCorrect };
};


function pronNormalise(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[^a-z\s]/g, '')                 // punctuation the recogniser adds
    .replace(/^(a|an|the|to)\s+/, '')          // "to abandon" for "abandon"
    .replace(/\s+/g, ' ').trim();
}

// British and American spellings of the SAME word. The recogniser is asked for
// en-US or en-GB, but it returns whichever spelling it likes, and the word
// lists are British. Each rule is deliberately narrow so it can only ever
// rewrite a suffix, never turn one vocabulary word into a different one.
function pronSpelling(s) {
  return s
    .replace(/([a-z]{3,})our\b/g, '$1or')          // colour, honour  (not "four")
    .replace(/([a-z]{2,})ise\b/g, '$1ize')         // realise, organise
    .replace(/([a-z]{2,})isation\b/g, '$1ization')
    .replace(/([tb])re\b/g, '$1er')                // centre, fibre
    .replace(/gement\b/g, 'gment')                 // acknowledgement, judgement
    .replace(/mme\b/g, 'm')                        // programme
    .replace(/([a-z])ll(ing|ed|er)\b/g, '$1l$2');  // travelling, labelled
}

// Is what was heard a fair attempt at the target?
//
// NO FUZZY DISTANCE. It used to allow an edit or two, and that accepted
// "ship" for "chip" and "through" for "thorough" - the exact minimal pairs a
// pronunciation exercise exists to teach. Worse, an edit-distance match cannot
// tell "the learner said a different word" from "the recogniser misheard", so
// it was guessing on the one question that matters.
//
// Recogniser noise is absorbed a different way instead: the caller asks for
// FIVE alternatives and accepts any of them, punctuation and articles are
// stripped, a word found inside a returned phrase counts, and British and
// American spellings of the same word are folded together. What is left has to
// be the word.
function pronMatches(heard, target) {
  var h = pronNormalise(heard), t = pronNormalise(target);
  if (!h || !t) return false;
  if (h === t) return true;
  // The recogniser often returns a phrase containing the word.
  if ((' ' + h + ' ').indexOf(' ' + t + ' ') !== -1) return true;
  var hs = pronSpelling(h), ts = pronSpelling(t);
  if (hs === ts) return true;
  return (' ' + hs + ' ').indexOf(' ' + ts + ' ') !== -1;
}
window.pronMatches = pronMatches;             // exposed for the test harness

function pronSetResult(html, cls) {
  var el = document.getElementById('pronCheckResult');
  if (!el) return;
  el.className = 'pron-check' + (cls ? ' ' + cls : '');
  el.innerHTML = html;
  el.style.display = html ? '' : 'none';
}

function pronRecord() {
  if (!pronSupported()) return;
  var btn = document.getElementById('pronMicBtn');
  var target = (currentWords[currentIndex] || {}).word || '';
  if (!target) return;

  // A second press while listening stops it, rather than stacking recognisers.
  if (pronSR) { try { pronSR.stop(); } catch (e) {} pronSR = null; if (btn) btn.textContent = '🎤 Say it'; return; }

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  pronSR = new SR();
  pronSR.lang = (selectedAccent === 'UK') ? 'en-GB' : 'en-US';
  pronSR.interimResults = false;
  pronSR.maxAlternatives = 5;      // the first guess is often not the kindest one

  if (btn) btn.textContent = '● Listening...';
  pronSetResult('Listening - say the word out loud.', '');

  /* THE CUE IS DEFERRED, ON PURPOSE.
     This is the one activity where the student's microphone is open, so a
     chime played the moment a result arrives can be picked up by the
     recogniser that is often still listening, and colour the next attempt.
     The verdict is remembered here and played in onend(), once the recogniser
     has actually stopped.
     Null means "no verdict": a blocked microphone, a silent room, or the
     student pressing stop. None of those are wrong answers and none make a
     sound. */
  var pendingCue = null;

  pronSR.onresult = function (ev) {
    var res = ev.results && ev.results[0];
    var heard = res && res[0] ? res[0].transcript : '';
    // ANY alternative counting as a match counts. The recogniser's top guess
    // is frequently wrong where its third is right, and the student should not
    // be marked down for the engine's ranking.
    var ok = false, alts = [];
    for (var i = 0; res && i < res.length; i++) {
      alts.push(res[i].transcript);
      if (pronMatches(res[i].transcript, target)) { ok = true; heard = res[i].transcript; break; }
    }
    pronAttempted++;
    if (ok) pronCorrect++;
    pendingCue = ok;          // played in onend, once the mic is closed
    if (pronDetails.length < 20) {
      pronDetails.push({
        q: target,
        picked: String(heard || '').trim(),
        correct: target,
        ok: ok
      });
    }
    pronSetResult(ok
      ? '✅ That sounded right - heard &ldquo;' + escapeHtmlPron(heard) + '&rdquo;'
      : '🔁 Heard &ldquo;' + escapeHtmlPron(heard || 'nothing') + '&rdquo;. Try once more, or press Play to hear it again.',
      ok ? 'ok' : 'retry');
  };
  pronSR.onerror = function (ev) {
    // A refused microphone or a quiet room is NOT a wrong answer - nothing is
    // recorded, so the word simply stays unattempted.
    var msg = (ev && ev.error === 'not-allowed')
      ? 'The microphone is blocked. You can still listen and repeat.'
      : (ev && ev.error === 'no-speech')
        ? 'I did not hear anything. Press the microphone and try again.'
        : 'The microphone is not available right now.';
    pronSetResult(msg, 'retry');
  };
  pronSR.onend = function () {
    pronSR = null;
    var b = document.getElementById('pronMicBtn');
    if (b) b.textContent = '🎤 Say it';
    // Now that the recogniser has stopped, the cue cannot feed back into it.
    if (pendingCue !== null && typeof playSound === 'function') {
      playSound(pendingCue ? 'correct' : 'incorrect');
    }
    pendingCue = null;
  };

  try { pronSR.start(); }
  catch (e) { pronSR = null; pronSetResult('Could not start the microphone.', 'retry'); }
}
window.pronRecord = pronRecord;

function escapeHtmlPron(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
