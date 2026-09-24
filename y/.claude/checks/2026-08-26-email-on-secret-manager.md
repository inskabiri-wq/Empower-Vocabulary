# 2026-08-26 - email moved onto Secret Manager before it was ever switched on

Before walking through the SendGrid setup, the code it depends on was changed,
because doing it the documented way would have meant doing it twice.

## Why

`functions/index.js` read the API key from `functions.config()`. That API is
**deprecated, and the Runtime Config service shuts down in March 2027** - after
which deploys relying on it fail. Setting the key up on it today would mean
migrating before the deadline.

The installed `firebase-functions` is **^6.1.0**, which has
`firebase-functions/params`, so the modern route was available all along.

## What changed

```js
const { defineSecret, defineString } = require('firebase-functions/params');
const SENDGRID_KEY = defineSecret('SENDGRID_KEY');
const SENDER_EMAIL = defineString('SENDER_EMAIL', { default: 'noreply@fsm.edu.tr' });
const SENDER_NAME  = defineString('SENDER_NAME',  { default: 'Lingualab' });
```

- the scheduled job declares `secrets: [SENDGRID_KEY]` in its `runWith`, so the
  value is injected only into that function rather than sitting in a config
  blob every function can read
- the key is read secret-first, with the old `config()` lookup kept as a
  fallback so an existing deployment cannot break the moment this ships
- `functions.config()` is now wrapped in try/catch, because it throws rather
  than returning empty once Runtime Config is gone
- the setup notes at the top of the file were rewritten to match, including the
  sender-verification step that actually blocks people

## Verified

- `node --check functions/index.js` - passes
- **the bundle loads** with the params API: `require('./index.js')` succeeds
- **all six functions still export**: sendWritingReminders, rosterImport,
  createDemoAccount, listDemoAccounts, deleteDemoAccount, analyzeWriting
- em-dash scan - clean
- `functions/index.js` was copied to the scratchpad before editing

Nothing was deployed. No key was set, requested, or handled here - the CLI
prompts for it locally and it never touches the repo.

## Behaviour if the key is missing

Unchanged and safe: the job logs `sendgrid.key not configured - skipping
reminder pass` and returns. Deploying before setting the secret does nothing
harmful.
