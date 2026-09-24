/* ============================================================
   SKILL REGISTRY - assignment system
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
      accent: '#93c5fd',         // teal - matches hub.js
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
      accent: '#60a5fa',         // sky
      status: 'active',
      formId: 'listeningAssignmentForm',
      subtitle: 'Pick an existing listening exam'
    },
    {
      id: 'reading',
      name: 'Reading',
      icon: '📖',
      accent: '#60a5fa',         // rose
      status: 'active',
      formId: 'readingAssignmentForm',
      subtitle: 'Pick an existing reading exam'
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: '✍️',
      accent: '#60a5fa',         // violet
      status: 'active',          // wired in Phase 2 (writing-form.js)
      formId: 'writingAssignmentForm',
      subtitle: 'Prompt + timer + secure exam editor'
    },
    {
      id: 'grammar',
      name: 'Grammar',
      icon: '✏️',
      accent: '#3b82f6',         // amber
      status: 'active',
      formId: 'grammarAssignmentForm',
      subtitle: 'Targeted grammar exercises'
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: '🎤',
      accent: '#60a5fa',         // amber-light
      status: 'coming-soon',
      formId: 'speakingAssignmentForm',
      subtitle: 'Recorded prompts & evaluation'
    }
  ];

  function getSkill(id) {
    return SKILLS.find(s => s.id === id) || null;
  }
  // A skill is offered only if BOTH are true:
  //   - it is built (status 'active' - the registry's own readiness flag), and
  //   - this university has not switched it off in Admin > Features.
  //
  // The second half was missing. `status` is hardcoded in this file, so a skill
  // deactivated by an admin still showed up in the assignments skill strip and
  // in the creation flow, even though its tile had disappeared from the student
  // hub. Same switch, two different answers. Reading window.featureToggles here
  // fixes every consumer at once, because they all come through this function.
  //
  // Absent toggles mean "everything active", which is the safe default and
  // matches how the hub treats them.
  function activeSkills() {
    const toggles = window.featureToggles || {};
    return SKILLS.filter(s => s.status === 'active' && toggles[s.id] !== false);
  }
  function allSkills() {
    return SKILLS.slice();
  }
  // Everything this university actually has, INCLUDING skills that are built
  // but not finished ('coming-soon'), which the UI shows dimmed.
  //
  // This is the one the skill strips want. They were calling all(), which
  // ignores the org toggles completely - so a skill an admin switched off
  // vanished from the hub but still sat in the assignments filter. active() is
  // not right for them either: it also drops 'coming-soon', and those are meant
  // to be visible-but-dimmed so students can see what is on the way.
  //   all()     - every skill, no filtering. Config screens.
  //   visible() - minus the ones switched off. Anything a student sees.
  //   active()  - visible AND finished. Anything a student can OPEN.
  function visibleSkills() {
    const toggles = window.featureToggles || {};
    return SKILLS.filter(s => toggles[s.id] !== false);
  }
  // Used everywhere the UI shows an assignment row. Legacy assignments
  // written before Phase 1 have no `skill` field; we treat them as
  // vocabulary (which is what they all were before the system grew).
  function skillOf(assignment) {
    return (assignment && assignment.skill) || 'vocabulary';
  }

  window.SKILL_REGISTRY = {
    all:       allSkills,
    visible:   visibleSkills,
    active:    activeSkills,
    get:       getSkill,
    skillOf:   skillOf
  };
})();
