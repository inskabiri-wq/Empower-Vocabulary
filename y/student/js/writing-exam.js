/* ============================================================
   WRITING EXAM — Phase 3 (student side, page-level controller)

   Loaded by /writing-exam.html. Reads ?assignmentId=... from the URL,
   pulls the assignment from Firestore, displays the prompt in the
   right pane, opens a secure editor in the left pane, runs the
   countdown timer, auto-saves the draft every 5 seconds, and
   submits on click or on timeout.

   Security model — see HARDENING section below.
   ============================================================ */

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  const state = {
    user:         null,                       // Firebase Auth user
    assignmentId: null,                       // from URL
    assignment:   null,                       // Firestore doc data
    startedAt:    null,                       // ms epoch when editor became active
    timerEnd:     null,                       // ms epoch
    timerHandle:  null,
    saveHandle:   null,
    submitted:    false,
    wordCount:    0,
    // Phase C: preview mode (?preview=1 in the URL). Teachers can open
    // the writing exam to see what a student sees — security lockdown
    // is still in effect (so they can test it), but nothing is saved
    // and no draft is restored / persisted.
    preview:      false
  };

  // ── DOM refs ────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    [
      'wrLoading','wrTopbar','wrStage','wrDone','wrDoneRecap',
      'wrTitle','wrSubtitle','wrPromptBody','wrPromptMeta',
      'wrEditor','wrWordCount','wrWordTarget','wrTimer',
      'wrSettingsBtn','wrSettingsCloseBtn','wrSettingsPanel','wrSettingsOverlay',
      'wrThemeRow','wrScaleRow','wrSpacingRow','wrFontRow','wrSettingsResetBtn',
      'wrSubmitBtn','wrSubmitConfirm','wrSubmitConfirmMsg',
      'wrSubmitCancelBtn','wrSubmitConfirmBtn'
    ].forEach(id => { els[id] = $(id); });

    bootstrap();
  });

  // ── Bootstrap: auth → load assignment → wire UI → start ────
  async function bootstrap() {
    // Auth gate. Redirect to login if not signed in.
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }
      // Verified-email gate (same logic as student-dashboard.html).
      if (!user.emailVerified) {
        await auth.signOut();
        window.location.href = 'index.html';
        return;
      }
      state.user = user;

      // Load the student's user doc so the submitted session can be
      // stamped with studentClass / studentLevel / studentModule. The
      // teacher dashboard scopes session reads by these fields, so
      // writing sessions without them would be invisible to non-admin
      // teachers. We tolerate failure here (it's not blocking the exam).
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          window.currentStudentData = userDoc.data();
        }
      } catch (_) { /* non-fatal */ }

      // Provide the same studentScopeFields() helper that the
      // student-dashboard page exposes, so the submit handler below
      // works the same way without depending on that page's scripts.
      if (typeof window.studentScopeFields !== 'function') {
        window.studentScopeFields = function () {
          const d = window.currentStudentData || {};
          return {
            studentClass:  d.studentClass  || '',
            studentLevel:  d.level         || '',
            studentModule: d.module        || ''
          };
        };
      }

      // Pull assignment by id from URL.
      const params = new URLSearchParams(window.location.search);
      const id = params.get('assignmentId') || params.get('id');
      if (!id) {
        showFatal('No assignment specified. Open this page via your dashboard.');
        return;
      }
      state.assignmentId = id;
      // Preview mode flag — set by teachers opening the page from the
      // dashboard's Preview button. Disables save, restores no draft,
      // shows a banner so the user can't mistake it for the real exam.
      state.preview = (params.get('preview') === '1');

      try {
        const snap = await db.collection('assignments').doc(id).get();
        if (!snap.exists) {
          showFatal('This assignment does not exist or has been removed.');
          return;
        }
        const a = snap.data();
        if ((a.skill || 'vocabulary') !== 'writing') {
          showFatal('This assignment is not a writing exam.');
          return;
        }
        state.assignment = a;
        renderShell(a);
        wireSecurity();
        wireUI();
        wireSettings();
        installAutoSaveAndRestoreDraft();
        startTimer(a.timeLimit);
        revealEditor();
      } catch (err) {
        console.error('Failed to load assignment:', err);
        showFatal('Could not load this assignment. ' + (err.message || ''));
      }
    });
  }

  function showFatal(msg) {
    const splash = els.wrLoading;
    if (!splash) return;
    splash.innerHTML = `
      <div style="font-size: 3em;">⚠️</div>
      <div style="color: var(--wr-text); font-weight: 700; margin-top: 8px;">${escapeHtml(msg)}</div>
      <a href="student-dashboard.html" style="color: var(--wr-accent); margin-top: 14px; text-decoration: underline;">Back to dashboard</a>
    `;
    splash.classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Render: prompt / meta / title ──────────────────────────
  function renderShell(a) {
    els.wrTitle.textContent    = a.title || 'Writing Exam';
    els.wrSubtitle.textContent = (typeof formatQuestionType === 'function')
      ? formatQuestionType(a.questionType)
      : (a.questionType || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    els.wrPromptBody.textContent = a.prompt || '';

    const meta = [];
    if (a.questionType)   meta.push(`<div><strong>Type:</strong> ${escapeHtml(formatQuestionType(a.questionType))}</div>`);
    if (a.level)          meta.push(`<div><strong>Level:</strong> ${escapeHtml(a.level)}</div>`);
    if (a.timeLimit)      meta.push(`<div><strong>Time limit:</strong> ${a.timeLimit} min</div>`);
    if (a.targetWords)    meta.push(`<div><strong>Target words:</strong> ${a.targetWords}</div>`);
    if (a.minWords)       meta.push(`<div><strong>Minimum words:</strong> ${a.minWords}</div>`);
    if (a.autoSubmit)     meta.push(`<div style="color: var(--wr-warning);">⏱ Auto-submits when the timer ends.</div>`);
    els.wrPromptMeta.innerHTML = meta.join('');

    // Word-count target hint (top-bar)
    if (a.targetWords) {
      els.wrWordTarget.textContent = ` / ${a.targetWords}`;
    }

    // Phase G.4 — surface the rubric (if attached) below the prompt
    // so students know what they're being graded on BEFORE they write.
    // Two sources: free-form text on the assignment OR a link to an
    // external PDF/Doc. Show either or both. Collapsible so it
    // doesn't crowd the prompt; auto-injected beneath the prompt body.
    const rubricText = String(a.rubric || '').trim();
    const rubricUrl  = String(a.rubricUrl || '').trim();
    if (rubricText || rubricUrl) {
      injectRubricPanel(rubricText, rubricUrl);
    }
  }

  function injectRubricPanel(rubricText, rubricUrl) {
    // Idempotent — only inject once per session.
    if (document.getElementById('wrRubricPanel')) return;
    const anchor = els.wrPromptMeta?.parentElement || els.wrPromptBody?.parentElement;
    if (!anchor) return;
    const panel = document.createElement('details');
    panel.id = 'wrRubricPanel';
    panel.open = true;
    panel.style.cssText = [
      'background: rgba(45, 212, 191, 0.08)',
      'border: 1px solid rgba(45, 212, 191, 0.30)',
      'border-radius: 10px',
      'padding: 10px 14px',
      'margin-top: 10px'
    ].join(';');
    const urlLink = rubricUrl ? `
      <div style="margin-top: 10px;">
        <a href="${escapeHtml(rubricUrl)}" target="_blank" rel="noopener"
           style="display: inline-flex; align-items: center; gap: 6px;
                  background: rgba(45, 212, 191, 0.18); color: #99f6e4;
                  border: 1px solid rgba(45, 212, 191, 0.40);
                  padding: 6px 12px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 0.88em;">
          📎 Open rubric file →
        </a>
      </div>
    ` : '';
    const textBlock = rubricText ? `
      <div style="margin-top: 8px; color: var(--wr-text, #e2e8f0);
                  line-height: 1.6; white-space: pre-wrap;
                  font-size: 0.92em;">${escapeHtml(rubricText)}</div>
    ` : '';
    panel.innerHTML = `
      <summary style="cursor: pointer; font-weight: 700; color: #5eead4;
                      font-size: 0.78em; letter-spacing: 0.06em;
                      text-transform: uppercase;">
        📋 Rubric — what you'll be graded on
      </summary>
      ${textBlock}
      ${urlLink}
    `;
    anchor.appendChild(panel);
  }

  function formatQuestionType(t) {
    if (!t) return '';
    return String(t).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function revealEditor() {
    els.wrLoading.classList.add('hidden');
    els.wrTopbar.style.display = 'flex';
    els.wrStage.style.display  = 'grid';

    if (state.preview) {
      injectPreviewBanner();
      // No draft restore in preview — teachers shouldn't pick up a
      // student's in-flight draft, and we don't want their typing
      // to overwrite anyone else's.
    } else {
      // Three modes, chosen by the prior writingSubmissions status:
      //   • no submission yet           → blank editor + draft restore
      //   • status 'submitted'/'graded' → READ-ONLY LOCK — student has
      //     already turned this in and the timer must not reset.
      //     They wait until the teacher returns or grades.
      //   • status 'returned'           → editable + revision banner
      (async () => {
        const prevSubmission = await loadPreviousSubmission();
        const prevStatus = prevSubmission?.status || null;

        if (prevStatus === 'submitted' || prevStatus === 'graded') {
          // Hard-lock — bail before wiring the editor / timer.
          renderAlreadySubmitted(prevSubmission);
          return;
        }

        const prevText = prevSubmission?.responseText || null;
        const draft    = loadDraft();
        const text     = prevText || draft;
        if (text) {
          els.wrEditor.textContent = text;
          updateWordCount();
        }
        if (prevStatus === 'returned') {
          showRevisionBanner(prevSubmission);
        }
      })();
    }
    setTimeout(() => els.wrEditor.focus(), 50);
  }

  // Phase G fix — When a student opens an assignment they've already
  // submitted (and that hasn't been returned), we DON'T want them to
  // see a fresh editor with their text auto-loaded and a new timer.
  // Instead, render a polite read-only screen that explains the state
  // and offers a "Back to dashboard" link. The submit/timer wiring is
  // never reached, so there's no way to resubmit by accident.
  function renderAlreadySubmitted(submission) {
    // Stop any timer that might already be ticking.
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
    // Stop the auto-save interval so it doesn't keep overwriting
    // the localStorage draft with an empty editor's content.
    if (state.saveHandle) {
      clearInterval(state.saveHandle);
      state.saveHandle = null;
    }
    // Hide the active workspace + topbar.
    if (els.wrStage)   els.wrStage.style.display = 'none';
    if (els.wrTopbar)  els.wrTopbar.style.display = 'none';
    // Tear down the unload warning — the student has nothing to lose now.
    state.submitted = true;

    const status = submission?.status || 'submitted';
    const submittedAt = submission?.submittedAt?.toDate
      ? submission.submittedAt.toDate()
      : (submission?.submittedAt ? new Date(submission.submittedAt) : null);
    const subAtTxt = submittedAt
      ? submittedAt.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';

    const score    = submission?.score;
    const comment  = String(submission?.teacherComment || '').trim();
    const gradedAt = submission?.gradedAt?.toDate
      ? submission.gradedAt.toDate()
      : (submission?.gradedAt ? new Date(submission.gradedAt) : null);
    const gradedAtTxt = gradedAt
      ? gradedAt.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';

    const splash = els.wrLoading;
    if (!splash) return;
    splash.innerHTML = `
      <div style="max-width: 600px; margin: 40px auto; padding: 0 20px;
                  text-align: center; color: var(--wr-text, #e2e8f0);">
        <div style="font-size: 3.5em;">${status === 'graded' ? '✅' : '⏳'}</div>
        <h2 style="margin: 12px 0 6px;">You've already submitted this.</h2>
        <div style="color: var(--wr-text-muted, #94a3b8); font-size: 0.95em; line-height: 1.55; margin-bottom: 18px;">
          ${status === 'graded'
            ? 'Your teacher has graded it. The essay is final — you can\'t edit it.'
            : 'Your essay is with your teacher. You\'ll see a notification on your dashboard when they grade or return it.'}
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.10);
                    border-radius: 10px; padding: 14px 18px;
                    text-align: left; font-size: 0.92em;">
          ${subAtTxt ? `<div><strong>Submitted:</strong> ${escapeHtml(subAtTxt)}</div>` : ''}
          ${submission?.wordCount != null ? `<div><strong>Words written:</strong> ${submission.wordCount}</div>` : ''}
          <div><strong>Status:</strong> ${status === 'graded' ? 'Graded' : status === 'returned' ? 'Returned' : 'Submitted (awaiting grade)'}</div>
          ${score != null ? `<div><strong>Score:</strong> ${score} / 20</div>` : ''}
          ${gradedAtTxt ? `<div><strong>Graded on:</strong> ${escapeHtml(gradedAtTxt)}</div>` : ''}
        </div>

        ${comment ? `
          <div style="margin-top: 14px; text-align: left;
                      background: rgba(168, 85, 247, 0.08);
                      border-left: 3px solid #a855f7; border-radius: 8px;
                      padding: 12px 16px; line-height: 1.55;
                      white-space: pre-wrap; font-size: 0.95em;">
            <div style="font-weight: 700; color: #c4b5fd; font-size: 0.8em;
                        letter-spacing: 0.05em; text-transform: uppercase;
                        margin-bottom: 6px;">💬 Teacher's comment</div>
            ${escapeHtml(comment)}
          </div>
        ` : ''}

        <a href="student-dashboard.html"
           style="display: inline-block; margin-top: 22px;
                  background: linear-gradient(135deg, #6366f1, #4f46e5);
                  color: white; padding: 10px 22px; border-radius: 10px;
                  text-decoration: none; font-weight: 600;">
          ← Back to dashboard
        </a>
      </div>
    `;
    splash.classList.remove('hidden');
  }

  // Phase F.4 — fetch the existing writingSubmissions doc (if any) so
  // the editor can pre-load the previous text on a revision.
  async function loadPreviousSubmission() {
    if (!state.user || !state.assignmentId) return null;
    try {
      const ref = db.collection('writingSubmissions')
        .doc(`${state.user.uid}_${state.assignmentId}`);
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('Could not load previous submission:', e);
      return null;
    }
  }

  // Phase F.4 — visible "your teacher returned this" banner shown at
  // the top of the editor when the student is revising. Surfaces the
  // teacher's comment prominently so the student knows what to fix.
  function showRevisionBanner(submission) {
    if (document.getElementById('wrRevisionBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'wrRevisionBanner';
    banner.style.cssText = [
      'background: linear-gradient(135deg, #f59e0b, #d97706)',
      'color: white', 'padding: 14px 18px', 'margin: 0 0 14px 0',
      'border-radius: 10px', 'font-size: 0.92em', 'line-height: 1.5',
      'box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25)'
    ].join(';');
    banner.innerHTML = `
      <div style="font-weight: 800; margin-bottom: 4px; font-size: 1.05em;">
        🔄 Returned for revision
      </div>
      <div style="opacity: 0.95;">
        Your teacher returned this submission with notes. Edit your response below and re-submit.
      </div>
      ${submission.teacherComment ? `
        <div style="background: rgba(255,255,255,0.20); border-radius: 8px;
                    padding: 10px 14px; margin-top: 10px; font-style: italic;
                    border-left: 3px solid rgba(255,255,255,0.55);">
          ${escapeHtml(submission.teacherComment)}
        </div>
      ` : ''}
    `;
    // Try to drop the banner into the topmost reasonable container
    // inside the editor stage. Falls back to the body if structure
    // varies between page versions.
    const target = els.wrStage || els.wrEditor?.parentElement || document.body;
    if (target && target.firstChild) {
      target.insertBefore(banner, target.firstChild);
    } else if (target) {
      target.appendChild(banner);
    }
  }

  function injectPreviewBanner() {
    // Banner along the top of the topbar plus a swapped submit button.
    const banner = document.createElement('div');
    banner.id = 'wrPreviewBanner';
    banner.style.cssText = [
      'background:linear-gradient(135deg,#a78bfa,#7c3aed)',
      'color:#fff', 'font-weight:700', 'text-align:center',
      'padding:6px 12px', 'font-size:0.9em',
      'box-shadow:0 2px 6px rgba(0,0,0,0.2)'
    ].join(';');
    banner.textContent = '👁️ PREVIEW MODE — teacher view. Nothing is saved.';
    document.body.insertBefore(banner, document.body.firstChild);

    // Replace submit handler with a close-window handler.
    if (els.wrSubmitBtn) {
      els.wrSubmitBtn.textContent = '✕ Close Preview';
      els.wrSubmitBtn.onclick = () => {
        try { window.close(); } catch (_) {}
        // If the page wasn't opened by script, window.close() is a no-op.
        // Fall back to navigating away.
        if (!window.closed) {
          window.location.href = 'teacher-dashboard.html';
        }
      };
    }
  }

  // ============================================================
  // HARDENING — secure-exam lockdown.
  //
  // This is defense-in-depth: each layer alone won't stop every
  // cheating attempt, but combined they make casual copy/paste,
  // spellcheck, drag-text-in, and right-click impossible without
  // dev-tools level effort.
  //
  // Layers:
  //   1. HTML attributes on the editor (spellcheck/autocorrect
  //      /autocapitalize off, Grammarly opt-outs, translate=no).
  //   2. CSS user-select: none on chrome; text on editor with
  //      selection background made invisible.
  //   3. JS event blocks on the WHOLE window for: contextmenu,
  //      copy, cut, paste, dragstart, drop, beforeinput
  //      (when type is anything other than insertText).
  //   4. JS keyboard block on Ctrl/Cmd combos: C V X A S P R U,
  //      Shift+Ins, F12, Tab leaking out, etc.
  //   5. selectionchange listener clears any non-cursor selection
  //      so the user can't even visually highlight then drag.
  //   6. Visibility / blur detection logs to the session record
  //      so teachers see how often the student left the tab.
  // ============================================================
  function wireSecurity() {
    const ed = els.wrEditor;

    // Hard-block clipboard events on the entire document.
    ['copy','cut','paste'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, true);
    });

    // Block native context menu.
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    }, true);

    // Block drag-and-drop into editor.
    ['dragstart','dragover','dragend','drop','dragenter','dragleave'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        e.preventDefault();
        return false;
      }, true);
    });

    // Strip formatting / block non-text input on the editor.
    ed.addEventListener('beforeinput', (e) => {
      // inputType list: https://www.w3.org/TR/input-events/#interface-InputEvent-Attributes
      // We allow plain typing + deletion + line breaks. Everything else
      // (paste, drag-drop insert, formatting commands, AI assistance
      // insertions, formatted text from voice input) is rejected.
      const allowed = new Set([
        'insertText',
        'insertParagraph',         // Enter
        'insertLineBreak',         // Shift+Enter
        'deleteContentBackward',   // Backspace
        'deleteContentForward',    // Delete
        'deleteWordBackward',
        'deleteWordForward',
        'deleteHardLineBackward',
        'deleteHardLineForward',
        'deleteSoftLineBackward',
        'deleteSoftLineForward',
        'insertReplacementText'    // some IME edge cases
      ]);
      if (!allowed.has(e.inputType)) {
        e.preventDefault();
      }
      // Even when inputType is insertReplacementText (used by predictive
      // text on some keyboards), strip any HTML formatting from the data.
      if (e.dataTransfer) {
        e.preventDefault();
      }
    }, true);

    // Belt-and-suspenders: any "input" that mutates innerHTML beyond
    // plain text → revert. (Shouldn't trigger thanks to the above, but
    // catches IME / mobile-keyboard edge cases that bypass beforeinput.)
    ed.addEventListener('input', () => {
      // contenteditable can introduce <br>, <div>, <span> from various
      // sources. We only care that the visible text is plain — runtime
      // styling comes from CSS, not inline tags.
      // Word-count update on every input.
      updateWordCount();
    });

    // Keyboard shortcuts: block Ctrl/Cmd + clipboard / save / print
    // / view-source / find / select-all / reload, plus F-keys that open
    // dev tools or help on some browsers.
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key  = (e.key || '').toLowerCase();

      // Block dev-tools / view-source / reload / find
      if (key === 'f12' || (ctrl && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))) {
        e.preventDefault();
        return;
      }
      if (ctrl && ['s','p','r','u','f','o','h'].includes(key)) {
        e.preventDefault();
        return;
      }
      // Block clipboard + select-all
      if (ctrl && ['c','v','x','a'].includes(key)) {
        e.preventDefault();
        return;
      }
      // Block Shift+Insert (paste alias on Windows/Linux)
      if (e.shiftKey && key === 'insert') {
        e.preventDefault();
        return;
      }
    }, true);

    // Selection guard — clear any non-collapsed selection while typing.
    // The cursor (collapsed selection) is fine; an actual highlighted
    // range is not. This prevents "select all → drag out" workflows.
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      // Only enforce when the selection is INSIDE the editor — selecting
      // text in the prompt pane (read-only) is fine.
      const anchor = sel.anchorNode;
      if (!anchor) return;
      const inEditor = ed.contains(anchor);
      if (inEditor) {
        // Allow short selection for cursor placement / delete; clear
        // anything longer.
        if (sel.toString().length > 0) {
          // Don't fight every selection — only clear when explicitly
          // long. Letting users select a single character for replace
          // is OK; large selections are not.
          if (sel.toString().length > 5) {
            sel.removeAllRanges();
          }
        }
      }
    }, true);

    // Disable image / file drop on the editor (extra safety).
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Tab visibility / blur — track for the session record.
    state.focusLog = { switches: 0, blurMs: 0, lastBlur: 0 };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.focusLog.switches++;
        state.focusLog.lastBlur = Date.now();
      } else if (state.focusLog.lastBlur) {
        state.focusLog.blurMs += (Date.now() - state.focusLog.lastBlur);
        state.focusLog.lastBlur = 0;
      }
    });

    // beforeunload warning — student leaves before submit → confirm.
    window.addEventListener('beforeunload', (e) => {
      if (state.submitted) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    });

    // Phone back-button trap. The browser's default behaviour from
    // this standalone page is "go back to whatever was before in
    // history" — which on a fresh visit is the previous external
    // page (not the dashboard). Push a sentinel so popstate fires,
    // then intercept: if the student is mid-essay (state.submitted
    // is false) we ask them; if they confirm OR they've already
    // submitted, send them to the dashboard explicitly.
    history.pushState({ wrSentinel: true }, '', window.location.href);
    window.addEventListener('popstate', (ev) => {
      // Re-push the sentinel so a SECOND back press still fires
      // popstate (otherwise after one pop the browser leaves).
      history.pushState({ wrSentinel: true }, '', window.location.href);
      if (state.submitted) {
        window.location.href = 'student-dashboard.html';
        return;
      }
      AppDialog.confirm(
        "Your draft is auto-saved.",
        { title: "You haven't submitted yet — leave anyway?", okLabel: 'Leave', icon: '✍️' }
      ).then(function (ok) {
        if (ok) window.location.href = 'student-dashboard.html';
      });
    });
  }

  // ── Word count ──────────────────────────────────────────────
  function updateWordCount() {
    const text = els.wrEditor.innerText || '';
    const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
    state.wordCount = words;
    els.wrWordCount.textContent = String(words);
  }

  // ── Timer ───────────────────────────────────────────────────
  function startTimer(minutes) {
    const m = Math.max(1, parseInt(minutes, 10) || 40);
    state.startedAt = Date.now();
    state.timerEnd  = state.startedAt + m * 60 * 1000;
    tickTimer();
    state.timerHandle = setInterval(tickTimer, 1000);
  }

  function tickTimer() {
    const remainMs = Math.max(0, state.timerEnd - Date.now());
    const totalSec = Math.floor(remainMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    els.wrTimer.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    // Colour the timer warning/danger as it counts down.
    els.wrTimer.classList.toggle('warning', totalSec <= 300 && totalSec > 60);
    els.wrTimer.classList.toggle('danger',  totalSec <= 60);

    if (totalSec <= 0) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      // Auto-submit if teacher enabled it on the assignment.
      if (state.assignment && state.assignment.autoSubmit) {
        submit({ viaTimer: true, silent: true });
      } else {
        // Otherwise just lock the editor and remind the student to submit.
        els.wrEditor.setAttribute('contenteditable', 'false');
        els.wrEditor.style.opacity = '0.6';
        showConfirm({ viaTimer: true });
      }
    }
  }

  // ── Auto-save draft + restore ──────────────────────────────
  function draftKey() {
    return `writing-draft:${state.user.uid}:${state.assignmentId}`;
  }
  function saveDraft() {
    try { localStorage.setItem(draftKey(), els.wrEditor.innerText || ''); } catch (_) {}
  }
  function loadDraft() {
    try { return localStorage.getItem(draftKey()) || ''; } catch (_) { return ''; }
  }
  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (_) {}
  }
  function installAutoSaveAndRestoreDraft() {
    // Preview mode never saves a draft — teacher's typing isn't a
    // student's work-in-progress.
    if (state.preview) return;
    state.saveHandle = setInterval(saveDraft, 5000);
  }

  // ── UI wiring ──────────────────────────────────────────────
  // Two-step submit confirmation (Phase G fix). A single click on
  // Submit takes you through:
  //   1. First confirm — context-aware warning (word count, time, etc.)
  //   2. Final confirm — "Are you absolutely sure? This is final."
  // Only after the SECOND OK does the network request fire. The
  // confirmStep state machine lives on `state.confirmStep`.
  function wireUI() {
    els.wrSubmitBtn.addEventListener('click', () => {
      state.confirmStep = 1;
      showConfirm({});
    });
    els.wrSubmitCancelBtn.addEventListener('click', () => {
      state.confirmStep = 0;
      hideConfirm();
    });
    els.wrSubmitConfirmBtn.addEventListener('click', () => {
      if (state.confirmStep === 1) {
        // Move to the second, stronger confirmation step.
        state.confirmStep = 2;
        showConfirm({ secondStep: true });
        return;
      }
      // confirmStep === 2 → actually submit.
      state.confirmStep = 0;
      hideConfirm();
      submit({});
    });
  }

  function showConfirm(opts) {
    const a = state.assignment || {};
    let msg;
    if (opts.secondStep) {
      // Stronger second-step language so the student understands
      // there's no going back without teacher intervention.
      msg = "FINAL CHECK — once you submit, you can't edit this essay again unless your teacher returns it for revision. Are you absolutely sure?";
      // Visually tighten the dialog by changing the confirm button text.
      if (els.wrSubmitConfirmBtn) els.wrSubmitConfirmBtn.textContent = '✅ Yes, submit it';
    } else {
      msg = "Once submitted, you can't edit your response unless your teacher returns it.";
      if (a.minWords && state.wordCount < a.minWords) {
        msg = `You've written ${state.wordCount} word${state.wordCount === 1 ? '' : 's'}. Minimum is ${a.minWords}. You can still submit, but you may lose marks.`;
      }
      if (opts.viaTimer) {
        msg = "Time's up. Please submit your response now.";
      }
      if (els.wrSubmitConfirmBtn) els.wrSubmitConfirmBtn.textContent = 'Continue →';
    }
    els.wrSubmitConfirmMsg.textContent = msg;
    els.wrSubmitConfirm.classList.add('open');
  }
  function hideConfirm() {
    els.wrSubmitConfirm.classList.remove('open');
    // Reset the button label back to its default for next time.
    if (els.wrSubmitConfirmBtn) els.wrSubmitConfirmBtn.textContent = 'Continue →';
  }

  // ── Settings panel ──────────────────────────────────────────
  function wireSettings() {
    // Restore prefs from localStorage if present
    try {
      const prefs = JSON.parse(localStorage.getItem('wr-prefs') || '{}');
      if (prefs.theme)   applyTheme(prefs.theme);
      if (prefs.scale)   applyScale(prefs.scale);
      if (prefs.spacing) applySpacing(prefs.spacing);
      if (prefs.font)    applyFont(prefs.font);
    } catch (_) {}

    els.wrSettingsBtn.addEventListener('click', () => {
      els.wrSettingsPanel.classList.add('open');
      els.wrSettingsOverlay.classList.add('open');
    });
    els.wrSettingsCloseBtn.addEventListener('click', closeSettings);
    els.wrSettingsOverlay.addEventListener('click', closeSettings);

    setupRowHandler(els.wrThemeRow,   'theme',   (v) => applyTheme(v));
    setupRowHandler(els.wrScaleRow,   'scale',   (v) => applyScale(v));
    setupRowHandler(els.wrSpacingRow, 'spacing', (v) => applySpacing(v));
    setupRowHandler(els.wrFontRow,    'font',    (v) => applyFont(v));

    els.wrSettingsResetBtn.addEventListener('click', () => {
      applyTheme('dark');
      applyScale('1');
      applySpacing('1.7');
      applyFont('serif');
      try { localStorage.removeItem('wr-prefs'); } catch (_) {}
      markActive(els.wrThemeRow,   'data-theme',   'dark');
      markActive(els.wrScaleRow,   'data-scale',   '1');
      markActive(els.wrSpacingRow, 'data-spacing', '1.7');
      markActive(els.wrFontRow,    'data-font',    'serif');
    });
  }
  function closeSettings() {
    els.wrSettingsPanel.classList.remove('open');
    els.wrSettingsOverlay.classList.remove('open');
  }
  function setupRowHandler(row, key, applyFn) {
    if (!row) return;
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const v = btn.dataset[key];
      if (!v) return;
      applyFn(v);
      Array.from(row.children).forEach(c => c.classList.toggle('active', c === btn));
      // Persist
      try {
        const prefs = JSON.parse(localStorage.getItem('wr-prefs') || '{}');
        prefs[key] = v;
        localStorage.setItem('wr-prefs', JSON.stringify(prefs));
      } catch (_) {}
    });
  }
  function markActive(row, attr, val) {
    if (!row) return;
    Array.from(row.children).forEach(c => c.classList.toggle('active', c.getAttribute(attr) === val));
  }
  function applyTheme(t)   { document.body.setAttribute('data-theme', t); }
  function applyScale(s)   { document.documentElement.style.setProperty('--wr-scale', s); }
  function applySpacing(v) { els.wrEditor.style.lineHeight = String(v); }
  function applyFont(f) {
    const families = {
      serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
      sans:  "'Inter', 'Segoe UI', system-ui, sans-serif",
      mono:  "'JetBrains Mono', Menlo, Consolas, monospace"
    };
    els.wrEditor.style.fontFamily = families[f] || families.serif;
  }

  // ── Submit ──────────────────────────────────────────────────
  async function submit(opts) {
    if (state.submitted) return;
    // Preview mode safety net — even if something triggers submit()
    // (e.g. an Enter-key shortcut on the confirm dialog), refuse.
    if (state.preview) {
      AppDialog.alert('Preview mode — submissions are disabled.');
      return;
    }
    state.submitted = true;

    // Stop the timer + autosave loop.
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
    if (state.saveHandle)  { clearInterval(state.saveHandle);  state.saveHandle  = null; }

    // Lock the editor.
    els.wrEditor.setAttribute('contenteditable', 'false');

    const text = (els.wrEditor.innerText || '').trim();
    const words = text.length === 0 ? 0 : text.trim().split(/\s+/).length;
    const elapsedSec = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
    const a = state.assignment || {};

    // Build session doc — mirrors reading-exam shape so the teacher
    // dashboard's existing session pipeline picks it up.
    const scope = (typeof studentScopeFields === 'function')
      ? studentScopeFields()
      : { studentClass:'', studentLevel:'', studentModule:'' };

    const sessionDoc = {
      userId:    state.user.uid,
      userName:  state.user.displayName || state.user.email || 'Student',
      activity:  'writing-exam',
      skill:     'writing',
      assignmentId: state.assignmentId,
      assignmentTitle: a.title || '',
      questionType: a.questionType || 'custom',
      level:     a.level || a.difficulty || null,
      timeLimit: a.timeLimit || null,
      timeSpentSec: elapsedSec,
      autoSubmitted: !!opts.viaTimer,
      tabSwitches: (state.focusLog && state.focusLog.switches) || 0,
      blurMs:      (state.focusLog && state.focusLog.blurMs)   || 0,
      responseText: text,
      wordCount: words,
      minWords:    a.minWords    || null,
      targetWords: a.targetWords || null,
      ...scope,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('sessions').add(sessionDoc);

      // Write the assignmentCompletion record so the teacher dashboard's
      // completion percentage updates. Doc id pattern matches what the
      // rules require: `<uid>_<assignmentId>`.
      const completionId = `${state.user.uid}_${state.assignmentId}`;
      // BUG FIX — writing was writing `userId` here but every loader in
      // the codebase queries `assignmentCompletions` by `odUserId`
      // (vocab path uses odUserId; the assignments-tab teacher view +
      // student dashboard both .where('odUserId','==',uid)). Without
      // odUserId, writing completions never showed up on either
      // dashboard: teacher card said "0 Done / N Not Started" even
      // when graded, and the student kept seeing "Start Writing"
      // after submitting. We write BOTH names so old and new readers
      // both find the doc.
      await db.collection('assignmentCompletions').doc(completionId).set({
        userId:       state.user.uid,
        odUserId:     state.user.uid,
        assignmentId: state.assignmentId,
        skill:        'writing',
        // Writing is "completed" the moment the student submits —
        // there's no auto-graded score gate like vocab's 100%-rule.
        // The teacher grades it later; the row goes green now.
        completed:    true,
        attempts:     1,
        bestScore:    null,                    // graded later by teacher
        wordCount:    words,
        timeSpentSec: elapsedSec,
        autoSubmitted: !!opts.viaTimer,
        completedAt:  firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Dedicated writingSubmissions collection — the canonical home for
      // the essay text. Lets the grading UI list submissions per
      // assignment without spelunking through /sessions. Doc id mirrors
      // assignmentCompletions so each (student, assignment) pair has
      // exactly one row that resubmissions overwrite.
      //
      // Resubmit semantics (Phase F.4 — 'Returned' workflow):
      //   • Initial submission: write all fields including null grade fields.
      //   • Resubmit (doc exists): OMIT score / teacherComment / gradedBy /
      //     gradedAt from the payload so set({merge:true}) PRESERVES the
      //     prior teacher feedback. This matches the firestore rule for
      //     the 'returned → submitted' transition, which requires those
      //     four fields to remain unchanged. Status flips back to
      //     'submitted' so the teacher can re-grade.
      const wsRef = db.collection('writingSubmissions').doc(completionId);
      const wsExisting = await wsRef.get();
      const isResubmit = wsExisting.exists;

      const wsPayload = {
        userId:          state.user.uid,
        userName:        state.user.displayName || state.user.email || 'Student',
        assignmentId:    state.assignmentId,
        assignmentTitle: a.title || '',
        questionType:    a.questionType || 'custom',
        level:           a.level || a.difficulty || null,
        timeLimit:       a.timeLimit || null,
        timeSpentSec:    elapsedSec,
        autoSubmitted:   !!opts.viaTimer,
        tabSwitches:     (state.focusLog && state.focusLog.switches) || 0,
        blurMs:          (state.focusLog && state.focusLog.blurMs)   || 0,
        responseText:    text,
        wordCount:       words,
        minWords:        a.minWords    || null,
        targetWords:     a.targetWords || null,
        status:          'submitted',         // → 'graded' / 'returned' later
        ...scope,
        submittedAt:     firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!isResubmit) {
        // Initial creation — pin the grade fields to null so the rule's
        // create-time guard passes.
        wsPayload.score          = null;
        wsPayload.teacherComment = null;
        wsPayload.gradedBy       = null;
        wsPayload.gradedAt       = null;
      }
      // On resubmit we deliberately do NOT include those four fields —
      // omitting them from a merge-write preserves whatever the teacher
      // wrote on the previous grading pass.
      await wsRef.set(wsPayload, { merge: true });

      // Activity-log entry — the writing flow used to be silent here,
      // so the teacher's log never saw "Alireza submitted Hi essay."
      // We emit `assignment_submitted` carrying enough context for
      // the log row to be useful at a glance.
      if (typeof ActivityLogger !== 'undefined') {
        try {
          ActivityLogger.log('assignment_submitted', {
            assignmentId:    state.assignmentId,
            assignmentTitle: a.title || '',
            skill:           'writing',
            wordCount:       words,
            timeSpentSec:    elapsedSec,
            isResubmit
          });
        } catch (_) { /* logger optional */ }
      }

      clearDraft();
      showDone({ words, elapsedSec, viaTimer: !!opts.viaTimer });
    } catch (err) {
      console.error('Failed to submit writing:', err);
      // Don't lose the draft if the network bites.
      saveDraft();
      state.submitted = false;
      els.wrEditor.setAttribute('contenteditable', 'true');
      AppDialog.alert('Could not save your submission. Check your connection and try again.');
    }
  }

  function showDone({ words, elapsedSec, viaTimer }) {
    els.wrStage.style.display   = 'none';
    els.wrTopbar.style.display  = 'none';
    els.wrDone.classList.add('open');
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    els.wrDoneRecap.innerHTML = `
      <div><strong>Words written:</strong> ${words}</div>
      <div><strong>Time spent:</strong> ${mins}m ${secs}s</div>
      ${viaTimer ? '<div style="color: var(--wr-warning);">⏱ Auto-submitted because time ran out.</div>' : ''}
    `;
  }
})();
