#!/usr/bin/env node
/* ============================================================
   gen-nation.js — 生成全国汇总数据 nation-data.js
   合并 8 个专题/省数据源 + 6 个美食数据源，输出框架格式：
     window.SITES  （景点节点，region 归一化为省份简称，供 chips/筛选）
     window.FOOD   （美食，聚合各省 food）
     window.NATION_META（省份列表等元信息）
   供 topic.html?p=nation 直接消费（TOPIC_REGISTRY.nation）
   运行：node tools/gen-nation.js
   输出：nation-data.js（自动生成，请勿手改）
   ============================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = {};

const REGION_FIX = {
  '新疆维吾尔自治区': '新疆', '贵州省': '贵州', '四川省': '四川', '甘肃省': '甘肃',
  '宁夏回族自治区': '宁夏', '广西壮族自治区': '广西', '西藏自治区': '西藏',
  '内蒙古自治区': '内蒙古', '黑龙江省': '黑龙江', '吉林省': '吉林', '辽宁省': '辽宁',
  '河北省': '河北', '山东省': '山东', '江苏省': '江苏', '浙江省': '浙江',
  '安徽省': '安徽', '福建省': '福建', '广东省': '广东', '海南省': '海南',
  '云南省': '云南', '陕西省': '陕西', '青海省': '青海', '江西省': '江西',
  '湖南省': '湖南', '河南省': '河南', '湖北省': '湖北', '山西省': '山西',
  '北京市': '北京', '上海市': '上海', '天津市': '天津', '重庆市': '重庆',
  '台湾省': '台湾', '香港特别行政区': '香港', '澳门特别行政区': '澳门'
};
function provOf(s, topic) {
  if (!s.region) return topic === 'sx' ? '山西' : '';
  const r = s.region;
  if (REGION_FIX[r]) return REGION_FIX[r];
  const m = String(r).match(/^(.*?)(省|自治区|特别行政区|市)$/);
  return m ? m[1] : r;
}

const TOPICS = [
  { id: 'sx',   file: 'data.js',            name: '山西古建' },
  { id: 'chz',  file: 'changzheng-data.js', name: '红军长征' },
  { id: 'gxyn', file: 'gxyn-data.js',       name: '广西云南' },
  { id: 'qz',   file: 'qingzang-data.js',         name: '青藏风光' },
  { id: 'xj',   file: 'xj-data.js',         name: '新疆' },
  { id: 'gz',   file: 'gz-data.js',         name: '贵州' },
  { id: 'sc',   file: 'sc-data.js',         name: '四川' },
  { id: 'gs',   file: 'gs-data.js',         name: '甘肃' },
  { id: 'qh',   file: 'qh-data.js',         name: '青海' },
  { id: 'xz',   file: 'xz-data.js',         name: '西藏' },
  { id: 'nmg',  file: 'nmg-data.js',        name: '内蒙古' },
  { id: 'sx2',  file: 'sx-data.js',         name: '陕西' },
  { id: 'hn',   file: 'hn-data.js',         name: '湖南' },
  { id: 'hb',   file: 'hb-data.js',         name: '湖北' },
  { id: 'cq',   file: 'cq-data.js',         name: '重庆' },
  { id: 'nx',   file: 'nx-data.js',         name: '宁夏' },
  { id: 'bj',   file: 'bj-data.js',         name: '北京' },
  { id: 'tj',   file: 'tj-data.js',         name: '天津' },
  { id: 'he',   file: 'he-data.js',         name: '河北' },
  { id: 'ha',   file: 'ha-data.js',         name: '河南' },
  { id: 'sd',   file: 'sd-data.js',         name: '山东' },
  { id: 'ln',   file: 'ln-data.js',         name: '辽宁' },
  { id: 'jl',   file: 'jl-data.js',         name: '吉林' },
  { id: 'hlj',  file: 'hlj-data.js',        name: '黑龙江' },
  { id: 'sh',   file: 'sh-data.js',         name: '上海' },
  { id: 'js',   file: 'js-data.js',         name: '江苏' },
  { id: 'zj',   file: 'zj-data.js',         name: '浙江' },
  { id: 'ah',   file: 'ah-data.js',         name: '安徽' },
  { id: 'fj',   file: 'fj-data.js',         name: '福建' },
  { id: 'jx',   file: 'jx-data.js',         name: '江西' },
  { id: 'gd',   file: 'gd-data.js',         name: '广东' },
  { id: 'hi',   file: 'hi-data.js',         name: '海南' }
];

const out = [];
const seenN = new Set();

for (const t of TOPICS) {
  delete global.window.SITES;
  require(path.join(ROOT, t.file));
  const arr = global.window.SITES || [];
  for (const s of arr) {
    if (!s || s.lat == null || s.lng == null) continue;
    const prov = provOf(s, t.id);
    if (seenN.has(s.name)) continue; seenN.add(s.name);
    out.push({
      name: s.name, label: s.label || s.name,
      province: prov,
      topic: t.id, topicName: t.name,
      theme: s.theme || s.ty || '其他',
      /* region 归一化为省份简称：框架的省 chips 与列表展示都依赖它 */
      region: prov,
      city: s.city || '', county: s.county || '',
      elev: s.elev, best: s.best, lat: s.lat, lng: s.lng,
      desc: s.desc || '', wiki: s.wiki || '', img: s.img || '',
      dy: s.dy, ty: s.ty
    });
  }
}

/* ---- 美食聚合 ---- */
/* 每个文件带默认省；跨省文件（food-gxyn）用 city 映射精确判断 */
const FOODS = [
  { file: 'food.js', prov: '山西' },
  { file: 'food-gxyn.js', prov: '' },
  { file: 'sc-food.js', prov: '四川' },
  { file: 'xj-food.js', prov: '新疆' },
  { file: 'gz-food.js', prov: '贵州' },
  { file: 'gs-food.js', prov: '甘肃' },
  { file: 'qh-food.js', prov: '青海' },
  { file: 'xz-food.js', prov: '西藏' },
  { file: 'nmg-food.js', prov: '内蒙古' },
  { file: 'sx-food.js', prov: '陕西' },
  { file: 'hn-food.js', prov: '湖南' },
  { file: 'hb-food.js', prov: '湖北' },
  { file: 'cq-food.js', prov: '重庆' },
  { file: 'nx-food.js', prov: '宁夏' }
];
/* 城市→省映射（由景点数据推断，供跨省美食补 province） */
const cityProv = {};
for (const s of out) { if (s.city && s.province && !cityProv[s.city]) cityProv[s.city] = s.province; }
const foodOut = [];
for (const f of FOODS) {
  delete global.window.FOOD;
  try { require(path.join(ROOT, f.file)); } catch (e) { continue; }
  const arr = global.window.FOOD || [];
  for (const d of arr) {
    if (!d || !d.name) continue;
    foodOut.push({
      name: d.name, city: d.city || '', county: d.county || '',
      province: f.prov || cityProv[d.city] || '',
      type: d.type || '小吃', desc: d.desc || '',
      feature: d.feature || '', with: d.with || ''
    });
  }
}

const provinces = [];
for (const s of out) if (!provinces.includes(s.province)) provinces.push(s.province);

const js = '/* ============================================\n   nation-data.js — 全国景点+美食汇总数据（框架格式）\n   自动生成于 tools/gen-nation.js，请勿手改。\n   修改请编辑各专题数据文件后重新运行生成。\n   ============================================ */\n' +
  'window.SITES = ' + JSON.stringify(out) + ';\n' +
  'window.FOOD = ' + JSON.stringify(foodOut) + ';\n' +
  'window.NATION_META = { generated:"' + new Date().toISOString().slice(0, 10) + '", count:' + out.length +
  ', foodCount:' + foodOut.length +
  ', topics:' + JSON.stringify(Object.fromEntries(TOPICS.map(function (t) { return [t.id, t.name]; }))) +
  ', provinces:' + JSON.stringify(provinces) + ' };\n';

fs.writeFileSync(path.join(ROOT, 'nation-data.js'), js, 'utf8');
console.log('生成 nation-data.js ✓');
console.log('  节点总数:', out.length);
console.log('  美食总数:', foodOut.length);
console.log('  省份数:', provinces.length, '→', provinces.join(' / '));
