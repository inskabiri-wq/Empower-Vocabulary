import gzip, io, tarfile, os, sys
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

D = r'E:\vocab-trainer\.tmp\design-LaNAV'
raw = gzip.open(os.path.join(D, 'bundle.gz'), 'rb').read()
print('decompressed bytes:', len(raw))
is_tar = len(raw) > 262 and raw[257:262] == b'ustar'
print('looks like tar:', is_tar)

if is_tar:
    tf = tarfile.open(fileobj=io.BytesIO(raw))
    members = tf.getmembers()
    print('--- %d members ---' % len(members))
    for m in members:
        print('  %8d  %s' % (m.size, m.name))
    out = os.path.join(D, 'files')
    os.makedirs(out, exist_ok=True)
    tf.extractall(out)
    print('extracted to', out)
else:
    # single file - sniff
    head = raw[:200].decode('utf-8', 'replace')
    print('head:', head[:200])
    open(os.path.join(D, 'content.out'), 'wb').write(raw)
