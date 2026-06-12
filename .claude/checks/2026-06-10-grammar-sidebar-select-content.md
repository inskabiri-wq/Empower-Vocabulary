# Grammar sidebar -> vocab "Select Content" replica · 2026-06-10

User compared grammar vs vocab again ("are they?"). Real gap was the SIDEBAR.

## Was
Two cards: [📚 Level] and [📖 Unit + count]. No Book row. Count = "questions at A2".

## Now (grammar.js v12->v13, grammar.css v10->v11)
One card "📚 Select Content" mirroring vocab:
  - Book row: 📘 Empower (active teal chip; grammar is Empower-only, no Gateway grammar)
  - Level row: A2 / B1 / B1+ / B2
  - Unit row: All / U1..U11 (7-col)
  - Big teal count "N questions selected" (now reflects the selected unit, like vocab's
    "951 words selected"); .gr-count-num given the teal gradient text like vocab.
  + .gr-sel-group / .gr-sel-lbl styles.
Map button stays below the card.

## Verify
- node --check OK; stubbed render OK. css braces 163/163. Select Content + dynamic
  selCount present.

## Note on the font (the prior question)
- Code is correct: #grammarScreen uses Nunito (extra.css loads Nunito; nothing
  overrides). If it still looked different it was cache / not-yet-deployed.

## Cache
- grammar.js v12->v13, grammar.css v10->v11, service-worker.js v24->v25.

## Deploy
- firebase deploy --only hosting; reopen (SW v25).
