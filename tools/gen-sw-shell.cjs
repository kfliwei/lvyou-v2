/* tools/gen-sw-shell.cjs — 自动生成 sw.js 预缓存 SHELL 清单
 * 用法：node tools/gen-sw-shell.cjs（新增页面/文件后重新运行）
 * 扫描：全部 *.html + 核心 js/css + vendor/leaflet + art/*.svg + icons + manifest
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const swPath = path.join(dir, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
/* 扫描页面（开发/演示页不进离线壳） */
const pages = fs.readdirSync(dir).filter(f => /\.html$/.test(f) && !/^(test-|icons-demo)/.test(f)).sort();
/* 核心 JS（根目录） */
const CORE_JS = ['theme.js', 'travel-notes.js', 'results.js', 'vault.js', 'quotes.js', 'topic-meta.js', 'topic-common.js', 'wishlist.js', 'geo.js', 'poster.js', 'tiles.js', 'topic-counts.js', 'food.js', 'food-gxyn.js', 'ui.js', 'node-lod.js', 'nation-index.js', 'nav.js', 'icons.js', 'album.js', 'planner.js', 'backup.js', 'sync-webdav.js', 'share.js'].filter(f => fs.existsSync(path.join(dir, f)));
/* 数据 JS 也在 SHELL 里预缓存（离线全站可查是产品行为，不是疏漏）。
   生成器曾经只列核心 JS，跑一次就把 34 个省的 data/food 从 SHELL 里抹掉——所以这里显式扫回来。 */
const DATA_JS = fs.readdirSync(dir).filter(f => /\.js$/.test(f) && (
  /-data\.js$/.test(f) || /-food\.js$/.test(f) || ['data.js', 'topic-catalog.js', 'topic-meta-lite.js', 'site-images.js', 'site-images-local.js', 'site-tickets.js'].includes(f)
)).sort();
/* art 封面 */
const art = fs.readdirSync(path.join(dir, 'art')).filter(f => /\.svg$/.test(f)).sort().map(f => "'./art/" + f + "'");
/* 分组拼串：注释必须独占一行且不带逗号。把注释当数组元素拼进去，两个逗号之间就是
 * 空位（hole），cache.addAll 会拿到 undefined 直接炸——所以这里逐行拼、注释不接逗号。 */
const groups = [
  { items: ["'./'", ...pages.map(p => "'./" + p + "'"), ...CORE_JS.map(f => "'./" + f + "'")] },
  { note: '/* ---- 各省数据/美食（预缓存，离线开箱可用） ---- */',
    items: DATA_JS.map(f => "'./" + f + "'") },
  { items: ["'./design.css'", "'./map.css'",
    "'./vendor/leaflet/leaflet.css'", "'./vendor/leaflet/leaflet.js'", "'./vendor/pako.min.js'",
    "'./images/icon.svg'", "'./manifest.webmanifest'"] },
  { note: '/* ---- 主题插图 ---- */', items: art }
];
let body = '';
groups.forEach(g => {
  if (g.note) body += '  ' + g.note + '\n';
  body += g.items.map(x => '  ' + x + ',').join('\n') + '\n';
});
const block = 'var SHELL = [\n' + body + '];';
const count = groups.reduce((n, g) => n + g.items.length, 0);
const re = /var SHELL = \[[\s\S]*?\];/;
if (!re.test(sw)) { console.log('MISS: sw.js 无 SHELL 块'); process.exit(1); }
/* 缓存版本自动 bump（trace-vN → trace-vN+1） */
const verRe = /var CACHE = 'trace-v(\d+)';/;
const vm_ = sw.match(verRe);
const ver = vm_ ? 'trace-v' + (parseInt(vm_[1], 10) + 1) : 'trace-v1';
let next = sw.replace(re, block).replace(verRe, "var CACHE = '" + ver + "';");
fs.writeFileSync(swPath, next);
console.log('生成 SHELL：' + count + ' 项，缓存版本：' + ver);
console.log('页面 ' + pages.length + ' | 核心JS ' + CORE_JS.length + ' | art ' + art.length);
