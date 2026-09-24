#!/usr/bin/env node
/**
 * tools/retention-guard-check.js
 *
 * The Activity Logs retention tool DELETES AN AUDIT LOG. That cannot be
 * undone, so the guards are not decoration and are worth a test of their own:
 *
 *   - admin only
 *   - nothing is deleted before the logs have been EXPORTED this session
 *   - the number of months has to be typed back before anything goes
 *   - a refusal must not delete a single document on the way past
 *
 * The last one is the point. A guard that returns a warning AND deletes is
 * worse than no guard, so this counts the actual delete calls.
 *
 * Run:  node tools/retention-guard-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'activity-tracker/js/activity-admin.js'), 'utf8');

// Build a stand-in object carrying just the retention methods.
function slice(name) {
  const at = src.indexOf('  ' + name + '(');
  const at2 = src.indexOf('  async ' + name + '(');
  const start = at2 >= 0 ? at2 : at;
  if (start < 0) throw new Error('no method ' + name);
  let d = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

function build(opts) {
  const state = { deleteCalls: 0, committed: 0, isAdmin: opts.isAdmin !== false, docCount: opts.docCount };
  const docs = () => Array.from({ length: Math.min(400, state.docCount) }, (_, i) => ({ ref: 'r' + i }));
  const sandbox = {
    console,
    ActivityConfig: { settings: { collectionName: 'activityLogs' } },
    db: {
      collection: () => ({
        where: function () { return this; },
        limit: function (n) { this._n = n; return this; },
        get: async function () {
          const n = Math.min(this._n || 400, state.docCount);
          return { size: n, empty: n === 0, docs: docs().slice(0, n) };
        }
      }),
      batch: () => ({
        delete: () => { state.deleteCalls++; },
        commit: async () => { state.committed++; state.docCount = Math.max(0, state.docCount - 400); }
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    'var A = {' +
    '_checkAdmin(){ return ' + (state.isAdmin ? 'true' : 'false') + '; },' +
    '_exportedThisSession: ' + (opts.exported ? 'true' : 'false') + ',' +
    slice('_cutoffFor') + ',' +
    slice('countOlderThan') + ',' +
    slice('pruneOlderThan') +
    '};', sandbox);
  return { A: sandbox.A, state };
}

let all = true;
async function t(label, opts, call, expect) {
  const { A, state } = build(opts);
  const r = await A.pruneOlderThan.call(A, 6, call);
  const ok = (r.ok === expect.ok) && (state.deleteCalls === 0) === !!expect.noDeletes;
  if (!ok) {
    console.log('  FAIL  ' + label);
    console.log('          ok=' + r.ok + ' reason=' + (r.reason || '') +
      ' deleteCalls=' + state.deleteCalls + '   expected ' + JSON.stringify(expect));
    all = false;
  } else {
    console.log('  ok    ' + label.padEnd(58) +
      (r.ok ? ('deleted ' + r.deleted) : 'refused, 0 deleted'));
  }
}

(async () => {
  await t('a non-admin is refused', { isAdmin: false, exported: true, docCount: 900 },
    { confirmedMonths: 6 }, { ok: false, noDeletes: true });

  await t('no export this session -> refused', { exported: false, docCount: 900 },
    { confirmedMonths: 6 }, { ok: false, noDeletes: true });

  await t('exported but the months not typed back -> refused', { exported: true, docCount: 900 },
    {}, { ok: false, noDeletes: true });

  await t('wrong number typed -> refused', { exported: true, docCount: 900 },
    { confirmedMonths: 99 }, { ok: false, noDeletes: true });

  await t('nothing old enough -> succeeds, deletes nothing', { exported: true, docCount: 0 },
    { confirmedMonths: 6 }, { ok: true, noDeletes: true });

  // The allowed path DOES delete, and is capped.
  const { A, state } = build({ exported: true, docCount: 5000 });
  const r = await A.pruneOlderThan.call(A, 6, { confirmedMonths: 6, maxPerRun: 800 });
  const capped = r.ok && r.deleted === 800 && state.deleteCalls === 800;
  console.log((capped ? '  ok    ' : '  FAIL  ') +
    'the allowed path deletes, and stops at the per-run cap'.padEnd(58) +
    'deleted ' + r.deleted + ' of 5000');
  if (!capped) all = false;

  const reportsRest = r.ok && String(r.remaining) !== '0';
  console.log((reportsRest ? '  ok    ' : '  FAIL  ') +
    'and reports what is left rather than claiming it finished'.padEnd(58) +
    'remaining ' + r.remaining);
  if (!reportsRest) all = false;

  console.log(all ? '\nPASS - nothing is deleted until admin, export and confirmation all hold.'
                  : '\nFAIL');
  process.exit(all ? 0 : 1);
})();
