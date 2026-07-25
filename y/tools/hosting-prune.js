/* ============================================================
   HOSTING PRUNE - free Firebase Hosting storage quota
   ------------------------------------------------------------
   Firebase Hosting keeps a full snapshot of EVERY past deploy as a
   "version". There is no retention limit in the console for this
   project, so versions pile up (we hit 600+ = quota exceeded = the
   deploy-blocking HTTP 429). This prunes old FINALIZED versions,
   always keeping the LIVE version + the newest N (rollback safety).

   No secrets in this file: it mints an access token through the
   firebase CLI's own stored login (firebase-tools/lib/auth), so you
   must be logged in (`firebase login`) as a project editor/owner.

   Usage (from repo root):
     node y/tools/hosting-prune.js            # DRY RUN - just shows the plan
     DELETE=1 node y/tools/hosting-prune.js   # actually delete
     KEEP_RECENT=10 DELETE=1 node y/tools/hosting-prune.js

   The API throttles to ~1.4s per delete, so a big backlog can take
   several minutes; the script is safe to re-run - already-deleted
   versions are skipped, so just run it again if it is interrupted.
   ============================================================ */
'use strict';
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const SITE = process.env.SITE || 'empower-vocabulary-practice';
const KEEP_RECENT = parseInt(process.env.KEEP_RECENT || '5', 10);
const DELETE = process.env.DELETE === '1';

// Resolve firebase-tools from the global npm install (any machine).
function loadAuth() {
  const groot = execSync('npm root -g').toString().trim();
  return require(path.join(groot, 'firebase-tools', 'lib', 'auth'));
}

function api(token, method, apiPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firebasehosting.googleapis.com', path: apiPath, method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    }, res => {
      let b = ''; res.on('data', d => (b += d));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(b ? JSON.parse(b) : {});
        else reject(new Error('HTTP ' + res.statusCode + ' ' + method + ' ' + apiPath.split('?')[0] + ' :: ' + b.slice(0, 300)));
      });
    });
    req.on('error', reject); req.end();
  });
}

(async () => {
  const auth = loadAuth();
  const acct = auth.getGlobalDefaultAccount();
  if (!acct || !acct.tokens || !acct.tokens.refresh_token) throw new Error('Not logged in - run `firebase login` first');
  const scopes = ['email', 'openid', 'https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'];
  const tok = await auth.getAccessToken(acct.tokens.refresh_token, scopes);
  const token = tok.access_token;
  console.log('Signed in as: ' + (acct.user && acct.user.email) + '  |  site: ' + SITE);

  const rel = await api(token, 'GET', `/v1beta1/sites/${SITE}/releases?pageSize=1`);
  const liveName = rel.releases && rel.releases[0] && rel.releases[0].version && rel.releases[0].version.name;
  console.log('Live version: ' + (liveName || '(none)'));

  let versions = [], pageToken = '';
  do {
    const q = `/v1beta1/sites/${SITE}/versions?pageSize=100` + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const page = await api(token, 'GET', q);
    versions = versions.concat(page.versions || []);
    pageToken = page.nextPageToken || '';
  } while (pageToken);

  const byStatus = {};
  versions.forEach(v => { byStatus[v.status] = (byStatus[v.status] || 0) + 1; });
  console.log('Total versions: ' + versions.length + '  |  ' + JSON.stringify(byStatus));

  const finalized = versions.filter(v => v.status === 'FINALIZED' && v.name !== liveName)
    .sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  const del = finalized.slice(KEEP_RECENT);
  console.log('\nFinalized (non-live): ' + finalized.length + '  ->  keep newest ' + Math.min(KEEP_RECENT, finalized.length) + ', DELETE ' + del.length);

  if (!DELETE) { console.log('\n*** DRY RUN - nothing deleted. Re-run with DELETE=1 to execute.'); return; }
  if (!del.length) { console.log('\nNothing to delete.'); return; }

  console.log('\nDeleting ' + del.length + ' versions...');
  let ok = 0, fail = 0;
  for (const v of del) {
    try { await api(token, 'DELETE', '/v1beta1/' + v.name); ok++; if (ok % 10 === 0) console.log('  deleted ' + ok + '/' + del.length); }
    catch (e) { fail++; console.log('  FAIL ' + v.name.split('/versions/')[1] + ' :: ' + e.message.slice(0, 120)); }
  }
  console.log('\nDone. Deleted ' + ok + ', failed ' + fail + '. Live + newest ' + KEEP_RECENT + ' kept.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
