#!/usr/bin/env node
/**
 * tools/live-markup-check.js
 *
 * Every id the dashboard's JS reaches for must exist in the page that actually
 * renders - teacher-dashboard.html.
 *
 * This exists because of a real mistake: `activity-logs-tab.html` looks like
 * the Activity Logs markup, and is a DEAD FILE referenced from nowhere. The
 * dashboard carries its own copy. Controls added to the tab file are invisible
 * forever, and nothing complains - the JS simply finds null and does nothing.
 *
 * So: assert the controls live where they render, and assert the dead file
 * stays dead rather than quietly diverging into a second source of truth.
 *
 * Run:  node tools/live-markup-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const live = read('teacher-dashboard.html');
const failures = [];

// Ids the Activity Logs code drives.
const NEEDED = [
  'activityLogsList', 'activityLogsLoader',
  'activityFilterRole', 'activityFilterCategory', 'activityFilterType',
  'activityFilterDateFrom', 'activityFilterDateTo', 'activitySearchInput',
  'activityStatToday', 'activityStatWeek', 'activityStatMonth',
  // activityRetentionMonths is deliberately absent: the window comes from
  // ActivityConfig.settings.retentionMonths, not from a control on the page.
  'activityRetentionNote', 'activityPruneBtn'
];
NEEDED.forEach((id) => {
  if (!new RegExp('id="' + id + '"').test(live)) {
    failures.push('teacher-dashboard.html is missing #' + id +
      ' - the JS reaches for it and will silently find null');
  }
});

// Handlers wired from markup must exist on the object.
const admin = read('activity-tracker/js/activity-admin.js');
const HANDLERS = ['applyFilters', 'clearFilters', 'exportToExcel', 'checkRetention', 'runPrune'];
HANDLERS.forEach((fn) => {
  if (live.indexOf('ActivityAdmin.' + fn + '(') !== -1 &&
      !new RegExp('(^|\\s)(async )?' + fn + '\\s*\\(').test(admin)) {
    failures.push('teacher-dashboard.html calls ActivityAdmin.' + fn +
      '() but activity-admin.js does not define it');
  }
});

// Deleting logs must never be reachable without the download beside it.
if (/ActivityAdmin\.runPrune\(/.test(live) && !/ActivityAdmin\.exportToExcel\(/.test(live)) {
  failures.push('the delete control is on the page but the download is not - ' +
    'the export-first guard would be unreachable');
}

// ── The export-first interlock must stay an interlock ────────────────────
// pruneOlderThan() refuses to delete logs that have not been downloaded in
// the same session. That only protects anything while downloading and
// deleting sit together in one place. An "Activity logs" sheet in the Reports
// workbook would let an admin export from a screen with no delete button and
// delete from a screen whose export they skipped: the guard would still pass
// its own check while protecting nothing.
//
// So this is not a style rule. Adding that sheet is a safety change, and it
// has to be a deliberate one that also moves the guard to a persisted flag.
{
  const reports = read('teacher/js/reports-admin.js');
  // Line-based on purpose. A single regex over the whole call cannot do this:
  // the sheet name sits after a NESTED call, `aoa_to_sheet(rows)`, so any
  // `[^)]*` between the two runs into that inner `)` and matches nothing.
  // The sheet name is simply the last quoted string on the line.
  const sheetNames = reports.split(/\r?\n/)
    .filter((ln) => ln.includes('book_append_sheet') && !/^\s*(\/\/|\*)/.test(ln))
    .map((ln) => { const q = [...ln.matchAll(/['"]([^'"]+)['"]/g)]; return q.length ? q[q.length - 1][1] : null; })
    .filter(Boolean);
  const offending = sheetNames.filter((n) => /activity\s*log|audit/i.test(n));
  if (offending.length) {
    failures.push('the Reports workbook adds an activity-log sheet (' + offending.join(', ') +
      ') - that breaks the export-first delete guard on the Activity Logs tab. ' +
      'Move the guard to a persisted flag before adding it.');
  }
}

// The retention reminder must have somewhere to render. It is the only thing
// that tells anyone pruning is due, because nothing runs on a schedule.
{
  const dash = read('teacher-dashboard.html');
  const js = read('activity-tracker/js/activity-admin.js');
  const calls = /retentionNudge\s*\(/.test(js);
  const mounts = dash.includes('id="activityRetentionBanner"');
  if (calls && !mounts) {
    failures.push('activity-admin.js calls retentionNudge() but teacher-dashboard.html has no ' +
      '#activityRetentionBanner - the reminder renders nowhere.');
  }
  if (mounts && !calls) {
    failures.push('#activityRetentionBanner exists but nothing calls retentionNudge() - ' +
      'the reminder never fires.');
  }
}

// ── The v2 Overview is what a teacher sees ───────────────────────────────
// dashboard-v2.css hides the legacy Overview outright:
//     body.t2-active #tab-overview > #alertSummaryGrid,
//     body.t2-active #tab-overview > #alertDetailPanel { display: none; }
// and overview-v2.js adds `t2-active` unconditionally. So anything built into
// those two containers renders NOWHERE, with nothing to warn you: the JS finds
// its element, writes to it, and the page never shows it. That already cost a
// whole feature once.
{
  const dash = read('teacher-dashboard.html');
  const v2js = read('teacher/js/overview-v2.js');
  const v2css = read('teacher/css/dashboard-v2.css');

  const unconditional = /document\.body\.classList\.add\('t2-active'\)/.test(v2js);
  const hidesLegacy = /body\.t2-active[^{]*#alertSummaryGrid/.test(v2css);

  if (unconditional && hidesLegacy) {
    // The essays band is the live one. If it exists in the legacy panel but
    // not in the v2 panel, it is invisible.
    const legacyOnly = /id="alertCardEssays"|id="essaysWaitingCard"/.test(dash);
    const inV2 = dash.includes('id="t2essaysBand"');
    if (legacyOnly && !inV2) {
      failures.push('essays cards exist only in the legacy Overview, which ' +
        'body.t2-active hides - they render nowhere. Put the band in the v2 ' +
        'Needs Attention panel (#t2essaysBand).');
    }
    if (inV2 && !/renderEssaysBand/.test(v2js)) {
      failures.push('#t2essaysBand is in the page but overview-v2.js never ' +
        'renders it - the band would always be empty.');
    }
    // THE RACE. renderOverviewV2() runs once, after loadDashboard. The
    // writingSubmissions snapshot arrives later on its own listener, so
    // without a refresh hook the band is drawn against an empty map, hides
    // itself, and is never drawn again however many essays are waiting.
    if (inV2) {
      const exposes = /window\.LLRefreshEssaysBand\s*=/.test(v2js);
      const calls = /LLRefreshEssaysBand\(\)/.test(read('assignments/js/teacher-assignments.js'));
      if (!exposes) {
        failures.push('overview-v2.js no longer exposes LLRefreshEssaysBand - the ' +
          'essays band cannot be refreshed when writingSubmissions arrive.');
      }
      if (!calls) {
        failures.push('the writingSubmissions listener does not call ' +
          'LLRefreshEssaysBand() - the band will stay hidden even with essays waiting.');
      }
    }
    // One definition of the count, used by both.
    const act = read('teacher/js/activity.js');
    if (!/window\.LLEssaysWaiting\s*=/.test(act)) {
      failures.push('LLEssaysWaiting() is gone from activity.js - overview-v2.js ' +
        'calls it, so the band would silently show nothing.');
    }
  }
}

// The dead file must stay dead, or it becomes a second source of truth.
const DEAD = 'activity-logs-tab.html';
if (fs.existsSync(path.join(ROOT, DEAD))) {
  const referenced = ['teacher-dashboard.html', 'student-dashboard.html', 'index.html']
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .some((f) => read(f).includes(DEAD));
  if (!referenced && /activityRetentionNote|activityPruneBtn/.test(read(DEAD))) {
    failures.push(DEAD + ' is referenced by nothing yet carries retention controls - ' +
      'they render nowhere. Put them in teacher-dashboard.html.');
  }
}

if (failures.length) {
  console.log('FAIL - ' + failures.length + ' problem(s):');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('  ' + NEEDED.length + ' ids present, ' + HANDLERS.length + ' handlers defined');
console.log('\nPASS - the Activity Logs controls live in the page that renders.');
