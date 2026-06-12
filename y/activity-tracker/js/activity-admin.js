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
    
    // Log that admin viewed activity log
    if (typeof ActivityLogger !== 'undefined') {
      ActivityLogger.log(ActivityConfig.types.ACTIVITY_LOG_VIEWED);
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
          <div class="activity-log-header">
            <span class="activity-log-action">${labelInfo.text}</span>
            <span class="activity-log-category" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color};">
              ${categoryInfo.text}
            </span>
          </div>
          <div class="activity-log-user">
            <span class="user-role-icon">${roleIcon}</span>
            <span class="user-name">${escapeHtml(log.userName) || escapeHtml(log.userEmail)}</span>
            ${log.userClass ? `<span class="user-class">(${escapeHtml(log.userClass)})</span>` : ''}
          </div>
          ${detailsHtml}
          <div class="activity-log-meta">
            <span class="meta-item">🕐 ${timeAgo}</span>
            <span class="meta-item">📅 ${timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="meta-item">💻 ${log.device || 'Unknown'} • ${log.browser || 'Unknown'}</span>
          </div>
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
  async _updateStats() {
    try {
      // Get today's count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySnap = await db.collection(ActivityConfig.settings.collectionName)
        .where('timestamp', '>=', today)
        .get();
      
      document.getElementById('activityStatToday').textContent = todaySnap.size;
      
      // Get this week's count
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      
      const weekSnap = await db.collection(ActivityConfig.settings.collectionName)
        .where('timestamp', '>=', weekAgo)
        .get();
      
      document.getElementById('activityStatWeek').textContent = weekSnap.size;
      
      // Get total count (approximation - last 30 days)
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      
      const monthSnap = await db.collection(ActivityConfig.settings.collectionName)
        .where('timestamp', '>=', monthAgo)
        .get();
      
      document.getElementById('activityStatMonth').textContent = monthSnap.size;
      
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
