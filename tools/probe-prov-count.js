/* 统计各省 data 文件存在性与节点数 */
const fs = require('fs');
const vm = require('vm');
const PROV = ['ah','bj','cq','data','fj','gd','gs','gxyn','gz','ha','hb','he','hi','hk','hlj','hn','jl','js','jx','ln','mo','nm','nx','qh','sc','sd','sh','sx','tj','tw','xj','xz','yn','zj'];
let tot = 0, miss = [];
PROV.forEach(pf => {
  const fn = (pf === 'data' ? 'data.js' : pf + '-data.js');
  if (!fs.existsSync(fn)) { miss.push(fn); return; }
  try {
    const c = { window: {}, console };
    vm.createContext(c);
    vm.runInContext(fs.readFileSync(fn, 'utf8'), c);
    const arr = c.window.SITES || [];
    if (Array.isArray(arr)) { tot += arr.length; console.log(fn + ': ' + arr.length); }
    else console.log(fn + ': 无 SITES');
  } catch (e) { console.log(fn + ': 解析失败 ' + e.message.slice(0, 40)); }
});
console.log('合计:', tot, '| 缺失:', miss.join(',') || '无');
/* nation-index 名称是否覆盖源（抽查所有源 name 是否在 index 中） */
const c1 = { window: {}, console };
vm.createContext(c1);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), c1);
const idxNames = new Set(c1.window.NATION_SITES_RAW.split('\n').filter(Boolean).map(l => l.split('|')[0]));
console.log('index 名称数:', idxNames.size);
