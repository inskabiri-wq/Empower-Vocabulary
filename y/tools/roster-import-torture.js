#!/usr/bin/env node
/**
 * tools/roster-import-torture.js
 *
 * THE RECEPTIONIST TEST.
 *
 * The roster that arrives before a semester is not a clean export. It is
 * whatever the office had: a banner row above the headers, Turkish column
 * names, three class sheets pasted under each other so the header repeats, a
 * cover tab in front of the data, levels written as "Pre-Intermediate", class
 * codes written as "A-101", and a handful of students with no email at all.
 *
 * This builds real .xlsx and .csv files for each of those situations and runs
 * them through the SHIPPED parse and validate path from
 * teacher/js/roster-import.js - not a retyped copy - then asserts what came
 * out. A case that cannot be parsed is not automatically a failure; being told
 * clearly WHY is an acceptable outcome. Silently importing the wrong thing is
 * not, and that is what most of these assertions are guarding.
 *
 * Run:  node tools/roster-import-torture.js
 *       node tools/roster-import-torture.js --keep   (leave the files on disk)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const XLSX = require(path.join(ROOT, 'teacher/js/vendor/xlsx.full.min.js'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-torture-'));

// ── Load the shipped module in a stubbed browser ────────────────────────
// roster-import.js is an IIFE that wires DOM listeners at the end. Give it
// just enough of a document that it runs, then take the pure functions it
// exposes on window.RosterImport.
function loadModule() {
  const src = fs.readFileSync(path.join(ROOT, 'teacher/js/roster-import.js'), 'utf8');
  const noop = () => {};
  const el = () => ({
    addEventListener: noop, appendChild: noop, insertBefore: noop, removeChild: noop,
    style: {}, classList: { add: noop, remove: noop }, parentNode: null,
    setAttribute: noop, textContent: '', innerHTML: '', value: '', files: []
  });
  const document = {
    readyState: 'complete',
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: el,
    addEventListener: noop,
    head: el(), body: el()
  };
  const sandbox = {
    // addEventListener included because the module registers a beforeunload
    // guard at load time. A bare {} threw here and the whole suite died on
    // import, which looked like a product failure and was a stub gap.
    window: { addEventListener: noop, removeEventListener: noop },
    document, XLSX, console,
    setTimeout, clearTimeout, Promise, FileReader: function () {},
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: 'node' }, location: { origin: 'https://example' }
  };
  sandbox.window.document = document;
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'roster-import.js' });
  const RI = sandbox.window.RosterImport;
  if (!RI || !RI.rowsFromAoa) throw new Error('roster-import.js did not expose the pure API');
  return RI;
}
const RI = loadModule();

// ── Fixture helpers ─────────────────────────────────────────────────────
function writeBook(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, aoa] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  }
  const file = path.join(OUT, name);
  // COMPRESSION ON, deliberately. SheetJS writes zips STORED by default,
  // which produces a file far cleaner than anything Excel makes: 4.5%
  // control bytes in the first 512 against a real workbook's 19.3%. A
  // format sniffer that rejected every genuine .xlsx passed this suite
  // because the fixtures were not representative. They are now.
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }));
  return file;
}
function writeCsv(name, text) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

// Run a file through the shipped path exactly as parseFile does, including
// the format sniffer that runs before SheetJS is allowed near it.
function run(file, kind) {
  const buf = fs.readFileSync(file);
  const why = RI.describeFile(buf, path.basename(file));
  if (why) throw new Error(why);
  let wb;
  try { wb = XLSX.read(buf, { type: 'buffer' }); }
  catch (e) { throw new Error('could not be opened as a spreadsheet (' + e.message + ')'); }
  if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw new Error('no sheets');
  const sheet = RI.pickSheet(wb);
  if (!sheet || !sheet.cells) throw new Error('every sheet is empty');
  const out = RI.rowsFromAoa(sheet.aoa, kind || 'student');
  const v = RI.validateRows(out.rows, kind || 'student');
  return { sheetName: sheet.name, mapping: out.mapping, notes: out.notes,
           rows: out.rows, clean: v.clean, problems: v.problems, excluded: v.excluded };
}
function writeRaw(name, bytes) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}

// ── The cases ───────────────────────────────────────────────────────────
const HDR_EN = ['Name', 'Email', 'Student No', 'Class', 'Level'];
const HDR_TR = ['ADI SOYADI', 'E-POSTA', 'ÖĞRENCİ NO', 'SINIF', 'SEVİYE'];
const R = (n, e, no, c, l) => [n, e, no, c, l];

const cases = [];
const add = (name, build, check) => cases.push({ name, build, check });

// THE REGRESSION THAT SHIPPED. A format sniffer meant to catch binary junk
// counted control bytes and tripped at 10%. A real Excel workbook is a
// DEFLATE-compressed zip and measures around 19%, so every genuine .xlsx was
// refused with "That file is not a spreadsheet" - both sheets, every time.
// This asserts the sniffer stays silent on a compressed workbook.
add('a REAL compressed .xlsx is never refused by the format sniffer',
  () => writeBook('compressed.xlsx', [['Sheet1', [HDR_EN,
    R('Ali Veli', 'ali@fsm.edu.tr', '120210101', 'A101', 'B1')]]]),
  r => {
    const buf = fs.readFileSync(path.join(OUT, 'compressed.xlsx'));
    let ctrl = 0;
    for (let i = 0; i < Math.min(buf.length, 512); i++) {
      const c = buf[i];
      if (c === 0 || c < 9 || (c > 13 && c < 32)) ctrl++;
    }
    const pct = Math.round(ctrl / Math.min(buf.length, 512) * 1000) / 10;
    return [
      [RI.describeFile(buf, 'compressed.xlsx') === null,
       'the sniffer passes it (it is ' + pct + '% control bytes): ' +
       JSON.stringify(RI.describeFile(buf, 'compressed.xlsx'))],
      [pct > 10, 'the fixture is genuinely dense (' + pct +
       '%), so this test would have caught the bug'],
      [r.clean.length === 1, 'and it actually imports, got ' + r.clean.length]
    ];
  });

add('clean English headers',
  () => writeBook('clean.xlsx', [['Sheet1', [HDR_EN,
    R('Ali Veli', 'ali@fsm.edu.tr', '120210101', 'A101', 'B1'),
    R('Ayse Kaya', 'ayse@fsm.edu.tr', '120210102', 'A101', 'B1')]]]),
  r => [[r.clean.length === 2, 'both rows clean, got ' + r.clean.length],
        [r.problems.length === 0, 'no problems']]);

add('Turkish headers',
  () => writeBook('tr.xlsx', [['Sayfa1', [HDR_TR,
    R('Mehmet Yilmaz', 'mehmet@fsm.edu.tr', '120210103', 'B202', 'B1+'),
    R('Zeynep Ak', 'zeynep@fsm.edu.tr', '120210104', 'B202', 'B2')]]]),
  r => [[r.clean.length === 2, 'both rows clean, got ' + r.clean.length],
        [r.clean[0].studentNo === '120210103', 'student no read, got ' + r.clean[0].studentNo]]);

add('banner + blank rows above the header',
  () => writeBook('banner.xlsx', [['Sheet1', [
    ['FATIH SULTAN MEHMET VAKIF UNIVERSITESI'], [], ['2026 Guz Donemi Ogrenci Listesi'], [],
    HDR_TR, R('Ali Veli', 'ali@fsm.edu.tr', '120210101', 'A101', 'B1')]]]),
  r => [[r.clean.length === 1, 'found the row under the banner, got ' + r.clean.length]]);

add('columns in a random order + extra junk columns',
  () => writeBook('shuffled.xlsx', [['Sheet1', [
    ['NO', 'SINIF', 'E-POSTA', 'TELEFON', 'ADI SOYADI', 'SEVIYE', 'NOTLAR'],
    ['1', 'A101', 'ali@fsm.edu.tr', '05551112233', 'Ali Veli', 'B1', 'kayit yenileme'],
    ['2', 'A101', 'ayse@fsm.edu.tr', '05551112244', 'Ayse Kaya', 'B1', '']]]]),
  r => [[r.clean.length === 2, 'both rows clean, got ' + r.clean.length],
        [r.clean[0].email === 'ali@fsm.edu.tr', 'email column right, got ' + r.clean[0].email],
        [r.clean[0].name === 'Ali Veli', 'name column right, got ' + r.clean[0].name]]);

add('row-number column must not be mistaken for the student number',
  () => writeBook('rowno.xlsx', [['Sheet1', [
    ['NO', 'ADI SOYADI', 'E-POSTA', 'ÖĞRENCİ NO', 'SINIF'],
    ['1', 'Ali Veli', 'ali@fsm.edu.tr', '120210101', 'A101'],
    ['2', 'Ayse Kaya', 'ayse@fsm.edu.tr', '120210102', 'A101']]]]),
  r => [[r.clean[0].studentNo === '120210101', 'took the real student no, got ' + r.clean[0].studentNo]]);

add('level written as words, and lower case',
  () => writeBook('levels.xlsx', [['Sheet1', [HDR_EN,
    R('A', 'a@fsm.edu.tr', '1202101', 'A101', 'Pre-Intermediate'),
    R('B', 'b@fsm.edu.tr', '1202102', 'A101', 'upper intermediate'),
    R('C', 'c@fsm.edu.tr', '1202103', 'A101', 'b1+'),
    R('D', 'd@fsm.edu.tr', '1202104', 'A101', 'Elementary')]]]),
  r => [[r.clean.map(c => c.level).join(',') === 'B1,B2,B1+,A2',
         'levels normalised, got ' + r.clean.map(c => c.level).join(',')],
        [r.problems.filter(p => p.field === 'level').length === 0, 'no level warnings']]);

add('student number stored as a NUMBER, not text',
  () => writeBook('numeric.xlsx', [['Sheet1', [HDR_EN,
    ['Ali Veli', 'ali@fsm.edu.tr', 120210101, 'A101', 'B1']]]]),
  r => [[r.clean.length === 1 && r.clean[0].studentNo === '120210101',
         'numeric student no survived, got ' + (r.clean[0] || {}).studentNo]]);

add('messy emails: spaces, capitals, angle brackets, trailing semicolon',
  () => writeBook('emails.xlsx', [['Sheet1', [HDR_EN,
    R('A', '  ALI@FSM.EDU.TR  ', '1202101', 'A101', 'B1'),
    R('B', 'Bahar Kaya <bahar@fsm.edu.tr>', '1202102', 'A101', 'B1'),
    R('C', 'can@fsm.edu.tr;', '1202103', 'A101', 'B1'),
    R('D', 'mailto:demir@fsm.edu.tr', '1202104', 'A101', 'B1')]]]),
  r => [[r.clean.length === 4, 'all four addresses recovered, got ' + r.clean.length +
         ' (problems: ' + r.problems.map(p => p.issue).join(' | ') + ')'],
        [r.clean.map(c => c.email).join(',') ===
         'ali@fsm.edu.tr,bahar@fsm.edu.tr,can@fsm.edu.tr,demir@fsm.edu.tr',
         'addresses normalised, got ' + r.clean.map(c => c.email).join(',')]]);

add('blank rows scattered through the data',
  () => writeBook('gaps.xlsx', [['Sheet1', [HDR_EN,
    R('A', 'a@fsm.edu.tr', '1202101', 'A101', 'B1'), [], [],
    R('B', 'b@fsm.edu.tr', '1202102', 'A101', 'B1'), [],
    R('C', 'c@fsm.edu.tr', '1202103', 'A101', 'B1')]]]),
  r => [[r.clean.length === 3, 'three rows, blanks skipped, got ' + r.clean.length],
        [r.problems.length === 0, 'blank rows raised no problems']]);

add('three class sheets pasted together, so the header repeats',
  () => writeBook('repeated-header.xlsx', [['Sheet1', [HDR_TR,
    R('A', 'a@fsm.edu.tr', '1202101', 'A101', 'B1'),
    HDR_TR,
    R('B', 'b@fsm.edu.tr', '1202102', 'A102', 'B1'),
    HDR_TR,
    R('C', 'c@fsm.edu.tr', '1202103', 'A103', 'B1')]]]),
  r => [[r.clean.length === 3, 'three students, got ' + r.clean.length],
        [r.problems.length === 0, 'repeated headers did not become errors, got: ' +
         r.problems.map(p => p.issue).join(' | ')]]);

add('cover tab in front of the data',
  () => writeBook('cover.xlsx', [
    ['Kapak', [['OGRENCI ISLERI'], ['Bu dosya 2026 guz donemi icindir.']]],
    ['Ogrenciler', [HDR_TR, R('Ali Veli', 'ali@fsm.edu.tr', '1202101', 'A101', 'B1')]]]),
  r => [[r.sheetName === 'Ogrenciler', 'picked the data sheet, got "' + r.sheetName + '"'],
        [r.clean.length === 1, 'one row, got ' + r.clean.length]]);

add('duplicate email appears twice',
  () => writeBook('dupes.xlsx', [['Sheet1', [HDR_EN,
    R('Ali Veli', 'ali@fsm.edu.tr', '1202101', 'A101', 'B1'),
    R('Ali Veli', 'ALI@fsm.edu.tr', '1202101', 'A101', 'B1')]]]),
  r => [[r.clean.length === 1, 'kept one, got ' + r.clean.length],
        [r.problems.some(p => /duplicate/.test(p.issue)), 'flagged the duplicate']]);

add('students with no email at all are excluded, not blocking',
  () => writeBook('noemail.xlsx', [['Sheet1', [HDR_EN,
    R('Ali Veli', 'ali@fsm.edu.tr', '1202101', 'A101', 'B1'),
    R('Gizli Ogrenci', '', '1202102', 'A101', 'B1'),
    R('Baska Ogrenci', '', '1202103', 'A101', 'B1')]]]),
  r => [[r.clean.length === 1, 'one importable, got ' + r.clean.length],
        [r.excluded.length === 2, 'two excluded, got ' + r.excluded.length],
        [r.problems.filter(p => !p.warn).length === 0, 'no HARD problems, so commit is not blocked']]);

add('odd class codes',
  () => writeBook('classes.xlsx', [['Sheet1', [HDR_EN,
    R('A', 'a@fsm.edu.tr', '1202101', 'A101', 'B1'),
    R('B', 'b@fsm.edu.tr', '1202102', 'A-101', 'B1'),
    R('C', 'c@fsm.edu.tr', '1202103', 'HAZ3', 'B1'),
    R('D', 'd@fsm.edu.tr', '1202104', '9-C', 'B1')]]]),
  r => [[r.clean.length === 4, 'all four kept, got ' + r.clean.length],
        [r.problems.every(p => p.warn), 'unusual class codes are WARNINGS, not blockers']]);

add('no recognisable headers at all, content must carry it',
  () => writeBook('noheaders.xlsx', [['Sheet1', [
    ['Ali Veli', 'ali@fsm.edu.tr', '120210101', 'A101', 'B1'],
    ['Ayse Kaya', 'ayse@fsm.edu.tr', '120210102', 'A101', 'B1']]]]),
  r => [[r.clean.length >= 1, 'recovered rows from content alone, got ' + r.clean.length],
        [r.clean[0] && r.clean[0].email === 'ali@fsm.edu.tr', 'email found by content']]);

add('a comma CSV',
  () => writeCsv('plain.csv', 'Name,Email,Student No,Class,Level\nAli Veli,ali@fsm.edu.tr,120210101,A101,B1\n'),
  r => [[r.clean.length === 1, 'one row, got ' + r.clean.length]]);

add('a SEMICOLON CSV, which is what Turkish Excel exports',
  () => writeCsv('semi.csv', 'ADI SOYADI;E-POSTA;ÖĞRENCİ NO;SINIF;SEVİYE\nAli Veli;ali@fsm.edu.tr;120210101;A101;B1\n'),
  r => [[r.clean.length === 1, 'one row, got ' + r.clean.length],
        [r.clean[0] && r.clean[0].email === 'ali@fsm.edu.tr', 'email parsed, got ' + (r.clean[0]||{}).email]]);

add('completely empty workbook',
  () => writeBook('empty.xlsx', [['Sheet1', [[]]]]),
  null, true);

add('a sheet of something else entirely (no names, no emails)',
  () => writeBook('wrong.xlsx', [['Sheet1', [
    ['Urun', 'Adet', 'Fiyat'], ['Kalem', 10, 5], ['Defter', 3, 20]]]]),
  null, true);

// ── The class/instructor MATRIX, which is what a department actually keeps ──
// Modelled on the real "MODULE 4 INSTRUCTORS & CLASSES.xlsx": one row per
// class, three instructor columns, contact hours in brackets, two teachers
// sharing a cell, and a repeated MC1/MC2/MC3 header partway down.
const MATRIX = [
  [], ['2025-2026 CLASSES and INSTRUCTORS'], [],
  ['', 'CLASS', 'MAIN COURSE (12)', 'MAIN COURSE (6)', 'MAIN COURSE (5)', 'LEVEL'],
  [1, 'D-302', ' Zach ', 'Asel', 'Büşra', 'PRE-INT.'],
  [2, 'D-303', 'Asel ', 'Zach ', 'Gizem', 'PRE-INT.'],
  [3, 'D-306', 'Jade (10) /Z Ceyda(2)', ' Zeynep Y (11)', '', 'INTER'],
  ['', '', 'MC1', 'MC2', 'MC3', ''],
  [4, 'B-117', 'Sema ', 'Max', 'Alireza / Elif Ç (1)', 'UPPER'],
  [5, 'B-214', 'Pelin  (10) /Derya (2)', 'Abdulrauf', 'Ceyda Ö', 'PRE-ADVANCED']
];

cases.push({
  name: 'a class/instructor MATRIX (one row per class, 3 teacher columns)',
  build: () => writeBook('matrix.xlsx', [['16 Classes', MATRIX]]),
  kind: 'teacher',
  check: r => {
    const by = n => r.rows.find(x => x.name === n) || {};
    return [
      // 15, counted from the fixture: 3 in D-302, +Gizem in D-303, +3 in
      // D-306, +4 in B-117, +4 in B-214. Distinct people, not appearances -
      // Zach and Asel each teach two of these classes.
      [r.rows.length === 15, '15 distinct teachers, got ' + r.rows.length + ': ' + r.rows.map(x => x.name).join('|')],
      [!r.rows.some(x => /\(/.test(x.name)), 'contact hours stripped from names'],
      [!!by('Pelin').name && !!by('Derya').name, 'a shared cell became two people'],
      [!r.rows.some(x => /^MC\d$/.test(x.name)), 'the repeated MC1/MC2/MC3 header was skipped'],
      // Canonical: the timetable writes "D-302", the student list writes
      // "D302", and both have to end up naming the same room.
      [by('Zach').class === 'D302,D303', 'a teacher keeps every class, got ' + by('Zach').class],
      [by('Sema').level === 'B2', 'UPPER normalised to B2, got ' + by('Sema').level],
      [by('Büşra').level === 'B1', 'single-level teacher keeps it, got ' + by('Büşra').level],
      [r.problems.filter(p => !p.warn).length === 0, 'nothing BLOCKS the import'],
      [r.excluded.length === r.rows.length, 'every row excluded for no email, got ' + r.excluded.length]
    ];
  }
});

// THE TWO SHEETS MUST AGREE WITH EACH OTHER.
//
// The real pair for one module does not: the student list writes D302, the
// instructors timetable writes D-302, and ZERO of sixteen classes matched.
// That creates every class twice, so teachers end up in classes with no
// students. Nothing errors; it is just wrong, after 300 accounts exist.
cases.push({
  name: 'class codes are canonical, so both sheets name the same room',
  build: () => writeBook('classcodes.xlsx', [['Sheet1', [HDR_EN,
    R('A', 'a@fsm.edu.tr', '1202101', 'D-302', 'B1'),
    R('B', 'b@fsm.edu.tr', '1202102', 'd 302', 'B1'),
    R('C', 'c@fsm.edu.tr', '1202103', 'D302', 'B1'),
    R('D', 'd@fsm.edu.tr', '1202104', 'B/117', 'B2')]]]),
  check: r => {
    const codes = [...new Set(r.clean.map(c => c.class))].sort();
    return [
      [r.clean.length === 4, 'all four kept, got ' + r.clean.length],
      [codes.join(',') === 'B117,D302',
       'three spellings collapse to one room, got ' + codes.join(',')],
      [r.problems.filter(p => p.field === 'class').length === 0,
       'canonical codes raise no "unusual class code" warning']
    ];
  }
});

cases.push({
  name: 'a MATRIX and a student list end up naming the same classes',
  build: () => writeBook('agree.xlsx', [['16 Classes', MATRIX]]),
  kind: 'teacher',
  check: r => {
    const tc = [...new Set(r.rows.flatMap(x => String(x.class).split(',')))].filter(Boolean);
    return [
      [tc.every(c => /^[A-Z0-9]+$/.test(c)),
       'teacher classes are canonical too, got ' + tc.join(',')],
      [tc.indexOf('D302') !== -1,
       'the timetable\'s "D-302" became "D302", got ' + tc.join(',')]
    ];
  }
});

cases.push({
  name: 'the same people once an Email column is added',
  build: () => writeBook('matrix-filled.xlsx', [['Teachers', [
    ['name', 'email', 'class', 'level'],
    ['Zach', 'zach@fsm.edu.tr', 'D-302,D-303', 'B1'],
    ['Asel', 'asel@fsm.edu.tr', 'D-302,D-303', 'B1'],
    ['Pelin', 'pelin@fsm.edu.tr', 'B-214', 'C1']]]]),
  kind: 'teacher',
  check: r => [
    [r.clean.length === 3, '3 importable, got ' + r.clean.length],
    [(r.clean.find(c => c.name === 'Zach') || {}).classes.length === 2,
     'the comma class list splits back into two, got ' +
     JSON.stringify((r.clean.find(c => c.name === 'Zach') || {}).classes)],
    [!r.mapping._matrix, 'a normal list is NOT mistaken for a matrix']
  ]
});

// ── The formats the office actually sends that are NOT spreadsheets ─────
// None of these can be imported. What is being asserted is that each one is
// refused with a sentence naming the FIX, not a parser stack trace. The
// message is checked, because "it threw" is not the same as "it helped".
function addRefusal(name, build, mustSay) {
  cases.push({ name, build, check: null, mustSay });
}

// OLE2 magic - the pre-2007 binary .xls (also what .doc and .ppt start with).
addRefusal('a real .xls (pre-2007 binary), even named .xlsx',
  () => writeRaw('legacy.xlsx', [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...new Array(200).fill(0)]),
  /Save As.*xlsx/i);

// A zip whose local file header sets the encryption bit.
addRefusal('a password-protected workbook',
  () => {
    const b = [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00];   // PK.. flags=0x0001
    return writeRaw('locked.xlsx', b.concat(new Array(200).fill(0)));
  },
  /password/i);

addRefusal('a Google Sheets link saved as a file',
  () => writeCsv('link.csv', 'https://docs.google.com/spreadsheets/d/1AbCdEf/edit#gid=0\n'),
  /Download.*Excel/i);

addRefusal('a saved web page instead of a sheet',
  () => writeCsv('page.csv', '<!DOCTYPE html><html><head><title>Roster</title></head><body>...</body></html>'),
  /web page|Download/i);

addRefusal('a PDF of the roster',
  () => writeRaw('roster.pdf', Array.from(Buffer.from('%PDF-1.7\n%stuff\n'))),
  /PDF/i);

addRefusal('a Word document',
  () => writeRaw('roster.docx', [0x50, 0x4B, 0x03, 0x04].concat(new Array(200).fill(0))),
  /Word|spreadsheet/i);

addRefusal('a zero-byte file',
  () => writeRaw('empty.csv', []),
  /empty|0 bytes/i);

addRefusal('random binary junk',
  () => writeRaw('junk.xlsx', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 200, 201, 202]),
  /could not be opened|spreadsheet/i);

// ── Run ─────────────────────────────────────────────────────────────────
let pass = 0, fail = 0, threw = 0;
const failures = [];

for (const c of cases) {
  const expectThrow = c.check === null;
  let file, r, err = null;
  try { file = c.build(); } catch (e) { console.log('  BUILD FAILED ' + c.name + ': ' + e.message); fail++; continue; }
  try { r = run(file, c.kind); } catch (e) { err = e; }

  if (expectThrow) {
    if (!err) {
      console.log('  FAIL  ' + c.name + '  -> should have been refused, but returned ' + r.clean.length + ' rows');
      fail++; failures.push(c.name); continue;
    }
    // Being refused is not enough. The message has to name the fix.
    if (c.mustSay && !c.mustSay.test(err.message)) {
      console.log('  FAIL  ' + c.name + '  -> refused, but unhelpfully: "' + err.message.slice(0, 90) + '"');
      console.log('          expected the message to match ' + c.mustSay);
      fail++; failures.push(c.name); continue;
    }
    console.log('  ok    ' + c.name + '\n          -> "' + err.message.slice(0, 96) + '"');
    pass++;
    continue;
  }
  if (err) {
    console.log('  THREW ' + c.name + '  -> ' + err.message);
    threw++; failures.push(c.name + ' (threw)');
    continue;
  }
  const checks = c.check(r);
  const bad = checks.filter(x => !x[0]);
  if (bad.length) {
    console.log('  FAIL  ' + c.name);
    bad.forEach(b => console.log('          - ' + b[1]));
    fail++; failures.push(c.name);
  } else {
    console.log('  ok    ' + c.name);
    pass++;
  }
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed, ' + threw + ' threw unexpectedly');
if (process.argv.includes('--keep')) console.log('  fixtures kept in ' + OUT);
else { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {} }

if (fail + threw) {
  console.log('\nFAIL - ' + failures.length + ' case(s): ' + failures.join(', '));
  process.exit(1);
}
console.log('\nPASS - every roster shape survived the import path.');
