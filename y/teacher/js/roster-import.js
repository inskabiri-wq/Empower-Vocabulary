/* ============================================================
   ROSTER IMPORT - admin panel (#rosterImportPanel)
   ------------------------------------------------------------
   Bulk student + teacher onboarding from two Excel/CSV sheets.

   Flow:
     1. Admin picks year + module and two files.
     2. "Validate (dry run)" parses the files IN THE BROWSER (SheetJS,
        lazy-loaded) and runs the SAME validation the Cloud Function
        runs, so problems show instantly with NO writes and NO Blaze.
     3. If there are zero hard problems, "Create / relocate accounts"
        calls the rosterImport callable (mode:'commit'), which creates
        pre-verified accounts + classes + per-module enrollments. New
        accounts come back with temp passwords, downloadable as CSV.

   The validation here MIRRORS functions/index.js. The function always
   re-validates server-side (never trusts the client) and is the sole
   writer; this is purely for instant, Blaze-free preview.

   COLUMN_MAP must match the function's COLUMN_MAP.
   ============================================================ */
(function () {
  'use strict';

  var XLSX_SRC = 'teacher/js/vendor/xlsx.full.min.js';
  var ALLOWED_LEVELS = ['A2', 'B1', 'B1+', 'B2', 'C1'];
  var CLASS_RE = /^[A-Za-z]\d{3}$/;
  var COLUMN_MAP = {
    student: { name: 'name', email: 'email', studentNo: 'studentNo', class: 'class', level: 'level' },
    teacher: { name: 'name', email: 'email', class: 'class', level: 'level' }
  };

  var state = { students: null, teachers: null, validated: false, creds: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setStatus(msg, color) { var e = $('riStatus'); if (e) { e.textContent = msg || ''; e.style.color = color || 'var(--t2-text-muted,#7d8590)'; } }

  function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function pick(row, header) {
    if (row == null || typeof row !== 'object') return '';
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];
    var want = String(header).trim().toLowerCase();
    for (var k in row) { if (Object.prototype.hasOwnProperty.call(row, k) && String(k).trim().toLowerCase() === want) return row[k]; }
    return '';
  }
  function field(row, kind, logical) { return pick(row, COLUMN_MAP[kind][logical]); }

  // Mirror of the Cloud Function's validateRows (hard problems block commit).
  function validateRows(rows, kind) {
    var clean = [], problems = [], excluded = [], seen = {};
    (rows || []).forEach(function (row, i) {
      var line = i + 2;
      var name = String(field(row, kind, 'name') || '').trim();
      var email = normEmail(field(row, kind, 'email'));
      var level = String(field(row, kind, 'level') || '').trim();
      var cls = String(field(row, kind, 'class') || '').trim();
      var studentNo = kind === 'student' ? String(field(row, kind, 'studentNo') || '').trim() : '';

      // No email = cannot create an account (email is the login key). Skip the
      // row into a separate "excluded" list instead of blocking the whole import.
      if (!email) { excluded.push({ line: line, kind: kind, name: name, reason: 'no email' }); return; }
      if (!isEmail(email)) { problems.push({ line: line, kind: kind, field: 'email', issue: 'invalid email: ' + email }); return; }
      if (!name) { problems.push({ line: line, kind: kind, field: 'name', issue: 'missing name' }); return; }
      if (kind === 'student' && !cls) { problems.push({ line: line, kind: kind, field: 'class', issue: 'missing class' }); return; }
      if (Object.prototype.hasOwnProperty.call(seen, email)) { problems.push({ line: line, kind: kind, field: 'email', issue: 'duplicate email (also line ' + seen[email] + '): ' + email }); return; }

      if (level && ALLOWED_LEVELS.indexOf(level) === -1) problems.push({ line: line, kind: kind, field: 'level', issue: 'unknown level: ' + level, warn: true });

      seen[email] = line;
      var classes = kind === 'teacher' ? cls.split(/[,;]/).map(function (c) { return c.trim(); }).filter(Boolean) : [cls];
      classes.forEach(function (c) { if (c && !CLASS_RE.test(c)) problems.push({ line: line, kind: kind, field: 'class', issue: 'class code looks unusual: ' + c, warn: true }); });
      clean.push({ line: line, name: name, email: email, level: level, class: cls, classes: classes, studentNo: studentNo, role: kind });
    });
    return { clean: clean, problems: problems, excluded: excluded };
  }

  // ---- file parsing (SheetJS lazy-loaded) ----
  var xlsxLoading = null;
  function ensureXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = XLSX_SRC;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load the spreadsheet parser.')); };
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }
  function readArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('read failed')); };
      fr.readAsArrayBuffer(file);
    });
  }
  // Real school sheets often have a TITLE/banner row above the header, and the
  // headers are Turkish. So we auto-detect the header row (the row that has an
  // Email column) and map known headers (TR or EN) to canonical keys.
  // Aliases are stored in ASCII (Turkish letters folded), because normKey folds
  // the header cell to ASCII before matching. Bare "no" is intentionally OMITTED
  // from studentNo, since the row-number column "NO" must NOT win over "ÖĞRENCİ NO".
  var HEADER_ALIASES = {
    email:     ['email', 'e-mail', 'e mail', 'mail', 'eposta', 'e-posta', 'e-posta adresi',
                'email adresi', 'e-mail adresi', 'mail adresi', 'eposta adresi', 'e posta',
                'ogrenci e-posta', 'ogrenci email', 'ogrenci mail', 'kurumsal e-posta',
                'kurumsal email', 'email address', 'e-mail address'],
    name:      ['name', 'name surname', 'name-surname', 'full name', 'fullname', 'student name',
                'student full name', 'ad soyad', 'ad-soyad', 'adi soyadi', 'isim', 'isim soyisim',
                ' isim soyad', 'ogrenci', 'ogrenci adi', 'ogrenci adi soyadi',
                'ogrenci adi - soyadi', 'ogrenci adi-soyadi', 'adisoyadi'],
    studentNo: ['student no', 'studentno', 'student number', 'okul no', 'okul numarasi',
                'ogrenci no', 'ogr no', 'ogr. no', 'ogrenci no.', 'numara', 'ogrenci numarasi',
                'student id', 'id no'],
    class:     ['class', 'class code', 'class no', 'section', 'sinif', 'sinifi', 'sinif kodu',
                'sube', 'grup', 'group'],
    level:     ['level', 'cefr', 'seviye', 'seviyesi', 'duzey', 'kur', 'ingilizce seviyesi',
                'english level'],
    dept:      ['department', 'bolum', 'program', 'programi', 'fakulte']
  };
  // Normalize a header cell for matching: fold Turkish letters to ASCII
  // (I/İ/ı -> i, ş->s, ğ->g, ç->c, ö->o, ü->u), strip remaining accents,
  // lower-case. Makes "ÖĞRENCİ ADI - SOYADI" match alias "ogrenci adi - soyadi".
  function normKey(s) {
    return String(s == null ? '' : s).trim()
      .replace(/[İIı]/g, 'i')
      .toLowerCase()
      .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }
  function aliasFor(cell) {
    var k = normKey(cell);
    if (!k) return null;
    for (var logical in HEADER_ALIASES) {
      if (HEADER_ALIASES.hasOwnProperty(logical) && HEADER_ALIASES[logical].indexOf(k) !== -1) return logical;
    }
    return null;
  }
  function detectHeader(aoa) {
    var best = { idx: -1, map: null, score: 0 };
    for (var r = 0; r < Math.min(aoa.length, 15); r++) {
      var row = aoa[r] || [], map = {}, score = 0;
      for (var c = 0; c < row.length; c++) {
        var lg = aliasFor(row[c]);
        if (lg && !(lg in map)) { map[lg] = c; score++; }
      }
      // A header row needs a Name OR an Email column. (Email-only used to be
      // required, which blocked teacher sheets that have names but no email.)
      if ((('email' in map) || ('name' in map)) && score > best.score) best = { idx: r, map: map, score: score };
    }
    return best;
  }
  // FSM level words -> app CEFR level. Edit if your scheme differs; an unmapped
  // value passes through unchanged (and shows as a warning, not a hard error).
  var LEVEL_WORD = {
    'elementary': 'A2', 'a2': 'A2',
    'pre-intermediate': 'B1', 'pre intermediate': 'B1', 'pre-int': 'B1', 'pre-int.': 'B1', 'preint': 'B1', 'b1': 'B1',
    'intermediate': 'B1+', 'int': 'B1+', 'int.': 'B1+', 'b1+': 'B1+',
    'upper-intermediate': 'B2', 'upper intermediate': 'B2', 'upper-int': 'B2', 'upper int': 'B2', 'b2': 'B2',
    'pre-advanced': 'C1', 'pre advanced': 'C1', 'preadvanced': 'C1', 'pre-adv': 'C1', 'pre adv': 'C1', 'pre-advance': 'C1', 'pre advance': 'C1',
    'advanced': 'C1', 'adv': 'C1', 'c1': 'C1'
  };
  function normalizeLevel(v) { var k = normKey(v); return LEVEL_WORD[k] || String(v == null ? '' : v).trim(); }

  // ---- content-based column classifier -------------------------------
  // The headers can be missing, mislabelled or in an unexpected order. So we
  // ALSO read the actual cell values and let CONTENT decide which column is
  // which: an email column is full of addresses, a student-number column is
  // full of long digit strings, etc. This makes email <-> student-no swaps
  // impossible - email is whatever column truly holds emails.
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var RE_NUM   = /^\d{4,}$/;                                   // student no: 4+ digits (row-No 1,2,3 will not match)
  var RE_CLASS = /^([A-Za-z]{1,5}[-\s/]?\d{1,4}[A-Za-z]?|\d{1,3}[-\s/]?[A-Za-z]{1,4})$/;  // B101, A1, 9-C, HAZ3
  var RE_NAMEY = /^[^\d@]+[ .][^\d@]+$/;                       // 2+ words, no digits/@
  function isLevelVal(v) { var k = normKey(v); return !!LEVEL_WORD[k] || /^(a1|a2|b1|b1\+|b2|c1|c2)$/.test(k); }
  function classifyColumns(aoa, startRow) {
    var cols = 0, r, c;
    for (r = startRow; r < aoa.length; r++) cols = Math.max(cols, (aoa[r] || []).length);
    var sig = [];
    for (c = 0; c < cols; c++) sig[c] = { email: 0, num: 0, cls: 0, level: 0, name: 0, n: 0 };
    for (r = startRow; r < aoa.length; r++) {
      var row = aoa[r] || [];
      for (c = 0; c < cols; c++) {
        var v = String(row[c] == null ? '' : row[c]).trim();
        if (!v) continue;
        var s = sig[c]; s.n++;
        if (RE_EMAIL.test(v)) { s.email++; continue; }          // an email is never also a number/name
        if (RE_NUM.test(v)) s.num++;
        if (RE_CLASS.test(v)) s.cls++;
        if (isLevelVal(v)) s.level++;
        if (RE_NAMEY.test(v)) s.name++;
      }
    }
    return sig;
  }
  function frac(sig, c, m) { return (sig[c] && sig[c].n) ? sig[c][m] / sig[c].n : 0; }
  function bestCol(sig, m, used, floor) {
    var bi = -1, bs = floor;
    for (var c = 0; c < sig.length; c++) { if (used[c]) continue; var f = frac(sig, c, m); if (f > bs) { bs = f; bi = c; } }
    return bi;
  }
  // Merge the header map with content signals into the final field->column map.
  // Email is the anchor (always the addresses column). Student-no is a numeric
  // column and never the email column. Notes explain any content override.
  function reconcile(headerMap, sig) {
    var map = {}, notes = [], used = {};
    var hm = headerMap || {};
    // EMAIL - content wins so it can never be the No column.
    var eC = bestCol(sig, 'email', used, 0.5);
    var eH = ('email' in hm) ? hm.email : -1;
    if (eC >= 0) { map.email = eC; used[eC] = 1; if (eH >= 0 && eH !== eC) notes.push('Email taken from the column that actually holds addresses (the header pointed elsewhere).'); else if (eH < 0) notes.push('Email column identified from its contents (no matching header).'); }
    else if (eH >= 0) { map.email = eH; used[eH] = 1; }
    // STUDENT NO - numeric, never the email column.
    var nH = ('studentNo' in hm) ? hm.studentNo : -1;
    if (nH >= 0 && !used[nH] && frac(sig, nH, 'num') >= 0.3) { map.studentNo = nH; used[nH] = 1; }
    else { var nC = bestCol(sig, 'num', used, 0.5); if (nC >= 0) { map.studentNo = nC; used[nC] = 1; if (nH >= 0 && nH !== nC) notes.push('Student number taken from the numeric column (the header pointed elsewhere).'); else if (nH < 0) notes.push('Student number column identified from its contents.'); } else if (nH >= 0 && !used[nH]) { map.studentNo = nH; used[nH] = 1; } }
    // CLASS
    var clH = ('class' in hm) ? hm.class : -1;
    if (clH >= 0 && !used[clH]) { map.class = clH; used[clH] = 1; }
    else { var clC = bestCol(sig, 'cls', used, 0.4); if (clC >= 0) { map.class = clC; used[clC] = 1; notes.push('Class column identified from its contents.'); } }
    // LEVEL
    var lvH = ('level' in hm) ? hm.level : -1;
    if (lvH >= 0 && !used[lvH]) { map.level = lvH; used[lvH] = 1; }
    else { var lvC = bestCol(sig, 'level', used, 0.4); if (lvC >= 0) { map.level = lvC; used[lvC] = 1; notes.push('Level column identified from its contents.'); } }
    // NAME - remaining text column.
    var nmH = ('name' in hm) ? hm.name : -1;
    if (nmH >= 0 && !used[nmH]) { map.name = nmH; used[nmH] = 1; }
    else { var nmC = bestCol(sig, 'name', used, 0.3); if (nmC >= 0) { map.name = nmC; used[nmC] = 1; notes.push('Name column identified from its contents.'); } }
    if ('dept' in hm && !used[hm.dept]) { map.dept = hm.dept; }
    return { map: map, notes: notes };
  }
  function firstEmailRow(aoa) {
    for (var r = 0; r < aoa.length; r++) { var row = aoa[r] || []; for (var c = 0; c < row.length; c++) { if (RE_EMAIL.test(String(row[c] == null ? '' : row[c]).trim())) return r; } }
    return -1;
  }

  // Detect field->column mapping for a parsed sheet (array of arrays). Pure
  // (no DOM), so it is unit-testable and exposed on window.RosterImport.
  function columnsForAoa(aoa) {
    var det = detectHeader(aoa);
    var startRow, headerMap;
    if (det.idx >= 0) { startRow = det.idx + 1; headerMap = det.map; }
    else {
      // No recognizable header - start at the first row with an email and let
      // content classification carry it.
      startRow = firstEmailRow(aoa);
      if (startRow < 0) throw new Error('No header row and no email addresses found - the sheet needs at least a Name or Email column (NAME / Ad Soyad, EMAIL / E-posta).');
      headerMap = {};
    }
    var sig = classifyColumns(aoa, startRow);
    var rec = reconcile(headerMap, sig);
    if (!('email' in rec.map) && !('name' in rec.map)) {
      throw new Error('Could not identify a Name or Email column - please make sure the sheet has those.');
    }
    return { map: rec.map, notes: rec.notes, startRow: startRow };
  }

  function parseFile(file) {
    return ensureXlsx().then(function () {
      return readArrayBuffer(file).then(function (buf) {
        var wb = XLSX.read(buf, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        var cf = columnsForAoa(aoa);
        var map = cf.map;
        var rows = [];
        for (var r = cf.startRow; r < aoa.length; r++) {
          var raw = aoa[r] || [];
          if (raw.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
          var obj = {};
          for (var logical in map) {
            if (!map.hasOwnProperty(logical)) continue;
            var val = raw[map[logical]];
            obj[logical] = (val == null ? '' : String(val).trim());
          }
          if (obj.level) obj.level = normalizeLevel(obj.level);
          rows.push(obj);
        }
        return { rows: rows, mapping: map, notes: cf.notes };
      });
    });
  }

  // ---- preview rendering ----
  function summaryCard(label, value, accent) {
    return '<div style="flex:1; min-width:120px; background:var(--t2-surface,#161b22); border:1px solid var(--t2-border,#30363d); border-radius:10px; padding:12px 14px;">' +
      '<div style="font-size:22px; font-weight:800; color:' + (accent || 'var(--t2-text,#e6edf3)') + ';">' + value + '</div>' +
      '<div style="font-size:11px; font-weight:600; color:var(--t2-text-muted,#7d8590); margin-top:2px;">' + esc(label) + '</div></div>';
  }

  function sectionTitle(t) {
    return '<div style="margin:14px 0 6px; font-size:12px; font-weight:700; color:var(--t2-text,#e6edf3);">' + esc(t) + '</div>';
  }
  // Look up the raw parsed row for a sheet line so a clicked row can show it.
  function personByLine(kind, line) {
    var arr = kind === 'teacher' ? state.teachers : state.students;
    return (arr || [])[line - 2] || null;
  }
  function escAttr(s) { return esc(s); }
  // The expandable detail for one person. When we know which sheet row it is
  // (kind + line) it also offers Edit / Delete, which mutate state and re-run
  // validation. CSP-safe: no inline JS; one delegated handler on #riReport.
  function detailView(p, kind, line) {
    p = p || {};
    var info = [['Name', p.name], ['Email', p.email], ['Student no', p.studentNo], ['Class', p.class], ['Level', p.level]]
      .map(function (x) { return (x[1] != null && x[1] !== '') ? '<span style="margin-right:14px; white-space:nowrap;"><span style="color:var(--t2-text-muted,#7d8590);">' + esc(x[0]) + ':</span> ' + esc(x[1]) + '</span>' : ''; }).join('');
    if (!info) info = '<span style="color:var(--t2-text-muted,#7d8590);">no data on this row</span>';
    var editable = kind && line;
    var bs = 'border:1px solid var(--t2-border,#30363d); background:var(--t2-surface2,#1c2a42); color:var(--t2-text,#e6edf3); border-radius:7px; padding:4px 12px; font-size:12px; cursor:pointer;';
    var actions = editable ? '<div style="margin-top:8px; display:flex; gap:8px;">' +
      '<button type="button" data-action="edit" data-kind="' + kind + '" data-line="' + line + '" style="' + bs + '">Edit</button>' +
      '<button type="button" data-action="del" data-kind="' + kind + '" data-line="' + line + '" style="' + bs + ' color:#f87171;">Delete</button></div>' : '';
    return '<div class="ri-info">' + info + actions + '</div>' + (editable ? editFormHtml(p) : '');
  }
  function inputRow(label, key, val) {
    return '<label style="display:block; margin:5px 0;"><span style="display:inline-block; width:90px; color:var(--t2-text-muted,#7d8590);">' + esc(label) + '</span>' +
      '<input class="ri-in-' + key + '" value="' + escAttr(val || '') + '" style="width:220px; max-width:60%; background:var(--t2-bg,#0d1117); border:1px solid var(--t2-border,#30363d); color:var(--t2-text,#e6edf3); border-radius:6px; padding:4px 8px; font-size:12px;"></label>';
  }
  function editFormHtml(p) {
    var bs = 'border:1px solid var(--t2-border,#30363d); border-radius:7px; padding:4px 14px; font-size:12px; cursor:pointer;';
    return '<div class="ri-form" style="display:none; margin-top:4px;">' +
      inputRow('Name', 'name', p.name) + inputRow('Email', 'email', p.email) +
      inputRow('Student no', 'studentNo', p.studentNo) + inputRow('Class', 'class', p.class) +
      inputRow('Level', 'level', p.level) +
      '<div style="margin-top:8px; display:flex; gap:8px;">' +
      '<button type="button" data-action="save" style="' + bs + ' background:var(--t2-green,#22c55e); color:#04210f; font-weight:700;">Save</button>' +
      '<button type="button" data-action="cancel" style="' + bs + ' background:var(--t2-surface2,#1c2a42); color:var(--t2-text,#e6edf3);">Cancel</button></div></div>';
  }
  function clickableRow(labelHtml, detailInner) {
    return '<div class="ri-row" tabindex="0" role="button" style="cursor:pointer; padding:6px 10px; border-top:1px solid var(--t2-border,#30363d); display:flex; justify-content:space-between; gap:10px; align-items:center;">' +
      '<span style="min-width:0; overflow:hidden; text-overflow:ellipsis;">' + labelHtml + '</span>' +
      '<span class="ri-chev" style="color:var(--t2-text-muted,#7d8590); flex:none;">&#9662;</span></div>' +
      '<div class="ri-det" style="display:none; padding:6px 10px 8px 10px; font-size:12px; color:var(--t2-text,#e6edf3); background:rgba(96,165,250,0.05);">' + detailInner + '</div>';
  }
  function deleteRow(kind, line) {
    var arr = kind === 'teacher' ? state.teachers : state.students;
    if (!arr || !arr[line - 2]) return;
    var who = arr[line - 2].name || 'this person';
    var ask = window.AppDialog ? AppDialog.confirm('Remove ' + who + ' from the import?', { title: 'Remove row', okLabel: 'Remove', danger: true })
      : Promise.resolve(typeof confirm === 'function' ? confirm('Remove ' + who + '?') : true);
    ask.then(function (ok) { if (!ok) return; arr.splice(line - 2, 1); revalidate(); });
  }
  function saveEdit(saveBtn) {
    var det = saveBtn.closest('.ri-det'); if (!det) return;
    var form = det.querySelector('.ri-form'), editBtn = det.querySelector('[data-action="edit"]');
    if (!form || !editBtn) return;
    var kind = editBtn.getAttribute('data-kind'), line = +editBtn.getAttribute('data-line');
    var arr = kind === 'teacher' ? state.teachers : state.students;
    if (!arr || !arr[line - 2]) return;
    function val(k) { var el = form.querySelector('.ri-in-' + k); return el ? String(el.value || '').trim() : ''; }
    var row = arr[line - 2];
    row.name = val('name'); row.email = val('email'); row.studentNo = val('studentNo');
    row.class = val('class'); row.level = normalizeLevel(val('level'));
    revalidate();
  }
  var reportWired = false;
  function wireReportClicks() {
    if (reportWired) return;
    var box = $('riReport'); if (!box || !box.addEventListener) return;
    box.addEventListener('click', function (ev) {
      var el = ev.target;
      var tab = el && el.closest ? el.closest('.ri-tab') : null;
      if (tab && box.contains(tab)) {
        var id = tab.getAttribute('data-tabid');
        box.querySelectorAll('.ri-tabpanel').forEach(function (pn) { pn.style.display = pn.getAttribute('data-tabid') === id ? 'block' : 'none'; });
        box.querySelectorAll('.ri-tab').forEach(function (tb) {
          var on = tb.getAttribute('data-tabid') === id;
          tb.style.borderColor = on ? '#2563eb' : 'var(--t2-border,#30363d)';
          tb.style.background = on ? 'rgba(37,99,235,0.16)' : 'var(--t2-surface,#161b22)';
          tb.style.color = on ? '#60a5fa' : 'var(--t2-text,#e6edf3)';
        });
        return;
      }
      var act = el && el.closest ? el.closest('[data-action]') : null;
      if (act && box.contains(act)) {
        var a = act.getAttribute('data-action');
        if (a === 'del') { deleteRow(act.getAttribute('data-kind'), +act.getAttribute('data-line')); return; }
        if (a === 'save') { saveEdit(act); return; }
        var d = act.closest('.ri-det');
        if (d) {
          var info = d.querySelector('.ri-info'), form = d.querySelector('.ri-form');
          if (a === 'edit') { if (info) info.style.display = 'none'; if (form) form.style.display = ''; }
          if (a === 'cancel') { if (form) form.style.display = 'none'; if (info) info.style.display = ''; }
        }
        return;
      }
      var jump = el && el.closest ? el.closest('[data-jump]') : null;
      if (jump && box.contains(jump)) {
        var wrap = box.querySelector('.ri-classwrap');
        var hdr = wrap ? wrap.querySelector('[data-cls="' + jump.getAttribute('data-jump') + '"]') : null;
        if (wrap && hdr) wrap.scrollTop = hdr.offsetTop;
        return;
      }
      var row = el && el.closest ? el.closest('.ri-row') : null;
      if (!row || !box.contains(row)) return;
      var det = row.nextElementSibling;
      if (det && det.className && det.className.indexOf('ri-det') !== -1) {
        var open = det.style.display !== 'none';
        det.style.display = open ? 'none' : '';
        var chev = row.querySelector ? row.querySelector('.ri-chev') : null;
        if (chev) chev.innerHTML = open ? '&#9662;' : '&#9652;';
      }
    });
    reportWired = true;
  }

  function emptyMsg(t) {
    return '<div style="padding:18px; color:var(--t2-text-muted,#7d8590); font-size:13px; text-align:center; background:var(--t2-surface,#161b22); border:1px dashed var(--t2-border,#30363d); border-radius:10px;">' + esc(t) + '</div>';
  }
  function listWrap(inner, accentBorder) {
    return '<div style="max-height:460px; overflow:auto; background:var(--t2-surface,#161b22); border:1px solid ' + (accentBorder || 'var(--t2-border,#30363d)') + '; border-radius:10px;">' + inner + '</div>';
  }

  // Spreadsheet column letter for a 0-based index (0->A, 26->AA).
  function colLetter(i) {
    if (i == null || i < 0) return '?';
    var s = ''; i = Number(i);
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }
  var FIELD_LABEL = { name: 'Name', email: 'Email', studentNo: 'Student no', class: 'Class', level: 'Level', dept: 'Department' };
  function mappingLine(kind, map, notes) {
    if (!map) return '';
    var order = ['name', 'email', 'studentNo', 'class', 'level'];
    var parts = order.filter(function (k) { return k in map; }).map(function (k) {
      return '<span style="margin-right:14px; white-space:nowrap;"><span style="color:var(--t2-text-muted,#7d8590);">' + FIELD_LABEL[k] + '</span> &rarr; col ' + colLetter(map[k]) + '</span>';
    }).join('');
    var missing = ['name', 'email'].filter(function (k) { return !(k in map); });
    var noteHtml = (notes && notes.length) ? notes.map(function (n) { return '<div style="color:#f59e0b; margin-top:3px;">note: ' + esc(n) + '</div>'; }).join('') : '';
    var missHtml = missing.length ? '<div style="color:#f87171; margin-top:3px;">could not find a ' + missing.join(' or ') + ' column</div>' : '';
    return '<div style="margin-bottom:6px;"><span style="font-weight:700; color:var(--t2-text,#e6edf3);">' + kind + ' sheet:</span> ' + parts + noteHtml + missHtml + '</div>';
  }
  function columnsBanner() {
    var sHtml = (state.students && state.students.length) ? mappingLine('Students', state.studentMap, state.studentNotes) : '';
    var tHtml = (state.teachers && state.teachers.length) ? mappingLine('Teachers', state.teacherMap, state.teacherNotes) : '';
    if (!sHtml && !tHtml) return '';
    return '<div style="background:var(--t2-surface,#161b22); border:1px solid var(--t2-border,#30363d); border-radius:10px; padding:11px 14px; margin-bottom:14px; font-size:12px;">' +
      '<div style="color:var(--t2-text-muted,#7d8590); margin-bottom:6px;">📑 Detected columns - check these are right before creating accounts:</div>' + sHtml + tHtml + '</div>';
  }

  function renderPreview(sV, tV, crossDup) {
    var problems = sV.problems.concat(tV.problems).concat(crossDup);
    var hard = problems.filter(function (p) { return !p.warn; });
    var warns = problems.filter(function (p) { return p.warn; });
    var excluded = (sV.excluded || []).concat(tV.excluded || []);

    // group valid people by class (a teacher can be in several classes)
    var byClass = {};
    function addToClass(c, p) { if (!c) return; (byClass[c] = byClass[c] || []).push(p); }
    sV.clean.forEach(function (p) { addToClass(p.class, p); });
    tV.clean.forEach(function (p) { p.classes.forEach(function (c) { addToClass(c, p); }); });
    var classes = Object.keys(byClass).sort();

    var cards = '<div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px;">' +
      summaryCard('Students valid', sV.clean.length) +
      summaryCard('Teachers valid', tV.clean.length) +
      summaryCard('Classes', classes.length, '#60a5fa') +
      summaryCard('Excluded (no email)', excluded.length, excluded.length ? '#f59e0b' : 'var(--t2-text-muted,#7d8590)') +
      summaryCard('Hard problems', hard.length, hard.length ? '#f87171' : 'var(--t2-green,#22c55e)') +
      summaryCard('Warnings', warns.length, warns.length ? '#f59e0b' : 'var(--t2-text-muted,#7d8590)') +
      '</div>';

    // ---- panel: by class (jump chips + scrollable list) ----
    var classHtml;
    if (classes.length) {
      var jump = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">' +
        classes.map(function (c) { return '<span data-jump="' + esc(c) + '" style="cursor:pointer; padding:4px 12px; border:1px solid var(--t2-border,#30363d); border-radius:14px; font-size:12px; color:var(--t2-text,#e6edf3); background:var(--t2-surface2,#1c2a42);">' + esc(c) + ' <span style="color:var(--t2-text-muted,#7d8590);">' + byClass[c].length + '</span></span>'; }).join('') + '</div>';
      var listInner = '';
      classes.forEach(function (c) {
        var people = byClass[c];
        listInner += '<div data-cls="' + esc(c) + '" style="position:sticky; top:0; z-index:1; padding:8px 10px; background:var(--t2-surface2,#1c2a42); font-weight:700; color:var(--t2-text,#e6edf3); border-top:1px solid var(--t2-border,#30363d);">' + esc(c) + ' <span style="color:var(--t2-text-muted,#7d8590); font-weight:500;">(' + people.length + ')</span></div>';
        people.forEach(function (p) {
          var label = esc(p.name) + (p.role === 'teacher' ? ' <span style="color:#60a5fa;">(teacher)</span>' : '');
          listInner += clickableRow(label, detailView(p, p.role, p.line));
        });
      });
      classHtml = '<div style="margin-bottom:8px; color:var(--t2-text-muted,#7d8590); font-size:12px;">Click a name to view, edit or remove. Tap a class chip to jump.</div>' +
        jump + '<div class="ri-classwrap" style="position:relative; max-height:460px; overflow:auto; background:var(--t2-surface,#161b22); border:1px solid var(--t2-border,#30363d); border-radius:10px;">' + listInner + '</div>';
    } else {
      classHtml = emptyMsg('No valid students or classes yet. Upload a student sheet and validate.');
    }

    // ---- panel: teachers ----
    var teacherHtml;
    if (tV.clean.length) {
      var tInner = tV.clean.map(function (p) {
        var label = esc(p.name) + ' <span style="color:var(--t2-text-muted,#7d8590);">' + esc((p.classes || []).join(', ') || 'no class') + '</span>';
        return clickableRow(label, detailView(p, 'teacher', p.line));
      }).join('');
      teacherHtml = '<div style="margin-bottom:8px; color:var(--t2-text-muted,#7d8590); font-size:12px;">Teachers read from the teacher sheet. Click to view, edit or remove. On commit each gets a pre-verified account linked to their class(es).</div>' + listWrap(tInner);
    } else {
      teacherHtml = emptyMsg('No teachers in this import. Upload a teacher sheet to add them.');
    }

    // ---- panel: excluded ----
    var excludedHtml = excluded.length
      ? '<div style="margin-bottom:8px; color:var(--t2-text-muted,#7d8590); font-size:12px;">No email means no account, so these are skipped - but the import still goes through. Add an email and Save to include them.</div>' +
        listWrap(excluded.map(function (e) {
          var label = '<span style="color:#f59e0b;">' + esc(e.name || '(no name)') + '</span> <span style="color:var(--t2-text-muted,#7d8590);">' + esc(e.kind + ' line ' + e.line) + '</span>';
          return clickableRow(label, detailView(personByLine(e.kind, e.line), e.kind, e.line));
        }).join(''), 'rgba(245,158,11,0.35)')
      : emptyMsg('Nobody was excluded - everyone has an email.');

    // ---- panel: problems ----
    var problemsHtml = problems.length
      ? listWrap(problems.map(function (p) {
          var color = p.warn ? '#f59e0b' : '#f87171';
          var where = p.kind === 'both' ? 'both sheets' : (p.kind + ' line ' + p.line);
          var label = '<span style="color:' + color + '; font-weight:700;">' + (p.warn ? 'warning' : 'BLOCKS') + '</span> <span style="color:var(--t2-text-muted,#7d8590);">' + esc(where) + '</span> &middot; ' + esc(p.issue);
          return clickableRow(label, p.line ? detailView(personByLine(p.kind, p.line), p.kind, p.line) : 'cross-sheet duplicate email');
        }).join(''))
      : '<div style="background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.35); border-radius:10px; padding:14px 16px; font-size:13px; color:var(--t2-green,#22c55e); font-weight:700;">No blocking problems. Ready to create / relocate.</div>';

    // ---- assemble tabs (bigger buttons) ----
    var tabs = [
      { id: 'class', label: 'By class', n: classes.length, html: classHtml },
      { id: 'teachers', label: 'Teachers', n: tV.clean.length, html: teacherHtml },
      { id: 'excluded', label: 'Excluded', n: excluded.length, html: excludedHtml },
      { id: 'problems', label: 'Problems', n: problems.length, html: problemsHtml }
    ];
    var bar = '<div class="ri-tabbar" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--t2-border,#30363d); padding-bottom:12px;">' +
      tabs.map(function (t, i) {
        var on = i === 0;
        return '<button type="button" class="ri-tab" data-tabid="' + t.id + '" style="cursor:pointer; font-family:inherit; font-weight:800; font-size:14px; padding:11px 22px; border-radius:12px; border:1px solid ' + (on ? '#2563eb' : 'var(--t2-border,#30363d)') + '; background:' + (on ? 'rgba(37,99,235,0.16)' : 'var(--t2-surface,#161b22)') + '; color:' + (on ? '#60a5fa' : 'var(--t2-text,#e6edf3)') + ';">' +
          esc(t.label) + ' <span style="opacity:0.65; font-weight:700;">' + t.n + '</span></button>';
      }).join('') + '</div>';
    var panels = tabs.map(function (t, i) {
      return '<div class="ri-tabpanel" data-tabid="' + t.id + '" style="display:' + (i === 0 ? 'block' : 'none') + ';">' + t.html + '</div>';
    }).join('');

    $('riReport').innerHTML = cards + columnsBanner() + bar + panels;
    wireReportClicks();
    return { hard: hard.length, valid: (sV.clean.length + tV.clean.length) };
  }

  function refreshCommitButton() {
    var btn = $('riCommit');
    if (!btn) return;
    var ready = state.validated && state.hardCount === 0 &&
      ($('riYear').value || '').trim() && ($('riModule').value || '').trim();
    btn.disabled = !ready;
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.style.opacity = ready ? '1' : '0.5';
  }

  // Re-run validation on the current in-memory rows (used after a row is edited
  // or removed, and by doValidate once the files are parsed) and re-render.
  function revalidate() {
    var sV = validateRows(state.students, 'student');
    var tV = validateRows(state.teachers, 'teacher');
    var tEmails = {}; tV.clean.forEach(function (p) { tEmails[p.email] = 1; });
    var crossDup = [];
    sV.clean.forEach(function (p) { if (tEmails[p.email]) crossDup.push({ kind: 'both', field: 'email', issue: 'email is in BOTH sheets: ' + p.email }); });
    var r = renderPreview(sV, tV, crossDup);
    state.validated = true; state.hardCount = r.hard;
    setStatus(r.hard ? ('Fix the ' + r.hard + ' blocking problem(s) - edit or remove the rows - then create.') : 'Validation passed. You can create / relocate now.', r.hard ? '#f87171' : 'var(--t2-green,#22c55e)');
    refreshCommitButton();
  }

  // Errors get a themed popup (same modal style as the rest of the app), with a
  // plain-language note for the common Cloud Functions error codes.
  function explainError(msg) {
    var m = String(msg || '');
    if (/internal|not-?found|unavailable/i.test(m))
      return 'The account-creation service is not reachable yet. It needs the Cloud Functions backend deployed on the Firebase Blaze plan. Your sheet is fine and nothing was created.\n\n(technical detail: ' + m + ')';
    if (/permission|unauthenticated/i.test(m))
      return 'The server refused the request because you are not signed in as an admin.\n\n(technical detail: ' + m + ')';
    return m;
  }
  function showError(msg, title) {
    setStatus(String(msg).split('\n')[0], '#f87171');
    var friendly = explainError(msg);
    if (window.AppDialog) AppDialog.alert(friendly, { title: title || 'Could not finish', danger: true });
    else if (typeof alert === 'function') alert(friendly);
  }
  // A non-alarming popup (no red danger styling) for informational notices.
  function notify(msg, title) {
    if (window.AppDialog) AppDialog.alert(String(msg), { title: title || 'Heads up' });
    else if (typeof alert === 'function') alert(String(msg));
  }

  // ---- validate (dry run) ----
  function doValidate() {
    var sf = $('riStudents').files[0], tf = $('riTeachers').files[0];
    if (!sf && !tf) { setStatus('Pick at least one sheet first.', '#f87171'); return; }
    state.validated = false; state.creds = null;
    $('riCredsDownload').style.display = 'none';
    setStatus('Parsing...');
    // Parse each sheet independently so one bad sheet does not block the other.
    function safeParse(file) {
      if (!file) return Promise.resolve({ rows: [] });
      return parseFile(file).then(function (out) { return { rows: out.rows, mapping: out.mapping, notes: out.notes }; }, function (e) { return { rows: [], err: (e && e.message) || String(e) }; });
    }
    Promise.all([safeParse(sf), safeParse(tf)]).then(function (res) {
      state.students = res[0].rows || []; state.teachers = res[1].rows || [];
      state.studentMap = res[0].mapping || null; state.studentNotes = res[0].notes || [];
      state.teacherMap = res[1].mapping || null; state.teacherNotes = res[1].notes || [];
      revalidate();
      var probs = [];
      if (res[0].err) probs.push('Student sheet: ' + res[0].err);
      if (res[1].err) probs.push('Teacher sheet: ' + res[1].err);
      if (probs.length) {
        setStatus('One sheet could not be read - the other was loaded.', '#f59e0b');
        notify(probs.join('\n\n') + '\n\nThe other sheet was still loaded, so you can carry on.', 'One sheet could not be read');
      }
    });
  }

  // ---- commit (needs the deployed Cloud Function + Blaze) ----
  function doCommit() {
    if (typeof firebase === 'undefined' || typeof firebase.functions !== 'function') {
      showError('Account creation needs the Cloud Functions backend, which runs on the Firebase Blaze plan. It is not available yet, so accounts cannot be created. Validation and editing still work.', 'Backend not ready');
      return;
    }
    var year = ($('riYear').value || '').trim(), module = ($('riModule').value || '').trim();
    if (!year || !module) { setStatus('Set the year and module first.', '#f87171'); return; }
    if (!state.validated || state.hardCount) { setStatus('Validate with zero blocking problems first.', '#f87171'); return; }

    var btn = $('riCommit'); btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'wait';
    setStatus('Creating accounts and classes... this can take a moment.');
    var fn = firebase.functions().httpsCallable('rosterImport');
    fn({ mode: 'commit', year: year, module: module, students: state.students || [], teachers: state.teachers || [] })
      .then(function (res) {
        var d = (res && res.data) || {};
        if (!d.committed) {
          setStatus('Server validation found blocking problems. See the report.', '#f87171');
          if (d.report) renderServerProblems(d.report);
          return;
        }
        state.creds = d.credentials || [];
        var made = state.creds.length, total = (d.report && d.report.relocations) || 0;
        setStatus('Done. Created ' + made + ' new account(s), placed ' + total + ' person(s).', 'var(--t2-green,#22c55e)');
        var dl = $('riCredsDownload');
        if (made) { dl.style.display = ''; } else { dl.style.display = 'none'; }
      })
      .catch(function (e) {
        showError('Could not create accounts: ' + ((e && e.message) || String(e)), 'Could not create accounts');
      })
      .then(function () { refreshCommitButton(); btn.style.cursor = 'pointer'; });
  }

  function renderServerProblems(report) {
    var probs = (report && report.problems) || [];
    if (!probs.length) return;
    var rows = probs.map(function (p) {
      return '<div style="font-size:12px; color:#f87171; padding:2px 0;">' + esc((p.kind || '') + ' ' + (p.line ? 'line ' + p.line : '') + ': ' + (p.issue || '')) + '</div>';
    }).join('');
    $('riReport').innerHTML = '<div style="background:var(--t2-surface,#161b22); border:1px solid rgba(248,113,113,0.4); border-radius:10px; padding:12px 14px;">' + rows + '</div>';
  }

  function downloadCreds() {
    var creds = state.creds || [];
    if (!creds.length) return;
    var lines = [['email', 'name', 'role', 'temporaryPassword']];
    creds.forEach(function (c) { lines.push([c.email || '', c.name || '', c.role || '', c.tempPassword || '']); });
    var csv = '﻿' + lines.map(function (r) {
      return r.map(function (v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'new-credentials-' + (($('riModule').value || 'module').trim().replace(/[^\w.-]+/g, '_')) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- class QR codes (one scannable code per class, printable) ----
  var qrLoading = null;
  function ensureQr() {
    if (window.qrcode) return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'teacher/js/vendor/qrcode.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load the QR generator.')); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }
  function buildJoinUrl(c) {
    return location.origin + '/join.html?c=' + encodeURIComponent(c._key || '') + '&k=' + encodeURIComponent(c.joinCode || '');
  }
  function qrSvg(url) {
    var qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  // theme=true -> light card (for the print window); false -> dark (dashboard).
  function buildCard(c, light) {
    var url = buildJoinUrl(c);
    var border = light ? '#ccc' : 'var(--t2-border,#30363d)';
    var bg = light ? '#fff' : 'var(--t2-surface,#161b22)';
    var txt = light ? '#111' : 'var(--t2-text,#e6edf3)';
    var sub = light ? '#555' : 'var(--t2-text-muted,#7d8590)';
    return '<div class="ri-card" style="display:inline-block; vertical-align:top; width:230px; margin:8px; padding:14px; border:1px solid ' + border + '; border-radius:12px; background:' + bg + '; text-align:center; page-break-inside:avoid;">' +
      '<div class="ri-code" style="font-size:22px; font-weight:800; color:' + txt + ';">' + esc(c.code || '') + '</div>' +
      '<div style="font-size:12px; color:' + sub + '; margin:2px 0 10px;">' + esc(c.level || '') + (c.teacherName ? (' &middot; ' + esc(c.teacherName)) : '') + '</div>' +
      '<div style="background:#fff; padding:8px; border-radius:8px; display:inline-block; line-height:0;">' + qrSvg(url) + '</div>' +
      '<div class="ri-join" style="font-family:monospace; font-size:18px; letter-spacing:2px; color:' + txt + '; margin-top:10px;">' + esc(c.joinCode || '') + '</div>' +
      (light ? '' : '<button type="button" data-print-code="' + esc(c.code || '') + '" style="margin-top:10px; cursor:pointer; font-size:11px; padding:4px 12px; border-radius:14px; border:1px solid var(--t2-border,#30363d); background:transparent; color:var(--t2-text-muted,#7d8590);">🖨 Print this class</button>') +
    '</div>';
  }
  var qrWired = false;
  function renderClassCards(list) {
    state.classList = list || [];
    var box = $('riQr'); if (!box) return;
    box.innerHTML = (list && list.length) ? list.map(function (c) { return buildCard(c, false); }).join('') : '';
    if (!qrWired && box.addEventListener) {
      box.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-print-code]') : null;
        if (b && box.contains(b)) printOne(b.getAttribute('data-print-code'));
      });
      qrWired = true;
    }
  }
  function loadClassCodes() {
    var module = ($('riModule').value || '').trim();
    if (!module) { setStatus('Type the module (e.g. M4) in the form above to load its saved codes - or use "Preview from this sheet", which needs no module.', '#f59e0b'); return; }
    if (typeof db === 'undefined') { setStatus('Database not ready.', '#f87171'); return; }
    setStatus('Loading classes for ' + module + '...');
    ensureQr()
      .then(function () { return db.collection('classes').where('moduleId', '==', module).get(); })
      .then(function (snap) {
        var list = snap.docs.map(function (d) { var x = d.data() || {}; x._key = d.id; return x; });
        list.sort(function (a, b) { return String(a.code || '').localeCompare(String(b.code || '')); });
        renderClassCards(list);
        $('riQrPrint').style.display = list.length ? '' : 'none';
        setStatus(list.length ? ('Showing ' + list.length + ' class code(s).') : ('No classes found for ' + module + ' yet. Commit a roster first.'), list.length ? 'var(--t2-green,#22c55e)' : '#f59e0b');
      })
      .catch(function (e) { setStatus('Could not load classes: ' + (e && e.message || e), '#f87171'); });
  }
  function printList(list, heading) {
    if (!list || !list.length) return;
    var cards = list.map(function (c) { return buildCard(c, true); }).join('');
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { setStatus('Allow pop-ups to print the codes.', '#f87171'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Class QR codes</title></head>' +
      '<body style="font-family:system-ui,Segoe UI,sans-serif; margin:16px;">' +
      '<h2 style="font-size:16px;">Class QR codes &middot; ' + esc(heading || '') + '</h2>' + cards + '</body></html>');
    w.document.close(); w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
  }
  function printClassCodes() { printList(state.classList || [], ($('riModule').value || '').trim() + ' - all classes'); }
  function printOne(code) {
    var one = (state.classList || []).filter(function (x) { return String(x.code) === String(code); });
    printList(one, code);
  }

  // Clear everything so the teacher can remove a sheet and pick another.
  function resetPreview() {
    state.students = null; state.teachers = null; state.validated = false; state.hardCount = 0; state.creds = null;
    if ($('riReport')) $('riReport').innerHTML = '';
    if ($('riCredsDownload')) $('riCredsDownload').style.display = 'none';
    refreshCommitButton();
  }
  // A "Remove" button under a file input: appears once a file is chosen, clears it.
  function addClearButton(inputId, label) {
    var inp = $(inputId); if (!inp || !inp.parentNode) return;
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Remove ' + label;
    b.style.cssText = 'display:none; margin-top:6px; cursor:pointer; font-size:11px; color:#f87171; background:transparent; border:1px solid rgba(248,113,113,0.45); border-radius:8px; padding:3px 10px;';
    inp.parentNode.appendChild(b);
    inp.addEventListener('change', function () { b.style.display = (inp.files && inp.files.length) ? 'inline-block' : 'none'; });
    b.addEventListener('click', function () { inp.value = ''; b.style.display = 'none'; resetPreview(); setStatus('Removed the ' + label + '. Pick another file and validate.'); });
  }
  // QR codes only really exist after commit (Blaze). This builds a no-Blaze
  // PREVIEW from the validated sheet so the teacher can see how they will look.
  function previewQrFromSheet() {
    if (!state.validated || (!state.students && !state.teachers)) { setStatus('Validate a sheet first to preview its QR codes.', '#f87171'); return; }
    var module = ($('riModule').value || '').trim() || 'MODULE';
    var sV = validateRows(state.students, 'student'), tV = validateRows(state.teachers, 'teacher');
    var byClass = {}, teacherByClass = {};
    sV.clean.forEach(function (p) { if (p.class) (byClass[p.class] = byClass[p.class] || []).push(p); });
    tV.clean.forEach(function (p) { p.classes.forEach(function (c) { if (!teacherByClass[c]) teacherByClass[c] = p; }); });
    var codes = Object.keys(byClass).sort();
    if (!codes.length) { setStatus('No classes in the sheet to preview.', '#f59e0b'); return; }
    ensureQr().then(function () {
      var list = codes.map(function (c) {
        var t = teacherByClass[c];
        return { code: c, level: ((byClass[c][0] || {}).level || ''), teacherName: t ? t.name : '', joinCode: 'PREVIEW', _key: module + '__' + c };
      });
      renderClassCards(list);
      if ($('riQrPrint')) $('riQrPrint').style.display = '';
      setStatus('Preview only - ' + list.length + ' class code(s) from the sheet. The real join codes are created when you create accounts (Blaze).', '#f59e0b');
    }).catch(function (e) { showError('Could not build the QR preview: ' + ((e && e.message) || e), 'QR preview'); });
  }

  function init() {
    if (!$('rosterImportPanel')) return;
    var v = $('riValidate'); if (v) v.addEventListener('click', doValidate);
    var c = $('riCommit'); if (c) c.addEventListener('click', doCommit);
    var d = $('riCredsDownload'); if (d) d.addEventListener('click', downloadCreds);
    var q = $('riQrShow'); if (q) q.addEventListener('click', loadClassCodes);
    var p = $('riQrPrint'); if (p) p.addEventListener('click', printClassCodes);
    ['riYear', 'riModule'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('input', refreshCommitButton); });
    addClearButton('riStudents', 'student sheet');
    addClearButton('riTeachers', 'teacher sheet');
    // QR: add a no-Blaze preview button + a one-line explanation of how codes work.
    var qs = $('riQrShow');
    if (qs && qs.parentNode) {
      var pv = document.createElement('button');
      pv.type = 'button'; pv.id = 'riQrPreview'; pv.textContent = '👁 Preview from this sheet';
      pv.style.cssText = 'cursor:pointer; font-family:inherit; font-weight:700; font-size:12px; padding:8px 14px; border-radius:18px; border:1px solid var(--t2-border,#30363d); background:transparent; color:var(--t2-text-muted,#7d8590); margin-left:6px;';
      pv.addEventListener('click', previewQrFromSheet);
      qs.parentNode.insertBefore(pv, qs.nextSibling);
      var note = document.createElement('div');
      note.style.cssText = 'font-size:11px; color:var(--t2-text-muted,#7d8590); margin-top:8px; line-height:1.5;';
      note.textContent = 'How QR codes work: the real codes are created only when you create accounts (the Blaze backend). "Show class QR codes" loads codes that already exist for this module; "Preview from this sheet" shows how they will look now, with placeholder codes.';
      qs.parentNode.appendChild(note);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Small surface for the verification harness (and handy for debugging).
  window.RosterImport = { renderClassCards: renderClassCards, ensureQr: ensureQr, buildJoinUrl: buildJoinUrl, columnsForAoa: columnsForAoa };
})();
