/* ============================================================
   convert-readings.js
   Plain-text → reading-exam JSON converter.

   Reads every file under:
     student/data/readings/_raw/<LEVEL>/exam-N.txt
   And writes the matching JSON to:
     student/data/readings/<LEVEL>/exam-N.json

   The plain-text authoring format is documented at the top of
   student/data/readings/_raw/B2/exam-4.txt — see that file for a
   complete worked example. Summary:

     ID:            <exam id used in exam-registry.js>
     LEVEL:         <CEFR level — A2, B1, B1+, B2, ...>
     TITLE:         <human-readable title>
     SUBTITLE:      <secondary line>
     TIME_LIMIT_MIN: <number>

     INTRO:        <free text discussion prompts>

     PASSAGE_TITLE: <h2 of the passage>
     PASSAGE:
       <the passage body. Blank lines separate paragraphs.
        *word*  → <strong>word</strong>
        {gap:N} → <span class="rd-gap" data-gap="N"></span>>

     # GAPS       (renders as section type 'match-gaps')
     # HEADINGS   (renders as section type 'match-headings')
     # MCQ        (renders as section type 'mcq', id 'comprehension')
     # VOCAB      (renders as section type 'mcq', id 'vocab')
     # REFERENCE  (renders as section type 'mcq', id 'reference')
     # WRITING    (renders as section type 'writing')

   Per-section format documented inline below.

   Run:
     cd E:\vocab-trainer\y
     node tools/convert-readings.js

   Exit 0 → all files converted successfully.
   Exit 1 → at least one file had a parse/validation error.
   ============================================================ */

const fs   = require('fs');
const path = require('path');

const Y_ROOT  = path.resolve(__dirname, '..');          // .../y
const RAW_ROOT  = path.join(Y_ROOT, 'student', 'data', 'readings', '_raw');
const OUT_ROOT  = path.join(Y_ROOT, 'student', 'data', 'readings');

// ── ANSI for clean diagnostics ─────────────────────────────
const C = {
  reset: '\x1b[0m', dim: '\x1b[90m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};

let totalOk = 0, totalErr = 0;
const errors = [];

// ── Helpers ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert *word* → <strong>word</strong>. Leaves escaped \* alone.
function bolds(s) {
  // Use a non-greedy match so adjacent bolds don't collapse.
  return s.replace(/(^|[^\\])\*([^*\n]+?)\*/g, (_, before, content) =>
    before + '<strong>' + content + '</strong>');
}

// Convert {gap:N} → <span class="rd-gap" data-gap="N"></span>
function gaps(s) {
  return s.replace(/\{gap:(\d+)\}/g, (_, n) =>
    `<span class="rd-gap" data-gap="${n}"></span>`);
}

// Turn an array of plain-text paragraphs into the wrapped HTML
// the existing reading engine expects. Each <p> gets a stable id.
function paragraphsToHtml(paras) {
  return paras.map((p, idx) => {
    const n = idx + 1;
    const body = gaps(bolds(p.trim()));
    return `<p class="rd-para" data-para="${n}">${body}</p>`;
  }).join('');
}

// Plain-text intro → introHtml: a discussion-style prompt block.
// Applies the same *word* → <strong> transform as the passage so a
// vocab term highlighted in the discussion prompt actually renders
// bold instead of showing literal asterisks.
function introToHtml(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const items = [];
  const intro = [];
  lines.forEach(l => {
    const m = l.match(/^\d+\.\s+(.+)$/);
    if (m) items.push(m[1]);
    else intro.push(l);
  });
  // Order matters: HTML-escape FIRST (so user text can't inject tags),
  // THEN apply the * → <strong> transform on the now-safe string.
  const esc = s => bolds(escapeHtml(s));
  let html = '';
  if (intro.length) html += '<p>' + intro.map(esc).join(' ') + '</p>';
  if (items.length) html += '<ol>' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>';
  return html || '<p>' + esc(text.trim()) + '</p>';
}

// ── Per-section parsers ───────────────────────────────────
// Each takes the raw block of text for the section (everything
// between # SECTION and the next # or EOF) and returns the JSON
// shape that reading-exam.js renders.

function parseGapsSection(block, ctx) {
  const lines = block.split('\n').map(l => l.trimEnd());
  let label = 'Part B', instructions = '';
  const options = [];
  const items = [];
  let answersLine = '';
  for (const ln of lines) {
    const lab = ln.match(/^LABEL:\s*(.+)$/);
    if (lab) { label = lab[1].trim(); continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);
    if (inst) { instructions = inst[1].trim(); continue; }
    const opt = ln.match(/^([a-zA-Z]):\s*(.+)$/);
    if (opt) { options.push({ id: opt[1].toLowerCase(), text: opt[2].trim() }); continue; }
    const ans = ln.match(/^ANSWERS:\s*(.+)$/);
    if (ans) { answersLine = ans[1]; continue; }
  }
  if (!answersLine) ctx.err('GAPS section is missing ANSWERS line.');
  // Parse "1=e, 2=b, 3=f, 4=c, 5=a"
  answersLine.split(/[,\s]+/).filter(Boolean).forEach(pair => {
    const m = pair.match(/^(\d+)=([a-zA-Z]+)$/);
    if (!m) { ctx.err('GAPS answer pair malformed: ' + pair); return; }
    items.push({ id: m[1], label: 'Gap ' + m[1], answer: m[2].toLowerCase() });
  });
  // Sanity: every answer letter must be in the options list.
  items.forEach(it => {
    if (!options.find(o => o.id === it.answer)) {
      ctx.err(`GAPS answer "${it.answer}" for gap ${it.id} doesn't match any option.`);
    }
  });
  return {
    id: 'gaps', type: 'match-gaps',
    label, instructions, options, items
  };
}

function parseHeadingsSection(block, ctx) {
  // Same structure as GAPS but renders as match-headings and the
  // items are paragraph numbers (p1, p2, ...) rather than gap numbers.
  // Optional LABELS line lets a reading override the default
  // "Paragraph N" item labels (e.g. matching named sections like
  // VISION / PERSISTENCE / CREATIVITY / PASSION to A-D).
  const lines = block.split('\n').map(l => l.trimEnd());
  let label = 'Part B', instructions = '';
  const options = [];
  const items = [];
  let answersLine = '';
  let customLabels = null;
  for (const ln of lines) {
    const lab = ln.match(/^LABEL:\s*(.+)$/);
    if (lab) { label = lab[1].trim(); continue; }
    const labels = ln.match(/^LABELS:\s*(.+)$/);
    if (labels) { customLabels = labels[1].split(',').map(s => s.trim()).filter(Boolean); continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);
    if (inst) { instructions = inst[1].trim(); continue; }
    const opt = ln.match(/^([A-Z]):\s*(.+)$/);
    if (opt) { options.push({ id: opt[1], text: opt[2].trim() }); continue; }
    const ans = ln.match(/^ANSWERS:\s*(.+)$/);
    if (ans) { answersLine = ans[1]; continue; }
  }
  if (!answersLine) ctx.err('HEADINGS section is missing ANSWERS line.');
  answersLine.split(/[,\s]+/).filter(Boolean).forEach(pair => {
    const m = pair.match(/^p?(\d+)=([A-Z])$/);
    if (!m) { ctx.err('HEADINGS answer pair malformed: ' + pair); return; }
    const idx = Number(m[1]) - 1;
    const itemLabel = (customLabels && customLabels[idx]) || ('Paragraph ' + m[1]);
    items.push({ id: 'p' + m[1], label: itemLabel, answer: m[2] });
  });
  items.forEach(it => {
    if (!options.find(o => o.id === it.answer)) {
      ctx.err(`HEADINGS answer "${it.answer}" for ${it.id} doesn't match any option.`);
    }
  });
  return {
    id: 'headings', type: 'match-headings',
    label, instructions, options, items
  };
}

// Shared parser for MCQ-style sections. `kind` is the role
// (comprehension / vocab / reference / generic) which controls
// the section id only.
function parseMcqSection(block, ctx, kind) {
  const lines = block.split('\n');
  let label = '', instructions = '';
  const items = [];
  let current = null;
  // We walk the lines looking for the patterns:
  //   N. question text...
  //   a) option text  (or b) c) d))
  //   ANSWER: x
  for (const raw of lines) {
    const ln = raw.trimEnd();
    const lab = ln.match(/^LABEL:\s*(.+)$/);
    if (lab) { label = lab[1].trim(); continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);
    if (inst) { instructions = inst[1].trim(); continue; }
    // Question header — start of a new item
    const q = ln.match(/^(\d+)\.\s+(.+)$/);
    if (q) {
      if (current) items.push(current);
      current = { id: kind[0] + q[1], question: q[2].trim(), options: [], answer: '' };
      continue;
    }
    // Option line — looser regex to be tolerant of leading whitespace.
    // Up to [a-h] so vocab-matching MCQs with 6-8 options (e.g. Part C
    // of A2 R3 "Slow Food") can still parse cleanly. The renderer just
    // shows however many options the question has.
    const opt = ln.match(/^\s*([a-h])\)\s+(.+)$/);
    if (opt && current) {
      current.options.push({ id: opt[1].toLowerCase(), text: opt[2].trim() });
      continue;
    }
    // Answer line
    const ans = ln.match(/^\s*ANSWER:\s*([a-h])\s*$/i);
    if (ans && current) {
      current.answer = ans[1].toLowerCase();
      continue;
    }
  }
  if (current) items.push(current);
  // Validate
  items.forEach(it => {
    if (!it.options.find(o => o.id === it.answer)) {
      ctx.err(`${kind.toUpperCase()} ${it.id}: answer "${it.answer}" not in options [${it.options.map(o => o.id).join(',')}].`);
    }
  });
  return {
    id: kind, type: 'mcq',
    label: label || '',
    instructions: instructions || '',
    items
  };
}

// True/False — N statements, each with ANSWER: T or F. Rendered as
// an MCQ with two fixed options (True / False) so we don't have to
// teach the engine a new section type.
function parseTrueFalseSection(block, ctx, label) {
  const lines = block.split('\n');
  let secLabel = label || '', instructions = '';
  const items = [];
  let current = null;
  for (const raw of lines) {
    const ln = raw.trimEnd();
    const lab = ln.match(/^LABEL:\s*(.+)$/);             if (lab)  { secLabel = lab[1].trim();      continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);     if (inst) { instructions = inst[1].trim(); continue; }
    const q = ln.match(/^(\d+)\.\s+(.+)$/);
    if (q) {
      if (current) items.push(current);
      current = {
        id: 'tf' + q[1],
        question: q[2].trim(),
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' }
        ],
        answer: ''
      };
      continue;
    }
    const ans = ln.match(/^\s*ANSWER:\s*(T|F|TRUE|FALSE)\s*$/i);
    if (ans && current) {
      current.answer = /^t/i.test(ans[1]) ? 'a' : 'b';
      continue;
    }
  }
  if (current) items.push(current);
  items.forEach(it => {
    if (it.answer !== 'a' && it.answer !== 'b') {
      ctx.err(`TRUEFALSE ${it.id}: missing or invalid ANSWER (expected T or F).`);
    }
  });
  return {
    id: 'truefalse', type: 'mcq',
    label: secLabel, instructions, items
  };
}

// Short-answer (one input per item, auto-graded). Each item has a
// question stem + a reference answer. The engine's `find-word`
// renderer (reading-exam.js renderFindWord) gives each item its own
// text input, and computeScore() uses freeTextMatch() — a forgiving
// matcher that lowercases, trims punctuation, strips leading
// articles, and collapses whitespace. So "Itard's" matches "itards"
// and "(a million dollars)" matches "million dollars".
//
// Multi-acceptable answers: if your AUTHOR text writes the answer
// as "fat / fructose" with slashes, we split on " / " and pass each
// alternative as part of the `acceptable` array so any of them
// matches. Use slashes deliberately — comma stays literal.
function parseShortAnswerSection(block, ctx, label) {
  const lines = block.split('\n');
  let secLabel = label || '', instructions = '';
  const items = [];
  let current = null;
  for (const raw of lines) {
    const ln = raw.trimEnd();
    const lab = ln.match(/^LABEL:\s*(.+)$/);             if (lab)  { secLabel = lab[1].trim();      continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);     if (inst) { instructions = inst[1].trim(); continue; }
    const q = ln.match(/^(\d+)\.\s+(.+)$/);
    if (q) {
      if (current) items.push(current);
      current = { id: 'sa' + q[1], number: q[1], question: q[2].trim(), answer: '', acceptable: null };
      continue;
    }
    const ans = ln.match(/^\s*ANSWER:\s*(.+)$/i);
    if (ans && current) {
      const raw = ans[1].trim();
      // Split on " / " for multi-acceptable answers.
      if (raw.indexOf(' / ') !== -1) {
        current.acceptable = raw.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
        current.answer = current.acceptable[0];
      } else {
        current.answer = raw;
      }
      continue;
    }
  }
  if (current) items.push(current);
  // Map onto the engine's find-word renderer: `definition` is the
  // question stem. The engine renders each item with its own
  // text input + numbered stem. Items keep their .answer for
  // grading; .acceptable (if present) carries alternates.
  return {
    id: 'shortanswer',
    type: 'find-word',
    label: secLabel,
    instructions: instructions || 'Type your answer for each item.',
    items: items.map(it => {
      const o = { id: it.id, definition: it.question, answer: it.answer };
      if (it.acceptable) o.acceptable = it.acceptable;
      return o;
    })
  };
}

function parseWritingSection(block, ctx) {
  const lines = block.split('\n').map(l => l.trimEnd());
  let label = 'Writing', instructions = '', prompt = '', minWords = null;
  for (const ln of lines) {
    const lab  = ln.match(/^LABEL:\s*(.+)$/);            if (lab)  { label = lab[1].trim();        continue; }
    const inst = ln.match(/^INSTRUCTIONS:\s*(.+)$/);     if (inst) { instructions = inst[1].trim(); continue; }
    const p    = ln.match(/^PROMPT:\s*(.+)$/);           if (p)    { prompt = p[1].trim();         continue; }
    const m    = ln.match(/^MIN_WORDS:\s*(\d+)\s*$/);    if (m)    { minWords = Number(m[1]);      continue; }
  }
  if (!prompt) ctx.err('WRITING section is missing PROMPT.');
  return {
    id: 'writing', type: 'writing',
    label, instructions, prompt,
    ...(minWords != null ? { minWords } : {})
  };
}

// ── Top-level file parser ─────────────────────────────────
function parseFile(raw) {
  // Strip lines that are pure comments (## prefix) — they're meant
  // for authors only and shouldn't be parsed as data.
  const cleaned = raw
    .split('\n')
    .filter(l => !/^\s*##/.test(l))
    .join('\n');

  // Lift the top-level KEY: VALUE block. Stop at the first
  // INTRO:/PASSAGE_TITLE:/PASSAGE: marker.
  const meta = {};
  const lines = cleaned.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const ln = lines[i].trimEnd();
    if (/^(INTRO|PASSAGE_TITLE|PASSAGE):/i.test(ln)) break;
    const m = ln.match(/^([A-Z_]+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }

  // From here we scan for blocks: INTRO, PASSAGE_TITLE, PASSAGE,
  // and any `# SECTION_NAME` headers. We support DUPLICATE section
  // headers (e.g. two `# WRITING` blocks) by storing them as an
  // ordered list of { type, content } entries rather than a dict.
  const blocks = { __INTRO__: '', __PASSAGE__: '' };
  const sectionList = [];  // [{ type: 'WRITING', content: '...' }, ...]
  let currentTarget = null;   // either '__INTRO__'/'__PASSAGE__' for special
                              // or an index into sectionList
  let buf = [];
  function flush() {
    if (currentTarget == null) { buf = []; return; }
    const joined = buf.join('\n');
    if (typeof currentTarget === 'string') {
      blocks[currentTarget] = joined;
    } else {
      sectionList[currentTarget].content = joined;
    }
    buf = [];
  }
  for (; i < lines.length; i++) {
    const ln = lines[i].trimEnd();
    const intro = ln.match(/^INTRO:\s*(.*)$/);
    if (intro) { flush(); currentTarget = '__INTRO__'; if (intro[1]) buf.push(intro[1]); continue; }
    const ptit = ln.match(/^PASSAGE_TITLE:\s*(.+)$/);
    if (ptit) { flush(); meta.PASSAGE_TITLE = ptit[1].trim(); currentTarget = null; continue; }
    const pass = ln.match(/^PASSAGE:\s*$/);
    if (pass) { flush(); currentTarget = '__PASSAGE__'; continue; }
    const sect = ln.match(/^#\s+([A-Z_]+)\s*$/);
    if (sect) {
      flush();
      sectionList.push({ type: sect[1], content: '' });
      currentTarget = sectionList.length - 1;
      continue;
    }
    if (currentTarget != null) buf.push(ln);
  }
  flush();

  return { meta, blocks, sectionList };
}

// Build the passage HTML by splitting on blank lines.
function buildPassage(blockText) {
  const paras = blockText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphsToHtml(paras);
}

// ── Per-file conversion ───────────────────────────────────
function convertFile(srcPath, outPath) {
  const ctx = {
    src: srcPath, errors: [],
    err(msg) { this.errors.push(msg); }
  };
  const raw = fs.readFileSync(srcPath, 'utf8');
  const { meta, blocks, sectionList } = parseFile(raw);

  // Required fields
  ['ID', 'LEVEL', 'TITLE'].forEach(k => {
    if (!meta[k]) ctx.err('Missing required top-level field: ' + k);
  });

  const introHtml = blocks.__INTRO__ ? introToHtml(blocks.__INTRO__) : '';
  if (!blocks.__PASSAGE__) ctx.err('No PASSAGE block found.');
  const passageHtml = blocks.__PASSAGE__ ? buildPassage(blocks.__PASSAGE__) : '';

  // Walk the sectionList in the order they appeared. Duplicates of
  // the same type (e.g. two `# WRITING` blocks) are supported —
  // each block is rendered as its own section, distinguished by the
  // LABEL field. Section ids are made unique by suffixing with a
  // counter when the same type repeats.
  const typeCounters = {};
  const sections = [];
  sectionList.forEach(({ type, content }) => {
    typeCounters[type] = (typeCounters[type] || 0) + 1;
    const suffix = typeCounters[type] > 1 ? String(typeCounters[type]) : '';
    let s = null;
    if (type === 'GAPS')        s = parseGapsSection(content, ctx);
    else if (type === 'HEADINGS')    s = parseHeadingsSection(content, ctx);
    else if (type === 'MCQ')         s = parseMcqSection(content, ctx, 'mcq');
    else if (type === 'VOCAB')       s = parseMcqSection(content, ctx, 'vocab');
    else if (type === 'REFERENCE')   s = parseMcqSection(content, ctx, 'reference');
    else if (type === 'WRITING')     s = parseWritingSection(content, ctx);
    else if (type === 'TRUEFALSE')   s = parseTrueFalseSection(content, ctx);
    else if (type === 'SHORTANSWER') s = parseShortAnswerSection(content, ctx);
    else { ctx.err('Unknown section: # ' + type); return; }
    if (s && suffix) s.id = s.id + suffix;
    sections.push(s);
  });

  if (ctx.errors.length) {
    console.log('  ' + C.red + '✗' + C.reset + ' ' + path.relative(Y_ROOT, srcPath));
    ctx.errors.forEach(e => console.log('      ' + C.dim + '·' + C.reset + ' ' + e));
    totalErr++;
    errors.push({ src: srcPath, errors: ctx.errors });
    return;
  }

  const out = {
    id: meta.ID,
    level: meta.LEVEL,
    title: meta.TITLE,
    subtitle: meta.SUBTITLE || '',
    timeLimitMin: Number(meta.TIME_LIMIT_MIN) || 60,
    passages: [
      {
        passageNumber: 1,
        title: meta.PASSAGE_TITLE || meta.TITLE,
        introHtml,
        passageHtml,
        sections
      }
    ]
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('  ' + C.green + '✓' + C.reset + ' ' + path.relative(Y_ROOT, srcPath) +
              C.dim + '  →  ' + path.relative(Y_ROOT, outPath) + C.reset);
  totalOk++;
}

// ── Walk _raw recursively ─────────────────────────────────
function walk() {
  if (!fs.existsSync(RAW_ROOT)) {
    console.error(C.red + 'Missing source dir: ' + RAW_ROOT + C.reset);
    process.exit(1);
  }
  const levels = fs.readdirSync(RAW_ROOT).filter(n => {
    return fs.statSync(path.join(RAW_ROOT, n)).isDirectory();
  });
  if (!levels.length) {
    console.log(C.yellow + 'No level subdirectories under ' + RAW_ROOT + C.reset);
    return;
  }
  for (const lvl of levels) {
    const lvlDir = path.join(RAW_ROOT, lvl);
    const files = fs.readdirSync(lvlDir).filter(n => n.endsWith('.txt'));
    if (!files.length) continue;
    console.log('\n' + C.bold + lvl + C.reset);
    for (const f of files) {
      const src = path.join(lvlDir, f);
      const outName = f.replace(/\.txt$/i, '.json');
      const out = path.join(OUT_ROOT, lvl, outName);
      convertFile(src, out);
    }
  }
}

// ── Main ──────────────────────────────────────────────────
console.log(C.bold + '📖 Reading converter' + C.reset);
console.log(C.dim  + '   Source: ' + RAW_ROOT + C.reset);
console.log(C.dim  + '   Target: ' + OUT_ROOT + C.reset);
walk();
console.log('\n' + C.bold + 'Summary' + C.reset);
console.log('  ' + C.green + '✓ ' + totalOk + ' converted' + C.reset);
if (totalErr > 0) {
  console.log('  ' + C.red + '✗ ' + totalErr + ' failed' + C.reset);
  process.exit(1);
}
process.exit(0);
