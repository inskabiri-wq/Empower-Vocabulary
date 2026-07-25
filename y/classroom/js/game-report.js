/* ============================================================
   GAME REPORT WRITER - shared by every classroom host page
   ------------------------------------------------------------
   Persists a compact, permanent record of a finished classroom
   game into /gameReports, so results survive after the live
   session doc is deleted (Race deletes its session on close).
   Surfaced in Admin > Reports (teacher/js/reports-admin.js),
   which lists games, shows the scoreboard and offers download +
   retention cleanup.

   Called from each host's showResults(). Idempotent: the doc id
   is <game>-<code>-<YYYYMMDD>, so a re-opened results screen
   just overwrites the same report instead of duplicating it.
   FAIL-SILENT by design - a reporting hiccup must never break
   the live results screen.

   window.saveGameReport(db, data) - data:
     game        'race'|'heist'|'trust'|'reading'|'listening'
     mode        question source or 'exam'
     code        session code
     teacherId, teacherName
     level, unit (or exam title), examId?, examTitle?, outcome?
     wordCount?  players: [{ name, score }]
   ============================================================ */
(function () {
  'use strict';

  function day() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  window.saveGameReport = function (db, data) {
    try {
      if (!db || !data || !data.game || !data.code) return Promise.resolve();
      var today = day();
      var id = data.game + '-' + String(data.code) + '-' + today.replace(/-/g, '');
      var players = Array.isArray(data.players) ? data.players.map(function (p) {
        return { name: String((p && p.name) || ''), score: Number((p && p.score) || 0) };
      }) : [];
      var doc = {
        game: String(data.game),
        mode: String(data.mode || ''),
        code: String(data.code),
        teacherId: String(data.teacherId || ''),
        teacherName: String(data.teacherName || ''),
        level: String(data.level || ''),
        unit: String(data.unit || ''),
        examId: String(data.examId || ''),
        examTitle: String(data.examTitle || ''),
        outcome: String(data.outcome || ''),
        wordCount: Number(data.wordCount || 0),
        playerCount: players.length,
        players: players,
        day: today,
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      return db.collection('gameReports').doc(id).set(doc, { merge: true })
        .catch(function (e) { console.warn('gameReport save', e); });
    } catch (e) {
      console.warn('gameReport save', e);
      return Promise.resolve();
    }
  };
})();
