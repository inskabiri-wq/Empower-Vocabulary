# Add the white-seal modifier to the 5 boot loaders (Ring Rotation stays).
# Anchor includes `role="status"` so the gallery's crimson rotate tile (no role)
# is NOT touched. Binary, count-asserted.
import sys
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
Y = r'E:\vocab-trainer\y'
FILES = ['app.html','classroom-student.html','classroom-teacher.html',
         'writing-exam.html','teacher-dashboard.html']
OLD = 'fsmvu-loader fsmvu-loader--rotate" role="status"'
NEW = 'fsmvu-loader fsmvu-loader--rotate fsmvu-loader--white" role="status"'
ok = True
for fn in FILES:
    p = Y + '\\' + fn
    d = open(p, 'rb').read()
    n = d.count(OLD.encode())
    if n != 1: ok = False
    open(p, 'wb').write(d.replace(OLD.encode(), NEW.encode()))
    print('%s%-28s +white %d' % (('OK ' if n==1 else '!! '), fn, n))
print('\n' + ('ALL WHITENED' if ok else 'MISMATCH'))
sys.exit(0 if ok else 2)
