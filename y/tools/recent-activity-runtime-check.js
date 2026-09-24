#!/usr/bin/env node
/**
 * tools/recent-activity-runtime-check.js
 *
 * RUN loadRecentActivity() for real.
 *
 * Companion to tools/alerts-runtime-check.js, and for the same reason: a
 * ReferenceError in this file is valid syntax, passes every parser check, and
 * takes the whole teacher dashboard down to "Access Denied" because the
 * loader's catch turns any error into that screen.
 *
 * Asserts three things the feed must do:
 *   - render a row per session
 *   - offer "tap for items" ONLY where there is per-question detail
 *   - filter by skill correctly, including the writing exam, which used to
 *     fall into the vocabulary catch-all
 *
 * Run:  node tools/recent-activity-runtime-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const activitySrc = fs.readFileSync(path.join(ROOT, 'teacher/js/activity.js'), 'utf8');
const skillsSrc = fs.readFileSync(path.join(ROOT, 'teacher/js/skills/index.js'), 'utf8');

function slice(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  let d = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const written = {};
function makeEl(id) {
  return {
    id, value: 'all', style: {},
    set innerHTML(v) { written[id] = String(v); },
    get innerHTML() { return written[id] || ''; }
  };
}

function run(label, sessions, skillFilter, expect) {
  Object.keys(written).forEach(k => delete written[k]);
  const els = {};
  const sandbox = {
    console,
    allSessions: sessions,
    allStudents: sessions.map(s => ({ id: s.userId, name: 'Student', email: 's@x' })),
    getSkillFilter: () => skillFilter,
    getTimeAgo: () => '2 days ago',
    escapeHtml: (s) => String(s == null ? '' : s),
    _cssVar: () => '#000',
    document: {
      getElementById: (id) => (els[id] = els[id] || makeEl(id)),
      addEventListener: () => {}
    },
    window: {}
  };
  vm.createContext(sandbox);

  let err = null;
  try {
    vm.runInContext(
      skillsSrc.match(/const ACTIVITY_TO_SKILL = \{[\s\S]*?\};/)[0] + '\n' +
      skillsSrc.match(/const KNOWN_SKILLS = \[[^\]]*\];/)[0] + '\n' +
      slice(skillsSrc, 'activityToSkill') + '\n' +
      slice(skillsSrc, 'filterSessionsBySkill') + '\n' +
      // rebuildActivityDropdown reads this table, so it has to come along.
      activitySrc.match(/const SKILL_ACTIVITY_OPTIONS = \{[\s\S]*?\n\};/)[0] + '\n' +
      slice(activitySrc, 'rebuildActivityDropdown') + '\n' +
      slice(activitySrc, 'loadRecentActivity') + '\n' +
      'loadRecentActivity();', sandbox);
  } catch (e) { err = e; }

  const html = written.activityList || '';
  const rows = (html.match(/class="activity-item"/g) || []).length;
  const taps = (html.match(/tap for items/g) || []).length;
  const empty = /No activity found/.test(html);

  const ok = !err && rows === expect.rows && taps === expect.taps && empty === !!expect.empty;
  if (!ok) {
    console.log('  FAIL  ' + label);
    if (err) console.log('          threw: ' + err.message);
    else console.log('          rows=' + rows + ' taps=' + taps + ' empty=' + empty +
      '   expected ' + JSON.stringify(expect));
  } else {
    console.log('  ok    ' + label.padEnd(56) + 'rows=' + rows + '  tap=' + taps +
      (empty ? '  (empty state)' : ''));
  }
  return ok;
}

const base = (o) => Object.assign({
  userId: 'u1', userName: 'Alireza', percentage: 70,
  createdAt: { toDate: () => new Date() }
}, o);

const G = [{ q: 'He ___ tea', picked: 'drink', correct: 'drinks', ok: false }];
const P = [{ q: 'thorough', picked: 'through', correct: 'thorough', ok: false }];

let all = true;

all &= run('a mixed feed renders every row', [
  base({ activity: 'choice', vocabDetails: [{ q: 'a', picked: 'b', correct: 'a', ok: false }] }),
  base({ activity: 'grammar-choice', skill: 'grammar', grammarDetails: G }),
  base({ activity: 'pronunciation', unscored: true }),
  base({ activity: 'writing-exam', skill: 'writing' })
], 'all', { rows: 4, taps: 2 });

all &= run('pronunciation with a spoken attempt IS tappable',
  [base({ activity: 'pronunciation', pronDetails: P })], 'all', { rows: 1, taps: 1 });

all &= run('pronunciation carrying only an empty vocabDetails is NOT',
  [base({ activity: 'pronunciation', vocabDetails: [] })], 'all', { rows: 1, taps: 0 });

all &= run('the writing exam appears under Writing',
  [base({ activity: 'writing-exam', skill: 'writing' }), base({ activity: 'choice' })],
  'writing', { rows: 1, taps: 0 });

all &= run('and no longer under Vocabulary',
  [base({ activity: 'writing-exam', skill: 'writing' }), base({ activity: 'choice' })],
  'vocabulary', { rows: 1, taps: 0 });

all &= run('grammar filter finds grammar practice',
  [base({ activity: 'grammar-fill', skill: 'grammar', grammarDetails: G }), base({ activity: 'choice' })],
  'grammar', { rows: 1, taps: 1 });

all &= run('an empty feed shows the empty state, not a crash',
  [], 'all', { rows: 0, taps: 0, empty: true });

all &= run('a session with no detail fields at all still renders',
  [base({ activity: 'choice' })], 'all', { rows: 1, taps: 0 });

console.log(all ? '\nPASS - the feed renders, filters, and offers detail only where it exists.'
                : '\nFAIL');
process.exit(all ? 0 : 1);
