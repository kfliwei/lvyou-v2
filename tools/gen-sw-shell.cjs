/* tools/gen-sw-shell.cjs — 自动生成 sw.js 预缓存 SHELL 清单
 * 用法：node tools/gen-sw-shell.cjs（新增页面/文件后重新运行）
 * 扫描：全部 *.html + 核心 js/css + vendor/leaflet + art/*.svg + icons + manifest
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const swPath = path.join(dir, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
/* 扫描页面 */
const pages = fs.readdirSync(dir).filter(f => /\.html$/.test(f)).sort();
/* 核心 JS（根目录，排除数据文件——数据走 RUNTIME SWR） */
const CORE_JS = ['theme.js', 'travel-notes.js', 'results.js', 'vault.js', 'quotes.js', 'topic-meta.js', 'topic-common.js', 'wishlist.js', 'geo.js', 'poster.js', 'tiles.js', 'topic-counts.js', 'routes-data.js', 'food.js', 'food-gxyn.js'].filter(f => fs.existsSync(path.join(dir, f)));
/* art 封面 */
const art = fs.readdirSync(path.join(dir, 'art')).filter(f => /\.svg$/.test(f)).sort().map(f => "'./art/" + f + "'");
const shell = [
  "'./'",
  ...pages.map(p => "'./" + p + "'"),
  ...CORE_JS.map(f => "'./" + f + "'"),
  "'./design.css'", "'./map.css'",
  "'./vendor/leaflet/leaflet.css'", "'./vendor/leaflet/leaflet.js'",
  "'./images/icon.svg'", "'./manifest.webmanifest'",
  ...art
];
const block = 'var SHELL = [\n  ' + shell.join(',\n  ') + '\n];';
const re = /var SHELL = \[[\s\S]*?\];/;
if (!re.test(sw)) { console.log('MISS: sw.js 无 SHELL 块'); process.exit(1); }
const next = sw.replace(re, block);
fs.writeFileSync(swPath, next);
console.log('生成 SHELL：' + shell.length + ' 项');
console.log('页面 ' + pages.length + ' | 核心JS ' + CORE_JS.length + ' | art ' + art.length);
