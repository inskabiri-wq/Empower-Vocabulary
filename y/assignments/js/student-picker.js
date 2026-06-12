/* ============================================================
   student-picker.js  —  shared "select individual students" UI
   Lifted from the vocab assignment form (which has had the
   nice search/filter/select-all box for ages) so writing-form
   and exam-form can reuse the SAME experience instead of each
   rebuilding their own bare checkbox list.

   Why a shared module: the user explicitly asked — "whenever
   you are going to expand a modular system, if it is something
   that you have it already, bring the one and implement it.
   Do not build from scratch." This module IS the import path.

   Public API (window.StudentPicker):
     render({ containerId, checkboxClass, students, onCountChange })
     getSelected(containerId, checkboxClass)            → ['uid', ...]
     setSelected(containerId, checkboxClass, uids)
     filter(containerId, term)   ← exposed for parity / tests

   Each consumer keeps its own checkbox class name so any code
   that already does `.querySelectorAll('.writing-student-checkbox')`
   keeps working unchanged. The HTML, search input, select-all
   buttons, and count are all rendered by this module.

   Re-uses the existing CSS classes from teacher-dashboard.html:
     .student-search-box / .student-search-input
     .student-select-actions / .select-action-btn / .selected-count
     .student-checkbox-items / .student-checkbox-item
     .student-checkbox-name / .student-checkbox-class
   ============================================================ */

(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _defaultStudents() {
    if (typeof studentsAllowedForCurrentUser === 'function') return studentsAllowedForCurrentUser();
    if (Array.isArray(window.allStudents)) return window.allStudents;
    return [];
  }

  // Update the "N selected" counter + fire onCountChange callback.
  function _refreshCount(container, checkboxClass, onCountChange) {
    const count = container.querySelectorAll('.' + checkboxClass + ':checked').length;
    const countEl = container.querySelector('.selected-count');
    if (countEl) {
      countEl.textContent = `${count} selected`;
      countEl.classList.toggle('has-selection', count > 0);
    }
    if (typeof onCountChange === 'function') onCountChange(count);
  }

  // Render the full search-box + actions + checkbox list into the
  // container. Safe to call multiple times (wipes innerHTML each time).
  function render(opts) {
    opts = opts || {};
    const containerId   = opts.containerId;
    const checkboxClass = opts.checkboxClass || 'student-picker-checkbox';
    const onCountChange = opts.onCountChange;
    const students      = opts.students || _defaultStudents();

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!students || students.length === 0) {
      container.innerHTML = `
        <p style="color: var(--text-muted); padding: 14px; text-align: center;">
          No students in your assigned classes yet.
        </p>`;
      return;
    }

    // Unique id namespace so multiple pickers on the same page
    // don't collide on getElementById('studentSearchInput').
    const ns = 'sp-' + containerId;

    container.innerHTML = `
      <div class="student-search-box">
        <input type="text" id="${ns}-search"
               class="student-search-input" autocomplete="off"
               placeholder="🔍 Search by name, email, or class…">
      </div>
      <div class="student-select-actions">
        <button type="button" class="select-action-btn" id="${ns}-all">Select all visible</button>
        <button type="button" class="select-action-btn" id="${ns}-none">Deselect all</button>
        <span class="selected-count">0 selected</span>
      </div>
      <div class="student-checkbox-items">
        ${students.map(s => `
          <label class="student-checkbox-item"
                 data-name="${_esc((s.name || '').toLowerCase())}"
                 data-email="${_esc((s.email || '').toLowerCase())}"
                 data-class="${_esc((s.studentClass || '').toLowerCase())}">
            <input type="checkbox" value="${_esc(s.id)}" class="${_esc(checkboxClass)}">
            <span class="student-checkbox-name">${_esc(s.name || s.email)}</span>
            <span class="student-checkbox-class">${_esc(s.studentClass || 'No class')}</span>
          </label>
        `).join('')}
      </div>
    `;

    // Wire search (scoped to this container only — no global selectors)
    const searchEl = container.querySelector('#' + ns + '-search');
    searchEl.addEventListener('input', () => {
      const term = searchEl.value.toLowerCase().trim();
      container.querySelectorAll('.student-checkbox-item').forEach(item => {
        const matches =
          (item.dataset.name  || '').indexOf(term) !== -1 ||
          (item.dataset.email || '').indexOf(term) !== -1 ||
          (item.dataset.class || '').indexOf(term) !== -1;
        item.style.display = matches ? 'flex' : 'none';
      });
    });

    // Select-all and Deselect-all
    container.querySelector('#' + ns + '-all').addEventListener('click', () => {
      container
        .querySelectorAll('.student-checkbox-item:not([style*="display: none"]) .' + checkboxClass)
        .forEach(cb => { cb.checked = true; });
      _refreshCount(container, checkboxClass, onCountChange);
    });
    container.querySelector('#' + ns + '-none').addEventListener('click', () => {
      container.querySelectorAll('.' + checkboxClass).forEach(cb => { cb.checked = false; });
      _refreshCount(container, checkboxClass, onCountChange);
    });

    // Per-checkbox change handler so the count + callback stay live.
    container.querySelectorAll('.' + checkboxClass).forEach(cb => {
      cb.addEventListener('change', () => _refreshCount(container, checkboxClass, onCountChange));
    });

    _refreshCount(container, checkboxClass, onCountChange);
  }

  function getSelected(containerId, checkboxClass) {
    const c = document.getElementById(containerId);
    if (!c) return [];
    const cls = checkboxClass || 'student-picker-checkbox';
    return Array.from(c.querySelectorAll('.' + cls + ':checked')).map(cb => cb.value);
  }

  function setSelected(containerId, checkboxClass, uids) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const cls = checkboxClass || 'student-picker-checkbox';
    const set = new Set(Array.isArray(uids) ? uids : []);
    c.querySelectorAll('.' + cls).forEach(cb => { cb.checked = set.has(cb.value); });
    _refreshCount(c, cls);
  }

  function filter(containerId, term) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const t = String(term || '').toLowerCase().trim();
    c.querySelectorAll('.student-checkbox-item').forEach(item => {
      const matches =
        (item.dataset.name  || '').indexOf(t) !== -1 ||
        (item.dataset.email || '').indexOf(t) !== -1 ||
        (item.dataset.class || '').indexOf(t) !== -1;
      item.style.display = matches ? 'flex' : 'none';
    });
  }

  window.StudentPicker = { render, getSelected, setSelected, filter };
})();
