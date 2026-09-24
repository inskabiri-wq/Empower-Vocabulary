/* ============================================================
   TEACHER - Skill classification & filter-strip helpers
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
  // Writing
  'writing-exam':    'writing',
  writing:           'writing',
  speaking:          'speaking'
};

// THE SESSION'S OWN `skill` FIELD WINS.
//
// The writing exam saves `activity: 'writing-exam'`, and that key was missing
// from the table above - so it fell through to the vocabulary catch-all and
// every writing exam was filed under Vocabulary in the filters, the per-skill
// breakdown and the reports.
//
// Adding the key fixes today's case and leaves the same trap for the next
// activity someone adds. The exams already write an explicit `skill` field
// ('writing', 'reading', 'listening', 'grammar', 'placement'), so that is
// trusted first and the table is the fallback for the older practice games,
// which carry no skill field. A new activity that sets `skill` is classified
// correctly without touching this file at all.
//
// Accepts either a session object or a bare activity string, because callers
// do both.
const KNOWN_SKILLS = ['vocabulary', 'reading', 'listening', 'writing', 'grammar', 'speaking'];

function activityToSkill(sessionOrActivity) {
  if (sessionOrActivity && typeof sessionOrActivity === 'object') {
    const declared = sessionOrActivity.skill;
    if (declared && KNOWN_SKILLS.indexOf(declared) !== -1) return declared;
    return ACTIVITY_TO_SKILL[sessionOrActivity.activity] || 'vocabulary';
  }
  return ACTIVITY_TO_SKILL[sessionOrActivity] || 'vocabulary';
}

function filterSessionsBySkill(sessions, skill) {
  if (!skill || skill === 'all') return sessions;
  // The whole session, so the declared skill field is used where it exists.
  return sessions.filter(s => activityToSkill(s) === skill);
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
// existing render function for that tab - no other changes needed.
document.addEventListener('DOMContentLoaded', () => {
  initSkillStrip('students', () => {
    if (typeof renderStudentsTable === 'function') renderStudentsTable();
  });
  initSkillStrip('activity', () => {
    if (typeof loadRecentActivity === 'function') loadRecentActivity();
  });
});
