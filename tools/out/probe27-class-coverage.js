/* tools/out/probe27-class-coverage.js — 只读盘点：travel-notes.js 发出的 tn-* 类名，
 * 在「所有宿主页都加载的 design.css」里有没有定义；顺带对账面板的 16 个宿主页是否真引了 design.css。
 * 用法: node tools/out/probe27-class-coverage.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const js = R('travel-notes.js');
/* 只认「类上下文」里的 tn-* token：el('div','X')、className='X'、class="X"（含多类空格分隔） */
const ctx = [
  /\bel\(\s*'[a-z]+'\s*,\s*'([^']+)'/g,
  /className\s*=\s*'([^']+)'/g,
  /class="([^"]+)"/g,
  /class='([^']+)'/g,
  /\$\x28body,\s*'\.([a-z0-9_-]+)'\x29/g,
  /querySelector(?:All)?\('\.([a-z0-9_-]+)'\)/g,
];
const cls = new Set();
ctx.forEach(re => { let m; while ((m = re.exec(js))) m[1].split(/\s+/).forEach(t => { if (/^tn-[a-z0-9-]+$/.test(t)) cls.add(t); }); });

const design = R('design.css'), mapcss = R('map.css');
const own = js; /* travel-notes.js 自己注入的那份 CSS（534 行起，宿主页全都拿得到） */
const inlineCssFiles = ['index.html', 'travel-map.html'];
const inlineCss = inlineCssFiles.map(R).join('\n');

const missing = [], inMapOnly = [], ok = [], byOwn = [];
[...cls].sort().forEach(c => {
  const d = design.indexOf('.' + c) >= 0, mp = mapcss.indexOf('.' + c) >= 0, il = inlineCss.indexOf('.' + c) >= 0;
  const o = new RegExp('\\.' + c + '[\\s,{:.\\[>]').test(own) && own.indexOf('.' + c) >= 0;
  if (d) ok.push(c);
  else if (o) byOwn.push(c);
  else if (mp) inMapOnly.push(c + '（只在 map.css：3/15 页读得到）');
  else if (il) inMapOnly.push(c + '（只在 index/travel-map 的页内联 <style> 里）');
  else missing.push(c);
});
console.log('面板发出的 tn-* 类共 ' + cls.size + ' 个');
console.log('  design.css 有定义：' + ok.length);
console.log('  面板自注入表里有定义：' + byOwn.length + ' → ' + byOwn.join(' '));
console.log('  只在 map.css / 页内联：' + (inMapOnly.length ? '\n    ' + inMapOnly.join('\n    ') : '0'));
console.log('  三处都没有（裸类）：' + (missing.length ? '\n    ' + missing.join('\n    ') : '0'));

/* 宿主页对账：挂了 travel-notes.js 的页，有没有引 design.css */
console.log('\n=== 挂 travel-notes.js 的页面 × 加载表 ===');
const hosts = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && R(f).indexOf('travel-notes.js') >= 0);
let bad = 0;
hosts.forEach(f => {
  const s = R(f);
  const sheets = [...s.matchAll(/<link[^>]*stylesheet[^>]*href="([^"]+)"/g)].map(m => m[1]);
  const hasDesign = sheets.indexOf('design.css') >= 0;
  if (!hasDesign) bad++;
  console.log('  ' + (hasDesign ? 'OK   ' : '缺失 ') + f + '  [' + sheets.join(' ') + ']');
});
console.log('--- 共 ' + hosts.length + ' 页，没引 design.css 的 ' + bad + ' 页');
