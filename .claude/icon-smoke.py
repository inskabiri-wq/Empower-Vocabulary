# Smoke for the icon swaps (glyph-only edits). Confirms every edited HTML file
# still parses cleanly and its block tags stay balanced (so no tag/attribute was
# clipped by a replace), and that each new icon is present with the right count.
import sys
from html.parser import HTMLParser
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

Y = r'E:\vocab-trainer\y'
VOID = {'area','base','br','col','embed','hr','img','input','link','meta',
        'param','source','track','wbr'}
WATCH = ['div','span','button','h1','h2','h3','section','a','table','tr','td']

HTML_FILES = [
    'classroom-student.html','classroom-trust-student.html','classroom-trust-teacher.html',
    'classroom-teacher.html','classroom-heist-teacher.html','classroom-heist-student.html',
    'classroom-reading-student.html','classroom-listening-student.html',
]

class Counter(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.opens = {}
        self.closes = {}
        self.err = None
    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.opens[tag] = self.opens.get(tag, 0) + 1
    def handle_startendtag(self, tag, attrs):
        pass  # self-closing, ignore
    def handle_endtag(self, tag):
        self.closes[tag] = self.closes.get(tag, 0) + 1

ok = True
print('--- HTML parse + block-tag balance ---')
for fn in HTML_FILES:
    path = Y + '\\' + fn
    src = open(path, encoding='utf-8').read()
    p = Counter()
    try:
        p.feed(src)
        p.close()
    except Exception as e:
        ok = False
        print('!! %-34s PARSE ERROR %s' % (fn, e))
        continue
    bad = []
    for t in WATCH:
        o, c = p.opens.get(t, 0), p.closes.get(t, 0)
        if o != c:
            bad.append('%s %d/%d' % (t, o, c))
    if bad:
        ok = False
        print('!! %-34s imbalance: %s' % (fn, ', '.join(bad)))
    else:
        print('OK %-34s tags balanced' % fn)

# --- new-icon presence ---
print('\n--- new icon presence (file: expected) ---')
EXPECT = [
    ('classroom-student.html',          '\U0001F39F', 1),  # 🎟 Join
    ('classroom-trust-student.html',    '\U0001F39F', 1),  # 🎟 Join mission
    ('classroom-trust-student.html',    '\U0001F575', 3),  # 🕵 brand logo (+2 pre-existing "Intelligence feed")
    ('classroom-trust-teacher.html',    '\U0001F575', 2),  # 🕵 brand hero (+1 pre-existing "Intelligence feed")
    ('classroom-teacher.html',          '\U0001F575', 3),  # 🕵 card+setup+create
    ('classroom-teacher.html',          '\U0001F9B9', 3),  # 🦹 heist x3
    ('classroom-teacher.html',          '\U0001F3F3', 1),  # 🏳 End Game
    ('classroom-heist-teacher.html',    '\U0001F9B9', 3),  # 🦹
    ('classroom-heist-student.html',    '\U0001F9B9', 2),  # 🦹
    ('classroom-reading-student.html',  '➕',     2),  # ➕ Join another
    ('classroom-listening-student.html','➕',     2),  # ➕ Join another
]
NAMES = {'\U0001F39F':'ticket','\U0001F575':'detective','\U0001F9B9':'villain',
         '\U0001F3F3':'whiteflag','➕':'plus'}
for fn, ch, exp in EXPECT:
    src = open(Y + '\\' + fn, encoding='utf-8').read()
    got = src.count(ch)
    flag = 'OK ' if got == exp else '!! '
    if got != exp: ok = False
    print('%s%-34s %-10s exp %d got %d' % (flag, fn, NAMES[ch], exp, got))

# 🎶 next-track across the 6 music pages, 🧠 sessions card
mus = sum(open(Y+'\\'+f, encoding='utf-8').read().count('\U0001F3B6') for f in [
    'classroom-student.html','classroom-trust-student.html','classroom-trust-teacher.html',
    'classroom-teacher.html','classroom-heist-teacher.html','classroom-heist-student.html'])
print(('OK ' if mus==6 else '!! ')+'next-track 🎶 total          exp 6 got %d' % mus)
if mus != 6: ok = False
brain = open(Y+r'\teacher\js\overview-v2.js', encoding='utf-8').read().count('\U0001F9E0')
print(('OK ' if brain>=1 else '!! ')+'sessions 🧠 in overview-v2   got %d' % brain)
if brain < 1: ok = False

print('\n' + ('SMOKE PASS' if ok else 'SMOKE FAIL'))
sys.exit(0 if ok else 2)
