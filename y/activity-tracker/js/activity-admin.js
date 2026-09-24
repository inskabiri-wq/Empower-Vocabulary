/* ============================================
   ACTIVITY TRACKER - Admin Panel
   View, filter, search and export activity logs
   ADMIN ONLY - Include in teacher-dashboard.html
   ============================================ */

const ActivityAdmin = {
  
  // State
  logs: [],
  filteredLogs: [],
  lastDoc: null,
  isLoading: false,
  hasMore: true,
  
  // Current filters
  filters: {
    role: '',
    category: '',
    activityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  },
  
  // ============================================
  // INITIALIZATION
  // ============================================
  async init() {
    if (!this._checkAdmin()) return;
    
    this._populateFilters();
    this._setupEventListeners();
    await this.loadLogs();
    this._updateStats();
    
    // ONCE PER BROWSER SESSION, not once per render.
    //
    // This fired on every init() - every time the tab was opened, and every
    // time a filter re-ran it - so the audit log filled with rows saying
    // somebody had looked at the audit log. Eight identical "Activity Log
    // Viewed" entries in a row, burying the real events underneath, which is
    // the opposite of what an audit trail is for.
    //
    // A log that is mostly self-reports is worse than no log, so this is now
    // one entry per session. The write is guarded because sessionStorage
    // throws in some privacy modes, and an audit note is never worth breaking
    // the page for.
    try {
      if (typeof ActivityLogger !== 'undefined' && !sessionStorage.getItem('llLogViewLogged')) {
        sessionStorage.setItem('llLogViewLogged', '1');
        ActivityLogger.log(ActivityConfig.types.ACTIVITY_LOG_VIEWED);
      }
    } catch (e) { /* private mode: skip the note, keep the page */ }

    // Nothing deletes logs on a schedule, on purpose: an unattended job that
    // erases student records has one very bad failure mode and no upside. So
    // the reminder is here instead of in somebody's calendar, where it fires
    // exactly when it is actionable and cannot be missed.
    this.retentionNudge();
  },

  // ============================================
  // RETENTION REMINDER
  // ============================================
  // Costs ONE document read: we only need to know whether anything old
  // exists, never how much. countOlderThan() reads up to 5000 docs, which is
  // right for the button and far too expensive for a banner that renders on
  // every tab open.
  async retentionNudge() {
    const el = document.getElementById('activityRetentionBanner');
    if (!el) return;
    const months = this._retentionMonths();
    try {
      const snap = await db.collection(ActivityConfig.settings.collectionName)
        .where('timestamp', '<', this._cutoffFor(months))
        .orderBy('timestamp', 'asc')
        .limit(1)
        .get();

      if (snap.empty) {
        el.style.display = 'none';
        return;
      }

      // Say how far back it goes, so "overdue" is a fact rather than a nag.
      const oldest = snap.docs[0].data().timestamp;
      const d = (oldest && oldest.toDate) ? oldest.toDate() : null;
      const age = d ? Math.floor((Date.now() - d.getTime()) / 2592000000) : null;

      el.innerHTML =
        '<strong>Time to clear old logs.</strong> There are activity logs older than ' +
        months + ' months' +
        (age !== null ? ', the oldest from about ' + age + ' months ago' : '') +
        '. The retention period in the terms students agreed to is ' + months +
        ' months, so these should be downloaded and then deleted.' +
        '<br><span style="opacity:.85;">Use <em>Download these logs</em> above first. The delete refuses to run until you have.</span>';
      el.style.display = 'block';
    } catch (e) {
      // A missing index or a permissions hiccup must never break the tab. The
      // buttons still work by hand; only the reminder is skipped.
      console.warn('[ActivityAdmin] retention nudge skipped:', e && e.message);
      el.style.display = 'none';
    }
  },

  _checkAdmin() {
    if (typeof auth === 'undefined' || !auth.currentUser) {
      console.warn('[ActivityAdmin] Not authenticated');
      return false;
    }
    // Check if admin (you can customize this check)
    const adminEmail = typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'akabiriaslifar@fsm.edu.tr';
    if (auth.currentUser.email !== adminEmail) {
      console.warn('[ActivityAdmin] Not admin');
      return false;
    }
    return true;
  },
  
  // ============================================
  // LOAD LOGS FROM FIRESTORE
  // ============================================
  async loadLogs(append = false) {
    if (this.isLoading) return;
    this.isLoading = true;
    
    this._showLoading(true);
    
    try {
      let query = db.collection(ActivityConfig.settings.collectionName)
        .orderBy('timestamp', 'desc');
      
      // Apply filters
      if (this.filters.role) {
        query = query.where('userRole', '==', this.filters.role);
      }
      if (this.filters.category) {
        query = query.where('category', '==', this.filters.category);
      }
      if (this.filters.activityType) {
        query = query.where('activityType', '==', this.filters.activityType);
      }
      if (this.filters.userId) {
        query = query.where('userId', '==', this.filters.userId);
      }
      
      // Date filters (need to use timestamp)
      if (this.filters.dateFrom) {
        const fromDate = new Date(this.filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.where('timestamp', '>=', fromDate);
      }
      if (this.filters.dateTo) {
        const toDate = new Date(this.filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.where('timestamp', '<=', toDate);
      }
      
      // Pagination
      if (append && this.lastDoc) {
        query = query.startAfter(this.lastDoc);
      }
      
      query = query.limit(ActivityConfig.settings.pageSize);
      
      const snapshot = await query.get();
      
      const newLogs = [];
      snapshot.forEach(doc => {
        newLogs.push({ id: doc.id, ...doc.data() });
      });
      
      // Update last document for pagination
      if (snapshot.docs.length > 0) {
        this.lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
      
      // Check if there are more
      this.hasMore = snapshot.docs.length === ActivityConfig.settings.pageSize;
      
      if (append) {
        this.logs = [...this.logs, ...newLogs];
      } else {
        this.logs = newLogs;
        this.lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      }
      
      // Apply search filter (client-side)
      this._applySearchFilter();
      
      this._renderLogs();
      this._updateLoadMoreButton();
      
    } catch (error) {
      console.error('[ActivityAdmin] Error loading logs:', error);
      this._showError('Failed to load activity logs: ' + error.message);
    } finally {
      this.isLoading = false;
      this._showLoading(false);
    }
  },
  
  // ============================================
  // FILTERING
  // ============================================
  _applySearchFilter() {
    const search = this.filters.search.toLowerCase().trim();
    
    if (!search) {
      this.filteredLogs = [...this.logs];
      return;
    }
    
    this.filteredLogs = this.logs.filter(log => {
      return (
        (log.userName && log.userName.toLowerCase().includes(search)) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(search)) ||
        (log.activityLabel && log.activityLabel.toLowerCase().includes(search)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(search))
      );
    });
  },
  
  applyFilters() {
    // Get filter values from UI
    this.filters.role = document.getElementById('activityFilterRole')?.value || '';
    this.filters.category = document.getElementById('activityFilterCategory')?.value || '';
    this.filters.activityType = document.getElementById('activityFilterType')?.value || '';
    this.filters.dateFrom = document.getElementById('activityFilterDateFrom')?.value || '';
    this.filters.dateTo = document.getElementById('activityFilterDateTo')?.value || '';
    this.filters.search = document.getElementById('activitySearchInput')?.value || '';
    
    // Reset pagination
    this.lastDoc = null;
    this.hasMore = true;
    
    // Reload with filters
    this.loadLogs(false);
  },
  
  clearFilters() {
    this.filters = {
      role: '',
      category: '',
      activityType: '',
      userId: '',
      dateFrom: '',
      dateTo: '',
      search: ''
    };
    
    // Reset UI
    document.getElementById('activityFilterRole').value = '';
    document.getElementById('activityFilterCategory').value = '';
    document.getElementById('activityFilterType').value = '';
    document.getElementById('activityFilterDateFrom').value = '';
    document.getElementById('activityFilterDateTo').value = '';
    document.getElementById('activitySearchInput').value = '';
    
    // Reset pagination
    this.lastDoc = null;
    this.hasMore = true;
    
    this.loadLogs(false);
  },
  
  // ============================================
  // RENDER LOGS
  // ============================================
  _renderLogs() {
    const container = document.getElementById('activityLogsList');
    if (!container) return;
    
    if (this.filteredLogs.length === 0) {
      container.innerHTML = `
        <div class="activity-empty-state">
          <div class="activity-empty-icon">📭</div>
          <h3>No Activity Logs Found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.filteredLogs.map(log => this._renderLogItem(log)).join('');
  },
  
  _renderLogItem(log) {
    const labelInfo = ActivityConfig.getLabel(log.activityType);
    const categoryInfo = ActivityConfig.getCategory(log.category);
    const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestampLocal);
    const timeAgo = this._getTimeAgo(timestamp);
    const roleIcon = ActivityConfig.roles[log.userRole]?.icon || '👤';
    
    // Format details
    let detailsHtml = '';
    if (log.details && Object.keys(log.details).length > 0) {
      const detailsStr = Object.entries(log.details)
        .map(([key, value]) => `<span class="detail-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</span>`)
        .join(' ');
      detailsHtml = `<div class="activity-log-details">${detailsStr}</div>`;
    }
    
    return `
      <div class="activity-log-item" data-category="${log.category}">
        <div class="activity-log-icon" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color};">
          ${labelInfo.icon}
        </div>
        <div class="activity-log-content">
          <div class="activity-log-line">
            <span class="activity-log-action">${labelInfo.text}</span>
            <span class="activity-log-category" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color};">${categoryInfo.text}</span>
            <span class="activity-log-who">${roleIcon} ${escapeHtml(log.userName) || escapeHtml(log.userEmail)}${log.userClass ? ` <span class="user-class">(${escapeHtml(log.userClass)})</span>` : ''}</span>
            <span class="activity-log-when" title="${timestamp.toLocaleString('en-GB')} &middot; ${escapeHtml(log.device || 'Unknown')} / ${escapeHtml(log.browser || 'Unknown')}">${timeAgo} &middot; ${timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${detailsHtml}
        </div>
      </div>
    `;
  },
  
  // ============================================
  // EXPORT TO EXCEL
  // ============================================
  async exportToExcel() {
    try {
      this._showLoading(true);
      // Unlocks pruneOlderThan() for this browser session. Downloading
      // before deleting is the point of the retention tool.
      this._exportedThisSession = true;
      
      // Load ALL logs matching current filters for export
      let allLogs = [];
      let query = db.collection(ActivityConfig.settings.collectionName)
        .orderBy('timestamp', 'desc');
      
      // Apply same filters
      if (this.filters.role) query = query.where('userRole', '==', this.filters.role);
      if (this.filters.category) query = query.where('category', '==', this.filters.category);
      if (this.filters.activityType) query = query.where('activityType', '==', this.filters.activityType);
      if (this.filters.dateFrom) {
        const fromDate = new Date(this.filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.where('timestamp', '>=', fromDate);
      }
      if (this.filters.dateTo) {
        const toDate = new Date(this.filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.where('timestamp', '<=', toDate);
      }
      
      // Limit to 10000 for safety
      query = query.limit(10000);
      
      const snapshot = await query.get();
      snapshot.forEach(doc => {
        allLogs.push({ id: doc.id, ...doc.data() });
      });
      
      // Apply search filter if any
      if (this.filters.search) {
        const search = this.filters.search.toLowerCase().trim();
        allLogs = allLogs.filter(log => {
          return (
            (log.userName && log.userName.toLowerCase().includes(search)) ||
            (log.userEmail && log.userEmail.toLowerCase().includes(search)) ||
            (log.activityLabel && log.activityLabel.toLowerCase().includes(search))
          );
        });
      }
      
      if (allLogs.length === 0) {
        AppDialog.alert('No logs to export with current filters.');
        this._showLoading(false);
        return;
      }
      
      // Prepare Excel data
      const headers = [
        'Date',
        'Time',
        'User Name',
        'User Email',
        'User Role',
        'Class',
        'Activity',
        'Category',
        'Details',
        'Page',
        'Device',
        'Browser',
        'OS'
      ];
      
      const rows = allLogs.map(log => {
        const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestampLocal);
        const detailsStr = log.details ? JSON.stringify(log.details) : '';
        
        return [
          timestamp.toLocaleDateString('en-GB'),
          timestamp.toLocaleTimeString('en-GB'),
          log.userName || '',
          log.userEmail || '',
          log.userRole || '',
          log.userClass || '',
          log.activityLabel || log.activityType || '',
          log.category || '',
          detailsStr,
          log.page || '',
          log.device || '',
          log.browser || '',
          log.os || ''
        ];
      });
      
      // Create Excel file using SheetJS (xlsx)
      await this._createExcelFile(headers, rows, allLogs.length);
      
      // Log the export
      if (typeof ActivityLogger !== 'undefined') {
        ActivityLogger.log(ActivityConfig.types.ACTIVITY_LOG_EXPORTED, {
          recordCount: allLogs.length,
          filters: this.filters
        });
      }
      
    } catch (error) {
      console.error('[ActivityAdmin] Export error:', error);
      AppDialog.alert('Failed to export: ' + error.message);
    } finally {
      this._showLoading(false);
    }
  },
  
  async _createExcelFile(headers, rows, totalCount) {
    // Check if SheetJS is loaded
    if (typeof XLSX === 'undefined') {
      // Fallback to CSV
      console.warn('SheetJS not loaded, falling back to CSV');
      this._downloadCSV(headers, rows);
      return;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 },  // Date
      { wch: 10 },  // Time
      { wch: 25 },  // User Name
      { wch: 30 },  // User Email
      { wch: 10 },  // Role
      { wch: 10 },  // Class
      { wch: 25 },  // Activity
      { wch: 15 },  // Category
      { wch: 40 },  // Details
      { wch: 30 },  // Page
      { wch: 10 },  // Device
      { wch: 12 },  // Browser
      { wch: 12 }   // OS
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    
    // Add summary sheet
    const summaryData = [
      ['Activity Log Export Summary'],
      [''],
      ['Export Date', new Date().toLocaleDateString('en-GB')],
      ['Export Time', new Date().toLocaleTimeString('en-GB')],
      ['Total Records', totalCount],
      [''],
      ['Filters Applied:'],
      ['Role', this.filters.role || 'All'],
      ['Category', this.filters.category || 'All'],
      ['Activity Type', this.filters.activityType || 'All'],
      ['Date From', this.filters.dateFrom || 'Any'],
      ['Date To', this.filters.dateTo || 'Any'],
      ['Search', this.filters.search || 'None']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Generate filename
    const filename = `activity_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
  },
  
  _downloadCSV(headers, rows) {
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  // ============================================
  // STATS
  // ============================================
  // COUNT THE ROWS, DO NOT DOWNLOAD THEM.
  //
  // These three numbers used to be produced by three `.get()` calls and then
  // reading `.size` - which downloads every matching document in order to
  // count it. For one teacher that is invisible. For a thousand students it is
  // not: at roughly five logged events per student per day, the three queries
  // fetch about 5,000 + 35,000 + 150,000 documents, so ~190,000 reads and
  // ~190,000 documents into the browser EVERY TIME the tab is opened.
  //
  // `count()` is an aggregation: the server returns one number and bills
  // roughly one read per thousand documents scanned. Same three figures, about
  // 190 reads instead of 190,000, and nothing to hold in memory.
  //
  // Falls back to the old path only where count() is unavailable, and caps it
  // so an old SDK degrades to a slightly stale number rather than to a frozen
  // tab.
  async _countSince(date, cap) {
    const col = db.collection(ActivityConfig.settings.collectionName)
      .where('timestamp', '>=', date);
    try {
      if (typeof col.count === 'function') {
        const agg = await col.count().get();
        return agg.data().count;
      }
    } catch (e) {
      console.warn('[ActivityAdmin] count() unavailable, falling back:', e && e.code);
    }
    const snap = await col.limit(cap).get();
    return snap.size === cap ? (cap + '+') : snap.size;
  },

  // ============================================================
  // RETENTION - export, then delete
  // ------------------------------------------------------------
  // `retentionDays: 0` in activity-config.js means keep forever. At 1000
  // students and roughly five logged events each per day that is about 1.8
  // million documents a year, and nothing prunes it. The paginated list and
  // the capped stat tiles both stay fast regardless, so this is about storage
  // and about an audit trail nobody can read past page 40 - not an outage.
  //
  // Deleting an audit log is irreversible, so the order is enforced rather
  // than suggested:
  //
  //   1. COUNT what would go, and show it.
  //   2. Refuse to delete unless the logs have been EXPORTED in this browser
  //      session. "Download it and then delete it" is the whole request, and
  //      a tool that lets you skip step one at 3pm on a Friday is a trap.
  //   3. Require the number of months to be typed back, so a mis-click
  //      cannot start it.
  //   4. Delete in batches with a per-run cap, and report exactly how many
  //      went and how many remain, rather than pretending it finished.
  //
  // Nothing here runs on its own. There is no scheduled deletion.
  // ============================================================

  // Set by exportToExcel() so a delete cannot happen before a download.
  _exportedThisSession: false,

  _cutoffFor(months) {
    const d = new Date();
    d.setMonth(d.getMonth() - Math.max(1, Number(months) || 6));
    return d;
  },

  // How many logs are older than the window. Counted with a capped read,
  // because count() is a modular-SDK API and this app uses the compat build.
  async countOlderThan(months, cap) {
    cap = cap || 5000;
    const snap = await db.collection(ActivityConfig.settings.collectionName)
      .where('timestamp', '<', this._cutoffFor(months))
      .limit(cap)
      .get();
    return { n: snap.size, capped: snap.size === cap, cutoff: this._cutoffFor(months) };
  },

  async pruneOlderThan(months, opts) {
    opts = opts || {};
    const say = (m) => { if (typeof opts.onProgress === 'function') opts.onProgress(m); };

    if (!this._checkAdmin()) return { ok: false, reason: 'not admin' };

    if (!this._exportedThisSession && !opts.iHaveExported) {
      return { ok: false, reason:
        'Export the logs first. Use "Export to Excel" above - this refuses to ' +
        'delete anything that has not been downloaded in this session.' };
    }

    const found = await this.countOlderThan(months);
    if (!found.n) return { ok: true, deleted: 0, remaining: 0, note: 'Nothing is older than that.' };

    const cutoffText = found.cutoff.toISOString().slice(0, 10);
    const typed = opts.confirmedMonths;
    if (String(typed) !== String(months)) {
      return { ok: false, reason:
        'Type ' + months + ' to confirm. This would permanently delete ' +
        (found.capped ? 'at least ' : '') + found.n +
        ' log entries from before ' + cutoffText + '.' };
    }

    // Batched, 400 at a time (Firestore allows 500 per batch), with a cap per
    // run so one click cannot spend an hour deleting.
    const perRun = Math.max(1, Number(opts.maxPerRun) || 2000);
    let deleted = 0;
    while (deleted < perRun) {
      const snap = await db.collection(ActivityConfig.settings.collectionName)
        .where('timestamp', '<', this._cutoffFor(months))
        .limit(Math.min(400, perRun - deleted))
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      say('Deleted ' + deleted + '...');
      if (snap.size < 400) break;
    }

    const left = await this.countOlderThan(months);
    return {
      ok: true, deleted: deleted,
      remaining: left.capped ? (left.n + '+') : left.n,
      cutoff: cutoffText,
      note: left.n ? 'Run it again to continue - this run was capped at ' + perRun + '.'
                   : 'Nothing older than ' + cutoffText + ' is left.'
    };
  },

  // ── The two buttons on the tab ────────────────────────────────
  // From CONFIG, not from a box on the page.
  //
  // The window is a policy decision taken once with the KVKK office, not a
  // per-visit choice, and a number spinner sitting next to a delete button
  // invited someone to nudge it by accident. Changing it is now a one-line
  // edit in activity-config.js, which is where the rest of the settings live.
  _retentionMonths() {
    const n = parseInt((ActivityConfig.settings || {}).retentionMonths, 10);
    return (isFinite(n) && n >= 1) ? n : 6;
  },
  _retentionNote(msg, colour) {
    const el = document.getElementById('activityRetentionNote');
    if (el) { el.textContent = msg; el.style.color = colour || 'var(--t2-text-muted,#7d8590)'; }
  },

  async checkRetention() {
    const months = this._retentionMonths();
    this._retentionNote('Checking...');
    try {
      const r = await this.countOlderThan(months);
      const when = r.cutoff.toISOString().slice(0, 10);
      this._retentionNote(
        r.n
          ? (r.capped ? 'At least ' : '') + r.n + ' log entr' + (r.n === 1 ? 'y is' : 'ies are') +
            ' older than ' + when + '. Export first, then Delete.'
          : 'Nothing is older than ' + when + '. Nothing to delete.',
        r.n ? '#f59e0b' : 'var(--t2-green,#22c55e)');
    } catch (e) {
      this._retentionNote('Could not check: ' + (e && e.message), '#f87171');
    }
  },

  async runPrune() {
    const months = this._retentionMonths();
    // First pass: no typed confirmation, so this returns the refusal that
    // states the count and the cutoff. Nothing is deleted by this call.
    let r = await this.pruneOlderThan(months, {});
    if (!r.ok) {
      const proceed = (window.AppDialog && AppDialog.confirm)
        ? await AppDialog.confirm(r.reason, { title: 'Delete old logs', okLabel: 'Delete', danger: true })
        : confirm(r.reason);
      if (!proceed) { this._retentionNote('Cancelled. Nothing was deleted.'); return; }
      if (/Export the logs first/.test(r.reason)) { this._retentionNote(r.reason, '#f87171'); return; }
      // Confirmed: repeat with the typed number so the guard is satisfied.
      r = await this.pruneOlderThan(months, { confirmedMonths: months,
        onProgress: (m) => this._retentionNote(m) });
    }
    if (!r.ok) { this._retentionNote(r.reason, '#f87171'); return; }
    this._retentionNote(
      'Deleted ' + r.deleted + '. Remaining older than ' + (r.cutoff || 'the cutoff') +
      ': ' + r.remaining + '. ' + (r.note || ''),
      'var(--t2-green,#22c55e)');
    this.loadLogs(false);
    this._updateStats();
  },

  async _updateStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      // In parallel: three counts, not three downloads.
      const [t, w, m] = await Promise.all([
        this._countSince(today, 2000),
        this._countSince(weekAgo, 2000),
        this._countSince(monthAgo, 2000)
      ]);

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      set('activityStatToday', t);
      set('activityStatWeek', w);
      set('activityStatMonth', m);

    } catch (error) {
      console.error('[ActivityAdmin] Error loading stats:', error);
    }
  },
  
  // ============================================
  // UI HELPERS
  // ============================================
  _populateFilters() {
    // Populate role filter
    const roleSelect = document.getElementById('activityFilterRole');
    if (roleSelect) {
      roleSelect.innerHTML = '<option value="">All Roles</option>';
      Object.entries(ActivityConfig.roles).forEach(([key, value]) => {
        roleSelect.innerHTML += `<option value="${key}">${value.icon} ${value.text}</option>`;
      });
    }
    
    // Populate category filter
    const categorySelect = document.getElementById('activityFilterCategory');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      Object.entries(ActivityConfig.categories).forEach(([key, value]) => {
        categorySelect.innerHTML += `<option value="${key}">${value.icon} ${value.text}</option>`;
      });
    }
    
    // Populate activity type filter
    const typeSelect = document.getElementById('activityFilterType');
    if (typeSelect) {
      typeSelect.innerHTML = '<option value="">All Activities</option>';
      Object.entries(ActivityConfig.labels).forEach(([key, value]) => {
        typeSelect.innerHTML += `<option value="${key}">${value.icon} ${value.text}</option>`;
      });
    }
  },
  
  _setupEventListeners() {
    // Search input debounce
    const searchInput = document.getElementById('activitySearchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filters.search = searchInput.value;
          this._applySearchFilter();
          this._renderLogs();
        }, 300);
      });
    }
  },
  
  _showLoading(show) {
    const loader = document.getElementById('activityLogsLoader');
    const list = document.getElementById('activityLogsList');
    if (loader) loader.style.display = show ? 'flex' : 'none';
    if (list && show) list.style.opacity = '0.5';
    if (list && !show) list.style.opacity = '1';
  },
  
  _showError(message) {
    const container = document.getElementById('activityLogsList');
    if (container) {
      container.innerHTML = `
        <div class="activity-empty-state error">
          <div class="activity-empty-icon">❌</div>
          <h3>Error Loading Logs</h3>
          <p>${message}</p>
        </div>
      `;
    }
  },
  
  _updateLoadMoreButton() {
    const btn = document.getElementById('activityLoadMoreBtn');
    if (btn) {
      btn.style.display = this.hasMore ? 'block' : 'none';
    }
  },
  
  loadMore() {
    if (this.hasMore && !this.isLoading) {
      this.loadLogs(true);
    }
  },
  
  _getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
};

// Make globally available
window.ActivityAdmin = ActivityAdmin;
