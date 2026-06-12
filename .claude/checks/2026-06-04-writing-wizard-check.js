/* Verification for the writing-assignment tabbed wizard + button rules.
   Run: node .claude/checks/2026-06-04-writing-wizard-check.js  (from repo root) */
const fs = require('fs');
const html = fs.readFileSync('y/teacher-dashboard.html', 'utf8');
const js   = fs.readFileSync('y/assignments/js/writing-form.js', 'utf8');
const count = (s, re) => (s.match(re) || []).length;
const rows = [];

// --- structure ---
const dO = count(html, /<div\b/g), dC = count(html, /<\/div>/g);
rows.push(['div open/close', `${dO}/${dC}`, dO === dC ? 'BALANCED' : 'UNBALANCED!!']);
rows.push(['panes (data-wpane)', count(html, /data-wpane=/g), '(expect 4)']);
rows.push(['tab buttons (.wtab)', count(html, /class="wtab\b/g), '(expect 4)']);

// --- footer buttons ---
['writingBackBtn', 'writingNextBtn', 'writingSaveBtn'].forEach(id =>
  rows.push([`#${id}`, count(html, new RegExp(`id="${id}"`, 'g')), '(expect 1)']));

// --- every field id the save/reset/prefill path reads must still exist ---
const fieldIds = ['writingAssignmentId','writingTitle','writingPrompt','writingQuestionType',
  'writingLevel','writingRubricType','writingTimeLimit','writingTargetWords','writingMinWords',
  'writingRubric','writingRubricUrl','writingAutoSubmit','writingAiCorrection','writingTargetType',
  'writingTargetClass','writingTargetLevel','writingTargetModule','writingTargetStudentsList','writingDeadline'];
const missing = fieldIds.filter(id => !new RegExp(`id="${id}"`).test(html));
rows.push(['missing field IDs', missing.length ? missing.join(',') : 'NONE', missing.length ? 'FAIL' : 'ok']);

// --- COMING SOON tile gone from settings pane; aiCorrection kept as hidden input ---
const settingsPane = html.slice(html.indexOf('data-wpane="settings"'), html.indexOf('data-wpane="targeting"'));
rows.push(['COMING SOON in settings pane', /COMING SOON/.test(settingsPane) ? 'STILL THERE' : 'gone']);
rows.push(['writingAiCorrection is hidden input', /id="writingAiCorrection"[^>]*hidden/.test(html) ? 'yes' : 'NO!!']);

// --- no em/en dashes ---
rows.push(['em/en dashes in html', count(html, /[–—]/g), '(expect 0)']);

// --- JS: wizard exports present, save path intact ---
['window.switchWritingTab','window.nextWritingTab','window.prevWritingTab','WRITING_TABS',
 'function saveWritingAssignment'].forEach(k =>
  rows.push([`js: ${k}`, js.includes(k) ? 'present' : 'MISSING!!']));
rows.push(['js: save reads writingAiCorrection (x times)', count(js, /writingAiCorrection/g), '(expect 3)']);

let fail = false;
for (const r of rows) {
  const line = r.join('  ::  ');
  if (/UNBALANCED|FAIL|MISSING|STILL THERE|NO!!/.test(line)) fail = true;
  console.log(line);
}
console.log('\n==> ' + (fail ? 'PROBLEM DETECTED' : 'ALL CHECKS PASS'));
process.exit(fail ? 1 : 0);
