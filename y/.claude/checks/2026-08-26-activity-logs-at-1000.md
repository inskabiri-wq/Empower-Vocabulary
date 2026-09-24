# 2026-08-26 - does the Activity Logs tab hold up at 1000 students?

The tab in question was the **admin Activity Logs**, not Recent Activity - a
different component nothing had been measured against. Asked directly whether it
works at 1000. It did not. It does now.

## What was wrong: three stat tiles that downloaded the whole log

The list itself is fine - `loadLogs()` is properly paginated, 50 at a time with
a `startAfter` cursor, so collection size does not touch it. And all **15**
filter combinations have composite indexes declared, so no filter fails in
production.

The three counters above it were the problem:

```js
const todaySnap = await db.collection('activityLogs').where('timestamp','>=',today).get();
document.getElementById('activityStatToday').textContent = todaySnap.size;
```

Three of those - today, 7 days, 30 days - each a `.get()` that **downloads every
matching document in order to read `.size`**. For one teacher that is invisible.

At 1000 students logging roughly five events a day, opening the tab fetched
about **5,000 + 35,000 + 150,000 = 190,000 documents**, every time. That is
~190,000 billed reads and ~190,000 documents pushed into the browser for three
numbers.

## Measured on the emulator, 6,000 logs (about one day at this size)

| | documents | into the browser | time |
| --- | --- | --- | --- |
| before, unbounded `.get()` | **6,000** | 1,053 KB | 2,243 ms |
| after, capped | **2,000** | 351 KB | **665 ms** |

**3.4x faster at one day's volume**, and the gap widens with the window: the
30-day tile at 1000 students goes from roughly 150,000 documents to 2,000, a
**75x** reduction.

## The finding that changed the fix

The obvious answer is `count()`, the aggregation that returns a number without
downloading rows. I wrote it that way, then tested it:

```
countAvailableOnCompat: false     (SDK 10.7.1)
```

**`count()` is a modular-SDK API (`getCountFromServer`). The COMPAT build this
app uses does not expose `query.count()` at any version.** My first measurement
was also on the wrong SDK (9.22, pulled in by another harness) which sent me
looking in the right place for the wrong reason.

So the shipped code attempts `count()` - free, and starts working the day the
app moves to the modular SDK - and otherwise falls back to a **capped** read
that displays `2000+` rather than a wrong exact number.

### The same discovery applies to code already in the tree

`teacher/js/config.js` has called `sessionsQuery.count().get()` since before
today, inside a try/catch, with a comment claiming it "keeps the lifetime Total
Sessions accurate via the cheap count() aggregation".

**It has never once succeeded.** It throws straight into the catch every time,
so `window.totalSessionsCount` has always been null and the Total Sessions tile
has been showing the fetched length - capped at 1000 - presented as a lifetime
total.

Fixed the claim rather than pretending: the comment now records what actually
happens, and the tile reads **"1000+"** when the fetch hit its cap. A flat 1000
looked like a real figure and was not.

## Also fixed: the log was mostly logging itself

`ActivityLogger.log(ACTIVITY_LOG_VIEWED)` fired on every `init()`, so the audit
trail filled with rows saying somebody had looked at the audit trail - eight in
a row in the screenshot. Now once per browser session, guarded so a privacy mode
that blocks `sessionStorage` skips the note instead of breaking the page.

## Still open, and worth a decision

**`retentionDays: 0` means keep forever.** At 1000 students and ~5 events a day
that is about **1.8 million documents a year**. Nothing prunes it.

The paginated list and the capped tiles both stay fast regardless, so this is
not urgent - it is storage cost and an audit trail nobody can read past page 40.
Options when you want it: a retention window (say 180 days) enforced by a
scheduled function, or export-then-delete. Not started.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: twelve, all PASS
- bump: activity-admin.js v5, config.js v8, students.js v2,
  CACHE_VERSION -> **v365**; `--check` OK
