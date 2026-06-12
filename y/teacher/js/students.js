/* Teacher Dashboard - Students Management */

// ── SHARED HELPER: _normCls ────────────────────────────────────
// students.js loads first in teacher-dashboard.html (line 1974),
// before modals.js / admin.js / teacher-assignments.js. The const
// declared here lives in the page's shared classic-script scope and
// is reused by every later teacher-side script. Do NOT redeclare it
// elsewhere — that's a SyntaxError that kills the whole dashboard.
const _normCls = (s) => String(s || '').trim().toUpperCase();

// ============================================
// STATS
// ============================================
function updateStats() {
  document.getElementById('totalStudents').textContent = allStudents.length;
  document.getElementById('totalSessions').textContent =
    (typeof window.totalSessionsCount === 'number' ? window.totalSessionsCount : allSessions.length);
  
  // Active today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeToday = new Set(
    allSessions
      .filter(s => s.createdAt?.toDate && s.createdAt.toDate() >= today)
      .map(s => s.userId)
  ).size;
  document.getElementById('activeToday').textContent = activeToday;
  
  // Average score
  if (allSessions.length > 0) {
    const avgScore = Math.round(
      allSessions.reduce((sum, s) => sum + (s.percentage || 0), 0) / allSessions.length
    );
    document.getElementById('avgScore').textContent = avgScore + '%';
  }
}

// ============================================
// STUDENTS TABLE
// ============================================
function renderStudentsTable() {
  const tbody = document.getElementById('studentsTableBody');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const bookFilter = document.getElementById('bookFilter')?.value || '';
  const levelFilter = document.getElementById('levelFilter').value;
  const classFilter = document.getElementById('classFilter').value;
  const moduleFilter = document.getElementById('moduleFilter').value;
  const yearFilter = document.getElementById('yearFilter').value;
  const skillFilter = (typeof getSkillFilter === 'function') ? getSkillFilter('students') : 'all';

  let filtered = allStudents;

  // Skill filter — keep only students with at least one session in the skill
  if (skillFilter && skillFilter !== 'all' && typeof filterStudentsBySkill === 'function') {
    filtered = filterStudentsBySkill(filtered, allSessions, skillFilter);
  }
  
  // (Removed redundant in-render filter that read `currentUser.assignedClasses`
  // — `currentUser` is the Firebase Auth user object which doesn't carry
  // that field. allStudents is already correctly filtered upstream in
  // config.js loadDashboard for non-admin teachers, so no second pass needed.)


  if (searchTerm) {
    filtered = filtered.filter(s => 
      s.name?.toLowerCase().includes(searchTerm) ||
      s.email?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (levelFilter) {
    filtered = filtered.filter(s => s.level === levelFilter);
  }
  
  if (classFilter) {
    const cf = _normCls(classFilter);
    filtered = filtered.filter(s => _normCls(s.studentClass) === cf);
  }
  
  if (moduleFilter) {
    filtered = filtered.filter(s => s.module === moduleFilter);
  }
  
  if (yearFilter) {
    filtered = filtered.filter(s => s.academicYear === yearFilter);
  }
  
  // Filter by book if selected
  if (bookFilter) {
    filtered = filtered.filter(s => {
      const studentSessions = allSessions.filter(sess => sess.userId === s.id);
      if (bookFilter === 'empower') {
        // Empower: sessions with book='empower' OR no book field (old sessions)
        return studentSessions.some(sess => sess.book === 'empower' || !sess.book);
      } else {
        // Gateway: only sessions explicitly marked as gateway
        return studentSessions.some(sess => sess.book === bookFilter);
      }
    });
  }
  
  if (filtered.length === 0) {
    // Friendlier message for teachers who haven't been assigned any
    // classes / year / module yet — they'd otherwise see an empty
    // table and think the page was broken.
    const noAssignments = !isAdmin()
      && typeof currentUserData !== 'undefined' && currentUserData
      && !(currentUserData.assignedClasses && currentUserData.assignedClasses.length > 0)
      && !currentUserData.assignedYear
      && !currentUserData.assignedModule;
    const emptyMsg = noAssignments
      ? `You haven't been assigned any classes yet.<br><span style="font-size:0.9em">Contact admin (akabiriaslifar@fsm.edu.tr) to get started.</span>`
      : 'No students found';
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; padding: 40px; color: var(--text-muted);">
          ${emptyMsg}
        </td>
      </tr>
    `;
    return;
  }
  
  // Relabel the Sessions / Words headers for the active skill filter so
  // teachers see the right column titles (the data was already filtered
  // correctly; this just makes the column meaning clear).
  const isExamSkill = (skillFilter === 'reading' || skillFilter === 'listening');
  const sessionsLabel = isExamSkill
    ? (skillFilter === 'reading' ? 'Reading Attempts' : 'Listening Attempts')
    : 'Sessions';
  const secondLabel = isExamSkill ? 'Best Score' : 'Words';
  const colSessionsEl = document.getElementById('colSessions');
  const colWordsEl    = document.getElementById('colWords');
  if (colSessionsEl) colSessionsEl.textContent = sessionsLabel;
  if (colWordsEl)    colWordsEl.textContent    = secondLabel;

  tbody.innerHTML = filtered.map(student => {
    // When the skill filter is active, restrict per-row stats (sessions
    // count, avg score, words learned) to ONLY the sessions in that
    // skill. Otherwise the user sees "Reading" filtered students but
    // still gets vocabulary totals, which is misleading.
    let studentSessions = allSessions.filter(s => s.userId === student.id);
    if (skillFilter && skillFilter !== 'all' && typeof filterSessionsBySkill === 'function') {
      studentSessions = filterSessionsBySkill(studentSessions, skillFilter);
    }
    const avgScore = studentSessions.length > 0
      ? Math.round(studentSessions.reduce((sum, s) => sum + (s.percentage || 0), 0) / studentSessions.length)
      : 0;

    // Second column value depends on the skill filter:
    //   - Vocabulary / All Skills → unique words learned (sum of wordsLearned arrays)
    //   - Reading / Listening     → best (max) percentage across attempts
    // Reading/listening sessions don't populate wordsLearned, so the
    // "Words Studied" number for those skills would always be 0 — which
    // is correct but reads as "broken" to a teacher. Best Score is the
    // more useful per-skill metric in those cases.
    let secondValue;
    if (isExamSkill) {
      secondValue = studentSessions.length > 0
        ? Math.max(...studentSessions.map(s => s.percentage || 0)) + '%'
        : '—';
    } else {
      const uniqueWords = new Set();
      studentSessions.forEach(s => {
        if (s.wordsLearned && Array.isArray(s.wordsLearned)) {
          s.wordsLearned.forEach(w => uniqueWords.add(w));
        }
      });
      secondValue = uniqueWords.size;
    }
    const totalWords = secondValue; // keep the legacy variable name for the template below
    
    // Determine which book(s) the student uses
    const booksUsed = new Set();
    studentSessions.forEach(s => {
      // Treat sessions without book field as Empower (old sessions)
      const book = s.book || 'empower';
      booksUsed.add(book);
    });
    let bookDisplay = '-';
    if (studentSessions.length === 0) {
      bookDisplay = '-';
    } else if (booksUsed.size === 1) {
      const book = [...booksUsed][0];
      bookDisplay = book === 'empower' ? '📘 Empower' : book === 'gateway' ? '📗 Gateway' : book;
    } else if (booksUsed.size > 1) {
      bookDisplay = '📚 Both';
    }
    
    const lastActive = student.lastLogin?.toDate ? student.lastLogin.toDate() : null;
    const lastActiveStr = lastActive 
      ? lastActive.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Never';
    
    const isActive = lastActive && (Date.now() - lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000;
    
    return `
      <tr>
        <td>
  <div class="student-name">${escapeHtml(student.name) || 'Unknown'}</div>
  <div class="student-email">${escapeHtml(student.email) || ''}</div>
        </td>
        <td>${escapeHtml(bookDisplay)}</td>
        <td>${escapeHtml(student.level) || '-'}</td>
        <td>${escapeHtml(student.studentClass) || '-'}</td>
        <td>${escapeHtml(student.module) || '-'}</td>
        <td>${escapeHtml(student.academicYear) || '-'}</td>
        <td>${studentSessions.length}</td>
        <td>${totalWords}</td>
        <td>
          <div class="progress-mini">
            <div class="fill" style="width: ${avgScore}%"></div>
          </div>
          <span style="font-size: 0.85em; color: var(--text-muted)">${avgScore}%</span>
        </td>
        <td>${lastActiveStr}</td>
        <td>
          <span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="action-btn-small btn-view" data-id="${student.id}" title="View full profile">👁️</button>
          <button class="action-btn-small btn-edit" data-id="${student.id}" data-name="${escapeHtml(student.name || '')}" data-level="${escapeHtml(student.level || '')}" data-class="${escapeHtml(student.studentClass || '')}" data-module="${escapeHtml(student.module || '')}" data-year="${escapeHtml(student.academicYear || '')}" title="Edit student">🖊️</button>
          ${(isAdmin() && isTeacherEligibleStudent(student)) ? `<button class="action-btn-small btn-promote" data-id="${student.id}" data-name="${escapeHtml(student.name || '')}" data-email="${escapeHtml(student.email || '')}" title="Promote to teacher">👑</button>` : ''}
          ${isAdmin() ? `<button class="action-btn-small btn-delete" data-id="${student.id}" data-name="${escapeHtml(student.name || student.email || '')}" title="Delete student">🗑️</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function filterStudents() {
  renderStudentsTable();
}

// Event delegation for student action buttons (safe from XSS)
document.addEventListener('click', (e) => {
  const editBtn    = e.target.closest('.btn-edit[data-id]');
  const promoteBtn = e.target.closest('.btn-promote[data-id]');
  const deleteBtn  = e.target.closest('.btn-delete[data-id]');
  if (editBtn) {
    openEditModal(editBtn.dataset.id, editBtn.dataset.name, editBtn.dataset.level, editBtn.dataset.class, editBtn.dataset.module, editBtn.dataset.year);
  }
  if (promoteBtn) {
    promoteStudentToTeacher(promoteBtn.dataset.id, promoteBtn.dataset.name, promoteBtn.dataset.email);
  }
  if (deleteBtn) {
    openDeleteModal(deleteBtn.dataset.id, deleteBtn.dataset.name);
  }
});

// ============================================
// Teacher-eligibility check.
// Mirrors firestore.rules `isTeacherEligibleEmail()`. Only @fsm.edu.tr
// (staff) addresses can ever be promoted. @stu.fsm.edu.tr is the student
// domain and is permanently locked to non-teacher roles by design.
// Demo / anonymous users have no email and are also ineligible.
// ============================================
function isTeacherEligibleStudent(student) {
  const email = (student && student.email ? String(student.email) : '').toLowerCase().trim();
  if (!email) return false;
  if (email.endsWith('@stu.fsm.edu.tr')) return false;
  return email.endsWith('@fsm.edu.tr');
}

// ============================================
// PROMOTE STUDENT → TEACHER (admin only)
// Mirrors the existing demote flow in admin.js: updates the user doc role
// AND keeps settings/teacherEmails in sync so the admin tab's whitelist
// view stays accurate. Firestore rules already restrict this to admin
// AND block promotion of @stu.fsm.edu.tr emails — this function adds a
// matching client-side gate so the UI fails fast with a clear message.
// ============================================
async function promoteStudentToTeacher(studentId, studentName, studentEmail) {
  if (!isAdmin()) return;

  // Defense-in-depth client check. The firestore rule is the real
  // enforcement; this just gives admin a clear error before round-tripping.
  if (!isTeacherEligibleStudent({ email: studentEmail })) {
    showError(
      'Not eligible for promotion',
      'Only @fsm.edu.tr (staff) emails can be promoted to teacher. ' +
      '@stu.fsm.edu.tr addresses are permanently locked to non-teacher roles by design.'
    );
    return;
  }

  const displayName = studentName || 'this student';
  // Show the EMAIL in the confirm as a safeguard — so the admin can verify
  // they're promoting the intended person, not the wrong row.
  const whoLine = studentEmail ? `${displayName} — ${studentEmail}` : displayName;
  showConfirm(
    '👑',
    'Promote to Teacher?',
    `Grant teacher privileges to ${whoLine}? They will be able to see all students, manage classroom sessions, and access the teacher dashboard. Their progress and account stay intact. You can demote them anytime from the Admin tab.`,
    'Yes, Promote',
    async () => {
      try {
        // 1. Add to whitelist (keeps the admin-tab record consistent;
        //    not strictly required for the promotion to work because
        //    the user doc is the source of truth, but it's tidy).
        if (studentEmail) {
          const docRef = db.collection('settings').doc('teacherEmails');
          const doc = await docRef.get();
          let whitelist = doc.exists ? (doc.data().teacherEmails || []) : [];
          const normalised = String(studentEmail).toLowerCase().trim();
          if (!whitelist.map(e => String(e).toLowerCase().trim()).includes(normalised)) {
            whitelist.push(normalised);
            await docRef.set({ teacherEmails: whitelist }, { merge: true });
          }
        }

        // 2. Flip the role on the user doc (admin-only per firestore.rules).
        await db.collection('users').doc(studentId).update({ role: 'teacher' });

        // 3. Optional activity log (safe if logger isn't loaded).
        if (typeof ActivityLogger !== 'undefined' && ActivityLogger.logTeacherAdded) {
          try { await ActivityLogger.logTeacherAdded({ teacherId: studentId, email: studentEmail }); } catch (_) {}
        }

        showSuccess('Promoted to Teacher',
          `${displayName} is now a teacher. They need to log out and log back in for the change to take effect.`);

        // 4. Refresh both lists. The promoted user disappears from
        //    Students and appears under Admin → Teachers.
        if (typeof loadDashboard === 'function') {
          await loadDashboard();
        } else if (typeof loadTeachers === 'function') {
          await loadTeachers();
        }
      } catch (e) {
        console.error('Error promoting student:', e);
        showError('Error', 'Failed to promote: ' + (e?.message || e));
      }
    }
  );
}
window.promoteStudentToTeacher = promoteStudentToTeacher;


// ============================================
// LEVEL DISTRIBUTION
// Populates the four level cards on the Overview tab.
//
// PREVIOUS BUG: this function looked up `#levelDistribution`, which
// doesn't exist in the HTML (only the .level-distribution class), so it
// silently returned and the cards stayed pinned at "0". Plus the cards'
// label says "sessions" but the old code was counting students. Now we
// count sessions per level (matching the label) and write directly to
// the four ID'd elements that actually exist.
// ============================================
function updateLevelDistribution() {
  // Map level → DOM id of the value cell
  const targets = {
    'A2':  'levelA2Count',
    'B1':  'levelB1Count',
    'B1+': 'levelB1PlusCount',
    'B2':  'levelB2Count'
  };

  // Tally sessions by level. Sessions outside the four canonical levels
  // (e.g. legacy data with missing or odd `level`) are ignored — we
  // don't want to silently inflate any bucket.
  const counts = { 'A2': 0, 'B1': 0, 'B1+': 0, 'B2': 0 };
  allSessions.forEach(s => {
    if (s && counts.hasOwnProperty(s.level)) {
      counts[s.level] += 1;
    }
  });

  Object.keys(targets).forEach(level => {
    const el = document.getElementById(targets[level]);
    if (el) el.textContent = String(counts[level]);
  });
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
