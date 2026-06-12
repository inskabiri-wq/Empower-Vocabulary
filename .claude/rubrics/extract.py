# Crude PDF text extractor using ONLY the Python standard library
# (zlib + re). Works for text-based PDFs (e.g. Word-exported). Decompresses
# FlateDecode streams and pulls text from Tj / TJ show-text operators.
import sys, re, zlib

def extract(path):
    data = open(path, 'rb').read()
    out = []
    # Find all stream ... endstream blocks.
    for m in re.finditer(rb'stream\r?\n(.*?)\r?\nendstream', data, re.DOTALL):
        raw = m.group(1)
        try:
            dec = zlib.decompress(raw)
        except Exception:
            continue
        out.extend(_textops(dec))
    return '\n'.join(out)

def _hex(h):
    h = re.sub(rb'\s+', b'', h)
    if len(h) % 2: h += b'0'
    try: return bytes.fromhex(h.decode('latin-1'))
    except Exception: return b''

def _textops(dec):
    res = []
    # 1) literal (..)Tj
    for tm in re.finditer(rb'\((?:[^()\\]|\\.)*\)\s*Tj', dec):
        txt = re.search(rb'\((.*)\)\s*Tj', tm.group(0), re.DOTALL)
        if txt: res.append(_unesc(txt.group(1)).decode('latin-1','replace'))
    # 2) hex <..>Tj
    for tm in re.finditer(rb'<([0-9A-Fa-f\s]+)>\s*Tj', dec):
        b = _hex(tm.group(1))
        if b.strip(): res.append(b.decode('latin-1','replace'))
    # 3) [ ... ] TJ with literal and/or hex strings
    for tm in re.finditer(rb'\[(.*?)\]\s*TJ', dec, re.DOTALL):
        arr = tm.group(1); buf = []
        for p in re.finditer(rb'\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]+>', arr):
            tok = p.group(0)
            if tok[:1] == b'(': buf.append(_unesc(tok[1:-1]).decode('latin-1','replace'))
            else: buf.append(_hex(tok[1:-1]).decode('latin-1','replace'))
        line = ''.join(buf)
        if line.strip(): res.append(line)
    return res

def _unesc(b):
    b = b.replace(b'\\(', b'(').replace(b'\\)', b')').replace(b'\\\\', b'\\')
    b = b.replace(b'\\n', b'\n').replace(b'\\r', b'').replace(b'\\t', b' ')
    return b

for p in sys.argv[1:]:
    outp = p.rsplit('.', 1)[0] + '.txt'
    try:
        txt = extract(p)
    except Exception as e:
        txt = 'ERR: ' + str(e)
    open(outp, 'w', encoding='utf-8').write(txt)
    print('wrote', outp, '(' + str(len(txt)) + ' chars)')
