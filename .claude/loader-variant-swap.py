# Switch the 5 boot loaders from Progress-Ring (06) to Ring-Rotation (01).
# Two indentation-independent substring swaps per file. Binary, with counts.
# Does NOT touch fsmvu-loaders.html (the gallery keeps all six).
import sys
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

Y = r'E:\vocab-trainer\y'
FILES = ['app.html','classroom-student.html','classroom-teacher.html',
         'writing-exam.html','teacher-dashboard.html']

A_OLD = 'fsmvu-loader fsmvu-loader--progress'
A_NEW = 'fsmvu-loader fsmvu-loader--rotate'
B_OLD = '<div class="fsmvu-ring-wrap"><span class="fsmvu-track"></span><span class="fsmvu-arc"></span><span class="fsmvu-seal"></span></div>'
B_NEW = '<span class="fsmvu-seal fsmvu-ring"></span><span class="fsmvu-seal fsmvu-emblem"></span>'

ok = True
for fn in FILES:
    path = Y + '\\' + fn
    data = open(path, 'rb').read()
    a = data.count(A_OLD.encode()); b = data.count(B_OLD.encode())
    if a != 1 or b != 1: ok = False
    data = data.replace(A_OLD.encode(), A_NEW.encode()).replace(B_OLD.encode(), B_NEW.encode())
    open(path, 'wb').write(data)
    print('%s %-28s progress->rotate %d  ringwrap->split %d' % (('OK ' if a==1 and b==1 else '!! '), fn, a, b))

print('\n' + ('ALL SWAPPED' if ok else 'MISMATCH'))
sys.exit(0 if ok else 2)
