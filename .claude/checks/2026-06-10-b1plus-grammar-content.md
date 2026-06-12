# B1+ grammar content (full bank) · 2026-06-10

## What
- grammar-content.js: replaced the 2-topic B1+ scaffold (8 Q) with a full
  generated bank: 18 topics across 9 units, 934 questions.
- New B1+ generators: b1pPresPerfCont, b1pPastPerfect, b1pFutureCont,
  b1pDeduction (coherent evidence -> conclusion pairs), b1pPastModals,
  b1pCond3, b1pWish, b1pPassivePerf, b1pCausative, b1pReported,
  b1pReportedQ, b1pVerbObj, b1pRelativeND.
- Reused for review topics: G.pp, G.b1PastCont, G.b1FutureWillGoing,
  G.b1Relative, G.b1GerundInf.
- Unit map: U1 PresPerfCont+PresPerf, U2 PastPerf+PastCont, U3 FutCont+will,
  U4 Deduction+PastModals, U5 Cond3+wish, U6 PerfPassive+Causative,
  U7 Reported+ReportedQ, U8 Relatives+NonDefining, U9 GerundInf+VerbObj.

## Quality gates (node executed the real file)
- node --check OK. A2 1149 / B1 1023 / B1+ 934 / B2 8 (B2 still scaffold).
- B1+: 0 problems (blank present, valid answer index, no dup options),
  100% four-option, 0 em-dashes, 0 subject-verb agreement errors.
- Per-unit: U1-U7,U9 = 104; U8 = 102 (generator pool size, padTo4 keeps 4-opt).
- Fixed during build: deduction first draft cross-paired evidence x conclusion
  ("He hates coffee, so it can't be home") -> rewrote as 32 coherent pairs;
  past-modals "It was a mistake:" framing -> natural sentences; U4 dropped to
  84 after the coherence fix -> past-modals cap 52 -> 72, U4 back to 104.

## Wiring (no code change needed)
- levels: ['A2','B1','B1+','B2'] exported; student level pills (grammar.js
  reads DATA.levels) and the teacher grammar-assignment form
  (grammarLevelSelect reads data.levels) both pick up B1+ automatically.

## Cache
- grammar-content.js ?v=6 -> ?v=7 (student-dashboard.html + teacher-dashboard.html).
- service-worker.js CACHE_VERSION v30 -> v31 (covers heist-student.js /
  heist.css from the earlier heist end-screen fix too).

## Deploy
- firebase deploy --only hosting (user runs it).
