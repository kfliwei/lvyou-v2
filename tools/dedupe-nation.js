/* dedupe-nation.js — nation-index 一级去重（高置信自动合并）
 * Tier-1: 同核心名(剥景区/博物馆等后缀) ≤1.2km，或 名字互相包含 ≤150m → 合并为一行
 *   合并规则: name=短名; alias=∪其余名字(、分隔); 主条目=简介更长的那条(经纬/省市区/主题从主);
 *            flag = m/h 并集
 * Tier-2 (150m~1.2km 包含式) 只报告不合并 → tools/out/dupes-tier2.txt
 * 重跑安全: 幂等（已并过的 alias 再跑不会二次收缩）
 * 用法: node tools/dedupe-nation.js [--dry] */
const fs = require('fs');
const vm = require('vm');
const DRY = process.argv.includes('--dry');

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ctx);
const rows = ctx.window.NATION_SITES_RAW.split('\n').filter(Boolean)
  .map(l => { const p = l.split('|'); return { p, name: p[0], alias: p[1] || '', prov: p[2] || '', city: p[3] || '', dist: p[4] || '', theme: p[5] || '', flag: p[6] || '', lat: +p[7], lng: +p[8], desc: p[9] || '' }; })
  .filter(r => isFinite(r.lat) && isFinite(r.lng));

function core(n) {
  let s = (n || '').replace(/[\s（）()·、，,。\-—]/g, '');
  const SUF = ['风景名胜区', '风景区', '风景名胜', '旅游景区', '旅游区', '景区', '博览园', '博物院', '博物馆', '纪念馆', '陈列馆'];
  let ch = true;
  while (ch) { ch = false; for (const suf of SUF) if (s.length > suf.length && s.endsWith(suf)) { s = s.slice(0, -suf.length); ch = true; } }
  return s;
}
function hav(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function related(a, b) { const ca = core(a.name), cb = core(b.name); return ca.length >= 2 && (ca === cb || cb.includes(ca) || ca.includes(cb)); }

/* 候选对 → 并查集分簇 */
const parent = rows.map((_, i) => i);
const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
const tier2 = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const a = rows[i], b = rows[j];
  if (!related(a, b)) continue;
  const d = hav(a, b);
  const sameCore = core(a.name) === core(b.name);
  if (sameCore ? d <= 1.2 : d <= 0.15) parent[find(i)] = find(j);
  else if (d <= 1.2) tier2.push([a, b, d]);
}
const groups = new Map();
rows.forEach((_, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); });

/* 合并每组 */
let mergedN = 0, removedN = 0;
const outRows = [], log = [];
for (const [, idxs] of groups) {
  if (idxs.length === 1) { outRows.push(rows[idxs[0]]); continue; }
  const members = idxs.map(i => rows[i]);
  const primary = members.slice().sort((a, b) => b.desc.length - a.desc.length)[0];
  const short = members.slice().sort((a, b) => a.name.length - b.name.length)[0];
  const aliases = [...new Set(members.flatMap(m => [m.name, ...m.alias.split(/[、,，]/)].filter(x => x && x !== short.name)))];
  primary.name = short.name;
  primary.alias = aliases.join('、');
  const fl = members.map(m => m.flag || '').join('');
  primary.flag = fl.includes('m') ? 'm' : (fl.includes('h') ? 'h' : primary.flag);
  outRows.push(primary);
  removedN += members.length - 1; mergedN++;
  log.push('合并: ' + members.map(m => `【${m.name}】${m.prov}·${m.city}(${m.lat},${m.lng})`).join(' + ') + ' → 【' + primary.name + '|' + primary.alias + '】');
}
if (!DRY) {
  /* 输出必须是单行合法 JS：payload 用真实 \n 连接，JSON.stringify 统一转义（引号/反斜杠/换行），杜绝数据内引号断串 */
  const payload = outRows.map(r => [r.name, r.alias, r.prov, r.city, r.dist, r.theme, r.flag, r.lat, r.lng, r.desc].join('|')).join('\n');
  const out = 'window.NATION_SITES_RAW=' + JSON.stringify(payload) + ';\n';
  /* 写盘前自检：产物必须能被解析，行数对得上，否则拒绝写入（防再犯截断/断串事故） */
  const check = { window: {} };
  vm.createContext(check);
  try {
    vm.runInContext(out, check);
  } catch (e) {
    const bad = out.length > 200 ? out.slice(0, 160) + '...' : out;
    console.error('自检失败(产物非法 JS):', e.message.slice(0, 200));
    console.error('产物头部:', JSON.stringify(bad));
    process.exit(1);
  }
  const outN = check.window.NATION_SITES_RAW.split('\n').filter(Boolean).length;   /* vm 解析后是真实换行 */
  if (outN !== outRows.length) { console.error('自检失败: 解析 ' + outN + ' 行 != 预期 ' + outRows.length); process.exit(1); }
  fs.writeFileSync('nation-index.js', out);
  fs.writeFileSync('tools/out/dedupe-log.txt', log.join('\n'));
} else { log.forEach(l => console.log(l)); }
fs.writeFileSync('tools/out/dupes-tier2.txt', 'Tier-2 待人工判断（150m~1.2km 包含式，未合并）:\n' + tier2.map(([a, b, d]) => `【${a.name}】${a.prov}·${a.city}  vs  【${b.name}】${b.prov}·${b.city}  d=${(d * 1000).toFixed(0)}m`).join('\n'));
console.log((DRY ? '[DRY] ' : '') + '簇: ' + mergedN + ' | 移除行: ' + removedN + ' | 剩余: ' + outRows.length + ' | Tier-2 报告: ' + tier2.length + ' 对');
