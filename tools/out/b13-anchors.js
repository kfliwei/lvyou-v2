/* b13-anchors.js — 把 verify.js §24 的 A24 锚点表逐条打一遍（批次 13）
 *
 * 为什么不另抄一份表：本轮实测发现「探针里的表」与「闸门里的表」会漂（57 vs 55 条，
 * 差的是 contentCenterPx / paddingTL / usableRectPx 三条 + 一条计数不同）。
 * 手抄两份账本就是一切漂移的根，所以这里直接从 tools/verify.js 的源码里抠出 A24 再求值，
 * 保证两边走的是同一份数据——探针显示 57/57 就等于闸门那 57 条全对上。
 *
 * 用法：node tools/out/b13-anchors.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const flat24 = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
const cnt24 = (src, needle) => src.split(needle).length - 1;

/* 与 §24 同一个 normalizer、同一个计数器 */
const raw = fs.readFileSync(path.join(ROOT, 'tools/verify.js'), 'utf8').replace(/\r\n/g, '\n');
/* 表的结束只能按「整行两空格 + ];」认——表里的 needle 字符串自己就带 ];（第一版这么抠过界，eval 直接语法炸） */
const lines = raw.split('\n');
const from = lines.findIndex(l => l.indexOf('const A24 = [') >= 0);
const to = lines.findIndex((l, i) => i > from && /^  \];\s*$/.test(l));
if (from < 0 || to < 0) { console.log('抠不到 A24：verify.js §24 的表声明改了形状'); process.exit(2); }
const A24 = eval(lines.slice(from, to + 1).join('\n').replace('const A24 = ', ''));

const FILES = ['topic-common.js', 'node-lod.js', 'map.css'];
const SRC = {};
FILES.forEach(f => { SRC[f] = flat24(fs.readFileSync(path.join(ROOT, f), 'utf8')); });

let bad = 0;
A24.forEach(t => {
  const [file, needle, exp, note] = t;
  const n = cnt24(SRC[file] === undefined ? '' : SRC[file], needle);
  const ok = n === exp;
  if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'WRONG') + ' ' + file.padEnd(16) + String(n).padStart(2) + ' (期望 ' + exp + ') ' +
    needle.slice(0, 56) + '   — ' + note);
});
const byFile = {};
A24.forEach(t => { byFile[t[0]] = (byFile[t[0]] || 0) + 1; });
console.log('\n表规模 ' + A24.length + ' 条（' + FILES.map(f => f + ' ' + (byFile[f] || 0)).join(' / ') + '）');
console.log(bad ? bad + ' 条对不上（这些是 §24 会红的）' : A24.length + '/' + A24.length + ' 锚点对上；不符 0 条');
process.exit(bad ? 1 : 0);
