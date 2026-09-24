# 2026-08-29 - FSM out of the visible app, and terms rewritten as a product

Three passes, all verified. Nothing to do with data, accounts or students.

## 1. Visible strings (15)

Splash label, both email placeholders, five rejection messages, the popup
title, the onboarding kicker and sign-in line, the reset-password footer, and
the two organisation labels.

Two beyond the approved list: `auth.js:81` carried a fifteenth message the
first scan missed, and the org admin showed a badge reading **"FSM
(protected)"**, which is exactly the class that was asked for. Both changed;
the second flagged.

**The access gates were not touched.** Verified byte-for-byte afterwards:

```
auth.js:22                    endsWith('@fsm.edu.tr') || endsWith('@stu...')
main.js:255,345,394,498,614   unchanged
org lists                     domain: 'fsm.edu.tr' unchanged, only name: changed
```

The wording and the check are separate lines. Students sign in exactly as
before; only the text a rejected user reads is different.

Incidentally an improvement: `_allowedDomainsHumanMessage()` already builds the
message from the live domain list when OrgRegistry has loaded. The FSM sentence
replaced was only its last-resort fallback.

## 2. Comments (62 lines, 31 files)

Scripted with an explicit ordered mapping, never a blanket `FSM -> X`, under
three rules: comment lines only, any line carrying a code identifier
(`FSMVULoader`, `fsmvu-*`) skipped entirely, and `tools/` left alone.

`js/tenant.js` keeps its reference deliberately. That file **is** the place an
institution is named, so a comment naming it is correct rather than a leak.

The first pass missed two lines because they are **continuation lines inside a
multi-line HTML comment**: the filter required a line to begin with a comment
marker, and `(otherwise its first read fails...` begins with a bracket. Caught
by the verification scan and fixed by hand. Worth remembering: matching comments
by their opening marker misses every line after the first.

## 3. Terms of service, rewritten as a sellable product

The old document was written for one university. The new one is written for a
product with customers, and names none.

| | before | after |
| --- | --- | --- |
| sections | 10 | **12** |
| controller | FSMVU, by name | **"your Institution"**, defined in Section 1 |
| the author | "EdTech and AI Coordinator" | **"the Provider"**, developer and operator |
| institution named | throughout | **nowhere** |

Definitions now open the document (Provider / Institution / you), so a second
university needs **zero edits** to this file. New sections cover governing law
(Turkish law, Istanbul courts), automated decisions (the App scores, teachers
decide), legal basis for processing, and what happens to data on termination.

Section 8 is stronger than before: exclusive property, a revocable
non-exclusive non-transferable licence that cannot be assigned to another
institution, no source-code claim, and no transfer of any right by the document
or by use of the App.

The employment title is gone entirely, which was the point: nothing in the
document ties the App to a job.

### Verified by rendering, not by counting

Markup balance is 36/36 div, 48/48 p, 12/12 ul, 43/43 strong, and 12 sections
in each language. But balance proves nothing about what a reader sees, so the
page was served and parsed:

- **no raw HTML entities** left in either rendered block
- Turkish resolves properly: "Alireza Kabiri'nin munhasir mulkiyetindedir"
- **no FSM or Fatih in the rendered text of either language**
- the modal opens, both language tabs switch, content is 3300px and scrolls

One note against a false alarm: the first screenshot showed the terms ghosted
behind the login card. That was a mid-transition capture, not a layering bug.
Checked properly, the modal is `position: fixed`, `z-index: 1000` against the
card's `auto`, and the second screenshot is correct. This is the preview pane
not compositing, which is already in memory.

## Left alone on instruction

The certificate line on the onboarding deck, the policy course, demo accounts,
`firestore.rules`, `js/tenant.js`, the domain allowlist, and everything in
`tools/`.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: CACHE_VERSION -> **v380**; `--check` OK
- `index.html` backed up to the scratchpad before the terms were spliced
