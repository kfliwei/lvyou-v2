"""生成 fonts/coverage.json —— 把「字库里到底有哪些码位」钉成一份可被 node 闸门读死的清单。
node 读不了 woff2（要 brotli 解压缩表），所以这里用 fontTools 把 cmap 导出成清单，
verify.js §21 只做三件事：文件在不在、字节指纹对不对、语料用字有没有跑出清单。
用法：python tools/out/gen-font-manifest.py
"""
import glob
import hashlib
import json
import os
import re
import sys
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
FONTS = os.path.join(ROOT, 'fonts')


def in_cjk(cp):
    return 0x3400 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF


def corpus_chars():
    files = (glob.glob(os.path.join(ROOT, '*.html'))
             + glob.glob(os.path.join(ROOT, '*.js'))
             + glob.glob(os.path.join(ROOT, '*.css'))
             + glob.glob(os.path.join(ROOT, 'art', '*.svg')))
    chars = set()
    for p in files:
        with open(p, encoding='utf-8', errors='replace') as f:
            chars |= set(f.read())
    return chars, len(files)


codes = set()
files_meta = {}
for p in sorted(glob.glob(os.path.join(FONTS, '*.woff2'))):
    cmap = set(TTFont(p).getBestCmap().keys())
    codes |= cmap
    b = open(p, 'rb').read()
    files_meta[os.path.basename(p)] = {
        'bytes': len(b),
        'sha256': hashlib.sha256(b).hexdigest(),
        'cmap': len(cmap),
    }

chars, nfiles = corpus_chars()
cjk = {c for c in chars if in_cjk(ord(c))}
other = {c for c in chars if not in_cjk(ord(c)) and c not in '\n\r\t'}
miss_cjk = sorted(c for c in cjk if ord(c) not in codes)
miss_other = sorted(c for c in other if ord(c) not in codes)

out = {
    'generatedBy': 'tools/out/gen-font-manifest.py',
    'source': '@fontsource/noto-serif-sc@5.2.5（Noto Serif SC，SIL Open Font License 1.1）',
    'corpusFiles': nfiles,
    'corpusCjkChars': len(cjk),
    'corpusOtherChars': len(other),
    'covered': len(cjk) - len(miss_cjk),
    'missingCjk': ''.join(miss_cjk),
    'missingOther': ''.join(miss_other),
    'files': files_meta,
    'codepoints': sorted(codes),
}
dst = os.path.join(FONTS, 'coverage.json')
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    f.write('\n')

print('码位并集 %d；语料中日韩 %d 字，缺 %d；非中日韩缺 %d（%s）' % (
    len(codes), len(cjk), len(miss_cjk), len(miss_other), ''.join(miss_other)))
print('清单 %s（%.1f KB）' % (os.path.relpath(dst, ROOT), os.path.getsize(dst) / 1024.0))
for n, m in files_meta.items():
    print('  %s  %.2f MB  cmap %d  %s' % (n, m['bytes'] / 1048576.0, m['cmap'], m['sha256'][:12]))
