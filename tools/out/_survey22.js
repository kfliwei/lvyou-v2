/* 一次性：批次 22 地基实测（跑完即删）。落 tools/out/b22-survey.txt */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'b22-survey.txt');
const L = [];
const say = s => { L.push(s); process.stdout.write(s + '\n'); };

/* 产品文件口径：根目录 + 一级子目录里除 tools/ docs/ vendor/ node_modules/ images* fonts/ 外的 js/html/css */
const SKIP_DIR = new Set(['tools', 'docs', 'vendor', 'node_modules', 'images', 'images_chz', 'fonts', 'data', '.git', 'test-data.js']);
function walk(d, pre) {
  const r = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name) || pre + e.name === 'vendor') continue;
      if (e.name.startsWith('images')) continue;
      r.push(...walk(path.join(d, e.name), pre + e.name + '/'));
    } else if (/\.(js|html|css)$/.test(e.name)) {
      r.push(pre + e.name);
    }
  }
  return r;
}
const FILES = walk(ROOT, '');
say('=== 产品文件清单（排除 tools/docs/vendor/node_modules/images*/fonts/data）：' + FILES.length + ' 个 ===');

const SRC = {};
for (const f of FILES) SRC[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');

function cnt(hay, re) { const m = hay.match(re); return m ? m.length : 0; }
function scan(re, label) {
  let total = 0, files = 0;
  const per = [];
  for (const f of FILES) {
    const n = cnt(SRC[f], re);
    if (n) { total += n; files++; per.push(f + ':' + n); }
  }
  say('--- ' + label + '：出现 ' + total + ' 次，分布在 ' + files + ' 个文件 ---');
  say('  ' + per.join('  '));
  return total;
}
const ariaTotal = scan(/aria-[a-zA-Z]+=/g, 'aria-*=（属性写法）');
const ariaAny = scan(/aria-[a-zA-Z]+/g, 'aria-* 任意（含 JS 里 setAttribute 的字符串）');
const roleTotal = scan(/role\s*=\s*["']/g, 'role="');
const liveTotal = scan(/aria-live/g, 'aria-live');
say('aria-live 逐处行号：');
for (const f of FILES) SRC[f].split('\n').forEach((l, i) => { if (l.indexOf('aria-live') >= 0) say('  ' + f + ':' + (i + 1) + '  ' + l.trim().slice(0, 110)); });
const filesWithAria = FILES.filter(f => /aria-[a-zA-Z]+|role=/.test(SRC[f])).length;
say('含 aria/role 的文件：' + filesWithAria + ' / ' + FILES.length + '（并集口径，不是逐类相加）');
/* aria 属性名种类并集 */
const names = new Set();
for (const f of FILES) (SRC[f].match(/aria-[a-zA-Z]+/g) || []).forEach(x => names.add(x.toLowerCase()));
say('aria 属性名种类：' + names.size + ' → ' + Array.from(names).sort().join(' '));

/* 三类落点 */
function lines(re, label) {
  say('--- ' + label + ' ---');
  for (const f of FILES) SRC[f].split('\n').forEach((l, i) => { if (re.test(l)) say('  ' + f + ':' + (i + 1) + '  ' + l.trim().slice(0, 130)); });
}
lines(/class="day-card/, '日卡生成点（class="day-card）');
lines(/day-card/, 'day-card 全串（含 CSS/选择器）');
lines(/L\.divIcon\(|divIcon\(/, 'divIcon 调用点');
lines(/classList\.add\('show'\)|classList\.add\("show"\)/, '弹层开法 classList.add(show)');
lines(/\.sheet\b|id="[a-zA-Z]*[Ss]heet/, '.sheet / *Sheet 挂点');
lines(/role=["'](dialog|list|listitem|button)|setAttribute\(['"]role/, 'role 属性逐处');
lines(/tabindex/i, 'tabindex 逐处');
lines(/focus\(\)|trapFocus|focus-visible|:focus/, '焦点相关（focus()/trap/:focus）');

/* 既有 trap 与导出表 */
say('--- ui.js 关键行 ---');
['UI.confirm', 'confirm:', 'sheet', 'export', 'window.UI', 'offlineBar', 'errorBox', 'toast'].forEach(k => {
  const hits = [];
  SRC['ui.js'].split('\n').forEach((l, i) => { if (l.indexOf(k) >= 0) hits.push(i + 1); });
  say('  "' + k + '" 行号：' + (hits.length ? hits.join(',') : '无') + '（' + hits.length + ' 处）');
});
say('--- design.css .sheet 段 ---');
SRC['design.css'].split('\n').forEach((l, i) => { if (/sheet/.test(l)) say('  design.css:' + (i + 1) + '  ' + l.trim().slice(0, 120)); });

fs.writeFileSync(OUT, L.join('\n') + '\n', 'utf8');
say('证据落盘：' + OUT + '（' + L.length + ' 行）');
