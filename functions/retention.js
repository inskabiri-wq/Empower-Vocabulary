'use strict';
/* ============================================================
   retention.js - the pruning logic, on its own so it can be tested.
   ------------------------------------------------------------
   Kept out of index.js deliberately. Everything exported from index.js is
   inspected by the Firebase CLI as a deployable function, so a plain helper
   exported there is awkward; and this is the one piece of the project that
   deletes real student data, so it is the piece that most needs a test able
   to call it directly.

   `db` is passed in rather than imported, so y/tools/retention-check.js can
   run the REAL code against the emulator.

   See the block above pruneRetention in index.js for why each guard exists.
   ============================================================ */

// The config picks settings FOR these. It cannot add to this list, so nothing
// stored in Firestore can ever point the pruner at `users`.
const COLLECTIONS = {
  activityLogs: { field: 'timestamp' },
  sessions:     { field: 'createdAt' }
};

// A window shorter than this is read as a typo, not an instruction. `months:0`
// would otherwise mean "delete everything", which is the likeliest way this
// could go catastrophically wrong.
const MIN_MONTHS = 3;
const MAX_PER_RUN = 2000;   // matches the manual tool's cap in activity-admin.js

function cutoffFor(months, now) {
  const d = new Date(now ? now.getTime() : Date.now());
  d.setMonth(d.getMonth() - months);
  return d;
}

/* Prune ONE collection. Returns a plain report and never throws for a
   configuration problem: an unusable config is a skip with a reason, because
   a scheduled job that crashes on bad input is harder to notice than one that
   says why it did nothing. */
async function pruneOneCollection(db, coll, cfg, opts) {
  opts = opts || {};
  const out = { collection: coll, deleted: 0, matched: 0, skipped: null };

  const spec = COLLECTIONS[coll];
  if (!spec) { out.skipped = 'not an allowed collection'; return out; }
  if (!cfg || cfg.enabled !== true) { out.skipped = 'not enabled'; return out; }

  const months = Number(cfg.months);
  if (!isFinite(months) || months < MIN_MONTHS) {
    out.skipped = 'window ' + cfg.months + ' is below the ' + MIN_MONTHS +
                  '-month floor, treating it as a mistake';
    return out;
  }

  const cutoff = cutoffFor(months, opts.now);
  out.cutoff = cutoff.toISOString().slice(0, 10);
  out.months = months;

  // A range query only matches documents that HAVE this field, with a
  // comparable type. Documents missing it, or holding a string where a
  // Timestamp is expected, are invisible here and can never be deleted. That
  // is a Firestore guarantee rather than something this code has to get right.
  const q = db.collection(coll).where(spec.field, '<', cutoff);

  out.matched = (await q.count().get()).data().count;
  if (!out.matched) { out.skipped = 'nothing older than ' + out.cutoff; return out; }

  // DRY RUN IS THE DEFAULT. Only an explicit false deletes anything.
  if (cfg.dryRun !== false) {
    out.skipped = 'DRY RUN - would delete ' + out.matched + ' docs older than ' +
                  out.cutoff + '. Set dryRun:false to act.';
    return out;
  }

  const cap = Math.max(1, Number(opts.maxPerRun) || MAX_PER_RUN);
  while (out.deleted < cap) {
    const snap = await q.limit(Math.min(400, cap - out.deleted)).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(function (d) { batch.delete(d.ref); });
    await batch.commit();
    out.deleted += snap.size;
    if (snap.size < 400) break;
  }
  out.remaining = (await q.count().get()).data().count;
  return out;
}

module.exports = { COLLECTIONS, MIN_MONTHS, MAX_PER_RUN, cutoffFor, pruneOneCollection };
