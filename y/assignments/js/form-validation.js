/* ============================================================
   ASSIGNMENT FORM VALIDATION HELPER
   Shared validation utilities used by the vocab / writing / exam
   assignment modals. Replaces the "showError → return" pattern
   (where only the FIRST missing field was reported via a toast)
   with inline error messages next to every offending field plus
   a one-shot scroll/focus to the first error.

   Usage in a save handler:

     clearFieldErrors('writingAssignmentModal');
     const errs = validateAll([
       { id: 'writingTitle',        msg: 'Assignment title is required.' },
       { id: 'writingPrompt',       msg: 'Writing prompt is required.' },
       { id: 'writingTimeLimit',    msg: 'Time limit must be a positive number.', test: v => Number(v) >= 1 },
       { id: 'writingDeadline',     msg: 'Due date cannot be empty.' }
     ]);
     if (errs.length) {
       showFieldErrors(errs, 'writingAssignmentModal');
       return;
     }
   ============================================================ */

(function () {
  'use strict';

  // ---- Inject the small validation stylesheet once. ----
  function injectStyles() {
    if (document.getElementById('assignment-validation-css')) return;
    const s = document.createElement('style');
    s.id = 'assignment-validation-css';
    s.textContent = `
      .field-invalid {
        border-color: var(--error, #ef4444) !important;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.18) !important;
      }
      .field-error {
        display: none;
        color: var(--error, #ef4444);
        font-size: 0.82em;
        font-weight: 600;
        margin-top: 4px;
        line-height: 1.3;
      }
      .field-error.visible {
        display: block;
      }
      .validation-banner {
        background: rgba(239, 68, 68, 0.10);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: var(--error, #ef4444);
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 12px;
        font-size: 0.9em;
        font-weight: 600;
      }
      .validation-banner ul {
        margin: 6px 0 0 18px;
        padding: 0;
        font-weight: 400;
      }
    `;
    document.head.appendChild(s);
  }
  injectStyles();

  // ---- Public API ----

  // Runs the rules in order. Returns an array of {id, msg, el} for any
  // field that fails. Rule shape:
  //   { id: 'someInputId', msg: 'Error string' }
  //   { id: '...', msg: '...', test: (value, el) => boolean }   // custom test
  //   { id: '...', msg: '...', when: () => boolean }            // skip if when() false
  function validateAll(rules) {
    const errors = [];
    rules.forEach(rule => {
      if (rule.when && !rule.when()) return;
      const el = document.getElementById(rule.id);
      if (!el) return;
      const val = (el.value != null ? el.value : '').toString().trim();
      const test = (typeof rule.test === 'function')
        ? rule.test(val, el)
        : !!val;
      if (!test) errors.push({ id: rule.id, msg: rule.msg, el });
    });
    return errors;
  }

  // Renders the errors:
  //   1. Mark each invalid field with the .field-invalid class.
  //   2. Find/create a .field-error sibling and put the message inside.
  //   3. Show a banner at the top of the modal listing all errors.
  //   4. Scroll + focus the first invalid field.
  function showFieldErrors(errors, modalId) {
    errors.forEach(({ id, msg, el }) => {
      el.classList.add('field-invalid');
      // Place / reuse the error span as a sibling of the input's form-group.
      const group = el.closest('.assignment-form-group') || el.parentElement;
      let errEl = group ? group.querySelector('.field-error') : null;
      if (!errEl && group) {
        errEl = document.createElement('div');
        errEl.className = 'field-error';
        group.appendChild(errEl);
      }
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.add('visible');
      }
      // Clear marks when the user edits the field.
      const clearOnEdit = () => {
        el.classList.remove('field-invalid');
        if (errEl) errEl.classList.remove('visible');
        el.removeEventListener('input',  clearOnEdit);
        el.removeEventListener('change', clearOnEdit);
      };
      el.addEventListener('input',  clearOnEdit);
      el.addEventListener('change', clearOnEdit);
    });

    // Top-of-modal banner so all errors are visible at a glance,
    // even when the offending field is below the fold.
    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        const inner = modal.querySelector('.modal-box') || modal;
        let banner = inner.querySelector('.validation-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'validation-banner';
          // Insert after the modal's <h3> if one exists.
          const h3 = inner.querySelector('h3');
          if (h3 && h3.nextSibling) inner.insertBefore(banner, h3.nextSibling);
          else inner.insertBefore(banner, inner.firstChild);
        }
        const items = errors.map(e => `<li>${escapeHtml(e.msg)}</li>`).join('');
        banner.innerHTML = `Please fix the following before saving:<ul>${items}</ul>`;
      }
    }

    // Scroll/focus first.
    if (errors[0] && errors[0].el) {
      errors[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { errors[0].el.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  // Wipes any prior errors (call at the START of every save attempt).
  function clearFieldErrors(modalId) {
    const scope = modalId ? document.getElementById(modalId) : document;
    if (!scope) return;
    scope.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
    scope.querySelectorAll('.field-error').forEach(el => {
      el.classList.remove('visible');
      el.textContent = '';
    });
    const banner = scope.querySelector('.validation-banner');
    if (banner) banner.remove();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  window.validateAll       = validateAll;
  window.showFieldErrors   = showFieldErrors;
  window.clearFieldErrors  = clearFieldErrors;
})();
