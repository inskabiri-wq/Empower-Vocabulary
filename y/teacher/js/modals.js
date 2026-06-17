/* Teacher Dashboard - Modals & Messages */

// `_normCls` is declared once in teacher/js/students.js (loads first
// in teacher-dashboard.html). All teacher-side scripts share the same
// top-level classic-script scope, so we just USE it here.

// ============================================
// CONFIRM MODAL SYSTEM
// ============================================
function showConfirm(icon, title, message, buttonText, callback) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmContent').textContent = message;
  document.getElementById('confirmActionBtn').textContent = buttonText;
  confirmCallback = callback;
  document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
  confirmCallback = null;
}

function executeConfirm() {
  if (confirmCallback) {
    confirmCallback();
  }
  closeConfirmModal();
}

// ============================================
// EDIT STUDENT MODAL
// ============================================
function openEditModal(studentId, name, level, studentClass, module, academicYear) {
  document.getElementById('editStudentId').value = studentId;
  document.getElementById('editStudentName').textContent = `Editing: ${name}`;
  
  // Set level
  document.getElementById('editLevel').value = level || 'A2';
  
  // Set class (split into letter and number)
  if (studentClass && studentClass.length >= 2) {
    document.getElementById('editClassLetter').value = studentClass.charAt(0);
    document.getElementById('editClassNumber').value = studentClass.substring(1);
  } else {
    document.getElementById('editClassLetter').value = 'B';
    document.getElementById('editClassNumber').value = '';
  }
  
  // Set module and year
  document.getElementById('editModule').value = module || 'Module 1';
  document.getElementById('editYear').value = academicYear || '2025-2026';
  
  document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

async function saveStudentEdit() {
  const studentId = document.getElementById('editStudentId').value;
  const level = document.getElementById('editLevel').value;
  const classLetter = document.getElementById('editClassLetter').value;
  const classNumber = document.getElementById('editClassNumber').value;
  const module = document.getElementById('editModule').value;
  const academicYear = document.getElementById('editYear').value;
  
  if (!classNumber || classNumber < 100 || classNumber > 999) {
    showError('Invalid Class Number', 'Please enter a valid class number between 100 and 999.');
    return;
  }
  
  // Normalize on write — guarantees the user doc stores the canonical
  // form (uppercase, trimmed) so it always matches assignment.targetClass.
  const studentClass = _normCls(classLetter + classNumber);

  try {
    await db.collection('users').doc(studentId).update({
      level: level,
      studentClass: studentClass,
      module: module,
      academicYear: academicYear
    });
    
    // Log activity
    if (typeof ActivityLogger !== 'undefined') {
      await ActivityLogger.logStudentEdited({
        studentId: studentId,
        changes: { level, studentClass, module, academicYear }
      });
    }
    
    closeEditModal();
    showSuccess('Student Updated', 'The student information has been updated successfully.');
    
    // Refresh the dashboard
    await loadDashboard();
    
  } catch (error) {
    console.error('Error updating student:', error);
    showError('Update Failed', 'Failed to update student: ' + error.message);
  }
}

// ============================================
// DELETE STUDENT MODAL
// ============================================
function openDeleteModal(studentId, name) {
  document.getElementById('deleteStudentId').value = studentId;
  document.getElementById('deleteStudentName').textContent = name;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
}

async function confirmDeleteStudent() {
  if (!isAdmin()) {
    closeDeleteModal();
    showError('Permission Denied', 'Only administrators can delete students.');
    return;
  }
  
  const studentId = document.getElementById('deleteStudentId').value;
  
  try {
    // Delete all sessions for this student
    const sessionsSnap = await db.collection('sessions')
      .where('userId', '==', studentId)
      .get();
    
    const batch = db.batch();
    sessionsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete the student document
    batch.delete(db.collection('users').doc(studentId));
    
    await batch.commit();
    
    // Log activity
    if (typeof ActivityLogger !== 'undefined') {
      const studentName = document.getElementById('deleteStudentName').textContent;
      await ActivityLogger.logStudentDeleted({
        studentId: studentId,
        studentName: studentName,
        sessionsDeleted: sessionsSnap.size
      });
    }
    
    closeDeleteModal();
    showSuccess('Student Deleted', 'The student and all their session data have been removed.');
    
    // Refresh the dashboard
    await loadDashboard();
    
  } catch (error) {
    console.error('Error deleting student:', error);
    closeDeleteModal();
    showError('Delete Failed', 'Failed to delete student: ' + error.message);
  }
}

// ============================================
// MORE MENU
// ============================================
function toggleMoreMenu() {
  document.getElementById('moreMenuDropdown').classList.toggle('open');
}

function closeMoreMenu() {
  document.getElementById('moreMenuDropdown').classList.remove('open');
}

// Close more menu when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.more-menu-wrap');
  if (wrap && !wrap.contains(e.target)) closeMoreMenu();
});

// LOGOUT MODAL
// ============================================
function openLogoutModal() {
  document.getElementById('logoutModal').classList.add('active');
}

function closeLogoutModal() {
  document.getElementById('logoutModal').classList.remove('active');
}

async function confirmLogout() {
  // Log logout activity before signing out
  if (typeof ActivityLogger !== 'undefined') {
    await ActivityLogger.logLogout();
  }
  
  await auth.signOut();
  window.location.href = 'index.html';
}

// ============================================
// MESSAGE MODAL SYSTEM
// ============================================
function showMessage(title, content, type = 'info') {
  const modal = document.getElementById('messageModal');
  const icon = document.getElementById('messageIcon');
  const titleEl = document.getElementById('messageTitle');
  const contentEl = document.getElementById('messageContent');
  const btn = document.getElementById('messageBtn');
  
  const icons = {
    'info': 'ℹ️',
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'permission': '🔒'
  };
  
  const btnColors = {
    'info': 'modal-btn-save',
    'success': 'modal-btn-save',
    'error': 'modal-btn-delete',
    'warning': 'modal-btn-delete',
    'permission': 'modal-btn-delete'
  };
  
  icon.textContent = icons[type] || icons['info'];
  titleEl.textContent = title;
  contentEl.innerHTML = content;
  
  btn.className = 'modal-btn ' + (btnColors[type] || 'modal-btn-save');
  btn.textContent = type === 'error' || type === 'permission' ? 'Understood' : 'OK';
  
  modal.classList.add('active');
}

function closeMessageModal() {
  document.getElementById('messageModal').classList.remove('active');
}

function showPermissionError(email) {
  showMessage(
    '🔒 Insufficient Permission',
    `<strong>Your Account:</strong> ${escapeHtml(email)}<br><br>
     <strong>Issue:</strong> You don't have permission to access this resource.<br><br>
     <strong>Solution:</strong> Contact your administrator (akabiriaslifar@fsm.edu.tr) to grant you access.<br><br>
     <small>Make sure you're logged in with the correct FSM account.</small>`,
    'permission'
  );
}

function showError(title, message) {
  showMessage(title, message, 'error');
}

function showSuccess(title, message) {
  showMessage(title, message, 'success');
}

// ============================================
// EXPORT TO CSV
// ============================================
function exportToCSV() {
  // Get current filter values
  const levelFilter = document.getElementById('levelFilter').value;
  const classFilter = document.getElementById('classFilter').value;
  const moduleFilter = document.getElementById('moduleFilter').value;
  const yearFilter = document.getElementById('yearFilter').value;
  
  // Apply filters
  let filtered = allStudents;
  if (levelFilter) filtered = filtered.filter(s => s.level === levelFilter);
  if (classFilter) {
    const cf = _normCls(classFilter);
    filtered = filtered.filter(s => _normCls(s.studentClass) === cf);
  }
  if (moduleFilter) filtered = filtered.filter(s => s.module === moduleFilter);
  if (yearFilter) filtered = filtered.filter(s => s.academicYear === yearFilter);
  
  const headers = [
    'Name', 
    'Email', 
    'Level', 
    'Class', 
    'Module', 
    'Academic Year',
    'Total Sessions',
    'Total Words Practiced',
    'Average Score (%)',
    // Per-skill breakdown so grammar (and every other skill) shows up, not just
    // the lumped totals. Two columns per skill: session count + average score.
    'Vocabulary Sessions', 'Vocabulary Avg (%)',
    'Reading Sessions', 'Reading Avg (%)',
    'Listening Sessions', 'Listening Avg (%)',
    'Writing Sessions', 'Writing Avg (%)',
    'Grammar Sessions', 'Grammar Avg (%)',
    'Speaking Sessions', 'Speaking Avg (%)',
    'Last Active',
    'Status',
    'Days Since Last Activity'
  ];
  
  const rows = filtered.map(s => {
    const studentSessions = allSessions.filter(sess => sess.userId === s.id);
    const totalSessions = studentSessions.length;
    
    // Count unique words
    const uniqueWords = new Set();
    studentSessions.forEach(sess => {
      if (sess.wordsLearned && Array.isArray(sess.wordsLearned)) {
        sess.wordsLearned.forEach(w => uniqueWords.add(w));
      }
    });
    const totalWords = uniqueWords.size;
    
    const avgScore = totalSessions > 0
      ? Math.round(studentSessions.reduce((sum, sess) => sum + (sess.percentage || 0), 0) / totalSessions)
      : 0;

    // Per-skill rollup (sessions + average), so grammar / reading / listening /
    // writing / speaking each appear. Buckets via the shared activityToSkill map.
    const SKILLS = ['vocabulary', 'reading', 'listening', 'writing', 'grammar', 'speaking'];
    const bySkill = {};
    SKILLS.forEach(k => { bySkill[k] = { n: 0, sum: 0 }; });
    studentSessions.forEach(sess => {
      const sk = (typeof activityToSkill === 'function') ? activityToSkill(sess.activity) : 'vocabulary';
      if (!bySkill[sk]) bySkill[sk] = { n: 0, sum: 0 };
      bySkill[sk].n++;
      bySkill[sk].sum += (sess.percentage || 0);
    });
    const skillCells = [];
    SKILLS.forEach(k => {
      const b = bySkill[k];
      skillCells.push(b.n);                                 // <Skill> Sessions
      skillCells.push(b.n ? Math.round(b.sum / b.n) : '');  // <Skill> Avg (%)
    });

    const lastLogin = s.lastLogin?.toDate ? s.lastLogin.toDate() : null;
    const lastActiveStr = lastLogin 
      ? lastLogin.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Never';
    
    const daysSinceActive = lastLogin 
      ? Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
      : 'N/A';
    
    const isActive = lastLogin && (Date.now() - lastLogin.getTime()) < 7 * 24 * 60 * 60 * 1000;
    
    return [
      s.name || '',
      s.email || '',
      s.level || '',
      s.studentClass || '',
      s.module || '',
      s.academicYear || '',
      totalSessions,
      totalWords,
      avgScore,
      ...skillCells,
      lastActiveStr,
      isActive ? 'Active' : 'Inactive',
      daysSinceActive
    ];
  });
  
  // Create filename with filters
  let filename = 'students_report';
  if (levelFilter) filename += `_${levelFilter}`;
  if (classFilter) filename += `_${classFilter}`;
  if (moduleFilter) filename += `_${moduleFilter.replace(' ', '')}`;
  if (yearFilter) filename += `_${yearFilter}`;
  filename += `_${new Date().toISOString().split('T')[0]}.csv`;
  
  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Log activity
  if (typeof ActivityLogger !== 'undefined') {
    ActivityLogger.logReportExported({
      format: 'csv',
      recordCount: filtered.length,
      filters: { levelFilter, classFilter, moduleFilter, yearFilter }
    });
  }
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
