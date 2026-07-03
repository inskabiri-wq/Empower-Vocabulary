# 2026-06-23 - App rename: Lingualab -> Lingualab

The visible application name is now "Lingualab" everywhere in the deployed app.
"under no circumstances ... empower lab anymore" - done for the app name.

## Renamed (50+ files): visible name + comments
- "Lingualab" / "EMPOWER LAB" -> "Lingualab" / "LINGUALAB" (43 + 2)
- "Empower Vocabulary Trainer" -> "Lingualab" (13)  (mostly JS file headers)
- "Empower Vocabulary" -> "Lingualab" (8); "Empower Vocab" -> "Lingualab" (1)
- "Empower Write" / "EMPOWER WRITE" -> "Lingualab Write" (2 + 4)
- manifest.json name + short_name = "Lingualab"; page <title>s; SW header;
  issue-tracker.csv title; join.html title (untracked, fixed separately).
- Done by an audited Node script over git-tracked text files (then a
  filesystem re-scan caught the 2 untracked/odd-extension stragglers).

## Deliberately KEPT (functional or not the app name)
- `empower-vocabulary-practice` - the Firebase PROJECT ID (authDomain,
  storageBucket, projectId). IMMUTABLE: it must match the real Firebase
  project, and Firebase project IDs cannot be renamed. Changing the string
  would break auth + Firestore. (22 files, untouched.)
- `empower-shell-` - the service-worker CACHE prefix (internal key). Untouched.
- `empower-vocabulary-functions` - the functions npm package name (internal).
- The `'empower'` BOOK KEY (`bookFiles`, `sess.book`, `assignmentBook` value)
  and the "Empower" vs "Gateway" book DISPLAY names. "Empower" here is the
  Cambridge **Empower coursebook** (a real textbook), NOT the app. Renaming it
  would mislabel the book + break book selection / saved sessions. Untouched.
- `empower-write/` FOLDER PATH (kept so links resolve; the visible "Empower
  Write" title was changed to "Lingualab Write").
- `y/.tmp/` design mockups - not deployed (hosting ignores dotfiles).

## FLAGGED for the user (need a decision / external)
- Tagline "Empower Your English" (index.html): "Empower" is used as a VERB
  here, so it is not a mechanical swap. Left as-is pending a replacement line
  (e.g. "Master Your English"). Tell me the wording and I will change it.
- "Empower Preparatory Program" (reset-password.html footer): left as-is - is
  that a real program name or app branding?
- The Cambridge "Empower" coursebook label (above) - confirm you want it kept.
- EXTERNAL (I cannot reach): the Firebase console project DISPLAY name; the
  funding-proposal .docx on the Desktop (title + filename still say Empower
  Lab); any Google Drive docs. Say the word and I will update the local docx.

## Verification
- node --check OK on all changed JS. Replacement text is plain ("Lingualab"),
  no em dashes introduced (the SW header's em dash is pre-existing).
- Filesystem scan: zero "Lingualab/Vocabulary/Write" in deployed files.
- REAL-browser smoke (preview): index.html title = "Lingualab - Login", page
  shows "Lingualab", no "Lingualab/Vocabulary" visible.
- Caching: the SW CACHE_VERSION is already at v66 (this deploy); the version
  bump purges old caches so EVERY asset (versioned + unversioned) is re-fetched,
  and HTML is network-first, so returning users see "Lingualab" on next deploy.

## Not done
- No deploy. No push.
