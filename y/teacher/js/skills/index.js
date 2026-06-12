/* ============================================================
   TEACHER — Skill classification & filter-strip helpers
   Central place that maps session.activity → skill category,
   and drives the skill-pill strips on Students / Activity tabs.
   ============================================================ */

// activity → skill mapping
// Vocabulary is the default catch-all (legacy sessions may have
// unknown activity strings we don't want to drop).
const ACTIVITY_TO_SKILL = {
  // Vocabulary
  match:             'vocabulary',
  choice:            'vocabulary',
  reverse:           'vocabulary',
  spelling:          'vocabulary',
  fillblank:         'vocabulary',
  order:             'vocabulary',
  pronunciation:     'vocabulary',
  unscramble:        'vocabulary',
  'unscramble-diff': 'vocabulary',
  // Listening
  'listening-exam':  'listening',
  listening:         'listening',
  // Reading
  'reading-exam':    'reading',
  reading:           'reading',
  // Grammar (practice games)
  'grammar-choice':     'grammar',
  'grammar-fill':       'grammar',
  'grammar-unscramble': 'grammar',
  grammar:           'grammar',
  writing:           'writing',
  speaking:          'speaking'
};

function activityToSkill(activity) {
  return ACTIVITY_TO_SKILL[activity] || 'vocabulary';
}

function filterSessionsBySkill(sessions, skill) {
  if (!skill || skill === 'all') return sessions;
  return sessions.filter(s => activityToSkill(s.activity) === skill);
}

// Returns students who have at least one session matching the skill.
function filterStudentsBySkill(students, allSessions, skill) {
  if (!skill || skill === 'all') return students;
  const userIds = new Set(
    filterSessionsBySkill(allSessions, skill).map(s => s.userId)
  );
  return students.filter(s => userIds.has(s.id));
}

// ---- Skill strip UI --------------------------------------------------
// One active skill per context ("students", "activity", …).
const currentSkillFilter = { students: 'all', activity: 'all' };

function initSkillStrip(context, onChange) {
  const strip = document.querySelector(`.skill-filter-strip[data-context="${context}"]`);
  if (!strip) return;
  strip.addEventListener('click', e => {
    const pill = e.target.closest('.skill-pill');
    if (!pill) return;
    strip.querySelectorAll('.skill-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentSkillFilter[context] = pill.dataset.skill;
    if (typeof onChange === 'function') onChange(pill.dataset.skill);
  });
}

function getSkillFilter(context) {
  return currentSkillFilter[context] || 'all';
}

// Public API
window.activityToSkill        = activityToSkill;
window.filterSessionsBySkill  = filterSessionsBySkill;
window.filterStudentsBySkill  = filterStudentsBySkill;
window.initSkillStrip         = initSkillStrip;
window.getSkillFilter         = getSkillFilter;

// Auto-wire both strips on DOM ready. Each pill click just re-runs the
// existing render function for that tab — no other changes needed.
document.addEventListener('DOMContentLoaded', () => {
  initSkillStrip('students', () => {
    if (typeof renderStudentsTable === 'function') renderStudentsTable();
  });
  initSkillStrip('activity', () => {
    if (typeof loadRecentActivity === 'function') loadRecentActivity();
  });
});
