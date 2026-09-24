/**
 * score-utils.js - one honest answer to "what did this student average?"
 *
 * THE BUG THIS EXISTS TO KILL
 *
 * Aggregation code all over the dashboard was written as:
 *
 *     sum += (session.percentage || 0);   // then divide by list.length
 *
 * `||` cannot tell "scored zero" from "never scored". A session doc that
 * carries no percentage at all becomes a 0% that is also counted in the
 * divisor, so it drags the average down twice over.
 *
 * Two real cases produce exactly that doc:
 *
 *   - a WRITING EXAM that the teacher has not marked yet. writing-exam.js
 *     writes the session with no `percentage` field on purpose - the score
 *     does not exist yet. Under `|| 0` a student who submits three essays
 *     and waits for marking looks like someone who scored zero three times.
 *   - PRONUNCIATION practice, which marks nothing by design. Practising it
 *     enough times was sufficient to get a student flagged as needing
 *     attention, which is the opposite of what the practice deserves.
 *
 * The filter has to happen BEFORE the average, not inside it. That is the
 * whole idea here.
 *
 * This logic started life inside teacher/js/activity.js. It lives here now
 * so every card, table, modal and Reports sheet answers the same way.
 */
(function (global) {
  'use strict';

  // A session counts toward an average only if somebody actually marked it.
  function isScored(s) {
    if (!s || s.unscored) return false;
    if (s.activity === 'pronunciation') return false;   // marks nothing by design
    return typeof s.percentage === 'number' && Number.isFinite(s.percentage);
  }

  function scored(list) {
    return Array.isArray(list) ? list.filter(isScored) : [];
  }

  // Returns null - NOT 0 - when there is nothing to average. Callers must
  // decide how to show "no score yet"; rendering it as 0% is the bug above
  // wearing a different hat.
  function avg(list) {
    const only = scored(list);
    if (!only.length) return null;
    return only.reduce(function (t, s) { return t + s.percentage; }, 0) / only.length;
  }

  // Rounded, or null. Convenience for the many `Math.round(avg)` call sites.
  function avgRounded(list) {
    const a = avg(list);
    return a === null ? null : Math.round(a);
  }

  // Best mark, or null when nothing has been marked. `Math.max()` of an
  // empty list is -Infinity, which has rendered as "-Infinity%" before.
  function best(list) {
    const only = scored(list);
    if (!only.length) return null;
    return only.reduce(function (m, s) { return s.percentage > m ? s.percentage : m; }, only[0].percentage);
  }

  // How many of these are still waiting on a mark. Lets a card say
  // "3 awaiting marking" instead of quietly averaging them as zeros.
  function unscoredCount(list) {
    if (!Array.isArray(list)) return 0;
    return list.length - scored(list).length;
  }

  global.LLScore = { isScored, scored, avg, avgRounded, best, unscoredCount };
})(window);
