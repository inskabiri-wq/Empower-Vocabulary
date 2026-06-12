/* ============================================
   ACTIVITY TRACKER - Configuration
   All activity types and settings in one place
   Easy to extend - just add new entries!
   ============================================ */

const ActivityConfig = {
  
  // ============================================
  // ACTIVITY TYPES - Add new types here
  // ============================================
  types: {
    // Authentication
    LOGIN: 'login',
    LOGOUT: 'logout',
    REGISTRATION: 'registration',
    
    // Student Activities
    PRACTICE_STARTED: 'practice_started',
    PRACTICE_COMPLETED: 'practice_completed',
    ASSIGNMENT_STARTED: 'assignment_started',
    ASSIGNMENT_COMPLETED: 'assignment_completed',
    PROFILE_UPDATED: 'profile_updated',
    SETTINGS_CHANGED: 'settings_changed',
    
    // Teacher Activities
    ASSIGNMENT_CREATED: 'assignment_created',
    ASSIGNMENT_EDITED: 'assignment_edited',
    ASSIGNMENT_DELETED: 'assignment_deleted',
    ASSIGNMENT_GRADED: 'assignment_graded',     // Writing essay graded
    ASSIGNMENT_RETURNED: 'assignment_returned', // Writing essay returned for revision
    ASSIGNMENT_SUBMITTED: 'assignment_submitted', // Student turned in a writing essay
    STUDENT_VIEWED: 'student_viewed',
    STUDENT_EDITED: 'student_edited',
    STUDENT_DELETED: 'student_deleted',
    REPORT_EXPORTED: 'report_exported',
    DASHBOARD_ACCESSED: 'dashboard_accessed',
    CLASS_SESSION_CREATED: 'class_session_created',
    CLASS_SESSION_ENDED: 'class_session_ended',
    
    // Admin Activities
    TEACHER_ADDED: 'teacher_added',
    TEACHER_REMOVED: 'teacher_removed',
    TEACHER_UPDATED: 'teacher_updated',
    SYSTEM_SETTINGS_CHANGED: 'system_settings_changed',
    ACTIVITY_LOG_EXPORTED: 'activity_log_exported',
    ACTIVITY_LOG_VIEWED: 'activity_log_viewed'
  },
  
  // ============================================
  // LABELS & ICONS - Display text for each type
  // ============================================
  labels: {
    login: { text: 'Login', icon: '🔑', category: 'auth' },
    logout: { text: 'Logout', icon: '🚪', category: 'auth' },
    registration: { text: 'Registration', icon: '📝', category: 'auth' },
    
    practice_started: { text: 'Practice Started', icon: '▶️', category: 'student' },
    practice_completed: { text: 'Practice Completed', icon: '✅', category: 'student' },
    assignment_started: { text: 'Assignment Started', icon: '📋', category: 'student' },
    assignment_completed: { text: 'Assignment Completed', icon: '🎯', category: 'student' },
    profile_updated: { text: 'Profile Updated', icon: '👤', category: 'student' },
    settings_changed: { text: 'Settings Changed', icon: '⚙️', category: 'student' },
    
    assignment_created: { text: 'Assignment Created', icon: '➕', category: 'teacher' },
    assignment_edited: { text: 'Assignment Edited', icon: '✏️', category: 'teacher' },
    assignment_deleted: { text: 'Assignment Deleted', icon: '🗑️', category: 'teacher' },
    assignment_graded:   { text: 'Essay Graded',   icon: '🎓', category: 'teacher' },
    assignment_returned: { text: 'Essay Returned', icon: '🔄', category: 'teacher' },
    assignment_submitted:{ text: 'Essay Submitted', icon: '✍️', category: 'student' },
    student_viewed: { text: 'Student Viewed', icon: '👁️', category: 'teacher' },
    student_edited: { text: 'Student Edited', icon: '✏️', category: 'teacher' },
    student_deleted: { text: 'Student Deleted', icon: '🗑️', category: 'teacher' },
    report_exported: { text: 'Report Exported', icon: '📥', category: 'teacher' },
    dashboard_accessed: { text: 'Dashboard Accessed', icon: '📊', category: 'teacher' },
    class_session_created: { text: 'Class Session Created', icon: '🎮', category: 'teacher' },
    class_session_ended: { text: 'Class Session Ended', icon: '🏁', category: 'teacher' },
    
    teacher_added: { text: 'Teacher Added', icon: '👨‍🏫', category: 'admin' },
    teacher_removed: { text: 'Teacher Removed', icon: '❌', category: 'admin' },
    teacher_updated: { text: 'Teacher Updated', icon: '✏️', category: 'admin' },
    system_settings_changed: { text: 'System Settings Changed', icon: '🔧', category: 'admin' },
    activity_log_exported: { text: 'Activity Log Exported', icon: '📤', category: 'admin' },
    activity_log_viewed: { text: 'Activity Log Viewed', icon: '📋', category: 'admin' }
  },
  
  // ============================================
  // CATEGORIES - For filtering
  // ============================================
  categories: {
    auth: { text: 'Authentication', icon: '🔐', color: '#3b82f6' },
    student: { text: 'Student Actions', icon: '🎓', color: '#10b981' },
    teacher: { text: 'Teacher Actions', icon: '👨‍🏫', color: '#f59e0b' },
    admin: { text: 'Admin Actions', icon: '👑', color: '#ef4444' }
  },
  
  // ============================================
  // ROLES
  // ============================================
  roles: {
    student: { text: 'Student', icon: '🎓' },
    teacher: { text: 'Teacher', icon: '👨‍🏫' },
    admin: { text: 'Admin', icon: '👑' }
  },
  
  // ============================================
  // SETTINGS
  // ============================================
  settings: {
    // Collection name in Firestore
    collectionName: 'activityLogs',
    
    // How many days to keep logs (0 = forever)
    retentionDays: 0,
    
    // Max logs to load at once
    pageSize: 50,
    
    // Enable console logging for debugging
    debugMode: false,
    
    // Activities to skip logging (if needed)
    skipActivities: []
  },
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  // Get label info for an activity type
  getLabel(type) {
    return this.labels[type] || { text: type, icon: '📌', category: 'other' };
  },
  
  // Get category info
  getCategory(categoryKey) {
    return this.categories[categoryKey] || { text: 'Other', icon: '📌', color: '#64748b' };
  },
  
  // Get all activity types as array for dropdowns
  getTypesArray() {
    return Object.entries(this.labels).map(([key, value]) => ({
      value: key,
      text: `${value.icon} ${value.text}`,
      category: value.category
    }));
  },
  
  // Get all categories as array for dropdowns
  getCategoriesArray() {
    return Object.entries(this.categories).map(([key, value]) => ({
      value: key,
      text: `${value.icon} ${value.text}`
    }));
  }
};

// Make it globally available
window.ActivityConfig = ActivityConfig;
