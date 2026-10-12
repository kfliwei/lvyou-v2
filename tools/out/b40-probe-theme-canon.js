/* 修前/修后对账：复刻 topic-common.js 的 canonThemes()，逐页量「零命中标签」与「灰色回退景点」 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
function evalFile(f) {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { window: w, console });
  return w;
}
const meta = evalFile('topic-meta.js');
const AL = meta.THEME_ALIAS || {};
const REG = meta.TOPIC_REGISTRY || {};
const norm = t => AL[t] || t;
const mapKeys = src => { const o = {}; Object.keys(src || {}).forEach(t => { const n = norm(t); if (o[n] == null) o[n] = src[t]; }); return o; };
function canon(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  if (c.themeOrder) { const a = []; c.themeOrder.forEach(t => { const n = norm(t); if (a.indexOf(n) < 0) a.push(n); }); c.themeOrder = a; }
  if (c.themes) c.themes = mapKeys(c.themes);
  if (c.themeIcons) c.themeIcons = mapKeys(c.themeIcons);
  if (c.majorThemes) { const a = []; c.majorThemes.forEach(t => { const n = norm(t); if (a.indexOf(n) < 0) a.push(n); }); c.majorThemes = a; }
  return c;
}
/* 产品口径：chip 存的名字就是 state.theme，筛选比 tk(s)；配色查 themes[tk(s)] */
function measure(cfg, sites, key) {
  const order = cfg.themeOrder || [], themes = cfg.themes || {};
  const tk = s => norm(s[key]);
  const counts = {};
  sites.forEach(s => { const t = tk(s); counts[t] = (counts[t] || 0) + 1; });
  return {
    chips: order.length,
    deadChips: order.filter(t => (counts[t] || 0) === 0),
    gray: sites.filter(s => !(tk(s) in themes)).length,
    majorDead: (cfg.majorThemes || []).filter(t => (counts[t] || 0) === 0).length,
  };
}
let b = { chips: 0, dead: 0, gray: 0, sites: 0, majorDead: 0 };
let a = { chips: 0, dead: 0, gray: 0, sites: 0, majorDead: 0 };
const rows = [];
for (const k of Object.keys(REG)) {
  const cfg = REG[k];
  if (!cfg || !cfg.dataJs || !fs.existsSync(path.join(ROOT, cfg.dataJs))) continue;
  const sites = evalFile(cfg.dataJs).SITES || [];
  if (!sites.length) continue;
  const key = cfg.themeKey || 'theme';
  const pre = measure(cfg, sites, key), post = measure(canon(cfg), sites, key);
  b.chips += pre.chips; b.dead += pre.deadChips.length; b.gray += pre.gray; b.sites += sites.length; b.majorDead += pre.majorDead;
  a.chips += post.chips; a.dead += post.deadChips.length; a.gray += post.gray; a.sites += sites.length; a.majorDead += post.majorDead;
  const moved = pre.deadChips.length !== post.deadChips.length || pre.gray !== post.gray || pre.chips !== post.chips;
  rows.push({ k, t: cfg.title, pre, post, moved, chipless: Object.keys(post.counts || {}).length });
}
console.log('修前：chip ' + b.chips + ' 颗，其中零命中 ' + b.dead + '，主题权重灾区(majorThemes零命中) ' + b.majorDead + '，灰 ' + b.gray + '/' + b.sites);
console.log('修后：chip ' + a.chips + ' 颗，其中零命中 ' + a.dead + '，majorThemes零命中 ' + a.majorDead + '，灰 ' + a.gray + '/' + a.sites);
rows.filter(r => r.moved).forEach(r => console.log('  ' + r.k + ' ' + r.t + '：chip ' + r.pre.chips + '→' + r.post.chips +
  '，零命中 ' + r.pre.deadChips.length + '→' + r.post.deadChips.length + '（修前名单：' + r.pre.deadChips.join('/') + '）' +
  '，灰 ' + r.pre.gray + '→' + r.post.gray));
const left = rows.filter(r => r.post.deadChips.length || r.post.gray);
console.log('修后仍有余量：零命中标签 ' + left.reduce((n, r) => n + r.post.deadChips.length, 0) +
  '，灰 ' + left.reduce((n, r) => n + r.post.gray, 0) + '（这些是配置里压根没声明的主题，需要单独立项配色）');
left.slice(0, 8).forEach(r => console.log('   余量 ' + r.k + ' 零命中=' + r.post.deadChips.join('/') + ' 灰=' + r.post.gray));
