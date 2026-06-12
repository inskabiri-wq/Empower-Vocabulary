# Smoke for the FSMVÜ seal-loader implementation.
import os, sys, re
from html.parser import HTMLParser
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

Y = r'E:\vocab-trainer\y'
ok = True
def check(label, cond, extra=''):
    global ok
    if not cond: ok = False
    print(('OK  ' if cond else '!!  ') + label + (('  — ' + extra) if extra else ''))

# 1) asset exists
seal = os.path.join(Y, 'fsmvu-seal.png')
check('seal asset present (/fsmvu-seal.png)', os.path.exists(seal) and os.path.getsize(seal) > 1000,
      '%d bytes' % (os.path.getsize(seal) if os.path.exists(seal) else 0))

# 2) CSS: brace balance, seal url, keyframes all fsmvu-prefixed, arc uses fsmvu-spin
css = open(os.path.join(Y, 'css', 'fsmvu-loader.css'), encoding='utf-8').read()
check('css brace balance', css.count('{') == css.count('}'), '%d/%d' % (css.count('{'), css.count('}')))
check('css references /fsmvu-seal.png', '/fsmvu-seal.png' in css)
kf = re.findall(r'@keyframes\s+([A-Za-z0-9_-]+)\s*\{', css)  # real definitions only (require brace)
bad_kf = [k for k in kf if not k.startswith('fsmvu-')]
check('all @keyframes are fsmvu- prefixed (no collision)', not bad_kf, 'bad=' + ','.join(bad_kf) if bad_kf else '%d keyframes' % len(kf))
check('progress arc animates fsmvu-spin (not bare spin)', re.search(r'\.fsmvu-arc\{[^}]*animation:fsmvu-spin', css.replace('\n','')) is not None)

# 3) JS helper present + has API
js = open(os.path.join(Y, 'js', 'fsmvu-loader.js'), encoding='utf-8').read()
check('JS exposes FSMVULoader.show/.hide', 'window.FSMVULoader' in js and 'show:' in js and 'hide:' in js)

# 4) edited pages: link added + progress loader present + old boot-spinner gone
PAGES = ['app.html','classroom-student.html','classroom-teacher.html','writing-exam.html','teacher-dashboard.html']
for p in PAGES:
    src = open(os.path.join(Y, p), encoding='utf-8').read()
    check('%s: fsmvu-loader.css linked' % p, 'css/fsmvu-loader.css' in src)
    check('%s: progress seal loader wired' % p, 'fsmvu-loader--progress' in src)
    check('%s: white seal modifier present' % p, 'fsmvu-loader--white' in src)
# teacher-dashboard intentionally keeps ONE section spinner; others should have none
for p in ['app.html','classroom-student.html','classroom-teacher.html','writing-exam.html']:
    src = open(os.path.join(Y, p), encoding='utf-8').read()
    check('%s: boot spinner replaced (0 class="spinner")' % p, 'class="spinner"' not in src)

# 5) gallery has all six variants
gal = open(os.path.join(Y, 'fsmvu-loaders.html'), encoding='utf-8').read()
for v in ['--rotate','--shimmer','--draw','--splash','--progress']:
    check('gallery has %s' % v, v in gal)
check('gallery has default breathe loader', 'class="fsmvu-loader"></div>' in gal.replace(' ', '') or 'class="fsmvu-loader">' in gal)

# 6) HTML tag balance on every edited/created page
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
WATCH = ['div','span','p','head','body']
class C(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.o={}; s.c={}
    def handle_starttag(s,t,a):
        if t not in VOID: s.o[t]=s.o.get(t,0)+1
    def handle_endtag(s,t): s.c[t]=s.c.get(t,0)+1
for p in PAGES + ['fsmvu-loaders.html']:
    src = open(os.path.join(Y, p), encoding='utf-8').read()
    par = C()
    try: par.feed(src); par.close()
    except Exception as e:
        check('%s parse' % p, False, str(e)); continue
    bad = ['%s %d/%d'%(t,par.o.get(t,0),par.c.get(t,0)) for t in WATCH if par.o.get(t,0)!=par.c.get(t,0)]
    check('%s tags balanced' % p, not bad, ', '.join(bad))

print('\n' + ('SMOKE PASS' if ok else 'SMOKE FAIL'))
sys.exit(0 if ok else 2)
