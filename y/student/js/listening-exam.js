/**
 * FSM Vocabulary Trainer — Listening Exam Module
 * Audio player + exam questions + karaoke transcript + tracking
 */

// ─── Transcript Data (timestamped segments) ──────────────────────────────────
// Anchors provided by the teacher:
//   Intro is separate (plays near the start, then a pause to read Section 1)
//   Section 1 ("I'm joined today…") starts at 1:23  (83 s)  → +73 from 10-baseline
//   Section 2 starts at 8:34                        (514 s) → +54 from 460-baseline
//   Section 3 starts at 15:07                       (907 s) → +7  from 900-baseline
// Timings re-aligned 2026-04-21 from Whisper SRT via tools/align-from-srt.js.
// All 33 segments aligned with ≥0.96 confidence. Sections 2 and 3 had large
// drift in the original teacher-supplied times (up to −131s on target 22 and
// −125s on target 32); those are now corrected to real audio positions.
const EXAM_TRANSCRIPT = [
  { start:    0.3, end:   15.6, text: "You have one minute to read the questions before each section. You will hear the recordings after the beep. Each recording will play twice.", section: 'intro' },
  { start:   78.8, end:   97.3, text: "I'm joined today by Matthew Piscatelli, who has worked as an archaeologist, a university professor, and an explorer for the National Geographic Society. Welcome, Matthew, and thank you for being here.", section: 1 },
  { start:   97.7, end:  102.8, text: "Now, my first question for you is this. Why should people care about archaeology?", section: 1 },
  { start:  103.2, end:  106.3, text: "Why should we care about some stones and bones?", section: 1 },
  { start:  106.7, end:  116.4, text: "I think it's important to study objects from the past, from ancient civilizations because of the old cliché that we learn about the future by studying the past. The past is who we are.", section: 1 },
  { start:  116.6, end:  129.8, text: "We learn more about where we come from, and it helps us learn more about our identity today. We need to study those ancient civilizations so we can help prepare for the future. And archaeology is also important because it inspires curiosity.", section: 1 },
  { start:  130.1, end:  140.9, text: "People feel a connection to the past when I say, you know, you're walking in the footsteps of ancient people, or this is what it was like to live 5000 years ago. I think there's something very interesting about that.", section: 1 },
  { start:  141.2, end:  158.1, text: "So it's important that we as archaeologists not simply do our excavations, write a report and then file that away where nobody will read about it. We need to communicate what we do and the importance of what we do. We need to ask ourselves, why does what you propose to do really matter? Who's going to care?", section: 1 },
  { start:  167.2, end:  182.8, text: "Now, I think it's fair to say that when most people think about archaeology, they think about uncovering objects from cultures like ancient Greece, Rome, and Egypt. Why do you think that is? What is it about societies like these that inspires us so much?", section: 1 },
  { start:  183.1, end:  201.8, text: "So there are a lot of famous sites in the world, like Stonehenge and the Pyramids of Giza that people are always excited to learn about. And there's something charismatic about them. They have been around for thousands of years.", section: 1 },
  { start:  202.5, end:  218.8, text: "People have constantly been interested in these sites. And I think it's from the charisma, the wonder, the awe of these sites. It's something about archaeology that makes us wonder, what was it like to live in the past? What was it like to build the pyramids or to build Stonehenge?", section: 1 },
  { start:  223.2, end:  239.9, text: "Are there any archaeological sites or ancient cultures you think people should know more about? When we look at all of the work that our National Geographic explorers are doing all over the world, we come to realize that the world is a very ancient place and there are a lot of civilizations out there to be discovered.", section: 1 },
  { start:  240.1, end:  255.8, text: "Now in some of those places, like in Egypt, there's a long history of study. Some other places are more like the Wild West, and that we don't know as much. For example, in Peru, we know Machu Picchu. We know some sites along the North Coast of Peru which are very famous.", section: 1 },
  { start:  513.2, end:  523.8, text: "Hi, Serena. How's it going? Oh, hi, Liam. Everything's fine with me. What's new with you? Not much. Well, actually, I'm trying to decide where to go to college.", section: 2 },
  { start:  524.1, end:  537.8, text: "Which colleges are top on your list? Just three right now. New York University, the University of Southern Maine, and Mount Royal University. What was the last one? Mount Royal? Where is it?", section: 2 },
  { start:  538.2, end:  552.8, text: "It's in Calgary in Canada. Huh. Don't be offended, but that seems like a pretty random selection of schools. I mean, I can understand NYU, I'd love to go to college in New York, but why Maine or Calgary?", section: 2 },
  { start:  553.1, end:  562.8, text: "Because I'd like to get a degree in ecotourism and there aren't that many colleges that offer it. Ecotourism. You're going to have to tell me what that is.", section: 2 },
  { start:  563.2, end:  576.8, text: "My parents said the same thing. Basically, ecotourism tries to make sure travelers have a great experience, but in a way that can preserve nature and benefit local people. It's about finding a balance between tourism and the environment.", section: 2 },
  { start:  577.2, end:  591.8, text: "So it's like tourists get to visit natural areas without having a negative impact on them. That's pretty cool. I know, right? I've always loved traveling, so getting a job related to travel is kind of a dream of mine.", section: 2 },
  { start:  592.2, end:  608.4, text: "And I've heard that ecotourism is a real growth area in the tourism industry right now, so I'm hoping it'll be easy to find a job after I graduate. And there are so many news stories these days about how humans have damaged the environment, so it seems like the right thing is to try and protect it.", section: 2 },
  { start:  609.6, end:  630.8, text: "But isn't air travel bad? Traveling by airplane is one of the worst things you can do for the environment. You're absolutely right, Serena. So the idea behind ecotourism is to find a compromise. If people are going to travel somewhere, ecotourism says let's make sure they travel in a way that causes as little damage as possible.", section: 2 },
  { start:  631.2, end:  642.8, text: "Let's make sure they act in a responsible way when they arrive. Let's make sure they know the harm that humans can do to the landscape. That sounds good in theory, but how does it work in practice?", section: 2 },
  { start:  643.2, end:  664.8, text: "Well, I was reading about ecotourism in Madagascar. Apparently there's a National Park there called Tsingy de Bemaraha or something. It's this amazing landscape, like a forest of sharp rocks. A great tourist destination, but it's hard for tourists to get there and they're likely to damage the landscape. It's a pretty fragile place apparently.", section: 2 },
  { start:  907.4, end:  926.0, text: "We could ask ourselves, does it matter? Does it matter that young people are playing fewer sports or being less active? Most of us would probably answer yes it does. Our intuition tells us that it is good for our long term health and happiness.", section: 3 },
  { start:  926.4, end:  944.9, text: "But there is also research showing that graduates who participate in college sports go on to earn 20% more in their future careers than other non-sporting students. Why is this? Well, here are 5 good reasons.", section: 3 },
  { start:  945.5, end:  968.9, text: "Reason number one is teamwork. It's important for any team to know how to work together, and by playing sports, you're developing the skill of working with others towards achieving a goal. You are also learning that everyone brings different talents and by working together you can overcome obstacles.", section: 3 },
  { start:  969.7, end:  992.0, text: "Reason number two: Leadership. When people play sports, especially team sports, captains and leaders tend to emerge from a group of people. These are the people who make the tough decisions and inspire others, especially when you are losing. They are also the leaders of the future.", section: 3 },
  { start:  992.4, end: 1017.9, text: "Managing time is another skill that you develop through doing sports. In college, your first priority might be attending classes and studying. But if you're on a sports team, you also have to go to regular practice sessions. Balancing all these demands along with the need for socializing with friends means that you are learning time management.", section: 3 },
  { start: 1018.5, end: 1038.0, text: "That's the third reason participating in sports can help your future career. Along with time management and preparation for a sporting competition comes pressure. Playing a sport forces you to deal with pressure and develop strategies to cope with difficult situations.", section: 3 },
  { start: 1038.4, end: 1049.0, text: "Although not every career is stressful or high pressure, everyone will experience anxiety at some point and will need to learn to stay calm.", section: 3 },
  { start: 1049.4, end: 1076.0, text: "Reason number five for being involved in a Sports Club or team isn't directly related to physical exercise either. Clubs and teams need people to coordinate them. They need people to raise money, buy new equipment and make sure the club has new members. Students who take on these tasks are learning organization skills, which are essential for future managers.", section: 3 },
  { start: 1076.6, end: 1102.0, text: "And one final word. If you're sitting there listening to me thinking I understand, but I'm not very good at sports. I'd say to you, it really doesn't matter because when you graduate and start writing a resume for a job, the employer doesn't need to know if you won every competition you entered or that you were the best player on the team.", section: 3 },
  { start: 1102.4, end: 1126.0, text: "They just need to know that you took part and learned certain skills from the experience, which you can transfer into your career. So when you leave this room today, I'd ask you all to go sign up for any of the sports clubs and teams that we offer and make the experience an important part of your university life.", section: 3 }
];

// ─── Exam Questions ──────────────────────────────────────────────────────────
const LISTENING_EXAMS = [
  {
    id: 'sample-fsmept',
    title: 'Sample FSMEPT Listening Exam',
    audio: 'student/audio/listening-exam-1.mp3',
    transcript: EXAM_TRANSCRIPT,
    sections: [
      {
        title: 'Section One',
        instruction: 'Listen to an interview with archaeologist Matthew Piscitelli. Circle T (True) or F (False) for each sentence.',
        points: '5 x 1 = 5 pts',
        type: 'truefalse',
        hint: '*uncover: discover',
        questions: [
          { id: 's1q1', text: 'Archaeology encourages people to learn more about the ancient history which is helpful for our future.', answer: 'T' },
          { id: 's1q2', text: 'Piscitelli thinks that archaeologists should inform people about how important their work is.', answer: 'T' },
          { id: 's1q3', text: 'The interviewer believes that many people associate archaeology with making new discoveries of unknown cities.', answer: 'F' },
          { id: 's1q4', text: 'According to Piscitelli, Stonehenge has been recently attracting tourists because of its age.', answer: 'F' },
          { id: 's1q5', text: 'Unlike some places, the archaeological sites in Egypt have been studied quite a lot.', answer: 'T' }
        ]
      },
      {
        title: 'Section Two',
        instruction: 'Listen to a conversation about selecting a college between two friends. Choose the correct answer a, b or c.',
        points: '5 x 1 = 5 pts',
        type: 'mcq',
        questions: [
          { id: 's2q1', text: 'Liam prefers going to a college outside New York mainly because __________.',
            options: ['the other colleges offer free accommodation', 'he is thinking of choosing a rare department', "he doesn't like living in New York"], answer: 'b' },
          { id: 's2q2', text: 'Liam states that ecotourism __________.',
            options: ['helps protect the environment', 'encourages tourists to travel more', 'makes locals more educated'], answer: 'a' },
          { id: 's2q3', text: 'After university, Liam expects to get hired easily because __________.',
            options: ['ecotourism is getting more and more popular', "there aren't many people who want to save the world", 'he is interested in exploring the nature'], answer: 'a' },
          { id: 's2q4', text: 'Ecotourism guarantees that travellers __________.',
            options: ['make the best of their experience', 'are punished for their irresponsible behaviours', 'are informed about the human impacts on the environment'], answer: 'c' },
          { id: 's2q5', text: 'Which statement is NOT true about the national park in Madagascar?',
            options: ['The scenery is magnificent.', 'Travellers can easily reach the whole park.', 'It is located in a rocky area.'], answer: 'b' }
        ]
      },
      {
        title: 'Section Three',
        instruction: 'Listen to a podcast about young people and playing sports. Complete the sentences with 1 word from the audio.',
        points: '5 x 1 = 5 pts',
        type: 'fillblank',
        note: 'Exceeding the word limit will result in ZERO (0).',
        questions: [
          { id: 's3q1', text: 'The first reason to participate in college sports is __________.', answer: 'teamwork' },
          { id: 's3q2', text: 'When you play sports, __________ tend to emerge.', answer: 'leadership' },
          { id: 's3q3', text: 'Balancing all the __________ on your time is good for time management skills.', answer: 'demands' },
          { id: 's3q4', text: 'By running a sports club, you are learning the skills of __________.', answer: 'organization' },
          { id: 's3q5', text: 'Future employers will want to know what you learned from the __________.', answer: 'experience' }
        ]
      }
    ]
  }
];

// ─── State ────────────────────────────────────────────────────────────────────
let currentExam = null;
let examSubmitted = false;
let examAudio = null;
let activeSegmentIdx = -1;

// ─── Init ─────────────────────────────────────────────────────────────────────
function startListeningExam(examId) {
  examId = examId || 'sample-fsmept';
  currentExam = LISTENING_EXAMS.find(e => e.id === examId) || LISTENING_EXAMS[0];
  examSubmitted = false;
  activeSegmentIdx = -1;
  renderListeningExam();
  showScreen('listeningExamScreen');
}
// Phase F: exposed on window so the dashboard's preview-mode boot
// hook can auto-open a specific listening exam when a teacher
// previews an assignment from the teacher dashboard.
window.startListeningExam = startListeningExam;

// ─── Render ───────────────────────────────────────────────────────────────────
function renderListeningExam() {
  const exam = currentExam;
  document.getElementById('examTitle').textContent = exam.title;
  document.getElementById('examTrackTitle').textContent = exam.title.replace('Sample ', '');

  // Audio
  const audioEl = document.getElementById('examAudio');
  audioEl.src = exam.audio;
  examAudio = audioEl;
  audioEl.addEventListener('timeupdate', updateAudioProgress);
  audioEl.addEventListener('timeupdate', updateTranscriptHighlight);
  audioEl.addEventListener('loadedmetadata', () => {
    document.getElementById('examAudioDuration').textContent = formatTime(audioEl.duration);
  });
  audioEl.addEventListener('ended', () => {
    document.getElementById('examPlayBtn').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    const vinyl = document.getElementById('examVinyl');
    if (vinyl) vinyl.classList.remove('spinning');
  });

  // Sections
  const container = document.getElementById('examSectionsContainer');
  container.innerHTML = '';
  exam.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'exam-section';
    // Accordion-wrapped: the header is keyboard-clickable, and the
    // body (instruction + optional hint/note + questions div) is
    // wrapped so it can animate as a single unit. Default state =
    // expanded so first-paint behaviour is identical to the
    // pre-accordion build.
    sectionEl.innerHTML = `
      <div class="exam-section-header" role="button" tabindex="0" aria-expanded="true">
        <h3>${section.title}</h3>
        <span class="exam-section-pts">${section.points}</span>
        <span class="exam-section-chevron" aria-hidden="true">▾</span>
      </div>
      <div class="exam-section-body">
        <p class="exam-section-instruction">${section.instruction}</p>
        ${section.hint ? `<p class="exam-section-hint">${section.hint}</p>` : ''}
        ${section.note ? `<p class="exam-section-note">${section.note}</p>` : ''}
        <div class="exam-questions" id="examSection${sIdx}">
          ${section.questions.map((q, qIdx) => renderQuestion(q, qIdx, section.type)).join('')}
        </div>
      </div>
    `;
    container.appendChild(sectionEl);
  });
  // Wire accordion click + keyboard handlers for each section.
  container.querySelectorAll('.exam-section-header').forEach(head => {
    head.addEventListener('click', (e) => {
      // Don't toggle if the click started inside a focusable child
      // (preserves any future buttons / inputs in the header without
      // requiring updates here).
      if (e.target.closest('a, button, input, select, textarea')) return;
      const sec = head.closest('.exam-section');
      if (!sec) return;
      const willCollapse = !sec.classList.contains('is-collapsed');
      sec.classList.toggle('is-collapsed', willCollapse);
      head.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
    });
    head.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      head.click();
    });
  });
  // Per-question chevron handlers. Each `.exam-q-toggle` toggles
  // `.is-collapsed` on its parent `.exam-q`. Stops propagation so it
  // doesn't bubble to the section header (which sits above it).
  container.querySelectorAll('.exam-q-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = btn.closest('.exam-q');
      if (!q) return;
      const willCollapse = !q.classList.contains('is-collapsed');
      q.classList.toggle('is-collapsed', willCollapse);
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      btn.setAttribute('aria-label',
        willCollapse ? 'Expand this question' : 'Collapse this question');
      btn.setAttribute('title',
        willCollapse ? 'Click to expand this question' : 'Click to collapse this question');
    });
  });

  // Transcript — hidden initially, revealed after submit. Reset drawer state
  // so we don't carry has-transcript/drawer-open across exams.
  const transcriptArea = document.getElementById('examTranscript');
  transcriptArea.style.display = 'none';
  const splitEl = document.querySelector('.exam-split');
  if (splitEl) splitEl.classList.remove('has-transcript', 'drawer-open');
  // Also drop the mirrored class on the screen so the padding-right shift
  // doesn't persist into the next exam. Clear the mobile-view attribute too
  // so next render starts fresh (set to 'answers' again in submit).
  const screenEl = document.getElementById('listeningExamScreen');
  if (screenEl) {
    screenEl.classList.remove('drawer-open', 'has-transcript');
    screenEl.removeAttribute('data-mobile-view');
  }
  // Reset the mobile tab buttons to the default state too.
  document.querySelectorAll('.exam-mobile-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === 'answers');
  });
  if (exam.transcript && exam.transcript.length > 0) {
    const sectionLabels = { intro: 'Introduction', 1: 'Section 1 — Archaeology', 2: 'Section 2 — Ecotourism', 3: 'Section 3 — Sports' };
    let currentSection = null;
    let html = '<h3 class="transcript-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Transcript</h3>';
    html += '<div class="transcript-lines" id="transcriptLines">';
    exam.transcript.forEach((seg, i) => {
      if (seg.section !== currentSection) {
        currentSection = seg.section;
        html += `<div class="transcript-section-label">${sectionLabels[seg.section] || 'Section ' + seg.section}</div>`;
      }
      // Split segment text into word tokens so we can karaoke-highlight each one.
      // Whitespace is preserved as plain text; each real "word" gets its own span
      // with an index we can later toggle via .past-word / .active-word classes.
      const tokens = seg.text.split(/(\s+)/);
      let wIdx = 0;
      const wordsHtml = tokens.map(tok => {
        if (/^\s+$/.test(tok) || tok === '') return tok;
        const idx = wIdx++;
        return `<span class="tw" data-seg="${i}" data-wi="${idx}" onclick="event.stopPropagation(); seekToWord(${i}, ${idx})">${tok}</span>`;
      }).join('');
      html += `<div class="transcript-seg" data-idx="${i}" data-start="${seg.start}" data-end="${seg.end}" data-wc="${wIdx}" onclick="seekToSegment(${i})">
        <span class="transcript-time">${formatTime(seg.start)}</span>
        <span class="transcript-text">${wordsHtml}</span>
      </div>`;
    });
    html += '</div>';
    transcriptArea.innerHTML = html;

    // Detect manual user scroll / wheel / touch on the transcript and pause
    // auto-follow for SCROLL_GRACE_MS so the reader can review earlier lines
    // without being yanked back down to the current segment.
    const tLines = document.getElementById('transcriptLines');
    if (tLines) {
      ['wheel', 'touchstart', 'touchmove', 'keydown', 'mousedown'].forEach(evt => {
        tLines.addEventListener(evt, markUserScrolled, { passive: true });
      });
    }
  }

  // Reset UI
  document.getElementById('examSubmitBtn').style.display = '';
  document.getElementById('examSubmitBtn').disabled = false;

  // If running in calibration mode, reveal the transcript immediately
  // and attach the calibration UI. Activated via ?calibrate=1 URL param.
  if (isCalibrationMode()) initCalibrationMode();
  document.getElementById('examResultsArea').style.display = 'none';
}

function renderQuestion(q, idx, type) {
  const num = idx + 1;
  // Per-question accordion chevron — added only to truefalse + mcq
  // where the answer area is a discrete options block. Fillblank has
  // the input embedded inline in the question text, so collapsing
  // it would hide both — accordion doesn't fit there.
  const toggleBtn = `<button type="button" class="exam-q-toggle"
                            aria-expanded="true"
                            aria-label="Collapse this question"
                            title="Click to collapse this question">▾</button>`;
  if (type === 'truefalse') {
    return `<div class="exam-q" data-id="${q.id}">
      <div class="exam-q-head">
        <span class="exam-q-num">${num}.</span>
        <span class="exam-q-text">${q.text}</span>
        ${toggleBtn}
      </div>
      <div class="exam-q-body">
        <div class="exam-tf-options">
          <label class="exam-tf-label"><input type="radio" name="${q.id}" value="T"><span>T</span></label>
          <label class="exam-tf-label"><input type="radio" name="${q.id}" value="F"><span>F</span></label>
        </div>
      </div>
    </div>`;
  }
  if (type === 'mcq') {
    const letters = ['a', 'b', 'c'];
    return `<div class="exam-q" data-id="${q.id}">
      <div class="exam-q-head">
        <span class="exam-q-num">${num}.</span>
        <span class="exam-q-text">${q.text}</span>
        ${toggleBtn}
      </div>
      <div class="exam-q-body">
        <div class="exam-mcq-options">
          ${q.options.map((opt, i) => `
            <label class="exam-mcq-label">
              <input type="radio" name="${q.id}" value="${letters[i]}">
              <span class="exam-mcq-letter">${letters[i]}.</span>
              <span>${opt}</span>
            </label>`).join('')}
        </div>
      </div>
    </div>`;
  }
  if (type === 'fillblank') {
    return `<div class="exam-q" data-id="${q.id}">
      <span class="exam-q-num">${num}.</span>
      <span class="exam-q-text">${q.text.replace('__________', `<input type="text" class="exam-fill-input" name="${q.id}" autocomplete="off" spellcheck="false" placeholder="...">`)}</span>
    </div>`;
  }
  return '';
}

// ─── Audio Controls ───────────────────────────────────────────────────────────
const PLAY_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const PAUSE_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

function toggleExamAudio() {
  if (!examAudio) return;
  const btn = document.getElementById('examPlayBtn');
  const vinyl = document.getElementById('examVinyl');
  if (examAudio.paused) {
    examAudio.play();
    btn.innerHTML = PAUSE_SVG;
    if (vinyl) vinyl.classList.add('spinning');
  } else {
    examAudio.pause();
    btn.innerHTML = PLAY_SVG;
    if (vinyl) vinyl.classList.remove('spinning');
  }
}

function rewindExamAudio() {
  if (examAudio) examAudio.currentTime = Math.max(0, examAudio.currentTime - 10);
}

function forwardExamAudio() {
  if (examAudio) examAudio.currentTime = Math.min(examAudio.duration, examAudio.currentTime + 10);
}

function seekExamAudio(e) {
  if (!examAudio || !examAudio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  examAudio.currentTime = ((e.clientX - rect.left) / rect.width) * examAudio.duration;
}

function updateAudioProgress() {
  if (!examAudio || !examAudio.duration) return;
  const pct = (examAudio.currentTime / examAudio.duration) * 100;
  document.getElementById('examProgressFill').style.width = pct + '%';
  const knob = document.getElementById('examProgressKnob');
  if (knob) knob.style.left = pct + '%';
  document.getElementById('examAudioTime').textContent = formatTime(examAudio.currentTime);
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function changeExamSpeed() {
  if (!examAudio) return;
  const speeds = [0.75, 1, 1.25, 1.5];
  const cur = speeds.indexOf(examAudio.playbackRate);
  examAudio.playbackRate = speeds[(cur + 1) % speeds.length];
  document.getElementById('examSpeedBtn').textContent = examAudio.playbackRate + 'x';
}

// ─── Karaoke Transcript ──────────────────────────────────────────────────────
let activeWordIdx = -1;
// Timestamp (ms) of the user's last manual scroll inside the transcript
// container. While within SCROLL_GRACE_MS of this, auto-scroll is paused so
// the reader can freely scroll back up to review earlier lines.
let lastUserScrollAt = 0;
const SCROLL_GRACE_MS = 5000;

function markUserScrolled() { lastUserScrollAt = Date.now(); }

function userIsBrowsing() { return Date.now() - lastUserScrollAt < SCROLL_GRACE_MS; }

// Scroll the transcript container so `el` is roughly centered, but only
// move the container's own scrollTop — never the window/page scroll.
function scrollTranscriptTo(el) {
  const container = document.getElementById('transcriptLines');
  if (!container || !el) return;
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const offset = (eRect.top - cRect.top) - (container.clientHeight / 2) + (el.offsetHeight / 2);
  container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
}

function updateTranscriptHighlight() {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const t = examAudio.currentTime;
  const segs = currentExam.transcript;

  // Find the active segment by time window (if any).
  let newIdx = -1;
  for (let i = 0; i < segs.length; i++) {
    if (t >= segs[i].start && t < segs[i].end) { newIdx = i; break; }
  }

  // ── Deterministic per-word state sweep ─────────────────────────────────
  // For every segment on the page we compute, purely from `t`, what each
  // word SHOULD look like right now and apply it. No dependency on any
  // "did it change since last tick" bookkeeping — that's what used to leave
  // past-word state stuck on future segments after a backward seek (the
  // "strikethrough look" bug). This runs every ~250ms on ~30 segments with
  // ~50 words each, which classList can no-op cheaply when already correct.
  //
  // Natural English narration is ~2.8 words/sec. For sparse segments where
  // a linear word-index would crawl behind the speaker, we take the MAX of
  // linear and natural so the highlight keeps up, then let the last word
  // hold through any trailing pause.
  const NATURAL_WPS = 2.8;
  document.querySelectorAll('.transcript-seg').forEach(segEl => {
    const segIdx   = parseInt(segEl.dataset.idx, 10);
    const segStart = parseFloat(segEl.dataset.start);
    const segEnd   = parseFloat(segEl.dataset.end);
    const words    = segEl.querySelectorAll('.tw');
    const total    = words.length;

    if (t >= segEnd) {
      // Segment fully in the past → every word marked past.
      words.forEach(w => {
        if (!w.classList.contains('past-word')) w.classList.add('past-word');
        if (w.classList.contains('active-word')) w.classList.remove('active-word');
      });
    } else if (t < segStart || segIdx !== newIdx) {
      // Segment is in the future OR we're in a gap → every word fresh.
      words.forEach(w => {
        if (w.classList.contains('past-word'))   w.classList.remove('past-word');
        if (w.classList.contains('active-word')) w.classList.remove('active-word');
      });
    } else {
      // Segment is currently active → split into past / active / future words.
      const duration    = Math.max(0.001, segEnd - segStart);
      const elapsed     = Math.max(0, t - segStart);
      const linearWIdx  = Math.floor((elapsed / duration) * total);
      const naturalWIdx = Math.floor(elapsed * NATURAL_WPS);
      const wIdx        = Math.min(total - 1, Math.max(linearWIdx, naturalWIdx));
      words.forEach((w, idx) => {
        if (idx < wIdx) {
          if (!w.classList.contains('past-word')) w.classList.add('past-word');
          if (w.classList.contains('active-word')) w.classList.remove('active-word');
        } else if (idx === wIdx) {
          if (w.classList.contains('past-word'))    w.classList.remove('past-word');
          if (!w.classList.contains('active-word')) w.classList.add('active-word');
        } else {
          if (w.classList.contains('past-word'))   w.classList.remove('past-word');
          if (w.classList.contains('active-word')) w.classList.remove('active-word');
        }
      });
      activeWordIdx = wIdx;
    }
  });

  // ── Update which segment carries the `.active` class ──
  if (newIdx !== activeSegmentIdx) {
    const oldActive = document.querySelector('.transcript-seg.active');
    if (oldActive) oldActive.classList.remove('active');

    if (newIdx >= 0) {
      const el = document.querySelector(`.transcript-seg[data-idx="${newIdx}"]`);
      if (el) {
        el.classList.add('active');
        if (!userIsBrowsing()) scrollTranscriptTo(el);
      }
    }
    activeSegmentIdx = newIdx;
    activeWordIdx = -1;
  }
}

function seekToSegment(idx) {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const seg = currentExam.transcript[idx];
  if (seg) {
    examAudio.currentTime = seg.start;
    if (examAudio.paused) toggleExamAudio();
  }
}

// ─── Transcript drawer toggle ────────────────────────────────────────────────
// Called by the floating "Transcript" tab and the in-drawer close button.
// Passing no argument flips the state; passing a boolean forces it.
function toggleTranscriptDrawer(force) {
  const split = document.querySelector('.exam-split');
  const screen = document.getElementById('listeningExamScreen');
  if (!split) return;
  const shouldOpen = typeof force === 'boolean' ? force : !split.classList.contains('drawer-open');
  split.classList.toggle('drawer-open', shouldOpen);
  // Mirror onto the screen so the CSS padding-right rule shifts the audio
  // player and header, not just the questions column.
  if (screen) screen.classList.toggle('drawer-open', shouldOpen);

  // When opening, snap the scroll position to the currently-active segment
  // if we have one (so they land on what's playing), otherwise to the top.
  // Without this, after a full audio playthrough the drawer would open
  // scrolled to the very bottom.
  if (shouldOpen) {
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (!lines) return;
      const activeSeg = lines.querySelector('.transcript-seg.active');
      if (activeSeg) {
        scrollTranscriptTo(activeSeg);
      } else {
        lines.scrollTop = 0;
      }
    });
  }
}

// ─── Mobile view switcher ───────────────────────────────────────────────────
// On narrow screens the transcript is NOT a slide-in drawer — it's a tabbed
// sibling of the questions area. Tapping a tab flips a data attribute on
// #listeningExamScreen that CSS uses to show/hide the two panes. On desktop
// this function is effectively a no-op: both panes are visible via the
// side drawer, and the mobile tab bar is display:none.
function switchExamMobileView(view) {
  if (view !== 'answers' && view !== 'transcript') return;
  const screen = document.getElementById('listeningExamScreen');
  if (!screen) return;
  screen.setAttribute('data-mobile-view', view);
  document.querySelectorAll('.exam-mobile-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  // When switching TO the transcript, land on the active segment if there is
  // one; otherwise start at the top. Without this the user would land wherever
  // the transcript happened to be scrolled.
  if (view === 'transcript') {
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (!lines) return;
      const activeSeg = lines.querySelector('.transcript-seg.active');
      if (activeSeg) scrollTranscriptTo(activeSeg);
      else lines.scrollTop = 0;
    });
  }
  // Scroll the page itself back to top so the user sees the tab bar (and
  // whatever content it reveals) from the start, not mid-scroll.
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(_){}
}

// Jump directly to an individual word's estimated timestamp (linear within
// the segment). Useful when the student wants to replay a specific phrase.
function seekToWord(segIdx, wordIdx) {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const seg = currentExam.transcript[segIdx];
  if (!seg) return;
  const segEl = document.querySelector(`.transcript-seg[data-idx="${segIdx}"]`);
  const total = segEl ? segEl.querySelectorAll('.tw').length : 1;
  const duration = seg.end - seg.start;
  const offset = total > 0 ? (wordIdx / total) * duration : 0;
  examAudio.currentTime = seg.start + offset;
  if (examAudio.paused) toggleExamAudio();
}

// ─── Submit & Score ──────────────────────────────────────────────────────────
function submitListeningExam() {
  if (examSubmitted) return;
  examSubmitted = true;

  // Stop audio
  if (examAudio && !examAudio.paused) {
    examAudio.pause();
    document.getElementById('examPlayBtn').innerHTML = PLAY_SVG;
    const vinyl = document.getElementById('examVinyl');
    if (vinyl) vinyl.classList.remove('spinning');
  }

  const exam = currentExam;
  let totalCorrect = 0;
  let totalQuestions = 0;
  const liItems = [];   // per-question detail for the teacher drill-down (QA #4)

  exam.sections.forEach((section) => {
    section.questions.forEach((q) => {
      totalQuestions++;
      let userAnswer = '';
      if (section.type === 'truefalse' || section.type === 'mcq') {
        const checked = document.querySelector(`input[name="${q.id}"]:checked`);
        userAnswer = checked ? checked.value : '';
      } else if (section.type === 'fillblank') {
        const input = document.querySelector(`input[name="${q.id}"]`);
        userAnswer = input ? input.value.trim().toLowerCase() : '';
      }

      const correct = section.type === 'fillblank'
        ? userAnswer === q.answer.toLowerCase()
        : userAnswer === q.answer;

      if (correct) totalCorrect++;
      liItems.push({
        q: (q.text || q.prompt || q.question || q.q || q.id || ''),
        a: userAnswer,
        correct: (q.answer == null ? '' : String(q.answer)),
        ok: !!correct
      });

      const qEl = document.querySelector(`.exam-q[data-id="${q.id}"]`);
      if (qEl) {
        qEl.classList.add(correct ? 'exam-q-correct' : 'exam-q-incorrect');
        if (!correct) {
          const fb = document.createElement('div');
          fb.className = 'exam-q-feedback';
          fb.textContent = 'Correct: ' + q.answer;
          qEl.appendChild(fb);
        }
      }
    });
  });

  // Disable inputs
  document.querySelectorAll('#examSectionsContainer input').forEach(i => i.disabled = true);

  // Show results
  const pct = Math.round((totalCorrect / totalQuestions) * 100);
  const resultsArea = document.getElementById('examResultsArea');
  resultsArea.style.display = 'block';
  resultsArea.innerHTML = `
    <div class="exam-results-card ${pct >= 70 ? 'exam-pass' : 'exam-fail'}">
      <div class="exam-results-score">${totalCorrect}/${totalQuestions}</div>
      <div class="exam-results-pct">${pct}%</div>
      <div class="exam-results-label">${pct >= 70 ? '🎉 Well Done!' : '📖 Keep Practicing!'}</div>
    </div>`;

  document.getElementById('examSubmitBtn').style.display = 'none';

  // Reveal the transcript drawer. `has-transcript` unlocks the toggle tab
  // (it appears on the right edge); `drawer-open` slides the panel into view.
  // IMPORTANT: clear the inline `display` we set in render() — do NOT set
  // display:block here. #examTranscript's CSS rule is `display: flex` with
  // `flex-direction: column`, which is what gives .transcript-lines a bounded
  // height so its `overflow-y: auto` actually scrolls. Setting display:block
  // inline would override the flex, collapse the height chain, and make the
  // whole transcript render full-length with no internal scroll.
  const transcriptArea = document.getElementById('examTranscript');
  if (transcriptArea) {
    transcriptArea.style.display = '';
    const split = document.querySelector('.exam-split');
    const screen = document.getElementById('listeningExamScreen');
    if (split) {
      split.classList.add('has-transcript');
      split.classList.add('drawer-open');
    }
    // Mirror the class onto the screen itself so the CSS padding-right rule
    // shifts the audio player + header, not just the questions area. We also
    // mirror `has-transcript` so the mobile tab bar (which sits outside the
    // .exam-split subtree) can key off it without needing CSS :has().
    if (screen) {
      screen.classList.add('drawer-open');
      screen.classList.add('has-transcript');
      // Default mobile view = 'answers'. CSS on mobile uses this attribute
      // to choose which pane is visible; the user taps the "Transcript" tab
      // to switch. This has no effect on desktop (tab bar is display:none).
      if (!screen.hasAttribute('data-mobile-view')) {
        screen.setAttribute('data-mobile-view', 'answers');
      }
    }

    // Start at the top of the transcript so the student reviews from the
    // beginning, not wherever the playhead happened to stop (which after a
    // full listen was the very bottom — "all the way down").
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (lines) lines.scrollTop = 0;
    });
  }

  // ── Track to Firebase ──
  logListeningExamSession(totalCorrect, totalQuestions, pct, liItems);

  resultsArea.scrollIntoView({ behavior: 'smooth' });
}

// ─── Firebase Session Logging ────────────────────────────────────────────────
async function logListeningExamSession(correct, total, pct, items) {
  // Phase F: preview mode — teacher is just inspecting the exam,
  // don't pollute their session history or trigger XP / activity logs.
  if (window.__previewMode) {
    console.log('[preview] skipping listening session write');
    return;
  }
  if (typeof auth === 'undefined' || !auth.currentUser) return;
  try {
    // Denormalize student class / level / module — see Phase B in DEPLOY.md.
    const scope = (typeof studentScopeFields === 'function') ? studentScopeFields() : { studentClass:'', studentLevel:'', studentModule:'' };
    await db.collection('sessions').add({
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || auth.currentUser.email || 'Student',
      book: typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
      activity: 'listening-exam',
      // Record the REAL exam id (was hardcoded 'fsmept'/'exam'). The
      // assignment-completion matcher pairs session.unit with
      // assignment.examId, so this must be the actual exam id —
      // otherwise listening assignments never auto-complete and any
      // future second listening exam would be indistinguishable.
      level: (currentExam && currentExam.level) || 'exam',
      unit:  (currentExam && currentExam.id)    || 'fsmept',
      examTitle: (currentExam && currentExam.title) || '',
      score: correct,
      total: total,
      percentage: pct,
      correctAnswers: correct,
      totalQuestions: total,
      wordsLearned: [],
      answers: { skill: 'listening', items: items || [] },   // per-question detail (QA #4)
      ...scope,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // XP reward
    if (typeof addXP === 'function') addXP(Math.round(pct / 10));

    // Refresh journey stats
    if (typeof loadJourneyStats === 'function') await loadJourneyStats();

    // Log activity
    if (typeof ActivityLogger !== 'undefined') {
      await ActivityLogger.logPracticeCompleted({
        book: typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
        level: 'exam', unit: 'fsmept',
        activity: 'listening-exam', score: pct, wordsCount: total
      });
    }
  } catch (e) { console.error('Failed to log listening exam:', e); }
}

function backFromExam() {
  if (examAudio) { examAudio.pause(); examAudio.currentTime = 0; }
  document.getElementById('examPlayBtn').innerHTML = PLAY_SVG;
  const vinyl = document.getElementById('examVinyl');
  if (vinyl) vinyl.classList.remove('spinning');
  // Back to Hub, not the vocabulary menu. backToHub() (defined in hub.js)
  // also refreshes the skill progress rings on the way out.
  if (typeof backToHub === 'function') {
    backToHub();
  } else {
    showScreen('hubScreen');
  }
}

// ─── Transcript Calibration Tool ─────────────────────────────────────────────
// Hidden admin tool for aligning EXAM_TRANSCRIPT timestamps against the actual
// audio. Activate with ?calibrate=1 on the URL. Press SPACE when you hear each
// segment begin, Z to undo, E to export the updated transcript array.
// ─────────────────────────────────────────────────────────────────────────────
let calibrationCaptures = [];   // array of {segIdx, capturedAt}
let calibrationNextIdx = 0;     // index of the next segment to capture

function isCalibrationMode() {
  try { return new URLSearchParams(window.location.search).has('calibrate'); }
  catch (e) { return false; }
}

function initCalibrationMode() {
  if (!currentExam || !currentExam.transcript) return;

  calibrationCaptures = [];
  calibrationNextIdx = 0;

  // Reveal the transcript drawer (open by default in calibration mode — the
  // operator needs it visible to do their job). Clear the inline display so
  // the CSS flex rule wins — see note in submitListeningExam.
  const transcriptArea = document.getElementById('examTranscript');
  if (transcriptArea) {
    transcriptArea.style.display = '';
    const split = document.querySelector('.exam-split');
    if (split) split.classList.add('has-transcript', 'drawer-open');
    const screen = document.getElementById('listeningExamScreen');
    if (screen) {
      screen.classList.add('drawer-open', 'has-transcript');
      // In calibration mode the operator needs to SEE the transcript, so on
      // mobile default the view to 'transcript' (not 'answers').
      screen.setAttribute('data-mobile-view', 'transcript');
    }
  }

  // Remove any existing panel so re-render doesn't duplicate it
  const existing = document.getElementById('calibrationPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'calibrationPanel';
  panel.className = 'calibration-panel';
  panel.innerHTML = `
    <div class="cal-header">
      <span class="cal-badge">🎯 CALIBRATION MODE</span>
      <span class="cal-progress" id="calProgress">0 / ${currentExam.transcript.length}</span>
    </div>
    <div class="cal-current">
      <div class="cal-label">Listen for segment <span id="calSegNum">1</span>:</div>
      <div class="cal-text" id="calText"></div>
    </div>
    <div class="cal-time-row">
      <span class="cal-label">Current time:</span>
      <span class="cal-time" id="calTime">0:00.0</span>
    </div>
    <div class="cal-actions">
      <button onclick="calibrationCapture()" class="cal-btn cal-btn-primary" title="Space">
        <kbd>Space</kbd> Mark Start
      </button>
      <button onclick="calibrationUndo()" class="cal-btn" title="Z">
        <kbd>Z</kbd> Undo
      </button>
      <button onclick="calibrationExport()" class="cal-btn cal-btn-export" title="E">
        <kbd>E</kbd> Export
      </button>
    </div>
    <div class="cal-hint">
      Press <kbd>Space</kbd> the instant the speaker begins the highlighted segment.
      Use the player's ⏪ / ⏩ buttons to rewind and try again if you miss it.
      Already-captured segments show ✓ in the transcript below.
    </div>
    <textarea id="calOutput" class="cal-output" style="display:none;" readonly placeholder="Export output will appear here…"></textarea>
  `;
  document.body.appendChild(panel);

  // Stream the live audio time into the panel
  if (examAudio) examAudio.addEventListener('timeupdate', updateCalibrationTime);

  updateCalibrationUI();

  // Keyboard shortcuts (registered once; safe to call repeatedly because we
  // remove the previous listener before adding a new one)
  document.removeEventListener('keydown', calibrationKeyHandler);
  document.addEventListener('keydown', calibrationKeyHandler);
}

function calibrationKeyHandler(e) {
  if (!isCalibrationMode()) return;
  // Don't steal keys while the operator is typing in a field
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') { e.preventDefault(); calibrationCapture(); }
  else if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); calibrationUndo(); }
  else if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); calibrationExport(); }
}

function calibrationCapture() {
  if (!examAudio || !currentExam) return;
  if (calibrationNextIdx >= currentExam.transcript.length) return;

  const t = examAudio.currentTime;
  calibrationCaptures.push({ segIdx: calibrationNextIdx, capturedAt: t });
  calibrationNextIdx++;
  updateCalibrationUI();

  // Brief flash for tactile feedback
  const panel = document.getElementById('calibrationPanel');
  if (panel) {
    panel.classList.add('cal-flash');
    setTimeout(() => panel.classList.remove('cal-flash'), 180);
  }
}

function calibrationUndo() {
  if (calibrationCaptures.length === 0) return;
  calibrationCaptures.pop();
  calibrationNextIdx = Math.max(0, calibrationNextIdx - 1);
  updateCalibrationUI();
}

function updateCalibrationTime() {
  const el = document.getElementById('calTime');
  if (el && examAudio) {
    const t = examAudio.currentTime;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    el.textContent = `${m}:${s}`;
  }
}

function updateCalibrationUI() {
  const progress = document.getElementById('calProgress');
  const segNum = document.getElementById('calSegNum');
  const text = document.getElementById('calText');
  if (!currentExam) return;
  const total = currentExam.transcript.length;

  if (progress) progress.textContent = `${calibrationNextIdx} / ${total}`;

  // Clear any previous target highlight
  document.querySelectorAll('.transcript-seg.cal-target').forEach(el =>
    el.classList.remove('cal-target'));

  // Mark the already-captured segments as done
  document.querySelectorAll('.transcript-seg.cal-done').forEach(el =>
    el.classList.remove('cal-done'));
  calibrationCaptures.forEach(c => {
    const el = document.querySelector(`.transcript-seg[data-idx="${c.segIdx}"]`);
    if (el) el.classList.add('cal-done');
  });

  if (calibrationNextIdx >= total) {
    if (segNum) segNum.textContent = '✓';
    if (text) text.textContent = 'All segments captured. Press E to export.';
    return;
  }

  const seg = currentExam.transcript[calibrationNextIdx];
  if (segNum) segNum.textContent = calibrationNextIdx + 1;
  if (text) text.textContent = seg.text;

  const targetEl = document.querySelector(`.transcript-seg[data-idx="${calibrationNextIdx}"]`);
  if (targetEl) {
    targetEl.classList.add('cal-target');
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function calibrationExport() {
  if (!currentExam) return;
  const orig = currentExam.transcript;
  const captures = new Map(calibrationCaptures.map(c => [c.segIdx, c.capturedAt]));

  // Each segment's start = captured time; end = next segment's captured start
  // (or original end if no next capture exists).
  const round = v => Math.round(v * 10) / 10;
  const updated = orig.map((seg, i) => {
    const newStart = captures.has(i) ? captures.get(i) : seg.start;
    const nextStart = captures.has(i + 1)
      ? captures.get(i + 1)
      : (orig[i + 1] ? orig[i + 1].start : seg.end);
    return {
      start: round(newStart),
      end: round(nextStart),
      text: seg.text,
      section: seg.section
    };
  });

  // Format as pretty JS array literal (unquoted keys, aligned columns)
  const lines = updated.map(s => {
    const start = String(s.start).padStart(6, ' ');
    const end = String(s.end).padStart(6, ' ');
    const sectionVal = typeof s.section === 'string' ? `'${s.section}'` : s.section;
    const textEscaped = s.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `  { start: ${start}, end: ${end}, text: '${textEscaped}', section: ${sectionVal} },`;
  });
  const js = 'const EXAM_TRANSCRIPT = [\n' + lines.join('\n') + '\n];';

  const output = document.getElementById('calOutput');
  if (output) {
    output.value = js;
    output.style.display = 'block';
    output.focus();
    output.select();
    // Best-effort clipboard copy
    try {
      navigator.clipboard.writeText(js).then(() => {
        if (typeof showToast === 'function') showToast('Transcript copied to clipboard');
      });
    } catch (e) { /* fall through to manual select */ }
  }
  console.log('[calibration] Exported transcript:\n' + js);
}
