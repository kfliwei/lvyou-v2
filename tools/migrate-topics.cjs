/* tools/migrate-topics.cjs — 从 4 个老专题页提取常量，生成统一注册表条目 + 路线数据
 * 用法：node tools/migrate-topics.cjs
 * 产出：routes-data.js（完整文件）+ .migrate-registry.json（注册表条目，供并入 topic-meta.js）
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const PAGES = {
  cz: { file: 'changzheng.html', dataJs: 'changzheng-data.js', foodJs: '', foodEnabled: false, title: '红军长征' },
  gy: { file: 'gx-yn.html', dataJs: 'gxyn-data.js', foodJs: 'food-gxyn.js', foodEnabled: true, title: '广西云南' },
  qt: { file: 'qinghai-tibet.html', dataJs: 'qz-data.js', foodJs: '', foodEnabled: false, title: '青藏风光' },
  sx: { file: 'shanxi.html', dataJs: 'data.js', foodJs: 'food.js', foodEnabled: true, title: '山西古建' }
};
function parseLiteral(src, name) {
  const re = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\});');
  const m = src.match(re);
  if (!m) return null;
  try { return new Function('return (' + m[1] + ')')(); } catch (e) { console.log('解析失败 ' + name + ': ' + e.message); return null; }
}
function parseSetView(src) {
  const m = src.match(/setView\((\[[0-9.,\s]+\]),([0-9.]+)\)/);
  return m ? { center: JSON.parse(m[1]), zoom: parseFloat(m[2]) } : { center: [35, 105], zoom: 5 };
}
const entries = {};
const routes = {};
for (const [k, cfg] of Object.entries(PAGES)) {
  const src = fs.readFileSync(path.join(dir, cfg.file), 'utf8');
  const themeOrder = parseLiteral(src, 'THEME_ORDER');
  const themes = parseLiteral(src, 'THEME');
  const themeIcons = parseLiteral(src, 'THEME_ICON');
  const ref = parseLiteral(src, 'REF');
  const dyn = parseLiteral(src, 'DYN');
  const dynOrder = parseLiteral(src, 'DYN_ORDER');
  const r = parseLiteral(src, 'ROUTES');
  if (r) routes[k] = r;
  const v = parseSetView(src);
  const e = {
    p: k, title: cfg.title, dataJs: cfg.dataJs, foodJs: cfg.foodJs,
    foodEnabled: cfg.foodEnabled, totalTagSuffix: '', center: v.center, zoom: v.zoom
  };
  if (k === 'sx' && dyn && dynOrder) { e.themeOrder = dynOrder; e.themes = dyn; e.themeKey = 'dy'; }
  else {
    if (themeOrder) e.themeOrder = themeOrder;
    if (themes) e.themes = themes;
    if (themeIcons) e.themeIcons = themeIcons;
  }
  if (ref) e.REF = ref;
  if (k === 'qt') e.elevFilter = true;
  if (r) e.routesKey = k;
  if (k === 'sx') e.regionShort = { '山西省': '晋' };
  entries[k] = e;
}
/* 写 routes-data.js */
const routesJs = '/* =========================================================\n' +
  ' * routes-data.js — 专题预设路线（自动迁移自老页面，勿手改）\n' +
  ' * 生成：node tools/migrate-topics.cjs\n' +
  ' * ========================================================= */\n' +
  'window.TOPIC_ROUTES = ' + JSON.stringify(routes, null, 1).replace(/\n/g, '\n') + ';\n';
fs.writeFileSync(path.join(dir, 'routes-data.js'), routesJs);
console.log('已生成 routes-data.js (' + Object.keys(routes).join(',') + ' 专题路线)');
/* 写注册表条目 JSON */
fs.writeFileSync(path.join(dir, '.migrate-registry.json'), JSON.stringify(entries, null, 2));
console.log('已生成 .migrate-registry.json');
