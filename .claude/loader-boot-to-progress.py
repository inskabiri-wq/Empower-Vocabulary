# Boot loaders: Ring Rotation -> Progress Ring (keep the white modifier).
# Only the 5 boot pages (anchored on the --white class, which the gallery lacks).
import sys
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
Y = r'E:\vocab-trainer\y'
FILES = ['app.html','classroom-student.html','classroom-teacher.html',
         'writing-exam.html','teacher-dashboard.html']
A_OLD = 'fsmvu-loader fsmvu-loader--rotate fsmvu-loader--white'
A_NEW = 'fsmvu-loader fsmvu-loader--progress fsmvu-loader--white'
B_OLD = '<span class="fsmvu-seal fsmvu-ring"></span><span class="fsmvu-seal fsmvu-emblem"></span>'
B_NEW = '<div class="fsmvu-ring-wrap"><span class="fsmvu-track"></span><span class="fsmvu-arc"></span><span class="fsmvu-seal"></span></div>'
ok = True
for fn in FILES:
    p = Y + '\\' + fn
    d = open(p, 'rb').read()
    a = d.count(A_OLD.encode()); b = d.count(B_OLD.encode())
    if a != 1 or b != 1: ok = False
    d = d.replace(A_OLD.encode(), A_NEW.encode()).replace(B_OLD.encode(), B_NEW.encode())
    open(p, 'wb').write(d)
    print('%s%-28s rotate->progress %d  spans->ringwrap %d' % (('OK ' if a==1 and b==1 else '!! '), fn, a, b))
print('\n' + ('ALL SWAPPED' if ok else 'MISMATCH'))
sys.exit(0 if ok else 2)
