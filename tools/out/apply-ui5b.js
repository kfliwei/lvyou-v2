/* UI-5 · S3b 描边一族（apply-ui5b.js）
 *
 * 为什么要这一趟：UI-2/UI-5 把「分层不靠淡投影」落到 --edge-hair(-soft) 两档暖墨细线上，
 * 这两档是**会随主题翻的**（暗档翻成 rgba(239,233,220,.16/.09)）。但全站还有一批
 * 写死的 rgba(32,32,29,.0x) / rgba(33,26,19,.0x) / rgba(38,36,31,.0x) 描边——它们在暗色下
 * 就是「深底上一条更深的线」，等于没有线：说好的分层在暗色主题里悄悄塌掉。
 *
 * 规则：只改 **border 开头的声明**里的这几个暖墨族颜色，别的属性（背景、阴影、遮罩）一律不碰。
 * 归档按 α：≤.10 → var(--edge-hair-soft)（.08）；>.10 → var(--edge-hair)（.14）。
 * 最大漂移 .1→.08 与 .12→.14 都是几个 α 千分位，肉眼在 450ppi 上分不出，
 * 换来的是「描边只有一族、且跟着主题翻」。
 *
 * 两版实现踩过的坑（都实测过，别再走回头路）：
 *  ① 整文件按「深度 0 的 ; 切声明」——JS 字符串/注释里的 `(` 会让深度跨行回不到 0，
 *     后面的声明一条也切不出来：results.js 的 7 条内联描边就是这么漏掉的。
 *  ② 先捞「看起来像 CSS 的引号串」再切——引号配对会被注释里的英文撇号（don't）错帧，
 *     串起点一错，孤岛整条找不到。
 *  所以现在用**声明锚点正则**：`border*: <不含 ; 引号 换行的值> rgba(暖墨,α)`，
 *  唯一要屏蔽的是块注释（注释里举例写的 border 声明不算声明，改它会把讲解改坏）。
 *
 * 用法：node tools/out/apply-ui5b.js          → 干跑，打印每一条待改与文件计数
 *       node tools/out/apply-ui5b.js --write  → 落盘
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);

const SKIP = /^tn-|^bj-|^cq-|^fj-|^gd-|^gs-|^gxyn-|^gz-|^ha-|^hb-|^he-|^hi-|^hk-|^hlj-|^hn-|^hs-|^jl-|^js-|^jx-|^ln-|^mo-|^nmg-|^nx-|^qh-|^qingzang-|^sc-|^sd-|^sh-|^sx-|^tj-|^tw-|^xj-|^xz-|^zj-|^nation-|^food-|^quotes-|^routes-|^icons-|^geo-|^data-/;
const FILES = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js' && !SKIP.test(f));

const INK = '(?:32,32,29|33,26,19|38,36,31|30,28,24)';
const ANCHOR = new RegExp('\\b(border(?:-[a-z]+)*\\s*:\\s*[^;\n"\'`()]*?)rgba\\(' + INK + ',\\s*(\\.\\d+)\\s*\\)', 'g');
const tokFor = a => (parseFloat(a) <= 0.10 ? 'var(--edge-hair-soft)' : 'var(--edge-hair)');

/* 块注释区间表：[start, end) 的字符都算注释，锚点命中注释就跳过 */
function commentMask(src) {
  const mask = new Uint8Array(src.length);
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const stop = e < 0 ? src.length : e + 2;
      for (let k = i; k < stop; k++) mask[k] = 1;
      i = stop;
    } else if (src[i] === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      const stop = e < 0 ? src.length : e;
      for (let k = i; k < stop; k++) mask[k] = 1;
      i = stop;
    } else if (src[i] === '<' && src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i);
      const stop = e < 0 ? src.length : e + 3;
      for (let k = i; k < stop; k++) mask[k] = 1;
      i = stop;
    }
  }
  return mask;
}

const write = process.argv.includes('--write');
const perFile = [];
let total = 0;
FILES.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  const mask = commentMask(src);
  const nl = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') nl.push(i + 1);
  const lineOf = i => { let lo = 0, hi = nl.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (nl[m] <= i) lo = m; else hi = m - 1; } return lo + 1; };
  const hits = [];
  src.replace(ANCHOR, function (whole, pre, alpha, off) {
    if (mask[off]) return whole;
    hits.push({ off: off, len: whole.length, to: pre + tokFor(alpha), line: lineOf(off), from: whole });
    return whole;
  });
  if (!hits.length) return;
  hits.slice(0, 99).forEach(h => console.log('  ' + f + ':' + h.line + '\n    旧 ' + h.from.slice(0, 96) + '\n    新 ' + h.to.slice(0, 96)));
  perFile.push(f + '×' + hits.length);
  total += hits.length;
  if (write) {
    let out = src;
    hits.reverse().forEach(h => { out = out.slice(0, h.off) + h.to + out.slice(h.off + h.len); });
    fs.writeFileSync(f, out, 'utf8');
  }
});
console.log((write ? '已落盘 ' : '干跑 ') + '描边归档：' + total + ' 处，文件 ' + perFile.join(' '));
if (!write) console.log('（加 --write 才落盘）');
