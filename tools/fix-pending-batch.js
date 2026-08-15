/* 未做项推进批次：①haversine钳制 ②esc引号+XSS拼接 ④tripEmpty空态 ⑤定位失败选点兜底 ⑨SW自动bump */
const fs = require('fs');
function patch(file, subs) {
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  let n = 0;
  subs.forEach(function (it) {
    if (s.includes(it[0])) { s = s.split(it[0]).join(it[1]); n++; console.log('OK  ', file, '|', it[2]); }
    else console.log('SKIP', file, '|', it[2]);
  });
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  return n;
}

/* ① review.html haversine 钳制 */
patch('review.html', [
  [
    "  return 2 * R * Math.asin(Math.sqrt(s));",
    "  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));",
    '1 haversine clamp'
  ]
]);

/* ⑤ index.html 定位失败 → 地图选点兜底 */
patch('index.html', [
  [
    "    var fb = function () { tip('无法获取位置：请进入专题地图，点地图上的地点记录'); };",
    "    var fb = function () {\n      tip('无法获取位置');\n      if (window.UI && UI.confirm) {\n        UI.confirm({ title: '定位失败', text: '无法获取当前位置。可到全国地图点选一个地点，开始你的第一段记录。', okText: '去地图选点', cancelText: '取消' }, function (ok) { if (ok) location.href = 'topic.html?p=nation'; });\n      }\n    };",
    '5 locate fallback'
  ]
]);

/* ④ tripEmpty 空态显示（无记录时展示插画引导） */
patch('index.html', [
  [
    "      document.getElementById('tripFull').style.display = 'none';\n      document.getElementById('tripEmpty').style.display = 'none';\n      document.getElementById('tripbarEmpty').style.display = 'block';\n      return;",
    "      document.getElementById('tripFull').style.display = 'none';\n      document.getElementById('tripEmpty').style.display = 'block';\n      document.getElementById('tripbarEmpty').style.display = 'none';\n      return;",
    '4 tripEmpty shown'
  ]
]);

/* ② topic-common esc 引号转义 + 4 处拼接转义 */
patch('topic-common.js', [
  [
    "  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }",
    "  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }",
    '2a esc quotes'
  ]
]);
patch('topic-common.js', [
  [
    "'<img loading=\"lazy\" src=\"' + s.img + '\" alt=\"' + s.label + '\" onerror",
    "'<img loading=\"lazy\" src=\"' + s.img + '\" alt=\"' + esc(s.label) + '\" onerror",
    '2b img alt'
  ],
  [
    "'<div class=\"body\"><div class=\"nm\">' + s.label + (s.flag && s.flag.ind",
    "'<div class=\"body\"><div class=\"nm\">' + esc(s.label) + (s.flag && s.flag.ind",
    '2c list nm'
  ],
  [
    "'<div class=\"ds\">' + s.desc + (s.best ? ('　『最佳 ' + s.best + '』') : '') +",
    "'<div class=\"ds\">' + esc(s.desc) + (s.best ? ('　『最佳 ' + esc(s.best) + '』') : '') +",
    '2d list ds'
  ]
]);
patch('topic-common.js', [
  [
    "row.innerHTML = '<div class=\"t\">' + rs + '</div><div><div class=\"n\">' + s.label",
    "row.innerHTML = '<div class=\"t\">' + esc(rs) + '</div><div><div class=\"n\">' + esc(s.label)",
    '2e tl row'
  ]
]);

/* ⑨ gen-sw-shell.cjs：CORE_JS 补 ui/node-lod/nation-index + 版本自动 bump */
patch('tools/gen-sw-shell.cjs', [
  [
    "const CORE_JS = ['theme.js', 'travel-notes.js', 'results.js', 'vault.js', 'quotes.js', 'topic-meta.js', 'topic-common.js', 'wishlist.js', 'geo.js', 'poster.js', 'tiles.js', 'topic-counts.js', 'routes-data.js', 'food.js', 'food-gxyn.js'].filter(f => fs.existsSync(path.join(dir, f)));",
    "const CORE_JS = ['theme.js', 'travel-notes.js', 'results.js', 'vault.js', 'quotes.js', 'topic-meta.js', 'topic-common.js', 'wishlist.js', 'geo.js', 'poster.js', 'tiles.js', 'topic-counts.js', 'routes-data.js', 'food.js', 'food-gxyn.js', 'ui.js', 'node-lod.js', 'nation-index.js'].filter(f => fs.existsSync(path.join(dir, f)));",
    '9a core js'
  ],
  [
    "const next = sw.replace(re, block);",
    "/* 缓存版本自动 bump（trace-vN → trace-vN+1） */\nconst verRe = /var CACHE = 'trace-v(\\d+)';/;\nconst vm_ = sw.match(verRe);\nconst ver = vm_ ? 'trace-v' + (parseInt(vm_[1], 10) + 1) : 'trace-v1';\nlet next = sw.replace(re, block).replace(verRe, \"var CACHE = '\" + ver + \"';\");",
    '9b auto bump'
  ],
  [
    "console.log('生成 SHELL：' + shell.length + ' 项');",
    "console.log('生成 SHELL：' + shell.length + ' 项，缓存版本：' + ver);",
    '9c log'
  ]
]);

console.log('=== pending batch done ===');
