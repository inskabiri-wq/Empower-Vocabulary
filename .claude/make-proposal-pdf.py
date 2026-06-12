# Generate the one-page funding-proposal PDF (plain language, USD + TL) with ReportLab.
# NOTE: built-in Helvetica is WinAnsi -> the Turkish Lira sign (U+20BA) and the
# approx sign (U+2248) are NOT in it and would render as black boxes. So we use
# the text "TL" and "~" instead. en-dash/em-dash/curly quotes/middot ARE in WinAnsi.
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable)
import os

OUT   = r"E:\vocab-trainer\Empower-Lab-Funding-Proposal.pdf"
BUILD = OUT + ".new"   # build here first, then atomically swap in
RATE = 46  # ~ TL per US$1, June 2026 (mid-market ~45.9)

BLUE   = colors.HexColor("#1e3a8a")
BLUE2  = colors.HexColor("#2563eb")
GREEN  = colors.HexColor("#047857")
GREYBG = colors.HexColor("#eef2f7")
INK    = colors.HexColor("#1f2937")
MUT    = colors.HexColor("#6b7280")

ss = getSampleStyleSheet()
def st(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

title = st("t",  fontName="Helvetica-Bold", fontSize=16.5, textColor=BLUE,  spaceAfter=2, leading=19)
sub   = st("s",  fontName="Helvetica",      fontSize=9.3, textColor=MUT,  spaceAfter=7, leading=12)
h     = st("h",  fontName="Helvetica-Bold", fontSize=11, textColor=BLUE2, spaceBefore=7, spaceAfter=2, leading=13)
body  = st("b",  fontName="Helvetica",      fontSize=9.4, textColor=INK,  leading=12.6, spaceAfter=2)
cell  = st("c",  fontName="Helvetica",      fontSize=8.8, textColor=INK,  leading=11)
cellb = st("cb", fontName="Helvetica-Bold", fontSize=8.8, textColor=INK,  leading=11)
cellh = st("ch", fontName="Helvetica-Bold", fontSize=8.8, textColor=colors.white, leading=11)
small = st("sm", fontName="Helvetica-Oblique", fontSize=8, textColor=MUT, leading=10, spaceBefore=4)

def tl(s):  # muted TL second line inside a cell
    return "<br/><font size=7.6 color='#6b7280'>" + s + "</font>"

def tli(s):  # muted TL inline (same line, parenthesised)
    return " <font size=7.6 color='#6b7280'>(" + s + ")</font>"

doc = SimpleDocTemplate(BUILD, pagesize=A4,
                        leftMargin=15*mm, rightMargin=15*mm,
                        topMargin=12*mm, bottomMargin=11*mm,
                        title="Empower Lab - Budget Request")
S = []
S.append(Paragraph("Empower Lab &mdash; What We Need, and What It Costs", title))
S.append(Paragraph("Budget request &middot; 400 students &middot; one academic year &middot; figures in US dollars (USD) and Turkish lira (TL)", sub))
S.append(HRFlowable(width="100%", thickness=1, color=BLUE, spaceAfter=7))

S.append(Paragraph(
    "<b>The good news first:</b> the app is already built and working "
    "(7 skills, live classroom games, assignments, a teacher dashboard). "
    "We are <b>not</b> paying to build a website &mdash; a school would normally pay "
    "<b>$500&ndash;$2,000+</b> (about <b>23,000&ndash;92,000 TL</b>) for that. We only need to "
    "<i>run</i> it, which is inexpensive. Three small things:", body))

S.append(Paragraph("1.  Two web addresses (domains)", h))
S.append(Paragraph(
    "One for the app, one for the FSM hub. The university already owns <b>fsm.edu.tr</b>, "
    "so our IT team can give us two <b>free</b> addresses such as "
    "<b>empowerlab.fsm.edu.tr</b> and <b>hub.fsm.edu.tr</b>.<br/>"
    "<b>Cost: $0 (0 TL).</b>  (A brand-new address, if ever wanted, is about "
    "$12&ndash;15 per year &mdash; roughly 550&ndash;700 TL.)", body))

S.append(Paragraph("2.  A Google &ldquo;Blaze&rdquo; account for the app", h))
S.append(Paragraph(
    "The app is on Google&rsquo;s <b>free</b> plan, which has a daily usage limit. When all "
    "400 students log in at peak times it hits that limit and the app <b>stops working</b>. "
    "The <b>Blaze</b> (pay-as-you-go) plan removes the limit &mdash; it keeps the same free "
    "allowance and only charges for the small amount used beyond it.<br/>"
    "<b>Cost: about $5&ndash;8 per month</b> (about <b>230&ndash;370 TL</b>) for all 400 "
    "students &mdash; often less. We set a <b>$25/month (about 1,150 TL) ceiling</b> so the "
    "bill can never exceed expectations.", body))

S.append(Paragraph("3.  Optional Google services (&ldquo;APIs&rdquo;)", h))
api = [
    [Paragraph("Service", cellh), Paragraph("What it adds", cellh), Paragraph("Monthly cost", cellh)],
    [Paragraph("Voice audio<br/>(Text-to-Speech)", cellb),
     Paragraph("Reads lesson text aloud in a natural voice (e.g. a vocabulary word or a listening passage). "
               "Created automatically and saved &mdash; you don&rsquo;t record anything.", cell),
     Paragraph("about <b>free</b>" + tl("~ 0 TL"), cell)],
    [Paragraph("AI helper<br/>(Gemini <i>or</i> Claude)", cellb),
     Paragraph("Draft writing feedback, grammar checks, auto-create practice questions, a tutor chatbot.", cell),
     Paragraph("<b>Gemini</b> $1&ndash;10" + tli("~ 50&ndash;460 TL") +
               "<br/><b>Claude</b> $3&ndash;20" + tli("~ 140&ndash;920 TL"), cell)],
    [Paragraph("Speaking practice<br/>(Speech-to-Text)", cellb),
     Paragraph("Listen to a student speak and score pronunciation.", cell),
     Paragraph("<b>$50&ndash;95</b>" + tl("~ 2,300&ndash;4,400 TL") +
               "<br/>or <b>$0</b> with the free browser version to start", cell)],
]
t1 = Table(api, colWidths=[33*mm, 86*mm, 41*mm])
t1.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), BLUE2),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, GREYBG]),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#d1d9e6")),
    ("TOPPADDING", (0,0), (-1,-1), 3.5), ("BOTTOMPADDING", (0,0), (-1,-1), 3.5),
    ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
]))
S.append(t1)
S.append(Paragraph(
    "<b>Note:</b> the in-app AI that serves students runs on <b>Gemini</b> (cheapest, built straight "
    "into Firebase). The <b>Claude Max</b> subscription in the total below is a separate <i>developer "
    "tool</i> &mdash; the account we use to build, fix and author content for the app.", small))

S.append(Paragraph("Total budget (recommended path + Claude Max)", h))
bl = [
    [Paragraph("Item", cellh), Paragraph("Per month", cellh), Paragraph("Per year", cellh)],
    [Paragraph("Web addresses (fsm.edu.tr subdomains)", cell),
     Paragraph("$0" + tl("0 TL"), cell), Paragraph("$0" + tl("0 TL"), cell)],
    [Paragraph("Firebase Blaze (hosting + database)", cell),
     Paragraph("$5&ndash;8" + tl("~ 230&ndash;370 TL"), cell),
     Paragraph("$60&ndash;100" + tl("~ 2,750&ndash;4,600 TL"), cell)],
    [Paragraph("In-app AI + voice for students (Gemini)", cell),
     Paragraph("$1&ndash;10" + tl("~ 50&ndash;460 TL"), cell),
     Paragraph("$12&ndash;120" + tl("~ 550&ndash;5,500 TL"), cell)],
    [Paragraph("<b>Claude Max</b> &mdash; build &amp; maintain the app", cell),
     Paragraph("<b>$100</b>" + tl("~ 4,600 TL"), cell),
     Paragraph("<b>$1,200</b>" + tl("~ 55,000 TL"), cell)],
    [Paragraph("<b>TOTAL</b>", cellb),
     Paragraph("<b>~$106&ndash;118</b>" + tl("~ 4,900&ndash;5,400 TL"), cellb),
     Paragraph("<b>~$1,300&ndash;1,400</b>" + tl("~ 60,000&ndash;65,000 TL"), cellb)],
]
t2 = Table(bl, colWidths=[90*mm, 35*mm, 35*mm])
t2.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), GREEN),
    ("BACKGROUND", (0,5), (-1,5), colors.HexColor("#fff3cd")),
    ("LINEABOVE", (0,5), (-1,5), 1.2, GREEN),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#cfe6da")),
    ("TOPPADDING", (0,0), (-1,-1), 3.5), ("BOTTOMPADDING", (0,0), (-1,-1), 3.5),
    ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
]))
S.append(t2)

S.append(Spacer(1, 7))
ask = Table([[Paragraph(
    "<b>What to approve:</b> (1) two free <b>fsm.edu.tr</b> web addresses; (2) a <b>Firebase "
    "Blaze</b> account (capped $25/month); and (3) a <b>Claude Max</b> subscription at "
    "<b>$100/month</b> to build &amp; maintain the app. <b>Grand total ~$106&ndash;118/month "
    "(~4,900&ndash;5,400 TL)</b>, about <b>$1,300&ndash;1,400/year (~60,000&ndash;65,000 TL)</b> "
    "&mdash; of which $100/month is Claude Max; the app&rsquo;s own running cost is only ~$6&ndash;18/month.",
    st("ask", fontName="Helvetica", fontSize=9.8, textColor=INK, leading=13))]],
    colWidths=[160*mm])
ask.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fff7e6")),
    ("BOX", (0,0), (-1,-1), 1, colors.HexColor("#f59e0b")),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
]))
S.append(ask)

S.append(Paragraph(
    "Optional premium speaking scoring (Speech-to-Text) would add ~$50&ndash;95/month "
    "(~2,300&ndash;4,400 TL) if enabled &mdash; free via the browser to start, so it is not in the total. "
    "Claude Max is a fixed monthly subscription (not metered). Prices are public list prices (USD); TL "
    "uses about <b>46 TL per US$1</b> (June 2026) and moves with the exchange rate. Actual cost scales "
    "with real usage and is usually lower.", small))

doc.build(S)
final = OUT
try:
    os.replace(BUILD, OUT)            # original not open -> clean overwrite
except PermissionError:
    final = OUT[:-4] + " (updated).pdf"
    try:
        os.replace(BUILD, final)     # original open -> save alongside
    except PermissionError:
        final = BUILD                # both held -> leave the .new file
print("WROTE:", final)
