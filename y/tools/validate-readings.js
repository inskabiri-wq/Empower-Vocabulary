/* ============================================================
   validate-readings.js  —  read-only integrity check for every
   reading JSON registered in exam-registry.js.

   What it verifies (per registered exam):
     • File path resolves and is valid JSON
     • passages[passageIndex] exists
     • Every match-headings / match-gaps item.answer points to a
       real option.id (no orphan answers)
     • Every match-gaps gap id appears as a span in the passage HTML
     • Every match-headings item id (p1, p2, …) appears as a
       data-para in the passage HTML
     • Every MCQ-style item.answer is in its own options list
     • passages have a non-empty passageHtml
     • No duplicate option ids inside a single section

   Run:
     cd E:\vocab-trainer\y
     node tools/validate-readings.js

   Exits 0 if everything is clean; 1 if any check fails.
   ============================================================ */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const Y_ROOT = path.resolve(__dirname, '..');

// ── ANSI ───────────────────────────────────────────────────
const C = {
  reset:'\x1b[0m', dim:'\x1b[90m', bold:'\x1b[1m',
  green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m'
};

let totalPass = 0;
let totalFail = 0;
const failures = [];

function ok(name)          { totalPass++; console.log('  ' + C.green + '✓' + C.reset + ' ' + name); }
function bad(name, detail) {
  totalFail++; failures.push({ name, detail });
  console.log('  ' + C.red + '✗' + C.reset + ' ' + name + (detail ? ' — ' + detail : ''));
}
function note(s) { console.log('  ' + C.dim + '·' + C.reset + ' ' + s); }

// ── Load exam-registry.js by running it in a sandbox ──────
function loadRegistry() {
  const file = path.join(Y_ROOT, 'assignments', 'js', 'exam-registry.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {}, console: { log: () => {}, warn: () => {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.EXAM_REGISTRY;
}

// ── Per-exam validation ───────────────────────────────────
function validateExam(skill, exam, reg) {
  console.log('\n' + C.bold + '[' + skill + '] ' + exam.id + ' — ' + exam.title + C.reset);

  // Listening exams (and any future skill that bundles its content
  // inline in JS) don't carry a `file` pointer — their questions
  // live in the per-skill engine. Skip the file-based checks for
  // those; just verify the registry entry has the minimum fields.
  if (!exam.file) {
    if (skill === 'listening' && exam.audio) {
      ok('Listening exam — content lives in listening-exam.js (no JSON file)');
      const audioPath = path.join(Y_ROOT, exam.audio.replace(/\//g, path.sep));
      if (fs.existsSync(audioPath)) ok('Audio file exists at ' + exam.audio);
      else                          bad('Audio file missing', audioPath);
    } else {
      bad('Registry entry has no `file` path', 'skill=' + skill);
    }
    return;
  }

  // 1. File exists + parses
  const filePath = path.join(Y_ROOT, exam.file.replace(/\//g, path.sep));
  if (!fs.existsSync(filePath)) {
    bad('File exists', 'missing: ' + filePath);
    return;
  }
  ok('File exists');

  let doc;
  try { doc = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { bad('JSON parses', e.message); return; }
  ok('JSON parses');

  // 2. passages[passageIndex] exists
  const idx = exam.passageIndex || 0;
  const passage = doc.passages && doc.passages[idx];
  if (!passage) {
    bad('passages[' + idx + '] exists', 'missing');
    return;
  }
  ok('passages[' + idx + '] exists');

  // 3. passageHtml non-empty
  if (!passage.passageHtml || !String(passage.passageHtml).trim()) {
    bad('passageHtml non-empty');
  } else {
    ok('passageHtml non-empty');
  }

  // 4. Iterate sections
  const sections = passage.sections || [];
  if (sections.length === 0) {
    bad('Has at least one section', 'sections array empty');
  } else {
    ok('Has ' + sections.length + ' section(s)');
  }

  // 5. Per-section integrity
  sections.forEach((s, i) => {
    const tag = '[section ' + i + ' · ' + (s.id || '?') + ' · ' + (s.type || '?') + ']';

    // Duplicate option ids?
    if (Array.isArray(s.options)) {
      const ids = s.options.map(o => o.id);
      const dups = ids.filter((x, n) => ids.indexOf(x) !== n);
      if (dups.length) bad(tag + ' duplicate option ids', dups.join(','));
    }

    // match-gaps / match-headings: items.answer ∈ options
    if (s.type === 'match-gaps' || s.type === 'match-headings') {
      const optIds = new Set((s.options || []).map(o => o.id));
      (s.items || []).forEach(it => {
        if (!optIds.has(it.answer)) {
          bad(tag + ' item ' + it.id + ' answer "' + it.answer + '" not in options');
        }
      });
      // For match-gaps, each item.id should appear as a data-gap in the passage HTML
      if (s.type === 'match-gaps') {
        (s.items || []).forEach(it => {
          const needle = 'data-gap="' + it.id + '"';
          if (!passage.passageHtml.includes(needle)) {
            bad(tag + ' gap ' + it.id + ' has no <span data-gap="' + it.id + '"> in passage');
          }
        });
      }
      // For match-headings, item.id like "p1" should appear as data-para="1"
      if (s.type === 'match-headings') {
        (s.items || []).forEach(it => {
          const m = String(it.id).match(/^p(\d+)$/);
          if (m) {
            const needle = 'data-para="' + m[1] + '"';
            if (!passage.passageHtml.includes(needle)) {
              bad(tag + ' heading item ' + it.id + ' has no <p data-para="' + m[1] + '"> in passage');
            }
          }
        });
      }
    }

    // MCQ-style: each item.answer ∈ that item's options
    if (s.type === 'mcq') {
      (s.items || []).forEach(it => {
        const optIds = new Set((it.options || []).map(o => o.id));
        if (!optIds.has(it.answer)) {
          bad(tag + ' MCQ item ' + it.id + ' answer "' + it.answer + '" not in its options');
        }
      });
    }

    // Writing: must have a prompt
    if (s.type === 'writing') {
      if (!s.prompt || !String(s.prompt).trim()) {
        bad(tag + ' writing section has no prompt');
      }
    }
  });

  // 6. Report counts
  const sumGapItems = sections.filter(s => s.type === 'match-gaps').reduce((a, s) => a + (s.items?.length || 0), 0);
  const sumMcqItems = sections.filter(s => s.type === 'mcq').reduce((a, s) => a + (s.items?.length || 0), 0);
  note(sumGapItems + ' gap items · ' + sumMcqItems + ' MCQ items · ' +
       (sections.filter(s => s.type === 'writing').length) + ' writing prompts');
}

// ── Main ──────────────────────────────────────────────────
console.log(C.bold + '📚 Reading library — integrity check' + C.reset);
const reg = loadRegistry();
if (!reg) {
  console.error(C.red + 'Could not load EXAM_REGISTRY' + C.reset);
  process.exit(1);
}

const skills = reg.skills ? reg.skills() : ['reading', 'listening'];
let totalExams = 0;
skills.forEach(skill => {
  const all = reg.forSkill(skill);
  totalExams += all.length;
  all.forEach(e => validateExam(skill, e, reg));
});

console.log('\n' + C.bold + '📊 Summary' + C.reset);
console.log('  Exams scanned : ' + totalExams);
console.log('  Checks passed : ' + C.green + totalPass + C.reset);
console.log('  Checks failed : ' + (totalFail > 0 ? C.red : C.green) + totalFail + C.reset);
if (totalFail > 0) {
  console.log('\n' + C.red + 'Failures:' + C.reset);
  failures.forEach(f => console.log('  - ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exit(1);
}
process.exit(0);
