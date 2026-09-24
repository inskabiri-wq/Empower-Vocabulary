/* ============================================================
   LINGUALAB WRITE - UI engine (staging)
   Renders a student essay with severity-aware highlights + a
   full-width feedback report (level estimate, vocab & grammar
   distributions, suggestions, per-criterion notes, comments,
   rewrites, plan). NO hard scores; estimates are suggestions.
   Practice mode: Claude is the "API" until funded.
   ============================================================ */
(function () {
  'use strict';

  const LEVELS = window.CORRECTOR_LEVELS;
  const SEV = window.CORRECTOR_SEVERITY;
  const CLASSIC_CRIT = ['CC', 'TA', 'GR', 'VO'];
  const FALLBACK_CRIT = { CC: 'Organization', TA: 'Content', GR: 'Language Accuracy', VO: 'Word Choice' };
  const FALLBACK_RUBRICS = { essay: 'Essay (Int / Upper-Int)', academic: 'Academic paragraph', short: 'Short paragraph' };
  const BAND_COLORS = { A1: '#34d399', A2: '#60a5fa', B1: '#60a5fa', B2: '#60a5fa', C1: '#f472b6', C2: '#60a5fa', 'Off-list': '#ef4444' };

  let activeLevel = 'medium';
  let activeCorrection = null, activeEssay = '';
  let simpleLang = false, currentRubric = 'essay', lastResolved = [], activeProfile = null, editSet = new Set();
  let el = {}, tipEl = null;

  const $ = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // ── Rubric resolution ───────────────────────────────────
  // The engine is CRITERIA-COUNT AGNOSTIC. Every "by criterion" loop below
  // walks critKeys() instead of a fixed four, so a holistic exam (GRE /
  // TOEFL) renders ONE card and the PTE essay renders seven, with no
  // special-casing. Exam rubrics come from the shared registry; the three
  // classroom rubrics keep CC/TA/GR/VO from the comment bank.
  function reg() { return window.WRITING_RUBRICS || null; }
  function critKeys(rubric) {
    const R = reg();
    if (R && R.isExam(rubric)) return R.keys(rubric);
    return CLASSIC_CRIT.slice();
  }
  // Criteria actually present in a correction, in rubric order, with any
  // extra keys the AI returned appended so nothing is silently dropped.
  function critKeysOf(c, rubric) {
    const order = critKeys(rubric);
    if (!c || !c.criteria) return order;
    const extra = Object.keys(c.criteria).filter(k => order.indexOf(k) === -1);
    return order.concat(extra);
  }
  function critColor(c) {
    const R = reg();
    if (R && R.COLORS && R.COLORS[c]) return R.COLORS[c];
    const wa = window.WritingAnnotations;
    if (wa && wa.CRIT_COLORS && wa.CRIT_COLORS[c]) return wa.CRIT_COLORS[c];
    return (window.CORRECTOR_CRIT_COLORS || {})[c] || '#60a5fa';
  }
  function critLabel(rubric, c) {
    const R = reg();
    if (R) { const l = R.label(rubric, c); if (l) return l; }
    const b = window.WRITING_COMMENT_BANK;
    if (b && b.label) { try { return b.label(rubric, c); } catch (_) {} }
    return FALLBACK_CRIT[c] || c;
  }
  function rubricLabel(r) {
    const R = reg();
    if (R && R.isExam(r)) return R.get(r).label;
    const b = window.WRITING_COMMENT_BANK;
    if (b && b.rubricMeta && b.rubricMeta[r]) return b.rubricMeta[r].label;
    return FALLBACK_RUBRICS[r] || r;
  }
  // "IELTS band (predictive)" instead of a generic "Rubric" row, so the
  // estimate is labelled with the scale the teacher actually chose.
  function scaleLabel(r) {
    const R = reg();
    if (R && R.isExam(r)) return R.get(r).scale.name;
    return 'Rubric';
  }
  // Snap a criterion verdict onto the scale the exam actually awards.
  //
  // The prompt asks for whole bands on IELTS, but a verdict is free text the
  // model writes, so asking is not the same as knowing. This is the guard: any
  // number in a criterion verdict is rounded to that exam's criterion step and
  // clamped to its range, so "Task Achievement 6.5" cannot reach the screen.
  // Only criterion verdicts go through here; the OVERALL estimate is left
  // alone, because a half band is correct there.
  function normaliseVerdict(rubricId, text) {
    const R = reg();
    if (!R || !R.isExam(rubricId)) return text;
    const sc = R.get(rubricId).scale || {};
    const stepC = R.criterionStep ? R.criterionStep(rubricId) : (sc.criterionStep || sc.step || 1);
    if (!stepC || stepC === 0.5) return text;
    return String(text == null ? '' : text).replace(/\d+(?:\.\d+)?/g, (m) => {
      const n = parseFloat(m);
      if (!isFinite(n)) return m;
      // Half values round up, matching how IELTS rounds an overall score.
      let v = Math.round(n / stepC) * stepC;
      if (sc.min != null) v = Math.max(sc.min, v);
      if (sc.max != null) v = Math.min(sc.max, v);
      return String(v);
    });
  }
  // One line under the picker: what the chosen exam task expects (scale,
  // length, time, how many criteria), so the teacher can see exactly what
  // the AI is marking against before spending a call.
  function syncRubricHint() {
    if (!el.rubricHint) return;
    const id = (el.rubric && el.rubric.value) || 'essay';
    const R = reg();
    if (!R || !R.isExam(id)) { el.rubricHint.textContent = ''; el.rubricHint.hidden = true; return; }
    const r = R.get(id), n = r.criteria.length;
    el.rubricHint.hidden = false;
    // Criterion labels are joined with " / " because several contain commas
    // ("Development, Structure and Coherence") and would read as extra items.
    el.rubricHint.textContent = r.task + ' · ' + R.summary(id) + ' · '
      + (n === 1 ? 'one holistic judgement' : n + ' criteria: ' + r.criteria.map(c => c.label).join(' / '));
  }
  function sevColor(sev, crit) { const m = SEV[sev] || SEV.fix; return m.color || critColor(crit); }
  // simplify(): turn any feedback sentence into plain A2 English. Uses a
  // grammar-term dictionary, then falls back to the first short sentence.
  // This makes "Simpler language" affect EVERY comment/note, even where no
  // hand-authored `simple` exists (authored ones still take precedence).
  const SIMPLE_MAP = [
    [/subject.?verb agreement/i, 'Make the verb match the subject (use "are" for more than one).'],
    [/irregular plural/i, 'This plural is special - use the right form (e.g. children).'],
    [/reflexive pronoun/i, 'Use the correct -self word (themselves, himself...).'],
    [/comma splice/i, 'Do not join two full sentences with only a comma.'],
    [/passive/i, 'Check the verb form here (use the past participle, e.g. "used").'],
    [/possessive/i, 'Use the possessive word (their, its, your...).'],
    [/fixed phrase|set phrase|fixed contrast/i, 'This is a set phrase - use the usual form.'],
    [/article/i, 'Add the small word: a, an or the.'],
    [/number agreement/i, 'Singular and plural must match.'],
    [/gerund/i, 'Check the -ing word at the start of the sentence.'],
    [/capital/i, 'Use a capital letter.'],
    [/preposition/i, 'Check the small linking word (in, on, about...).'],
    [/run.?on/i, 'This sentence is too long - split it into two.'],
    [/spelling/i, 'Check the spelling.'],
    [/cliche|clich/i, 'This phrase is too common - try your own words.'],
    [/vague|weak|name the|more precise|stronger word|too informal|register/i, 'Use a clearer, stronger word.'],
    [/redundant|doubl|say the same/i, 'You say this twice - keep one.'],
    [/develop|add (one |a )?(concrete )?example|evidence|support/i, 'Add one real example here.'],
    [/signpost|linker|connector|cohesion|topic sentence/i, 'Good - this helps the reader follow you.'],
    [/opener|opening|introduc/i, 'Good - a clear opening.'],
    [/conclusion|conclud|final sentence|sums up|pinpoint/i, 'Good - a clear ending.'],
    [/precise|idiomatic|sophisticated|well.?chosen|natural phras|strong.*(word|phras|express|vocab)/i, 'Good - strong word choice.'],
    [/balance|both sides|counter|concession|acknowledg/i, 'Good - you show both sides.'],
    [/relevant|on.?task|fully address|clear detail|specific|good detail/i, 'Good - clear and on the topic.'],
    [/good|great|excellent|strong|nice|well done|keep this/i, 'Good - well done here.']
  ];
  function simplify(t) {
    if (!t) return t || '';
    for (var i = 0; i < SIMPLE_MAP.length; i++) { if (SIMPLE_MAP[i][0].test(t)) return SIMPLE_MAP[i][1]; }
    var m = String(t).match(/^[^.]*\./);   // first sentence as a gentle fallback
    return m ? m[0] : String(t);
  }
  function textOf(a) { return simpleLang ? (a.simple || simplify(a.text)) : a.text; }
  function suggestionOf(a) { return simpleLang ? (a.simpleSuggestion || a.suggestion) : a.suggestion; }
  function overallOf(c) { return simpleLang ? (c.overallSimple || simplify(c.overall)) : c.overall; }
  function noteOf(cr) { if (!cr) return ''; return simpleLang ? (cr.noteSimple || simplify(cr.note)) : cr.note; }
  function whyOf(rw) { return simpleLang ? (rw.whySimple || simplify(rw.why)) : rw.why; }
  function planArr(c) { var base = Array.isArray(c.plan) ? c.plan : []; if (!simpleLang) return base; return Array.isArray(c.planSimple) ? c.planSimple : base.map(simplify); }
  // edSpan(): editable inner-span wrapper (keeps labels outside). on = section editing.
  function edSpan(on, key, idxAttr, idxVal, text) {
    if (!on) return esc(text);
    return '<span class="cor-ed" contenteditable="true" data-edit="' + key + '" data-' + idxAttr + '="' + idxVal + '">' + esc(text) + '</span>';
  }
  const SECTIONS = ['overall', 'criteria', 'comments', 'rewrites', 'plan'];
  function isEd(sec) { return editSet.has(sec); }
  function secBtn(sec) {
    return '<button type="button" class="cor-sec-edit' + (editSet.has(sec) ? ' on' : '') + '" data-editsec="' + sec + '" title="Edit this section">' + (editSet.has(sec) ? '✓ editing' : '✏️ edit') + '</button>';
  }
  // diffMark(): common prefix/suffix, highlight the differing middle in before/after.
  function diffMark(before, after) {
    const a = String(before || ''), b = String(after || '');
    let p = 0; const mx = Math.min(a.length, b.length);
    while (p < mx && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const aMid = a.slice(p, a.length - s), bMid = b.slice(p, b.length - s);
    const pre = esc(a.slice(0, p)), suf = esc(a.slice(a.length - s));
    return {
      before: pre + (aMid ? '<span class="cor-diff-del">' + esc(aMid) + '</span>' : '') + suf,
      after: pre + (bMid ? '<span class="cor-diff-ins">' + esc(bMid) + '</span>' : '') + suf
    };
  }

  // ── Anchor each quote in the essay (in order) ───────────
  function resolveAnchors(text, anns) {
    let cursor = 0;
    return (anns || []).map((a, i) => {
      const q = a.quote || '';
      let s = -1;
      if (q) { s = text.indexOf(q, cursor); if (s === -1) s = text.indexOf(q); }
      const item = Object.assign({}, a, { _i: i });
      if (s !== -1) { item.start = s; item.end = s + q.length; cursor = s + q.length; }
      else { item.start = null; item.end = null; }
      return item;
    });
  }

  // ── Essay with highlights + hover/click ─────────────────
  function renderEssay(text, resolved) {
    const box = el.essayBox;
    const placed = resolved.filter(r => r.start != null).sort((a, b) => a.start - b.start || a.end - b.end);
    const keep = []; let lastEnd = -1;
    placed.forEach(r => { if (r.start >= lastEnd) { keep.push(r); lastEnd = r.end; } });

    let html = '', cursor = 0;
    keep.forEach(r => {
      if (r.start > cursor) html += esc(text.slice(cursor, r.start));
      const color = sevColor(r.severity, r.criterion);
      const style = (SEV[r.severity] || {}).dashed ? 'dashed' : 'solid';
      const bg = (r.severity === 'strength') ? color + '66' : color + '4d';
      html += '<mark class="cor-hl" data-id="' + r._i + '" '
        + 'style="background:' + bg + ';border-bottom-style:' + style + ';border-bottom-color:' + color + ';">'
        + esc(text.slice(r.start, r.end)) + '</mark>';
      cursor = r.end;
    });
    if (cursor < text.length) html += esc(text.slice(cursor));
    box.innerHTML = html || esc(text) || '<span style="color:var(--text-muted)">(No text.)</span>';

    box.querySelectorAll('.cor-hl').forEach(m => {
      m.addEventListener('click', () => focusComment(m.getAttribute('data-id'), 'mark'));
      m.addEventListener('mouseenter', () => showTipFor(m));
      m.addEventListener('mouseleave', hideTip);
    });
  }

  // ── Hover tooltip ───────────────────────────────────────
  function ensureTip() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'cor-tip'; tipEl.style.display = 'none'; document.body.appendChild(tipEl); }
    return tipEl;
  }
  function showTipFor(markEl) {
    const a = lastResolved[markEl.getAttribute('data-id')];
    if (!a) return;
    const col = sevColor(a.severity, a.criterion), sev = SEV[a.severity] || SEV.fix;
    const t = ensureTip();
    const sug = suggestionOf(a);
    t.innerHTML = '<span class="cor-tip-h" style="color:' + col + '">' + sev.glyph + ' ' + sev.label + ' · ' + esc(critLabel(currentRubric, a.criterion)) + '</span>'
      + esc(textOf(a)) + (sug ? '<div class="cor-tip-sug"><b>Try:</b> ' + esc(sug) + '</div>' : '');
    t.style.display = 'block';
    const r = markEl.getBoundingClientRect();
    const tw = t.offsetWidth || 320;
    let left = window.scrollX + r.left;
    left = Math.min(left, window.scrollX + document.documentElement.clientWidth - tw - 14);
    left = Math.max(window.scrollX + 8, left);
    t.style.left = left + 'px';
    t.style.top = (window.scrollY + r.bottom + 8) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

  // ── Mark <-> comment focus (fixed scroll, #4) ───────────
  function focusComment(id, source) {
    document.querySelectorAll('.cor-hl.is-focus, .cor-comment.is-focus').forEach(n => n.classList.remove('is-focus'));
    const mark = el.essayBox.querySelector('.cor-hl[data-id="' + id + '"]');
    const cmt = el.panel.querySelector('.cor-comment[data-id="' + id + '"]');
    if (mark) mark.classList.add('is-focus');
    if (cmt) cmt.classList.add('is-focus');
    if (source === 'mark' && cmt) cmt.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (source === 'comment' && mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function countByCriterion(resolved) {
    const c = {}; (resolved || []).forEach(r => { if (r.text) c[r.criterion] = (c[r.criterion] || 0) + 1; }); return c;
  }

  // ── Card heading icons ──────────────────────────────────
  // Inline SVG, not emoji. Colour emoji render differently on every OS (on
  // Windows several of these came out as flat coloured blocks), they cannot
  // inherit the heading colour, and they print badly. These use currentColor,
  // so they follow the heading in both the dark UI and the print stylesheet.
  const ICONS = {
    level:   '<path d="M3 20h18"/><rect x="4" y="11" width="4" height="6" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="16" y="3" width="4" height="14" rx="1"/>',
    vocab:   '<path d="M4 19.5V5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M8 8h7"/><path d="M8 12h5"/>',
    grammar: '<path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h13"/><circle cx="18.5" cy="12" r="1.6"/>',
    clause:  '<path d="M12 4v6"/><path d="M6 20v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><rect x="9" y="2" width="6" height="4" rx="1"/>'
  };
  function icon(name) {
    return '<svg class="cor-hicon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  // ── Profile cards: CEFR + suggestions + distributions ───
  function est(label, val) { return '<div class="cor-estimate"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>'; }
  const CEFR_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  function cefrBand(s) { return String(s || '').slice(0, 2); }
  let profTables = {}, profSeq = 0;

  function estimateCardHtml(c) {
    let h = '<div class="cor-pcard"><h4>' + icon('level') + 'Level estimate</h4>';
    if (c.cefr) h += '<div class="cor-cefr-big">' + esc(c.cefr) + '</div><div class="cor-cefr-sub">Estimated CEFR level</div>';
    if (c.estimates) {
      h += '<div style="margin-top:10px">';
      if (c.estimates.ielts) h += est('IELTS (suggested)', c.estimates.ielts);
      if (c.estimates.toefl) h += est('TOEFL iBT (suggested)', c.estimates.toefl);
      if (c.estimates.rubric) h += est(scaleLabel(currentRubric) + ' (predictive)', c.estimates.rubric);
      h += '</div>';
    }
    h += '<div class="cor-suggest-flag">Suggestions only, not an official score</div></div>';
    return h;
  }
  function vocabBarsCard(v) {
    const max = Math.max(1, ...v.distribution.map(d => d.count || 0));
    const bars = v.distribution.map(d => {
      const hp = Math.round(((d.count || 0) / max) * 100), col = BAND_COLORS[d.band] || '#94a3b8';
      return '<div class="cor-vbar"><span class="cor-vbar-n">' + (d.count || 0) + '</span>'
        + '<div class="cor-vbar-track"><div class="cor-vbar-fill" style="height:' + hp + '%;background:' + col + '"></div></div>'
        + '<span class="cor-vbar-band" style="color:' + col + '">' + esc(d.band) + '</span></div>';
    }).join('');
    return '<div class="cor-pcard"><h4>' + icon('vocab') + 'Vocabulary range' + (v.cefr ? ' · ~' + esc(v.cefr) : '') + '</h4><div class="cor-vbars">' + bars + '</div>'
      + (v.note ? '<div class="cor-pnote">' + esc(v.note) + '</div>' : '') + '</div>';
  }
  function grammarTabsCard(g) {
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const present = order.filter(L => g.features.some(f => f.cefr === L));
    const tabs = ['ALL'].concat(present);
    const tabHtml = tabs.map((t, i) => '<button type="button" class="cor-tab' + (i === 0 ? ' active' : '') + '" data-glevel="' + esc(t) + '">' + esc(t) + '</button>').join('');
    const featHtml = g.features.map(f => {
      const col = BAND_COLORS[f.cefr] || '#60a5fa';
      const ex = (Array.isArray(f.examples) && f.examples.length)
        ? '<div class="cor-feat-ex">' + f.examples.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' : '';
      return '<div class="cor-feat" data-glevel="' + esc(f.cefr || '') + '"><div class="cor-feat-top">'
        + '<span class="cor-feat-name">' + esc(f.feature) + '</span>'
        + '<span class="cor-feat-n">×' + (f.count || 0) + '</span>'
        + (f.cefr ? '<span class="cor-feat-cefr" style="background:' + col + '22;color:' + col + '">' + esc(f.cefr) + '</span>' : '')
        + '</div>' + ex + '</div>';
    }).join('');
    return '<div class="cor-pcard"><h4>' + icon('grammar') + 'Grammar range' + (g.cefr ? ' · ~' + esc(g.cefr) : '') + '</h4>'
      + '<div class="cor-tabs">' + tabHtml + '</div>' + featHtml
      + (g.note ? '<div class="cor-pnote">' + esc(g.note) + '</div>' : '') + '</div>';
  }

  // ── Profiler tables (Text-Inspector style) ──────────────
  function buildTableCard(title, rows, cols) {
    const id = 'pt' + (++profSeq);
    profTables[id] = { rows: rows.slice(), cols: cols, sortKey: 'count', sortDir: -1, sorted: rows.slice() };
    const th = cols.map(col => '<th data-pt="' + id + '" data-sort="' + col.key + '">' + esc(col.label) + ' <span class="arrow"></span></th>').join('');
    return '<div class="cor-pcard cor-prof" data-pt="' + id + '">'
      + '<div class="cor-prof-head"><h4>' + title + ' <span class="cor-prof-n">' + rows.length + '</span></h4>'
      + '<div class="cor-tabs"><button type="button" class="cor-tab active" data-pt="' + id + '" data-ptview="list">List</button>'
      + '<button type="button" class="cor-tab" data-pt="' + id + '" data-ptview="dist">Distribution</button></div></div>'
      + '<div class="cor-pt-list"><table class="cor-tbl"><thead><tr>' + th + '<th></th></tr></thead><tbody id="' + id + '-body"></tbody></table></div>'
      + '<div class="cor-pt-dist" id="' + id + '-dist" hidden></div></div>';
  }
  function cellHtml(r, col) {
    const v = r[col.key];
    if (col.type === 'lemma') return '<td class="cor-c-lemma">' + esc(v) + '</td>';
    if (col.type === 'pos') return '<td class="cor-c-pos">' + esc(v) + '</td>';
    if (col.type === 'cefr') { const cc = BAND_COLORS[cefrBand(v)] || '#94a3b8'; return '<td><span class="cor-cefr-badge" style="background:' + cc + '22;color:' + cc + '">' + esc(v) + '</span></td>'; }
    if (col.type === 'num') return '<td class="cor-c-num">' + esc(v) + '</td>';
    return '<td>' + esc(v) + '</td>';
  }
  function cmpRows(a, b, key, dir) {
    if (key === 'count') return ((+a.count || 0) - (+b.count || 0)) * dir;
    if (key === 'cefr') {
      const av = CEFR_ORDER[cefrBand(a.cefr)] || 0, bv = CEFR_ORDER[cefrBand(b.cefr)] || 0;
      if (av !== bv) return (av - bv) * dir;
      return (+b.count || 0) - (+a.count || 0);
    }
    return String(a[key] || '').localeCompare(String(b[key] || '')) * dir;
  }
  function renderTbody(id) {
    const t = profTables[id]; if (!t) return;
    const rows = t.rows.slice().sort((a, b) => cmpRows(a, b, t.sortKey, t.sortDir));
    t.sorted = rows;
    const body = document.getElementById(id + '-body'); if (!body) return;
    body.innerHTML = rows.map((r, ri) => {
      const cells = t.cols.map(col => cellHtml(r, col)).join('');
      const hasS = Array.isArray(r.sentences) && r.sentences.length;
      const vs = hasS ? '<button type="button" class="cor-vs-btn" data-pt="' + id + '" data-row="' + ri + '" title="View sentences">☰</button>' : '';
      return '<tr>' + cells + '<td class="cor-vs-cell">' + vs + '</td></tr>';
    }).join('');
    const table = body.closest('table');
    if (table) table.querySelectorAll('th[data-sort]').forEach(th => {
      const k = th.getAttribute('data-sort'), a = th.querySelector('.arrow');
      if (k === t.sortKey) { th.classList.add('sorted'); if (a) a.textContent = t.sortDir < 0 ? '▼' : '▲'; }
      else { th.classList.remove('sorted'); if (a) a.textContent = ''; }
    });
  }
  function renderDist(id) {
    const t = profTables[id]; if (!t) return;
    const dist = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    t.rows.forEach(r => { const b = cefrBand(r.cefr); if (dist[b] != null) dist[b] += (+r.count || 0); });
    const bands = ['A1', 'A2', 'B1', 'B2', 'C1'].filter((b, i) => dist[b] > 0 || i < 4);
    const max = Math.max(1, ...bands.map(b => dist[b]));
    const bars = bands.map(b => {
      const hp = Math.round((dist[b] / max) * 100), col = BAND_COLORS[b];
      return '<div class="cor-vbar"><span class="cor-vbar-n">' + dist[b] + '</span>'
        + '<div class="cor-vbar-track"><div class="cor-vbar-fill" style="height:' + hp + '%;background:' + col + '"></div></div>'
        + '<span class="cor-vbar-band" style="color:' + col + '">' + b + '</span></div>';
    }).join('');
    const d = document.getElementById(id + '-dist'); if (d) d.innerHTML = '<div class="cor-vbars">' + bars + '</div>';
  }
  function toggleSentences(id, ri, btn) {
    const t = profTables[id]; if (!t) return;
    const r = t.sorted[ri]; if (!r) return;
    const tr = btn.closest('tr'); if (!tr) return;
    const nx = tr.nextElementSibling;
    if (nx && nx.classList.contains('cor-vs-row')) { nx.remove(); return; }
    const det = document.createElement('tr');
    det.className = 'cor-vs-row';
    det.innerHTML = '<td colspan="' + (t.cols.length + 1) + '"><div class="cor-vs-list">'
      + (r.sentences || []).map(s => '<span>' + esc(s) + '</span>').join('') + '</div></td>';
    tr.after(det);
  }

  function renderProfile(c) {
    profTables = {};
    const lemmas = c.lemmas || (activeProfile && activeProfile.lemmas);
    const verbForms = c.verbForms || (activeProfile && activeProfile.verbForms);
    const clauses = c.clauses || (activeProfile && activeProfile.clauses);
    const hasTables = (lemmas && lemmas.length) || (verbForms && verbForms.length) || (clauses && clauses.length);

    let html = '';
    // The summary row (level estimate + vocabulary/grammar range) ALWAYS
    // renders. The profiler tables are ADDITIONAL detail underneath it, not a
    // replacement: deep analysis should never take a card away.
    let top = '';
    if (c.cefr || c.estimates) top += estimateCardHtml(c);
    if (c.vocabProfile && Array.isArray(c.vocabProfile.distribution)) top += vocabBarsCard(c.vocabProfile);
    if (c.grammarProfile && Array.isArray(c.grammarProfile.features)) top += grammarTabsCard(c.grammarProfile);
    if (top) html += '<div class="cor-profile">' + top + '</div>';

    if (hasTables) {
      const wcols = [{ key: 'lemma', label: 'Lemma', type: 'lemma' }, { key: 'pos', label: 'PoS', type: 'pos' }, { key: 'cefr', label: 'CEFR', type: 'cefr' }, { key: 'count', label: 'Count', type: 'num' }];
      const vcols = [{ key: 'form', label: 'Form', type: 'lemma' }, { key: 'with', label: 'With', type: 'pos' }, { key: 'cefr', label: 'CEFR', type: 'cefr' }, { key: 'count', label: 'Count', type: 'num' }];
      const ccols = [{ key: 'clause', label: 'Clause', type: 'lemma' }, { key: 'with', label: 'With', type: 'pos' }, { key: 'cefr', label: 'CEFR', type: 'cefr' }, { key: 'count', label: 'Count', type: 'num' }];
      if (lemmas && lemmas.length) html += buildTableCard(icon('vocab') + 'Words', lemmas, wcols);
      let pair = '';
      if (verbForms && verbForms.length) pair += buildTableCard(icon('grammar') + 'Verb forms', verbForms, vcols);
      if (clauses && clauses.length) pair += buildTableCard(icon('clause') + 'Clauses', clauses, ccols);
      if (pair) html += '<div class="cor-prof-pair">' + pair + '</div>';
    }

    el.profile.innerHTML = html;
    el.profile.style.display = html ? '' : 'none';
    wireProfilers();
  }

  function wireProfilers() {
    // Fallback grammar-range tabs.
    el.profile.querySelectorAll('.cor-tab[data-glevel]').forEach(tab => {
      tab.addEventListener('click', () => {
        const card = tab.closest('.cor-pcard'); if (!card) return;
        card.querySelectorAll('.cor-tab[data-glevel]').forEach(t => t.classList.toggle('active', t === tab));
        const lvl = tab.getAttribute('data-glevel');
        card.querySelectorAll('.cor-feat').forEach(f => { f.hidden = !(lvl === 'ALL' || f.getAttribute('data-glevel') === lvl); });
      });
    });
    // Rich tables.
    Object.keys(profTables).forEach(id => { renderTbody(id); renderDist(id); });
    el.profile.querySelectorAll('.cor-tbl th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const id = th.getAttribute('data-pt'), key = th.getAttribute('data-sort'), t = profTables[id]; if (!t) return;
        if (t.sortKey === key) t.sortDir *= -1; else { t.sortKey = key; t.sortDir = (key === 'count' || key === 'cefr') ? -1 : 1; }
        renderTbody(id);
      });
    });
    el.profile.querySelectorAll('.cor-tab[data-ptview]').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.getAttribute('data-ptview'), card = tab.closest('.cor-prof'); if (!card) return;
        card.querySelectorAll('.cor-tab[data-ptview]').forEach(t => t.classList.toggle('active', t === tab));
        const list = card.querySelector('.cor-pt-list'), dist = card.querySelector('.cor-pt-dist');
        if (list) list.hidden = (view !== 'list');
        if (dist) dist.hidden = (view !== 'dist');
      });
    });
    el.profile.querySelectorAll('.cor-vs-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleSentences(btn.getAttribute('data-pt'), Number(btn.getAttribute('data-row')), btn));
    });
  }

  // ── Feedback panel (full width, comments in a grid) ─────
  function renderPanel(c, resolved) {
    const shows = (LEVELS[activeLevel] || LEVELS.medium).shows;
    const rubric = currentRubric;
    let h = '';

    if (activeLevel === 'light') {
      h += '<div class="cor-card"><div class="cor-triage">🪶 <b>Light pass</b>: only the issues a reader notices first. Switch to Medium or Deep for a full correction.</div></div>';
    }

    // Overall
    const Eo = isEd('overall'), ov = overallOf(c);
    if (ov || Eo) {
      h += '<div class="cor-card"><h3>Overall' + secBtn('overall') + '</h3><div class="cor-overall' + (Eo ? ' cor-ed' : '') + '"'
        + (Eo ? ' contenteditable="true" data-edit="overall"' : '') + '>' + esc(ov || '') + '</div></div>';
    }

    // By criterion
    if (c.criteria) {
      const Ec = isEd('criteria'), counts = countByCriterion(resolved);
      h += '<div class="cor-card"><h3>By criterion' + secBtn('criteria') + '</h3><div class="cor-crit-grid">';
      critKeysOf(c, rubric).forEach(cc => {
        const cr = c.criteria[cc]; if (!cr) return;
        const color = critColor(cc), n = counts[cc] || 0;
        h += '<div class="cor-crit" data-crit="' + cc + '"><span class="cor-crit-dot" style="background:' + color + '"></span><div class="cor-crit-main">'
          + '<div class="cor-crit-top"><span class="cor-crit-name">' + esc(critLabel(rubric, cc)) + '</span>'
          + '<span class="cor-crit-verdict' + (Ec ? ' cor-ed' : '') + '" style="background:' + color + '22;color:' + color + '"'
            + (Ec ? ' contenteditable="true" data-edit="crit-verdict" data-crit="' + cc + '"' : '') + '>'
            + esc(normaliseVerdict(rubric, cr.verdict) || (Ec ? 'verdict' : '')) + '</span>'
          + (n ? '<span class="cor-crit-count" data-crit="' + cc + '" title="Jump to these comments">' + n + ' issue' + (n > 1 ? 's' : '') + ' ›</span>' : '')
          + (Ec ? '<button type="button" class="cor-del" data-del="crit" data-crit="' + cc + '" title="Delete criterion">✕</button>' : '')
          + '</div>'
          + '<div class="cor-crit-note' + (Ec ? ' cor-ed' : '') + '"' + (Ec ? ' contenteditable="true" data-edit="crit-note" data-crit="' + cc + '"' : '') + '>' + esc(noteOf(cr) || '') + '</div>'
          + '</div></div>';
      });
      h += '</div></div>';
    }

    // Comments
    const Em = isEd('comments'), withMarks = resolved.filter(r => r.text);
    if (withMarks.length || Em) {
      h += '<div class="cor-card"><h3>Comments (' + withMarks.length + ')'
        + (Em ? ' <button type="button" class="cor-add" data-add="ann">+ Add</button>' : ' · click to jump')
        + secBtn('comments') + '</h3><div class="cor-comments">';
      // Group by the rubric's criteria, then sweep up anything the AI tagged
      // with a key this rubric does not declare, so no comment goes missing.
      const groupKeys = critKeysOf(c, rubric);
      const seenKeys = groupKeys.concat(
        withMarks.map(r => r.criterion).filter(k => groupKeys.indexOf(k) === -1)
      );
      seenKeys.forEach(cc => {
        const items = withMarks.filter(r => r.criterion === cc); if (!items.length) return;
        const color = critColor(cc);
        h += '<div class="cor-grouphdr" data-crit="' + cc + '" style="color:' + color + '"><span class="cor-crit-dot" style="background:' + color + '"></span>' + esc(critLabel(rubric, cc)) + '</div>';
        items.forEach(r => {
          const meta = SEV[r.severity] || SEV.fix, col = sevColor(r.severity, r.criterion);
          const det = (r.start == null) ? ' · not located' : '';
          const sug = suggestionOf(r);
          h += '<div class="cor-comment" data-id="' + r._i + '" style="border-left-color:' + col + '">'
            + '<div class="cor-cmt-top"><span class="cor-sev" style="color:' + col + '">' + meta.glyph + ' ' + meta.label + '</span>'
            + (r.quote ? '<span class="cor-cmt-quote">“' + esc(r.quote.slice(0, 42)) + (r.quote.length > 42 ? '…' : '') + '”</span>' : '')
            + (det ? '<span style="color:var(--text-muted)">' + det + '</span>' : '')
            + (Em ? '<button type="button" class="cor-del" data-del="ann" data-ann="' + r._i + '" title="Delete">✕</button>' : '')
            + '</div>'
            + '<div class="cor-cmt-text' + (Em ? ' cor-ed' : '') + '"' + (Em ? ' contenteditable="true" data-edit="ann-text" data-ann="' + r._i + '"' : '') + '>' + esc(textOf(r)) + '</div>'
            + ((sug || Em) ? '<div class="cor-suggest' + (Em ? ' cor-ed' : '') + '"' + (Em ? ' contenteditable="true" data-edit="ann-sug" data-ann="' + r._i + '"' : '') + '>' + (Em ? '' : '<b>Try:</b> ') + esc(sug || '') + '</div>' : '')
            + '</div>';
        });
      });
      h += '</div></div>';
    }

    // Model rewrites (diff-highlighted when read-only; editable when its section is on)
    const Er = isEd('rewrites');
    if (shows.rewrites || Er) {
      const rws = Array.isArray(c.rewrites) ? c.rewrites : [];
      if (rws.length || Er) {
        h += '<div class="cor-card"><h3>Model rewrites' + (Er ? ' <button type="button" class="cor-add" data-add="rw">+ Add</button>' : '') + secBtn('rewrites') + '</h3>';
        rws.forEach((rw, i) => {
          let bH, aH;
          if (Er) { bH = edSpan(true, 'rw-before', 'rw', i, rw.before || ''); aH = edSpan(true, 'rw-after', 'rw', i, rw.after || ''); }
          else { const d = diffMark(rw.before, rw.after); bH = d.before; aH = d.after; }
          h += '<div class="cor-rewrite">'
            + (Er ? '<button type="button" class="cor-del" data-del="rw" data-rw="' + i + '" title="Delete">✕</button>' : '')
            + '<div class="cor-rw-before"><b>Before:</b> ' + bH + '</div>'
            + '<div class="cor-rw-after"><b>After:</b> ' + aH + '</div>'
            + ((rw.why || Er) ? '<div class="cor-rw-why">' + edSpan(Er, 'rw-why', 'rw', i, whyOf(rw) || '') + '</div>' : '')
            + '</div>';
        });
        h += '</div>';
      }
    }

    // What to do next (plan)
    const Ep = isEd('plan');
    if (shows.plan || Ep) {
      const plan = planArr(c);
      if (plan.length || Ep) {
        h += '<div class="cor-card"><h3>What to do next' + (Ep ? ' <button type="button" class="cor-add" data-add="plan">+ Add</button>' : '') + secBtn('plan') + '</h3><ol class="cor-plan">'
          + plan.map((p, i) => '<li>' + (Ep ? '<button type="button" class="cor-del cor-del-li" data-del="plan" data-plan="' + i + '" title="Delete">✕</button>' : '') + edSpan(Ep, 'plan', 'plan', i, p) + '</li>').join('')
          + '</ol></div>';
      }
    }

    el.panel.innerHTML = h || '<div class="cor-card">No feedback returned.</div>';
    wirePanel();
  }

  // ── Panel interactions: jump + edit/delete/add ──────────
  function jumpToCrit(cc) {
    const hdr = el.panel.querySelector('.cor-grouphdr[data-crit="' + cc + '"]');
    if (!hdr) return;
    hdr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hdr.classList.remove('cor-flash'); void hdr.offsetWidth; hdr.classList.add('cor-flash');
  }
  function saveEdit(elm) {
    const c = activeCorrection; if (!c) return;
    const v = elm.textContent.trim(), k = elm.getAttribute('data-edit');
    const ann = () => c.annotations[+elm.getAttribute('data-ann')];
    const rw = () => (c.rewrites || [])[+elm.getAttribute('data-rw')];
    const cr = () => c.criteria && c.criteria[elm.getAttribute('data-crit')];
    if (k === 'overall') { if (simpleLang) c.overallSimple = v; else c.overall = v; }
    else if (k === 'crit-note') { const x = cr(); if (x) { if (simpleLang) x.noteSimple = v; else x.note = v; } }
    else if (k === 'crit-verdict') { const x = cr(); if (x) x.verdict = v; }
    else if (k === 'ann-text') { const a = ann(); if (a) { if (simpleLang) a.simple = v; else a.text = v; } }
    else if (k === 'ann-sug') { const a = ann(); if (a) { if (simpleLang) a.simpleSuggestion = v; else a.suggestion = v; } }
    else if (k === 'rw-before') { const x = rw(); if (x) x.before = v; }
    else if (k === 'rw-after') { const x = rw(); if (x) x.after = v; }
    else if (k === 'rw-why') { const x = rw(); if (x) { if (simpleLang) x.whySimple = v; else x.why = v; } }
    else if (k === 'plan') { const arr = (simpleLang && Array.isArray(c.planSimple)) ? c.planSimple : c.plan; if (arr) arr[+elm.getAttribute('data-plan')] = v; }
  }
  function doDelete(type, btn) {
    const c = activeCorrection; if (!c) return;
    if (type === 'ann') c.annotations.splice(+btn.getAttribute('data-ann'), 1);
    else if (type === 'rw') (c.rewrites || []).splice(+btn.getAttribute('data-rw'), 1);
    else if (type === 'plan') { const arr = (simpleLang && Array.isArray(c.planSimple)) ? c.planSimple : c.plan; if (arr) arr.splice(+btn.getAttribute('data-plan'), 1); }
    else if (type === 'crit') { if (c.criteria) delete c.criteria[btn.getAttribute('data-crit')]; }
    renderCorrection(c, activeEssay);
  }
  function doAdd(type) {
    const c = activeCorrection; if (!c) return;
    if (type === 'ann') { c.annotations = c.annotations || []; c.annotations.push({ criterion: 'GR', severity: 'tip', quote: '', text: 'New comment' }); }
    else if (type === 'rw') { c.rewrites = c.rewrites || []; c.rewrites.push({ before: '', after: '', why: '' }); }
    else if (type === 'plan') { if (simpleLang && Array.isArray(c.planSimple)) c.planSimple.push('New step'); else { c.plan = c.plan || []; c.plan.push('New step'); } }
    renderCorrection(c, activeEssay);
  }
  function wirePanel() {
    document.body.classList.toggle('cor-editing', editSet.size > 0);
    if (el.edit) { el.edit.classList.toggle('cor-btn-on', editSet.size > 0); el.edit.textContent = editSet.size > 0 ? '✓ Done editing' : '✏️ Edit all'; }
    // per-section edit toggles (top-right of each card)
    el.panel.querySelectorAll('.cor-sec-edit').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = b.getAttribute('data-editsec');
      if (editSet.has(sec)) editSet.delete(sec); else editSet.add(sec);
      if (activeCorrection) renderCorrection(activeCorrection, activeEssay);
    }));
    el.panel.querySelectorAll('.cor-crit-count[data-crit]').forEach(n =>
      n.addEventListener('click', () => jumpToCrit(n.getAttribute('data-crit'))));
    el.panel.querySelectorAll('.cor-comment').forEach(node =>
      node.addEventListener('click', (e) => {
        if (editSet.has('comments') || e.target.closest('.cor-del') || e.target.isContentEditable) return;
        focusComment(node.getAttribute('data-id'), 'comment');
      }));
    el.panel.querySelectorAll('.cor-ed[contenteditable]').forEach(n => n.addEventListener('blur', () => saveEdit(n)));
    el.panel.querySelectorAll('.cor-del').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); doDelete(b.getAttribute('data-del'), b); }));
    el.panel.querySelectorAll('.cor-add').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); doAdd(b.getAttribute('data-add')); }));
  }

  function renderMeta(c, resolved) {
    const lvl = LEVELS[activeLevel] || LEVELS.medium;
    const t = { fix: 0, tip: 0, strength: 0 };
    (resolved || []).forEach(r => { if (r.text && t[r.severity] != null) t[r.severity]++; });
    // Holistic rubrics often yield a single mark, so pluralise properly.
    const nOf = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    el.resultMeta.innerHTML = lvl.icon + ' <b>' + esc(lvl.label) + '</b> · ' + esc(rubricLabel(currentRubric))
      + ' · ' + nOf(t.fix, 'fix', 'fixes') + ' · ' + nOf(t.tip, 'tip', 'tips') + ' · ' + nOf(t.strength, 'strength', 'strengths');
    el.legend.innerHTML = '<span style="color:#60a5fa"><i></i> Fix</span>'
      + '<span style="color:#60a5fa"><i style="border-bottom-style:dashed"></i> Tip</span>'
      + '<span style="color:#10b981"><i></i> Strength</span>';
  }

  function renderCorrection(c, essayText) {
    if (!c) return;
    activeCorrection = c; activeEssay = essayText;
    currentRubric = c.rubric || el.rubric.value || 'essay';
    const resolved = resolveAnchors(essayText, c.annotations);
    lastResolved = resolved;
    renderEssay(essayText, resolved);
    activeProfile = (typeof currentSample === 'function') ? currentSample() : null;
    renderProfile(c);
    renderPanel(c, resolved);
    renderMeta(c, resolved);
    el.results.style.display = '';
  }

  // ── Request the API would receive (Claude, in practice) ─
  function buildPrompt(level, rubric, task, essay) {
    const lvl = LEVELS[level] || LEVELS.medium;
    const keys = critKeys(rubric);
    const crits = keys.map(c => c + '=' + critLabel(rubric, c)).join(', ');
    const critJson = keys.map((c, i) => '"' + c + '":' + (i === 0 ? '{"verdict":"...","note":"name the grammar point"}' : '{}')).join(',');
    const depth = {
      light: 'LIGHT: surface ONLY the few issues that hurt communication most or a reader notices first. 3 to 6 marks. Be brief and encouraging. No plan.',
      medium: 'MEDIUM: a full pass across every criterion. Mark every notable issue (name the grammar point) with a corrected example in "suggestion", a short per-criterion note, and a 4 step plan.',
      deep: 'DEEP: minute, top to bottom. Mark every issue (name the grammar point) with a corrected "suggestion", a detailed note per criterion, 2 to 4 model rewrites of the weakest sentences, and a focused 5 step plan.'
    }[level];
    const lines = [
      // ── FIXED PREFIX (identical every call → CACHE THIS) ──
      'You are an expert ESL writing teacher. Give feedback on the student writing at the END of this message.',
      'RULES: Give NO scores or grades (CEFR/IELTS/TOEFL/rubric figures are estimates and SUGGESTIONS only - label them so).',
      'In every comment NAME the grammar point AND model it: put a corrected example in "suggestion"; in DEEP also add model rewrites of weak sentences. Then guide with the plan.',
      'Be encouraging and specific. Quote the exact text you comment on.',
      simpleLang ? 'LANGUAGE: write ALL explanations AND suggestions in simple A2-level English; also fill "simple" and "simpleSuggestion".' : '',
      'RUBRIC: ' + rubricLabel(rubric) + '. Criteria: ' + crits + '.'
        + (reg() && reg().isExam(rubric)
            ? ' EXAM TASK: ' + reg().get(rubric).guidance
              + ' Expected length ' + reg().get(rubric).wordTarget + '.'
              + ' Give each criterion verdict as an estimated ' + reg().get(rubric).scale.name + '.'
              // IELTS band descriptors are published at whole bands, so a
              // criterion is 5, 6 or 7 and never 6.5. Left unsaid, the model
              // happily returned half bands per criterion, which is not a
              // score the exam awards.
              + (reg().criterionStep(rubric) === 1
                  ? ' Each criterion MUST be a WHOLE ' + reg().get(rubric).scale.name
                    + ' (for example 6 or 7). Half bands such as 6.5 are NOT valid for a single'
                    + ' criterion; only an overall score can be a half band.'
                  : '')
            : ''),
      'DEPTH ' + depth,
      'Put guidance in "plan": a 4 to 5 step list of ideas (what to do next) that refer to the grammar points.',
      'Return ONLY valid JSON (see SCHEMA.md):',
      '{ "level":"' + level + '", "rubric":"' + rubric + '", "overall":"...",' + (simpleLang ? ' "overallSimple":"...",' : ''),
      '  "cefr":"e.g. B1", "estimates":{"ielts":"...","toefl":"...","rubric":"... / 20"},',
      '  "lemmas":[{"lemma":"...","pos":"noun","cefr":"A2","count":1}],',
      '  "verbForms":[{"form":"present simple","with":"is","cefr":"A1.0","count":2}],',
      '  "clauses":[{"clause":"noun clause","with":"that","cefr":"B1","count":1}],',
      '  "criteria":{' + critJson + '},',
      '  "annotations":[{"criterion":"' + keys[keys.length - 1] + '","severity":"fix|tip|strength","quote":"exact text","text":"name the grammar point + why","suggestion":"a corrected example"' + (simpleLang ? ',"simple":"...","simpleSuggestion":"..."' : '') + '}]'
        + (lvl.shows.rewrites ? ',\n  "rewrites":[{"before":"...","after":"...","why":"..."}]' : '')
        + (lvl.shows.plan ? ',\n  "plan":["idea 1","idea 2","idea 3","idea 4"]' : ''),
      '}',
      '',
      '=== CACHE BOUNDARY: everything ABOVE is identical every call (cache it); everything BELOW changes per essay (send fresh). ===',
      '',
      // ── VARIABLE (changes per essay → send LAST, not cached) ──
      'TASK/PROMPT: ' + (task || '(none given)'),
      '',
      'STUDENT WRITING:', '"""', essay, '"""'
    ];
    return lines.filter(x => x !== '').join('\n');
  }

  function parseLooseJson(s) {
    if (!s || !s.trim()) throw new Error('empty');
    let t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) t = t.slice(a, b + 1);
    return JSON.parse(t);
  }

  // ── Wiring ──────────────────────────────────────────────
  function samples() { return window.CORRECTOR_SAMPLES || (window.CORRECTOR_SAMPLE ? [window.CORRECTOR_SAMPLE] : []); }
  let currentSampleIdx = 0;
  function currentSample() { return samples()[currentSampleIdx] || null; }

  function syncLevelButtons() {
    el.levels.querySelectorAll('.cor-level-btn').forEach(b => b.classList.toggle('active', b.dataset.level === activeLevel));
    const lvl = LEVELS[activeLevel] || LEVELS.medium;
    if (el.blurb) el.blurb.textContent = lvl.blurb;
  }
  function isSampleEssay() {
    const s = currentSample(); if (!s) return false;
    return el.essay.value.trim() === String(s.essay || '').trim();
  }
  function note(msg) { if (el.note) el.note.textContent = msg || ''; }

  function reRender() {
    const s = currentSample();
    if (isSampleEssay() && s && s.corrections[activeLevel]) renderCorrection(s.corrections[activeLevel], el.essay.value);
    else if (activeCorrection) renderCorrection(activeCorrection, activeEssay);
  }
  function run() {
    const essay = el.essay.value;
    if (!essay.trim()) { el.essay.focus(); return; }
    const s = currentSample();
    // A pristine sample essay uses its pre-baked correction (instant, offline).
    if (isSampleEssay() && s && s.corrections[activeLevel]) {
      note('');
      renderCorrection(s.corrections[activeLevel], essay);
      el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Any other essay -> live AI via the analyzeWriting Cloud Function.
    runLiveAnalysis(essay);
  }
  // ── Auth state (Firebase restores the signed-in session asynchronously) ──
  var _authUser = null, _authResolved = false, _authWaiters = [];
  function _flushAuth() { var ws = _authWaiters.splice(0); for (var i = 0; i < ws.length; i++) ws[i](_authUser); }
  function initAuthWatch() {
    if (typeof firebase === 'undefined' || !firebase.auth) { _authResolved = true; return; }
    try {
      _authUser = firebase.auth().currentUser || null;
      firebase.auth().onAuthStateChanged(function (u) { _authUser = u || null; _authResolved = true; _flushAuth(); });
    } catch (_) { _authResolved = true; }
  }
  // Resolve with the current user once auth has settled. Resolves immediately if
  // a user is already present; otherwise waits for onAuthStateChanged (with a
  // safety timeout so we never hang).
  function whenAuthUser(cb) {
    if (_authUser) { cb(_authUser); return; }
    if (_authResolved) { cb(_authUser); return; }
    _authWaiters.push(cb);
    setTimeout(function () { if (!_authResolved) { _authResolved = true; _flushAuth(); } }, 4000);
  }

  function runLiveAnalysis(essay) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
      note('Live AI is not available on this page (Cloud Functions not loaded).');
      return;
    }
    // Firebase restores the signed-in session asynchronously, so currentUser is
    // null for a moment after load. Wait for auth to resolve before deciding,
    // otherwise a quick click wrongly reports "not signed in".
    note('Checking sign-in...');
    el.run.disabled = true;
    whenAuthUser(function (user) {
      if (!user) {
        el.run.disabled = false;
        note('You are not signed in on this tab. Open Lingualab, sign in, then come back here and click Analyze again.');
        return;
      }
      doAnalyze(essay);
    });
  }
  function doAnalyze(essay) {
    const rubric = (el.rubric && el.rubric.value) || 'essay';
    const depth = activeLevel;
    const task = (el.task && el.task.value || '').trim();
    const oldLabel = el.run.textContent;
    el.run.disabled = true; el.run.textContent = 'Analyzing...';
    note('Analyzing with AI - this can take a few seconds...');
    // Behind a circuit breaker (js/circuit-breaker.js). This call has no
    // timeout of its own, so the Firebase callable default of about 70s
    // applies, and the function tries up to three Gemini models in sequence
    // before giving up - during a Gemini outage that is a very long dead
    // button, repeated for every teacher and every click. The breaker caps a
    // single attempt at 25s and, after 4 consecutive DEPENDENCY failures,
    // fails instantly for a minute instead of queueing more doomed calls.
    // A teacher who simply lacks the permission, or has spent their Deep cap,
    // does not count towards that - see the note in circuit-breaker.js.
    var breaker = window.CircuitBreaker
      ? window.CircuitBreaker.get('analyzeWriting', { failureThreshold: 4, cooldownMs: 60000, timeoutMs: 25000 })
      : { run: function (t) { return Promise.resolve().then(t); } };   // module absent: behave exactly as before

    breaker.run(function () {
      return firebase.functions().httpsCallable('analyzeWriting')({ essay: essay, rubric: rubric, depth: depth, task: task });
    })
      .then(function (res) {
        const d = (res && res.data) || {};
        if (!d.correction) { note('The AI did not return any feedback. Please try again.'); return; }
        note('');
        renderCorrection(d.correction, essay);
        el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (e) {
        // The breaker's own messages already say what happened and when to
        // come back, so they are shown as-is rather than wrapped in
        // "Could not analyze:", which would read as a failure of THIS essay.
        if (window.CircuitBreaker && (window.CircuitBreaker.isOpenError(e) || window.CircuitBreaker.isTimeout(e))) {
          note((e && e.message) || 'Writing AI is temporarily unavailable.');
          return;
        }
        const perm = e && e.code === 'permission-denied';
        note('Could not analyze: ' + ((e && e.message) || 'error') + (perm ? ' (ask an admin to enable Writing AI for your account in Admin ▸ Writing AI)' : ''));
      })
      .then(function () { el.run.disabled = false; el.run.textContent = oldLabel; });
  }
  function loadSample(idx) {
    const list = samples(); if (!list.length) return;
    currentSampleIdx = Math.max(0, Math.min(idx, list.length - 1));
    const s = list[currentSampleIdx];
    el.essay.value = s.essay; el.task.value = s.task || '';
    if (s.rubric) { el.rubric.value = s.rubric; syncRubricHint(); }
    if (el.samplePick) el.samplePick.value = String(currentSampleIdx);
    note('');
    renderCorrection(s.corrections[activeLevel], s.essay);
  }
  // Open blank: no preloaded sample, empty fields, results hidden. Teachers
  // paste a real essay and run live AI. Samples stay available in the picker.
  function clearAll() {
    currentSampleIdx = -1;
    if (el.essay) el.essay.value = '';
    if (el.task) el.task.value = '';
    if (el.samplePick) el.samplePick.value = '';
    activeCorrection = null; activeEssay = '';
    editSet.clear();
    note('');
    if (el.results) el.results.style.display = 'none';
  }

  function init() {
    el = {
      samplePick: $('corSamplePick'), rubric: $('corRubric'), rubricHint: $('corRubricHint'),
      levels: $('corLevels'), simple: $('corSimple'),
      task: $('corTask'), essay: $('corEssay'), run: $('corRun'), reset: $('corReset'),
      edit: $('corEdit'), print: $('corPrint'), release: $('corRelease'),
      relModal: $('corReleaseModal'), relCancel: $('corRelCancel'), relConfirm: $('corRelConfirm'),
      blurb: $('corLevelBlurb'), note: $('corNote'),
      results: $('corResults'), resultMeta: $('corResultMeta'), legend: $('corLegend'),
      essayBox: $('corEssayBox'), profile: $('corProfile'), panel: $('corPanel')
    };

    // Start watching auth immediately so the signed-in session is known by the
    // time the teacher clicks Analyze.
    initAuthWatch();

    // Rubric picker: the classroom rubrics first, then every exam rubric
    // grouped by exam family (IELTS / GRE / TOEFL / CELPIP / PTE).
    const meta = (window.WRITING_COMMENT_BANK && window.WRITING_COMMENT_BANK.rubricMeta) || null;
    const classroom = meta ? Object.keys(meta) : Object.keys(FALLBACK_RUBRICS);
    let opts = '<optgroup label="Classroom">'
      + classroom.map(r => '<option value="' + r + '">' + esc(rubricLabel(r)) + '</option>').join('')
      + '</optgroup>';
    const R = reg();
    if (R) {
      opts += R.grouped().map(g => '<optgroup label="' + esc(g.exam) + '">'
        + g.items.map(it => '<option value="' + esc(it.id) + '">' + esc(it.label) + '</option>').join('')
        + '</optgroup>').join('');
    }
    el.rubric.innerHTML = opts;
    el.rubric.addEventListener('change', syncRubricHint);
    syncRubricHint();

    const list = samples();
    if (el.samplePick) {
      el.samplePick.innerHTML = '<option value="">Blank (paste your own)</option>'
        + list.map((s, i) => '<option value="' + i + '">' + esc(s.label || ('Sample ' + (i + 1))) + '</option>').join('');
      el.samplePick.addEventListener('change', () => {
        const v = el.samplePick.value;
        if (v === '') clearAll(); else loadSample(Number(v));
      });
    }

    el.levels.innerHTML = Object.keys(LEVELS).map(k => {
      const l = LEVELS[k];
      return '<button type="button" class="cor-level-btn" data-level="' + k + '">' + l.icon + ' ' + esc(l.label) + ' <small>' + esc(l.tagline) + '</small></button>';
    }).join('');
    el.levels.querySelectorAll('.cor-level-btn').forEach(b =>
      b.addEventListener('click', () => { activeLevel = b.dataset.level; syncLevelButtons(); reRender(); }));

    el.simple.addEventListener('change', () => { simpleLang = el.simple.checked; reRender(); });
    el.run.addEventListener('click', run);
    if (el.reset) el.reset.addEventListener('click', () => { if (currentSampleIdx < 0) clearAll(); else loadSample(currentSampleIdx); });
    if (el.edit) el.edit.addEventListener('click', () => {
      if (SECTIONS.every(s => editSet.has(s))) editSet.clear(); else SECTIONS.forEach(s => editSet.add(s));
      if (activeCorrection) renderCorrection(activeCorrection, activeEssay);
    });
    // The page URL / page numbers in the PDF are Chrome's OWN print header and
    // footer, not part of this page - CSS cannot remove them, so tell the
    // teacher where the switch is. Paint the note before print() blocks.
    if (el.print) el.print.addEventListener('click', () => {
      note('In the print dialog, turn OFF "Headers and footers" so the page URL is not printed.');
      setTimeout(() => window.print(), 60);
    });
    const showRel = (on) => { if (el.relModal) el.relModal.hidden = !on; };
    if (el.release) el.release.addEventListener('click', () => showRel(true));
    if (el.relCancel) el.relCancel.addEventListener('click', () => showRel(false));
    if (el.relConfirm) el.relConfirm.addEventListener('click', () => { showRel(false); note('Demo only - releasing is not wired yet. This is where the reviewed feedback would be saved and sent to the student.'); });
    if (el.relModal) el.relModal.addEventListener('click', (e) => { if (e.target === el.relModal) showRel(false); });

    syncLevelButtons();
    clearAll();
    gateDeepButton();
    consumePrefill();
  }

  // Placement handoff: the teacher pressed "Open in Writing AI" on a
  // placement result, so the essay + prompt arrive via localStorage
  // (same origin). One-shot: the key is removed as soon as it is read.
  function consumePrefill() {
    let raw = null;
    try { raw = localStorage.getItem('llwPrefill'); localStorage.removeItem('llwPrefill'); } catch (_) {}
    if (!raw) return;
    let pre = null;
    try { pre = JSON.parse(raw); } catch (_) { return; }
    if (!pre || !pre.essay || !el.essay) return;
    if (el.samplePick) el.samplePick.value = '';
    el.essay.value = String(pre.essay);
    if (el.task && pre.task) el.task.value = String(pre.task);
    if (el.rubric && pre.rubric) { el.rubric.value = String(pre.rubric); syncRubricHint(); }
    note((pre.student ? pre.student + '’s' : 'The student’s') + ' placement essay is loaded - pick a depth and press Analyze.');
  }

  // ── Deep tier gating (client-side mirror of the server rule) ──
  // The Deep button is HIDDEN unless the signed-in user is the admin or has
  // the Deep grant (settings/aiWritingAccess.deepUids). The analyzeWriting
  // function still enforces this server-side; this only removes the tease.
  function gateDeepButton() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    whenAuthUser(function (user) {
      if (!user) return;
      if (String(user.email || '').toLowerCase() === 'akabiriaslifar@fsm.edu.tr') return; // admin sees all
      firebase.firestore().collection('settings').doc('aiWritingAccess').get().then(function (snap) {
        var cfg = snap.exists ? (snap.data() || {}) : {};
        var deep = Array.isArray(cfg.deepUids) ? cfg.deepUids : [];
        if (deep.indexOf(user.uid) !== -1) return;
        var btn = el.levels && el.levels.querySelector('.cor-level-btn[data-level="deep"]');
        if (btn) btn.style.display = 'none';
        if (activeLevel === 'deep') { activeLevel = 'medium'; syncLevelButtons(); reRender(); }
      }).catch(function () {});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
