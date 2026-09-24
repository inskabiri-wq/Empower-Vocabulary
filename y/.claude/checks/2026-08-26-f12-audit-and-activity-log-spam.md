# 2026-08-26 - what F12 really exposes, and why that row still will not open

## 1. Seeing the code in F12 is not a breach

Every website ships its HTML, CSS and JavaScript to the browser - that is how
the browser runs it. F12 shows what was sent. There is no way to prevent it,
for any site, and obfuscation only makes it harder to read, never private.

What matters is that **nothing secret is in there**, and that security is
enforced on the SERVER, not in the code the browser holds. That is exactly what
the Firestore rules do: a user can read the code that asks for data and still be
refused the data.

### The audit, run rather than asserted

| checked | result |
| --- | --- |
| service-account key in the deployed folder | **not deployed** - `tools/**` is in the hosting ignore list |
| the key reachable on the live site | **HTTP 404** |
| any tools script reachable live | **HTTP 404** |
| private keys / client secrets in shipped JS or HTML | none |
| the key committed to git | **not tracked**, and matched by `.gitignore:76` |

**The Firebase `apiKey` IS visible, and that is correct.** It identifies the
project; it does not authorise anything. Google publishes it in their own
documentation examples. Anyone can read it and still be refused every document
by the rules.

Two things that are visible and worth being aware of, neither a vulnerability:

- **The admin email** is hardcoded in several files as the owner check. It is
  already a public university address, and knowing it grants nothing - the
  check is `request.auth.token.email`, which cannot be faked client-side.
- **Table and field names** are visible. This is normal, and the reason the
  rules exist.

### The one real risk, and it is on your machine, not the site

`y/tools/.serviceAccount.json.json` exists on disk. That file **is** full admin
access to the Firebase project - it bypasses every rule. It is correctly kept
out of both the deploy and git, so it has not leaked. Worth knowing it is there,
and worth never attaching it to anything.

(Its name has a doubled extension, so the backfill scripts that look for
`.serviceAccount.json` would not find it anyway.)

## 2. Why the pronunciation row still does not open

It is not a bug, and the code is not stale - the live site is already serving
`activity.js?v=9` and `CACHE_VERSION v362`, which is this work.

That row is a session from **two days ago**. Pronunciation only started
recording per-question detail **today**, and only when the student uses the
microphone. So:

- it has no `pronDetails`, because nothing captured any
- it carries `vocabDetails: []`, which the old writer attached to every session
- **that empty array is why it used to say "tap for items" and open onto
  nothing**

The fix made it honest: with no items, it no longer offers to expand. That row
will never be expandable, because the data was never recorded. A pronunciation
session where a student presses the microphone will be.

### Proven by running the real feed

New gate, `tools/recent-activity-runtime-check.js`, EXECUTES
`loadRecentActivity()` - 8 cases, all passing:

| case | rows | tap offered |
| --- | --- | --- |
| a mixed feed of four sessions | 4 | 2 |
| pronunciation WITH a spoken attempt | 1 | **1** |
| pronunciation with only an empty `vocabDetails` | 1 | **0** |
| the writing exam under Writing | 1 | 0 |
| the writing exam no longer under Vocabulary | 1 | 0 |
| grammar filter finds grammar practice | 1 | 1 |
| an empty feed | 0 | empty state, no crash |
| a session with no detail fields | 1 | 0 |

This is the second runtime gate today. Both exist because `node --check` cannot
catch a ReferenceError, and this dashboard turns any thrown error into "Access
Denied".

## 3. The Activity Log was mostly logging itself

Eight identical **"Activity Log Viewed - Admin Actions"** rows in the
screenshot, burying the real events.

`activity-tracker/js/activity-admin.js` called
`ActivityLogger.log(ACTIVITY_LOG_VIEWED)` on every `init()` - every time the tab
was opened. An audit trail whose most common entry is "somebody looked at the
audit trail" is worse than none.

Now **once per browser session**, guarded so a privacy mode that blocks
`sessionStorage` skips the note rather than breaking the page.

The rows already written stay; they will simply stop multiplying.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: **eleven**, all PASS (recent-activity-runtime-check is new)
- bump: activity-admin.js v4, CACHE_VERSION -> **v363**; `--check` OK

## Still pending from earlier

The **rules deploy** for the Courses/Placement access fix. Hosting is current;
`firestore.rules` is not, so until it goes out any teacher can still write those
two settings documents.
