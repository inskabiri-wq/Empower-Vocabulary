# Course images + cert + feedback demo + modal/mobile fixes · 2026-06-12

## 1. Certificate redesign (matches the printed FSM Certificate of Participation)
- policy-course.html + policy-course.css (v3): landscape A4 (aspect 297/210),
  thick blue gradient frame + thin double silver inner frame, department
  lockup (fsm-logo.png + YABANCI DİLLER BÖLÜMÜ red / FOREIGN LANGUAGES
  DEPARTMENT blue), Great Vibes script heading + name, italic Georgia
  statement with the course name in bold caps, round gold seal, signature
  block (advisor name + title), small cert-ID/date/score meta.
- Content: certificate.courseName 'AI USE GUIDELINES', statement with
  {course}/{year} placeholders, signName + signTitle. policy-course.js (v4)
  fills them, academic year from the student's reg year or Sep-Aug cycle.
- Verified live (preview computed styles): script font loaded, frame 10px,
  logos+seal load, bold course name, red/blue dept text, round seal,
  space-between bottom row.

## 2. 10 course images wired into the 10 lessons (policy-course-content.js v4)
- y/Images/ (user-created): branded "English Preparatory · AI Unit" cover →
  M1L1 hero; leather + white policy-book shots → rules lessons; book-heart →
  promises; woman-at-laptop → responsibility; man-reading → quick answers;
  Digital Policy & Ethics Archive → practice; world map → group work; two
  FSM campus shots → consequences/recap. Bilingual captions.
- Renderer = lessonMediaHtml() (already added); 0 missing files (exact case
  /Images/Slide1.JPG etc.), 0 em dashes. firebase.json does NOT ignore
  Images/, so it deploys (tools/ IS ignored).

## 3. Writing AI Feedback showcase (y/writing-feedback-demo.html)
- Standalone, no login, deployable (root, not tools/). Mirrors the real
  feature: sample Task-2 essay with 8 colour-coded inline highlights
  (TA violet / CC emerald / GR sky / VO amber — the real CRIT_COLORS),
  5 anchored comment cards (criterion chip + quote + note), and the grading
  sidebar (4 band scores, total 14/20, overall comment, Graded status).
  Verified live: marks/colours/2-col/total all correct.

## 4. Activation modal fixes (policy-course-admin.js v4 + teacher-dashboard)
- Levels + Modules now use FIXED canonical lists (A2/B1/B1+/B2, Module 1-4)
  instead of roster-derived values (old demo accounts stored "1","2" which
  leaked into the ticks). Classes + years stay roster-derived.
- Checkbox ticks: scoped <style> for #courseActivateModal overrides
  brand.css (raw native box) + assignments.css custom box -> clean
  accent-coloured native box + WHOLE-card highlight when ticked, like the
  other pickers. Combinable AND-across / OR-within scope unchanged.

## 5. courses.html Start button mobile alignment
- @media 560px: .crs-card wraps, .crs-right full width, the action button
  is display:block width:100% box-sizing:border-box (was inline-block,
  floated centred). Now fills the card cleanly on phones.

## Answered in chat (no code)
- Student level: already a fixed 4-option dropdown at registration
  (index.html #regLevel A2/B1/B1+/B2); students cannot type it.
- Data backup / moving PCs: all data lives in Firebase (cloud), not the PC.

## Cache
- policy-course-content.js v3->v4 (4 pages), policy-course.js v4,
  policy-course.css v3, policy-course-admin.js v3->v4, SW v36->v37.

## Deploy
- firebase deploy --only hosting (rules unchanged this round).
