# B1 grammar bank + teacher per-question view · 2026-06-10

Two requested items: build B1, and the teacher per-question view. (Other skills
NOT touched per the user; "replica" was a principle for the future.)

## 1. B1 content (grammar-content.js v5->v6)
- Full B1 bank: 1023 questions, 20 topics across 10 coursebook units, ~104/unit,
  100% four-option, 0 agreement errors. Built with the SAME engine as A2
  (mk / build / padTo4 + verb/adjective/subject pools).
- New B1 generators: past continuous, used to, will/won't, going to, modals
  (must/have to/should + might/can), 1st & 2nd conditional, too/enough,
  a few/a little, present & past passive, relative clauses, gerund vs infinitive.
- Reused A2 generators for shared points: present simple/continuous, question forms,
  present perfect, pp-vs-past, comparatives, much/many.
- Fixed a capitalisation bug: qsubj() now lowercases "My/The/Her..." mid-sentence
  ("If my sister worked..." not "If My sister..."). Helps A2 too.
- Levels now: A2 (1149 Q, full), B1 (1023 Q, full), B1+ / B2 (still scaffold).

## 2. Teacher per-question view (teacher/js/activity.js)
- Grammar activity rows are now tappable. Expanding shows each question with
  ✅/❌ and, for wrong ones, `chose "X"  answer "Y"`. Reads session.grammarDetails
  (already captured at play time). Self-contained (inline styles, no CSS change).
- Also fixed 2 em dashes here: my new comment + a VISIBLE score fallback '—' -> '-'.

## Cache
- grammar-content.js v5->v6 (student + teacher dashboards), service-worker.js v28->v29.

## Verify
- node --check activity.js + grammar-content.js OK.
- B1: 1023 Q, 0 problems, 100% four-option, 0 agreement, no mid-sentence capitals.
- A2 still 1149 Q / 4-option. Per-question detail wired (grammarDetails read).

## Deploy + note
- firebase deploy --only hosting (SW v29). B1 shows under Grammar -> B1 tab.
- The per-question view only populates AFTER students play grammar on the deployed
  build; check tomorrow once the Firestore read quota resets.
