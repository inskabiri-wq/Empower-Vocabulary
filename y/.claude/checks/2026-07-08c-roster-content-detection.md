# 2026-07-08 (c) - Roster import: content-based column detection (never swap email/No)

## Ask
"For sheet headers make sure it never fails and understands the columns so it
would never write student email for No or vice versa - really important."

## Change - y/teacher/js/roster-import.js (?v=5 -> ?v=6)
Column mapping was header-name only. Added a CONTENT classifier so the actual
cell values decide which column is which, then reconcile with headers:
- classifyColumns(): per column, count cells that are email (has @ . ), long
  number (4+ digits = student no), class code, CEFR level, or a 2-word name.
- reconcile(): EMAIL is the anchor - always the column that truly holds
  addresses (content overrides a wrong/absent header). STUDENT NO is a numeric
  column and NEVER the email column. Class/level/name fill from header first,
  else content. Every content override emits a human note.
- Fallbacks: header row auto-detected (skips banner/title rows); if NO header,
  start at first email row and classify purely by content.
- Broadened HEADER_ALIASES (more TR/EN synonyms for email/name/no/class/level).
- Extracted columnsForAoa(aoa) (pure) + exposed on window.RosterImport for
  testing/debugging; parseFile returns { rows, mapping, notes }.
- New "Detected columns" banner in the dry-run (field -> column letter +
  override notes) so the admin verifies the mapping before creating accounts.
- service-worker v86 -> v87.

## Verify (real code via window.RosterImport.columnsForAoa in a browser iframe)
- Clean TR sheet (NO/AD SOYAD/ÖĞRENCİ NO/E-POSTA/SINIF/SEVİYE): email->D, No->C,
  name->B. PASS.
- **TRUE header swap** (header "ÖĞRENCİ NO" over emails, "E-POSTA" over numbers):
  email->addresses column, No->numbers column, never equal, BOTH correction
  notes fired. PASS - the exact failure the user feared is now impossible.
- No header at all (pure data rows): email/No/name classified from content. PASS.
- Banner/title rows above header: header detected at row 3, email correct. PASS.
- node --check + em-dash clean.

## Deploy: hosting only (client-side; no function/rules change)
    firebase deploy --only hosting
Note: the SERVER rosterImport also re-validates, but the client sends canonical
keys, so this client mapping is authoritative. Hard-refresh after deploy.
