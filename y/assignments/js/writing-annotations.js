/* ============================================================
   WRITING ANNOTATIONS — shared inline-feedback engine
   ------------------------------------------------------------
   Powers the Google-Docs-style inline comments on a student's
   essay. Used by BOTH:
     • the teacher grading view (create + edit + delete), and
     • the student feedback view (read-only).

   An annotation:
     { id, criterion (TA/CC/GR/VO), score (0-5|null),
       text, quote, start, end, by, createdAt }

   Anchoring: each annotation stores char offsets (start,end) into
   the submission's plain responseText PLUS the exact `quote`. On
   render we verify text.slice(start,end) === quote; if the text
   shifted (e.g. student resubmitted), we search for the quote and
   re-anchor. If it can't be found, the annotation is "detached"
   and shown in a side list instead of inline — never lost.

   window.WritingAnnotations API:
     render(container, text, annotations, opts)
     getSelection(container)                → {start,end,quote}|null
     openComposer(opts)                     → teacher popup
     isPhone()                              → boolean
     recentList() / pushRecent(text)
   ============================================================ */
(function () {
  'use strict';

  const CRIT_COLORS = {
    CC: '#34d399', // Organization — emerald
    TA: '#a78bfa', // Content — violet
    GR: '#38bdf8', // Language — sky
    VO: '#fbbf24'  // Word choice — amber
  };
  const BANDS = ['No Attempt', 'Poor', 'Needs Improvement', 'Satisfactory', 'Good', 'Excellent'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function bank() { return window.WRITING_COMMENT_BANK || null; }
  function critLabel(rubric, c) {
    const b = bank();
    return b ? b.label(rubric, c) : c;
  }

  // ── Phone guard ────────────────────────────────────────────
  function isPhone() {
    // Coarse pointer + narrow viewport = phone. Tablets/laptops pass.
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return narrow && coarse;
  }

  // ── Anchor resolution ──────────────────────────────────────
  function resolve(ann, text) {
    if (!ann) return null;
    const q = ann.quote || '';
    // 1. Exact offset still matches?
    if (typeof ann.start === 'number' && typeof ann.end === 'number'
        && text.slice(ann.start, ann.end) === q && q.length) {
      return { start: ann.start, end: ann.end };
    }
    // 2. Search for the quote (first occurrence). Re-anchor.
    if (q.length) {
      const i = text.indexOf(q);
      if (i !== -1) return { start: i, end: i + q.length };
    }
    // 3. Detached.
    return null;
  }

  // ── Render essay text with highlight marks ─────────────────
  // container: the element holding the essay (we OWN its innerHTML).
  // text: plain responseText. annotations: array. opts.mode + callbacks.
  function render(container, text, annotations, opts) {
    opts = opts || {};
    text = String(text || '');
    const anns = (annotations || []).slice();

    // Resolve each annotation to a concrete range (or detached).
    const ranges = [];
    const detached = [];
    anns.forEach(a => {
      const r = resolve(a, text);
      if (r) ranges.push({ a, start: r.start, end: r.end });
      else detached.push(a);
    });

    // Sort by start; drop overlaps (keep the earlier one, detach the
    // later overlapping one so nothing is silently lost).
    ranges.sort((x, y) => x.start - y.start || x.end - y.end);
    const placed = [];
    let lastEnd = -1;
    ranges.forEach(r => {
      if (r.start >= lastEnd) { placed.push(r); lastEnd = r.end; }
      else detached.push(r.a);
    });

    // Build HTML: text between marks is escaped; ranges become <mark>.
    let html = '';
    let cursor = 0;
    placed.forEach(r => {
      if (r.start > cursor) html += esc(text.slice(cursor, r.start));
      const color = CRIT_COLORS[r.a.criterion] || '#a78bfa';
      html += '<mark class="wa-hl" data-ann="' + esc(r.a.id) + '" '
            + 'style="background:' + color + '26; border-bottom:2px solid ' + color + '; '
            + 'border-radius:2px; padding:0 1px; cursor:pointer;">'
            + esc(text.slice(r.start, r.end)) + '</mark>';
      cursor = r.end;
    });
    if (cursor < text.length) html += esc(text.slice(cursor));
    container.innerHTML = html || esc(text) || '(No text submitted.)';

    // Wire click on a mark → show its comment bubble.
    container.querySelectorAll('.wa-hl').forEach(m => {
      m.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = m.getAttribute('data-ann');
        const a = anns.find(x => x.id === id);
        if (a) showBubble(m, a, opts);
      });
    });

    return { placed: placed.map(p => p.a), detached: detached };
  }

  // ── Selection → offsets within the container's plain text ──
  function getSelection(container) {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;

    // Absolute offset = length of all text before a node/offset, walking
    // text nodes in document order within the container.
    function offsetOf(node, nodeOffset) {
      let total = 0;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (n === node) return total + nodeOffset;
        total += n.nodeValue.length;
      }
      return total;
    }
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    if (end <= start) return null;
    const quote = sel.toString();
    if (!quote.trim()) return null;
    return { start: Math.min(start, end), end: Math.max(start, end), quote };
  }

  // ── Comment bubble (view a single annotation) ──────────────
  function showBubble(anchorEl, ann, opts) {
    closeBubble();
    const color = CRIT_COLORS[ann.criterion] || '#a78bfa';
    const scoreTxt = (ann.score != null) ? (ann.score + ' — ' + (BANDS[ann.score] || '')) : '';
    const rubric = opts.rubric || 'essay';
    const bub = document.createElement('div');
    bub.className = 'wa-bubble';
    bub.innerHTML =
      '<div class="wa-bubble-head" style="border-color:' + color + ';">'
      + '<span class="wa-chip" style="background:' + color + '22; color:' + color + '; border-color:' + color + '55;">'
      + esc(critLabel(rubric, ann.criterion)) + (scoreTxt ? ' · ' + esc(scoreTxt) : '') + '</span>'
      + (opts.mode === 'teacher'
          ? '<button class="wa-del" title="Delete comment" data-id="' + esc(ann.id) + '">🗑</button>' : '')
      + '</div>'
      + '<div class="wa-bubble-body">' + esc(ann.text) + '</div>';
    document.body.appendChild(bub);
    const r = anchorEl.getBoundingClientRect();
    bub.style.top = (window.scrollY + r.bottom + 6) + 'px';
    bub.style.left = (window.scrollX + Math.max(8, Math.min(r.left, window.innerWidth - 320))) + 'px';

    const del = bub.querySelector('.wa-del');
    if (del && opts.onDelete) {
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onDelete(ann.id);
        closeBubble();
      });
    }
    setTimeout(() => document.addEventListener('click', closeBubble, { once: true }), 0);
  }
  function closeBubble() {
    document.querySelectorAll('.wa-bubble').forEach(b => b.remove());
  }

  // ── Recently-used comments (per teacher, localStorage) ─────
  function recentKey() {
    let uid = 'anon';
    try { if (window.auth && auth.currentUser) uid = auth.currentUser.uid; } catch (_) {}
    return 'wa-recent-' + uid;
  }
  function recentList() {
    try { return JSON.parse(localStorage.getItem(recentKey()) || '[]'); } catch (_) { return []; }
  }
  function pushRecent(text) {
    if (!text || !text.trim()) return;
    let list = recentList().filter(t => t !== text);
    list.unshift(text);
    list = list.slice(0, 12);
    try { localStorage.setItem(recentKey(), JSON.stringify(list)); } catch (_) {}
  }

  // ── Teacher composer popup ─────────────────────────────────
  // opts: { rubric, quote, criterion?, score?, onSave(annPartial), onCancel }
  // onSave receives { criterion, score, text } — caller adds id/anchor.
  function openComposer(opts) {
    opts = opts || {};
    const rubric = opts.rubric || 'essay';
    let criterion = opts.criterion || 'TA';
    let score = (opts.score != null) ? opts.score : null;

    const bg = document.createElement('div');
    bg.className = 'wa-composer-bg';
    bg.innerHTML = '<div class="wa-composer" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(bg);
    const box = bg.querySelector('.wa-composer');

    function critTabs() {
      return ['TA', 'CC', 'GR', 'VO'].map(c => {
        const on = c === criterion;
        const col = CRIT_COLORS[c];
        return '<button type="button" class="wa-crit" data-c="' + c + '" '
          + 'style="border-color:' + (on ? col : 'var(--border-color,rgba(255,255,255,0.12))') + ';'
          + 'background:' + (on ? col + '22' : 'transparent') + ';color:' + (on ? col : 'var(--text-secondary,#94a3b8)') + ';">'
          + esc(critLabel(rubric, c)) + '</button>';
      }).join('');
    }
    function scoreRow() {
      let h = '';
      for (let s = 5; s >= 0; s--) {
        const on = score === s;
        h += '<button type="button" class="wa-score" data-s="' + s + '" '
          + 'style="' + (on ? 'background:#6366f1;color:#fff;border-color:#6366f1;' : '') + '">'
          + s + ' — ' + BANDS[s] + '</button>';
      }
      return h;
    }
    function bankList() {
      if (score == null) return '<div class="wa-hint">Pick a score above to see suggested comments.</div>';
      const b = bank();
      const comments = b ? b.get(rubric, criterion, score) : [];
      const recents = recentList();
      let h = '';
      if (recents.length) {
        h += '<div class="wa-section-lbl">Recently used</div>';
        h += recents.slice(0, 4).map(t =>
          '<button type="button" class="wa-cmt wa-recent-cmt">' + esc(t) + '</button>').join('');
      }
      h += '<div class="wa-section-lbl">' + esc(critLabel(rubric, criterion)) + ' · ' + s_band(score) + '</div>';
      if (!comments.length) {
        h += '<div class="wa-hint">No saved comments for this cell yet — type your own below.</div>';
      } else {
        h += comments.map(t => '<button type="button" class="wa-cmt">' + esc(t) + '</button>').join('');
      }
      return h;
    }
    function s_band(s) { return s + ' — ' + BANDS[s]; }

    function paint() {
      box.innerHTML =
        '<div class="wa-composer-head">'
        + '<strong>💬 Comment on:</strong> <span class="wa-quote">“' + esc((opts.quote || '').slice(0, 120)) + ((opts.quote || '').length > 120 ? '…' : '') + '”</span>'
        + '<button type="button" class="wa-x" title="Close">✕</button>'
        + '</div>'
        + '<div class="wa-crit-row">' + critTabs() + '</div>'
        + '<div class="wa-score-row">' + scoreRow() + '</div>'
        + '<div class="wa-bank">' + bankList() + '</div>'
        + '<div class="wa-staged-lbl">Your comment (click suggestions to add; edit freely)</div>'
        + '<textarea class="wa-staged" rows="4" placeholder="Write or build the comment here…">' + esc(box._staged || '') + '</textarea>'
        + '<div class="wa-composer-foot">'
        + '<button type="button" class="modal-btn modal-btn-cancel wa-cancel">Cancel</button>'
        + '<button type="button" class="modal-btn modal-btn-save wa-save">Add comment</button>'
        + '</div>';

      const ta = box.querySelector('.wa-staged');
      ta.addEventListener('input', () => { box._staged = ta.value; });

      box.querySelectorAll('.wa-crit').forEach(btn =>
        btn.addEventListener('click', () => { criterion = btn.dataset.c; box._staged = ta.value; paint(); }));
      box.querySelectorAll('.wa-score').forEach(btn =>
        btn.addEventListener('click', () => { score = Number(btn.dataset.s); box._staged = ta.value; paint(); }));
      box.querySelectorAll('.wa-cmt').forEach(btn =>
        btn.addEventListener('click', () => {
          const t = btn.textContent;
          const cur = ta.value.trim();
          ta.value = cur ? (cur + ' ' + t) : t;   // mix & match
          box._staged = ta.value;
          ta.focus();
        }));
      box.querySelector('.wa-x').addEventListener('click', cancel);
      box.querySelector('.wa-cancel').addEventListener('click', cancel);
      box.querySelector('.wa-save').addEventListener('click', save);
    }

    function cancel() { bg.remove(); if (opts.onCancel) opts.onCancel(); }
    function save() {
      const text = (box.querySelector('.wa-staged').value || '').trim();
      if (!text) { box.querySelector('.wa-staged').focus(); return; }
      pushRecent(text);
      bg.remove();
      if (opts.onSave) opts.onSave({ criterion: criterion, score: score, text: text });
    }
    bg.addEventListener('click', (e) => { if (e.target === bg) cancel(); });
    box._staged = '';
    paint();
  }

  // ── Inject styles once ─────────────────────────────────────
  function injectCss() {
    if (document.getElementById('wa-css')) return;
    const css = document.createElement('style');
    css.id = 'wa-css';
    css.textContent = `
.wa-bubble{position:absolute;z-index:10050;max-width:300px;background:var(--bg-card,#0f172a);
  border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:10px;
  box-shadow:0 14px 40px rgba(0,0,0,0.5);padding:0;overflow:hidden;font-size:0.9em;}
.wa-bubble-head{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 10px;border-bottom:2px solid;}
.wa-bubble-body{padding:10px;color:var(--text-primary,#f1f5f9);line-height:1.5;}
.wa-chip{font-size:0.78em;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid;}
.wa-del{background:transparent;border:none;cursor:pointer;font-size:1em;opacity:0.7;}
.wa-del:hover{opacity:1;}
.wa-composer-bg{position:fixed;inset:0;z-index:10040;background:rgba(8,12,24,0.6);
  backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;
  padding:6vh 16px;overflow-y:auto;}
.wa-composer{background:var(--bg-card,#0f172a);border:1px solid var(--border-color,rgba(255,255,255,0.12));
  border-radius:16px;max-width:560px;width:100%;padding:16px 18px;box-shadow:0 30px 80px rgba(0,0,0,0.6);
  color:var(--text-primary,#f1f5f9);}
.wa-composer-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.wa-composer-head .wa-quote{color:var(--text-muted,#94a3b8);font-style:italic;flex:1;min-width:0;}
.wa-composer-head .wa-x{margin-left:auto;background:transparent;border:none;color:var(--text-muted,#94a3b8);
  font-size:1.1em;cursor:pointer;}
.wa-crit-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;}
.wa-crit{padding:7px 10px;border-radius:8px;border:1.5px solid;font-family:inherit;font-weight:700;
  font-size:0.85em;cursor:pointer;}
.wa-score-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.wa-score{padding:5px 9px;border-radius:999px;border:1px solid var(--border-color,rgba(255,255,255,0.14));
  background:transparent;color:var(--text-secondary,#cbd5e1);font-family:inherit;font-size:0.8em;cursor:pointer;}
.wa-bank{max-height:30vh;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:5px;
  padding-right:4px;}
.wa-section-lbl{font-size:0.72em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
  color:var(--text-muted,#94a3b8);margin:6px 0 2px;}
.wa-cmt{text-align:left;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color,rgba(255,255,255,0.10));
  background:rgba(255,255,255,0.03);color:var(--text-primary,#f1f5f9);font-family:inherit;font-size:0.88em;
  cursor:pointer;line-height:1.4;}
.wa-cmt:hover{border-color:#6366f1;background:rgba(99,102,241,0.12);}
.wa-recent-cmt{border-style:dashed;}
.wa-hint{color:var(--text-muted,#94a3b8);font-size:0.85em;padding:8px;font-style:italic;}
.wa-staged-lbl{font-size:0.8em;font-weight:600;color:var(--text-primary,#f1f5f9);margin-bottom:4px;}
.wa-staged{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;
  background:var(--bg-item,rgba(255,255,255,0.04));color:var(--text-primary,#f1f5f9);
  border:1px solid var(--border-color,rgba(255,255,255,0.14));resize:vertical;font-family:inherit;
  font-size:0.92em;margin-bottom:12px;}
.wa-composer-foot{display:flex;gap:8px;justify-content:flex-end;}
`;
    document.head.appendChild(css);
  }
  injectCss();

  window.WritingAnnotations = {
    render: render,
    getSelection: getSelection,
    openComposer: openComposer,
    isPhone: isPhone,
    resolve: resolve,
    recentList: recentList,
    pushRecent: pushRecent,
    closeBubble: closeBubble,
    CRIT_COLORS: CRIT_COLORS,
    BANDS: BANDS
  };
})();
