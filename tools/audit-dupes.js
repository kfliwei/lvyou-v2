/* audit-dupes.js — 全库景点重复审计（只报告，不改数据）
 * 判据：核心名归一化后相同，或名字互相包含，且坐标距离 ≤ 1.2km → 疑似同一景点
 * 用法: node tools/audit-dupes.js [--kw 晋祠] [--max 20] */
const fs = require('fs');
const vm = require('vm');
const argv = process.argv.slice(2);
const kwI = argv.indexOf('--kw'), maxI = argv.indexOf('--max');
const KW = kwI >= 0 ? argv[kwI + 1] : null;
const MAXSHOW = maxI >= 0 ? +argv[maxI + 1] : 15;

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ctx);
const rows = ctx.window.NATION_SITES_RAW.split('\n').filter(Boolean)
  .map(l => { const p = l.split('|'); return { name: p[0], alias: p[1] || '', prov: p[2] || '', city: p[3] || '', theme: p[5] || '', lat: +p[7], lng: +p[8], desc: p[9] || '', raw: l }; })
  .filter(r => isFinite(r.lat) && isFinite(r.lng));

/* 核心名归一：去空白/标点 → 剥装饰后缀 → 剥省市前缀 */
function core(n) {
  let s = (n || '').replace(/[\s（）()·、，,。\-—]/g, '');
  const SUF = ['风景名胜区', '风景区', '风景名胜', '旅游景区', '旅游区', '景区', '博览园', '博物院', '博物馆', '纪念馆', '陈列馆'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of SUF) if (s.length > suf.length && s.endsWith(suf)) { s = s.slice(0, -suf.length); changed = true; }
  }
  return s;
}
function hav(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* 索引：核心名 → 行 */
const byCore = new Map();
rows.forEach(r => { const c = core(r.name) || r.name; (byCore.get(c) || byCore.set(c, []).get(c)).push(r); });
const KM = 1.2;
const clusters = [];
for (const [c, arr] of byCore) {
  if (arr.length < 2) continue;
  /* 同核心名内按地理邻近聚类（同名异地：全国可能有多个"文庙"） */
  const used = new Array(arr.length).fill(false);
  for (let i = 0; i < arr.length; i++) {
    if (used[i]) continue;
    const grp = [arr[i]]; used[i] = true;
    for (let j = i + 1; j < arr.length; j++) {
      if (!used[j] && hav(arr[i], arr[j]) <= KM) { grp.push(arr[j]); used[j] = true; }
    }
    if (grp.length > 1) clusters.push(grp);
  }
}
/* 包含式：短名 ⊂ 长名（剥后缀前），同点 ≤ 1.2km（补抓"晋祠/晋祠博物馆"这类非同核心名） */
const seen = new Set(clusters.flat().map(r => r.raw));
const containCl = [];
const sorted = rows.slice().sort((a, b) => a.name.length - b.name.length);
for (let i = 0; i < sorted.length; i++) {
  const a = sorted[i]; if (a.name.length < 2) continue;
  const ca = core(a.name);
  for (let j = i + 1; j < sorted.length; j++) {
    const b = sorted[j];
    if (b.name.length - a.name.length > 10) break;
    if (seen.has(b.raw)) continue;
    const cb = core(b.name);
    if (ca.length < 2 || cb === ca) continue;
    if (cb.includes(ca) && hav(a, b) <= KM) { containCl.push([a, b]); seen.add(b.raw); seen.add(a.raw); break; }
  }
}
const total = clusters.reduce((s, g) => s + g.length, 0) + containCl.reduce((s, g) => s + g.length, 0);
console.log('总条目:', rows.length, '| 同核心名重复簇:', clusters.length, '| 包含式重复对:', containCl.length, '| 涉及条目:', total);
const show = clusters.sort((a, b) => b.length - a.length).slice(0, MAXSHOW);
console.log('\n--- 同核心名重复簇（前 ' + show.length + '）---');
show.forEach(g => console.log(g.map(r => `【${r.name}|${r.alias}】${r.prov}·${r.city} (${r.lat.toFixed(4)},${r.lng.toFixed(4)})`).join('\n  vs  ') + '\n'));
console.log('--- 包含式重复（前 ' + Math.min(containCl.length, MAXSHOW) + '）---');
containCl.slice(0, MAXSHOW).forEach(([a, b]) => console.log(`【${a.name}】${a.prov}·${a.city}  vs  【${b.name}】${b.prov}·${b.city}  d=${hav(a, b).toFixed(2)}km`));
if (KW) {
  console.log('\n--- 关键词「' + KW + '」命中 ---');
  rows.filter(r => r.name.includes(KW) || r.alias.includes(KW)).forEach(r => console.log(`【${r.name}|${r.alias}】${r.prov}·${r.city}·${r.theme} (${r.lat},${r.lng})`));
}
