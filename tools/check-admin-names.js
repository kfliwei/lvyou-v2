/* 统计 cz 数据中 region/city/county 写法变体 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('F:/MyAi/trace/lvyou-v2/changzheng-data.js', 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const sites = ctx.window.SITES || [];
const byCity = {}, byRegion = {}, byCounty = {};
sites.forEach(s => {
  if (s.city) (byCity[s.city] = byCity[s.city] || []).push(s.name);
  if (s.region) (byRegion[s.region] = byRegion[s.region] || []).push(s.name);
  if (s.county) (byCounty[s.county] = byCounty[s.county] || []).push(s.name);
});
console.log('=== region 写法（' + Object.keys(byRegion).length + '）===');
Object.keys(byRegion).forEach(k => console.log(' ', k, '(' + byRegion[k].length + ')'));
console.log('=== 疑似写法变体：去修饰后同名的 city ===');
const norm = s => String(s || '').replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区/g, '').replace(/苗族侗族|布依族苗族|藏族羌族|土家族苗族|哈尼族彝族|傈僳族|朝鲜族|蒙古族|回族|白族|彝族|傣族|藏族|苗族|侗族/g, '').replace(/自治州/g, '州');
const byCityN = {};
sites.forEach(s => { if (s.city) { const k = norm(s.city); (byCityN[k] = byCityN[k] || new Set()).add(s.city); } });
Object.keys(byCityN).forEach(k => { if (byCityN[k].size > 1) console.log('  ', k, '→', [...byCityN[k]].join(' | ')); });
console.log('=== 疑似写法变体：去修饰后同名的 county ===');
const byCoN = {};
sites.forEach(s => { if (s.county) { const k = norm(s.county); (byCoN[k] = byCoN[k] || new Set()).add(s.county); } });
Object.keys(byCoN).forEach(k => { if (byCoN[k].size > 1) console.log('  ', k, '→', [...byCoN[k]].join(' | ')); });
