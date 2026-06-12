/**
 * FSM Vocabulary Trainer — Emoji Avatar System
 * Zero API, zero images, works offline, instant load.
 */

const AVATAR_MAP = {
  fox:       { emoji: '🦊', color: '#fff3e0' },
  panda:     { emoji: '🐼', color: '#e8f5e9' },
  lion:      { emoji: '🦁', color: '#fff8e1' },
  owl:       { emoji: '🦉', color: '#efebe9' },
  butterfly: { emoji: '🦋', color: '#f3e5f5' },
  dolphin:   { emoji: '🐬', color: '#e1f5fe' },
  unicorn:   { emoji: '🦄', color: '#fce4ec' },
  rocket:    { emoji: '🚀', color: '#e8eaf6' },
  penguin:   { emoji: '🐧', color: '#eceff1' },
  star:      { emoji: '⭐', color: '#fffde7' },
  dragon:    { emoji: '🐲', color: '#e8f5e9' },
  cat:       { emoji: '🐱', color: '#fbe9e7' },
  crown:     { emoji: '👑', color: '#fff8e1' },
  phoenix:   { emoji: '🔥', color: '#fbe9e7' },
  alien:     { emoji: '👾', color: '#ede7f6' },
  diamond:   { emoji: '💎', color: '#e0f7fa' }
};

const DEFAULT_AVATAR = 'fox';

// userProfile is already declared in config.js (loaded before this file)
// Just ensure the avatar field has a default
if (typeof userProfile !== 'undefined') {
  userProfile.avatar = userProfile.avatar || DEFAULT_AVATAR;
}

// ─── Select avatar ────────────────────────────────────────────────────────────
function selectAvatar(el) {
  if (!el) return;
  const unlockXP = parseInt(el.dataset.unlock) || 0;
  if (el.classList.contains('locked') && userProfile.xp < unlockXP) {
    showToast('🔒 Unlock at ' + unlockXP.toLocaleString() + ' XP!');
    return;
  }
  document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  userProfile.avatar = el.dataset.avatar;
  updateAvatarDisplays();
  saveAvatarToFirebase();
}

// ─── Update header + preview emoji ────────────────────────────────────────────
function updateAvatarDisplays() {
  const av = AVATAR_MAP[userProfile.avatar] || AVATAR_MAP[DEFAULT_AVATAR];

  // Header badge
  const display = document.getElementById('avatarDisplay');
  const emoji   = document.getElementById('avatarDisplayEmoji');
  if (display) display.style.background = av.color;
  if (emoji)   emoji.textContent = av.emoji;

  // Modal preview
  const preview     = document.getElementById('avatarPreview');
  const previewEmoji = document.getElementById('avatarPreviewEmoji');
  if (preview)      preview.style.background = av.color;
  if (previewEmoji) previewEmoji.textContent = av.emoji;

  // Dashboard welcome banner (design v2)
  const welcomeAv = document.getElementById('welcomeAvatar');
  if (welcomeAv) welcomeAv.textContent = av.emoji;
}

// ─── Highlight selected in grid ───────────────────────────────────────────────
function updateSelectedAvatarInGrid() {
  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.avatar === userProfile.avatar);
  });
}

// ─── Unlock locked avatars based on XP ────────────────────────────────────────
function checkAvatarUnlocks() {
  document.querySelectorAll('.avatar-option.locked').forEach(opt => {
    const needed = parseInt(opt.dataset.unlock) || 0;
    if (userProfile.xp >= needed) {
      opt.classList.remove('locked');
      opt.classList.add('unlocked');
      const badge = opt.querySelector('.lock-badge');
      if (badge) badge.remove();
    }
  });
}

// ─── Full profile display refresh ─────────────────────────────────────────────
function updateProfileDisplay() {
  updateAvatarDisplays();
  updateSelectedAvatarInGrid();
  checkAvatarUnlocks();

  const el = id => document.getElementById(id);

  if (el('profileXPLevel')) el('profileXPLevel').textContent = userProfile.level;
  if (el('profileXP'))      el('profileXP').textContent      = userProfile.xp;

  if (typeof auth !== 'undefined' && auth.currentUser) {
    const name = auth.currentUser.displayName
              || auth.currentUser.email?.split('@')[0]
              || 'Student';
    if (el('profileName')) el('profileName').textContent = name;
    if (el('previewName')) el('previewName').textContent = name;
    // Dashboard welcome banner (design v2)
    if (el('welcomeName')) el('welcomeName').textContent = name;
  }

  if (el('previewLevel')) el('previewLevel').textContent = userProfile.level;
  if (el('previewXP'))    el('previewXP').textContent    = userProfile.xp % 100;
  if (el('previewXPMax')) el('previewXPMax').textContent  = 100;
  if (el('xpFill'))       el('xpFill').style.width       = (userProfile.xp % 100) + '%';

  if (typeof updateAchievements === 'function') updateAchievements();
  if (typeof updateLevelDisplay  === 'function') updateLevelDisplay();
}

// ─── Firebase save/load ───────────────────────────────────────────────────────
async function saveAvatarToFirebase() {
  if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) return;
  try {
    await db.collection('users').doc(auth.currentUser.uid).update({
      avatar: userProfile.avatar,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { console.error('Error saving avatar:', e); }
}

function loadAvatarFromFirebase(userData) {
  if (userData) {
    userProfile.avatar       = userData.avatar       || DEFAULT_AVATAR;
    userProfile.xp           = userData.xp           || 0;
    userProfile.level        = Math.floor(userProfile.xp / 100) + 1;
    userProfile.achievements = userData.achievements || [];
  }
  updateProfileDisplay();
}

// ─── XP system ────────────────────────────────────────────────────────────────
function addXP(amount) {
  const oldLevel = userProfile.level;
  userProfile.xp   += amount;
  userProfile.level = Math.floor(userProfile.xp / 100) + 1;
  if (userProfile.level > oldLevel) {
    showToast('🎉 Level Up! You\'re now Level ' + userProfile.level + '!');
    checkAvatarUnlocks();
  }
  updateProfileDisplay();
  saveXPToFirebase();
}

async function saveXPToFirebase() {
  if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) return;
  try {
    await db.collection('users').doc(auth.currentUser.uid).update({
      xp: userProfile.xp, level: userProfile.level,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { console.error('Error saving XP:', e); }
}

// ─── Init — avatar grid clicks via delegation ────────────────────────────────
(function initAvatarSystem() {
  function setup() {
    const grid = document.getElementById('avatarGrid');
    if (grid) {
      grid.addEventListener('click', function(e) {
        var opt = e.target.closest('.avatar-option');
        if (opt) selectAvatar(opt);
      });
    }
    checkAvatarUnlocks();
    updateAvatarDisplays();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
