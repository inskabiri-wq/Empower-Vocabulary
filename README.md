# Empower Vocabulary Trainer - Firebase Edition

A complete vocabulary training system with user authentication, progress tracking, and dashboards.

## 📁 Files Included

| File | Purpose |
|------|---------|
| `index.html` | Login & Registration page |
| `app.html` | Main vocabulary trainer app |
| `student-dashboard.html` | Student progress dashboard |
| `teacher-dashboard.html` | Teacher admin dashboard |

## 🚀 Deployment Options

### Option 1: Firebase Hosting (Recommended - FREE)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize your project**
   ```bash
   mkdir vocab-trainer
   cd vocab-trainer
   # Copy all 4 HTML files here
   firebase init hosting
   ```
   - Select your Firebase project: `empower-vocabulary-practice`
   - Public directory: `.` (current folder)
   - Single-page app: No
   - Overwrite index.html: No

4. **Deploy**
   ```bash
   firebase deploy
   ```

5. **Your app will be live at:**
   `https://empower-vocabulary-practice.web.app`

### Option 2: Google Sites Embedding

You can embed individual pages in Google Sites:
1. Upload HTML files to Google Drive or GitHub
2. In Google Sites, add an "Embed" block
3. Paste the URL of your hosted HTML file

### Option 3: GitHub Pages (FREE)

1. Create a new GitHub repository
2. Upload all 4 HTML files
3. Go to Settings → Pages
4. Select branch: `main`, folder: `/ (root)`
5. Your app will be at: `https://yourusername.github.io/repo-name`

## ⚙️ Firebase Configuration

Your Firebase project is already configured in all files:
- Project ID: `empower-vocabulary-practice`
- Auth: Email/Password + Google Sign-in enabled
- Database: Firestore

### Security Rules (Important!)

Go to Firebase Console → Firestore → Rules and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Teachers can read all student data
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    // Sessions - users can create their own, teachers can read all
    match /sessions/{sessionId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher'
      );
    }
  }
}
```

## 📱 Features

### For Students
- ✅ Login with email or Google
- ✅ 3 practice activities: Multiple Choice, Match, Spelling
- ✅ 4 CEFR levels: A2, B1, B1+, B2
- ✅ Progress tracking with streaks
- ✅ Personal dashboard with achievements
- ✅ Turkish translations for A2

### For Teachers
- ✅ View all students in their university
- ✅ Monitor activity and performance
- ✅ See level distribution
- ✅ Export student data to CSV
- ✅ Real-time activity feed

## 🎨 Customization

### Adding Your Full Vocabulary List

In `app.html`, find the `vocabularyData` object and replace with your 2,679 words:

```javascript
const vocabularyData = {
  A2: [
    {word: "happy", def: "feeling pleased", pos: "adj", tr: "mutlu"},
    // ... add all A2 words
  ],
  B1: [
    // ... B1 words
  ],
  // etc.
};
```

### Changing Colors

Edit the CSS variables in `:root` at the top of each file:

```css
:root {
  --accent-primary: #6366f1;    /* Main accent color */
  --accent-secondary: #8b5cf6;  /* Secondary accent */
  --success: #10b981;           /* Correct answers */
  --error: #ef4444;             /* Wrong answers */
}
```

### Adding Your University Logo

Add an `<img>` tag in the header sections.

## 🔧 Troubleshooting

**"Permission denied" errors:**
- Make sure Firestore rules are set correctly
- Check that authentication is enabled in Firebase Console

**Google Sign-in not working:**
- Enable Google provider in Firebase → Authentication → Sign-in method
- Add your domain to authorized domains

**Data not saving:**
- Check browser console for errors
- Verify Firestore rules allow writes

## 📞 Support

For issues with Firebase setup:
- Firebase Documentation: https://firebase.google.com/docs
- Firebase Console: https://console.firebase.google.com

## 📄 License

Free for educational use.
