/* ============================================================
   PROFILE HUB - the avatar picture is the way into everything
   ------------------------------------------------------------
   One entry point, on every page a signed-in student works in. Clicking the
   round avatar opens a panel holding:

     Choose avatar        own pop-up, X to close
     Your achievements    own pop-up, X to close
     Display settings     opens the shared app-settings panel ON TOP
     Change password      only where window.openChangePassword exists
     Teacher Dashboard    teachers only, never built for a student
     Log out

   The gear and the Logout button stop being separate header items. This is the
   only way to reach them.

   There is no "Save profile" row: choosing an avatar saves immediately, and
   the password has its own flow, so the button had nothing left to save.

   WHY IT IS ONE FILE
   The profile modal used to be ~140 lines of markup inside
   student-dashboard.html. Putting that on twelve more pages by copying it
   would have produced thirteen copies that drift apart within a week. This
   injects the markup instead, so every page is the same by construction.

   WHAT IT COSTS
   Nothing on a normal page load. The profile is cached in localStorage and
   painted from that immediately; Firestore is only read when the cache is
   missing. Without this, putting the panel on twelve pages would have meant
   twelve extra reads per student per session.

   IDS ARE DELIBERATE
   #avatarGrid, .avatar-option, #previewName and friends keep the names the
   dashboard already uses, because student/js/avatar.js binds to them by id and
   by class. Change them and the dashboard's avatar picker stops working.
   ============================================================ */
(function () {
  'use strict';
  if (window.ProfileHub) return;                 // singleton

  var CACHE_KEY   = 'll-profile';
  var ROLE_KEY    = 'll-role';                   // shared with teacher-return.js
  var STYLE_ID    = 'ph-style';

  // Extracted verbatim from the dashboard's grid, so the choice is identical.
  var AVATARS = [
    { id:'fox',       emoji:'🦊', bg:'#fff3e0', name:'Fox',       unlock:0 },
    { id:'panda',     emoji:'🐼', bg:'#e8f5e9', name:'Panda',     unlock:0 },
    { id:'lion',      emoji:'🦁', bg:'#fff8e1', name:'Lion',      unlock:0 },
    { id:'owl',       emoji:'🦉', bg:'#efebe9', name:'Owl',       unlock:0 },
    { id:'butterfly', emoji:'🦋', bg:'#f3e5f5', name:'Butterfly', unlock:0 },
    { id:'dolphin',   emoji:'🐬', bg:'#e1f5fe', name:'Dolphin',   unlock:0 },
    { id:'unicorn',   emoji:'🦄', bg:'#fce4ec', name:'Unicorn',   unlock:0 },
    { id:'rocket',    emoji:'🚀', bg:'#e8eaf6', name:'Rocket',    unlock:0 },
    { id:'penguin',   emoji:'🐧', bg:'#eceff1', name:'Penguin',   unlock:0 },
    { id:'star',      emoji:'⭐',       bg:'#fffde7', name:'Star',      unlock:0 },
    { id:'dragon',    emoji:'🐲', bg:'#e8f5e9', name:'Dragon',    unlock:0 },
    { id:'cat',       emoji:'🐱', bg:'#fbe9e7', name:'Cat',       unlock:0 },
    { id:'crown',     emoji:'👑', bg:'#fff8e1', name:'Crown',     unlock:500 },
    { id:'phoenix',   emoji:'🔥', bg:'#fbe9e7', name:'Phoenix',   unlock:1000 },
    { id:'alien',     emoji:'👾', bg:'#ede7f6', name:'Alien',     unlock:2000 },
    { id:'diamond',   emoji:'💎', bg:'#e0f7fa', name:'Diamond',   unlock:5000 }
  ];
  var ACHIEVEMENTS = [
    { icon:'🎯', name:'First Steps',  desc:'Complete your first activity' },
    { icon:'🔥', name:'On Fire',      desc:'Get a 10 streak' },
    { icon:'📚', name:'Bookworm',     desc:'Learn 100 words' },
    { icon:'⚡',       name:'Speed Demon',  desc:'Answer 20 in a row under 3s each' }
  ];

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function avatarOf(id) {
    for (var i = 0; i < AVATARS.length; i++) if (AVATARS[i].id === id) return AVATARS[i];
    return AVATARS[0];
  }

  // ── Profile data ─────────────────────────────────────────────────────────
  var profile = null;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
    } catch (_) { return null; }
  }
  // Only ever cache a profile whose name is real, and stamp whose it is.
  //
  // The key is one global 'll-profile', so without the stamp the next account to
  // sign in on a shared device paints the previous student's name until its own
  // read lands. Signing out clears the key, but that only covers the paths that
  // go through the Log out row.
  function writeCache(p, uid) {
    if (!p || !p.named) return;
    try {
      var copy = {}; for (var k in p) if (p.hasOwnProperty(k)) copy[k] = p[k];
      if (uid) copy.uid = uid;
      localStorage.setItem(CACHE_KEY, JSON.stringify(copy));
    } catch (_) {}
  }

  // Shape whatever we can see into the one object the UI reads.
  function fromUserDoc(d) {
    if (!d || typeof d !== 'object') return null;
    var prof = d.profile || {};
    var nm = d.name || d.displayName || prof.name || '';
    return {
      // Whether a REAL name was found, as opposed to the placeholder below.
      //
      // Callers must not treat a placeholder as a resolved profile. This
      // function returns an object for ANY object it is given, so a doc that
      // arrived empty or half-written used to look exactly like a successful
      // read: the caller stopped looking AND wrote "Student" into the cache,
      // which then painted on every later load. A wrong name that survives the
      // network problem that caused it is much worse than a slow one.
      named:  !!nm,
      name:   nm || 'Student',
      avatar: prof.avatar || d.avatar || 'fox',
      // Field names as the roster actually writes them - see the chip block in
      // student/js/auth.js. `academicYear` is the real one; `year` was a guess.
      cls:    d.studentClass || d.class || '',
      level:  d.level || d.studentLevel || '',
      module: d.module || d.studentModule || '',
      year:   d.academicYear || d.year || '',
      role:   typeof d.role === 'string' ? d.role : '',
      // Marks the stakeholder demo logins. Used only to withhold the support
      // row - the rules are what actually stop the write.
      demoAccount: d.demoAccount === true
    };
  }

  // FIRESTORE, RESOLVED PROPERLY.
  //
  // Everything here used to read `window.db`, and NOTHING IN THE APP EVER SETS
  // IT. Every file declares its own `const db = firebase.firestore()` inside a
  // scope, and a top-level `const` does not become a window property. The
  // comment further down claiming "firebase-config assigns window.db" is
  // simply wrong.
  //
  // It went unnoticed because the profile name comes from
  // window.currentStudentData, not from this - so the badge looked right while
  // every db path here was dead. Choosing an avatar therefore never persisted,
  // and the support message box reported "You are not signed in" on the
  // teacher dashboard.
  function fdb() {
    if (window.db) return window.db;
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore();
    } catch (e) {}
    return null;
  }

  function currentUid() {
    try {
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      return a && a.currentUser ? a.currentUser.uid : null;
    } catch (_) { return null; }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  // Self-contained and scoped under .ph-*, so the twelve pages that never had
  // this UI do not need the dashboard's stylesheet. The few legacy class names
  // kept for avatar.js (.avatar-option, .avatar-emoji) are styled through a
  // .ph- ancestor, which outranks the dashboard's bare-class rules and stops
  // the two definitions fighting on the one page that has both.
  function injectStyle() {
    if (byId(STYLE_ID)) return;
    var css = [
      '.ph-badge{display:inline-flex;align-items:center;gap:10px;background:var(--bg-item,rgba(28,42,66,.8));',
      'border:1px solid var(--border-color,rgba(59,130,246,.25));border-radius:999px;padding:5px 14px 5px 5px;',
      'cursor:pointer;font:inherit;color:inherit;max-width:260px;}',
      '.ph-badge:hover{border-color:var(--accent-primary,#3b82f6);}',
      '.ph-badge-pic{width:38px;height:38px;min-width:38px;border-radius:50%;display:flex;align-items:center;',
      'justify-content:center;font-size:20px;line-height:1;}',
      '.ph-badge-txt{display:flex;flex-direction:column;align-items:flex-start;min-width:0;}',
      '.ph-badge-name{font-weight:700;font-size:.92em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}',
      '.ph-badge-sub{font-size:.76em;opacity:.75;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}',
      // Last-resort fallback only. Every page names its mount point, and the
      // page sweep fails one that does not, because a badge pinned over the
      // corner is not a header control.
      '.ph-badge.ph-float{position:fixed;top:14px;right:14px;z-index:9990;box-shadow:0 8px 24px rgba(0,0,0,.25);}',
      // Hold the right-hand edge, and never push the header into a second row.
      '[data-profile-hub-mount]{margin-left:auto;display:inline-flex;align-items:center;}',

      // On a phone the name and the module line have nowhere to go: the badge
      // wrapped under the Lingualab title instead of staying top right. Below
      // 620px it collapses to the picture alone, which is the part that is
      // actually the button. The name is in the panel it opens.
      '@media (max-width:620px){',
      '  .ph-badge{padding:3px;gap:0;max-width:none;border-radius:50%;}',
      '  .ph-badge .ph-badge-txt{display:none;}',
      '  .ph-badge-pic{width:34px;height:34px;min-width:34px;font-size:18px;}',
      '}',

      // Panel + pop-ups reuse .modal-overlay and .ll-dialog from css/brand.css,
      // so they are the same shape and motion as every other dialog.
      // The panel needs its OWN colour. .ll-dialog in brand.css deliberately
      // carries shape and motion only, so without this the card had no
      // background at all and the blurred page showed straight through it -
      // which is why it looked washed out and its edges were hard to find.
      '.ph-panel{background:var(--bg-card,#fff);border:1px solid var(--border-color,rgba(59,130,246,.25));',
      'box-shadow:0 24px 70px rgba(0,0,0,.28);color:var(--text-primary,#0f172a);}',

      '.ph-list{display:flex;flex-direction:column;gap:8px;margin-top:18px;}',
      // box-sizing and the reset properties matter: one row is an <a> (the
      // teacher link) and the rest are <button>s, and the two disagree by
      // default on box model, font and margin. The teacher row rendered wider
      // than its neighbours with different padding until these were pinned.
      '.ph-row{display:flex;align-items:center;gap:12px;box-sizing:border-box;',
      'width:100%;max-width:100%;margin:0;padding:12px 14px;border-radius:12px;',
      'background:var(--bg-item,rgba(28,42,66,.8));border:1px solid var(--border-color,rgba(59,130,246,.2));',
      'color:inherit;font-family:inherit;font-size:1em;font-weight:600;line-height:1.3;',
      'cursor:pointer;text-align:left;text-decoration:none;appearance:none;-webkit-appearance:none;}',
      // display:flex above is an AUTHOR rule and beats the browser's own
      // [hidden]{display:none}, so setting .hidden on a row did nothing at all
      // and the Teacher Dashboard row stayed visible to students. Rows are not
      // built unless they apply now, and this is the belt to that braces.
      '.ph-row[hidden]{display:none !important;}',
      '.ph-row:hover{border-color:var(--accent-primary,#3b82f6);}',
      '.ph-row .ph-ico{font-size:19px;line-height:1;width:24px;text-align:center;}',
      '.ph-row.ph-danger{color:#f87171;}',
      '.ph-head{text-align:center;}',
      // Level, XP, module, class and year. The old modal showed all of this and
      // dropping it lost real information, so it is back, on the panel itself.
      '.ph-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px;}',
      '.ph-chip{font-size:.76em;font-weight:700;padding:4px 10px;border-radius:999px;',
      'background:var(--bg-item,rgba(59,130,246,.12));border:1px solid var(--border-color,rgba(59,130,246,.22));}',
      '.ph-xpbar{height:7px;border-radius:999px;margin:12px auto 4px;max-width:240px;overflow:hidden;',
      'background:var(--bg-item,rgba(148,163,184,.25));}',
      '.ph-xpfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#3b82f6);}',
      '.ph-xptext{font-size:.78em;opacity:.75;}',
      '.ph-pic-lg{width:84px;height:84px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;',
      'justify-content:center;font-size:44px;line-height:1;cursor:pointer;}',
      '.ph-name{font-weight:800;font-size:1.15em;}',
      '.ph-sub{opacity:.75;font-size:.9em;margin-top:2px;}',
      '.ph-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border-radius:50%;border:0;',
      'background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;opacity:.7;}',
      '.ph-x:hover{opacity:1;background:var(--bg-item,rgba(148,163,184,.18));}',
      '.ph-title{margin:0 0 4px;font-size:1.15em;font-weight:800;}',

      '.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:10px;margin-top:14px;}',
      '.ph-panel .avatar-option{border-radius:12px;padding:8px 4px;cursor:pointer;text-align:center;',
      'border:2px solid transparent;background:var(--bg-item,rgba(28,42,66,.6));}',
      '.ph-panel .avatar-option.selected{border-color:var(--accent-primary,#3b82f6);}',
      '.ph-panel .avatar-option.locked{opacity:.45;cursor:not-allowed;}',
      '.ph-panel .avatar-img-wrap{width:46px;height:46px;border-radius:50%;margin:0 auto 5px;display:flex;',
      'align-items:center;justify-content:center;font-size:24px;line-height:1;}',
      '.ph-panel .avatar-name{font-size:.72em;opacity:.85;display:block;}',
      '.ph-av-lock{display:block;font-size:.66em;font-weight:700;margin-top:2px;',
      'color:var(--accent-primary,#3b82f6);opacity:.9;}',
      '.ph-panel .avatar-option.locked{opacity:.6;}',
      '.ph-ach{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;border-radius:12px;text-align:left;',
      'background:var(--bg-item,rgba(28,42,66,.6));border:1px solid var(--border-color,rgba(59,130,246,.18));}',
      '.ph-ach.is-locked{opacity:.72;}',
      '.ph-ach-ico{font-size:22px;line-height:1;}',
      '.ph-ach-name{font-weight:700;font-size:.92em;}',
      '.ph-ach-desc{font-size:.8em;opacity:.75;}',
      // overscroll-behavior:contain stops SCROLL CHAINING: without it, reaching
      // the end of this list handed the remaining wheel movement to the page
      // behind, so the pop-up and the page took turns scrolling and the pointer
      // seemed to control whichever it felt like.
      '.ph-scroll{max-height:min(52vh,420px);overflow-y:auto;overscroll-behavior:contain;',
      '-webkit-overflow-scrolling:touch;}',
      // And the page behind does not scroll at all while a layer is open. The
      // body keeps its width via the scrollbar-gutter so nothing shifts sideways
      // when its scrollbar goes away.
      'body.ph-locked{overflow:hidden !important;}',

      // Stacked backdrops compound. Each .modal-overlay dims the page by 70%,
      // so a pop-up opened on top of the panel left the screen at 91% black,
      // and a third layer would reach 97%. A sub-layer only has to separate
      // itself from the panel underneath, which is already dimming the page,
      // so it uses a light tint and no blur of its own. The blur is dropped
      // too: stacking backdrop-filters is expensive and buys nothing here.
      '.ph-layer.ph-sublayer{background:rgba(15,23,42,.22) !important;}',
      '.ph-layer.ph-sublayer.active{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',

      // The floating wheel app-settings.js builds when a page gives it no
      // opener. Display settings now live under the avatar, so a second
      // free-floating entry point would be exactly the duplication this change
      // was meant to remove. It is HIDDEN rather than suppressed with
      // data-app-settings="off", because that flag makes app-settings.js bail
      // out before it builds the panel at all - and then AppSettings.open()
      // would have nothing to show.
      '#appSettingsLaunch{display:none !important;}',

      // Messages & help. Kept in this file with the rest of the hub's CSS, so
      // the pages that mount the hub need no extra stylesheet.
      //
      // A guided conversation rather than a blank box: the app asks, the
      // student taps. Bot lines sit left, the student's own choices and words
      // sit right, and the choices are pills aligned right beneath the
      // question, all as wide as the widest - the shape students already
      // know from support widgets.
      // position:relative makes this the offsetParent, which supScroll() measures from.
      '.ph-sup-body{margin-top:12px;padding-right:2px;position:relative;}',
      // Bigger box, asked for 2026-09-23. Laptop: 600px wide and most of the
      // screen tall. Phone: the full width less a small margin, and the
      // conversation area sized to the visible screen (dvh, with vh first for
      // older phones that do not know dvh) so the keyboard does not push the
      // Send button out of reach.
      '#phSupport .ll-dialog.ph-panel{width:min(600px,calc(100vw - 24px));max-width:min(600px,calc(100vw - 24px));}',
      '#phSupport .ph-sup-body{max-height:min(66vh,640px);}',
      '#phSupport .ph-sup-input{min-height:130px;font-size:.97em;}',
      '#phSupport .ph-sup-bubble{font-size:.97em;}',
      '@media (max-width:520px){',
      '  #phSupport .ll-dialog.ph-panel{width:calc(100vw - 16px);max-width:calc(100vw - 16px);padding:20px 16px 16px;}',
      '  #phSupport .ph-sup-body{max-height:70vh;max-height:70dvh;}',
      '  #phSupport .ph-sup-bubble{max-width:92%;}',
      '  #phSupport .ph-sup-chips{max-width:100%;}',
      '  #phSupport .ph-sup-input{min-height:110px;font-size:16px;}',
      '}',
      '.ph-sup-line{display:flex;margin:8px 0;}',
      '.ph-sup-line.is-me{justify-content:flex-end;}',
      '.ph-sup-bubble{max-width:86%;padding:10px 13px;border-radius:16px;font-size:.93em;line-height:1.45;',
      '  white-space:pre-wrap;word-break:break-word;}',
      '.ph-sup-line.is-bot .ph-sup-bubble{background:var(--bg-item,rgba(148,163,184,.16));border-top-left-radius:5px;}',
      '.ph-sup-line.is-me .ph-sup-bubble{background:var(--accent-primary,#3b82f6);color:#fff;border-top-right-radius:5px;}',
      '.ph-sup-line.is-them .ph-sup-bubble{background:var(--bg-item,rgba(148,163,184,.16));border-top-left-radius:5px;',
      '  border-left:3px solid var(--accent-primary,#3b82f6);}',
      '.ph-sup-by{display:block;font-size:.78em;font-weight:700;opacity:.8;margin-bottom:3px;}',
      '.ph-sup-at{display:block;font-size:.72em;opacity:.65;margin-top:4px;}',
      '.ph-sup-line.is-me .ph-sup-at{text-align:right;opacity:.8;}',
      // One group of choices is as wide as its widest choice (fit-content,
      // capped at 92%, 100% on a phone) and sits at the right. Every chip in
      // it stretches to that width, so the left edges line up as well as the
      // right ones; pills of their own widths looked ragged (asked 2026-09-24).
      // The text stays right-aligned, on the student's side of the chat.
      // The 92% cap lives on the group, not the chip: a capped stretched chip
      // would sit left and break the right edge.
      '.ph-sup-chips{display:flex;flex-direction:column;align-items:stretch;gap:7px;',
      '  width:-moz-fit-content;width:fit-content;max-width:92%;margin:6px 0 10px auto;}',
      '.ph-sup-chip{display:flex;flex-direction:column;align-items:flex-end;text-align:right;',
      '  box-sizing:border-box;padding:8px 14px;border-radius:18px;cursor:pointer;font:inherit;font-size:.92em;',
      '  font-weight:600;color:var(--accent-primary,#3b82f6);background:transparent;',
      '  border:1.5px solid var(--border-color,rgba(59,130,246,.35));}',
      '.ph-sup-chip:hover,.ph-sup-chip:focus-visible{background:var(--accent-primary,#3b82f6);color:#fff;',
      '  border-color:var(--accent-primary,#3b82f6);outline:none;}',
      '.ph-sup-chip small{font-size:.8em;font-weight:500;opacity:.8;margin-top:2px;}',
      '.ph-sup-attach{font-size:.8em;opacity:.75;margin:0 0 8px;}',
      '.ph-sup-input{width:100%;box-sizing:border-box;resize:vertical;min-height:96px;',
      '  padding:11px 13px;border-radius:12px;font:inherit;font-size:.93em;line-height:1.45;',
      '  color:inherit;background:var(--bg-item,rgba(120,120,150,.10));',
      '  border:1px solid var(--border-color,rgba(120,120,150,.35));}',
      '.ph-sup-input:focus{outline:2px solid var(--accent-primary,#3b82f6);outline-offset:1px;}',
      '.ph-sup-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;}',
      '.ph-sup-count{font-size:.78em;opacity:.6;font-variant-numeric:tabular-nums;}',
      '.ph-sup-send{padding:9px 20px;border:0;border-radius:999px;cursor:pointer;',
      '  font:inherit;font-weight:700;color:#fff;background:var(--accent-primary,#3b82f6);}',
      '.ph-sup-send:disabled{opacity:.6;cursor:default;}',
      '.ph-sup-link{background:none;border:0;padding:4px 0;cursor:pointer;font:inherit;font-size:.85em;',
      '  font-weight:600;color:var(--accent-primary,#3b82f6);}',
      '.ph-sup-err{margin-top:10px;padding:9px 12px;border-radius:10px;font-size:.88em;',
      '  background:rgba(239,68,68,.14);color:#ef4444;}',
      '.ph-sup-err[hidden]{display:none !important;}',
      // "Your messages": one row per thread, newest first.
      '.ph-sup-mine{margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color,rgba(120,120,150,.25));}',
      '.ph-sup-h{font-size:.8em;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin-bottom:8px;}',
      '.ph-sup-item{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;',
      '  margin:0 0 6px;padding:10px 12px;border-radius:12px;cursor:pointer;font:inherit;color:inherit;',
      '  background:var(--bg-item,rgba(28,42,66,.6));border:1px solid var(--border-color,rgba(59,130,246,.18));}',
      '.ph-sup-item:hover{border-color:var(--accent-primary,#3b82f6);}',
      '.ph-sup-item .ph-sup-ico{font-size:18px;line-height:1;}',
      '.ph-sup-item .ph-sup-main{flex:1;min-width:0;}',
      '.ph-sup-item b{display:block;font-size:.9em;}',
      '.ph-sup-state{display:block;font-size:.78em;opacity:.8;margin-top:2px;}',
      '.ph-sup-state.is-answered{color:#10b981;opacity:1;}',
      '.ph-sup-new{font-size:.7em;font-weight:800;padding:3px 8px;border-radius:999px;color:#fff;background:#ef4444;}',
      // A message they wrote on the sign-in page, before they could sign in.
      '.ph-sup-src{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:999px;font-size:.72em;',
      '  font-weight:700;opacity:.85;border:1px dashed var(--border-color,rgba(120,120,150,.5));}',
      '.ph-sup-thead .ph-sup-src{margin:0 0 0 6px;font-size:.9em;}',
      // Common questions (js/faq.js styles the questions themselves): the way
      // in at the top, and the ones shown after a topic is picked.
      '.ph-sup-faqbtn{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;',
      '  margin:0 0 6px;padding:10px 13px;border-radius:12px;cursor:pointer;font:inherit;color:inherit;',
      '  background:var(--bg-item,rgba(120,120,150,.10));border:1px solid var(--border-color,rgba(59,130,246,.25));}',
      '.ph-sup-faqbtn:hover,.ph-sup-faqbtn:focus-visible{border-color:var(--accent-primary,#3b82f6);outline:none;}',
      '.ph-sup-faqbtn .ph-sup-ico{font-size:18px;line-height:1;}',
      '.ph-sup-faqbtn .ph-sup-main{flex:1;min-width:0;}',
      '.ph-sup-faqbtn b{display:block;font-size:.92em;}',
      '.ph-sup-faqbtn small{display:block;font-size:.78em;opacity:.75;margin-top:1px;}',
      '.ph-sup-faqbtn .ph-sup-go{font-size:1.3em;line-height:1;opacity:.5;}',
      '.ph-sup-related{margin:0 0 8px;}',
      '.ph-sup-faqfoot{margin-top:12px;font-size:.9em;}',
      '.ph-sup-thead{font-size:.82em;opacity:.8;margin:6px 0 4px;}',
      // The dot on the header avatar and the count on the row, when an answer
      // is waiting to be read. On the BADGE, not inside the picture: paint()
      // rewrites the picture's text, which would wipe a dot placed there.
      '.ph-badge{position:relative;}',
      '.ph-dot{position:absolute;top:2px;left:34px;width:11px;height:11px;border-radius:50%;',
      '  background:#ef4444;border:2px solid var(--bg-card,#fff);pointer-events:none;}',
      '@media (max-width:620px){.ph-dot{top:0;left:28px;}}',
      '.ph-row-count{margin-left:auto;font-size:.72em;font-weight:800;padding:3px 9px;border-radius:999px;',
      '  color:#fff;background:#ef4444;}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  // ── Overlay plumbing ─────────────────────────────────────────────────────
  // Every layer is a .modal-overlay + .ll-dialog, so shape, motion, backdrop
  // and the click-swallowing guard all come from the shared dialog layer.
  var zTop = 10000;
  function makeOverlay(id, inner, onClose, isSub) {
    var ov = byId(id);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = id;
    // ph-sublayer marks a layer that opens ON TOP of the panel, so it dims
    // lightly instead of adding a second full-strength backdrop. NOT "ph-sub":
    // that class is already the panel's subtitle text and carries opacity .75,
    // which would have made these overlays translucent.
    ov.className = 'modal-overlay ph-layer' + (isSub ? ' ph-sublayer' : '');
    ov.style.zIndex = String(++zTop);
    ov.innerHTML = '<div class="ll-dialog ll-dialog-toggle ph-panel" role="dialog" aria-modal="true" '
      + 'style="position:relative;text-align:left;">'
      + '<button type="button" class="ph-x" aria-label="Close">×</button>' + inner + '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ph-x').addEventListener('click', function () { close(ov, onClose); });
    // Backdrop click closes, but only when the backdrop itself was hit.
    ov.addEventListener('click', function (e) { if (e.target === ov) close(ov, onClose); });
    return ov;
  }
  function open(ov) {
    ov.classList.add('active');
    syncPageLock();
  }
  // The page must not scroll underneath an open layer. Called after every open
  // and close so it tracks however many layers are stacked.
  function syncPageLock() {
    var any = document.querySelector('.ph-layer.active');
    if (document.body) document.body.classList.toggle('ph-locked', !!any);
  }
  function close(ov, cb) { ov.classList.remove('active'); syncPageLock(); if (cb) cb(); }
  // The page's logout modal is plain markup with inline onclick handlers and no
  // promise to await, so the only way to know the student chose Stay is to watch
  // it close while the page is still here. If they really signed out we are
  // navigating away and this never fires.
  function watchForStay(cb) {
    var modal = byId('logoutModal');
    if (!modal) return;
    var seenOpen = false;
    var ticks = 0;
    var timer = setInterval(function () {
      var isOpen = modal.classList.contains('active');
      if (isOpen) { seenOpen = true; }
      else if (seenOpen) { clearInterval(timer); cb(); }
      if (++ticks > 600) clearInterval(timer);      // 60s, then stop watching
    }, 100);
  }

  function closeAllLayers() {
    var layers = document.querySelectorAll('.ph-layer.active');
    for (var i = 0; i < layers.length; i++) layers[i].classList.remove('active');
    syncPageLock();
  }
  function closeTop() {
    var layers = document.querySelectorAll('.ph-layer.active');
    if (!layers.length) return false;
    layers[layers.length - 1].classList.remove('active');
    syncPageLock();
    return true;
  }
  // CAPTURE phase, and the event is consumed when a layer actually closes.
  // Page-level handlers listen for Escape too - student.js used it to jump back
  // to the Vocabulary screen - so a bubbling listener closed the panel and let
  // the page navigate as well. Escape belongs to the topmost layer only.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (closeTop()) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }, true);

  // ── The panel ────────────────────────────────────────────────────────────
  function subtitle(p) {
    // Module and class, in place of the old "Level 1 - 34 XP".
    var bits = [];
    if (p.module) bits.push(p.module);
    if (p.cls) bits.push(p.cls);
    else if (p.level) bits.push(p.level);
    return bits.join(' · ');
  }

  // Rows are REBUILT from the current profile rather than created once and
  // hidden. Hiding was the bug: .ph-row sets display:flex, an author rule,
  // which beats the browser's [hidden]{display:none}, so the Teacher Dashboard
  // row stayed on screen for students even with .hidden set. A row that does
  // not apply is simply not in the document.
  function renderRows() {
    var list = document.querySelector('#phPanel .ph-list');
    if (!list) return;
    var html = ''
      + '<button type="button" class="ph-row" data-ph="avatar"><span class="ph-ico">😊</span>Choose avatar</button>'
      + '<button type="button" class="ph-row" data-ph="ach"><span class="ph-ico">🏆</span>Your achievements</button>'
      + '<button type="button" class="ph-row" data-ph="display"><span class="ph-ico">⚙️</span>Display settings</button>';
    // Only where the page can actually do it.
    if (typeof window.openChangePassword === 'function') {
      html += '<button type="button" class="ph-row" data-ph="pw"><span class="ph-ico">🔑</span>Change password</button>';
    }
    // Teachers only. Not built at all otherwise - a student's page does not
    // contain this element, which is what was asked for.
    if (profile && profile.role === 'teacher') {
      html += '<a class="ph-row" data-ph="teacher" href="teacher-dashboard.html"><span class="ph-ico">🎓</span>Teacher Dashboard</a>';
    }
    // ONE row, here and nowhere else. Support lives in this panel rather than
    // on the dashboard because the dashboard is already crowded, and the hub is
    // mounted on every page a signed-in student uses - so it is reachable
    // everywhere without being SHOWN everywhere.
    // Never for a demo account: firestore.rules refuses their write anyway, so
    // offering the row would only produce an error they cannot act on.
    // "Messages & help", not "Message your teacher": the student now chooses
    // between their teacher and the admin. The count is answers not yet read.
    // Not for teachers either: "My teacher" means nothing to one, and staff
    // answer from the teacher dashboard, not from here.
    if (!(profile && (profile.demoAccount || profile.role === 'teacher'))) {
      html += '<button type="button" class="ph-row" data-ph="support"><span class="ph-ico">💬</span>Messages &amp; help'
        + (supUnread > 0 ? '<span class="ph-row-count">' + supUnread + ' new</span>' : '')
        + '</button>';
    }
    // "Rate Lingualab" (js/app-rating.js): one rating per person, read only by
    // the admin. Only where that module is loaded, never for a demo account.
    if (window.AppRating && !(profile && profile.demoAccount)) {
      html += '<button type="button" class="ph-row" data-ph="rate"><span class="ph-ico">⭐</span>Rate Lingualab</button>';
    }
    html += '<button type="button" class="ph-row ph-danger" data-ph="logout"><span class="ph-ico">🚪</span>Log out</button>';
    list.innerHTML = html;
  }

  function buildPanel() {
    // Build ONCE. boot() calls this, and so does every click on the avatar, and
    // makeOverlay() happily returns the existing element - but the listeners
    // below were being attached again on each call, so Display fired
    // AppSettings.open() twice, then three times, then four.
    var built = byId('phPanel');
    if (built) return built;

    // No "Save profile" row. Choosing an avatar saves immediately, and the
    // password has its own flow, so the button had nothing left to save and
    // its confirmation toast appeared behind the panel.
    var inner = '<div class="ph-head">'
      + '<div class="ph-pic-lg" id="phPicLarge" title="Choose avatar"></div>'
      + '<div class="ph-name" id="previewName">Student</div>'
      + '<div class="ph-xpbar"><div class="ph-xpfill" id="phXpFill" style="width:0%"></div></div>'
      + '<div class="ph-xptext" id="phXpText"></div>'
      + '<div class="ph-chips" id="phChips"></div>'
      + '</div><div class="ph-list"></div>';

    var ov = makeOverlay('phPanel', inner);
    ov.addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('[data-ph]') : null;
      if (!row) return;
      var what = row.getAttribute('data-ph');
      if (what === 'teacher') return;                 // a real link, let it navigate
      if (what !== 'display') e.preventDefault();
      act(what);
    });
    // The picture inside the panel is a second way into the avatar chooser.
    ov.querySelector('#phPicLarge').addEventListener('click', function () { act('avatar'); });
    renderRows();
    return ov;
  }

  function act(what) {
    if (what === 'avatar')  { open(buildAvatarPopup()); return; }
    if (what === 'ach')     { open(buildAchPopup()); return; }
    if (what === 'display') {
      // Opens ON TOP of the panel, as agreed. app-settings.js owns that panel;
      // call its API rather than clicking a gear, because the gear is exactly
      // what this change removes from the header.
      if (window.AppSettings && typeof window.AppSettings.open === 'function') {
        window.AppSettings.open();
        return;
      }
      var opener = document.querySelector('[data-app-settings-open]');
      if (opener) opener.click();
      return;
    }
    if (what === 'support') { open(buildSupportPopup()); return; }
    if (what === 'rate')    { if (window.AppRating) window.AppRating.open(); return; }
    if (what === 'pw')      { if (window.openChangePassword) window.openChangePassword(); return; }
    if (what === 'logout')  { logout(); return; }
  }

  // ── Avatar chooser ───────────────────────────────────────────────────────
  function buildAvatarPopup() {
    var existing = byId('phAvatar');
    if (existing) { paintAvatarGrid(); return existing; }
    var xp = 0;
    try { xp = (window.userProfile && window.userProfile.xp) || 0; } catch (_) {}
    var cells = AVATARS.map(function (a) {
      var locked = a.unlock > 0 && xp < a.unlock;
      // Say WHAT unlocks it. Four avatars were simply greyed out with no
      // explanation, which reads as broken rather than as something to earn.
      var sub = locked
        ? '<span class="ph-av-lock">' + a.unlock.toLocaleString() + ' XP</span>'
        : '';
      return '<div class="avatar-option' + (locked ? ' locked' : '') + '" data-avatar="' + a.id + '"'
        + ' data-emoji="' + a.emoji + '" data-unlock="' + a.unlock + '"'
        + (locked ? ' title="Unlocks at ' + a.unlock.toLocaleString() + ' XP"' : '') + '>'
        + '<div class="avatar-img-wrap" style="background:' + a.bg + '">'
        + '<span class="avatar-emoji">' + a.emoji + '</span></div>'
        + '<span class="avatar-name">' + esc(a.name) + '</span>' + sub + '</div>';
    }).join('');
    // id="avatarGrid" and .avatar-option are load-bearing: student/js/avatar.js
    // delegates from that id and matches that class.
    var inner = '<h3 class="ph-title">Choose your avatar</h3>'
      + '<div class="ph-scroll"><div class="ph-grid" id="avatarGrid">' + cells + '</div></div>';
    var ov = makeOverlay('phAvatar', inner, null, true);
    ov.querySelector('#avatarGrid').addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.avatar-option') : null;
      if (!opt) return;
      if (opt.classList.contains('locked')) {
        var need = opt.getAttribute('data-unlock');
        if (window.AppDialog && AppDialog.alert) {
          AppDialog.alert('Keep practising to unlock this one.',
            { title: 'Unlocks at ' + Number(need).toLocaleString() + ' XP', icon: '🔒' });
        }
        return;
      }

      // Do the selection OURSELVES first, always. It used to be delegated
      // entirely to avatar.js when that file was present, so if avatar.js threw
      // - and it writes to several dashboard elements this change removed -
      // nothing was selected and clicking an avatar appeared to do nothing.
      var chosen = opt.getAttribute('data-avatar');
      profile.avatar = chosen;
      // Keep the owner stamp on the entry; writing it back without one would
      // strip it and let the next account inherit this avatar.
      writeCache(profile, profile.uid || currentUid());

      // Then let avatar.js persist it if it is around, since it owns the
      // Firestore write and the XP-gated unlocks. Failure here must not undo
      // the choice the student just made.
      var persisted = false;
      if (typeof window.selectAvatar === 'function') {
        try { window.selectAvatar(opt); persisted = true; } catch (_) {}
      }
      if (!persisted) saveAvatarDirect(chosen);

      paint();
      paintAvatarGrid();
    });
    paintAvatarGrid();
    return ov;
  }
  function paintAvatarGrid() {
    var grid = byId('avatarGrid');
    if (!grid || !profile) return;
    var all = grid.querySelectorAll('.avatar-option');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.toggle('selected', all[i].getAttribute('data-avatar') === profile.avatar);
    }
  }

  // ── Achievements ─────────────────────────────────────────────────────────
  // ── Messages & help ──────────────────────────────────────────────────────
  //
  // Async threads, deliberately NOT a live chat. A bubble saying "we're
  // online" sets an expectation one teacher with a full timetable cannot meet.
  //
  // It is GUIDED, like the support widgets students already know: the app asks
  // who, what and when, and the student taps. So every message arrives already
  // routed and sorted - staff filter their inbox on exactly these answers -
  // and the student only types the part only they can say.
  //
  // Name, class, level and module come off the profile already loaded here;
  // the email comes off the signed-in account. Nothing is typed twice.
  //
  // Answers come back HERE, not by email. Each one is signed with the name
  // and role of whoever wrote it, and the student can reply in the same
  // thread. The thread itself lives in supportMessages/{id}/replies.
  //
  // The topic keys, the `when` keys and the two recipients are ALSO listed in
  // firestore.rules and teacher/js/messages-admin.js.
  // tools/support-topics-check.js fails if the three drift apart.
  var SUPPORT_TO = {
    teacher: { icon: '👩‍🏫', label: 'My teacher', short: 'your teacher',
               hint: 'Lessons, homework, grades, absences' },
    admin:   { icon: '🛠️', label: 'Lingualab admin', short: 'the admin',
               hint: 'App problems, your account, a mistake in a question' }
  };
  // `tech` topics get the device and page attached; `noWhen` skips the
  // "when did it happen?" step, which means nothing for an idea.
  var SUPPORT_TOPICS = {
    teacher: [
      { key: 'lesson',    icon: '📖', label: 'Lesson or homework question' },
      { key: 'grade',     icon: '📝', label: 'My grade or score' },
      { key: 'absence',   icon: '📅', label: 'Absence or a missed class' },
      { key: 'other',     icon: '💬', label: 'Something else' }
    ],
    admin: [
      { key: 'technical', icon: '🐞', label: 'The app is not working', tech: true },
      { key: 'account',   icon: '🔐', label: 'My account or signing in', tech: true },
      { key: 'content',   icon: '❌', label: 'A mistake in a question', tech: true },
      { key: 'idea',      icon: '💡', label: 'An idea or feedback', noWhen: true },
      { key: 'other',     icon: '💬', label: 'Something else' }
    ]
  };
  var SUPPORT_WHENS = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week',      label: 'This week' },
    { key: 'earlier',   label: 'Earlier' }
  ];
  var SUPPORT_PLACEHOLDER = {
    lesson:    'Which lesson or homework, and what is your question?',
    grade:     'Which grade or score, and what do you think is wrong?',
    absence:   'Which day or class, and what happened?',
    technical: 'What did you tap, and what happened instead?',
    account:   'What happens when you try to sign in or use your account?',
    content:   'Which question is it (unit, exercise, number), and what is wrong with it?',
    idea:      'Tell us your idea.',
    other:     'What do you need help with?'
  };

  // Answers the student has not opened yet. Drives the dot on the header
  // avatar and the count on the row.
  var supUnread = 0;
  var sup = null;

  function supTopic(key) {
    var all = SUPPORT_TOPICS.teacher.concat(SUPPORT_TOPICS.admin);
    for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return null;
  }
  function supWhenLabel(key) {
    for (var i = 0; i < SUPPORT_WHENS.length; i++) if (SUPPORT_WHENS[i].key === key) return SUPPORT_WHENS[i].label;
    return '';
  }
  function supFirstName() {
    return String((profile && profile.name) || '').trim().split(/\s+/)[0] || 'there';
  }
  // The address the token carries. firestore.rules compares a reply's
  // authorEmail against request.auth.token.email, so it must be this exact
  // string - and the profile never held an email at all, which is why the
  // first version of this box sent every message with a blank one.
  function currentEmail() {
    try {
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      return (a && a.currentUser && a.currentUser.email) || '';
    } catch (_) { return ''; }
  }
  function supMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    var d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  function supAgo(ts) {
    var ms = supMillis(ts);
    // A serverTimestamp() we wrote a moment ago reads back as null until the
    // server confirms it.
    if (!ms) return 'just now';
    var mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ms).toLocaleDateString();
  }
  function supStaffName(by) {
    if (!by) return '';
    return (by.name || 'Staff') + ' (' + (by.role === 'admin' ? 'Admin' : 'Teacher') + ')';
  }
  // Written on the sign-in page (js/signin-support.js) when they could not
  // sign in, and found here by their email. Tagged, because they may not
  // remember writing it from there.
  function supSrcTag(d) {
    return d && d.source === 'signin' ? '<span class="ph-sup-src">Sent from the sign-in page</span>' : '';
  }
  // Plain words, not a user-agent string: this is read by a person, and
  // "Android phone - Chrome" is what they need to reproduce the problem.
  function supDevice() {
    var ua = (navigator && navigator.userAgent) || '';
    var kind = /iPad|Tablet/i.test(ua) ? 'tablet' : (/Mobi|Android|iPhone|iPod/i.test(ua) ? 'phone' : 'computer');
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    return ((os ? os + ' ' : '') + kind + ' - ' + br).slice(0, 120);
  }
  function supPage() {
    var p = (location && location.pathname) || '';
    return (p.split('/').pop() || 'home').slice(0, 200);
  }

  // What the student has chosen and typed, kept OUTSIDE `sup` so it outlives
  // every re-render. Opening an older thread, tapping back, or closing the
  // popup by accident used to throw away a half-written message and reset the
  // choices to "Who do you want to write to?". Cleared only when the message
  // is sent, or by "Start again" / "Write another message".
  var supDraft = { to: '', topic: '', when: '', text: '', replies: {} };
  function supClearDraft() {
    supDraft.to = ''; supDraft.topic = ''; supDraft.when = ''; supDraft.text = '';
  }

  function supReset() {
    sup = { view: 'home', to: supDraft.to, topic: supDraft.topic, when: supDraft.when, sent: '',
            msgs: sup ? sup.msgs : null, thread: null, replies: null };
  }

  function supSetUnread(n) {
    supUnread = Math.max(0, n | 0);
    var uid = currentUid();
    try { if (uid) sessionStorage.setItem('phSupUnread:' + uid, String(supUnread)); } catch (_) {}
    renderRows();
    var badges = document.querySelectorAll('[data-ph-badge]');
    for (var i = 0; i < badges.length; i++) {
      var dot = badges[i].querySelector('.ph-dot');
      if (supUnread > 0 && !dot) {
        dot = document.createElement('span');
        dot.className = 'ph-dot';
        dot.setAttribute('aria-hidden', 'true');
        badges[i].appendChild(dot);
      } else if (supUnread === 0 && dot) {
        dot.remove();
      }
      badges[i].title = supUnread > 0 ? 'Your profile - you have a new answer' : 'Your profile';
    }
  }

  // ── rendering ──
  function supBot(html) {
    return '<div class="ph-sup-line is-bot"><div class="ph-sup-bubble">' + html + '</div></div>';
  }
  function supMe(html, at) {
    return '<div class="ph-sup-line is-me"><div class="ph-sup-bubble">' + html
      + (at !== undefined ? '<span class="ph-sup-at">You &middot; ' + esc(supAgo(at)) + '</span>' : '')
      + '</div></div>';
  }
  function supThem(r) {
    return '<div class="ph-sup-line is-them"><div class="ph-sup-bubble">'
      + '<span class="ph-sup-by">' + esc(supStaffName({ name: r.authorName, role: r.authorRole })) + '</span>'
      + esc(r.text) + '<span class="ph-sup-at">' + esc(supAgo(r.createdAt)) + '</span></div></div>';
  }
  function supChips(field, items) {
    return '<div class="ph-sup-chips">' + items.map(function (it) {
      return '<button type="button" class="ph-sup-chip" data-sup-pick="' + field + '" data-val="' + esc(it.key) + '">'
        + esc((it.icon ? it.icon + ' ' : '') + it.label)
        + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function supCompose(kind, placeholder, label) {
    var draft = kind === 'reply'
      ? ((sup.thread && supDraft.replies[sup.thread.id]) || '')
      : supDraft.text;
    return '<textarea class="ph-sup-input" data-sup-text="' + kind + '" rows="5" maxlength="2000" '
      + 'placeholder="' + esc(placeholder) + '">' + esc(draft) + '</textarea>'
      + '<div class="ph-sup-foot"><span class="ph-sup-count">' + draft.length + ' / 2000</span>'
      + '<button type="button" class="ph-sup-send" data-sup-' + kind + '>' + esc(label) + '</button></div>'
      + '<div class="ph-sup-err" hidden></div>';
  }

  // ── common questions (js/faq.js, written in Admin > FAQ) ──
  // Two ways in: "Common questions" at the top of the panel, with a search
  // box; and, once the student picks a topic, the questions on that topic,
  // shown BEFORE they are asked to write - an answer that already exists is
  // found in seconds instead of waiting a day for a person. Nothing here if
  // js/faq.js is not on the page or no question has been published.
  // null while loading; [] when there are none or the read failed.
  var supFaqs = null;
  function supFaqEntryHtml() {
    if (!window.LLFaq || !supFaqs || !supFaqs.length) return '';
    return '<button type="button" class="ph-sup-faqbtn" data-sup-faq>'
      + '<span class="ph-sup-ico">❓</span>'
      + '<span class="ph-sup-main"><b>Common questions</b><small>Quick answers, no waiting</small></span>'
      + '<span class="ph-sup-go" aria-hidden="true">›</span></button>';
  }
  function supRelatedHtml(topicKey) {
    if (!window.LLFaq || !supFaqs || !supFaqs.length || !topicKey) return '';
    var list = LLFaq.forTopic(supFaqs, topicKey).slice(0, 4);
    if (!list.length) return '';
    return supBot('<b>These might already answer it:</b>')
      + '<div class="ph-sup-related">' + LLFaq.itemsHtml(list) + '</div>';
  }
  function supFaqListHtml() {
    if (supFaqs === null) return '<span class="ph-sup-state">Loading...</span>';
    var term = sup.faqTerm || '';
    var list = LLFaq.search(supFaqs, term);
    if (!list.length) {
      return '<div class="llfaq-none">' + (supFaqs.length ? 'Nothing matches that. Try other words, or write to us.'
        : 'There are no common questions yet.') + '</div>';
    }
    return term ? LLFaq.itemsHtml(list) : LLFaq.groupedHtml(list);
  }
  function supFaqHtml() {
    return '<button type="button" class="ph-sup-link" data-sup-faqback>← Back</button>'
      + '<input type="search" class="llfaq-search" data-sup-faqsearch maxlength="80" autocomplete="off"'
      + ' placeholder="Search, for example: password" aria-label="Search common questions" value="' + esc(sup.faqTerm || '') + '">'
      + '<div data-sup-faqlist>' + supFaqListHtml() + '</div>'
      + '<div class="ph-sup-faqfoot">Still need help? <button type="button" class="ph-sup-link" data-sup-faqback>Write to us</button></div>';
  }
  // Fills only the FAQ parts when the list arrives. A full re-render would
  // take the caret out of a message the student is typing.
  function supRefreshFaqs() {
    var body = byId('phSupBody');
    if (!body || !sup) return;
    var slot = body.querySelector('[data-sup-faqslot]');
    if (slot) slot.innerHTML = supFaqEntryHtml();
    var rel = body.querySelector('[data-sup-related]');
    if (rel) rel.innerHTML = supRelatedHtml(sup.topic);
    var fl = body.querySelector('[data-sup-faqlist]');
    if (fl) fl.innerHTML = supFaqListHtml();
  }
  function supLoadFaqs() {
    if (!window.LLFaq) { supFaqs = []; return; }
    LLFaq.css();
    LLFaq.load('all').then(function (list) {
      supFaqs = list;
      supRefreshFaqs();
    }, function () {
      if (supFaqs === null) supFaqs = [];
      supRefreshFaqs();
    });
  }

  function supHomeHtml() {
    var h = '<div data-sup-faqslot>' + supFaqEntryHtml() + '</div>';
    h += supBot('Hi ' + esc(supFirstName()) + '! 👋 Your teacher and the Lingualab admin are here to help.\n'
      + '<b>Who do you want to write to?</b>');
    if (!sup.to) {
      h += supChips('to', ['teacher', 'admin'].map(function (k) {
        return { key: k, icon: SUPPORT_TO[k].icon, label: SUPPORT_TO[k].label, hint: SUPPORT_TO[k].hint };
      }));
    } else {
      var who = SUPPORT_TO[sup.to];
      h += supMe(esc(who.icon + ' ' + who.label));
      h += supBot('<b>What is it about?</b>');
      var t = sup.topic ? supTopic(sup.topic) : null;
      if (!t) {
        h += supChips('topic', SUPPORT_TOPICS[sup.to]);
      } else {
        h += supMe(esc(t.icon + ' ' + t.label));
        if (!sup.sent) h += '<div data-sup-related>' + supRelatedHtml(t.key) + '</div>';
        if (!t.noWhen) {
          h += supBot('<b>When did it happen?</b>');
          if (!sup.when) h += supChips('when', SUPPORT_WHENS);
          else h += supMe(esc(supWhenLabel(sup.when)));
        }
        if (t.noWhen || sup.when) {
          if (sup.sent) {
            h += supMe(esc(sup.sent));
            h += supBot('Sent to ' + esc(who.short) + ' ✅\n'
              + 'The answer will appear under <b>Your messages</b>, with the name of whoever answers.');
            h += '<div class="ph-sup-chips"><button type="button" class="ph-sup-chip" data-sup-again>'
              + '✏️ Write another message</button></div>';
          } else {
            h += supBot(t.tech
              ? '<b>Tell us what happened.</b>\nYour device and this page are attached, so the problem is easier to find.'
              : '<b>Tell us more.</b>');
            if (t.tech) h += '<div class="ph-sup-attach">📎 ' + esc(supDevice()) + ' &middot; ' + esc(supPage()) + '</div>';
            h += supCompose('send', SUPPORT_PLACEHOLDER[t.key] || SUPPORT_PLACEHOLDER.other, 'Send');
          }
        }
      }
      h += '<span data-sup-anchor></span>';
      if (!sup.sent) h += '<button type="button" class="ph-sup-link" data-sup-again>↺ Start again</button>';
    }
    return h + '<div data-sup-mine>' + supMineHtml() + '</div>';
  }

  function supMineHtml() {
    if (sup.msgs === null) {
      return '<div class="ph-sup-mine"><div class="ph-sup-h">Your messages</div>'
        + '<span class="ph-sup-state">Loading...</span></div>';
    }
    if (!sup.msgs.length) return '';
    return '<div class="ph-sup-mine"><div class="ph-sup-h">Your messages</div>' + sup.msgs.map(function (m) {
      var d = m.data;
      var t = supTopic(d.topic) || { icon: '💬', label: 'Message' };
      var who = SUPPORT_TO[d.to] || SUPPORT_TO.admin;
      // "Answered" is the STATUS. The name is added when it is known: a message
      // closed by the first version of the inbox has no answeredBy at all, and
      // was listed as "Waiting for an answer" although it had been answered.
      var answered = d.status === 'answered';
      var state = answered
        ? (d.answeredBy ? 'Answered by ' + supStaffName(d.answeredBy) : 'Answered')
        : 'Waiting for an answer';
      return '<button type="button" class="ph-sup-item" data-sup-open="' + esc(m.id) + '">'
        + '<span class="ph-sup-ico">' + esc(t.icon) + '</span>'
        + '<span class="ph-sup-main"><b>' + esc(t.label) + '</b>'
        + '<span class="ph-sup-state' + (answered ? ' is-answered' : '') + '">'
        + 'To ' + esc(who.short) + ' &middot; ' + esc(state) + ' &middot; ' + esc(supAgo(d.lastReplyAt || d.createdAt))
        + '</span>' + supSrcTag(d) + '</span>'
        + (d.studentUnread ? '<span class="ph-sup-new">New</span>' : '')
        + '</button>';
    }).join('') + '</div>';
  }

  function supThreadHtml() {
    var d = sup.thread.data;
    var t = supTopic(d.topic) || { icon: '💬', label: 'Message' };
    var who = SUPPORT_TO[d.to] || SUPPORT_TO.admin;
    return '<button type="button" class="ph-sup-link" data-sup-back>← All messages</button>'
      + '<div class="ph-sup-thead">' + esc(t.icon + ' ' + t.label) + ' &middot; to ' + esc(who.short)
      + (d.when ? ' &middot; happened ' + esc(supWhenLabel(d.when).toLowerCase()) : '') + supSrcTag(d) + '</div>'
      + supMe(esc(d.message), d.createdAt)
      + '<div data-sup-replies>' + supRepliesHtml() + '</div>'
      + '<span data-sup-anchor></span>'
      + supCompose('reply', 'Write a reply...', 'Send reply');
  }

  function supRepliesHtml() {
    if (sup.replies === null) return supBot('Loading...');
    var h = sup.replies.map(function (r) {
      return r.authorRole === 'student' ? supMe(esc(r.text), r.createdAt) : supThem(r);
    }).join('');
    var answered = sup.replies.some(function (r) { return r.authorRole !== 'student'; });
    var d = (sup.thread && sup.thread.data) || {};
    if (!answered && d.status === 'answered') {
      // Staff can close a message without writing (it was settled in class).
      // The list already says "Answered by ...", so the thread must not
      // contradict it with "No answer yet".
      h += supBot('Marked as answered' + (d.answeredBy ? ' by ' + esc(supStaffName(d.answeredBy)) : '') + '.\n'
        + 'If you still need help, reply here.');
    } else if (!answered) {
      h += supBot('No answer yet. It will appear here, with the name of whoever answers.');
    }
    return h;
  }

  // Keep the newest step in view, the way a conversation does - but scroll
  // only the panel, never the page behind it.
  function supScroll() {
    var body = byId('phSupBody');
    var anchor = body && body.querySelector('[data-sup-anchor]');
    if (!body) return;
    body.scrollTop = anchor ? Math.max(0, anchor.offsetTop - body.clientHeight + 40) : 0;
  }

  function supRender() {
    var body = byId('phSupBody');
    if (!body) return;
    body.innerHTML = sup.view === 'thread' ? supThreadHtml()
      : (sup.view === 'faq' ? supFaqHtml() : supHomeHtml());
    supScroll();
  }
  // Refills ONLY the "Your messages" list. Re-rendering the whole panel when
  // the list arrives would wipe a message the student is half-way through.
  function supRenderMine() {
    var box = document.querySelector('#phSupBody [data-sup-mine]');
    if (box) box.innerHTML = supMineHtml();
  }
  function supErr(text) {
    var el = document.querySelector('#phSupBody .ph-sup-err');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  // ── data ──
  // Messages written on the sign-in page (js/signin-support.js) by someone
  // who could not sign in. There was no account, so they carry no userId,
  // only the email that was TYPED (lowercased there). firestore.rules lets
  // the owner of that address read them once they can sign in, comparing it
  // with request.auth.token.email.lower() on a VERIFIED account - so the
  // email is lowercased here the same way, and there is no query at all
  // without a verified email, because the rules would refuse it outright.
  function supSigninEmail() {
    try {
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      var u = a && a.currentUser;
      if (!u || u.isAnonymous || !u.email || u.emailVerified !== true) return '';
      return String(u.email).toLowerCase();
    } catch (_) { return ''; }
  }
  // A SECOND query beside the userId one, not one query for both: the rules
  // must be able to prove every result a query could return, and these match
  // on source + email instead. Equality filters only, so no composite index.
  // It resolves to [] on any failure, so it can never take the student's own
  // messages (or the dot) down with it.
  function supSigninDocs(fs, unreadOnly) {
    var email = supSigninEmail();
    if (!email) return Promise.resolve([]);
    var q = fs.collection('supportMessages').where('source', '==', 'signin').where('email', '==', email);
    if (unreadOnly) q = q.where('studentUnread', '==', true).limit(20);
    return q.get().then(function (snap) { return snap.docs; }, function () { return []; });
  }
  // One list, each thread once. The two queries should never overlap (a
  // sign-in page message has no userId), but a thread listed twice would also
  // count its unread answer twice, so it is keyed by id regardless.
  function supMerge(own, signin) {
    var seen = {};
    return own.concat(signin).filter(function (d) {
      if (seen[d.id]) return false;
      seen[d.id] = true;
      return true;
    });
  }

  function supLoadMine() {
    var uid = currentUid();
    var fs = fdb();
    if (!uid || !fs) { sup.msgs = []; supRenderMine(); return; }
    // An equality filter alone, sorted here: no composite index needed, and a
    // student has a handful of threads, not hundreds.
    Promise.all([
      fs.collection('supportMessages').where('userId', '==', uid).get(),
      supSigninDocs(fs, false)
    ]).then(function (res) {
      var list = supMerge(res[0].docs, res[1]).map(function (d) { return { id: d.id, data: d.data() }; });
      list.sort(function (a, b) {
        return supMillis(b.data.lastReplyAt || b.data.createdAt) - supMillis(a.data.lastReplyAt || a.data.createdAt);
      });
      sup.msgs = list.slice(0, 20);
      supSetUnread(list.filter(function (m) { return m.data.studentUnread === true; }).length);
      if (sup.view === 'home') supRenderMine();
    }).catch(function () {
      sup.msgs = [];
      if (sup.view === 'home') supRenderMine();
    });
  }

  function supSend(btn) {
    var ta = document.querySelector('#phSupBody [data-sup-text="send"]');
    var text = ((ta && ta.value) || '').trim();
    if (!text) { supErr('Write your message first.'); return; }
    var uid = currentUid();
    var fs = fdb();
    if (!uid || !fs) { supErr('You are not signed in. Reload the page and try again.'); return; }
    var t = supTopic(sup.topic);
    if (!t || !SUPPORT_TO[sup.to]) { supErr('Choose who and what it is about first.'); return; }

    var doc = {
      userId: uid,
      name: (profile && profile.name) || '',
      email: currentEmail(),
      studentClass: (profile && profile.cls) || '',
      level: (profile && profile.level) || '',
      module: (profile && profile.module) || '',
      to: sup.to,
      topic: sup.topic,
      message: text,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!t.noWhen) doc.when = sup.when;
    if (t.tech) { doc.device = supDevice(); doc.page = supPage(); }

    // One send at a time, and say so. Without this a slow connection looks
    // like a dead button and the student taps until there are five copies.
    btn.disabled = true;
    btn.textContent = 'Sending...';
    supErr('');
    var started = sup;
    fs.collection('supportMessages').add(doc).then(function () {
      supClearDraft();
      // The popup was closed and reopened while this was sending: that is a
      // new conversation, and "Sent to ..." must not be painted into it (it
      // could name a recipient the student has since picked). Start it clean
      // and let the list show the message that went.
      if (sup !== started) {
        if (sup.view === 'home') { supReset(); supRender(); }
        supLoadMine();
        return;
      }
      sup.sent = text;
      supRender();
      supLoadMine();
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Send';
      supErr('Could not send that. Check your connection and try again.'
        + (e && e.code ? ' (' + e.code + ')' : ''));
    });
  }

  function supOpenThread(id) {
    var m = null;
    (sup.msgs || []).forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return;
    sup.view = 'thread';
    sup.thread = m;
    sup.replies = null;
    supRender();
    var fs = fdb();
    if (!fs) return;
    var ref = fs.collection('supportMessages').doc(id);
    ref.collection('replies').orderBy('createdAt').get().then(function (snap) {
      if (sup.thread !== m) return;          // they have already gone back
      sup.replies = snap.docs.map(function (d) { return d.data(); });
      var box = document.querySelector('#phSupBody [data-sup-replies]');
      if (box) box.innerHTML = supRepliesHtml();
      supScroll();
    }).catch(function () {
      if (sup.thread !== m) return;
      sup.replies = [];
      var box = document.querySelector('#phSupBody [data-sup-replies]');
      if (box) box.innerHTML = supRepliesHtml();
    });
    // Opening the thread IS reading the answer - decided from the document as
    // it is NOW, not from the list, which may have been loaded before the
    // answer arrived. With the list copy, an answer read here came back later
    // as "New" with the red dot. And the count is recounted, not decremented:
    // a decrement could run twice and hide another unread answer.
    ref.get().then(function (doc) {
      if (!doc.exists) return;
      var fresh = doc.data();
      m.data = fresh;
      if (sup.thread === m) {
        var box = document.querySelector('#phSupBody [data-sup-replies]');
        if (box && sup.replies !== null) box.innerHTML = supRepliesHtml();
      }
      if (fresh.studentUnread !== true) return;
      return ref.update({ studentUnread: false }).then(function () {
        m.data.studentUnread = false;
        (sup.msgs || []).forEach(function (x) { if (x.id === m.id) x.data.studentUnread = false; });
        supSetUnread((sup.msgs || []).filter(function (x) { return x.data.studentUnread === true; }).length);
      });
    }).catch(function () {});
  }

  function supReply(btn) {
    var ta = document.querySelector('#phSupBody [data-sup-text="reply"]');
    var text = ((ta && ta.value) || '').trim();
    if (!text) { supErr('Write your reply first.'); return; }
    var uid = currentUid();
    var fs = fdb();
    var m = sup.thread;
    if (!uid || !fs || !m) { supErr('You are not signed in. Reload the page and try again.'); return; }

    var FV = firebase.firestore.FieldValue;
    var ref = fs.collection('supportMessages').doc(m.id);
    var reply = {
      text: text,
      authorUid: uid,
      authorName: String((profile && profile.name) || 'Student').slice(0, 80),
      authorEmail: currentEmail(),
      authorRole: 'student',
      createdAt: FV.serverTimestamp()
    };
    // Reply and bookkeeping in ONE batch, so a thread can never show a reply
    // that its counter and status do not know about. studentUnread is set
    // false here too: the rules only let the student write it as false, and a
    // thread with an unread answer would otherwise refuse the reply.
    var batch = fs.batch();
    batch.set(ref.collection('replies').doc(), reply);
    batch.update(ref, {
      status: 'open',
      studentUnread: false,
      lastReplyAt: FV.serverTimestamp(),
      replyCount: FV.increment(1)
    });
    btn.disabled = true;
    btn.textContent = 'Sending...';
    supErr('');
    var started = sup;
    batch.commit().then(function () {
      m.data.status = 'open';
      m.data.studentUnread = false;
      delete supDraft.replies[m.id];
      // Moved on to another thread (or closed) while this was sending: the
      // reply must not be drawn into whatever thread is open now.
      if (sup !== started || sup.thread !== m) { supLoadMine(); return; }
      sup.replies = (sup.replies || []).concat([{ text: text, authorRole: 'student', createdAt: null }]);
      var box = document.querySelector('#phSupBody [data-sup-replies]');
      if (box) box.innerHTML = supRepliesHtml();
      ta.value = '';
      var cnt = document.querySelector('#phSupBody .ph-sup-count');
      if (cnt) cnt.textContent = '0 / 2000';
      btn.disabled = false;
      btn.textContent = 'Send reply';
      supScroll();
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Send reply';
      supErr('Could not send that. Check your connection and try again.'
        + (e && e.code ? ' (' + e.code + ')' : ''));
    });
  }

  function supClick(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t || !t.closest('#phSupBody')) return;
    if (t.hasAttribute('data-sup-pick')) {
      var field = t.getAttribute('data-sup-pick');
      var val = t.getAttribute('data-val');
      // Picking something clears everything after it, so a changed mind never
      // carries a stale topic or date into the message.
      if (field === 'to')    { sup.to = val; sup.topic = ''; sup.when = ''; }
      if (field === 'topic') { sup.topic = val; sup.when = ''; }
      if (field === 'when')  { sup.when = val; }
      supDraft.to = sup.to; supDraft.topic = sup.topic; supDraft.when = sup.when;
      supRender();
      var ta = document.querySelector('#phSupBody .ph-sup-input');
      if (ta) { try { ta.focus({ preventScroll: true }); } catch (_) { ta.focus(); } }
      return;
    }
    if (t.hasAttribute('data-sup-again')) { supClearDraft(); supReset(); supRender(); return; }
    if (t.hasAttribute('data-sup-send'))  { supSend(t); return; }
    if (t.hasAttribute('data-sup-open'))  { supOpenThread(t.getAttribute('data-sup-open')); return; }
    if (t.hasAttribute('data-sup-back'))  { supReset(); supRender(); supLoadMine(); return; }
    if (t.hasAttribute('data-sup-reply')) { supReply(t); return; }
    if (t.hasAttribute('data-sup-faq')) {
      sup.view = 'faq'; sup.faqTerm = '';
      supRender();
      var s = document.querySelector('#phSupBody [data-sup-faqsearch]');
      if (s) { try { s.focus({ preventScroll: true }); } catch (_) { s.focus(); } }
      return;
    }
    // Back to the conversation exactly as it was left; the draft is kept.
    if (t.hasAttribute('data-sup-faqback')) { sup.view = 'home'; supRender(); return; }
  }

  function buildSupportPopup() {
    var ov = byId('phSupport');
    if (!ov) {
      ov = makeOverlay('phSupport',
        '<h3 class="ph-title">💬 Messages &amp; help</h3>'
        + '<div class="ph-scroll ph-sup-body" id="phSupBody"></div>', null, true);
      ov.addEventListener('click', supClick);
      ov.addEventListener('input', function (e) {
        var ta = e.target;
        // The search box refills the list only, so it keeps the caret.
        if (ta && ta.hasAttribute && ta.hasAttribute('data-sup-faqsearch')) {
          sup.faqTerm = ta.value;
          var fl = document.querySelector('#phSupBody [data-sup-faqlist]');
          if (fl) fl.innerHTML = supFaqListHtml();
          return;
        }
        if (!ta || !ta.classList || !ta.classList.contains('ph-sup-input')) return;
        var cnt = ta.parentNode && ta.parentNode.querySelector('.ph-sup-count');
        if (cnt) cnt.textContent = ta.value.length + ' / 2000';
        if (ta.getAttribute('data-sup-text') === 'reply') {
          if (sup && sup.thread) supDraft.replies[sup.thread.id] = ta.value;
        } else {
          supDraft.text = ta.value;
        }
      });
    }
    // Every opening starts at the question, and fetches the list fresh - an
    // answer may have arrived since the last look.
    supReset();
    supRender();
    supLoadMine();
    supLoadFaqs();
    return ov;
  }

  // ── the "new answer" dot ──
  // Checked ONCE per browser session per student, then carried between pages
  // in sessionStorage. A zero-result query still costs a read, and this runs
  // for every signed-in student; once a session is the difference between a
  // few hundred reads a day and several thousand. Opening the panel always
  // re-checks, so nothing is missed for long.
  function supWatchAnswers() {
    var tries = 0;
    (function wait() {
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      if (!a) { if (++tries <= 60) setTimeout(wait, 100); return; }
      if (typeof a.onAuthStateChanged === 'function') {
        a.onAuthStateChanged(function (u) { if (u && !u.isAnonymous) supCheckAnswers(u.uid); });
      }
      if (a.currentUser && !a.currentUser.isAnonymous) supCheckAnswers(a.currentUser.uid);
    })();
  }

  var supChecking = {};
  function supCheckAnswers(uid) {
    // The auth listener and the immediate check both fire on a warm session,
    // so without this guard every page load paid for the query twice.
    if (!uid || supChecking[uid]) return;
    supChecking[uid] = true;
    var cached = null;
    try { cached = sessionStorage.getItem('phSupUnread:' + uid); } catch (_) {}
    if (cached !== null) { supSetUnread(parseInt(cached, 10) || 0); return; }
    var tries = 0;
    (function go() {
      var fs = fdb();
      if (!fs) { if (++tries <= 50) setTimeout(go, 200); return; }
      if (profile && (profile.demoAccount || profile.role === 'teacher')) return;
      // An answer to a message sent from the sign-in page lights the dot too.
      Promise.all([
        fs.collection('supportMessages')
          .where('userId', '==', uid)
          .where('studentUnread', '==', true)
          .limit(20)
          .get(),
        supSigninDocs(fs, true)
      ])
        .then(function (res) { supSetUnread(supMerge(res[0].docs, res[1]).length); })
        .catch(function () {});
    })();
  }

  function buildAchPopup() {
    var existing = byId('phAch');
    if (existing) return existing;
    // Real progress where the page has it. Every one used to read as locked
    // with nothing to explain why, because the numbers were never consulted.
    var stats = window.journeyStats || {};
    var words = Number(stats.totalWordsLearned) || 0;
    var sessions = Number(stats.totalSessions) || 0;
    var best = 0;
    try { best = Number(localStorage.getItem('bestStreak')) || 0; } catch (_) {}

    var state = [
      { got: sessions > 0,  now: sessions, need: 1   },
      { got: best >= 10,    now: best,     need: 10  },
      { got: words >= 100,  now: words,    need: 100 },
      { got: false,         now: null,     need: null }
    ];

    var cells = ACHIEVEMENTS.map(function (a, i) {
      var st = state[i];
      // Say what it takes AND how far along they are, so a locked badge is
      // information rather than a grey box.
      var progress = st.got
        ? 'Unlocked'
        : (st.need != null ? st.now + ' / ' + st.need : 'Not yet');
      return '<div class="ph-ach' + (st.got ? '' : ' is-locked') + '">'
        + '<span class="ph-ach-ico">' + (st.got ? a.icon : '🔒') + '</span><span>'
        + '<span class="ph-ach-name">' + esc(a.name) + '</span><br>'
        + '<span class="ph-ach-desc">' + esc(a.desc) + ' &middot; ' + esc(progress)
        + '</span></span></div>';
    }).join('');
    var inner = '<h3 class="ph-title">Your achievements</h3>'
      + '<div class="ph-scroll"><div class="ph-list" id="achievementsGrid">' + cells + '</div></div>';
    return makeOverlay('phAch', inner, null, true);
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  // Used only when avatar.js is absent or threw. There is no "Save profile"
  // button any more: choosing an avatar is the save.
  function saveAvatarDirect(avatarId) {
    var uid = currentUid();
    var fs = fdb();
    if (!uid || !fs) return;
    try {
      fs.collection('users').doc(uid).update({ 'profile.avatar': avatarId }).catch(function () {});
    } catch (_) {}
  }

  function logout() {
    // Close our own layers FIRST. The page's logout modal is a normal
    // .modal-overlay at z-index 1000, while these panels sit at 10000 and up,
    // so opening it from here put the confirm underneath the profile panel.
    closeAllLayers();

    // ...but choosing Stay has to bring the panel BACK. Closing it outright
    // meant cancelling a logout dropped you on a bare page with the profile
    // gone, which is not what "stay" means. Watch the page's own modal and
    // reopen if it closes without signing out.
    var reopen = function () { open(buildPanel()); paint(); };

    // The dashboard has its own confirm modal; reuse it where it exists so a
    // student sees the same thing they always have.
    if (typeof window.openLogoutModal === 'function') {
      window.openLogoutModal();
      watchForStay(reopen);
      return;
    }
    var go = function () {
      try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ROLE_KEY); } catch (_) {}
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      if (a && a.signOut) a.signOut().then(function () { location.replace('index.html'); })
                                     .catch(function () { location.replace('index.html'); });
      else location.replace('index.html');
    };
    if (window.AppDialog && AppDialog.confirm) {
      AppDialog.confirm('You will need to sign in again.',
        { title: 'Log out?', okLabel: 'Log out', cancelLabel: 'Stay', danger: true })
        .then(function (ok) { if (ok) go(); else reopen(); });
    } else { go(); }
  }

  // ── Painting ─────────────────────────────────────────────────────────────
  function paint() {
    if (!profile) return;
    var a = avatarOf(profile.avatar);
    var sub = subtitle(profile);
    // Every badge on the page, not just the first - see makeBadge().
    var pics = document.querySelectorAll('[data-ph-pic]');
    for (var i = 0; i < pics.length; i++) {
      pics[i].textContent = a.emoji;
      pics[i].style.background = a.bg;
    }
    var nms = document.querySelectorAll('[data-ph-name]');
    for (var j = 0; j < nms.length; j++) nms[j].textContent = profile.name;
    var sbs = document.querySelectorAll('[data-ph-sub]');
    for (var k = 0; k < sbs.length; k++) sbs[k].textContent = sub;
    var big = byId('phPicLarge');
    if (big) { big.textContent = a.emoji; big.style.background = a.bg; }
    var pn = byId('previewName'); if (pn) pn.textContent = profile.name;

    // Level, XP, module, class and year. The old modal showed all of this and
    // the first version of this panel showed only the name, which lost it.
    var xp = 0, lvl = 1;
    try {
      xp  = (window.userProfile && Number(window.userProfile.xp))    || 0;
      lvl = (window.userProfile && Number(window.userProfile.level)) || 1;
    } catch (_) {}
    var span = 100;                       // xp needed within the current level
    var into = xp % span;
    var fill = byId('phXpFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, (into / span) * 100)) + '%';
    var xt = byId('phXpText');
    if (xt) xt.textContent = 'Level ' + lvl + ' · ' + xp + ' XP';

    var chips = byId('phChips');
    if (chips) {
      var parts = [];
      if (profile.cls)    parts.push(['Class',  profile.cls]);
      if (profile.level)  parts.push(['Level',  profile.level]);
      if (profile.module) parts.push(['Module', profile.module]);
      if (profile.year)   parts.push(['',       profile.year]);
      chips.innerHTML = parts.map(function (p) {
        // Do not double a label the value already carries: a module stored as
        // "Module 1" must not render as "Module Module 1".
        var v = String(p[1]).trim();
        var label = p[0];
        var text = (label && v.toLowerCase().indexOf(label.toLowerCase()) === 0)
          ? v : (label ? label + ' ' + v : v);
        return '<span class="ph-chip">' + esc(text) + '</span>';
      }).join('');
    }

    // Rebuilt, not hidden - see renderRows().
    renderRows();
  }

  // ── Mounting ─────────────────────────────────────────────────────────────
  // The badge is built once PER MOUNT POINT, not once per page: the student
  // dashboard carries seven headers, one per screen, and a single badge would
  // leave six of them with no way into the profile. Ids are numbered after the
  // first so the document stays valid; painting looks all of them up.
  function makeBadge(n) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = n === 0 ? 'phBadge' : 'phBadge' + n;
    btn.className = 'ph-badge';
    btn.title = 'Your profile';
    btn.setAttribute('data-ph-badge', '');
    btn.innerHTML = '<span class="ph-badge-pic" data-ph-pic></span>'
      + '<span class="ph-badge-txt"><span class="ph-badge-name" data-ph-name>Student</span>'
      + '<span class="ph-badge-sub" data-ph-sub></span></span>';
    btn.addEventListener('click', function () { open(buildPanel()); paint(); paintAvatarGrid(); });
    return btn;
  }

  function mountBadge() {
    // A page says where it wants the badge with [data-profile-hub-mount].
    // Pages with no header of their own get one floating top-right instead.
    var mounts = document.querySelectorAll('[data-profile-hub-mount]');
    if (mounts.length) {
      Array.prototype.forEach.call(mounts, function (m, i) {
        if (m.querySelector('[data-ph-badge]')) return;      // idempotent
        m.appendChild(makeBadge(i));
      });
      return;
    }
    if (document.querySelector('[data-ph-badge]')) return;
    var float = makeBadge(0);
    float.classList.add('ph-float');
    document.body.appendChild(float);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    injectStyle();
    // Paint from cache first so the badge is correct before any network call,
    // then reconcile. Same approach as the toggles and the journey stats.
    profile = readCache() || { name: 'Student', avatar: 'fox', cls: '', level: '', module: '', year: '', role: '' };
    mountBadge();
    buildPanel();
    paint();

    // If the page already loaded the user document, use it and stop.
    //
    // Only stop if it actually carried a NAME. A half-written or empty document
    // still shapes into an object here, and treating that as the answer is how
    // the badge used to settle on "Student" and stay there.
    // The "new answer" dot gets its OWN wait for sign-in, started before
    // anything below can return early. It used to ride on the profile read's
    // wait, and that is skipped entirely when the page has already loaded the
    // user document - so on exactly those loads the dot never appeared.
    supWatchAnswers();

    var live = fromUserDoc(window.currentStudentData);
    if (live) {
      profile = live;
      paint();
      if (live.named) { writeCache(live, currentUid()); return; }
    }

    // Otherwise read it once, only if we have to.
    //
    // LISTEN for sign-in rather than polling for it. The old version asked
    // "is auth ready?" every 150ms and gave up after six seconds - which is
    // fine on a warm desktop and not at all fine on a phone restoring a session
    // over mobile data. When it gave up, the panel was left showing the
    // placeholder name "Student", which is what a phone kept displaying.
    var done = false;
    var dbTries = 0;
    function readFor(uid) {
      if (done || !uid) return;

      // A cached profile belonging to somebody else must not stand. The key is
      // global, so this is the moment we can finally tell.
      if (profile && profile.uid && profile.uid !== uid) {
        profile = { name: 'Student', avatar: 'fox', cls: '', level: '', module: '', year: '', role: '' };
        paint();
      }

      var l2 = fromUserDoc(window.currentStudentData);
      if (l2 && l2.named) { done = true; profile = l2; writeCache(l2, uid); paint(); return; }

      // WAIT for Firestore instead of giving up on it.
      //
      // This used to `return` when window.db was not set yet, and that single
      // line is what made the name disappear. firebase-config assigns window.db
      // a moment AFTER this module boots, so on any page where the session is
      // already live the one attempt landed in that gap and nothing ever asked
      // again. Returning from placement is exactly that shape: warm session,
      // db not yet there, badge stuck on "Student" for the rest of the visit.
      var fsRead = fdb();
      if (!fsRead) {
        if (++dbTries <= 100) setTimeout(function () { readFor(uid); }, 100);
        return;
      }
      done = true;
      try {
        fsRead.collection('users').doc(uid).get().then(function (doc) {
          if (!doc || !doc.exists) { done = false; return; }
          var p = fromUserDoc(doc.data());
          if (!p) { done = false; return; }
          profile = p;
          paint();
          // An unnamed doc is not an answer. Leave the door open so a later
          // auth event can try again rather than caching the placeholder.
          if (p.named) writeCache(p, uid); else done = false;
        }).catch(function () { done = false; });
      } catch (_) { done = false; }
    }

    var tries = 0;
    (function waitForAuth() {
      var a = window.auth || (window.firebase && firebase.auth ? firebase.auth() : null);
      if (!a) {
        // The SDK itself has not parsed yet. This part is genuinely a poll,
        // but it is only waiting on a local script, not on the network.
        if (++tries <= 60) setTimeout(waitForAuth, 100);
        return;
      }
      // Register the listener ALWAYS, then take the immediate shot.
      //
      // The order used to be reversed and the listener was behind an early
      // `return`: with a session already restored, the module took ONE attempt
      // and never subscribed at all. That is the warm-navigation case - coming
      // back to the dashboard from placement - so the one path most likely to
      // run was the one path with no second chance. Subscribing costs nothing,
      // and onAuthStateChanged fires again on every auth change.
      if (typeof a.onAuthStateChanged === 'function') {
        a.onAuthStateChanged(function (u) { if (u) readFor(u.uid); });
      }
      if (a.currentUser) readFor(a.currentUser.uid);
    })();
  }

  // Stop app-settings.js building a gear of its own.
  //
  // Given no [data-app-settings-open] on the page it builds a floating wheel
  // AND calls placeInHeader(), which is why a gear reappeared next to the
  // Lingualab title after the header ones were removed. Hiding the launcher by
  // id was not enough, because placeInHeader moves it into the page's header.
  //
  // A hidden opener settles it properly: app-settings decides BEFORE building,
  // so with one present it makes no launcher and places nothing.
  // data-app-settings-plain keeps it from painting a 44px gear box onto this
  // element. It runs at PARSE time, not on DOMContentLoaded, because
  // app-settings mounts on DOMContentLoaded and registers its handler first.
  (function ensureSettingsOpener() {
    try {
      if (document.querySelector('[data-app-settings-open]')) return;
      var host = document.body || document.documentElement;
      if (!host) return;
      var s = document.createElement('span');
      s.id = 'phSettingsOpener';
      s.setAttribute('data-app-settings-open', '');
      s.setAttribute('data-app-settings-plain', '');
      s.setAttribute('aria-hidden', 'true');
      s.style.display = 'none';
      host.appendChild(s);
    } catch (_) {}
  })();

  window.ProfileHub = {
    open: function () { open(buildPanel()); paint(); },
    refresh: paint,
    _avatars: AVATARS
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
