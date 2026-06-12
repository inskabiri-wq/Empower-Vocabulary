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
    console.log(`  ${index}: ${type} "${voice.name}" (${voice.lang}) — quality ${quality}`);
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
//   selected accent — so Edge users automatically get neural
//   voices, macOS/iOS users get Premium voices, and everyone
//   else still falls back gracefully.
// ============================================================
function scoreVoiceQuality(v) {
  if (!v || !v.name) return 0;
  const name = v.name.toLowerCase();
  let score = 0;

  // 🏆 Microsoft Edge neural cloud voices — best widely-available
  // free option. Typical name: "Microsoft Aria Online (Natural) -
  // English (United States)". The "(Natural)" tag is the giveaway.
  if (name.includes('online (natural)') || name.includes('natural)')) score += 100;
  else if (name.includes('online')) score += 70; // older "online" variants

  // 🍎 Apple Premium / Enhanced — macOS & iOS Safari ship these
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

  // 🍎 Apple system voices (no premium tag) — Samantha/Alex are
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

  // Slight bias against the platform default — it's almost always
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
  // automatically — see scoreVoiceQuality() for the ranking. Edge
  // users land on Microsoft "Online (Natural)" neural voices,
  // macOS/iOS users land on Apple Premium voices, everyone else
  // gets the best available. Never the robotic SAPI defaults if
  // anything better is in the list.
  const targetLang = selectedAccent === 'UK' ? 'en-GB' : 'en-US';
  const targetVoice = pickBestVoice(targetLang);

  if (targetVoice) {
    utter.voice = targetVoice;
    console.log(`🎙️ Voice: "${targetVoice.name}" (${targetVoice.lang}) — quality ${scoreVoiceQuality(targetVoice)}`);
  } else {
    console.warn('⚠️ No matching voice found — using browser default');
  }

  utter.lang = targetLang;
  // Slightly slower default helps comprehension for ESL learners.
  // Neural voices already have natural prosody, so we don't need to
  // slow them down as much; keep 0.9 as a reasonable middle ground.
  utter.rate = 0.9;
  utter.pitch = 1;

  // Chrome race: speechSynthesis.cancel() is async, and calling speak()
  // in the same tick sometimes discards the new utterance — user clicks
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

function nextPronunciation() { currentIndex++; loadPronunciation(); }
