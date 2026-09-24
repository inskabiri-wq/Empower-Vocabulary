# 2026-08-26 - my format sniffer refused every real Excel file

Reported: uploading both roster sheets gave

> **One sheet could not be read**
> Student sheet: That file is not a spreadsheet - it could not be opened as
> one. Re-save the roster from Excel as .xlsx or .csv and upload that.
> Teacher sheet: (the same)

Both sheets were genuine .xlsx files. This is a regression I shipped earlier
today.

## What went wrong

I added a last-resort check to `describeFile()` so that arbitrary binary handed
to the importer would be refused with a useful sentence instead of being read
by SheetJS as mojibake. It counts control bytes in the first 512 and refuses
above 10%.

**A .xlsx IS a zip, and Excel writes it DEFLATE-compressed.** After the local
header it is dense binary. Measured on the real departmental file:

| file | control bytes in first 512 | verdict |
| --- | --- | --- |
| real `MODULE 4 INSTRUCTORS & CLASSES.xlsx` | **99 = 19.3%** | refused |
| my test fixture | 23 = 4.5% | passed |

So the threshold caught every genuine workbook.

## Why the torture test did not catch it

**The fixtures were cleaner than reality.** `XLSX.write()` writes zips
**STORED** (uncompressed) by default, so the fixtures' first 512 bytes are
readable XML and filenames - 4.5% control bytes. Excel compresses, so a real
file is four times denser. Twenty-nine cases passed against files no Excel
would ever produce.

That is the lesson worth keeping: a fixture that is tidier than the input the
feature exists to handle tests nothing about that input.

## Fix

`describeFile()` now **returns early on any zip**:

- `PK` header, encryption bit set -> the password message
- `PK` header, name ends `.docx` / `.pptx` -> the Word/PowerPoint message
- `PK` header, anything else -> **`return null`**, hand it to SheetJS

A zip is a plausible workbook, and SheetJS is the thing that actually knows
whether it opens. The control-byte heuristic now only ever sees files that are
neither a recognised container (zip / OLE2 / PDF) nor text, which is what it was
written for.

Fixtures now use `{ compression: true }`, so they measure like real Excel
output.

## Verified

New permanent case, **"a REAL compressed .xlsx is never refused by the format
sniffer"**, which asserts three things at once:

- the sniffer returns `null` for it
- the fixture is genuinely dense (**>10% control bytes**), so the test would
  actually have caught the bug
- the file still imports

Suite is now **30 cases, all passing**.

Against the real file, through the shipped path:

```
sniffer verdict : PASSES (correct)
teachers found  : 28   hard problems: 0   need email: 28
```

Everything else the sniffer catches still works: old .xls, password-protected
workbooks, Google Sheets links, saved web pages, PDFs, Word files, zero-byte
files and random binary are each still refused with their own sentence.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan on both touched files - clean
- gates: all eight PASS
- bump: roster-import.js v15, CACHE_VERSION -> **v352**; `--check` OK
