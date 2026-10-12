/* 全库主题对账：按页复刻产品口径 tk()/colorOf()，量「灰色回退景点数」与「零命中标签数」 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

function evalFile(f) {
  const win = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;globalThis.__w=window;', { window: win, console });
  return win;
}
const metaWin = evalFile('topic-meta.js');
const ALIAS = metaWin.THEME_ALIAS || {};
const REG = metaWin.TOPIC_REGISTRY || {};
const norm = t => ALIAS[t] || t;

let pages = 0, grayTotal = 0, deadChipTotal = 0, chiplessTotal = 0;
const rows = [];
for (const k of Object.keys(REG)) {
  const cfg = REG[k];
  if (!cfg || !cfg.dataJs) continue;
  const dp = path.join(ROOT, cfg.dataJs);
  if (!fs.existsSync(dp)) { rows.push({ p: k, err: '缺数据文件 ' + cfg.dataJs }); continue; }
  const sites = evalFile(cfg.dataJs).SITES || [];
  if (!sites.length) { rows.push({ p: k, title: cfg.title, skip: '数据 0 条（走 routes）' }); continue; }
  const key = cfg.themeKey || 'theme';
  const order = cfg.themeOrder || [];
  const themes = cfg.themes || {};
  /* 产品口径：tk = norm(s[themeKey])；color = themes[tk] || 灰 */
  const counts = {};
  sites.forEach(s => { const t = norm(s[key]); counts[t] = (counts[t] || 0) + 1; });
  const present = Object.keys(counts);
  const gray = sites.filter(s => !(norm(s[key]) in themes));
  const chipless = present.filter(t => !(order.map(norm).includes(t)));
  const dead = order.filter(t => (counts[norm(t)] || 0) === 0);
  const dup = [];
  const seen = {};
  order.forEach(t => { const n = norm(t); if (seen[n]) dup.push(seen[n] + '↔' + t); else seen[n] = t; });
  pages++; grayTotal += gray.length; deadChipTotal += dead.length; chiplessTotal += chipless.length;
  rows.push({
    p: k, title: cfg.title, field: key, sites: sites.length,
    gray: gray.length, grayShare: (gray.length / sites.length * 100).toFixed(0) + '%',
    deadChips: dead, chiplessThemes: chipless.map(t => t + ':' + counts[t]),
    dupChips: dup,
    rawSample: [...new Set(sites.map(s => s[key]))].slice(0, 4).join('/'),
  });
}
console.log('总计：有数据页 ' + pages + '，灰色回退景点 ' + grayTotal + '，零命中标签 ' + deadChipTotal + '，无标签主题 ' + chiplessTotal);
rows.forEach(r => {
  if (r.err || r.skip) return console.log((r.err ? 'ERR ' : '跳过 ') + JSON.stringify(r));
  const bad = r.gray || r.deadChips.length || r.chiplessThemes.length || r.dupChips.length;
  console.log((bad ? '问题 ' : '干净 ') + [r.p, r.title, '字段=' + r.field, '景点' + r.sites,
    '灰=' + r.gray + '(' + r.grayShare + ')',
    '零命中=' + (r.deadChips.join('/') || '无'),
    '撞车=' + (r.chiplessThemes.length || r.dupChips.length ? (r.dupChips.join(',') || '无') : '无'),
    '无标签=' + (r.chiplessThemes.join(',') || '无'),
    '数据原值样例=' + r.rawSample].join(' | '));
});
