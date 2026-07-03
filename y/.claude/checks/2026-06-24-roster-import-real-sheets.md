# 2026-06-24 - Roster importer: read REAL school sheets (the "why it doesn't read" fix)

User piloted the import with real FSM sheets and it "didn't read" (students + staff).
Root cause found + fixed.

## Why it didn't read
1. The real sheets have a TITLE/banner row ABOVE the header (row 0 = "MODULE IV
   CLASS LISTS" / "FSM PREP - Staff Directory"). The importer used
   sheet_to_json with the FIRST row as the header, so it read the banner as the
   header, matched nothing, and every row failed.
2. The headers are TURKISH (ÖĞRENCİ ADI - SOYADI, ÖĞRENCİ NO, BÖLÜM, SEVİYE,
   SINIFI, EMAIL). The English-only COLUMN_MAP did not recognize them.
3. Two subtleties that bit on the real data:
   - JS lower-casing of Turkish "İ" inserts a combining dot, and ı/ş/ğ/ç/ö/ü are
     not ASCII, so naive matching failed even for the right header.
   - The row-number column "NO" greedily matched "student number" before the
     real "ÖĞRENCİ NO".

## Fix - `y/teacher/js/roster-import.js` parseFile rewrite
- `parseFile` now reads the sheet as an array-of-arrays, AUTO-DETECTS the header
  row (the row within the first 15 that has an Email column + the most known
  columns), and emits rows keyed by CANONICAL fields.
- `normKey` folds Turkish to ASCII (I/İ/ı->i, ş->s, ğ->g, ç->c, ö->o, ü->u) +
  strips remaining accents, so "ÖĞRENCİ ADI - SOYADI" matches alias
  "ogrenci adi - soyadi".
- `HEADER_ALIASES` (TR + EN) for email/name/studentNo/class/level/dept; bare
  "no" intentionally dropped so the row-index column never wins studentNo.
- `normalizeLevel` maps level WORDS to CEFR (elementary->A2,
  pre-intermediate->B1, intermediate->B1+, upper-intermediate->B2,
  advanced->C1); unmapped passes through as a warning. **DEFAULT mapping - user
  to confirm.**
- Canonical-keyed rows feed the existing validator + the rosterImport function
  unchanged (their COLUMN_MAP is already canonical).

## Verification
- node --check OK; no em dashes.
- Parsed the REAL `classlist.xlsx` (the user's MODULE IV list) with the exact
  file logic via the vendored SheetJS in Node:
  headerRow=1; mapped studentNo+name+dept+level+class+email; 332 students;
  studentNo = real number (2521011351, not the row index); name = "AHMAD KATTAN";
  level = "B1" (from "PRE-INTERMEDIATE"); class = "D302";
  email = ahmad.kattan@stu.fsm.edu.tr. Staff sheet -> name + email, 41 rows.

## Open / flagged
- LEVEL WORD -> CEFR mapping is a sensible DEFAULT; confirm it matches FSM's
  scheme (esp. PRE-INTERMEDIATE -> B1, INTERMEDIATE -> B1+).
- Teachers: real production teacher sheet TBD (user will provide a clean
  name+email+class sheet). The staff directory reads fine (name+email) already.
- The class code in the instructors sheet is "D-302" (hyphen) vs students "D302";
  if a teacher sheet uses hyphens, add a strip step.

## Not done
- No deploy. No push.
- GRAMMAR rewrite (fixed questions, all levels) is the NEXT big task - separate.
