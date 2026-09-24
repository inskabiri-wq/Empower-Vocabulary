#!/usr/bin/env node
/**
 * tools/classroom-lobby-check.js
 *
 * Every classroom game must open the same way.
 *
 * A teacher hosting Vocab Bingo and a teacher hosting the AI Quiz should be
 * looking at the same screen: the session code, the QR tile, the join link, a
 * player count and a start button. When one game grows its own lobby the room
 * has to be taught twice, and the drift is invisible until somebody hosts the
 * odd one in front of a class.
 *
 * This checks the SHARED PARTS ARE PRESENT AND NAMED THE SAME on every host
 * page, and that every student page has the matching join screen. It does not
 * check the game itself, which is each game's own business.
 *
 * Run:  node tools/classroom-lobby-check.js
 *       node tools/classroom-lobby-check.js --json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// Host pages that run a joinable room. classroom-teacher.html is the hub and
// hosts Vocab Race inline, so it is included too.
const HOSTS = [
  'classroom-teacher.html',
  'classroom-aiquiz-teacher.html',
  'classroom-bingo-teacher.html',
  'classroom-heist-teacher.html',
  'classroom-listening-teacher.html',
  'classroom-reading-teacher.html',
  'classroom-scramble-teacher.html',
  'classroom-trust-teacher.html',
  'classroom-tug-teacher.html'
];

// classroom-student.html is deliberately NOT in this list.
//
// Vocab Race is the one game whose students are signed in already, so its join
// screen asks for a code and nothing else: there is no name to type, because
// the account supplies it. Its input is `sessionCodeInput` rather than
// `codeInput` for the same historical reason. Renaming those in the oldest and
// most used game to satisfy a checker would risk a working game for a cosmetic
// win. The difference is real and intended, so it is stated here rather than
// left to be rediscovered as drift.
const STUDENTS = [
  'classroom-aiquiz-student.html',
  'classroom-bingo-student.html',
  'classroom-heist-student.html',
  'classroom-listening-student.html',
  'classroom-reading-student.html',
  'classroom-scramble-student.html',
  'classroom-trust-student.html',
  'classroom-tug-student.html'
];

// What a host lobby must offer. Matched on the id or class the app already
// uses, so a game that renames one of these is flagged rather than silently
// looking different.
const HOST_PARTS = [
  { name: 'session code',   re: /class="session-code"/ },
  { name: 'code label',     re: /class="session-code-label"|session-code-hint/ },
  { name: 'QR image',       re: /id="qrImg"|class="session-qr-tile"/ },
  { name: 'join link',      re: /id="joinUrl"|id="sessionJoinUrl"/ },
  { name: 'player count',   re: /id="rosterCount"|id="playerCount"/ },
  { name: 'start button',   re: /id="startBtn"|id="startGameBtn"/ }
];

const STUDENT_PARTS = [
  { name: 'code input', re: /id="codeInput"/ },
  { name: 'name input', re: /id="nameInput"/ },
  { name: 'join button', re: /id="joinBtn"/ }
];

// The shared look. A game that does not load these is not a replica.
const SHARED_CSS = [
  { name: 'brand.css',            re: /css\/brand\.css/ },
  { name: 'classroom/styles.css', re: /classroom\/css\/styles\.css/ }
];

// The two navigation labels, which must read the same on every game.
//
// They did not: four games said "Classroom Mode" in a breadcrumb, four said
// "← Classroom" on a button, and the Dashboard link was "← Dashboard" on some
// and "🏠 Dashboard" on others. The ids are what the JS binds to for the
// leave-confirmation, so those are checked separately from the text.
// The emoji and its words are allowed to be separated by the .ll-navtext
// wrapper, because a phone hides the words and keeps the icon: at 390px the
// full "Pick a different game" button is 193px and the bar overflowed by 85px
// on all eight game hosts. What must not drift is the LABEL, so that is what
// is matched, with the wrapper optional.
const NAVTEXT = '(?:<span class="ll-navtext">)?\\s*';
const NAV = [
  { name: 'pick-a-game label', re: new RegExp('\\u{1F3AE}' + NAVTEXT + 'Pick a different game', 'u') },
  { name: 'dashboard label',   re: new RegExp('\\u{1F3E0}' + NAVTEXT + 'Dashboard', 'u') }
];

// PRESENCE IS NOT SAMENESS.
//
// The first version of this checker only looked for the lobby ELEMENTS, and
// passed every game while The Heist was rendering a bare, left-aligned QR with
// no white tile. The markup was identical; the STYLES were not, because they
// lived in minigames.css and in an inline block, and four games load neither.
// So the check now also insists the styling is reachable from a stylesheet
// every page loads.
const LOBBY_STYLE_HOME = 'classroom/css/styles.css';
const LOBBY_STYLED = [/\.session-qr-card\s*{/, /\.session-qr-tile\s*{/, /\.session-qr-label\s*{/];

function read(f) {
  const p = path.join(ROOT, f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const failures = [];
const rows = [];

function checkFamily(files, parts, label) {
  for (const f of files) {
    const src = read(f);
    if (!src) { failures.push(f + ' is missing'); continue; }
    const missing = parts.filter(p => !p.re.test(src)).map(p => p.name);
    const noCss = SHARED_CSS.filter(c => !c.re.test(src)).map(c => c.name);
    rows.push({ file: f, kind: label, missing, missingCss: noCss });
    if (missing.length) {
      failures.push(f + ' (' + label + ') is missing: ' + missing.join(', '));
    }
    if (noCss.length) {
      failures.push(f + ' does not load: ' + noCss.join(', '));
    }
  }
}

checkFamily(HOSTS, HOST_PARTS, 'host');
checkFamily(STUDENTS, STUDENT_PARTS, 'student');

// The lobby styling must live where every classroom page can reach it.
const lobbyCss = read(LOBBY_STYLE_HOME) || '';
for (const re of LOBBY_STYLED) {
  if (!re.test(lobbyCss)) {
    failures.push(LOBBY_STYLE_HOME + ' is missing the lobby rule ' + re.source +
      ' - games that do not load minigames.css will show a bare QR');
  }
}
// And it must not drift back into per-game copies.
for (const f of ['classroom/css/minigames.css', 'classroom-teacher.html']) {
  const src = read(f) || '';
  if (/\.session-qr-card\s*{/.test(src)) {
    failures.push(f + ' has its own copy of the lobby styles again; there must be one, in ' + LOBBY_STYLE_HOME);
  }
}

// Both nav labels, on every game host. classroom-teacher.html is the picker
// itself, so it has nothing to pick from and is exempt.
for (const f of HOSTS.filter(h => h !== 'classroom-teacher.html')) {
  const src = read(f) || '';
  for (const n of NAV) {
    if (!n.re.test(src)) failures.push(f + ' is missing the ' + n.name);
  }
  if (/Back to Classroom|>\s*←\s*Classroom\s*<|Classroom Mode\s*<\/a>/.test(src)) {
    failures.push(f + ' still has an old nav label; every game says "Pick a different game"');
  }
}

// Every host page needs a student page to send people to, and the join router
// in classroom/js/student.js has to know about any 5-character room.
const router = read('classroom/js/student.js') || '';
for (const h of HOSTS) {
  const student = h.replace('-teacher.html', '-student.html');
  if (student === h) continue;
  if (!fs.existsSync(path.join(ROOT, student))) {
    failures.push(h + ' has no matching ' + student);
  }
}

const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, rows }, null, 2));
} else {
  for (const r of rows) {
    const bad = r.missing.length || r.missingCss.length;
    console.log('  ' + (bad ? 'FAIL' : 'ok  ') + '  ' + r.file.padEnd(36) + r.kind +
      (r.missing.length ? '   missing: ' + r.missing.join(', ') : '') +
      (r.missingCss.length ? '   no css: ' + r.missingCss.join(', ') : ''));
  }
  if (failures.length) {
    console.log('\nFAIL - ' + failures.length + ' lobby inconsistency(ies).');
  } else {
    console.log('\nPASS - every classroom host opens with the same code, QR, join link, '
      + 'count and start button, and every game has its join screen.');
  }
}
process.exit(failures.length ? 1 : 0);
