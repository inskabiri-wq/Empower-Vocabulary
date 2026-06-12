# Inventory every emoji "icon" used across the app's user-facing files.
# Reports each unique emoji: count + which files + a sample context snippet.
import os, re, collections

ROOT = r'E:\vocab-trainer\y'
SKIP_DIRS = {'node_modules', '.tmp', 'tools', '_raw', 'audio', 'assets'}
EXTS = ('.html', '.js')

# Emoji-ish codepoint ranges (covers symbols, pictographs, arrows, dingbats,
# supplemental symbols). Excludes plain ASCII + basic punctuation.
EMOJI_RE = re.compile(
    '['
    '\U0001F300-\U0001FAFF'   # symbols & pictographs, supplemental, extended-A
    '\U00002600-\U000027BF'   # misc symbols + dingbats
    '\U00002B00-\U00002BFF'   # arrows/stars
    '\U00002190-\U000021FF'   # arrows
    '\U0001F1E6-\U0001F1FF'   # regional indicators (flags)
    '\U00002000-\U0000206F'   # gen punct (we'll filter most out)
    '\U00002122\U00002139'    # ™ ℹ
    '\U0000FE00-\U0000FE0F'   # variation selectors
    '\U0000203C\U00002049'
    ']'
)
# Things in the punctuation block we DON'T want to report as icons:
PUNCT_IGNORE = set('‘’“”–—…• ​‍️    ')

counts = collections.Counter()
where = collections.defaultdict(set)
sample = {}

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        if not fn.endswith(EXTS):
            continue
        path = os.path.join(dirpath, fn)
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        try:
            lines = open(path, encoding='utf-8', errors='replace').read().splitlines()
        except Exception:
            continue
        for ln in lines:
            for m in EMOJI_RE.finditer(ln):
                ch = m.group(0)
                if ch in PUNCT_IGNORE:
                    continue
                counts[ch] += 1
                where[ch].add(rel)
                if ch not in sample:
                    snippet = ln.strip()
                    if len(snippet) > 80:
                        snippet = snippet[:80] + '…'
                    sample[ch] = snippet

out = []
out.append('EMOJI ICON INVENTORY  (' + str(len(counts)) + ' unique, ' + str(sum(counts.values())) + ' total uses)\n')
for ch, n in counts.most_common():
    files = sorted(where[ch])
    flist = ', '.join(files[:4]) + (' +%d more' % (len(files) - 4) if len(files) > 4 else '')
    out.append('%s  x%-4d  [%s]\n        e.g. %s' % (ch, n, flist, sample.get(ch, '')))

open(r'E:\vocab-trainer\.claude\icon-inventory.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('unique emoji:', len(counts), '| total uses:', sum(counts.values()))
print('written to .claude/icon-inventory.txt')
