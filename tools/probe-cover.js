/* ① index region 分布 ② nm-data/yn-data 引用 ③ 源→index 覆盖检查 */
const fs = require('fs');
const vm = require('vm');
/* 1. region 分布 */
const c1 = { window: {}, console };
vm.createContext(c1);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), c1);
const rows = c1.window.NATION_SITES_RAW.split('\n').filter(Boolean);
const cnt = {};
rows.forEach(l => { const p = l.split('|'); cnt[p[2]] = (cnt[p[2]] || 0) + 1; });
const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
console.log('=== index region 分布（前 8 + 总数）===');
top.slice(0, 8).forEach(t => console.log(t[0] + ': ' + t[1]));
console.log('region 数:', top.length, '总行:', rows.length);
/* 2. 引用 nm-data / yn-data */
console.log('=== 页面引用 ===');
['explore-map.html', 'topic.html', 'topic-common.js', 'node-manager.html', 'search.html', 'travel-map.html', 'wishlist.html', 'nation-lod.js', 'planner.js'].forEach(f => {
  try {
    const s = fs.readFileSync(f, 'utf8');
    if (/nm-data|yn-data|nmg-data|gxyn-data/.test(s)) {
      s.split('\n').forEach((l, i) => { if (/nm-data|yn-data|nmg-data|gxyn-data/.test(l)) console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 100)); });
    }
  } catch (e) {}
});
/* 3. 源名称覆盖（省文件 name 集合是否都在 index） */
console.log('=== 源→index 覆盖 ===');
const idxNames = new Set(rows.map(l => l.split('|')[0]));
['nmg-data.js', 'gxyn-data.js', 'sc-data.js', 'xz-data.js'].forEach(fn => {
  try {
    const c = { window: {}, console };
    vm.createContext(c);
    vm.runInContext(fs.readFileSync(fn, 'utf8'), c);
    const arr = c.window.SITES || [];
    const missN = arr.filter(x => !idxNames.has(x.name));
    console.log(fn + ': 源 ' + arr.length + ' 个，index 缺失 ' + missN.length + (missN.length ? ' 例:' + missN.slice(0, 3).map(x => x.name).join('/') : ''));
  } catch (e) { console.log(fn + ': 读取失败 ' + e.message.slice(0, 40)); }
});
