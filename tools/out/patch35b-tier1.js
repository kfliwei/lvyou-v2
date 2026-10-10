/* patch35b-tier1.js — 批次 35-B①：应用内 DOM 那 9 处硬写桌面字体名改走令牌
 * 用法: node tools/out/patch35b-tier1.js          （预演，只报计数不落盘）
 *       node tools/out/patch35b-tier1.js --write   （落盘）
 * 纪律：每一刀的 from 必须在该文件里恰好命中 expect 次，命中数不对就整批不落盘（防止
 *       同一串字面量在「独立导出文档」那一档里也出现而被顺手改掉——results.js:179/184 就是这种）。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const WRITE = process.argv.includes('--write');

/* ①档只治「应用内那 9 处」。导出件（docShell/导出 SVG）里的桌面字体名是设计内保留：
   那些 HTML 离开 App 打开，没有 design.css，var(--font-*) 会解析成空。 */
const EDITS = [
  ['results.js', 'margin-bottom:12px;font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-8)', 'margin-bottom:12px;font-family:var(--font-display);font-size:var(--fs-8)', 1],
  ['results.js', 'align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-9)', 'align-items:center;font-family:var(--font-display);font-size:var(--fs-9)', 1],
  ['results.js', 'cursor:pointer;font-family:&quot;Songti SC&quot;,serif">生成', 'cursor:pointer;font-family:var(--font-display)">生成', 1],
  ['results.js', 'font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-8);color:#20201D;margin-bottom:4px">生成旅程故事', 'font-family:var(--font-display);font-size:var(--fs-8);color:#20201D;margin-bottom:4px">生成旅程故事', 1],
  ['results.js', 'font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-8);color:#20201D;margin-bottom:14px">定制路书', 'font-family:var(--font-display);font-size:var(--fs-8);color:#20201D;margin-bottom:14px">定制路书', 1],
  ['travel-notes.js', 'min-width:160px;font-family:&quot;Noto Sans SC&quot;,sans-serif', 'min-width:160px;font-family:var(--font-sans)', 1],
  ['travel-notes.js', 'max-width:260px;font-family:&quot;Noto Sans SC&quot;,sans-serif', 'max-width:260px;font-family:var(--font-sans)', 1],
  ['travel-notes.js', 'color:var(--color-primary);font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-5)', 'color:var(--color-primary);font-family:var(--font-display);font-size:var(--fs-5)', 1],
  ['travel-notes.js', 'display:block;font-family:&quot;Songti SC&quot;,serif;font-size:var(--fs-8);font-weight:600', 'display:block;font-family:var(--font-display);font-size:var(--fs-8);font-weight:600', 1],
];

const byFile = {};
let bad = 0;
for (const [f, from, to, expect] of EDITS) {
  const p = path.join(ROOT, f);
  if (!byFile[f]) byFile[f] = fs.readFileSync(p, 'utf8');
  const n = byFile[f].split(from).length - 1;
  const okCount = n === expect;
  if (!okCount) bad++;
  console.log((okCount ? 'OK  ' : 'CNT ') + f + ' 命中 ' + n + '（期望 ' + expect + '）  ' + from.slice(0, 62));
  if (okCount) byFile[f] = byFile[f].split(from).join(to);
}
console.log('\n计数不合的刀：' + bad + ' 把；' + (bad ? '整批不落盘' : (WRITE ? '落盘' : '预演（加 --write 才落盘）')));
if (!bad && WRITE) {
  for (const f of Object.keys(byFile)) {
    const p = path.join(ROOT, f);
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, byFile[f]);
    console.log('已写 ' + f + '（字节 ' + before.length + ' → ' + byFile[f].length + '）');
  }
}
