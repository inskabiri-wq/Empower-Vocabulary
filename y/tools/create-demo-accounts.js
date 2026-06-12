/* ============================================================
   create-demo-accounts.js
   Creates the three shared demo accounts (email + password) that
   admin distributes via DEMO-CREDENTIALS.pdf.

   Each account is a normal Firebase Auth user (NOT anonymous)
   with a pre-verified email, and a Firestore user doc whose
   role == 'demo'. The role triggers the same restrictions as
   anonymous demos used to: no session writes, no assignment
   completions, no classroom answers — enforced by firestore.rules.

   Run manually:

     cd E:\vocab-trainer\y
     npm install firebase-admin            # one-time
     node tools/create-demo-accounts.js

   Requires:
     tools/.serviceAccount.json — Firebase admin private key.
     Download via Console → Project settings → Service accounts.
     The .gitignore already excludes this file.

   Re-running is safe: existing accounts are skipped (no overwrite).
   To rotate passwords, edit DEMO_ACCOUNTS below and add a
   `rotate: true` flag, then re-run.
   ============================================================ */

const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '.serviceAccount.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
  });
} catch (err) {
  console.error('Could not load service account from', SERVICE_ACCOUNT_PATH);
  console.error('Setup: Firebase Console → Project settings → Service');
  console.error('accounts → Generate new private key. Save the JSON file');
  console.error('as the path above. DO NOT commit it.');
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// ============================================================
// EDIT THIS BLOCK to change the demo accounts you want to issue.
// Email domains MUST be @fsm.edu.tr or @stu.fsm.edu.tr to satisfy
// firestore.rules. @stu.fsm.edu.tr is recommended — those addresses
// are permanently locked from teacher promotion as an extra safety.
// ============================================================
const DEMO_ACCOUNTS = [
  {
    email:    'demo1@stu.fsm.edu.tr',
    password: 'EmpowerDemo2025!',
    name:     'Demo Account 1',
  },
  {
    email:    'demo2@stu.fsm.edu.tr',
    password: 'EmpowerDemo2025!',
    name:     'Demo Account 2',
  },
  {
    email:    'demo3@stu.fsm.edu.tr',
    password: 'EmpowerDemo2025!',
    name:     'Demo Account 3',
  },
];

async function upsertDemo(account) {
  const { email, password, name } = account;

  // 1. Auth user — create if absent, otherwise fetch.
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`  · Auth account already exists for ${email} (uid ${userRecord.uid})`);

    if (account.rotate) {
      await auth.updateUser(userRecord.uid, { password, emailVerified: true });
      console.log(`  · Password rotated for ${email}`);
    }
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,  // skip the email-verification flow for demos
    });
    console.log(`  · Created auth account for ${email} (uid ${userRecord.uid})`);
  }

  // 2. Firestore user doc — create if absent, otherwise leave intact.
  const ref = db.collection('users').doc(userRecord.uid);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  · Firestore user doc already present — leaving as-is`);
  } else {
    await ref.set({
      name,
      email,
      role: 'demo',              // ← the magic field that triggers all restrictions
      isDemo: true,
      level: 'A2',
      studentClass: 'DEMO',
      module: 'Module 1',
      academicYear: '2025-2026',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      stats: {
        totalSessions: 0,
        totalWordsStudied: 0,
        bestStreak: 0,
        currentStreak: 0,
        levelProgress: {
          A2:    { studied: 0, mastered: 0 },
          B1:    { studied: 0, mastered: 0 },
          'B1+': { studied: 0, mastered: 0 },
          B2:    { studied: 0, mastered: 0 }
        }
      }
    });
    console.log(`  · Created Firestore user doc with role:'demo'`);
  }

  return { ...account, uid: userRecord.uid };
}

async function main() {
  console.log('Creating / verifying demo accounts...');
  console.log('');

  const results = [];
  for (const account of DEMO_ACCOUNTS) {
    console.log(`▸ ${account.email}`);
    try {
      results.push(await upsertDemo(account));
    } catch (err) {
      console.error(`  ✖ Failed: ${err.message}`);
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────────');
  console.log('Demo credentials (share via DEMO-CREDENTIALS.pdf):');
  console.log('───────────────────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.email}`);
    console.log(`  Password: ${r.password}`);
    console.log('');
  }
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
