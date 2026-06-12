/* ============================================================
   VERIFY GATE — bi-monthly academic info confirmation.
   ----------------------------------------------------------------
   On dashboard load, after auth.js has fetched the user doc and
   stashed it on window.currentStudentData, we run a verification
   check. If the student hasn't confirmed their academic info in
   the last ~60 days (or sessionStorage flag was set during login),
   pop the #verifyGateModal as a blocking overlay.

   Form rules:
     • Level / class / academic year: can stay the same OR change.
     • Module: MUST change. Per the teacher spec — "they cannot
       stay in the same module" because every 2 months the student
       takes an exam and either passes (advance to next module) or
       fails (still advances to next module in the same level).
   ============================================================ */
(function () {
  'use strict';

  // Re-derive the same windows as account-gate.js — kept in sync
  // intentionally. If the auth gate changes its threshold these
  // need to follow.
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const ALL_MODULES = ['Module 1', 'Module 2', 'Module 3', 'Module 4'];

  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v === 'number') return new Date(v);
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // Is the modal needed for THIS user doc?
  function needsVerification(data) {
    if (!data) return false;
    if (data.role && data.role !== 'student' && data.role !== 'demo') return false;
    const last = toDate(data.lastVerifiedAt);
    if (!last) return true;                       // legacy users — verify once
    return (Date.now() - last.getTime()) > SIXTY_DAYS_MS;
  }

  function parseClass(studentClass) {
    // Existing format: a single letter + digits (e.g. "B125", "C302").
    // Tolerate odd values so the modal still renders even if the
    // doc has something unexpected.
    if (!studentClass || typeof studentClass !== 'string') return { letter: '', number: '' };
    const m = studentClass.match(/^([A-Za-z])(\d+)$/);
    return m ? { letter: m[1].toUpperCase(), number: m[2] } : { letter: '', number: '' };
  }

  function openModal(currentData) {
    const overlay  = document.getElementById('verifyGateModal');
    const lvlSel   = document.getElementById('verifyLevel');
    const letterEl = document.getElementById('verifyClassLetter');
    const numberEl = document.getElementById('verifyClassNumber');
    const modSel   = document.getElementById('verifyModule');
    const yrSel    = document.getElementById('verifyYear');
    const errEl    = document.getElementById('verifyGateError');
    const formEl   = document.getElementById('verifyGateForm');
    if (!overlay || !formEl) return;             // dashboard markup missing

    // Pre-fill from current doc. Browsers may not have the option
    // in the dropdown (e.g. a legacy academicYear we don't list); in
    // that case the .value setter silently no-ops, which is fine —
    // the student picks a fresh value.
    if (lvlSel  && currentData.level)        lvlSel.value  = currentData.level;
    if (yrSel   && currentData.academicYear) yrSel.value   = currentData.academicYear;
    const cls = parseClass(currentData.studentClass);
    if (letterEl) letterEl.value = cls.letter || 'B';
    if (numberEl) numberEl.value = cls.number || '';

    // Module dropdown — EXCLUDE the current module so the student
    // is forced to advance. If the user has no module set (legacy),
    // show all options.
    const cur = (currentData.module || '').trim();
    modSel.innerHTML = '<option value="">Select new module…</option>' +
      ALL_MODULES
        .filter(m => m !== cur)
        .map(m => `<option value="${m}">${m}</option>`)
        .join('');

    // Mention the student's previous module in the hint line below
    // the dropdown so they're not guessing what they're moving from.
    // (The "must change" badge in the label is purely visual / static.)
    const hintEl = document.getElementById('verifyModuleHint');
    if (hintEl) {
      hintEl.textContent = cur
        ? `Previous: ${cur}. After every 2-month exam your module advances — pick the next one.`
        : 'After every 2-month exam your module advances. Pick the next one.';
    }

    errEl.textContent = '';                        // empty :empty selector hides it via CSS
    overlay.classList.add('active');
    overlay.style.display = '';                    // .active should reveal it; belt-and-braces

    // Submit handler — re-attaches per open so we don't accumulate.
    formEl.onsubmit = (e) => onSubmit(e, currentData, errEl);
  }

  function closeModal() {
    const overlay = document.getElementById('verifyGateModal');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
  }

  async function onSubmit(e, currentData, errEl) {
    e.preventDefault();
    const level    = document.getElementById('verifyLevel').value;
    const letter   = document.getElementById('verifyClassLetter').value;
    const number   = (document.getElementById('verifyClassNumber').value || '').trim();
    const module_  = document.getElementById('verifyModule').value;
    const acadYear = document.getElementById('verifyYear').value;

    // Defensive validation — the HTML already enforces required, but
    // we double-check so the error renders inline (not a browser tooltip).
    if (!level || !letter || !number || !module_ || !acadYear) {
      errEl.textContent = 'Please fill in every field.';
      errEl.style.display = '';
      return;
    }
    if (Number(number) < 100 || Number(number) > 199) {
      errEl.textContent = 'Class number must be between 100 and 199.';
      errEl.style.display = '';
      return;
    }
    if (module_ === (currentData.module || '')) {
      // Should be impossible — current module is filtered out of the
      // dropdown. Keep the check as a hard floor.
      errEl.textContent = 'You must pick a different module from your previous one.';
      errEl.style.display = '';
      return;
    }

    const studentClass = letter + number;
    const uid = (firebase.auth().currentUser || {}).uid;
    if (!uid) {
      errEl.textContent = 'Session expired. Refresh and sign in again.';
      errEl.style.display = '';
      return;
    }

    try {
      await firebase.firestore().collection('users').doc(uid).update({
        level: level,
        studentClass: studentClass,
        module: module_,
        academicYear: acadYear,
        lastVerifiedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Keep window.currentStudentData in sync so downstream code
      // (sessions, leaderboards) writes the right denormalized values
      // immediately, without waiting for a page refresh.
      if (window.currentStudentData) {
        window.currentStudentData.level = level;
        window.currentStudentData.studentClass = studentClass;
        window.currentStudentData.module = module_;
        window.currentStudentData.academicYear = acadYear;
      }
      try { sessionStorage.removeItem('needsVerification'); } catch (_) {}
      closeModal();
    } catch (e2) {
      console.error('[verify-gate] update failed:', e2);
      errEl.textContent = 'Could not save: ' + (e2.message || e2);
      errEl.style.display = '';
    }
  }

  // Boot: poll for window.currentStudentData (set by student/js/auth.js
  // after it fetches the user doc). When present, decide whether to
  // open the modal. A short interval is fine — we don't need this on
  // the millisecond.
  function boot() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const data = window.currentStudentData;
      if (data) {
        clearInterval(t);
        if (needsVerification(data)) openModal(data);
        return;
      }
      // Give up after ~6 seconds — if auth.js never set the global,
      // it means the user couldn't authenticate; auth.js handles that
      // path (redirect to login).
      if (tries > 60) clearInterval(t);
    }, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
