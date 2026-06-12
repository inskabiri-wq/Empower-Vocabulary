# One-off: swap the Heist/Trust currency glyph  ₿ -> 💸  everywhere it appears
# as the coin symbol (balances, rewards, costs, donations, table headers,
# particles, CSS pseudo content, code comments). Binary replace so line
# endings / encoding are preserved byte-for-byte.
FILES = [
    r'E:\vocab-trainer\y\classroom-trust-teacher.html',
    r'E:\vocab-trainer\y\classroom-heist-student.html',
    r'E:\vocab-trainer\y\classroom-trust-student.html',
    r'E:\vocab-trainer\y\classroom\js\heist-student.js',
    r'E:\vocab-trainer\y\classroom\js\heist-teacher.js',
    r'E:\vocab-trainer\y\classroom\js\trust-teacher.js',
    r'E:\vocab-trainer\y\classroom\js\trust-student.js',
    r'E:\vocab-trainer\y\classroom\css\heist.css',
]

OLD = '₿'.encode('utf-8')        # ₿
NEW = '\U0001f4b8'.encode('utf-8')    # 💸
total = 0
for path in FILES:
    with open(path, 'rb') as f:
        data = f.read()
    n = data.count(OLD)
    if n:
        with open(path, 'wb') as f:
            f.write(data.replace(OLD, NEW))
    total += n
    print('%-32s %d' % (path.split('\\')[-1], n))
print('--- total ₿ -> \U0001f4b8 :', total)
