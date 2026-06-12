import sys
from html.parser import HTMLParser
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
Y = r'E:\vocab-trainer\y'
ok = True
def chk(label, cond, extra=''):
    global ok
    if not cond: ok = False
    print(('OK  ' if cond else '!!  ') + label + (('  — ' + extra) if extra else ''))

css = open(Y + r'\css\fsmvu-loader.css', encoding='utf-8').read()
chk('css brace balance', css.count('{') == css.count('}'), '%d/%d' % (css.count('{'), css.count('}')))
for tok in ['.fsmvu-splash', '@keyframes fsmvu-splash-in', '@keyframes fsmvu-splash-out', 'prefers-reduced-motion']:
    chk('css has ' + tok, tok in css)
chk('css splash bg matches manifest #0f172a', 'background:#0f172a' in css.replace(' ', '').replace('background:#0f172a;', 'background:#0f172a'))

idx = open(Y + r'\index.html', encoding='utf-8').read()
chk('index links fsmvu-loader.css', 'css/fsmvu-loader.css' in idx)
chk('index has #fsmvuSplash overlay', 'id="fsmvuSplash"' in idx and 'fsmvu-loader--rotate fsmvu-loader--white' in idx)
chk('index splash script references fsmvu-splash-out', "fsmvu-splash-out" in idx)
chk('index splash has tap-to-skip + reduced-motion + timeout',
    'click' in idx and 'prefers-reduced-motion' in idx and 'setTimeout' in idx)

VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
WATCH = ['div','span','script','head','body','canvas']
class C(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.o={}; s.c={}
    def handle_starttag(s,t,a):
        if t not in VOID: s.o[t]=s.o.get(t,0)+1
    def handle_endtag(s,t): s.c[t]=s.c.get(t,0)+1
p=C(); p.feed(idx); p.close()
bad=['%s %d/%d'%(t,p.o.get(t,0),p.c.get(t,0)) for t in WATCH if p.o.get(t,0)!=p.c.get(t,0)]
chk('index.html tags balanced', not bad, ', '.join(bad))

print('\n' + ('SPLASH SMOKE PASS' if ok else 'SPLASH SMOKE FAIL'))
sys.exit(0 if ok else 2)
