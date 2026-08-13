/* ============================================================
   TENANT - who is this copy of the app for?
   ------------------------------------------------------------
   ONE place for everything that is specific to a university.
   The rest of the app must never hard-code an institution again:
   it asks this file instead.

   HOW A TENANT IS CHOSEN
   The web address decides. Each university gets its own address,
   and its own Firebase project behind it, so nothing is shared.
   Any address that is not listed falls back to DEFAULT, which is
   FSMVU. That is deliberate: today every address is unlisted, so
   today every address gets exactly the values the code already
   had, and nothing changes.

   HOW TO ADD A UNIVERSITY
     1. add an entry to TENANTS below
     2. add its web address to HOSTS
   No other file changes.

   HOW TO READ A VALUE
       Tenant.get('adminEmail', 'fallback@example.com')
   ALWAYS pass the value the code used before as the fallback. If
   this file ever fails to load, the app then behaves exactly as it
   did previously instead of breaking. That rule is what makes this
   migration safe to do one value at a time.

   Load it BEFORE any script that reads it.
   ============================================================ */
(function () {
  'use strict';

  var TENANTS = {

    /* ---- Tenant 1: FSMVU. These are the values that were previously
            typed into the code. Do not change them without checking
            the live app. ---- */
    fsmvu: {
      id: 'fsmvu',
      name: 'Fatih Sultan Mehmet Vakif University',
      shortName: 'FSMVU',
      // The product name shown to students. Not the university name.
      appName: 'Lingualab',

      // Full rights in the app. Mirrored in firestore.rules and in
      // functions/index.js, which cannot read this file - see the
      // note at the bottom.
      adminEmail: 'akabiriaslifar@fsm.edu.tr',
      supportEmail: 'akabiriaslifar@fsm.edu.tr',

      // Sign-in domains are NOT listed here. They already live in the
      // database at settings/organizations, which is per-project and
      // editable without a deploy. This file must not duplicate them.

      /* WHICH CABINET THIS ADDRESS OPENS.
         This is the single most important setting in the file: it points
         the app at one university's Firebase project. It used to be
         copy-pasted into 27 separate files, which meant a second
         university would have needed 27 edits.
         The apiKey is NOT a secret - Firebase keys identify a project,
         they do not grant access. Access is controlled by the security
         rules and by login. It is safe in a public file. */
      firebase: {
        apiKey: 'AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU',
        authDomain: 'empower-vocabulary-practice.firebaseapp.com',
        projectId: 'empower-vocabulary-practice',
        storageBucket: 'empower-vocabulary-practice.firebasestorage.app',
        messagingSenderId: '136270199832',
        appId: '1:136270199832:web:174222066ef1cbdc8f576d',
        measurementId: 'G-1BBXBVEP5C'
      },

      logo: '/fsm-logo.png',
      seal: '/fsmvu-seal.png',

      // The CEFR levels this university teaches, in order.
      levels: ['A2', 'B1', 'B1+', 'B2', 'C1'],

      // Shown as the example when someone types a class code.
      classCodeExample: 'B125',

      // Printed on the course certificate.
      certificate: {
        departmentTr: 'YABANCI DILLER BOLUMU',
        departmentEn: 'FOREIGN LANGUAGES DEPARTMENT'
      }
    }

    /* ---- Tenant 2 goes here when the project exists. Copy the block
            above, change the values, add the address to HOSTS. ----
    ozyegin: {
      id: 'ozyegin',
      name: 'Ozyegin University',
      shortName: 'OzU',
      appName: 'Lingualab',
      adminEmail: '',
      supportEmail: '',
      logo: '/tenant/ozyegin/logo.png',
      seal: '/tenant/ozyegin/seal.png',
      levels: ['A2', 'B1', 'B1+', 'B2', 'C1'],
      classCodeExample: '',
      certificate: { departmentTr: '', departmentEn: '' }
    }
    */
  };

  /* CUSTOM addresses only. Firebase's own two free addresses are worked
     out automatically below, so a new university needs NO entry here
     until it has a real domain of its own.
       'lingualab.ozyegin.edu.tr': 'ozyegin'  */
  var HOSTS = {};

  // Local development only. Never a real university address.
  var LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', ''];
  var LOCAL_TENANT = 'fsmvu';

  /* THERE IS NO CATCH-ALL, ON PURPOSE.
     This used to end with "anything I do not recognise is FSMVU". With one
     university that was harmless. With two it is a data breach waiting to
     happen: put Ozyegin on an address nobody added to this file and their
     students would silently land in FSMVU's database.
     An unknown address now resolves to NOTHING. js/firebase-init.js then
     refuses to start Firebase and says why. Fail closed, never fail into
     someone else's data. */
  function resolve() {
    var host = '';
    try { host = String(window.location.hostname || '').toLowerCase(); } catch (_) {}

    // 1. A custom domain someone registered above.
    if (HOSTS[host] && TENANTS[HOSTS[host]]) return TENANTS[HOSTS[host]];

    // 2. Firebase hands every project two free addresses,
    //    <projectId>.web.app and <projectId>.firebaseapp.com. Derive them
    //    from each tenant's own projectId so a new university works the
    //    moment its project exists, with no edit here.
    for (var id in TENANTS) {
      if (!Object.prototype.hasOwnProperty.call(TENANTS, id)) continue;
      var pid = TENANTS[id].firebase && TENANTS[id].firebase.projectId;
      if (!pid) continue;
      if (host === pid + '.web.app' || host === pid + '.firebaseapp.com') return TENANTS[id];
    }

    // 3. A developer machine.
    if (LOCAL_HOSTS.indexOf(host) !== -1 && TENANTS[LOCAL_TENANT]) return TENANTS[LOCAL_TENANT];

    // 4. Unknown. Deliberately nothing.
    return null;
  }

  var current = resolve();

  if (!current) {
    console.error('tenant: this address (' + (window.location && window.location.hostname)
      + ') is not registered to a university. Add it to HOSTS in js/tenant.js. '
      + 'No database will be opened.');
  }

  window.Tenant = {
    id: current ? current.id : null,
    // True when the address is unrecognised. Data access must stay closed.
    unknownHost: !current,
    all: function () { return current; },

    /* Read one value. `fallback` is what the code used before this file
       existed, so a missing key can never change behaviour.
       Note the split: on an unknown address this still returns fallbacks,
       so LABELS and WORDING still render. It returns nothing for the
       Firebase config, which is what keeps the data side shut. */
    get: function (key, fallback) {
      if (!current) return fallback;
      var v = current[key];
      return (v === undefined || v === null || v === '') ? fallback : v;
    }
  };
})();
