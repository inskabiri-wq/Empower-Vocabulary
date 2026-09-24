# Lingualab - Terms of Service revision, DRAFT for the FSMVU KVKK office

**Status: draft for legal review. Nothing in the app has been changed.**
Prepared 26 August 2026. The live text is the modal in `y/index.html`
(English from line 211, Turkish from line 302), last updated December 2024.

I am not a lawyer. This sets out what the current text says, what looks wrong
about it, and a proposed replacement for the three sections that matter, so the
KVKK office has something concrete to react to rather than a blank page.

---

## 1. The question that prompted this

Alireza Kabiri is currently named in the Terms in **three different roles**:

| section | role | EN line | TR line |
| --- | --- | --- | --- |
| 3 | **Data Controller / Veri Sorumlusu** | 240 | 331 |
| 6 | owner of the software, interface and content | 267 | 358 |
| 10 | contact point for KVKK requests | 291 | 382 |

Only the first is a legal position with duties attached. The other two are
uncontroversial and can stay as they are.

## 2. Why the controller designation should be reviewed

Under KVKK Law No. 6698, the *veri sorumlusu* is the party that determines the
**purposes and means** of processing. That party carries:

- VERBIS registration duty (subject to the size and turnover exemptions)
- the duty to answer Article 11 requests within 30 days
- breach notification to the Board within 72 hours
- liability for administrative fines

The facts here point at the institution rather than an individual:

- the service is restricted to `@fsm.edu.tr` and `@stu.fsm.edu.tr` addresses
  (Terms section 1)
- the data subjects are FSMVU students and staff
- the purpose is FSMVU's English preparatory programme
- it is operated by an FSMVU employee **in the course of that employment**, as
  EdTech and AI Coordinator - the title is stated in the Terms themselves

An employee acting within their role normally acts *for* the institution. If
that is right, the current text names the wrong controller, which is a
compliance problem in its own right (the notice must correctly identify the
controller) as well as placing personal exposure where institutional exposure
belongs.

**This is the single question for the office: is FSMVU the veri sorumlusu?**
Everything below follows from the answer.

## 3. Ownership is a separate question, and can stay

Data controllership and intellectual property are unrelated. FSMVU can be the
controller while the software remains Alireza Kabiri's work.

What actually decides IP is the **employment contract**, not the Terms. Under
FSEK, economic rights in a work created by an employee within the scope of
their duties generally vest in the employer unless otherwise agreed. So:

- if there is an existing written agreement, section 6 should match it
- if there is not, one is worth having, and section 6 should not assert more
  than that agreement supports

If FSMVU is the controller and the app is operated personally or through a
separate entity, the missing instrument is a **data processing agreement**
between the university and the operator.

## 4. Other gaps found while reading the current text

1. **The date is stale.** "Last Updated: December 2024" / "Son Güncelleme:
   Aralık 2024". Twenty months old.
2. **Processing added since then is not described.** The app now includes an
   AI writing corrector, a placement test, calls to a third-party AI model
   (Gemini), and classroom games that accept **anonymous** participants.
3. **Anonymous participation is materially different** and is not covered at
   all. Classroom game players sign in anonymously: a display name they type
   themselves and a score, no account, no `@fsm.edu.tr` check. That contradicts
   section 1 as written ("Only users with valid @fsm.edu.tr ... may register
   and use this service"), and it needs its own paragraph.
4. **Third-country transfer is not addressed.** Firebase and any AI model call
   involve processing outside Türkiye. KVKK Article 9 governs that.
5. **No governing-law or jurisdiction clause.** Turkish law is mentioned only
   in passing under "Consequences of Misuse".
6. **No retention periods.** Section 3 lists what is collected but not for how
   long it is kept.

---

## 5. Proposed replacement text

Square brackets mark the decisions the office needs to make.

### Section 3 - Data Collection & Privacy (KVKK Compliance)

> **Data Controller (Veri Sorumlusu):** [Fatih Sultan Mehmet Vakıf University],
> [address], [VERBIS registration number if applicable].
>
> **Contact for data requests:** Alireza Kabiri, EdTech and AI Coordinator,
> akabiriaslifar@fsm.edu.tr. [Add the university's own KVKK contact address.]
>
> **What is processed:** name, institutional email address, student number,
> class and level, and records of activity within the App (exercises attempted,
> scores, submitted writing, placement test results).
>
> **Purpose:** delivering and administering the English preparatory programme,
> tracking academic progress, and reporting to instructors.
>
> **Legal basis:** [Article 5/2 grounds relied on - to be confirmed by the
> office.]
>
> **Retention:** [X] years after the student's relationship with the University
> ends, after which records are deleted or anonymised.
>
> **Transfer abroad:** the App runs on Google Firebase and certain features
> send text to third-party AI providers for automated feedback. This involves
> processing outside Türkiye, under Article 9 of KVKK. [Confirm the transfer
> mechanism relied on.]

### New section - Classroom games and anonymous participation

> Some classroom activities may be joined **without an account**, using a
> session code supplied by the instructor. In that case the App stores only a
> display name typed by the participant and a score for the duration of the
> activity. No institutional email address, student number or account is
> created, and the record is not linked to any student profile. These records
> are [deleted / retained for X] after the activity ends.

### Section 6 - Intellectual Property

> [To match whatever the employment agreement provides. If rights are the
> author's:] The software, interface design and original learning content of
> the App are the work of Alireza Kabiri and are made available to Fatih Sultan
> Mehmet Vakıf University for educational use. Third-party coursebook material
> remains the property of its publishers. Unauthorised reproduction,
> distribution or commercial use is prohibited.

### New section - Governing law

> These Terms are governed by the laws of the Republic of Türkiye. [Courts and
> enforcement offices of İstanbul] shall have jurisdiction over any dispute.

### Header

> **Last Updated:** [date of adoption] · **Version:** [2.0]

---

## 6. What has to happen in the app afterwards

Not started; listed so it is not forgotten.

1. Replace both language versions of the modal in `y/index.html`. They are
   separate blocks and both must change; the Turkish is the operative one for
   Turkish-law purposes.
2. Update the date and version line in both.
3. **Re-consent.** If the controller changes, existing users have been given a
   notice naming the wrong party. The office should say whether acceptance
   needs to be collected again; if so, the app needs a "terms updated" gate on
   next sign-in, which does not exist yet.
4. Add the anonymous-play notice to the classroom join screens, which currently
   show no privacy text at all.

## 7. One-line summary for the office

*The Terms currently name an individual employee as data controller for a
university service used by roughly 400 students, rising to 1000. Please confirm
whether FSMVU should be the controller, and if so approve the revised sections
above.*
