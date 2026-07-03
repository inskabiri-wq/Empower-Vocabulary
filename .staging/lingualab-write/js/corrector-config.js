/* ============================================================
   EMPOWER WRITE · config (levels + severity)
   ------------------------------------------------------------
   Standalone STAGING build. Lives OUTSIDE y/ so it is never
   deployed. Criterion labels/colours + the comment bank are
   pulled at runtime from the REAL app files (loaded by relative
   path in index.html), so this stays in sync with production
   and "mounting" later is a straight move into y/.

   No scores anywhere · feedback is qualitative only. The three
   levels control DEPTH, not marks.
   ============================================================ */
(function () {
  'use strict';

  // The three correction depths (the user's spec).
  window.CORRECTOR_LEVELS = {
    light: {
      key: 'light', label: 'Light', tagline: 'Quick triage', icon: '🪶',
      blurb: 'Flags only what truly matters: the errors a reader notices first and that hurt communication most. Fast and encouraging.',
      shows: { criteria: 'compact', plan: false, rewrites: false }
    },
    medium: {
      key: 'medium', label: 'Medium', tagline: 'Full correction', icon: '✍️',
      blurb: 'A complete correction pass across all four criteria, with a fix or tip on every notable point, plus a short improvement plan. The everyday assignment marking.',
      shows: { criteria: 'full', plan: true, rewrites: false }
    },
    deep: {
      key: 'deep', label: 'Deep', tagline: 'Minute analysis', icon: '🔬',
      blurb: 'Goes through the text top to bottom: every issue named by its grammar point, a detailed analysis of each criterion, model rewrites of weak sentences, and a focused plan of what to do next.',
      shows: { criteria: 'full', plan: true, rewrites: true }
    }
  };

  // Severity = WHAT a mark is. Colour for fix/tip comes from the
  // criterion; strength is always green; tip uses a dashed underline.
  window.CORRECTOR_SEVERITY = {
    strength: { label: 'Strength', glyph: '✓', color: '#10b981', dashed: false },
    fix:      { label: 'Fix',      glyph: '✎', color: null,       dashed: false },
    tip:      { label: 'Tip',      glyph: '💡', color: null,      dashed: true  }
  };

  // Fallback criterion colours (kept identical to writing-annotations.js
  // CRIT_COLORS) in case that file is opened before this one.
  window.CORRECTOR_CRIT_COLORS = {
    CC: '#34d399', TA: '#a78bfa', GR: '#38bdf8', VO: '#fbbf24'
  };
})();
