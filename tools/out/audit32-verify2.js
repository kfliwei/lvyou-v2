/* tools/out/audit32-verify2.js — 复核 ui-audit 那份视觉报告的每一条 file:line
   判据同 audit32-verify.js：needle 必须落在声明行 ±2 内。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const C = [
  ['results.js', 23, 'function flash(msg)', 'toast私货1'],
  ['poster.js', 25, 'function flash(msg)', 'toast私货2'],
  ['vault.js', 249, 'function flash(msg)', 'toast私货3'],
  ['index.html', 402, 'var tip = function', 'toast私货4'],
  ['topic-common.js', 332, 'rgba(31,122,90', '外来绿tip'],
  ['wishlist.html', 122, 'DAY_COLORS', '旧色板'],
  ['wishlist.html', 115, "'名山大川'", '40键色表'],
  ['travel-map.html', 416, "'#71806C'", '旧绿'],
  ['travel-map.html', 435, "L.polyline(linePts", '轨迹写死'],
  ['topic-common.js', 384, '#5F7A4E', '废弃绿'],
  ['album-edit.html', 46, '#B3543C', 'danger漂移'],
  ['nav.js', 28, 'rgba(200,109,75', '旧主色辉光'],
  ['nav.js', 32, '#B4593A', '暗色FAB渐变'],
  ['me.html', 14, 'rgba(200,109,75', '旧主色辉光2'],
  ['travel-notes.js', 330, '#1f3634', '面板复刻旧板'],
  ['review.html', 140, '.ws-item:hover', 'hover未包'],
  ['review.html', 155, '.cal-head .nav button:hover', 'hover未包2'],
  ['review.html', 164, '.md-item:hover', 'hover未包3'],
  ['planner.html', 15, '.card:hover', 'hover未包4'],
  ['share.html', 35, '.day-card:hover', 'hover未包5'],
  ['results.js', 417, '正在写故事', 'emoji态1'],
  ['results.js', 476, '⏳', 'emoji态2'],
  ['topic-common.js', 1274, '⏹', 'emoji态3'],
  ['travel-map.html', 822, '⏳', 'emoji态4'],
  ['travel-notes.js', 854, '⏸', 'emoji播放'],
  ['results.js', 244, 'Songti SC', '系统字体名'],
  ['results.js', 382, 'Songti SC', '系统字体名2'],
  ['results.js', 461, 'Songti SC', '系统字体名3'],
  ['expense.html', 71, 'z-index:9500', '野层级1'],
  ['trip.html', 86, 'z-index:9500', '野层级2'],
  ['node-manager.html', 35, 'z-index:9500', '野层级3'],
  ['travel-notes.js', 336, 'z-index:9000', '面板层级'],
  ['album-edit.html', 108, '.ui-toast', '本地重写toast'],
  ['wishlist.html', 26, '#ECEFEA', '软绿无token'],
  ['results.js', 242, 'rgba(32,32,29,.5)', '遮罩三浓度'],
  ['planner.js', 1463, 'rgba(20,16,12,.45)', '遮罩第三值'],
  ['planner.js', 1470, '0 -8px 30px', '阴影不用token'],
  ['results.js', 261, 'id="fgo"', '主按钮手写色'],
  ['wishlist.html', 144, 'divIcon', '标记写死色'],
  ['node-manager.html', 142, 'tr-user', '节点徽标绿'],
  ['story.html', 160, '#9C9A92', '分站圆点'],
  ['wishlist.html', 140, 'if (!list.length) return;', '地图空态'],
  ['md-manager.html', 420, '<img', '缩略图无alt'],
  ['story.html', 137, '<img', '故事图无alt'],
  ['travel-notes.js', 1926, 'max-width:46%', '详情照片条'],
  ['results.js', 328, 'max-width:46%', '工坊照片条'],
  ['review.html', 611, 'zoomPhotoIdx', '对照：review接了放大'],
  ['topic-catalog.js', 24, 'ring:', '专题环色表'],
  ['topic-common.js', 1490, '#3E7CB1', '渐变外来色'],
  ['album.html', 36, '#F4F1E7', '封面暖字漂移'],
  ['travel-map.html', 146, '.statClose', '旧muted'],
  ['results.js', 176, 'PingFang SC', '导出文档系统字体'],
  ['travel-notes.js', 343, 'var(--r-sm,8px)', '兜底漂移'],
  ['review.html', 197, '←', '返回裸字符'],
  ['me.html', 89, '←', '返回裸字符2'],
  ['settings.html', 83, '←', '返回裸字符3'],
  ['icons.js', 1, '<symbol', '对照：sprite 里有箭头吗'],
  ['ui.js', 61, 'confirm', '对照：UI.confirm 存在'],
];
const cache = {};
function read(f) { if (!cache[f]) cache[f] = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/) : null; return cache[f]; }
const out = [];
let hit = 0, drift = 0, miss = 0;
C.forEach(function (c) {
  const f = c[0], ln = c[1], nd = c[2], tag = c[3];
  const L = read(f);
  if (!L) { out.push('NOFILE  ' + tag + '  ' + f); return; }
  let ok = false;
  for (let i = Math.max(0, ln - 3); i < Math.min(L.length, ln + 2); i++) if (L[i].indexOf(nd) >= 0) ok = true;
  const found = [];
  for (let i = 0; i < L.length; i++) if (L[i].indexOf(nd) >= 0 && found.length < 8) found.push(i + 1);
  if (ok) { out.push('HIT     ' + tag + '  ' + f + ':' + ln + '  «' + nd + '»  全文出现行 ' + found.join(',')); hit++; }
  else if (found.length) { out.push('DRIFT   ' + tag + '  声明 ' + f + ':' + ln + ' 实际 ' + found.join(',') + '  «' + nd + '»'); drift++; }
  else { out.push('MISS    ' + tag + '  ' + f + ':' + ln + ' 全文无 «' + nd + '»'); miss++; }
});
out.push('');
out.push('=== ui-audit 对账 命中' + hit + ' / 漂移' + drift + ' / 查无此串' + miss + ' / 共 ' + C.length + ' ===');
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'audit32-verify2.txt'), out.join('\n'));
console.log('written');
