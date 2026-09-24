#!/usr/bin/env node
/**
 * tools/profile-hub-check.js
 *
 * The profile hub has to be on EVERY page a signed-in student works in, and
 * the things it replaced have to be gone from those pages. Checking the module
 * in isolation cannot see either of those, which is exactly how a change like
 * this normally goes wrong: twelve pages get it, the thirteenth is forgotten,
 * and nobody notices until a student cannot log out of one screen.
 *
 * Run:  node tools/profile-hub-check.js
 *       node tools/profile-hub-check.js --json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// Two families, on purpose.
//
// PROFILE pages get the avatar badge, and Display settings is a row inside the
// panel it opens, so they must NOT also carry a wheel. The badge has to be
// ANCHORED in the page's header: with no mount it falls back to floating over
// the top-right corner, which is not where a header control belongs.
//
// CLASSROOM pages are the other way round. A student in a live game does not
// need their profile there, but they do need the wheel, so it stays.
const PROFILE_PAGES = [
  'student-dashboard.html',
  'courses.html',
  'placement.html',
  'policy-course.html'
];
const CLASSROOM_PAGES = [
  'classroom-student.html',
  'classroom-bingo-student.html',
  'classroom-heist-student.html',
  'classroom-listening-student.html',
  'classroom-reading-student.html',
  'classroom-scramble-student.html',
  'classroom-trust-student.html',
  'classroom-tug-student.html',
  'classroom-aiquiz-student.html'
];
const PAGES = PROFILE_PAGES.concat(CLASSROOM_PAGES);

// Pre-login and utility pages have no signed-in student, so a profile picture
// would be meaningless. Listed so "why not this one" has an answer.
//
// writing-exam.html is excluded for a different reason worth writing down: it
// is a locked-down exam surface with its OWN settings panel (theme, text size,
// spacing, editor font) that student/js/writing-exam.js opens by id. It briefly
// had the profile hub, and removing its gear to make room threw a TypeError and
// orphaned that panel. Offering Log out in the middle of a timed exam is not a
// feature either. It keeps its own controls.
const EXCLUDED = ['index.html', 'reset-password.html', 'join.html', '404.html',
                  'fsmvu-loaders.html', 'app.html', 'writing-exam.html'];

function read(f) {
  const p = path.join(ROOT, f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const problems = [];
const rows = [];

for (const page of PAGES) {
  const src = read(page);
  if (src == null) { problems.push(page + ': file not found'); continue; }

  // A real <script> tag, NOT the bare string. This checker originally tested
  // for "js/profile-hub.js" anywhere in the file, and passed on a dashboard
  // that had no script tag at all - because a COMMENT mentioning the module
  // matched. It would have shipped the one page this whole change is about
  // with the module missing. Same trap bit the wiring script: its "already
  // done?" guard matched its own comment and skipped the insert.
  const hasHub = /<script[^>]+src=["'][^"']*js\/profile-hub\.js/.test(src);
  // And it must be versioned, or the service worker will serve a stale copy.
  const hubVersioned = /<script[^>]+src=["'][^"']*js\/profile-hub\.js\?v=\d+/.test(src);
  const hasFirebase = /firebase-init\.js/.test(src);
  const hasSettings = /js\/app-settings\.js/.test(src);
  const hasDialog   = /js\/app-dialog\.js/.test(src);
  const hasBrand    = /css\/brand\.css/.test(src);

  // Things the hub replaced. A leftover means two ways to do one thing.
  const strayLogout = (src.match(/class="logout-btn"/g) || []).length;
  const strayGear   = (src.match(/data-app-settings-open/g) || []).length;

  const isProfile = PROFILE_PAGES.includes(page);
  const hasMount  = /data-profile-hub-mount/.test(src);

  if (isProfile) {
    if (!hasHub) problems.push(page + ': no <script> tag for profile-hub.js');
    else if (!hubVersioned) problems.push(page + ': profile-hub.js has no ?v=, so it will not cache-bust');
    // Without a mount the badge floats over the corner instead of sitting in
    // the header. That is a defect, not a fallback worth shipping.
    if (!hasMount) problems.push(page + ': no [data-profile-hub-mount], the badge would float');
    // Display lives inside the panel here, so a second wheel is the duplication
    // this whole change removed.
    if (strayGear) problems.push(page + ': ' + strayGear + ' gear(s) left - Display belongs in the profile panel here');
  } else {
    // Classroom: wheel yes, profile no.
    if (hasHub)   problems.push(page + ': profile-hub.js should NOT be here, classroom keeps the wheel instead');
    if (hasMount) problems.push(page + ': leftover [data-profile-hub-mount]');
    if (!hasSettings) problems.push(page + ': no app-settings.js, this page needs the wheel');
  }
  // The module reads the user document and signs out; without Firebase it can
  // do neither, and the panel would be a shell.
  if (isProfile && !hasFirebase) problems.push(page + ': no firebase-init.js, the hub cannot read the profile');
  // Display is a row in the panel and calls AppSettings.open().
  if (isProfile && !hasSettings) problems.push(page + ': no app-settings.js, the Display row would do nothing');
  // brand.css supplies .ll-dialog and .modal-overlay - the panel's shape.
  if (!hasBrand)    problems.push(page + ': no brand.css, the panel would be unstyled');
  if (strayLogout)  problems.push(page + ': ' + strayLogout + ' leftover .logout-btn - logout belongs in the panel now');

  rows.push({
    page, kind: isProfile ? 'profile' : 'classroom',
    hub: hasHub, mount: hasMount, firebase: hasFirebase, settings: hasSettings,
    dialog: hasDialog, brand: hasBrand, strayLogout, strayGear
  });
}

// A student page that nobody added to PAGES is the failure this cannot
// otherwise see, so look for pages that smell student-facing and are neither
// listed nor deliberately excluded.
const all = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const unaccounted = all.filter(f =>
  !PAGES.includes(f) && !EXCLUDED.includes(f) &&
  !/teacher|admin|onboarding/i.test(f) &&
  /firebase-init\.js/.test(read(f) || ''));

const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify({ rows, problems, unaccounted }, null, 2));
} else {
  const w = Math.max(...rows.map(r => r.page.length)) + 2;
  console.log('page'.padEnd(w) + 'kind       hub    mount  settings  gears');
  for (const r of rows) {
    console.log(
      r.page.padEnd(w) +
      r.kind.padEnd(11) +
      (r.hub ? ' yes ' : ' no  ').padEnd(7) +
      (r.mount ? 'yes  ' : 'no   ').padEnd(7) +
      (r.settings ? ' ok  ' : 'MISS ').padEnd(10) +
      String(r.strayGear));
  }
  if (unaccounted.length) {
    console.log('\nSigned-in pages in neither the list nor the exclusions:');
    unaccounted.forEach(f => console.log('  ' + f));
  }
}

if (problems.length) {
  console.log('\nFAIL');
  problems.forEach(p => console.log('  ' + p));
  process.exit(1);
}
if (unaccounted.length) {
  console.log('\nFAIL - a student-facing page is unaccounted for. Add it to PAGES or to EXCLUDED.');
  process.exit(1);
}
console.log('\nPASS - ' + PROFILE_PAGES.length + ' profile pages anchored in a header with no stray wheel; '
  + CLASSROOM_PAGES.length + ' classroom pages keep the wheel and carry no profile.');
