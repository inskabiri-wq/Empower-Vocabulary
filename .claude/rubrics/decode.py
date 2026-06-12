# R2/R3 use a subset font whose glyph codes are the real char minus 29.
# Decode: shift each byte +29 where it lands in a printable range.
# Kerning artifacts insert spurious spaces between glyphs; we rejoin.
import sys, re

def deshift(s):
    out = []
    for ch in s:
        o = ord(ch)
        # printable ASCII band of the cipher → +29 back to real char
        if 0x20 <= o <= 0x7e:
            r = o + 29
            if r <= 0x7e:
                out.append(chr(r))
            else:
                out.append(' ')  # punctuation/space artifacts
        else:
            out.append(' ')
    return ''.join(out)

txt = open(sys.argv[1], encoding='utf-8').read()
dec = deshift(txt)
# collapse runs of spaces, keep line breaks
dec = re.sub(r'[ \t]+', ' ', dec)
dec = re.sub(r'\n ', '\n', dec)
open(sys.argv[2], 'w', encoding='utf-8').write(dec)
print('wrote', sys.argv[2], len(dec), 'chars')
