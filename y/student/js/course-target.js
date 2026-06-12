/* ============================================================
   COURSE TARGETING - shared check
   ------------------------------------------------------------
   A course settings doc (e.g. settings/policyCourse) scopes who sees
   the course. NEW combinable shape (tick any mix; an empty list means
   "no restriction on that dimension"; a student must match EVERY
   restricted dimension):
     { active: true,
       scope: { classes: [], levels: [], modules: [], years: [] } }

   Legacy shapes still honoured:
     { targetType: 'class'|'level'|'module'|'year', targets: [...] }
     { classes: [...] }

   Used by courses.html, policy-course.js and the teacher panel.
   ============================================================ */
(function () {
  'use strict';

  function norm(v) { return String(v == null ? '' : v).trim(); }
  function inList(list, val) {
    return list.map(norm).indexOf(norm(val)) >= 0;
  }

  window.courseActiveFor = function (cfg, userDoc) {
    if (!cfg || !cfg.active) return false;
    var d = userDoc || {};
    var cls = d.studentClass;
    var lvl = d.level || d.studentLevel;
    var mod = d.module || d.studentModule;
    var yr  = d.academicYear;

    // New combinable scope
    if (cfg.scope && typeof cfg.scope === 'object') {
      var s = cfg.scope;
      if (Array.isArray(s.classes) && s.classes.length && !inList(s.classes, cls)) return false;
      if (Array.isArray(s.levels)  && s.levels.length  && !inList(s.levels, lvl))  return false;
      if (Array.isArray(s.modules) && s.modules.length && !inList(s.modules, mod)) return false;
      if (Array.isArray(s.years)   && s.years.length   && !inList(s.years, yr))   return false;
      return true;
    }

    // Legacy single-dimension targetType/targets
    var tt = cfg.targetType ||
      ((Array.isArray(cfg.classes) && cfg.classes.length) ? 'class' : 'all');
    var targets = (Array.isArray(cfg.targets) && cfg.targets.length) ? cfg.targets
      : (Array.isArray(cfg.classes) ? cfg.classes : []);
    if (tt === 'all' || !targets.length) return true;
    var val =
      tt === 'class'  ? cls :
      tt === 'level'  ? lvl :
      tt === 'module' ? mod :
      tt === 'year'   ? yr : '';
    return inList(targets, val);
  };
})();
