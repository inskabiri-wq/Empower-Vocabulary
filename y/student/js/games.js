/* Student Dashboard - Game Activities */
/* Requires: inflection.js to be loaded first */

// ============================================
// HELPER: Normalize POS to base form
// "verb (past of "tell")" → "verb"
// "noun (plural)" → "noun"
// "adjective (comparative)" → "adjective"
// ============================================
function normalizePOS(pos) {
  if (!pos) return '';
  const lower = pos.toLowerCase().trim();
  // Extract the first word (base POS) before any parenthetical or extra info
  const match = lower.match(/^(noun|verb|adjective|adverb|preposition|pronoun|conjunction|determiner|phrase|exclamation|interjection)/);
  return match ? match[1] : lower;
}

// ============================================
// HELPER: Get article (a/an) for a word
// Only used when ALL options are nouns to avoid giveaways
// ============================================
function getArticle(word) {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';
}

// Returns true if all word objects in the array have noun POS
function allNouns(wordsArray) {
  return wordsArray.every(w => normalizePOS(w.pos) === 'noun');
}

// ============================================
// HELPER: Pick the correct article ("a" or "an") for a given word
// English articles use SOUND, not spelling, so the spelling rule
// ("vowel letter → an") fails on a small set of common words:
//   • Vowel LETTER but consonant SOUND → use "a"
//       university, unit, union, unique, uniform, user, useful,
//       usual, use, European, one, once, eulogy, eucalyptus, …
//   • Consonant LETTER but vowel SOUND → use "an"
//       hour, honest, honour/honor, heir, honourable/honorable, …
// Everything else falls back to the simple vowel-letter check.
// ============================================
const ARTICLE_OVERRIDES_AN = new Set([
  // Silent-h words — start with consonant letter but vowel sound
  'hour', 'hours', 'hourly',
  'honest', 'honesty', 'honestly',
  'honor', 'honors', 'honorable', 'honorary',
  'honour', 'honours', 'honourable',
  'heir', 'heirs', 'heiress', 'heirloom',
  'mri', 'fbi', 'rsvp', 'sql', 'xml', 'html'  // initialisms whose first letter sounds like a vowel
]);
const ARTICLE_OVERRIDES_A = new Set([
  // "yu-" sound — start with vowel letter but consonant sound
  'university', 'universities', 'universal', 'universe',
  'unit', 'units', 'unite', 'united', 'union', 'unions',
  'unique', 'uniform', 'uniforms',
  'user', 'users', 'used', 'use', 'useful', 'useless',
  'usual', 'usually',
  'european', 'europe',
  // "wu-" sound
  'one', 'once', 'onetime',
  // a few other oddballs
  'eulogy', 'eucalyptus', 'euro', 'euros'
]);

function pickArticleForWord(word) {
  const w = (word || '').trim().toLowerCase();
  if (!w) return 'a';
  // Take the first space-separated token in case the answer is a
  // phrase like "an order" — we want to article based on the first
  // sound, not the whole phrase.
  const head = w.split(/\s+/)[0].replace(/[^a-z']/g, '');
  if (ARTICLE_OVERRIDES_AN.has(head)) return 'an';
  if (ARTICLE_OVERRIDES_A.has(head))  return 'a';
  return /^[aeiou]/.test(head) ? 'an' : 'a';
}

// ============================================
// HELPER: Resolve the "a / an" giveaway placeholder
// During the question phase, loadFillBlank / loadReverse rewrite
// any visible "a" or "an" before the blank into a `.art-aan`
// placeholder showing "a / an" — see those functions for the
// reasoning. On answer reveal, we resolve the placeholder to the
// correct article based on the answer's actual first sound, so the
// final sentence reads naturally:
//   "I'd like to place a / an _____ for two pizzas."
//                ↓ student picks "order"
//   "I'd like to place an order for two pizzas."
// data-cap="1" preserves sentence-initial capitalisation.
// ============================================
function resolveArtAanPlaceholder(rootSelector, answerWord) {
  const placeholders = document.querySelectorAll(rootSelector + ' .art-aan');
  if (!placeholders.length) return;
  const article = pickArticleForWord(answerWord);
  placeholders.forEach(el => {
    const cap = el.dataset.cap === '1';
    el.textContent = cap ? article.charAt(0).toUpperCase() + article.slice(1) : article;
    // Drop the marker class so subsequent renders don't see a stale
    // placeholder; the next loadFillBlank/loadReverse rebuilds the
    // sentence from scratch anyway.
    el.classList.remove('art-aan');
  });
}

// ============================================
// HELPER: Run a regex over `text` and build a safe HTML string by
// HTML-escaping everything OUTSIDE each match and delegating what to emit
// for each match to `matchFn(matchArray) → htmlString`.
//
// Why not just `escapeHtml(text).replace(regex, …)`? Because the dataset
// contains apostrophes in target words ("can't afford", "shouldn't") and
// pre-escaping turns ' into &#39;, which the word-pattern regex (built by
// buildWordPattern) would no longer match. This helper leaves the matcher
// operating on raw text and only escapes the surrounding slices.
//
// The matchFn is responsible for escaping any dynamic content it emits.
// Anything it returns is inserted verbatim (it's expected to be HTML).
// ============================================
function escapeAroundMatches(text, regex, matchFn) {
  const g = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');
  g.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = g.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, m.index));
    result += matchFn(m);
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) g.lastIndex++; // avoid zero-width infinite loop
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

// ============================================
// SYNONYM BLOCKLIST (Phase 1)
// Two layers prevent synonym distractors from making MC questions unfair
// (e.g. "delete" appearing with "remove" as an option):
//
//   1. SYNONYM_PAIRS — hardcoded pairs the def-overlap audit caught and
//      I (admin) approved. Bidirectional. Currently empower-only.
//
//   2. looksLikeSynonym() — runtime def-keyword overlap heuristic.
//      Catches anything else that scores ≥ 4 shared content words AND
//      ≥ 60% of the smaller def's keyword set.
//
//   3. Teacher-flagged pairs from settings/confusingPairs in Firestore
//      (loaded by loadConfusingPairs()). Teachers can flag pairs they
//      see causing confusion; both this list and the picker read it.
//
// Filter is applied before distractors are added to the wrongWords
// pool. If the filter shrinks the pool below the requested option count
// (rare), the picker falls back to a relaxed filter to guarantee the
// question is answerable.
// ============================================
const SYNONYM_PAIRS = [
  // Reviewed by admin from def-overlap audit (empower book only):
  ['take a rest', 'take a break'],
  ['college', 'university'],
  ['spring', 'fall'],
  ['spring', 'autumn'],
  ['fall', 'autumn'],
  ['jumper', 'top'],
  ['band', 'orchestra'],
  ['took off', 'take off'],
  ['exercise', 'workout'],
  ['waiter', 'menu'],
  ['volleyball', 'tennis'],
  ['island', 'lake'],
  ['shirt', 'jumper'],
  ['shirt', 'top'],
  ['scuba diver', 'scubadiving'],
  ['scuba diver', 'scuba diving'],
  ['scarf', 'belt'],
  ['scarf', 'tie'],
  // Manually-flagged synonyms where the dictionary definitions are
  // written with completely different words (zero keyword overlap), so
  // the runtime def-similarity heuristic can't catch them. Teachers
  // reported these were appearing as distractors of each other.
  ['goal', 'aim'],
  ['discount', 'sale'],
  ['reduce', 'decrease'],
  ['anxious', 'nervous'],
  ['delete', 'remove']
];

// Build a fast lookup map: word.toLowerCase() → Set of words it conflicts with.
const SYNONYM_LOOKUP = (() => {
  const m = new Map();
  for (const [a, b] of SYNONYM_PAIRS) {
    const la = String(a).toLowerCase(), lb = String(b).toLowerCase();
    if (!m.has(la)) m.set(la, new Set());
    if (!m.has(lb)) m.set(lb, new Set());
    m.get(la).add(lb);
    m.get(lb).add(la);
  }
  return m;
})();

// Teacher-flagged pairs, loaded once at module init. Same Map shape.
let TEACHER_FLAGGED_LOOKUP = new Map();
async function loadConfusingPairs() {
  if (typeof db === 'undefined' || !db.collection) return;
  try {
    const doc = await db.collection('settings').doc('confusingPairs').get();
    if (!doc.exists) return;
    const pairs = doc.data().pairs || [];
    const m = new Map();
    for (const p of pairs) {
      if (!p || !p.a || !p.b) continue;
      const la = String(p.a).toLowerCase(), lb = String(p.b).toLowerCase();
      if (!m.has(la)) m.set(la, new Set());
      if (!m.has(lb)) m.set(lb, new Set());
      m.get(la).add(lb);
      m.get(lb).add(la);
    }
    TEACHER_FLAGGED_LOOKUP = m;
    console.log(`Loaded ${pairs.length} teacher-flagged confusing pairs`);
  } catch (e) {
    console.warn('Failed to load teacher-flagged pairs:', e);
  }
}
// Fire-and-forget; the picker handles an empty lookup gracefully.
if (typeof db !== 'undefined') {
  loadConfusingPairs();
}
window.loadConfusingPairs = loadConfusingPairs;

// Runtime def-overlap heuristic — catches synonyms not in the hardcoded list.
const SYN_STOPWORDS_RT = new Set([
  'a','an','the','to','of','in','is','it','on','at','or','and','for',
  'that','this','with','you','not','no','be','as','by','from','are','was','do','if','can','has',
  'have','will','about','very','used','say','make','when','than','more','some','its','into',
  'someone','something','being','done','very','small','large','great','take','way','out',
  'us','your','their','our','his','her','them','they','we','i','me','my','having','make','made',
  'doing','feels','feeling','place','time','where','who','what','which','any','one','two','three',
  'good','bad','new','old','people','person'
]);
function _defKeysRT(def) {
  return (def || '').toLowerCase().split(/\W+/)
    .filter(w => w.length > 2 && !SYN_STOPWORDS_RT.has(w));
}
function looksLikeSynonym(targetObj, candidateObj) {
  if (!targetObj || !candidateObj || !targetObj.def || !candidateObj.def) return false;
  const a = new Set(_defKeysRT(targetObj.def));
  const b = _defKeysRT(candidateObj.def);
  if (a.size === 0 || b.length === 0) return false;
  let overlap = 0;
  for (const w of b) if (a.has(w)) overlap++;
  const smaller = Math.min(a.size, b.length);
  return overlap >= 4 && (overlap / smaller) >= 0.6;
}
// Unified: is `candidate` an unfair synonym distractor for `target`?
function isLikelySynonym(targetObj, candidateObj) {
  if (!targetObj || !candidateObj) return false;
  const tw = String(targetObj.word || '').toLowerCase();
  const cw = String(candidateObj.word || '').toLowerCase();
  // 1. Hardcoded list
  const hard = SYNONYM_LOOKUP.get(tw);
  if (hard && hard.has(cw)) return true;
  // 2. Teacher-flagged
  const teacher = TEACHER_FLAGGED_LOOKUP.get(tw);
  if (teacher && teacher.has(cw)) return true;
  // 3. Runtime def-overlap heuristic
  return looksLikeSynonym(targetObj, candidateObj);
}

// ============================================
// HELPER: Generate Multiple Choice Options
// Fallback chain:
//   1. Same unit + same subcategory
//   2. Same unit + same category (subcategory prefix)
//   3. Previous units (same level) + same subcategory
//   4. Previous units (same level) + same category
//   5. Previous level(s) + same subcategory  ← handles Unit 1
//   6. Previous level(s) + same category
//   7. Same level + same POS (any unit/subcategory)
//   8. Any word from current level
//
// At each step, candidates that look like a synonym of the target word
// (per isLikelySynonym above) are dropped from the pool. If the final
// pool ends up shorter than optionCount, a fallback pass runs without
// the synonym filter so the user always gets a complete question.
// ============================================
function generateMultipleChoiceOptions(correctWord, optionCount = 3, forFillBlank = false) {
  const curPOS      = normalizePOS(correctWord.pos);
  const curSubcat   = (correctWord.subcategory || '').toLowerCase().trim();
  const curUnit     = correctWord.unit || '';
  const curLevel    = correctWord.level || selectedLevel;
  const curUnitNum  = parseInt(curUnit.replace(/\D/g, '')) || 0;

  // Category = first two words of subcategory, e.g. "verb phrase" from "verb phrase get"
  const curCategory = curSubcat.split(' ').slice(0, 2).join(' ');

  const levelOrder  = ['A2', 'B1', 'B1+', 'B2'];
  const curLevelIdx = levelOrder.indexOf(curLevel);

  // For Fill in Blank: match word count so single words get single-word distractors,
  // phrases get phrase distractors (avoids "change" vs "board a train" giveaway)
  const correctWC = correctWord.word.trim().split(/\s+/).length;
  const matchesWC = w => w.word.trim().split(/\s+/).length === correctWC;

  // First-word preference: when the correct answer starts with an auxiliary-like
  // word ("be", "have", "get"...) the sentence inflects that first word (e.g.
  // "be on sale" → "are on sale"). Distractors that share the same first word
  // inflect cleanly ("be in stock" → "are in stock"); distractors starting with
  // a regular verb get mangled by the inflector. Prefer same-first-word matches
  // so the mangling case is rare.
  const correctFirstWord = correctWord.word.trim().split(/\s+/)[0].toLowerCase();
  const matchesFirstWord = w => w.word.trim().split(/\s+/)[0].toLowerCase() === correctFirstWord;

  // Definition-keyword similarity: extract meaningful words from the definition
  // to find semantically related distractors (helps when subcategories are too broad)
  const stopWords = new Set(['a','an','the','to','of','in','is','it','on','at','or','and','for',
    'that','this','with','you','not','be','as','by','from','are','was','do','if','can','has',
    'have','will','about','very','used','say','make','when','than','more','some','its','into']);
  const defKeywords = (correctWord.def || '').toLowerCase().split(/\W+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  const defKeywordSet = new Set(defKeywords);
  // Score how many definition keywords a word shares (0 = no overlap, higher = more similar)
  const defSimilarity = w => {
    const wKeys = (w.def || '').toLowerCase().split(/\W+/).filter(k => k.length > 2);
    return wKeys.filter(k => defKeywordSet.has(k)).length;
  };

  let wrongWords = [];
  // When true the synonym filter is bypassed — used by the fallback pass
  // when the strict filter shrunk the pool below `optionCount`.
  let relaxSynonymFilter = false;

  // Prevent near-duplicate distractors (e.g. "exercise" and "exercises")
  const notUsed      = w => {
    if (w.word === correctWord.word) return false;
    const wLower = w.word.toLowerCase();
    return !wrongWords.some(x => {
      const xLower = x.word.toLowerCase();
      return xLower === wLower || wLower.startsWith(xLower) || xLower.startsWith(wLower);
    });
  };
  // Drop synonyms of the correct word from the pool. Skipped during the
  // relaxed fallback pass.
  const notSynonym = w => relaxSynonymFilter || !isLikelySynonym(correctWord, w);
  const matchesPOS   = w => !curPOS    || normalizePOS(w.pos) === curPOS;
  const matchesSubcat = w => curSubcat && (w.subcategory || '').toLowerCase().trim() === curSubcat;
  const matchesCat   = w => curCategory && (w.subcategory || '').toLowerCase().trim().startsWith(curCategory);
  const unitNumOf    = w => parseInt((w.unit || '').replace(/\D/g, '')) || 0;
  const fromLevel    = lvl => datasets[lvl] || [];

  // Smart add: for Fill in Blank, prefer word-count matches and sort by definition similarity
  const add = (pool) => {
    let filtered = pool.filter(w => notUsed(w) && notSynonym(w));
    if (forFillBlank) {
      // Sort by:
      //   1) first-word match (inflects cleanly through inflectDistractorToMatchForm),
      //   2) word-count match (keeps button widths visually consistent),
      //   3) definition similarity (semantic plausibility),
      //   4) random tiebreaker.
      filtered.sort((a, b) => {
        const aFW = matchesFirstWord(a) ? 1 : 0;
        const bFW = matchesFirstWord(b) ? 1 : 0;
        if (aFW !== bFW) return bFW - aFW;
        const aWC = matchesWC(a) ? 1 : 0;
        const bWC = matchesWC(b) ? 1 : 0;
        if (aWC !== bWC) return bWC - aWC;
        const aSim = defSimilarity(a);
        const bSim = defSimilarity(b);
        if (aSim !== bSim) return bSim - aSim;
        return Math.random() - 0.5;
      });
    } else {
      filtered.sort(() => Math.random() - 0.5);
    }
    wrongWords.push(...filtered);
  };

  // Step 1: Same unit, same subcategory
  if (wrongWords.length < optionCount && curSubcat)
    add(fromLevel(curLevel).filter(w => w.unit === curUnit && matchesPOS(w) && matchesSubcat(w)));

  // Step 2: Same unit, same category (broader)
  if (wrongWords.length < optionCount && curCategory)
    add(fromLevel(curLevel).filter(w => w.unit === curUnit && matchesPOS(w) && matchesCat(w)));

  // Step 3: Previous units of same level, same subcategory
  if (wrongWords.length < optionCount && curSubcat)
    add(fromLevel(curLevel).filter(w => unitNumOf(w) < curUnitNum && matchesPOS(w) && matchesSubcat(w)));

  // Step 4: Previous units of same level, same category
  if (wrongWords.length < optionCount && curCategory)
    add(fromLevel(curLevel).filter(w => unitNumOf(w) < curUnitNum && matchesPOS(w) && matchesCat(w)));

  // Steps 5 & 6: Walk back through previous levels (handles Unit 1 with no previous units)
  for (let i = curLevelIdx - 1; i >= 0 && wrongWords.length < optionCount; i--) {
    const prevLevel = levelOrder[i];
    // Same subcategory first
    if (wrongWords.length < optionCount && curSubcat)
      add(fromLevel(prevLevel).filter(w => matchesPOS(w) && matchesSubcat(w)));
    // Then same category
    if (wrongWords.length < optionCount && curCategory)
      add(fromLevel(prevLevel).filter(w => matchesPOS(w) && matchesCat(w)));
  }

  // Step 7: Same level, same POS (any unit, any subcategory)
  if (wrongWords.length < optionCount)
    add(fromLevel(curLevel).filter(w => matchesPOS(w)));

  // Step 8: Any word from current level
  if (wrongWords.length < optionCount)
    add(fromLevel(curLevel));

  // Synonym-filter relaxation pass — if the synonym filter shrank the
  // pool too aggressively (rare; happens when nearly every same-level
  // same-POS word is flagged), drop the filter and run Step 7 + 8 again
  // so the user always gets a complete set of options. This is a
  // guaranteed-result fallback; the synonym-free candidates picked
  // earlier are kept and only padded out at the end.
  if (wrongWords.length < optionCount) {
    relaxSynonymFilter = true;
    add(fromLevel(curLevel).filter(w => matchesPOS(w)));
    if (wrongWords.length < optionCount) add(fromLevel(curLevel));
    relaxSynonymFilter = false;
  }

  // Fill-in-blank: ensure word-count consistency to avoid giveaways
  // If the correct answer is multi-word (e.g. "good at") but all distractors are
  // single-word, swap in word-count-matching alternatives from the broader pool
  if (forFillBlank && correctWC > 1) {
    const selected = wrongWords.slice(0, optionCount);
    const hasWCMatch = selected.some(matchesWC);
    if (!hasWCMatch) {
      // Gather all same-POS words across current + adjacent levels that match word count
      const allLevels = levelOrder.slice(Math.max(0, curLevelIdx - 1), curLevelIdx + 2);
      const wcPool = allLevels.flatMap(lv => fromLevel(lv))
        .filter(w => notUsed(w) && matchesPOS(w) && matchesWC(w))
        .sort(() => Math.random() - 0.5);
      // Replace as many single-word distractors as possible with word-count matches
      for (let i = 0; i < Math.min(optionCount, selected.length) && wcPool.length > 0; i++) {
        if (!matchesWC(selected[i])) {
          selected[i] = wcPool.shift();
        }
      }
      return selected;
    }
  }

  return wrongWords.slice(0, optionCount);
}

// ============================================
// START ACTIVITY
// ============================================
async function startActivity(activity) {
  // Dataset-load gate: if the user taps an activity before the JSON has
  // arrived (or while a book switch is mid-swap), the word pool will be
  // empty for reasons that have nothing to do with their filter. Tell
  // them it's a loading state, not an empty selection.
  if (typeof datasetsReady !== 'undefined' && !datasetsReady) {
    AppDialog.alert('📚 Still loading vocabulary — please try again in a moment.');
    return;
  }

  currentActivity = activity;
  const pool = getFilteredWords();

  // Empty-pool UX: differentiate "filter yields nothing" from "too few
  // words to make a reasonable activity." Both used to collapse into the
  // same "No words available" alert.
  if (pool.length === 0) {
    AppDialog.alert('🔍 No words match your current Book / Level / Unit selection.\n\nTry a different unit or level.');
    return;
  }

  // Match needs at least 5 pairs to form a batch; other activities need
  // at least a couple of words to run a meaningful session. Warn the
  // user instead of silently launching a 1-word game.
  const MIN_WORDS = activity === 'match' ? 5 : 3;
  if (pool.length < MIN_WORDS) {
    const proceed = await AppDialog.confirm(
      `"${activity}" works best with ${MIN_WORDS}+ words. Start anyway?`,
      { title: `Only ${pool.length} word${pool.length === 1 ? '' : 's'} match your filter`,
        okLabel: 'Start anyway', icon: '⚠️' }
    );
    if (!proceed) return;
  }

  currentWords = pool.sort(() => Math.random() - 0.5).slice(0, 10);
  currentIndex = 0;
  score = 0;
  sessionStreak = 0;
  missedWords = [];
  updateStreakDisplays();

  if (activity === 'match') initMatch();
  else if (activity === 'choice') initChoice();
  else if (activity === 'reverse') initReverse();
  else if (activity === 'spelling') initSpelling();
  else if (activity === 'fillblank') initFillBlank();
  else if (activity === 'order') initOrder();
  else if (activity === 'pronunciation') initPronunciation();
  else if (activity === 'unscramble') initUnscramble();
}

// ============================================
// MATCH GAME
// ============================================
function initMatch() {
  selectedItems = [];
  matchBatchStart = 0;
  matchedInBatch = 0;
  score = 0;
  loadMatchBatch();
  showScreen('matchScreen');
}

function loadMatchBatch() {
  selectedItems = [];
  matchedInBatch = 0;
  
  const batchSize = 5;
  
  // Start with remaining words
  const remainingWords = currentWords.slice(matchBatchStart, matchBatchStart + batchSize);
  
  if (remainingWords.length === 0) {
    showCompletion();
    return;
  }
  
  // Use remaining words for this batch
  const batch = remainingWords;
  
  const words = batch.map(w => ({ type: 'word', text: w.word, id: w.word, tr: w.tr }));
  const defs = batch.map(w => ({ type: 'def', text: w.def, id: w.word }));
  
  const shuffledWords = words.sort(() => Math.random() - 0.5);
  const shuffledDefs = defs.sort(() => Math.random() - 0.5);
  
  const container = document.getElementById('matchContainer');
  // All dataset-sourced fields (w.id, w.text, w.tr, d.id, d.text) are HTML-escaped
  // so that rogue HTML in a dataset entry can't execute. Downstream code reads
  // el.dataset.id / el.textContent, both of which auto-decode entities, so
  // comparisons against the raw word strings still match.
  container.innerHTML = `
    <div class="match-column">${shuffledWords.map(w =>
      `<div class="match-item" data-type="word" data-id="${escapeHtml(w.id)}" onclick="selectMatchItem(this)">
        ${escapeHtml(w.text)}
        ${turkishEnabled && selectedLevel === 'A2' && w.tr ? `<div class="item-turkish visible">${escapeHtml(w.tr)}</div>` : ''}
      </div>`
    ).join('')}</div>
    <div class="match-column">${shuffledDefs.map(d =>
      `<div class="match-item" data-type="def" data-id="${escapeHtml(d.id)}" onclick="selectMatchItem(this)">${escapeHtml(d.text)}</div>`
    ).join('')}</div>
  `;
  
  document.getElementById('matchScore').textContent = score;
  document.getElementById('matchTotal').textContent = currentWords.length;
  document.getElementById('matchNextRound').style.display = 'none';
  setProgress('matchProgress', score, currentWords.length);
}

function selectMatchItem(el) {
  if (el.classList.contains('correct')) return;
  
  const type = el.dataset.type;
  const existing = selectedItems.find(i => i.type === type);
  if (existing) existing.el.classList.remove('selected');
  
  selectedItems = selectedItems.filter(i => i.type !== type);
  el.classList.add('selected');
  selectedItems.push({ type, id: el.dataset.id, el });
  
  if (selectedItems.length === 2) {
    const [a, b] = selectedItems;
    if (a.id === b.id) {
      a.el.classList.add('correct');
      b.el.classList.add('correct');
      score++;
      matchedInBatch++;
      updateStreak(true);
      playSound('correct');
      document.getElementById('matchScore').textContent = score;
      setProgress('matchProgress', score, currentWords.length);
      
      if (score === currentWords.length) {
        setTimeout(showCompletion, 500);
      } 
      else {
        const batchSize = 5;
        const currentBatchSize = Math.min(batchSize, currentWords.length - matchBatchStart);
        if (matchedInBatch === currentBatchSize) {
          document.getElementById('matchNextRound').style.display = 'inline-block';
        }
      }
    } else {
      a.el.classList.add('incorrect');
      b.el.classList.add('incorrect');
      updateStreak(false);
      playSound('incorrect');
      setTimeout(() => {
        a.el.classList.remove('incorrect', 'selected');
        b.el.classList.remove('incorrect', 'selected');
      }, 600);
    }
    selectedItems = [];
  }
}

function nextMatchRound() {
  matchBatchStart += 5;
  loadMatchBatch();
}

// ============================================
// CHOICE GAME
// ============================================
function initChoice() {
  loadChoice();
  showScreen('choiceScreen');
}

function loadChoice() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  
  // Use smart pattern detection to highlight word in sentence
  const pattern = buildWordPattern(cur);
  const regex = new RegExp(pattern, 'gi');

  // Determine if we can safely show a/an (only when cur + all distractors are nouns)
  const distractorWords = generateMultipleChoiceOptions(cur, 3);
  const showArticle = normalizePOS(cur.pos) === 'noun' && allNouns(distractorWords);
  const article = showArticle ? getArticle(cur.word) : null;

  // Replace article before target word with "a/an" marker if applicable, then highlight word.
  // escapeAroundMatches escapes everything outside the regex hits; the wrap callbacks
  // escape the matched text before putting it back, so dataset content can't inject HTML.
  // `article` is always the literal 'a' or 'an' (from getArticle), so it's safe inline.
  let sentenceHTML;
  if (article) {
    const articleRegex = new RegExp('\\b(a|an)\\s+(' + pattern + ')', 'gi');
    if (articleRegex.test(cur.ex)) {
      sentenceHTML = escapeAroundMatches(cur.ex, articleRegex, (m) =>
        `<span class="article-hint">${article}</span> <span class="target-word">${escapeHtml(m[2])}</span>`
      );
    } else {
      sentenceHTML = escapeAroundMatches(cur.ex, regex, (m) =>
        `<span class="target-word">${escapeHtml(m[0])}</span>`
      );
    }
  } else {
    sentenceHTML = escapeAroundMatches(cur.ex, regex, (m) =>
      `<span class="target-word">${escapeHtml(m[0])}</span>`
    );
  }

  document.getElementById('choiceSentence').innerHTML = sentenceHTML;
  document.getElementById('choicePOS').textContent = cur.pos || '';
  
  const trEl = document.getElementById('choiceTR');
  if (turkishEnabled && selectedLevel === 'A2' && cur.tr) {
    trEl.textContent = `🇹🇷 ${cur.tr}`;
    trEl.classList.add('visible');
  } else {
    trEl.classList.remove('visible');
    trEl.textContent = '';
  }
  
  // CHECK OVERRIDES FIRST (case-insensitive — override keys are normalized
  // to lowercase at load time in config.js, so we lowercase the lookup too).
  let otherDefs;
  const overrideKey = cur.word ? String(cur.word).toLowerCase() : null;
  if (multipleChoiceOverrides && overrideKey && multipleChoiceOverrides[overrideKey]) {
    // Use hand-curated options
    otherDefs = multipleChoiceOverrides[overrideKey];
    console.log(`📌 Using override for "${cur.word}"`);
  } else {
    // Reuse already-generated distractorWords from article check above
    otherDefs = distractorWords.map(w => w.def);
  }
  
  const options = [cur.def, ...otherDefs].sort(() => Math.random() - 0.5);
  
  document.getElementById('choiceContainer').innerHTML = options.map((o, i) =>
    `<button class="choice-btn" data-value="${escapeHtml(o)}" data-correct="${escapeHtml(cur.def)}">
      ${escapeHtml(o)}
      <span class="key-hint">${i + 1}</span>
    </button>`
  ).join('');
  document.querySelectorAll('#choiceContainer .choice-btn').forEach(btn => {
    btn.addEventListener('click', function() { checkChoice(this, this.dataset.value, this.dataset.correct); });
  });
  
  document.getElementById('choiceScore').textContent = score;
  document.getElementById('choiceTotal').textContent = currentWords.length;
  document.getElementById('choiceNext').style.display = 'none';
  setProgress('choiceProgress', currentIndex, currentWords.length);
}

function checkChoice(btn, selected, correct) {
  const isCorrect = selected === correct;
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
  
  if (isCorrect) {
    btn.classList.add('correct');
    score++;
    updateStreak(true);
    playSound('correct');
  } else {
    btn.classList.add('incorrect');
    updateStreak(false);
    playSound('incorrect');
    missedWords.push(currentWords[currentIndex]);
    document.querySelectorAll('.choice-btn').forEach(b => {
      if (b.dataset.value === correct) b.classList.add('correct');
    });
  }

  document.getElementById('choiceScore').textContent = score;
  document.getElementById('choiceNext').style.display = 'inline-block';
  showFeedback(isCorrect);
}

function nextChoice() {
  currentIndex++;
  loadChoice();
}

// ============================================
// REVERSE GAME
// ============================================
function initReverse() {
  loadReverse();
  showScreen('reverseScreen');
}

function loadReverse() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  document.getElementById('reverseDef').textContent = cur.def;

  // Use smart pattern to create blank and detect inflected form
  const pattern = buildWordPattern(cur);
  const regex = new RegExp(pattern, 'gi');
  const matchedForm = findWordInSentence(cur);
  cur._matchedForm = matchedForm;

  // escapeAroundMatches keeps the regex operating on the raw sentence (so words
  // with apostrophes like "can't afford" still match) but HTML-escapes everything
  // outside the match. selectiveBlanks now escapes its own interior slices too,
  // so the final innerHTML has no unescaped dataset content.
  let reverseSentence = escapeAroundMatches(cur.ex, regex, (m) => {
    const match = m[0];
    const phraseWordCount = cur.word.trim().split(/\s+/).length;
    const matchWordCount = match.trim().split(/\s+/).length;
    if (matchWordCount > phraseWordCount) {
      return selectiveBlanks(match, cur.word, '<span class="blank-word"></span>');
    }
    return '<span class="blank-word"></span>';
  });
  // Same article giveaway fix as Fill in Blank — see loadFillBlank().
  // Wraps the notation in `.art-aan` so checkReverse can resolve it
  // back to the correct "a" or "an" once the answer is revealed.
  reverseSentence = reverseSentence.replace(
    /\b(a|an)(\s+<span class="blank-word"><\/span>)/gi,
    (_, art, rest) => {
      const cap = /^[A-Z]/.test(art) ? 'A / an' : 'a / an';
      return `<span class="art-aan" data-cap="${/^[A-Z]/.test(art) ? '1' : '0'}">${cap}</span>${rest}`;
    }
  );
  document.getElementById('reverseSentence').innerHTML = reverseSentence;

  setTimeout(() => speak(cur.def), 300);

  // Listening shows WORDS as options — always use auto-generated word distractors
  // Use forFillBlank=true so word-count matching applies (single words get single-word options)
  const otherWords = generateMultipleChoiceOptions(cur, 3, true);

  // Detect loose vs inflected match (same logic as fillblank)
  const matchedWordCount = (cur._matchedForm || '').trim().split(/\s+/).length;
  const phraseWordCount  = cur.word.trim().split(/\s+/).length;
  const isLooseMatch = matchedWordCount > phraseWordCount;

  // Inflect distractors to match the sentence form
  const otherWordsText = otherWords.map(w =>
    isLooseMatch ? w.word : inflectDistractorToMatchForm(w.word, cur.word, cur._matchedForm, w.pos)
  );

  // Show inflected form as the correct option (e.g. "included" not "include")
  const correctOption = (!isLooseMatch && cur._matchedForm) || cur.word;
  const options = [correctOption, ...otherWordsText].sort(() => Math.random() - 0.5);

  document.getElementById('reverseContainer').innerHTML = options.map((o, i) =>
    `<button class="choice-btn" data-value="${escapeHtml(o)}" data-correct="${escapeHtml(correctOption)}">
      ${escapeHtml(o)}
      <span class="key-hint">${i + 1}</span>
    </button>`
  ).join('');
  document.querySelectorAll('#reverseContainer .choice-btn').forEach(btn => {
    btn.addEventListener('click', function() { checkReverse(this, this.dataset.value, this.dataset.correct); });
  });

  document.getElementById('reverseScore').textContent = score;
  document.getElementById('reverseTotal').textContent = currentWords.length;
  document.getElementById('reverseNext').style.display = 'none';
  setProgress('reverseProgress', currentIndex, currentWords.length);
}

function checkReverse(btn, selected, correct) {
  const isCorrect = selected === correct;
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  // Fill the blank in the sentence with the correct word
  const blankEl = document.querySelector('#reverseSentence .blank-word');
  if (blankEl) {
    blankEl.textContent = correct;
    blankEl.style.color = isCorrect ? 'var(--success)' : 'var(--error)';
    blankEl.style.borderBottomColor = isCorrect ? 'var(--success)' : 'var(--error)';
  }
  // Resolve the "a / an" giveaway placeholder (if any) into the
  // correct article based on the revealed answer's first sound.
  resolveArtAanPlaceholder('#reverseSentence', correct);

  if (isCorrect) {
    btn.classList.add('correct');
    score++;
    updateStreak(true);
    playSound('correct');
    speak(correct);
  } else {
    btn.classList.add('incorrect');
    updateStreak(false);
    playSound('incorrect');
    missedWords.push(currentWords[currentIndex]);
    document.querySelectorAll('.choice-btn').forEach(b => {
      if (b.dataset.value === correct) b.classList.add('correct');
    });
  }

  document.getElementById('reverseScore').textContent = score;
  document.getElementById('reverseNext').style.display = 'inline-block';
  showFeedback(isCorrect);
}

function nextReverse() {
  currentIndex++;
  loadReverse();
}

// ============================================
// SPELLING GAME
// ============================================
function initSpelling() {
  hintsUsed = 0;
  loadSpelling();
  showScreen('spellingScreen');
}

function loadSpelling() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  document.getElementById('spellingDef').textContent = cur.def;
  document.getElementById('spellingPOS').textContent = cur.pos || '';
  
  const trEl = document.getElementById('spellingTR');
  if (turkishEnabled && selectedLevel === 'A2' && cur.tr) {
    trEl.textContent = `🇹🇷 ${cur.tr}`;
    trEl.classList.add('visible');
  } else {
    trEl.classList.remove('visible');
    trEl.textContent = '';
  }
  
  hintsUsed = 0;
  document.getElementById('spellingHint').textContent = '_ '.repeat(cur.word.trim().length);
  document.getElementById('spellingInput').value = '';
  document.getElementById('spellingInput').classList.remove('correct', 'incorrect');
  document.getElementById('spellingInput').disabled = false;
  document.getElementById('spellingInput').focus();
  document.getElementById('spellingFeedback').style.display = 'none';
  document.getElementById('spellingCheck').style.display = 'inline-block';
  document.getElementById('spellingNext').style.display = 'none';
  document.getElementById('spellingHintBtn').disabled = false;
  document.getElementById('spellingPlayBtn').disabled = false;
  
  document.getElementById('spellingScore').textContent = score;
  document.getElementById('spellingTotal').textContent = currentWords.length;
  setProgress('spellingProgress', currentIndex, currentWords.length);
}

function showSpellingHint() {
  const cur = currentWords[currentIndex];
  const word = cur.word.trim();
  hintsUsed++;

  let hint = '';
  for (let i = 0; i < word.length; i++) {
    if (i < hintsUsed || word[i] === ' ') {
      hint += word[i] + ' ';
    } else {
      hint += '_ ';
    }
  }
  document.getElementById('spellingHint').textContent = hint;

  if (hintsUsed >= word.length) {
    document.getElementById('spellingHintBtn').disabled = true;
  }
}

function speakSpellingWord() {
  const cur = currentWords[currentIndex];
  speak(cur.word);
}

function checkSpelling() {
  const cur = currentWords[currentIndex];
  const input = document.getElementById('spellingInput');
  const answer = input.value.trim().toLowerCase();
  const correct = cur.word.toLowerCase();
  
  input.disabled = true;
  document.getElementById('spellingCheck').style.display = 'none';
  document.getElementById('spellingNext').style.display = 'inline-block';
  document.getElementById('spellingHintBtn').disabled = true;
  
  if (answer === correct) {
    input.classList.add('correct');
    score++;
    updateStreak(true);
    playSound('correct');
    speak(cur.word);
    showFeedback(true);
  } else {
    input.classList.add('incorrect');
    updateStreak(false);
    playSound('incorrect');
    missedWords.push(cur);
    document.getElementById('spellingFeedback').innerHTML = `Correct: <strong>${escapeHtml(cur.word)}</strong>`;
    document.getElementById('spellingFeedback').style.display = 'block';
    showFeedback(false);
  }
  
  document.getElementById('spellingScore').textContent = score;
}

function nextSpelling() {
  currentIndex++;
  loadSpelling();
}

// ============================================
// FILL IN THE BLANK GAME
// ============================================

/**
 * For loosely-matched phrases (e.g. "put into words" matched as "put my feelings into words"),
 * blank only the actual phrase words and leave intervening words visible.
 * e.g. "put my feelings into words" → "___ my feelings ___ ___"
 */
function selectiveBlanks(matchedText, phrase, blankHTML) {
  const phraseWords = phrase.trim().split(/\s+/);
  let remaining = matchedText;
  let result = '';
  for (const pw of phraseWords) {
    // Use word-boundary regex so "a" in "yoga" isn't matched instead of standalone "a"
    const wordRegex = new RegExp('\\b' + pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    const m = wordRegex.exec(remaining);
    if (!m) {
      // Fallback: couldn't find phrase word, blank the whole match
      return blankHTML;
    }
    const idx = m.index;
    // Tag each blank with its phrase word so checkFill can restore them individually.
    // The phrase-word is HTML-escaped so it can't break out of the attribute;
    // el.dataset.phraseWord decodes entities automatically on read.
    const taggedBlank = blankHTML.replace('>', ` data-phrase-word="${escapeHtml(pw)}">`);
    result += escapeHtml(remaining.slice(0, idx)) + taggedBlank;
    remaining = remaining.slice(idx + pw.length);
  }
  result += escapeHtml(remaining);
  return result;
}
/**
 * Inflect the first word of a distractor to match the grammatical form of the
 * correct answer as it appears in the sentence.
 * e.g. if correct appears as "speaking in public" (gerund), inflect distractors:
 *   "insist on" → "insisting on", "tell a joke" → "telling a joke"
 * Falls back to the original distractor word if the form can't be determined.
 *
 * distractorPOS is the POS field from the dataset entry (optional). Used to
 * avoid de-inflecting -ing adjectives/nouns like "outgoing", "amazing",
 * "interesting", "meeting", which are already in their base form even though
 * they end in -ing.
 */
function inflectDistractorToMatchForm(distractorWord, correctBase, correctMatched, distractorPOS) {
  const parts = distractorWord.trim().split(/\s+/);
  const distractorFirst = parts[0].toLowerCase();
  const correctFirst = correctBase.trim().split(/\s+/)[0].toLowerCase();

  // -ing words that are stored as adjectives/nouns in the dataset are already
  // in their base form. Don't try to derive a verb stem from them.
  const isNonVerbIng = distractorPOS && /\b(adjective|noun)\b/i.test(distractorPOS);

  if (!correctMatched || correctMatched.toLowerCase() === correctBase.toLowerCase()) {
    // No inflection in the sentence — but if the distractor is stored in gerund (-ing) form
    // while the correct answer is in base form, de-inflect to avoid a morphological giveaway
    // e.g. "getting older" stored as gerund vs answer "make a suggestion" in base form.
    // Skip this for -ing adjectives/nouns ("outgoing" is its own base, not a gerund of "outgo").
    if (distractorFirst.endsWith('ing') && !correctFirst.endsWith('ing') && !isNonVerbIng) {
      const base = getBaseFromIngForm(distractorFirst);
      if (base !== distractorFirst) {
        parts[0] = base;
        return parts.join(' ');
      }
    }
    return distractorWord;
  }

  const baseFirst   = correctFirst;
  const matchedFirst = correctMatched.trim().split(/\s+/)[0].toLowerCase();
  if (baseFirst === matchedFirst) return distractorWord;

  // Safety net: when the sentence's matched form is a be-verb (am/is/are/was/
  // were/been/being) but the distractor starts with a different, non-be verb,
  // there is no clean conjugation slot to copy across. The slot-matcher would
  // fall through to inconsistent guesses ("save life" → "saved life", "get a
  // refund" → "getting a refund"), which read as broken English. Leave the
  // distractor in its base form so at least the phrase stays grammatical on
  // its own — students still see the mismatch but not mangled tokens.
  const BE_FORMS = new Set(['be','am','is','are','was','were','been','being']);
  if (BE_FORMS.has(matchedFirst) && !BE_FORMS.has(distractorFirst)) {
    return distractorWord;
  }

  const distractorForms = getWordForms(parts[0].toLowerCase());
  let target = null;

  if (matchedFirst.endsWith('ing')) {
    // Gerund / present-participle — find the -ing form regardless of array position
    target = distractorForms.find(f => f.endsWith('ing'));
  } else if (matchedFirst !== baseFirst && matchedFirst.endsWith('s')) {
    // 3rd-person singular — always index 1
    target = distractorForms[1];
  } else {
    // Past tense or past participle.
    //
    // Finding #9 fix: we used to index IRREGULAR_VERBS positionally
    // (`distractorIrr[sameIdxAsCorrect]`), which broke whenever the
    // correct and distractor verbs had different array layouts — e.g.
    // past of 'take' sits at slot 2, but slot 2 of 'put' is 'putting'
    // (a gerund), so a past-tense correct answer rendered with a
    // gerund distractor. Now we classify the correct form's
    // grammatical slot (base/third/past/ppt/gerund) and look up the
    // distractor's equivalent slot by name, so the comparison is
    // always apples-to-apples.

    // 1) Correct word is irregular → resolve by slot name.
    const correctSlot = typeof classifyIrregularSlot === 'function'
      ? classifyIrregularSlot(baseFirst, matchedFirst)
      : null;

    if (correctSlot) {
      // Try to pull the distractor's same-slot form out of the keyed
      // map. If the distractor is in the keyed map, use whatever it
      // returns — even if that form equals the base (e.g. past of
      // 'put' is 'put'); it's the RIGHT answer for that verb, and
      // returning unchanged is handled by the base/same check at the
      // end of this function. Only fall through to morphology-based
      // derivation when the distractor isn't in the keyed map at all
      // (i.e. it's a regular verb).
      const slotTarget = typeof getIrregularSlot === 'function'
        ? getIrregularSlot(distractorFirst, correctSlot)
        : null;
      if (slotTarget) {
        target = slotTarget;
      } else if (correctSlot === 'gerund') {
        target = distractorForms.find(f => f.endsWith('ing'));
      } else if (correctSlot === 'past' || correctSlot === 'ppt') {
        target = distractorForms.find(f => f.endsWith('ed') && f !== distractorFirst);
      } else if (correctSlot === 'third') {
        target = distractorForms[1];
      }
    }

    // 2) Correct is a regular -ed past form: "included", "refused".
    //    The surface form doesn't live in the keyed map, but the
    //    distractor might be irregular, in which case we want its
    //    past slot (not a positional guess). Same rule as step 1:
    //    if the keyed lookup returns anything — including the base
    //    form itself (past of 'put' IS 'put') — use it. Only fall
    //    through to -ed derivation when the distractor is regular
    //    (i.e. not in the keyed map at all).
    if (!target && matchedFirst.endsWith('ed')) {
      const distIrrPast = typeof getIrregularSlot === 'function'
        ? getIrregularSlot(distractorFirst, 'past')
        : null;
      if (distIrrPast) {
        target = distIrrPast;
      } else {
        target = distractorForms.find(f => f.endsWith('ed') && f !== distractorFirst);
      }
    }

    // 3) Final fallback: align by position through the regular
    //    getWordForms arrays. Only fires when the correct form is
    //    neither slot-classifiable nor -ed — rare residual cases.
    if (!target) {
      const baseForms = getWordForms(baseFirst);
      const idx = baseForms.indexOf(matchedFirst);
      if (idx > 0 && idx < distractorForms.length) target = distractorForms[idx];
    }
  }

  if (target && target !== parts[0].toLowerCase()) {
    // Preserve the original distractor's capitalization pattern. The
    // inflected `target` is always lowercase (sourced from the keyed
    // map or getWordForms, both of which lowercase everything), but
    // the original word might be title-case ("Make a difference" as a
    // dataset entry) or upper-case ("MAKE A DIFFERENCE" from a
    // heading). Without this, "Made a difference" would render as
    // "made a difference" — minor but visibly sloppy.
    parts[0] = matchCase(parts[0], target);
    return parts.join(' ');
  }
  return distractorWord;
}

/**
 * Copy the capitalization shape of `original` onto `replacement`.
 * Handles three common patterns:
 *   - ALL UPPERCASE  → replacement uppercased
 *   - Title-cased    → replacement's first letter uppercased
 *   - anything else  → replacement left lowercase
 * Mixed-case oddities ("iPhone", "eBay") fall through to lowercase,
 * which is fine since those never appear as verb distractors.
 */
function matchCase(original, replacement) {
  if (!original || !replacement) return replacement;
  const first = original[0];
  // ALL UPPERCASE (at least 2 chars, fully uppercase)
  if (original.length > 1 && original === original.toUpperCase() &&
      original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  // Title case (first letter is an uppercase letter)
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return first + replacement.slice(1);
  }
  return replacement;
}

function initFillBlank() {
  loadFillBlank();
  showScreen('fillblankScreen');
}

function loadFillBlank() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  
  // Use smart pattern detection for creating blanks
  const pattern = buildWordPattern(cur);
  const regex = new RegExp(pattern, 'gi');

  // Find what was actually matched (for showing in feedback)
  const matchedForm = findWordInSentence(cur);
  cur._matchedForm = matchedForm; // Store for later use

  // Pass forFillBlank=true so single words get single-word distractors (not phrases)
  const fillDistractors = generateMultipleChoiceOptions(cur, 3, true);

  // Build sentence with blank.
  // escapeAroundMatches escapes non-matched text; selectiveBlanks escapes its own
  // interior. The literal "<span class=\"blank\">" inserts and the post-hoc a/an
  // rewrite regex operate on a string whose non-HTML parts are already escaped — the
  // article regex only looks for ASCII "a|an", which is unaffected by escaping.
  let sentence = escapeAroundMatches(cur.ex, regex, (m) => {
    const match = m[0];
    const phraseWordCount = cur.word.trim().split(/\s+/).length;
    const matchWordCount = match.trim().split(/\s+/).length;
    if (matchWordCount > phraseWordCount) {
      // Loose match: blank only the phrase words, leave intervening words visible
      return selectiveBlanks(match, cur.word, '<span class="blank"></span>');
    }
    return '<span class="blank"></span>';
  });

  // GIVEAWAY FIX: any visible "a" or "an" right before the blank
  // telegraphs whether the answer starts with a vowel or consonant
  // (e.g. "place an ___" → answer must start with a vowel → all
  // consonant-starting options can be eliminated by the sound rule
  // alone). Wrap the article in a `.art-aan` placeholder showing
  // "a / an" during the question phase; on answer reveal, checkFill
  // resolves it to the correct article based on the answer's first
  // sound. Case-preserving: "An ___" → "A / an ___" → "An apple ___".
  sentence = sentence.replace(
    /\b(a|an)(\s+<span class="blank"><\/span>)/gi,
    (_, art, rest) => {
      const cap = /^[A-Z]/.test(art) ? 'A / an' : 'a / an';
      return `<span class="art-aan" data-cap="${/^[A-Z]/.test(art) ? '1' : '0'}">${cap}</span>${rest}`;
    }
  );

  document.getElementById('fillSentence').innerHTML = sentence;
  document.getElementById('fillDef').textContent = cur.def;
  
  const trEl = document.getElementById('fillTR');
  if (turkishEnabled && selectedLevel === 'A2' && cur.tr) {
    trEl.textContent = `🇹🇷 ${cur.tr}`;
    trEl.classList.add('visible');
  } else {
    trEl.classList.remove('visible');
    trEl.textContent = '';
  }
  
  // Fill in Blank shows WORDS as options — always use auto-generated word distractors
  // (overrides are definition-based, only for Multiple Choice)
  // A "loose match" means the pattern picked up extra words between the phrase words
  // (e.g. "put my feelings into words" for phrase "put into words").
  // An "inflected match" has the same word count but a different form
  // (e.g. "speaking in public" for phrase "speak in public").
  const matchedWordCount = (cur._matchedForm || '').trim().split(/\s+/).length;
  const phraseWordCount  = cur.word.trim().split(/\s+/).length;
  const isLooseMatch = matchedWordCount > phraseWordCount;

  // Only inflate distractors when there's a real inflection, not a loose match
  const otherWordsText = fillDistractors.map(w =>
    isLooseMatch ? w.word : inflectDistractorToMatchForm(w.word, cur.word, cur._matchedForm, w.pos)
  );

  // Show the inflected form on the button only when it's a true inflection;
  // loose matches keep the base phrase as the answer label
  const correctOption = (!isLooseMatch && cur._matchedForm) || cur.word;
  const options = [correctOption, ...otherWordsText].sort(() => Math.random() - 0.5);

  document.getElementById('fillContainer').innerHTML = options.map((o, i) =>
    `<button class="choice-btn" data-value="${escapeHtml(o)}" data-correct="${escapeHtml(correctOption)}">
      ${escapeHtml(o)}
      <span class="key-hint">${i + 1}</span>
    </button>`
  ).join('');
  document.querySelectorAll('#fillContainer .choice-btn').forEach(btn => {
    btn.addEventListener('click', function() { checkFill(this, this.dataset.value, this.dataset.correct); });
  });

  document.getElementById('fillScore').textContent = score;
  document.getElementById('fillTotal').textContent = currentWords.length;
  document.getElementById('fillNext').style.display = 'none';
  setProgress('fillProgress', currentIndex, currentWords.length);
}

function checkFill(btn, selected, correct) {
  const isCorrect = selected === correct;
  const cur = currentWords[currentIndex];
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
  
  // Get the matched form to display in the blank
  const displayForm = cur._matchedForm || correct;

  // Fill all blank spans — selectiveBlanks may have created multiple tagged blanks
  const fillAllBlanks = (color) => {
    const blanks = document.querySelectorAll('.blank');
    if (blanks.length > 1) {
      // Multiple blanks: each has data-phrase-word set by selectiveBlanks
      blanks.forEach(b => {
        b.textContent = b.dataset.phraseWord || '';
        if (color) b.style.color = color;
      });
    } else if (blanks.length === 1) {
      blanks[0].textContent = displayForm;
      if (color) blanks[0].style.color = color;
    }
    // Resolve the "a / an" placeholder back to the correct article
    // now that the answer is visible. Picks "an" for vowel-starting
    // answers, "a" for consonant-starting ones.
    resolveArtAanPlaceholder('#fillSentence', displayForm);
  };

  if (isCorrect) {
    btn.classList.add('correct');
    score++;
    updateStreak(true);
    playSound('correct');
    fillAllBlanks('var(--success)');
  } else {
    btn.classList.add('incorrect');
    updateStreak(false);
    playSound('incorrect');
    missedWords.push(currentWords[currentIndex]);
    document.querySelectorAll('.choice-btn').forEach(b => {
      if (b.dataset.value === correct) b.classList.add('correct');
    });
    fillAllBlanks(null);
  }

  document.getElementById('fillScore').textContent = score;
  document.getElementById('fillNext').style.display = 'inline-block';
  showFeedback(isCorrect);
}

function nextFill() {
  currentIndex++;
  loadFillBlank();
}

// ============================================
// WORD ORDER GAME
// ============================================

/**
 * Split a sentence into lowercase word tokens and separate punctuation tokens.
 * e.g., "I went to the store, but it was closed." 
 *   → ["i", "went", "to", "the", "store", ",", "but", "it", "was", "closed", "."]
 */
function splitOrderTokens(sentence) {
  const tokens = [];
  sentence.split(/\s+/).forEach(w => {
    // Extract trailing punctuation (.,!?;:—–-)
    const match = w.match(/^(.+?)([.,!?;:—–-]+)$/);
    if (match) {
      tokens.push(match[1].toLowerCase());
      tokens.push(match[2]); // punctuation as its own token
    } else {
      tokens.push(w.toLowerCase());
    }
  });
  return tokens;
}

function initOrder() {
  orderAttempts = 0;
  loadOrder();
  showScreen('orderScreen');
}

function loadOrder() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }
  
  const cur = currentWords[currentIndex];
  const sentence = cur.ex;
  
  // Split words and separate punctuation into individual tokens
  const words = splitOrderTokens(sentence);
  
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  
  orderAnswer = [];
  orderAttempts = 0;
  
  document.getElementById('orderAnswer').innerHTML = '';
  const punctPattern = /^[.,!?;:—–-]+$/;
  // Tokens come from splitting cur.ex; escape the body so dataset content can't
  // inject HTML. data-index is a numeric index, no escaping needed. Downstream
  // addToAnswer reads el.textContent, which returns the decoded original token.
  document.getElementById('orderTokens').innerHTML = shuffled.map((w, i) =>
    `<div class="token${punctPattern.test(w) ? ' punct-token' : ''}" data-index="${i}" onclick="addToAnswer(this)">${escapeHtml(w)}</div>`
  ).join('');
  
  document.getElementById('orderFeedback').style.display = 'none';
  document.getElementById('orderAttemptInfo').style.display = 'none';
  document.getElementById('orderCheck').style.display = 'inline-block';
  document.getElementById('orderNext').style.display = 'none';
  document.getElementById('orderClear').disabled = false;
  
  document.getElementById('orderScore').textContent = score;
  document.getElementById('orderTotal').textContent = currentWords.length;
  setProgress('orderProgress', currentIndex, currentWords.length);
}

function updateOrderCapitalization() {
  const answerArea = document.getElementById('orderAnswer');
  const tokens = answerArea.children;
  const punctuation = /^[.,!?;:—–-]+$/;
  let firstWordFound = false;
  for (let i = 0; i < tokens.length; i++) {
    const text = tokens[i].textContent;
    if (punctuation.test(text)) continue; // skip punctuation tokens
    const word = text.toLowerCase();
    if (!firstWordFound) {
      tokens[i].textContent = word.charAt(0).toUpperCase() + word.slice(1);
      firstWordFound = true;
    } else {
      tokens[i].textContent = word;
    }
  }
  // Rebuild orderAnswer array in lowercase for checking
  orderAnswer = Array.from(tokens).map(t => t.textContent.toLowerCase());
}

function addToAnswer(el) {
  if (el.classList.contains('placed')) return;
  el.classList.add('placed');
  orderAnswer.push(el.textContent);
  
  const answerArea = document.getElementById('orderAnswer');
  const token = document.createElement('div');
  token.className = 'answer-token';
  token.textContent = el.textContent;
  token.onclick = () => removeFromAnswer(token, el);
  answerArea.appendChild(token);
  updateOrderCapitalization();
}

function removeFromAnswer(token, original) {
  token.remove();
  original.classList.remove('placed');
  updateOrderCapitalization();
}

function clearOrderAnswer() {
  orderAnswer = [];
  document.getElementById('orderAnswer').innerHTML = '';
  document.querySelectorAll('.token').forEach(t => t.classList.remove('placed'));
  document.getElementById('orderAttemptInfo').style.display = 'none';
}

function checkOrder() {
  const cur = currentWords[currentIndex];
  const sentence = cur.ex;
  
  // Split into tokens (words + punctuation) for comparison
  const correct = splitOrderTokens(sentence);
  
  const isCorrect = orderAnswer.join(' ') === correct.join(' ');
  
  orderAttempts++;
  
  // Color each answer token green/red based on position match
  const answerTokenEls = document.getElementById('orderAnswer').children;
  Array.from(answerTokenEls).forEach((el, i) => {
    el.classList.remove('order-correct', 'order-incorrect');
    el.classList.add(orderAnswer[i] === correct[i] ? 'order-correct' : 'order-incorrect');
  });

  if (isCorrect) {
    const awardPoint = orderAttempts <= 3;
    if (awardPoint) {
      score++;
      updateStreak(true);
      document.getElementById('orderScore').textContent = score;
    }
    playSound('correct');
    document.getElementById('orderCheck').style.display = 'none';
    document.getElementById('orderNext').style.display = 'inline-block';
    document.getElementById('orderClear').disabled = true;
    document.getElementById('orderFeedback').style.display = 'none';
    document.getElementById('orderAttemptInfo').style.display = 'none';
    showFeedback(true);
  } else {
    updateStreak(false);
    playSound('incorrect');

    if (orderAttempts === 3) {
      // First time hitting 3 wrong: reveal correct sentence, add to missed, but keep Check active
      document.getElementById('orderFeedback').innerHTML = `Correct: <strong>${escapeHtml(cur.ex)}</strong>`;
      document.getElementById('orderFeedback').style.display = 'block';
      document.getElementById('orderAttemptInfo').textContent = `No more points — arrange the sentence correctly to continue.`;
      document.getElementById('orderAttemptInfo').style.display = 'block';
      missedWords.push(cur);
    } else if (orderAttempts > 3) {
      // Already shown the answer — user is still trying, keep feedback visible
      document.getElementById('orderAttemptInfo').textContent = `No more points — arrange the sentence correctly to continue.`;
      document.getElementById('orderAttemptInfo').style.display = 'block';
    } else {
      document.getElementById('orderAttemptInfo').textContent = `Attempt ${orderAttempts}/3 - Try again!`;
      document.getElementById('orderAttemptInfo').style.display = 'block';
    }
    showFeedback(false);
  }
}

function nextOrder() {
  currentIndex++;
  loadOrder();
}

// ============================================
// UNSCRAMBLE GAME
// ============================================
let unscrambleDifficulty = 'heroic';
let unscrambleAttempts = 0;
let unscrambleWordGroups = []; // [{word, tiles[]}]

function initUnscramble() {
  showScreen('unscrambleDiffScreen');
}

function startUnscrambleWithDifficulty(difficulty) {
  unscrambleDifficulty = difficulty;
  if (difficulty === 'heroic') {
    const singleWords = currentWords.filter(w => !w.word.includes(' '));
    if (singleWords.length === 0) {
      AppDialog.alert('No single-word entries in this selection. Try Nightmare mode or choose a different unit.');
      return;
    }
    currentWords = singleWords;
  }
  currentIndex = 0;
  score = 0;
  sessionStreak = 0;
  missedWords = [];
  updateStreakDisplays();
  loadUnscramble();
  showScreen('unscrambleScreen');
}

function shuffleLetters(word) {
  const arr = word.toLowerCase().split('');
  if (arr.length <= 1) return arr;
  let result, attempts = 0;
  do {
    result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    attempts++;
  } while (result.join('') === arr.join('') && attempts < 30);
  return result;
}

function loadUnscramble() {
  if (currentIndex >= currentWords.length) {
    showCompletion();
    return;
  }

  unscrambleAttempts = 0;
  unscrambleWordGroups = [];

  const cur = currentWords[currentIndex];
  const wordParts = cur.word.split(' ');

  // Nightmare mode hides all clues — just the scrambled letters
  if (unscrambleDifficulty === 'nightmare') {
    document.getElementById('unscrambleDef').textContent = '';
    document.getElementById('unscramblePOS').textContent = '';
    document.getElementById('unscrambleTR').textContent = '';
    document.getElementById('unscrambleDef').style.display = 'none';
    document.getElementById('unscramblePOS').style.display = 'none';
    document.getElementById('unscrambleTR').style.display = 'none';
  } else {
    document.getElementById('unscrambleDef').textContent = cur.def;
    document.getElementById('unscramblePOS').textContent = cur.pos || '';
    document.getElementById('unscrambleTR').textContent = cur.tr || '';
    document.getElementById('unscrambleDef').style.display = '';
    document.getElementById('unscramblePOS').style.display = '';
    document.getElementById('unscrambleTR').style.display = '';
  }

  // Hint: letter-count underscores for Heroic only
  const hintEl = document.getElementById('unscrambleHint');
  if (unscrambleDifficulty === 'heroic') {
    hintEl.textContent = cur.word.split('').map(c => c === ' ' ? '   ' : '_').join(' ');
    hintEl.style.display = 'block';
  } else {
    hintEl.style.display = 'none';
  }

  // Build tile groups (one group per word in the phrase)
  const tilesEl = document.getElementById('unscrambleTiles');
  tilesEl.innerHTML = '';
  let tileIndex = 0;

  wordParts.forEach((part, partIdx) => {
    const shuffled = shuffleLetters(part);
    const groupTiles = [];

    const groupWrap = document.createElement('div');
    groupWrap.className = 'unscramble-tile-group';

    shuffled.forEach(letter => {
      const tile = document.createElement('div');
      tile.className = 'unscramble-tile';
      tile.textContent = letter;
      tile.dataset.tileIndex = tileIndex++;
      tile.dataset.wordGroup = partIdx;
      tile.onclick = () => placeUnscrambleTile(tile, partIdx);
      groupWrap.appendChild(tile);
      groupTiles.push(tile);
    });

    tilesEl.appendChild(groupWrap);
    unscrambleWordGroups.push({ word: part.toLowerCase(), tiles: groupTiles });
  });

  // Build answer rows (one per word group)
  const answerEl = document.getElementById('unscrambleAnswer');
  answerEl.innerHTML = '';
  wordParts.forEach((_, idx) => {
    const row = document.createElement('div');
    row.className = 'unscramble-answer-row';
    row.dataset.groupIndex = idx;
    if (wordParts.length > 1) {
      const lbl = document.createElement('span');
      lbl.className = 'unscramble-row-label';
      lbl.textContent = `Word ${idx + 1}`;
      row.appendChild(lbl);
    }
    answerEl.appendChild(row);
  });

  document.getElementById('unscrambleFeedback').style.display = 'none';
  document.getElementById('unscrambleAttemptInfo').style.display = 'none';
  document.getElementById('unscrambleCheck').style.display = 'inline-block';
  document.getElementById('unscrambleNext').style.display = 'none';
  document.getElementById('unscrambleClear').disabled = false;

  document.getElementById('unscrambleScore').textContent = score;
  document.getElementById('unscrambleTotal').textContent = currentWords.length;
  setProgress('unscrambleProgress', currentIndex, currentWords.length);
}

function placeUnscrambleTile(tile, groupIdx) {
  if (tile.classList.contains('placed')) return;
  tile.classList.add('placed');

  const rows = document.querySelectorAll('#unscrambleAnswer .unscramble-answer-row');
  const targetRow = rows[groupIdx];
  if (!targetRow) return;

  const answerTile = document.createElement('div');
  answerTile.className = 'answer-token';
  answerTile.textContent = tile.textContent;
  answerTile.dataset.sourceIndex = tile.dataset.tileIndex;
  answerTile.onclick = () => removeUnscrambleTile(answerTile, tile);
  targetRow.appendChild(answerTile);
}

function removeUnscrambleTile(answerTile, sourceTile) {
  answerTile.remove();
  sourceTile.classList.remove('placed');
}

function clearUnscramble() {
  document.querySelectorAll('#unscrambleAnswer .unscramble-answer-row').forEach(row => {
    Array.from(row.querySelectorAll('.answer-token')).forEach(t => t.remove());
  });
  document.querySelectorAll('#unscrambleTiles .unscramble-tile').forEach(t => t.classList.remove('placed'));
  document.getElementById('unscrambleAttemptInfo').style.display = 'none';
}

function checkUnscramble() {
  const cur = currentWords[currentIndex];

  const rows = document.querySelectorAll('#unscrambleAnswer .unscramble-answer-row');
  const assembledWords = Array.from(rows).map(row =>
    Array.from(row.querySelectorAll('.answer-token')).map(t => t.textContent).join('')
  );
  const answer = assembledWords.join(' ');
  const correct = cur.word.toLowerCase();
  const isCorrect = answer === correct;

  unscrambleAttempts++;

  // Colour each answer tile per letter position
  Array.from(rows).forEach((row, rowIdx) => {
    const correctWord = unscrambleWordGroups[rowIdx]?.word || '';
    Array.from(row.querySelectorAll('.answer-token')).forEach((tile, i) => {
      tile.classList.remove('order-correct', 'order-incorrect');
      tile.classList.add(tile.textContent === (correctWord[i] || '') ? 'order-correct' : 'order-incorrect');
    });
  });

  if (isCorrect) {
    if (unscrambleAttempts <= 3) {
      score++;
      updateStreak(true);
      document.getElementById('unscrambleScore').textContent = score;
    }
    playSound('correct');
    document.getElementById('unscrambleCheck').style.display = 'none';
    document.getElementById('unscrambleNext').style.display = 'inline-block';
    document.getElementById('unscrambleClear').disabled = true;
    document.getElementById('unscrambleFeedback').style.display = 'none';
    document.getElementById('unscrambleAttemptInfo').style.display = 'none';
    showFeedback(true);
  } else {
    updateStreak(false);
    playSound('incorrect');

    if (unscrambleAttempts === 3) {
      document.getElementById('unscrambleFeedback').innerHTML = `Answer: <strong>${escapeHtml(cur.word)}</strong>`;
      document.getElementById('unscrambleFeedback').style.display = 'block';
      document.getElementById('unscrambleAttemptInfo').textContent = 'No more points — spell it correctly to continue.';
      document.getElementById('unscrambleAttemptInfo').style.display = 'block';
      missedWords.push(cur);
    } else if (unscrambleAttempts > 3) {
      document.getElementById('unscrambleAttemptInfo').textContent = 'No more points — spell it correctly to continue.';
      document.getElementById('unscrambleAttemptInfo').style.display = 'block';
    } else {
      document.getElementById('unscrambleAttemptInfo').textContent = `Attempt ${unscrambleAttempts}/3 — try again!`;
      document.getElementById('unscrambleAttemptInfo').style.display = 'block';
    }
    showFeedback(false);
  }
}

function nextUnscramble() {
  currentIndex++;
  loadUnscramble();
}

// ============================================
// COMPLETION
// ============================================
function showCompletion() {
  const total = currentWords.length;
  const pct = Math.round((score / Math.max(1, total)) * 100);
  document.getElementById('finalScore').textContent = `${score}/${total} (${pct}%)`;
  const msg = pct >= 90 ? '🌟 Outstanding!' : pct >= 70 ? '👏 Great job!' : pct >= 50 ? '👍 Good effort!' : '💪 Keep practicing!';
  document.getElementById('finalMessage').textContent = msg;

  if (missedWords.length > 0) {
    document.getElementById('reviewSection').style.display = 'block';
    // All three values flow in from dataset entries — escape each before
    // interpolation. The literal fallback string "No definition available" is
    // static, but we route it through the same slot for consistency.
    document.getElementById('reviewList').innerHTML = missedWords.map(w => {
      const meaning = w.def || w.definition || '';
      const example = w.ex || w.example || '';
      const body = meaning || example || 'No definition available';
      return `<div class="review-item">
        <div class="word">${escapeHtml(w.word)}</div>
        <div class="meaning">${escapeHtml(body)}</div>
      </div>`;
    }).join('');
  } else {
    document.getElementById('reviewSection').style.display = 'none';
  }

  playSound('complete');
  createConfetti();

  // Log session to Firestore (now with correct field names)
  logSessionToFirestore();
  
  // Add XP for completing
  addXP(score * 2);
  
  // Check and mark any matching assignments as completed
  checkAndMarkAssignmentCompletion(pct);

  showScreen('completionScreen');
}

// ============================================
// ASSIGNMENT COMPLETION TRACKING
// ============================================
async function checkAndMarkAssignmentCompletion(percentage) {
  // Only proceed if we got 100%
  if (percentage < 100) {
    console.log('Score not 100%, skipping assignment completion check');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) return;
  
  // Get current session details
  const currentBook = typeof selectedBook !== 'undefined' ? selectedBook : 'empower';
  const currentLevel = selectedLevel || '';
  const currentUnit = selectedUnit || 'all';
  const activity = currentActivity || '';
  
  console.log('Checking for matching assignments:', { currentBook, currentLevel, currentUnit, activity });
  
  try {
    // Check if myAssignments is loaded (from student-assignments.js)
    if (typeof myAssignments !== 'undefined' && myAssignments.length > 0) {
      // Find matching assignment
      const matchingAssignment = myAssignments.find(a => {
        // Book must match
        if (a.book !== currentBook) return false;
        
        // Level must match
        if (a.level !== currentLevel) return false;
        
        // Unit check - assignment 'all' matches any unit, or exact match
        if (a.unit && a.unit !== 'all' && a.unit !== currentUnit) return false;
        
        // Activity check - assignment 'all' matches any activity, or exact match
        if (a.activity && a.activity !== 'all' && a.activity !== activity) return false;
        
        return true;
      });
      
      if (matchingAssignment) {
        console.log('Found matching assignment:', matchingAssignment.title);
        await markAssignmentAsCompleted(matchingAssignment.id, percentage);
      } else {
        console.log('No matching assignment found');
      }
    } else {
      console.log('No assignments loaded, skipping check');
    }
  } catch (error) {
    console.error('Error checking assignment completion:', error);
  }
}

async function markAssignmentAsCompleted(assignmentId, score) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const docId = `${user.uid}_${assignmentId}`;
    
    // Get existing record if any
    const existingDoc = await db.collection('assignmentCompletions').doc(docId).get();
    const existingData = existingDoc.exists ? existingDoc.data() : { attempts: 0, bestScore: 0 };
    
    // Save completion record
    await db.collection('assignmentCompletions').doc(docId).set({
      odUserId: user.uid,
      odUserName: user.displayName || user.email || 'Student',
      assignmentId: assignmentId,
      completed: score >= 100,
      attempts: (existingData.attempts || 0) + 1,
      bestScore: Math.max(existingData.bestScore || 0, score),
      lastAttempt: firebase.firestore.FieldValue.serverTimestamp(),
      completedAt: score >= 100 ? firebase.firestore.FieldValue.serverTimestamp() : (existingData.completedAt || null)
    }, { merge: true });
    
    console.log('✅ Assignment marked as completed!', { assignmentId, score });
    
    // Update local cache
    if (typeof myCompletions !== 'undefined') {
      myCompletions[assignmentId] = {
        completed: true,
        attempts: (existingData.attempts || 0) + 1,
        bestScore: Math.max(existingData.bestScore || 0, score)
      };
    }
    
    // Refresh assignments display if function exists
    if (typeof renderMyAssignments === 'function') {
      renderMyAssignments();
    }
    
    // Show success notification
    showAssignmentCompletedNotification();
    
  } catch (error) {
    console.error('Error marking assignment complete:', error);
  }
}

function showAssignmentCompletedNotification() {
  // Create and show a notification
  const notification = document.createElement('div');
  notification.className = 'assignment-completed-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">🎯</span>
      <span class="notification-text">Assignment Completed!</span>
    </div>
  `;
  
  // Add styles if not exists
  if (!document.getElementById('assignmentNotificationStyles')) {
    const style = document.createElement('style');
    style.id = 'assignmentNotificationStyles';
    style.textContent = `
      .assignment-completed-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4);
        z-index: 10000;
        animation: slideInRight 0.5s ease, fadeOut 0.5s ease 2.5s forwards;
      }
      .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
      }
      .notification-icon {
        font-size: 1.5em;
      }
      @keyframes slideInRight {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOut {
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Remove after animation
  setTimeout(() => notification.remove(), 3000);
}

function practiceAgain() {
  if (missedWords.length > 0) {
    currentWords = missedWords.map(w => {
      const found = datasets[selectedLevel].find(item => item.word === w.word);
      return found || { word: w.word, def: w.def || w.definition || '', ex: w.ex || w.example || w.def || '', level: selectedLevel, pos: w.pos || '', tr: w.tr || '' };
    });
    currentIndex = 0;
    score = 0;
    sessionStreak = 0;
    missedWords = [];
    if (currentActivity === 'match') initMatch();
    else if (currentActivity === 'choice') initChoice();
    else if (currentActivity === 'reverse') initReverse();
    else if (currentActivity === 'spelling') initSpelling();
    else if (currentActivity === 'fillblank') initFillBlank();
    else if (currentActivity === 'order') initOrder();
    else if (currentActivity === 'unscramble') startUnscrambleWithDifficulty(unscrambleDifficulty);
    else initPronunciation();
  } else {
    backToMenu();
  }
}
