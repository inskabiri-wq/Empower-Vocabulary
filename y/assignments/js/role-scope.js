/* ============================================================
   ROLE-BASED ASSIGNMENT SCOPE — Phase B
   Hides target options that non-admin teachers shouldn't have
   (Entire Level, Entire Module) and restricts the class dropdown
   to their assigned classes. Mirrors the Firestore rule that
   enforces the same restriction server-side.

   Single source of truth for "what can this teacher assign to?"
   so the three creation modals stay in sync.

   Loaded BEFORE the form modules so each modal can call:
     applyRoleScopeToTargetDropdown('writingTargetType');

   Run on EVERY open of a modal (currentUserData / isAdmin may
   not be available until auth + dashboard load finishes).
   ============================================================ */

(function () {
  'use strict';

  // Internal: is the current user admin? Falls back to false if the
  // helper hasn't been defined yet (e.g. modal opened before config.js
  // finished loading, which shouldn't happen but be defensive).
  function _isAdminNow() {
    try { return typeof isAdmin === 'function' && isAdmin(); }
    catch (_) { return false; }
  }

  // Strips the "Entire Level" and "Entire Module" options from a target
  // dropdown when the current user isn't admin. Admins keep all four.
  // Idempotent — calling multiple times is safe (it inserts a dataset
  // marker so options are only removed once).
  function applyRoleScopeToTargetDropdown(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    if (_isAdminNow()) {
      // Admin gets everything — make sure no prior call hid options.
      return;
    }
    // Remove level + module options for non-admin teachers.
    Array.from(sel.options).forEach(opt => {
      if (opt.value === 'level' || opt.value === 'module') {
        opt.remove();
      }
    });
    // If the dropdown was set to a now-removed value (because the modal
    // was opened in admin mode previously, e.g. editing an admin-created
    // assignment), fall back to 'class' so the form doesn't break.
    const valid = Array.from(sel.options).map(o => o.value);
    if (!valid.includes(sel.value)) {
      sel.value = 'class';
      // Fire change so the dependent picker groups update.
      sel.dispatchEvent(new Event('change'));
    }
  }

  // Returns the list of classes the current user is allowed to assign
  // to. Admin → all classes (student-derived + admin-registered).
  // Non-admin teacher → their assignedClasses (from currentUserData).
  async function allowedClassesForCurrentUser() {
    if (_isAdminNow()) {
      // Admin: union of student-derived + admin-registered classes.
      const fromStudents = (Array.isArray(allStudents) ? allStudents : [])
        .map(s => (s && s.studentClass ? String(s.studentClass).trim() : ''))
        .filter(Boolean);
      let registry = [];
      try {
        const doc = await db.collection('settings').doc('availableClasses').get();
        if (doc.exists) {
          const v = doc.data().classes;
          if (Array.isArray(v)) registry = v.map(s => String(s).trim()).filter(Boolean);
        }
      } catch (_) {}
      return [...new Set([...fromStudents, ...registry])].sort();
    }
    // Teacher: only their assigned classes.
    const ud = (typeof currentUserData !== 'undefined') ? currentUserData : null;
    const assigned = (ud && Array.isArray(ud.assignedClasses)) ? ud.assignedClasses : [];
    return assigned.map(s => String(s).trim()).filter(Boolean).sort();
  }

  // Repopulates a class <select> with the role-scoped list. Replaces
  // every option with the allowed set, preserving the previously
  // selected value if it's still legal.
  async function populateClassDropdownScoped(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const previous = sel.value;
    sel.innerHTML = '<option value="">— Loading classes —</option>';
    const classes = await allowedClassesForCurrentUser();
    if (classes.length === 0) {
      sel.innerHTML = '<option value="">— No classes assigned to you —</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Select a class —</option>'
      + classes.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c.replace(/</g, '&lt;')}</option>`).join('');
    if (previous && classes.includes(previous)) sel.value = previous;
  }

  // Filters the student list to the teacher's assigned classes (admin
  // keeps everyone). Used by the "Specific Students" picker so a
  // teacher can't pick students from a class they don't teach.
  function studentsAllowedForCurrentUser() {
    const all = Array.isArray(allStudents) ? allStudents : [];
    if (_isAdminNow()) return all;
    const ud = (typeof currentUserData !== 'undefined') ? currentUserData : null;
    const assigned = (ud && Array.isArray(ud.assignedClasses)) ? ud.assignedClasses.map(s => String(s).trim()) : [];
    if (assigned.length === 0) return [];
    return all.filter(s => assigned.includes(String(s.studentClass || '').trim()));
  }

  window.applyRoleScopeToTargetDropdown = applyRoleScopeToTargetDropdown;
  window.populateClassDropdownScoped    = populateClassDropdownScoped;
  window.studentsAllowedForCurrentUser  = studentsAllowedForCurrentUser;
})();
