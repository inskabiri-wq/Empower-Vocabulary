/* ============================================================
   SKILL REGISTRY — assignment system
   Single source of truth for the six language skills the platform
   supports. Adding a 7th later = one new entry here.

   Each entry drives:
     - the skill-picker tiles (icon, color, label)
     - which creation form the picker routes to
     - whether the tile appears as "active" or "coming soon"
     - the filter pills on Assignments tabs (teacher & student)

   Loaded BEFORE teacher-assignments.js / student-assignments.js
   in teacher-dashboard.html / student-dashboard.html.
   ============================================================ */

(function () {
  'use strict';

  // status:
  //   'active'      → tile clickable, opens creation form
  //   'coming-soon' → tile rendered with badge, click shows "coming soon" message
  const SKILLS = [
    {
      id: 'vocabulary',
      name: 'Vocabulary',
      icon: '📚',
      accent: '#2dd4bf',         // teal — matches hub.js
      status: 'active',
      // Which creation flow opens when this tile is picked. For Phase 1
      // only 'vocabulary' has its own form; the rest land on the
      // placeholder. Phase 2 wires 'writing' to its dedicated form.
      formId: 'vocabularyAssignmentForm',
      subtitle: 'Pick a book, level, unit and activity'
    },
    {
      id: 'listening',
      name: 'Listening',
      icon: '🎧',
      accent: '#38bdf8',         // sky
      status: 'active',
      formId: 'listeningAssignmentForm',
      subtitle: 'Pick an existing listening exam'
    },
    {
      id: 'reading',
      name: 'Reading',
      icon: '📖',
      accent: '#fb7185',         // rose
      status: 'active',
      formId: 'readingAssignmentForm',
      subtitle: 'Pick an existing reading exam'
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: '✍️',
      accent: '#a78bfa',         // violet
      status: 'active',          // wired in Phase 2 (writing-form.js)
      formId: 'writingAssignmentForm',
      subtitle: 'Prompt + timer + secure exam editor'
    },
    {
      id: 'grammar',
      name: 'Grammar',
      icon: '✏️',
      accent: '#f59e0b',         // amber
      status: 'active',
      formId: 'grammarAssignmentForm',
      subtitle: 'Targeted grammar exercises'
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: '🎤',
      accent: '#fbbf24',         // amber-light
      status: 'coming-soon',
      formId: 'speakingAssignmentForm',
      subtitle: 'Recorded prompts & evaluation'
    }
  ];

  function getSkill(id) {
    return SKILLS.find(s => s.id === id) || null;
  }
  function activeSkills() {
    return SKILLS.filter(s => s.status === 'active');
  }
  function allSkills() {
    return SKILLS.slice();
  }
  // Used everywhere the UI shows an assignment row. Legacy assignments
  // written before Phase 1 have no `skill` field; we treat them as
  // vocabulary (which is what they all were before the system grew).
  function skillOf(assignment) {
    return (assignment && assignment.skill) || 'vocabulary';
  }

  window.SKILL_REGISTRY = {
    all:       allSkills,
    active:    activeSkills,
    get:       getSkill,
    skillOf:   skillOf
  };
})();
