# Adding a second university - the complete playbook

Written 2026-08-14, after building and then retiring the Ozyegin tenant.
Everything here is proven: it was done once, end to end, on a real project.

The **code changes are permanent and still in place**. Only the Ozyegin
*tenant entry* and its Firebase project were removed. Adding university two is
now mostly steps 1 and 2 of this document.

---

## What already exists (do NOT rebuild)

| File | What it does |
|---|---|
| `y/js/tenant.js` | Every per-university setting. Picks the university from the web address. |
| `y/js/firebase-init.js` | Starts Firebase from whichever project `tenant.js` selected. |
| `.firebaserc` | Project aliases so you can `firebase use <name>`. |

All 27 files that used to hard-code the Firebase project were converted. The
config now lives in exactly one place, `tenant.js`. Do not put a project id in
a page again.

### The two rules that make this safe

1. **Fail closed, never guess.** An address that is not registered opens NO
   database and says so. `firebase-init.js` refuses rather than defaulting.
   The one time a fallback was added there it was a latent data breach: a
   university whose page failed to load `tenant.js` would have silently
   connected to FSMVU.
2. **Name the difference, do not check the id.** Use
   `Tenant.feature('someName', default)`, never `if (Tenant.id === 'x')`.
   Id checks work for two universities and rot at ten.

---

## Step 1 - Create the Firebase project (console, ~15 min)

1. **Create project.** Turn Google Analytics **off** (the app does not use it,
   and it is one less service touching student data).
2. **Add a Web app** (`</>`). Do not tick Hosting. Copy the config block.
3. **Authentication** -> enable Email/Password only.
4. **Firestore** -> **Standard edition**, **Production mode**, database ID
   `(default)`. Location cannot be changed later; Ozyegin used
   `europe-west3`. Write down the choice.
5. **Blaze plan** + a budget alert (~$50). Cloud Functions do not run on the
   free plan, and both demo-account creation and Writing AI are functions.
6. **Hosting** -> Get started, then **close the wizard**. Do not run
   `firebase init`: it overwrites `firebase.json` and destroys the security
   headers and the deploy ignore list.

The free address is `<project-id>.web.app` and exists as soon as Hosting is on.

## Step 2 - Register the tenant in code

Add a block to `TENANTS` in `y/js/tenant.js`. Copy the FSMVU block and change:

```
id, name, shortName, appName
adminEmail, supportEmail        <- who runs THEIR copy
logo, seal                      <- leave '' until you have their files
levels, classCodeExample
certificate.departmentTr / En
firebase: { ...their config block... }
features: { ... }               <- see below
```

Add an alias to `.firebaserc`:

```json
"projects": { "default": "empower-vocabulary-practice",
              "fsmvu":   "empower-vocabulary-practice",
              "newuni":  "<their-project-id>" }
```

**No HOSTS entry is needed.** `tenant.js` derives `<projectId>.web.app` and
`<projectId>.firebaseapp.com` automatically. Only a custom domain
(`lingualab.theiruni.edu.tr`) needs adding to `HOSTS`.

## Step 3 - Deploy to them

```bash
firebase use newuni
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
firebase use fsmvu          # ALWAYS switch back
```

Then, in the Firebase console for the new project, add the site's domain to
**Authentication -> Settings -> Authorized domains**, or every login fails.

If you want Writing AI there, set its own Gemini key:

```bash
firebase functions:secrets:set GEMINI_KEY --project <their-project-id>
firebase deploy --only functions --project <their-project-id>
```

Secrets, rules and indexes never copy between projects.

## Step 4 - First login and admin access

Their user list is empty. Nothing is seeded.

1. Go to their site and **Register** with the operator address
   (`akabiriaslifar@fsm.edu.tr`). It is the only address allowed until their
   own domains are configured - see "Who can sign in" below.
2. Verify by email, then sign in.
3. Registration always creates `role: 'student'` (the rules enforce this).
   The teacher dashboard requires `role: 'teacher'` and has **no admin
   exception**, so you will be locked out of it.
   **Fix:** Firebase console -> Firestore -> `users` -> your doc -> set
   `role` to `teacher`. Console writes bypass the security rules.
   (Better long-term fix: add `&& !isAdmin()` to the role check in
   `y/teacher/js/config.js` around line 104. Not done yet.)

## Step 5 - Who can sign in

Controlled by `settings/organizations` in **their** database. No deploy needed.

```
activeDomains:          ['theiruni.edu.tr']    who may sign in
teacherEligibleDomains: ['theiruni.edu.tr']    who may be made a teacher
allowedEmails:          ['head@theiruni.edu.tr']   named individuals
```

**With no such document, only the operator can sign in.** That is the correct
and deliberate default for a fresh project - do not "fix" it by creating an
empty document.

The old hardcoded `@fsm.edu.tr` grandfather was removed from `firestore.rules`
on 2026-08-12 precisely so FSM users cannot sign in to another university.
FSMVU keeps working from its own `settings/organizations`, which lists exactly
the same two domains. Verified against the live document before removal, and
covered by emulator tests (11 passing) written at
`scratchpad/rulestest/test.js` at the time.

## Step 6 - Make things differ per university

In order of preference:

1. **A switch in their database.** `settings/featureToggles` already covers
   whole skills, vocabulary game modes and classroom games. No code, no
   deploy, admin-editable.
2. **A value in `tenant.js`.** Name, logo, levels, certificate wording.
3. **A named capability.** `Tenant.feature('hideInactiveTiles', false)` for
   behaviour that differs. Default must always be FSMVU's current behaviour so
   existing users see no change.

Never `if (Tenant.id === '...')`.

---

## What is NOT solved yet

- **Branding is not wired.** Pages still reference `fsm-logo.png` directly.
  `tenant.js` has `logo` / `seal` fields but nothing reads them. Wiring this
  is required before a real customer launch.
- **Content is in code, not the database.** Grammar units, reading and
  listening exams ship to every university. Fine for two, wrong for many. This
  is the biggest remaining architectural item.
- **`ADMIN_EMAIL` is hardcoded** in `functions/index.js` (line ~207) and in
  `firestore.rules` (line ~14). Both still say
  `akabiriaslifar@fsm.edu.tr`, so the operator administers every tenant.
  Acceptable while you run them all; must change before handing a university
  its own administrator.
- **Teacher dashboard has no admin bypass** (see step 4).

## Traps that cost real time

- A Firebase **project id can never be renamed**, and the hosting URL is built
  from it. Choose it carefully; that is why the Ozyegin project could not be
  reused for a different university.
- `**/.*` in `firebase.json` does **not** exclude files inside a dot-folder.
  `y/.claude` and `y/.tmp` were being published. Fixed with `**/.*/**`.
- `firebase use` before every deploy. Deploying hosting to the wrong project
  is recoverable; deploying **rules** to the wrong project is not, because it
  changes who can read data.
- The rules use `.data.get('field', [])`, not `.data.field`. A missing field
  with the latter throws and denies everyone.
