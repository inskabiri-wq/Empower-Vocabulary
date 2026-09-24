/* ============================================================
   RUNNING SCORE TOTALS, ON THE STUDENT'S OWN DOCUMENT
   ------------------------------------------------------------
   The teacher dashboard loads the most recent 1000 sessions across
   EVERY student and computes each student's average from that slice.
   With 400 students active that window is two or three days, so the
   "needs attention: average below 50%" card was really saying
   "average of whatever of their work happened to land in the last
   1000 rows", and a student busy last month counted as having done
   nothing at all.

   Two earlier options were considered. Querying one student's
   sessions on demand fixed the drill-down (student-detail.js does
   exactly that) but cannot fix this card, which compares everybody
   at once - that would be one query per student per dashboard load.
   Raising the 1000 cap only moves the wall.

   So the totals are kept as they are earned: two counters on the
   student's own user document, incremented when a scored session is
   written. The average is then scoreSum / scoredSessions, already in
   memory with the student list, exact over the whole year, and it
   costs no extra reads at all.

   WHAT COUNTS. Only sessions that were actually marked. An unscored
   session (pronunciation with no spoken attempt) contributes nothing,
   which is the same rule the dashboard already applies - see
   `scoredOnly` in teacher/js/activity.js. Counting them would
   reintroduce the exact bug that made practising pronunciation look
   like failing.

   FAIL-SILENT. A rollup that does not land must never break saving
   the session itself; the dashboard falls back to the session window
   whenever the counters are absent, so a missed increment degrades to
   today's behaviour rather than to a wrong number.

   Usage, after a session document has been written:
     LLRollup.record(db, uid, percentage)     // number, 0-100
     LLRollup.record(db, uid, null)           // unscored - ignored
   ============================================================ */
(function () {
  'use strict';

  function record(db, uid, percentage) {
    try {
      if (!db || !uid) return Promise.resolve();
      // Anything not a real number is an unscored session. Guarding here
      // rather than at each of the six call sites means one rule, not six.
      var pct = Number(percentage);
      if (!isFinite(pct) || percentage == null) return Promise.resolve();
      // Clamp: a malformed percentage must not poison a running total that
      // nothing ever recomputes.
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;

      var FV = (window.firebase && firebase.firestore && firebase.firestore.FieldValue) || null;
      if (!FV) return Promise.resolve();

      return db.collection('users').doc(uid).set({
        statsScoredSessions: FV.increment(1),
        statsScoreSum: FV.increment(pct),
        statsLastScoredAt: FV.serverTimestamp()
      }, { merge: true }).catch(function (e) {
        console.warn('[rollup] not recorded (non-fatal):', e && e.code);
      });
    } catch (e) {
      console.warn('[rollup] failed (non-fatal):', e);
      return Promise.resolve();
    }
  }

  // The average a teacher view should use, or null when this student has no
  // counters yet - in which case the caller falls back to the session window.
  function averageFor(studentDoc) {
    if (!studentDoc) return null;
    var n = Number(studentDoc.statsScoredSessions);
    var sum = Number(studentDoc.statsScoreSum);
    if (!isFinite(n) || !isFinite(sum) || n <= 0) return null;
    return sum / n;
  }

  window.LLRollup = { record: record, averageFor: averageFor };
})();
