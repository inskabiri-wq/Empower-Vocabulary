/* ============================================================
   ORG BRAND - the university's own mark, beside Lingualab's
   ------------------------------------------------------------
   Shows the signed-in user's university logo in the middle of the page
   header, chosen from their email domain.

   IT IS AN ADDITION, NEVER A SWAP. The Lingualab cap and wordmark are not
   touched. This fills a mount that sits between them and the profile chip -
   the space that is empty today. Every "no logo" case below simply means
   nothing is added and the header looks exactly as it always has.

   WHERE THE DATA COMES FROM, AND WHY IT COSTS NOTHING
   ---------------------------------------------------
   Domain to university is already solved: settings/organizations carries a
   `list` of { name, domain, ... } and OrgRegistry.checkEmail(email) returns
   the matching entry. That document is admin-only writable and publicly
   readable, so a client cannot invent a university for itself.

   The logo filename is a new `logo` field on each list entry, e.g.
   "fsmvu-seal.png". NO `logo` FIELD MEANS NOTHING IS ADDED - a tenant that
   has not supplied one keeps today's design rather than showing a broken
   image.

   The role is read from window.currentStudentData, which student/js/auth.js
   already publishes from the user document it loads anyway. No extra read is
   issued here.

   WHO GETS NO LOGO
   ----------------
   - anyone not signed in
   - anonymous users: the classroom mini-games sign in anonymously and have no
     email at all
   - DEMO ACCOUNTS. This is the non-obvious one. demo.teacher@fsm.edu.tr and
     demo.student@fsm.edu.tr are on the FSM domain, so matching on email alone
     would hand them the university's mark during a stakeholder demo. The role
     is checked for exactly this.
   ============================================================ */
(function () {
  'use strict';

  var MOUNT_SEL = '[data-org-mark]';
  var applied = null;          // remembers the last logo painted, to avoid churn
  var decided = false;         // a decision was made with the user document in hand

  // FSMVU's seal is the DEFAULT for its two domains, in code.
  //
  // It used to come only from a `logo` field typed into Admin > Organizations,
  // and on 2026-09-23 production still had none - the list had not been saved
  // since May - so the header drew nothing and "I still can't see the logo" was
  // the correct behaviour of an empty field. FSMVU is the home university, has
  // granted use of its seal, and the file ships with the app, so nothing should
  // depend on someone remembering to type a filename.
  //
  // A `logo` set in Admin > Organizations still WINS over this, and every other
  // university still needs one set there (they supply their own file).
  var DEFAULT_LOGOS = {
    'fsm.edu.tr': 'fsmvu-seal.png',
    'stu.fsm.edu.tr': 'fsmvu-seal.png'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mounts() {
    return Array.prototype.slice.call(document.querySelectorAll(MOUNT_SEL));
  }

  function clear() {
    applied = null;
    mounts().forEach(function (el) {
      el.innerHTML = '';
      el.hidden = true;
      el.classList.remove('is-floating', 'no-room');
    });
  }

  // ── Where the mark goes ──────────────────────────────────────────────────
  // It FLOATS, at every width and on both dashboards: measured into the empty
  // space between the END OF THE TITLE TEXT and the next thing on that same
  // line, at the true centre of the header when that is free, and level with
  // that neighbour - the avatar - so the two round marks line up. (Asked for
  // 2026-09-23: "for phone aligned". It used to be a flex item on a laptop,
  // which put it 19px off centre and 8px above the avatar, and it was hidden
  // on phones altogether.)
  //
  // WHY MEASURE INSTEAD OF RE-LAYING THE HEADER. Six of the seven student
  // headers have a back button before the title, one subtitle cycles its
  // words, and the text-size setting rescales all of it. Giving the mark a
  // flex slot on a phone squeezed the title block from 241px to 193px and
  // pushed the subtitle onto an extra line. Floating into space that is
  // already empty changes nothing else in the header, and where there is not
  // enough space the mark is HIDDEN rather than laid over anything.
  var PHONE = '(max-width: 720px)';
  function floats() { return true; }
  // The box of the TEXT, not of the element: an h1 is a block and its own box
  // runs to the edge of its container, which would leave no gap at all.
  function textBox(node) {
    if (!node) return null;
    try {
      var r = document.createRange();
      r.selectNodeContents(node);
      var b = r.getBoundingClientRect();
      if (b.width || b.height) return b;
    } catch (e) {}
    var b2 = node.getBoundingClientRect();
    return (b2.width || b2.height) ? b2 : null;
  }
  function boxOf(node) {
    if (!node) return null;
    var b = node.getBoundingClientRect();
    return (b.width && b.height) ? b : null;
  }

  // Everything on the mark's own line is an obstacle: the title TEXT and the
  // subtitle TEXT (not their block boxes, which run to the edge), any back
  // button, the avatar, the teacher header's small Lingualab brand and its
  // period dropdown. The free gaps between them are where the mark may go.
  //
  // The teacher header is why this is general rather than "right of the
  // title": it spreads brand, title and dropdown across the row, and on tabs
  // with no dropdown the TITLE moves to the far right - the old rule then put
  // the mark over the subtitle.
  function place(el) {
    var hdr = el.parentElement;
    if (!hdr || el.hidden) return;
    var hb = hdr.getBoundingClientRect();
    if (!hb.width || !hb.height) return;          // a screen not shown yet: placed when it is
    var cs = window.getComputedStyle(hdr);
    var left = hb.left + (parseFloat(cs.paddingLeft) || 0);
    var right = hb.right - (parseFloat(cs.paddingRight) || 0);
    var titleEl = hdr.querySelector(el.getAttribute('data-org-title') || 'h1');
    var subEl = hdr.querySelector(el.getAttribute('data-org-sub') || '.subtitle');
    var tb = textBox(titleEl);
    var sb = textBox(subEl);
    var nb = hdr.querySelector(el.getAttribute('data-org-right') || '.header-right');
    var rb = boxOf(nb);
    // 34px is the size it always had on a laptop; smaller where space is tight.
    var size = hb.width < 480 ? 26 : (hb.width < 720 ? 30 : 34);

    // LEVEL: with the avatar when it shares the title's line, so the two round
    // marks line up (student dashboard). With the title otherwise - including
    // the teacher dashboard (data-org-level="title"), whose neighbour is a
    // dropdown, not an avatar.
    var onTitleLine = rb && tb && !(rb.bottom <= tb.top || rb.top >= tb.bottom);
    var byTitle = el.getAttribute('data-org-level') === 'title';
    var level = (!byTitle && onTitleLine) ? rb : (tb || hb);
    var cy = level.top + level.height / 2;
    var top = cy - size / 2, bottom = cy + size / 2;

    var blocked = [];
    function add(b) { if (b && b.bottom > top && b.top < bottom) blocked.push([b.left - 10, b.right + 10]); }
    add(tb);
    add(sb);
    Array.prototype.forEach.call(hdr.children, function (c) {
      if (c === el) return;
      if (titleEl && c.contains(titleEl)) {
        // The title's own block: only what else sits inside it (a back
        // button). The title and subtitle are counted by their text above.
        Array.prototype.forEach.call(c.children, function (k) {
          if (k === titleEl || k === subEl || k.contains(titleEl) || (subEl && k.contains(subEl))) return;
          add(boxOf(k));
        });
        return;
      }
      add(boxOf(c));
    });

    blocked.sort(function (a, b) { return a[0] - b[0]; });
    var free = [], x = left;
    blocked.forEach(function (o) { if (o[0] > x) free.push([x, o[0]]); x = Math.max(x, o[1]); });
    if (right > x) free.push([x, right]);
    free = free.filter(function (f) { return f[1] - f[0] >= size; });

    el.classList.add('is-floating');
    if (!free.length) { el.classList.add('no-room'); return; }
    el.classList.remove('no-room');

    // The true centre of the header when it is free - how a laptop looks.
    // Otherwise the space straight after the title (title, then mark), and
    // failing that the widest space there is.
    var mid = hb.left + hb.width / 2, cx = null;
    free.forEach(function (f) { if (cx === null && mid - size / 2 >= f[0] && mid + size / 2 <= f[1]) cx = mid; });
    if (cx === null) {
      var after = tb ? free.filter(function (f) { return f[0] >= tb.right; })[0] : null;
      var pick = after || free.slice().sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); })[0];
      cx = (pick[0] + pick[1]) / 2;
    }
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = Math.round(cx - size / 2 - hb.left - hdr.clientLeft) + 'px';
    el.style.top = Math.round(top - hb.top - hdr.clientTop) + 'px';
  }
  var placeTimer = null;
  function placeAll() { mounts().forEach(place); }
  // setTimeout, not requestAnimationFrame: a hidden or background tab never
  // runs animation frames, and the mark would then never be placed there.
  function schedulePlace() { clearTimeout(placeTimer); placeTimer = setTimeout(placeAll, 30); }
  function watchLayout() {
    window.addEventListener('resize', schedulePlace);
    try { window.matchMedia(PHONE).addEventListener('change', schedulePlace); } catch (e) {}
    // A header resizes when its screen is shown (from 0 to real size) and
    // when the text size changes; the title's TEXT changes when the teacher
    // dashboard switches tab ("Good afternoon" -> "Students").
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedulePlace);
      mounts().forEach(function (el) { if (el.parentElement) ro.observe(el.parentElement); });
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(schedulePlace);
      mounts().forEach(function (el) {
        var t = el.parentElement && el.parentElement.querySelector(el.getAttribute('data-org-title') || 'h1');
        if (t) mo.observe(t, { childList: true, characterData: true, subtree: true });
      });
    }
  }

  // Make the configured filename work from any page depth.
  //
  // The org document stores a bare name like "fsmvu-seal.png", which as a
  // relative URL resolves against whatever directory the page sits in. Every
  // page that mounts this is at the site root today, so it happened to work -
  // but a page one folder down would silently request a file that is not
  // there and render a broken image. Anchoring to the root removes that
  // entirely. An absolute URL or an already-rooted path is left alone.
  function logoUrl(logo) {
    var s = String(logo || '');
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s) || s.charAt(0) === '/') return s;
    return '/' + s;
  }

  // The hub's boot hold (student-dashboard.html) waits for the header to be
  // final: a seal that has loaded and been placed, or no seal at all.
  // LLHubBoot exists on that page only, so everywhere else this does nothing.
  function settled() {
    try { if (window.LLHubBoot) { placeAll(); LLHubBoot.ready('logo'); } } catch (e) {}
  }
  // `complete` is true once the image has either loaded or failed, so a seal
  // that already failed settles at once instead of costing the hold's cap.
  // Listening twice is harmless: the same function is only added once.
  function settleWhenLoaded() {
    if (!window.LLHubBoot) return;
    var img = document.querySelector(MOUNT_SEL + ' .org-mark-img');
    if (!img || img.complete) settled();
    else { img.addEventListener('load', settled); img.addEventListener('error', settled); }
  }

  function paint(org) {
    var logo = org && (org.logo || DEFAULT_LOGOS[String(org.domain || '').toLowerCase()]);
    if (!logo) { clear(); settled(); return; }
    if (applied === logo) { settleWhenLoaded(); return; }
    applied = logo;
    var label = (org.name || 'University') + ' logo';
    mounts().forEach(function (el) {
      el.innerHTML = '<img class="org-mark-img" src="' + esc(logoUrl(logo)) +
        '" alt="' + esc(label) + '" title="' + esc(org.name || '') + '">';
      el.hidden = false;
    });
    schedulePlace();
    settleWhenLoaded();
  }

  // The one decision. Kept separate so it can be reasoned about on its own.
  //
  // DEMO ACCOUNTS are marked by `demoAccount: true` on the user document
  // (functions/index.js createDemoAccount), with an ordinary role of student or
  // teacher. This used to check only role === 'demo', which no account has, so
  // the demo logins would have got the FSM seal the moment a logo existed.
  // role === 'demo' is kept as well in case anything ever sets it.
  function orgFor(email, userDoc) {
    if (!email) return null;                       // signed out, or anonymous
    var d = userDoc || {};
    if (d.demoAccount === true) return null;
    if (String(d.role || '').toLowerCase() === 'demo') return null;
    if (!window.OrgRegistry || !OrgRegistry.checkEmail) return null;
    var res = null;
    try { res = OrgRegistry.checkEmail(email); } catch (e) { return null; }
    if (res && res.ok && res.org) return res.org;
    // An ALLOWED FSM domain with no row in the list still gets its seal. The
    // registry always unions the built-in FSM domains into the allowed set, so
    // a missing row does not lock anyone out - and it should not quietly take
    // the logo away either (it did, in testing, after a row went missing).
    var dom = res && String(res.domain || '').toLowerCase();
    if (res && res.ok && dom && DEFAULT_LOGOS[dom]) return { domain: dom, name: 'FSM University' };
    return null;
  }

  // The student pages publish window.currentStudentData. The teacher dashboard
  // keeps its user document in a top-level `let currentUserData` in
  // teacher/js/config.js - visible BY NAME to this classic script, but never a
  // window property, so window.currentUserData is always undefined there.
  function userDoc() {
    if (window.currentStudentData) return window.currentStudentData;
    if (window.currentUserData) return window.currentUserData;
    try { if (typeof currentUserData !== 'undefined' && currentUserData) return currentUserData; } catch (e) {}
    return null;
  }

  function currentUser() {
    try {
      var a = window.auth || (window.firebase && firebase.apps && firebase.apps.length
        ? firebase.auth() : null);
      return a ? a.currentUser : null;
    } catch (e) { return null; }
  }

  function refresh() {
    if (!mounts().length) return;                  // page has no mount: nothing to do
    var u = currentUser();
    if (!u || u.isAnonymous || !u.email) { clear(); return; }
    var d = userDoc();
    // Wait for the user document. Without it a demo account cannot be told
    // apart, and painting first would put the seal on a stakeholder demo -
    // and the polling below used to STOP as soon as anything was painted, so
    // the wrong logo would have stayed. A short wait is fine: he said a flash
    // on load is acceptable.
    if (!d) return;
    decided = true;
    paint(orgFor(u.email, d));
  }

  // OrgRegistry loads settings/organizations asynchronously, and the user
  // document lands separately, so refresh on every signal rather than once.
  function wire() {
    watchLayout();
    refresh();
    try {
      if (window.OrgRegistry && OrgRegistry.subscribe) OrgRegistry.subscribe(refresh);
    } catch (e) {}
    try {
      var a = window.auth || (window.firebase && firebase.apps && firebase.apps.length
        ? firebase.auth() : null);
      if (a && a.onAuthStateChanged) a.onAuthStateChanged(refresh);
    } catch (e) {}
    // The header may paint before the user document arrives. A few cheap
    // re-checks cost nothing and mean the logo appears as soon as it can.
    // Stops once a decision has been made WITH the user document, not merely
    // once something was painted. 40 x 500ms covers a slow phone on campus wifi;
    // for anything slower, the two dashboards call LLOrgBrand.refresh() the
    // moment the user document lands (student/js/auth.js, teacher/js/config.js).
    var tries = 0;
    var poll = setInterval(function () {
      refresh();
      if (++tries >= 40 || decided) clearInterval(poll);
    }, 500);
  }

  // Exposed so a page that holds the user document somewhere else can say so
  // directly, instead of this guessing.
  window.LLOrgBrand = {
    refresh: refresh,
    // Re-measure the floating mark now. Pages never need it - resize, the
    // resize observer and the title observer call it - but a test pane that is
    // not rendering delivers none of those events, and a test must be able to
    // ask for the placement it is about to measure.
    place: placeAll,
    apply: function (userData) {
      var u = currentUser();
      if (!u || u.isAnonymous || !u.email) { clear(); return; }
      decided = true;
      paint(orgFor(u.email, userData || null));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
