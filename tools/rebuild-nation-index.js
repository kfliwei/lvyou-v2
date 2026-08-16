/* tools/rebuild-nation-index.js
 * 从各省 *-data.js 聚合，重新生成 nation-index.js（含 desc，region 归一为简称）。
 * 用法: node tools/rebuild-nation-index.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 省 data 文件（排除 routes/test 等非站点数据）
const FILES = [
  'data.js', 'ah-data.js', 'bj-data.js', 'changzheng-data.js', 'cq-data.js', 'fj-data.js',
  'gd-data.js', 'gs-data.js', 'gxyn-data.js', 'gz-data.js', 'ha-data.js', 'hb-data.js',
  'he-data.js', 'hi-data.js', 'hk-data.js', 'hlj-data.js', 'hn-data.js', 'jl-data.js',
  'js-data.js', 'jx-data.js', 'ln-data.js', 'mo-data.js', 'nmg-data.js', 'nx-data.js',
  'qh-data.js', 'qingzang-data.js', 'sc-data.js', 'sd-data.js', 'sh-data.js', 'sx-data.js',
  'tj-data.js', 'tw-data.js', 'xj-data.js', 'xz-data.js', 'zj-data.js'
];

// region 全称 → 简称（去掉行政区后缀）
function shortRegion(r) {
  return String(r || '').replace(/壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市/g, '');
}

// desc 清洗：去换行/管道符，截断控制体积（前 80 字足够关键词匹配）
function cleanDesc(d) {
  if (d == null) return '';
  return String(d).replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

const all = [];
const seen = {};
let total = 0;
FILES.forEach(function (f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP (not found):', f); return; }
  const src = fs.readFileSync(p, 'utf8');
  const ctx = { window: {}, console: console };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch (e) { console.log('SKIP (parse error):', f, e.message); return; }
  const sites = ctx.window.SITES || [];
  let added = 0;
  sites.forEach(function (s) {
    if (!s || !s.name || s.lat == null || s.lng == null) return;
    total++;
    const key = s.name + '|' + (+s.lat).toFixed(3) + '|' + (+s.lng).toFixed(3);
    if (seen[key]) return;
    seen[key] = 1;
    const region = shortRegion(s.region);
    const theme = s.theme || s.ty || '';
    const desc = cleanDesc(s.desc);
    all.push([s.name, s.label || s.name, region, s.city || '', s.county || '', theme, s.flag || '', s.lat, s.lng, desc].join('|'));
    added++;
  });
  console.log('OK:', f, '→', added, '站');
});

// 稳定排序：按省份 + 名称
all.sort();

const out = 'window.NATION_SITES_RAW=' + JSON.stringify(all.join('\n')) + ';';
fs.writeFileSync(path.join(ROOT, 'nation-index.js'), out, 'utf8');
console.log('\n总站点:', all.length, '(原始累计', total + ')');
console.log('索引体积:', (out.length / 1024).toFixed(1), 'KB');
