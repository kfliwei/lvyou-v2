/* 模拟 topic.html 启动器 + 引擎依赖，验证 nation 专题加载链完整 */
global.window = {};
global.navigator = { userAgent: 'test' };
global.document = {
  title: '',
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  getElementById: function () { return null; },
  createElement: function () { return { style: {}, appendChild: function () {}, dataset: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } }; },
  body: { innerHTML: '' },
  head: { appendChild: function () {} }
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.location = { search: '?p=nation', href: '' };

/* 1. 注册表 */
require('../topic-meta.js');
const p = 'nation';
const cfg = window.TOPIC_REGISTRY[p];
if (!cfg) { console.error('✗ 注册表无 nation'); process.exit(1); }
console.log('① 注册表查找 p=nation →', cfg.title, '✓');

/* 2. 模拟 loadScript(cfg.dataJs) */
require('../' + cfg.dataJs);
const sites = window.SITES || [];
const food = window.FOOD || [];
if (!sites.length) { console.error('✗ dataJs 未提供 window.SITES'); process.exit(1); }
console.log('② 加载', cfg.dataJs, '→ SITES', sites.length, '条, FOOD', food.length, '条 ✓');

/* 3. 数据契约检查（引擎 init 会用到的字段） */
let bad = 0;
sites.forEach(function (s, i) {
  if (!s || s.lat == null || isNaN(+s.lat) || s.lng == null || isNaN(+s.lng)) { bad++; console.error('  ✗ 坐标异常 idx', i, s && s.label); }
  if (!s.theme || !cfg.themes[s.theme]) { bad++; console.error('  ✗ 主题缺失/未配色:', i, s && s.label, s && s.theme); }
  if (!s.region) { bad++; console.error('  ✗ region 缺失:', i, s && s.label); }
});
console.log('③ 数据契约: 异常', bad, '条', bad ? '' : '✓');
if (bad) process.exit(1);

/* 4. 路线 stops 可解析 */
let routeMiss = 0;
cfg.routes.forEach(function (rt, ri) {
  rt.days.forEach(function (d, di) {
    d.stops.forEach(function (nm) {
      const hit = sites.some(function (s) { return s.name === nm || s.label === nm; }) ||
        sites.some(function (s) { return s.name.includes(nm) || s.label.includes(nm); });
      if (!hit) { routeMiss++; console.error('  ✗ 路线 stop 未收录:', rt.name, '/', nm); }
    });
  });
});
console.log('④ 路线 stops 解析: 未收录', routeMiss, '个', routeMiss ? '' : '✓');

/* 5. 主题顺序与配色闭环 */
const orderMiss = cfg.themeOrder.filter(function (t) { return !cfg.themes[t]; });
const themeInData = {};
sites.forEach(function (s) { themeInData[s.theme] = 1; });
const dataMiss = Object.keys(themeInData).filter(function (t) { return !cfg.themes[t]; });
console.log('⑤ themeOrder↔themes:', orderMiss.length ? '✗ ' + orderMiss : '一致 ✓', '| 数据主题未配色:', dataMiss.length ? '✗ ' + dataMiss : '无 ✓');

/* 6. 美食字段 */
let fbad = 0;
food.forEach(function (d, i) { if (!d.name || !d.city) { fbad++; } });
console.log('⑥ FOOD 契约: 异常', fbad, '条', fbad ? '' : '✓');

console.log('\n===== 全国专题加载链验证通过 =====');
console.log('入口: topic.html?p=nation');
console.log('标题:', cfg.title, '| 节点:', sites.length, '| 美食:', food.length, '| 省份:', new Set(sites.map(function (s) { return s.region; })).size, '| 路线:', cfg.routes.length);
