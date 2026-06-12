# Firestore read-quota blowout - cause + fix · 2026-06-09

## What happened
Spark (free) tier = 50K Firestore READS/day. Hit 85K -> reads blocked until the
daily reset. NOT a code crash; a quota cap.

## Cause
teacher/js/config.js loadDashboard() ran
  db.collection('sessions').orderBy('createdAt','desc').get()   // NO .limit()
so every teacher-dashboard load read ALL ~2,800 session docs. We reloaded the
dashboard many times today (testing the grammar->activity wiring), so
~30 loads x ~2,800 = ~85K reads. (Classroom onSnapshot listeners are bounded to
live games - not the hog. Student dashboards read their own data, bounded.)

## Fix (teacher/js/config.js + students.js, SW v23->v24)
- Keep the accurate lifetime "Total Sessions" via the cheap count() aggregation
  (~1 read per 1000 docs; SDK is 10.7.1 which supports it), wrapped in try/catch
  with a fallback to fetched length.
- Then sessionsQuery = sessionsQuery.limit(1000) — fetch only the most recent
  1000 docs (all the feed / popularity / recent-score analytics need). Per load:
  ~1000 reads + ~3 for the count, vs ~2,800 before. Even 30 reloads ~ 30K < 50K.
- students.js updateStats now shows window.totalSessionsCount (accurate) instead
  of allSessions.length.

## Verify
- node --check config.js + students.js OK. count()+limit+stat wiring present.

## Honest notes for the user
- The quota RESETS daily — the app works again tomorrow regardless.
- For ~400 students the free 50K/day is genuinely tight long-term. The real fix is
  the Blaze plan (pending university approval) — pay-as-you-go, removes the daily
  cap (typically pennies/month at this scale). This change reduces the risk meanwhile.
- Avoid hammer-reloading the teacher dashboard; each load still costs reads.

## Deploy
- firebase deploy --only hosting (SW -> v24).
