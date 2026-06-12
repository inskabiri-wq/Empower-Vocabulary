# Targeted, concept-scoped icon swaps. Each entry is (old, new, expected_count).
# Binary read/write (line endings preserved). Distinctive substrings only, so
# look-alike emoji used for OTHER concepts are never touched. Mutates+writes
# first, then prints an ASCII-only report so a console-encoding hiccup can never
# leave files half-written.
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

Y = r'E:\vocab-trainer\y'
P = lambda *a: '\\'.join((Y,) + a)

PLAN = {
    P('classroom-student.html'): [
        ('🚀 Join Game', '🎟️ Join Game', 1),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-trust-student.html'): [
        ('<span class="logo">🚀</span>', '<span class="logo">🕵️</span>', 1),
        ('🚀 Join mission', '🎟️ Join mission', 1),
        ('🎯 Join another game', '➕ Join another game', 1),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-trust-teacher.html'): [
        ('<div class="rocket">🚀</div>', '<div class="rocket">🕵️</div>', 1),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-teacher.html'): [
        ('margin-bottom: 10px;">🚀</div>', 'margin-bottom: 10px;">🕵️</div>', 1),
        ('🚀 Trust No One · Setup', '🕵️ Trust No One · Setup', 1),
        ('🚀 Create Trust No One Room', '🕵️ Create Trust No One Room', 1),
        ('🏦', '🦹', 3),
        ('⏹️ End Game', '🏳️ End Game', 1),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-heist-teacher.html'): [
        ('🏦', '🦹', 3),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-heist-student.html'): [
        ('🏦', '🦹', 2),
        ('🎯 Join another game', '➕ Join another game', 1),
        ('⏭️', '🎶', 1),
    ],
    P('classroom-reading-student.html'): [
        ('🎯 Join another', '➕ Join another', 2),
    ],
    P('classroom-listening-student.html'): [
        ('🎯 Join another', '➕ Join another', 2),
    ],
    P('classroom', 'js', 'teacher.js'): [
        ("icon: '⏹️'", "icon: '🏳️'", 1),
    ],
    P('teacher', 'js', 'overview-v2.js'): [
        ("icon: '📊'", "icon: '🧠'", 1),
        ('// 📊 for stats/counts', '// 🧠 = practice sessions', 1),
    ],
}

report = []
ok = True
for path, rules in PLAN.items():
    with open(path, 'rb') as f:
        data = f.read()
    name = path.split('\\')[-1]
    for i, (old, new, exp) in enumerate(rules, 1):
        ob, nb = old.encode('utf-8'), new.encode('utf-8')
        got = data.count(ob)
        if got != exp:
            ok = False
        report.append((name, i, exp, got))
        data = data.replace(ob, nb)
    with open(path, 'wb') as f:
        f.write(data)

for name, i, exp, got in report:
    flag = 'OK ' if exp == got else '!! '
    print('%s%-30s rule %d  exp %d  got %d' % (flag, name, i, exp, got))
print('\n' + ('ALL RULES MATCHED' if ok else 'MISMATCH - review !! rows'))
sys.exit(0 if ok else 2)
