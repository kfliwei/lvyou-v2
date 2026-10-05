/* UI-5 · 修复 apply-ui5c.js 的插入偏移缺陷造成的属性名粘连
 *
 * 那个脚本把 at 算到了「冒号」上（用 m[0].length-1 而非属性名在匹配里的真实下标），
 * 于是从冒号起的 10 个字符（`:var(--col`）被 "background-color" 覆盖：
 *   background:var(--color-bg)  →  backgroundbackground-coloror-bg)
 * 这不是「简写没改成长写」，而是整条声明变成非法属性名、被 CSS 解析器整条丢弃——
 * 页面底色直接回落 design.css，肉眼看不出、闸门也抓不到（正则找不到 background:）。
 * 三档损坏形态与 HEAD 原文逐条核对后硬编码还原，改完必须全站再 grep 一次归零。
 *
 * 用法：node tools/out/fix-ui5c-mangle.js          （干跑）
 *       node tools/out/fix-ui5c-mangle.js --write
 */
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..', '..'));
const WRITE = process.argv.indexOf('--write') >= 0;

const FIX = [
  ['backgroundbackground-coloror-bg)', 'background-color:var(--color-bg)'],
  ['backgroundbackground-color;color:var(--text-primary)', 'background-color:var(--bg);color:var(--text-primary)'],
  ['backgroundbackground-colorer-100);color:var(--ink-900)', 'background-color:var(--paper-100);color:var(--ink-900)'],
];

const FILES = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');
let total = 0;
FILES.forEach(f => {
  let src = fs.readFileSync(f, 'utf8');
  const hits = FIX.map(p => (src.match(new RegExp(p[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length);
  if (!hits.some(n => n)) return;
  hits.forEach((n, i) => { total += n; src = src.split(FIX[i][0]).join(FIX[i][1]); });
  console.log('  ' + f + ' ×' + hits.filter(n => n).join('/'));
  if (WRITE) fs.writeFileSync(f, src);
});

const left = FILES.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/backgroundbackground/g) || []).length, 0);
console.log((WRITE ? '已落盘 ' : '干跑（加 --write 落盘）：') + total + ' 处还原；残留 backgroundbackground ' + left + ' 处');
