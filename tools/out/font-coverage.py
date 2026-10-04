"""字体覆盖率实测：把项目里真实会出现的字，与候选 woff2 切片的 cmap 对账。
缺多少、缺的是哪些字，直接决定「内嵌子集够不够」还是「得从完整字体自己子集化」。
用法：python tools/out/font-coverage.py
"""
import glob
import os
import sys
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
STAGE = os.path.join(ROOT, 'tools', 'out', 'fontstage')


def chars_from_files():
    corpus = set()
    files = (glob.glob(os.path.join(ROOT, '*.html'))
             + glob.glob(os.path.join(ROOT, '*.js'))
             + glob.glob(os.path.join(ROOT, '*.css'))
             + glob.glob(os.path.join(ROOT, 'art', '*.svg')))
    for p in files:
        try:
            with open(p, encoding='utf-8', errors='replace') as f:
                corpus |= set(f.read())
        except OSError:
            pass
    return corpus, files


def cmaps():
    out = {}
    for p in sorted(glob.glob(os.path.join(STAGE, '*.woff2'))):
        f = TTFont(p)
        out[os.path.basename(p)] = set(f.getBestCmap().keys())
    return out


def in_cjk(cp):
    return 0x3400 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF


corpus, files = chars_from_files()
maps = cmaps()
cjk_corpus = {c for c in corpus if in_cjk(ord(c))}
asci = {c for c in corpus if ord(c) < 0x256}

print('语料文件 %d 个，去重字符 %d，其中中日韩区块 %d，ASCII/拉丁扩展 %d' % (len(files), len(corpus), len(cjk_corpus), len(asci)))
for name, cm in maps.items():
    size = os.path.getsize(os.path.join(STAGE, name))
    miss_cjk = sorted(c for c in cjk_corpus if ord(c) not in cm)
    miss_asc = sorted(c for c in asci if ord(c) not in cm)
    cov = (len(cjk_corpus) - len(miss_cjk)) * 100.0 / max(1, len(cjk_corpus))
    print('\n%s  %.2f MB  cmap %d 码位' % (name, size / 1048576.0, len(cm)))
    print('  中日韩覆盖 %.2f%%  缺 %d 字' % (cov, len(miss_cjk)))
    print('  ASCII/拉丁缺 %d 个：%s' % (len(miss_asc), ''.join(miss_asc[:40])))
    print('  缺字样本：%s' % ''.join(miss_cjk[:60]))
