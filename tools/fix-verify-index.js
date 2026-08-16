/* 修复 verify.js：适配 10 列格式 + 移除已删除的 nation-data.js 依赖（改为与各省 data 文件源对比） */
const fs = require('fs');
let s = fs.readFileSync('tools/verify.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `/* 5. nation-index 数据完整性（与 nation-data.js 源数据动态对比） */
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ctx);
const raw = ctx.window.NATION_SITES_RAW;
const n = raw.split('\\n').length;
const bad = raw.split('\\n').filter(l => l.split('|').length !== 9).length;
let srcCount = -1;
try {
  const c2 = { window: {}, console };
  vm.createContext(c2);
  vm.runInContext(fs.readFileSync('nation-data.js', 'utf8'), c2);
  srcCount = (c2.window.NATION_SITES || c2.window.SITES || []).length;
} catch (e) {}
console.log('nation-index sites:', n, '| source sites:', srcCount, '| malformed rows:', bad);
if (bad || (srcCount > 0 && n !== srcCount)`;
const to = `/* 5. nation-index 数据完整性（格式 ≥9 列；与各省源数据文件动态对比） */
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ctx);
const raw = ctx.window.NATION_SITES_RAW;
const rows = raw.split('\\n').filter(Boolean);
const n = rows.length;
const bad = rows.filter(l => { const p = l.split('|'); return p.length < 9 || !isFinite(parseFloat(p[7])) || !isFinite(parseFloat(p[8])); }).length;
let srcCount = -1;
try {
  const c2 = { window: {}, console };
  vm.createContext(c2);
  const PROV = ['ah','bj','cq','data','fj','gd','gs','gxyn','gz','ha','hb','he','hi','hk','hlj','hn','jl','js','jx','ln','mo','nm','nx','qh','sc','sd','sh','sx','tj','tw','xj','xz','yn','zj'];
  let tot = 0;
  PROV.forEach(pf => {
    try { vm.runInContext(fs.readFileSync(pf + '-data.js', 'utf8'), c2); const arr = c2.window.SITES || []; if (Array.isArray(arr)) tot += arr.length; } catch (e) {}
  });
  srcCount = tot;
} catch (e) {}
console.log('nation-index sites:', n, '| source sites:', srcCount, '| malformed rows:', bad);
if (bad || (srcCount > 0 && n !== srcCount)`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('tools/verify.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('verify.js 修复');
} else console.log('miss');
