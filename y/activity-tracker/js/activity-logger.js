/* ============================================
   ACTIVITY TRACKER - Core Logger
   Include this file in all pages to track user activities
   
   Usage:
   await ActivityLogger.log(ActivityConfig.types.LOGIN);
   await ActivityLogger.log(ActivityConfig.types.PRACTICE_COMPLETED, { score: 85, level: 'B1' });
   ============================================ */

const ActivityLogger = {
  
  // ============================================
  // MAIN LOG FUNCTION
  // ============================================
  async log(activityType, details = {}) {
    try {
      // Check if logging is enabled and Firebase is available
      if (!this._isReady()) return null;
      
      // Check if this activity should be skipped
      if (ActivityConfig.settings.skipActivities.includes(activityType)) {
        this._debug('Skipping activity:', activityType);
        return null;
      }
      
      const user = auth.currentUser;
      if (!user) {
        this._debug('No user logged in, skipping log');
        return null;
      }
      
      // Get user info
      const userInfo = await this._getUserInfo(user);
      
      // Get device/browser info
      const deviceInfo = this._getDeviceInfo();
      
      // Get activity label info
      const labelInfo = ActivityConfig.getLabel(activityType);
      
      // Build the log document
      const logData = {
        // User info
        userId: user.uid,
        userEmail: user.email,
        userName: userInfo.name,
        userRole: userInfo.role,
        userClass: userInfo.studentClass || null,
        
        // Activity info
        activityType: activityType,
        activityLabel: labelInfo.text,
        activityIcon: labelInfo.icon,
        category: labelInfo.category,
        
        // Details (custom data passed in)
        details: details,
        
        // Context
        page: window.location.pathname,
        pageTitle: document.title,
        
        // Device info
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screenSize: deviceInfo.screenSize,
        
        // Timestamps
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        timestampLocal: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // Save to Firestore
      const docRef = await db.collection(ActivityConfig.settings.collectionName).add(logData);
      
      this._debug('Activity logged:', activityType, docRef.id);
      
      return docRef.id;
      
    } catch (error) {
      console.error('[ActivityLogger] Error logging activity:', error);
      return null;
    }
  },
  
  // ============================================
  // QUICK LOG METHODS
  // ============================================
  
  // Authentication
  async logLogin() {
    return this.log(ActivityConfig.types.LOGIN);
  },
  
  async logLogout() {
    return this.log(ActivityConfig.types.LOGOUT);
  },
  
  async logRegistration(details = {}) {
    return this.log(ActivityConfig.types.REGISTRATION, details);
  },
  
  // Student activities
  async logPracticeStarted(details = {}) {
    return this.log(ActivityConfig.types.PRACTICE_STARTED, details);
  },
  
  async logPracticeCompleted(details = {}) {
    return this.log(ActivityConfig.types.PRACTICE_COMPLETED, details);
  },
  
  async logAssignmentStarted(details = {}) {
    return this.log(ActivityConfig.types.ASSIGNMENT_STARTED, details);
  },
  
  async logAssignmentCompleted(details = {}) {
    return this.log(ActivityConfig.types.ASSIGNMENT_COMPLETED, details);
  },
  
  // Teacher activities
  async logAssignmentCreated(details = {}) {
    return this.log(ActivityConfig.types.ASSIGNMENT_CREATED, details);
  },
  
  async logAssignmentEdited(details = {}) {
    return this.log(ActivityConfig.types.ASSIGNMENT_EDITED, details);
  },
  
  async logAssignmentDeleted(details = {}) {
    return this.log(ActivityConfig.types.ASSIGNMENT_DELETED, details);
  },
  
  async logStudentEdited(details = {}) {
    return this.log(ActivityConfig.types.STUDENT_EDITED, details);
  },
  
  async logStudentDeleted(details = {}) {
    return this.log(ActivityConfig.types.STUDENT_DELETED, details);
  },
  
  async logReportExported(details = {}) {
    return this.log(ActivityConfig.types.REPORT_EXPORTED, details);
  },
  
  // Admin activities
  async logTeacherAdded(details = {}) {
    return this.log(ActivityConfig.types.TEACHER_ADDED, details);
  },
  
  async logTeacherRemoved(details = {}) {
    return this.log(ActivityConfig.types.TEACHER_REMOVED, details);
  },
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  _isReady() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') {
      this._debug('Firebase not initialized');
      return false;
    }
    if (typeof ActivityConfig === 'undefined') {
      console.warn('[ActivityLogger] ActivityConfig not loaded');
      return false;
    }
    return true;
  },
  
  async _getUserInfo(user) {
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        return {
          name: data.name || user.email,
          role: data.role || 'unknown',
          studentClass: data.studentClass || null
        };
      }
    } catch (e) {
      this._debug('Could not fetch user data:', e);
    }
    return { name: user.email, role: 'unknown', studentClass: null };
  },
  
  _getDeviceInfo() {
    const ua = navigator.userAgent;
    
    // Detect device type
    let device = 'Desktop';
    if (/Mobi|Android/i.test(ua)) device = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
    
    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    
    // Detect OS
    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    return {
      device,
      browser,
      os,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: ua
    };
  },
  
  _debug(...args) {
    if (ActivityConfig.settings.debugMode) {
      console.log('[ActivityLogger]', ...args);
    }
  }
};

// Make it globally available
window.ActivityLogger = ActivityLogger;

// ============================================
// AUTO-LOG PAGE VIEWS (Optional)
// ============================================
// Uncomment below to automatically log page views
/*
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (auth.currentUser) {
      ActivityLogger.log('page_view', { page: window.location.pathname });
    }
  }, 1000);
});
*/
