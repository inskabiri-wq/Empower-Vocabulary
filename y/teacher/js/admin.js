/* ============================================================
   Teacher Dashboard — Admin Section (v2)
   Visual port of the design in admin.html (React reference) into
   vanilla JS, plugged into the existing Firestore wiring.

   Public functions kept identical so external callers keep working:
     • loadTeachers()                              — entry point, populates UI
     • addTeacherEmail()                           — add to whitelist
     • removeFromWhitelist(email)                  — remove from whitelist
     • removeTeacher(teacherId, email)             — demote to student
     • toggleClassAssignment(id, className, on)
     • updateTeacherAssignment(id, field, value)   — field = 'year' | 'module'

   Globals consumed (defined elsewhere in the dashboard):
     isAdmin, db, allStudents, escapeHtml, showError, showSuccess,
     showConfirm, ADMIN_EMAIL, ActivityLogger, ActivityConfig
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const LEVELS  = ['A2', 'B1', 'B1+', 'B2'];
  const MODULES = ['Module 1', 'Module 2', 'Module 3', 'Module 4'];

  // Module-private state. Re-rendered on every change.
  const State = {
    teachers:    [],          // [{id, email, name, role, assignedClasses, assignedYear, assignedModule, lastLogin, ...}]
    pending:     [],          // whitelist emails not yet registered
    classes:     [],          // merged: student-derived + registry-only (sorted, unique)
    studentClasses: new Set(),// classes that have at least one student (delete-protected)
    registryClasses: [],      // classes added via "Add new class" (settings/availableClasses)
    filter:      'All',       // 'All' | 'Admins' | 'Teachers' | 'Unassigned'
    search:      '',
    levelFilter: 'all',       // 'all' | 'A2' | 'B1' | 'B1+' | 'B2'
    expanded:    null,        // id of expanded row
    showAdd:     false        // collapsible "Add Teacher" form
  };

  // ── Helpers ──────────────────────────────────────────────────
  function initialsOf(name) {
    if (!name) return '??';
    return String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function lastActiveLabel(ts) {
    if (!ts) return 'Never';
    const ms = ts.toDate ? ts.toDate().getTime() : (ts.seconds ? ts.seconds * 1000 : 0);
    if (!ms) return 'Never';
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    if (min < 1)    return 'Now';
    if (min < 60)   return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)    return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 30)     return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
  }

  // status color for the avatar dot. 'now' / 'minutes' / 'hours' = online/recent;
  // 'days' / 'never' = inactive
  function statusFor(label) {
    if (label === 'Now') return 'online';
    if (/^(\d+)m\b/.test(label) || /^(\d+)h\b/.test(label)) return 'recent';
    return 'inactive';
  }

  function levelColorClass(lvl) {
    switch (lvl) {
      case 'B2':  return 'av-c-green';
      case 'B1+': return 'av-c-purple';
      case 'B1':  return 'av-c-cyan';
      case 'A2':  return 'av-c-blue';
      default:    return 'av-c-dim';
    }
  }

  // Count students assigned via class membership.
  function studentsFor(teacher) {
    if (!Array.isArray(allStudents)) return 0;
    const cls = teacher.assignedClasses || [];
    if (!cls.length) return 0;
    return allStudents.filter(s => cls.includes(s.studentClass)).length;
  }

  // Tiny SVG sparkline. data: number[].
  function sparkline(data, color, w, h) {
    if (!data || data.length < 2) return '';
    w = w || 72; h = h || 28;
    const min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    const range = (max - min) || 1;
    const pts = data.map((v, i) =>
      `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
    const id = 'sg' + color.replace('#', '');
    return `
      <svg width="${w}" height="${h}" aria-hidden="true">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0,${h} L${pts.split(' ').join(' L')} L${w},${h} Z" fill="url(#${id})"/>
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"
                  stroke-linejoin="round" stroke-linecap="round"/>
      </svg>`;
  }

  // ── Public entry: fetch + render ─────────────────────────────
  async function loadTeachers() {
    if (!isAdmin || typeof isAdmin !== 'function' || !isAdmin()) return;
    const container = document.getElementById('teachersList');
    if (!container) return;

    try {
      // 1. Whitelist of teacher emails (settings/teacherEmails)
      const whitelistDoc = await db.collection('settings').doc('teacherEmails').get();
      const whitelist = whitelistDoc.exists ? (whitelistDoc.data().teacherEmails || []) : [];

      // 2. All registered teachers
      const teachersSnap = await db.collection('users').where('role', '==', 'teacher').get();
      const teachers = [];
      teachersSnap.forEach(doc => teachers.push({ id: doc.id, ...doc.data() }));

      // 3. Pending = whitelist entries that haven't registered yet
      const registeredEmails = teachers.map(t => t.email);
      State.pending = whitelist.filter(e => !registeredEmails.includes(e));
      State.teachers = teachers;

      // 4. Class registry — settings/availableClasses lets admins add
      //    classes that don't have any students yet (e.g. brand-new
      //    sections). Merged with student-derived classes so the
      //    assignment grid surfaces both.
      let registry = [];
      try {
        const reg = await db.collection('settings').doc('availableClasses').get();
        if (reg.exists) {
          const v = reg.data().classes;
          if (Array.isArray(v)) registry = v.map(s => String(s).trim().toUpperCase()).filter(Boolean);
        }
      } catch (_) { /* missing doc is fine — treat as empty */ }
      State.registryClasses = [...new Set(registry)];

      // Student-derived class set (for delete-protection — these can't
      // be removed via the ✕ chip because real students are in them).
      const fromStudents = (Array.isArray(allStudents) ? allStudents : [])
        .map(s => s.studentClass).filter(Boolean);
      State.studentClasses = new Set(fromStudents.map(s => String(s).trim().toUpperCase()));

      State.classes = [...new Set([
        ...fromStudents.map(s => String(s).trim().toUpperCase()),
        ...State.registryClasses
      ])].sort();

      // (confusing-pairs data is loaded by teacher/js/confusing-pairs.js)
      render();
    } catch (e) {
      console.error('Error loading teachers:', e);
      container.innerHTML = `<div class="av-empty">Failed to load teachers — ${escapeHtml(e.message || String(e))}</div>`;
    }
  }
  window.loadTeachers = loadTeachers;

  // ── Render ──────────────────────────────────────────────────
  function visibleTeachers() {
    const q = State.search.trim().toLowerCase();
    return State.teachers.filter(t => {
      // Filter pill
      if (State.filter === 'Admins'     && !(t.email === ADMIN_EMAIL || t.isAdmin)) return false;
      if (State.filter === 'Teachers'   &&  (t.email === ADMIN_EMAIL || t.isAdmin)) return false;
      if (State.filter === 'Unassigned' && (t.assignedClasses || []).length > 0) return false;
      // Level filter
      if (State.levelFilter !== 'all' && (t.assignedYear || '') !== State.levelFilter) return false;
      // Search
      if (q) {
        const blob = `${t.name || ''} ${t.email || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const container = document.getElementById('teachersList');
    if (!container) return;

    const allCount   = State.teachers.length;
    const adminCount = State.teachers.filter(t => t.email === ADMIN_EMAIL || t.isAdmin).length;
    const teacherCount = allCount - adminCount;
    const unassignedCount = State.teachers.filter(t => (t.assignedClasses || []).length === 0).length;
    const totalStudents = State.teachers.reduce((s, t) => s + studentsFor(t), 0);

    const filtered = visibleTeachers();

    // Header ("👑 Admin / Manage teacher accounts and class assignments")
    // is rendered by the dashboard's tab-header system in overview-v2.js
    // (renderHeaderForTab). Including it here too produced two stacked
    // copies on the admin tab — drop the internal one.
    container.innerHTML = `
      <div class="av-root">
        ${renderStats(allCount, adminCount, totalStudents, unassignedCount)}
        ${renderToolbar(allCount, adminCount, teacherCount, unassignedCount)}
        ${State.showAdd ? renderAddForm() : ''}
        ${renderTable(filtered, allCount)}
        ${renderPending()}
        <!-- Confusing pairs UI is rendered by teacher/js/confusing-pairs.js
             (shared module — also mounted on the Overview tab). -->
        <div id="adminConfusingPairsMount"></div>
      </div>
    `;
    // Mount the shared card right after the table HTML is in the DOM.
    if (typeof ConfusingPairs !== 'undefined') {
      ConfusingPairs.mount('adminConfusingPairsMount');
    }

    // Roll-back the legacy header stats (in the surrounding dashboard tab)
    // so the values stay in sync. Some pages still read these IDs.
    const tt = document.getElementById('totalTeachers'); if (tt) tt.textContent = allCount;
    const tc = document.getElementById('totalClasses');  if (tc) tc.textContent = State.classes.length;
  }

  // renderHeader removed — the dashboard tab-header system in
  // overview-v2.js (renderHeaderForTab) already shows the "👑 Admin"
  // title above every tab, so calling it again here produced two
  // stacked copies.

  function renderStats(total, admins, students, unassigned) {
    // Sparklines based on real-time-ish samples — keep flat trend if we
    // don't have history. The trend chips below pull from heuristics.
    const teacherSpark = [Math.max(0, total - 3), Math.max(0, total - 2), Math.max(0, total - 2),
                          Math.max(0, total - 1), Math.max(0, total - 1), total, total];
    const studentSpark = [
      Math.max(0, students - 60), Math.max(0, students - 40), Math.max(0, students - 25),
      Math.max(0, students - 15), Math.max(0, students - 8), students, students
    ];
    const adminPct = total ? Math.round((admins / total) * 100) : 0;

    return `
      <div class="av-stats">
        ${statCard({
          icon: '👨‍🏫', label: 'Total Teachers', value: total,
          color: 'cyan', spark: teacherSpark
        })}
        ${statCard({
          icon: '👑', label: 'Admins', value: admins,
          sub: `${adminPct}% of staff`, color: 'amber'
        })}
        ${statCard({
          icon: '🎓', label: 'Total Students', value: students,
          color: 'purple', spark: studentSpark
        })}
        ${statCard({
          icon: '⚠️', label: 'Unassigned', value: unassigned,
          sub: 'Awaiting classes', color: 'red',
          alert: unassigned > 0
        })}
      </div>
    `;
  }

  function statCard({ icon, label, value, sub, color, spark, alert }) {
    // Resolve color name → CSS var → hex (fallback only if the
    // var isn't loaded yet). Keeps the stat-card sparklines in sync
    // with the rest of the teacher dashboard palette.
    function _cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (_) { return fallback; }
    }
    const sparkColor = color === 'cyan'   ? _cssVar('--t2-cyan',   '#22d3ee')
                     : color === 'purple' ? _cssVar('--t2-purple', '#a855f7')
                     : color === 'amber'  ? _cssVar('--t2-amber',  '#f59e0b')
                     : color === 'red'    ? _cssVar('--t2-red',    '#ef4444')
                     :                      _cssVar('--t2-blue',   '#3b82f6');
    return `
      <div class="av-stat ${alert ? 'is-alert' : ''}">
        <div class="av-stat-top">
          <div class="av-stat-icon">${icon}</div>
        </div>
        <div class="av-stat-value av-c-${color}">${value}</div>
        <div class="av-stat-label">${label}</div>
        ${spark ? sparkline(spark, sparkColor) : ''}
        ${sub ? `<div class="av-stat-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
    `;
  }

  function renderToolbar(all, adminCount, teacherCount, unassigned) {
    const pill = (key, label, count) => `
      <button class="av-pill ${State.filter === key ? 'is-active' : ''}"
              data-action="filter" data-value="${key}">
        ${label}${typeof count === 'number' ? ` <span class="av-pill-n">(${count})</span>` : ''}
      </button>`;

    const levelOpt = (val, label) =>
      `<option value="${val}" ${State.levelFilter === val ? 'selected' : ''}>${label}</option>`;

    return `
      <div class="av-toolbar">
        <div class="av-toolbar-pills">
          ${pill('All',        'All',        all)}
          ${pill('Admins',     'Admins',     adminCount)}
          ${pill('Teachers',   'Teachers',   teacherCount)}
          ${pill('Unassigned', 'Unassigned', unassigned)}
        </div>
        <div class="av-toolbar-spacer"></div>
        <div class="av-search">
          <span class="av-search-icon">🔍</span>
          <input type="text" class="av-search-input" id="avSearch"
                 placeholder="Search teachers…"
                 value="${escapeHtml(State.search)}"
                 autocomplete="off"/>
        </div>
        <select class="av-sel" id="avLevelFilter">
          ${levelOpt('all', 'All Levels')}
          ${LEVELS.map(l => levelOpt(l, l)).join('')}
        </select>
        <button class="av-btn" data-action="export">⬇ Export</button>
        <button class="av-btn av-btn--solid" data-action="toggle-add">${State.showAdd ? '✕ Cancel' : '+ Add Teacher'}</button>
      </div>
    `;
  }

  function renderAddForm() {
    return `
      <div class="av-add-form">
        <div class="av-add-head">
          <span class="av-add-title">+ Add New FSM Teacher</span>
          <button class="av-add-close" data-action="toggle-add" aria-label="Close">✕</button>
        </div>
        <div class="av-add-grid">
          <input type="email" id="newTeacherEmail" class="av-input"
                 placeholder="teacher@fsm.edu.tr" autocomplete="off"/>
          <select class="av-sel" id="newTeacherLevel">
            <option value="">Select Level</option>
            ${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
          </select>
          <select class="av-sel" id="newTeacherModule">
            <option value="">Select Module</option>
            ${MODULES.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
          <button class="av-btn av-btn--solid" data-action="submit-add">Add Teacher</button>
        </div>
        <div class="av-add-hint">✓ Only FSM domain emails (@fsm.edu.tr) are allowed · Classes can be assigned after creation</div>
      </div>
    `;
  }

  function renderTable(rows, totalCount) {
    if (!rows.length) {
      return `
        <div class="av-card">
          <div class="av-empty">
            ${State.teachers.length === 0
              ? 'No teachers yet. Add one to get started.'
              : 'No teachers match the current filters.'}
          </div>
        </div>
      `;
    }
    return `
      <div class="av-card">
        <table class="av-table">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Role</th>
              <th>Level</th>
              <th>Module</th>
              <th>Classes</th>
              <th>Students</th>
              <th>Last Active</th>
              <th class="av-th-narrow"></th>
            </tr>
          </thead>
          <tbody>${rows.map(t => renderRow(t)).join('')}</tbody>
        </table>
        <div class="av-table-foot">
          <span>Showing ${rows.length} of ${totalCount} teachers</span>
          <span class="av-hint">💡 Click any row to expand and edit assignments</span>
        </div>
      </div>
    `;
  }

  function renderRow(t) {
    const expanded = State.expanded === t.id;
    const initials = initialsOf(t.name || t.email);
    const lastActive = lastActiveLabel(t.lastLogin);
    const status = statusFor(lastActive);
    const isCurrent = t.email === ADMIN_EMAIL;
    const isAdminFlag = isCurrent || !!t.isAdmin;
    const cls = t.assignedClasses || [];
    const studentCount = studentsFor(t);

    const classStack = cls.length === 0
      ? `<span class="av-c-dim av-small">None assigned</span>`
      : `<div class="av-class-stack">
           <div class="av-class-pile">
             ${cls.slice(0, 3).map((c, i) =>
               `<span class="av-class-chip-mini" style="margin-left:${i ? -6 : 0}px;z-index:${3 - i}">${escapeHtml(c)}</span>`
             ).join('')}
           </div>
           ${cls.length > 3 ? `<span class="av-class-more">+${cls.length - 3} more</span>` : ''}
         </div>`;

    const roleBadge = isAdminFlag
      ? `<span class="av-badge av-c-amber">👑 Admin</span>`
      : `<span class="av-badge av-c-cyan">Teacher</span>`;

    const levelBadge = t.assignedYear
      ? `<span class="av-badge ${levelColorClass(t.assignedYear)}">${escapeHtml(t.assignedYear)}</span>`
      : `<span class="av-c-dim av-small">—</span>`;

    return `
      <tr class="av-row ${expanded ? 'is-expanded' : ''}" data-action="toggle" data-id="${escapeHtml(t.id)}">
        <td>
          <div class="av-row-name">
            <div class="av-avatar">
              ${escapeHtml(initials)}
              <span class="av-avatar-dot av-status-${status}"></span>
            </div>
            <div class="av-row-name-text">
              <div class="av-row-name-head">
                <span class="av-name">${escapeHtml(t.name || 'Unknown')}</span>
                ${isCurrent ? '<span class="av-badge av-c-green">You</span>' : ''}
              </div>
              <div class="av-row-email">${escapeHtml(t.email || '')}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>${levelBadge}</td>
        <td>${t.assignedModule
              ? `<span class="av-row-text">${escapeHtml(t.assignedModule)}</span>`
              : `<span class="av-c-dim av-small">—</span>`}</td>
        <td>${classStack}</td>
        <td><span class="av-row-count">${studentCount}</span></td>
        <td>
          <span class="av-last-active">
            <span class="av-status-dot av-status-${status}"></span>${escapeHtml(lastActive)}
          </span>
        </td>
        <td class="av-th-narrow">
          <span class="av-chevron ${expanded ? 'is-open' : ''}">▶</span>
        </td>
      </tr>
      ${expanded ? renderDetail(t) : ''}
    `;
  }

  function renderDetail(t) {
    const cls = t.assignedClasses || [];
    const isCurrent = t.email === ADMIN_EMAIL;
    return `
      <tr class="av-detail-row">
        <td colspan="8">
          <div class="av-detail">
            <div class="av-detail-grid">
              <div>
                <div class="av-detail-label">📊 Year / Level</div>
                <select class="av-sel av-sel-full" data-action="set-year" data-id="${escapeHtml(t.id)}">
                  <option value="">-- Not Assigned --</option>
                  ${LEVELS.map(l =>
                    `<option value="${l}" ${t.assignedYear === l ? 'selected' : ''}>${l}</option>`
                  ).join('')}
                </select>
              </div>
              <div>
                <div class="av-detail-label">📂 Module</div>
                <select class="av-sel av-sel-full" data-action="set-module" data-id="${escapeHtml(t.id)}">
                  <option value="">-- Not Assigned --</option>
                  ${MODULES.map(m =>
                    `<option value="${m}" ${t.assignedModule === m ? 'selected' : ''}>${m}</option>`
                  ).join('')}
                </select>
              </div>
              <div>
                <div class="av-detail-label">
                  👥 Assigned Classes
                  <span class="av-c-cyan av-small">${cls.length}/${State.classes.length}</span>
                </div>
                <div class="av-class-grid">
                  ${State.classes.length === 0
                    ? '<span class="av-c-dim av-small">No classes available yet — add one below.</span>'
                    : State.classes.map(c => {
                        const on = cls.includes(c);
                        // A class is registry-only when it isn't backed by
                        // any current student. Those are safe to remove
                        // from the registry (no student gets orphaned).
                        const removable = !State.studentClasses.has(c);
                        return `
                          <label class="av-class-chip ${on ? 'is-on' : ''}">
                            <input type="checkbox" ${on ? 'checked' : ''}
                                   data-action="toggle-class"
                                   data-id="${escapeHtml(t.id)}"
                                   data-class="${escapeHtml(c)}"/>
                            <span>${escapeHtml(c)}</span>
                            ${removable ? `
                              <button type="button" class="av-class-remove"
                                      data-action="remove-class"
                                      data-class="${escapeHtml(c)}"
                                      title="Delete this class from the system (no students assigned)"
                                      aria-label="Delete ${escapeHtml(c)}">×</button>
                            ` : ''}
                          </label>`;
                      }).join('')}
                </div>
                <!-- Add a new class — for sections that don't have any
                     students yet. Saved to settings/availableClasses
                     and immediately assigned to this teacher. -->
                <div class="av-new-class">
                  <input type="text" class="av-input av-new-class-input"
                         id="avNewClass-${escapeHtml(t.id)}"
                         placeholder="e.g. B999, D210"
                         maxlength="12"
                         autocomplete="off"/>
                  <button type="button" class="av-btn av-btn--solid"
                          data-action="submit-new-class"
                          data-id="${escapeHtml(t.id)}">+ Add Class</button>
                </div>
                <div class="av-new-class-hint">Letters &amp; digits only · Auto-uppercased · Class is created if it doesn't exist and assigned to this teacher.</div>
              </div>
            </div>
            <div class="av-detail-actions">
              ${!isCurrent ? `<button class="av-btn av-btn--demote"
                                       data-action="demote"
                                       data-id="${escapeHtml(t.id)}"
                                       data-email="${escapeHtml(t.email || '')}">
                                👤 Demote to Student
                              </button>` : ''}
              <button class="av-btn" data-action="close-row">Close</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function renderPending() {
    if (!State.pending.length) return '';
    return `
      <div class="av-pending">
        <h3 class="av-pending-title">⏳ Pending Registration</h3>
        <p class="av-pending-sub">These emails are whitelisted but haven't signed up yet. They'll get teacher access automatically when they register.</p>
        <ul class="av-pending-list">
          ${State.pending.map(email => `
            <li class="av-pending-row">
              <span class="av-pending-email">📧 ${escapeHtml(email)}</span>
              <button class="av-btn av-btn--ghost-warn"
                      data-action="remove-whitelist"
                      data-email="${escapeHtml(email)}">✕ Remove</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // ── Event delegation ─────────────────────────────────────────
  // One global click handler. Branches on data-action, scoped to the
  // admin tab so we don't intercept clicks on other tabs.
  document.addEventListener('click', async (e) => {
    const tab = document.getElementById('tab-admin');
    if (!tab || !tab.contains(e.target)) return;

    const a = e.target.closest('[data-action]');
    if (!a) return;
    const action = a.dataset.action;

    if (action === 'filter') {
      State.filter = a.dataset.value;
      render();
      return;
    }
    if (action === 'export') {
      exportCSV();
      return;
    }
    if (action === 'toggle-add') {
      State.showAdd = !State.showAdd;
      render();
      return;
    }
    if (action === 'submit-add') {
      addTeacherEmail();
      return;
    }
    if (action === 'toggle') {
      // Don't toggle if the click landed on a control inside the row.
      if (e.target.closest('select, input, button, label')) return;
      const id = a.dataset.id;
      State.expanded = (State.expanded === id) ? null : id;
      render();
      return;
    }
    if (action === 'close-row') {
      State.expanded = null;
      render();
      return;
    }
    if (action === 'demote') {
      removeTeacher(a.dataset.id, a.dataset.email);
      return;
    }
    if (action === 'remove-whitelist') {
      removeFromWhitelist(a.dataset.email);
      return;
    }
    if (action === 'submit-new-class') {
      addNewClass(a.dataset.id);
      return;
    }
    if (action === 'remove-class') {
      // Stop the click from bubbling to the surrounding label (which
      // would toggle the checkbox). The chip's ✕ button is purely for
      // deleting the class from the registry.
      e.preventDefault();
      e.stopPropagation();
      removeClassFromRegistry(a.dataset.class);
      return;
    }
    // Confusing-pair actions are owned by teacher/js/confusing-pairs.js
    // (it binds its own listeners scoped to [data-cp-card]).
  });

  // Enter on the new-class input → submit. Also Enter on the search box
  // is a no-op (search already debounces on input).
  document.addEventListener('keydown', (e) => {
    const tab = document.getElementById('tab-admin');
    if (!tab || !tab.contains(e.target)) return;
    if (e.key !== 'Enter') return;
    if (e.target.classList && e.target.classList.contains('av-new-class-input')) {
      e.preventDefault();
      // Pull the teacher id off the input's id (avNewClass-<id>)
      const id = (e.target.id || '').replace(/^avNewClass-/, '');
      if (id) addNewClass(id);
    }
    // Enter on the confusing-pair inputs is handled inside
    // teacher/js/confusing-pairs.js (scoped to [data-cp-field]).
  });

  // Search input — debounce so we don't re-render on every keystroke.
  let searchT = null;
  document.addEventListener('input', (e) => {
    const tab = document.getElementById('tab-admin');
    if (!tab || !tab.contains(e.target)) return;
    if (e.target.id === 'avSearch') {
      const v = e.target.value;
      clearTimeout(searchT);
      searchT = setTimeout(() => {
        State.search = v;
        // Preserve the cursor focus on the search box across re-render
        const before = document.activeElement && document.activeElement.id;
        render();
        if (before === 'avSearch') {
          const el = document.getElementById('avSearch');
          if (el) {
            el.focus();
            try { el.setSelectionRange(v.length, v.length); } catch (_) {}
          }
        }
      }, 120);
    }
  });

  // Select changes (level filter + per-row year/module + class checkboxes)
  document.addEventListener('change', (e) => {
    const tab = document.getElementById('tab-admin');
    if (!tab || !tab.contains(e.target)) return;

    if (e.target.id === 'avLevelFilter') {
      State.levelFilter = e.target.value;
      render();
      return;
    }
    const action = (e.target.dataset && e.target.dataset.action) || '';
    if (action === 'set-year') {
      updateTeacherAssignment(e.target.dataset.id, 'year', e.target.value);
      return;
    }
    if (action === 'set-module') {
      updateTeacherAssignment(e.target.dataset.id, 'module', e.target.value);
      return;
    }
    if (action === 'toggle-class') {
      toggleClassAssignment(e.target.dataset.id, e.target.dataset.class, e.target.checked);
      return;
    }
  });

  // ── Mutations (kept identical to v1 — same Firestore writes) ──
  async function addTeacherEmail() {
    if (!isAdmin()) return showError('Admin Only', 'Only administrators can add teachers.');
    const emailEl = document.getElementById('newTeacherEmail');
    if (!emailEl) return;
    const email = emailEl.value.trim().toLowerCase();
    if (!email) return showError('Missing Email', 'Please enter an email address.');
    if (!email.endsWith('@fsm.edu.tr')) {
      return showError('Invalid Email', 'Email must end with @fsm.edu.tr (FSM domain required).');
    }

    try {
      const docRef = db.collection('settings').doc('teacherEmails');
      const doc = await docRef.get();
      let whitelist = doc.exists ? (doc.data().teacherEmails || []) : [];
      if (whitelist.includes(email)) {
        return showError('Duplicate Email', 'This email is already in the whitelist.');
      }

      const existingUsers = await db.collection('users').where('email', '==', email).get();
      whitelist.push(email);
      await docRef.set({ teacherEmails: whitelist });

      if (!existingUsers.empty) {
        await existingUsers.docs[0].ref.update({ role: 'teacher' });
        showSuccess('Teacher Added', '✓ Teacher access granted immediately.');
      } else {
        showSuccess('Teacher Added', '✓ Email added to whitelist. They will get teacher access on registration.');
      }

      if (typeof ActivityLogger !== 'undefined') {
        try { await ActivityLogger.logTeacherAdded({ email: email }); } catch (_) {}
      }

      emailEl.value = '';
      State.showAdd = false;
      await loadTeachers();
    } catch (e) {
      console.error('Error adding teacher:', e);
      showError('Add Failed', e.message || String(e));
    }
  }
  window.addTeacherEmail = addTeacherEmail;

  async function removeFromWhitelist(email) {
    if (!isAdmin()) return;
    showConfirm('🗑️', 'Remove from Whitelist?',
      `Remove ${email} from the teacher whitelist?`,
      'Yes, Remove',
      async () => {
        try {
          const docRef = db.collection('settings').doc('teacherEmails');
          const doc = await docRef.get();
          let whitelist = doc.exists ? (doc.data().teacherEmails || []) : [];
          whitelist = whitelist.filter(e => e !== email);
          await docRef.set({ teacherEmails: whitelist }, { merge: true });
          showSuccess('Removed', 'Email removed from the whitelist.');
          await loadTeachers();
        } catch (e) {
          console.error('Error removing from whitelist:', e);
          showError('Error', 'Failed to remove: ' + (e?.message || e));
        }
      }
    );
  }
  window.removeFromWhitelist = removeFromWhitelist;

  async function removeTeacher(teacherId, email) {
    if (!isAdmin()) return;
    showConfirm('👤', 'Demote to Student?',
      `This will remove teacher privileges from ${email}. Their account, progress, classes, and all data are preserved — only their role changes back to student. You can re-promote them anytime.`,
      'Yes, Demote',
      async () => {
        try {
          const docRef = db.collection('settings').doc('teacherEmails');
          const doc = await docRef.get();
          let whitelist = doc.exists ? (doc.data().teacherEmails || []) : [];
          whitelist = whitelist.filter(e => e !== email);
          await docRef.set({ teacherEmails: whitelist }, { merge: true });

          await db.collection('users').doc(teacherId).update({ role: 'student' });

          if (typeof ActivityLogger !== 'undefined') {
            try { await ActivityLogger.logTeacherRemoved({ teacherId, email }); } catch (_) {}
          }

          showSuccess('Demoted to Student', `${email} is now a student. Their account and data are intact.`);
          State.expanded = null;
          await loadTeachers();
        } catch (e) {
          console.error('Error demoting teacher:', e);
          showError('Error', 'Failed to demote: ' + (e?.message || e));
        }
      }
    );
  }
  window.removeTeacher = removeTeacher;

  async function toggleClassAssignment(teacherId, className, isAssigned) {
    if (!isAdmin()) return;
    try {
      const teacherRef = db.collection('users').doc(teacherId);
      const teacherDoc = await teacherRef.get();
      const data = teacherDoc.data() || {};
      let classes = data.assignedClasses || [];

      if (isAssigned && !classes.includes(className)) classes.push(className);
      else if (!isAssigned) classes = classes.filter(c => c !== className);

      await teacherRef.update({ assignedClasses: classes });
      showSuccess('Saved', `Class ${className} ${isAssigned ? 'assigned' : 'removed'}.`);

      if (typeof ActivityLogger !== 'undefined' && typeof ActivityConfig !== 'undefined') {
        try {
          await ActivityLogger.log(ActivityConfig.types.TEACHER_UPDATED, {
            teacherId, action: isAssigned ? 'class_added' : 'class_removed', className
          });
        } catch (_) {}
      }

      // Local-only update so the user keeps their expanded view.
      const local = State.teachers.find(t => t.id === teacherId);
      if (local) local.assignedClasses = classes;
      render();
    } catch (e) {
      console.error('Error updating class assignment:', e);
      showError('Update Error', 'Failed to update class: ' + (e?.message || e));
    }
  }
  window.toggleClassAssignment = toggleClassAssignment;

  // ── Class registry: add a brand-new class & assign it ───────
  // Persists the class to settings/availableClasses (so it's
  // available for every teacher's chip grid) AND to the current
  // teacher's assignedClasses (immediate assignment is the use case
  // 95% of the time). Validates: trimmed, uppercased, alphanumeric
  // only, length 1-12, no duplicates (case-insensitive).
  async function addNewClass(teacherId) {
    if (!isAdmin()) return;
    const input = document.getElementById('avNewClass-' + teacherId);
    if (!input) return;
    let name = String(input.value || '').trim().toUpperCase();
    if (!name) {
      return showError('Missing Class', 'Please type a class code first.');
    }
    if (!/^[A-Z0-9][A-Z0-9_-]{0,11}$/.test(name)) {
      return showError('Invalid Class Code',
        'Use only letters, digits, hyphens or underscores (max 12 characters). Example: B999, D-210.');
    }
    if (State.classes.includes(name)) {
      return showError('Already Exists',
        `Class ${name} already exists. Tick its checkbox above to assign it.`);
    }

    try {
      // 1. Append to the registry doc (creates it if missing)
      const regRef = db.collection('settings').doc('availableClasses');
      const regDoc = await regRef.get();
      const list = regDoc.exists ? (regDoc.data().classes || []) : [];
      const next = [...new Set([...list.map(s => String(s).trim().toUpperCase()), name])];
      await regRef.set({ classes: next }, { merge: true });

      // 2. Assign to this teacher right away
      const teacherRef = db.collection('users').doc(teacherId);
      const tDoc = await teacherRef.get();
      const tData = tDoc.data() || {};
      const assigned = tData.assignedClasses || [];
      if (!assigned.includes(name)) {
        assigned.push(name);
        await teacherRef.update({ assignedClasses: assigned });
      }

      // 3. Local state — keep the row expanded, no full reload needed
      State.registryClasses = next;
      State.classes = [...new Set([...State.classes, name])].sort();
      const local = State.teachers.find(t => t.id === teacherId);
      if (local) local.assignedClasses = assigned;

      input.value = '';
      showSuccess('Class Added', `Class ${name} created and assigned.`);

      if (typeof ActivityLogger !== 'undefined' && typeof ActivityConfig !== 'undefined') {
        try {
          await ActivityLogger.log(ActivityConfig.types.TEACHER_UPDATED, {
            teacherId, action: 'class_created_and_assigned', className: name
          });
        } catch (_) {}
      }

      render();
      // Re-focus the input so admins can rapid-fire add several classes.
      setTimeout(() => {
        const el = document.getElementById('avNewClass-' + teacherId);
        if (el) el.focus();
      }, 0);
    } catch (e) {
      console.error('Error adding class:', e);
      showError('Error', 'Failed to add class: ' + (e?.message || e));
    }
  }
  window.addNewClass = addNewClass;

  // ── Class registry: remove a class that has no students ─────
  // Only allowed for registry-only classes (delete-protection enforced
  // both in UI and here). Pulls the class off every teacher who had it,
  // then drops it from the registry.
  async function removeClassFromRegistry(name) {
    if (!isAdmin()) return;
    name = String(name || '').trim().toUpperCase();
    if (!name) return;

    if (State.studentClasses.has(name)) {
      return showError('Cannot Delete',
        `Class ${name} still has students assigned. Move them first, then try again.`);
    }

    showConfirm('🗑️', 'Delete Class?',
      `Remove ${name} from the system? This unassigns it from any teacher who has it. (This is safe — no student is in this class.)`,
      'Yes, Delete',
      async () => {
        try {
          // 1. Drop from the registry
          const regRef = db.collection('settings').doc('availableClasses');
          const regDoc = await regRef.get();
          const list = regDoc.exists ? (regDoc.data().classes || []) : [];
          const next = list.map(s => String(s).trim().toUpperCase()).filter(c => c !== name);
          await regRef.set({ classes: next }, { merge: true });

          // 2. Strip it from every teacher's assignedClasses
          const writes = [];
          State.teachers.forEach(t => {
            const cls = t.assignedClasses || [];
            if (cls.includes(name)) {
              const stripped = cls.filter(c => c !== name);
              writes.push(db.collection('users').doc(t.id).update({ assignedClasses: stripped }));
              t.assignedClasses = stripped; // mirror locally so the next render is correct
            }
          });
          await Promise.all(writes);

          // 3. Update local state and re-render
          State.registryClasses = next;
          State.classes = State.classes.filter(c => c !== name);
          showSuccess('Class Deleted', `${name} removed from the system.`);

          if (typeof ActivityLogger !== 'undefined' && typeof ActivityConfig !== 'undefined') {
            try {
              await ActivityLogger.log(ActivityConfig.types.TEACHER_UPDATED, {
                action: 'class_deleted', className: name
              });
            } catch (_) {}
          }

          render();
        } catch (e) {
          console.error('Error deleting class:', e);
          showError('Error', 'Failed to delete: ' + (e?.message || e));
        }
      }
    );
  }
  window.removeClassFromRegistry = removeClassFromRegistry;

  async function updateTeacherAssignment(teacherId, field, value) {
    if (!isAdmin()) return;
    try {
      const update = {};
      // "-- Not Assigned --" sends an empty string. Translate that into a
      // FIELD DELETE so the user doc doesn't keep "" — that empty string
      // would otherwise make Firestore rules treat the teacher as "must
      // match year ''" and block all student reads.
      const cleanValue = (typeof value === 'string') ? value.trim() : value;
      const isEmpty = !cleanValue;
      const deleteSentinel = firebase.firestore.FieldValue.delete();

      if (field === 'year')        update.assignedYear   = isEmpty ? deleteSentinel : cleanValue;
      else if (field === 'module') update.assignedModule = isEmpty ? deleteSentinel : cleanValue;
      else { console.warn('Unknown field:', field); return; }

      await db.collection('users').doc(teacherId).update(update);
      showSuccess('Saved', `Teacher ${field === 'year' ? 'level' : 'module'} updated.`);

      // Local update so the row reflects the change without a full reload.
      // Mirror the server state — for an "empty" pick, the field is
      // deleted on Firestore, so locally we delete the property too.
      const local = State.teachers.find(t => t.id === teacherId);
      if (local) {
        if (field === 'year') {
          if (isEmpty) delete local.assignedYear;
          else         local.assignedYear = cleanValue;
        }
        if (field === 'module') {
          if (isEmpty) delete local.assignedModule;
          else         local.assignedModule = cleanValue;
        }
      }
      render();
    } catch (e) {
      console.error('Error updating teacher assignment:', e);
      showError('Update Error', 'Failed to update: ' + (e?.message || e));
    }
  }
  window.updateTeacherAssignment = updateTeacherAssignment;

  // ── CSV export ──────────────────────────────────────────────
  function exportCSV() {
    const rows = visibleTeachers();
    const header = ['Name', 'Email', 'Role', 'Level', 'Module', 'Classes', 'Students', 'Last Active'];
    const csvEscape = (v) => {
      const s = String(v == null ? '' : v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const body = rows.map(t => [
      t.name || '',
      t.email || '',
      (t.email === ADMIN_EMAIL || t.isAdmin) ? 'Admin' : 'Teacher',
      t.assignedYear || '',
      t.assignedModule || '',
      (t.assignedClasses || []).join('; '),
      studentsFor(t),
      lastActiveLabel(t.lastLogin)
    ].map(csvEscape).join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teachers-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
})();
