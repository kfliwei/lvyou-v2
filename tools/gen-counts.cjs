/* tools/gen-counts.cjs — 生成专题计数 topic-counts.js
 * 用法：node tools/gen-counts.cjs（数据扩充后重新运行）
 * 原理：统计各数据文件 window.SITES = [ 数组中 {"name": 出现次数
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const MAP = {
  cz: 'changzheng-data.js',
  gy: 'gxyn-data.js',
  qt: 'qz-data.js',
  sx: 'data.js',
  sc: 'sc-data.js',
  gs: 'gs-data.js',
  xj: 'xj-data.js',
  gz: 'gz-data.js'
};
const out = {};
let okAll = true;
for (const k of Object.keys(MAP)) {
  const f = MAP[k];
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log('MISS FILE ' + f); okAll = false; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const idx = s.indexOf('window.SITES =');
  if (idx < 0) { console.log('MISS VAR SITES in ' + f); okAll = false; continue; }
  const seg = s.slice(idx);
  const n = (seg.match(/\{"name":/g) || []).length;
  out[k] = n;
}
if (!okAll) { console.log('存在缺失，未写出'); process.exit(1); }
const content = '/* =========================================================\n' +
  ' * topic-counts.js — 专题景点计数（自动生成）\n' +
  ' * 生成：node tools/gen-counts.cjs（数据扩充后重新运行，勿手改）\n' +
  ' * 供 index.html 首页专题卡片计数使用\n' +
  ' * ========================================================= */\n' +
  'window.TOPIC_COUNTS = ' + JSON.stringify(out, null, 2) + ';\n';
fs.writeFileSync(path.join(dir, 'topic-counts.js'), content);
console.log('生成 topic-counts.js:');
console.log(content);
