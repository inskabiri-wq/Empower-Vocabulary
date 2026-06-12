import sys, re
from html.parser import HTMLParser
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
Y = r'E:\vocab-trainer\y'
ok = True
def chk(label, cond, extra=''):
    global ok
    if not cond: ok = False
    print(('OK  ' if cond else '!!  ') + label + (('  — ' + extra) if extra else ''))

# CSS brace balance
css = open(Y + r'\student\css\hub.css', encoding='utf-8').read()
chk('hub.css brace balance', css.count('{') == css.count('}'), '%d/%d' % (css.count('{'), css.count('}')))
for tok in ['.hub-two-col', '.hub-main .hub-grid', '.hub-rail', '.hub-rail-stats', 'max-width: 1024px']:
    chk('hub.css has ' + tok, tok in css)

# HTML: IDs preserved exactly once + new structure present + tag balance
html = open(Y + r'\student-dashboard.html', encoding='utf-8').read()
for idv in ['id="hubGrid"', 'id="assignmentsSection"', 'id="assignmentsContainer"', 'id="assignmentBadge"']:
    chk('preserved %s (x1)' % idv, html.count(idv) == 1, 'count=%d' % html.count(idv))
for tok in ['class="hub-two-col"', 'class="hub-main"', 'class="hub-rail"', 'id="hubRailStreak"', 'id="hubRailSessions"', 'id="hubRailXp"']:
    chk('new %s' % tok, tok in html)

# Tag balance on the whole dashboard page
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
WATCH = ['div','aside','span','section','body','head','main']
class C(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.o={}; s.c={}
    def handle_starttag(s,t,a):
        if t not in VOID: s.o[t]=s.o.get(t,0)+1
    def handle_endtag(s,t): s.c[t]=s.c.get(t,0)+1
p=C(); p.feed(html); p.close()
bad=['%s %d/%d'%(t,p.o.get(t,0),p.c.get(t,0)) for t in WATCH if p.o.get(t,0)!=p.c.get(t,0)]
chk('student-dashboard.html tags balanced', not bad, ', '.join(bad))

# hub.js mirror entries present
js = open(Y + r'\student\js\hub.js', encoding='utf-8').read()
for tok in ["to: 'hubRailStreak'", "to: 'hubRailSessions'", "to: 'hubRailXp'", "from: 'currentStreak'", "from: 'journeySessions'"]:
    chk('hub.js mirror ' + tok, tok in js)

print('\n' + ('SMOKE PASS' if ok else 'SMOKE FAIL'))
sys.exit(0 if ok else 2)
