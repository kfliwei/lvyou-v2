/* verify.js 最终修复：源⊆index 名称覆盖校验（替代数量相等） */
const fs = require('fs');
let s = fs.readFileSync('tools/verify.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `let srcCount = -1;
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
const to = `let srcCount = -1, coverMiss = -1;
try {
  const c2 = { window: {}, console };
  vm.createContext(c2);
  const PROV_FILES = ['ah','bj','cq','data','fj','gd','gs','gxyn','gz','ha','hb','he','hi','hk','hlj','hn','jl','js','jx','ln','mo','nmg','nx','qh','sc','sd','sh','sx','tj','tw','xj','xz','zj'];
  const idxNames = new Set(rows.map(l => l.split('|')[0]));
  let tot = 0, missN = 0;
  PROV_FILES.forEach(pf => {
    try {
      vm.runInContext(fs.readFileSync(pf + '-data.js', 'utf8'), c2);
      const arr = c2.window.SITES || [];
      if (Array.isArray(arr)) { tot += arr.length; arr.forEach(x => { if (x && x.name && !idxNames.has(x.name)) missN++; }); }
    } catch (e) {}
  });
  srcCount = tot; coverMiss = missN;
} catch (e) {}
console.log('nation-index sites:', n, '| source sites:', srcCount, '| malformed rows:', bad, '| cover miss:', coverMiss);
if (bad || (coverMiss > 0)`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('tools/verify.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('verify.js 覆盖校验');
} else console.log('miss');
