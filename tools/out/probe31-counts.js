/* tools/out/probe31-counts.js — §46 登记表取数：全站「日期显示/归一单点」调用点按文件计数
 * 判据与 verify.js §46 里那条动态对账必须一致：先剥块注释（跳字符串），再空白归一，再数 token。
 * 用法: node tools/out/probe31-counts.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

function stripBlockComments(src) {
  /* 不抄刀：把 tools/verify.js 里那把共享剥刀 eval 出来用，探针与闸门读到的必须是同一样东西 */
  const v = fs.readFileSync(path.join(ROOT, 'tools', 'verify.js'), 'utf8');
  const at = v.indexOf('function stripBlockComments');
  if (at < 0) throw new Error('verify.js 里找不到那把共享剥刀');
  let d = 0, seen = false, i = at;
  for (; i < v.length; i++) {
    if (v[i] === '{') { d++; seen = true; }
    else if (v[i] === '}') { d--; if (seen && d === 0) { i++; break; } }
  }
  return eval('(' + v.slice(at, i) + ')')(src);
}

const RE = /TravelNotes\.(dayText|noteDay|nowDayText|fmtDayText|fmtClock)\(/g;
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
const rows = [];
let total = 0;
files.forEach(f => {
  const flat = stripBlockComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).replace(/\s+/g, ' ');
  const hits = flat.match(RE) || [];
  const byName = {};
  hits.forEach(h => { byName[h] = (byName[h] || 0) + 1; });
  if (hits.length) { rows.push({ file: f, n: hits.length, names: byName }); total += hits.length; }
});
console.log('=== §46 单点调用点（剥块注释 + 空白归一后计数）===');
rows.forEach(r => console.log('  ' + r.file + ' = ' + r.n + '  ' + JSON.stringify(r.names)));
console.log('文件数=' + rows.length + ' 总调用点=' + total);

/* 三条动态扫描的现场读数，与 verify.js 里那三条判据同形 */
const LOCALE_RE = /toLocaleDateString|toLocaleTimeString/g;
let localeHits = [];
const PARSE_RE = /\\d\{4\}\)\D/g;
let parseHits = [];
const DATE_LINE = /\.date\b/;
const dateRows = [];
const HAND = /(getFullYear\(\)|getMonth\(\)|getDate\(\))/;
const REND = ['<div', '<span', '<p ', '<p>', '<b>', '<li', '<td', 'innerHTML', 'fillText(', 'bindPopup(', 'textContent', 'rows.push(', 'line(', 'status'];
const handRows = [];
files.forEach(f => {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const flat = stripBlockComments(raw);
  if (LOCALE_RE.test(flat)) localeHits.push(f);
  LOCALE_RE.lastIndex = 0; PARSE_RE.lastIndex = 0;
  if (PARSE_RE.test(flat)) parseHits.push(f);
  raw.split('\n').forEach((ln, i) => {
    if (DATE_LINE.test(ln)) dateRows.push(f + ':' + (i + 1));
    if (HAND.test(ln) && REND.some(k => ln.indexOf(k) >= 0)) handRows.push(f + ':' + (i + 1) + '  ' + ln.replace(/\s+/g, ' ').trim().slice(0, 96));
  });
});
console.log('locale 族命中文件=' + JSON.stringify(localeHits));
console.log('宽松年月日解析正则命中文件=' + JSON.stringify(parseHits));
console.log('.date 命中行数=' + dateRows.length + ' 按文件=' + JSON.stringify(dateRows.reduce(function (a, x) { const f = x.split(':')[0]; a[f] = (a[f] || 0) + 1; return a; }, {})));
console.log('手拼日期 + 渲染信号 命中行数=' + handRows.length);
handRows.forEach(r => console.log('  ' + r));
