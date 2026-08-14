/* topic.html：nation 专题改用轻量索引（按省懒加载详情）——适配 8-14 新版 loader */
const fs = require('fs');
let t = fs.readFileSync('topic.html', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "  loadScript(cfg.dataJs, function () {\n    if (cfg.routesKey) { loadScript('routes-data.js', function () { if (cfg.foodJs) loadScript(cfg.foodJs, boot); else boot(); }); }\n    else if (cfg.foodJs) loadScript(cfg.foodJs, boot);\n    else boot();\n  });";
const to = "  /* 全国页懒加载（审核修复）：轻量索引渲染 + 节点详情按省按需补充 */\n  function loadNationIndex() {\n    loadScript('nation-index.js?v=20260815', function () {\n      window.SITES = (window.NATION_SITES_RAW || '').split('\\n').map(function (line) {\n        var p = line.split('|');\n        return { name: p[0], label: p[1], region: p[2], city: p[3], county: p[4], theme: p[5], flag: p[6], lat: +p[7], lng: +p[8] };\n      });\n      window.SITES_LAZY = true;\n      boot();\n    });\n  }\n  if (cfg.dataJs === 'nation-data.js') loadNationIndex();\n  else loadScript(cfg.dataJs, function () {\n    if (cfg.routesKey) { loadScript('routes-data.js', function () { if (cfg.foodJs) loadScript(cfg.foodJs, boot); else boot(); }); }\n    else if (cfg.foodJs) loadScript(cfg.foodJs, boot);\n    else boot();\n  });";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic.html', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('OK   topic.html nation lazy (v2)');
} else {
  console.log('SKIP again, dumping loader region');
  const i = t.indexOf('loadScript(cfg.dataJs');
  console.log(JSON.stringify(t.slice(i - 30, i + 320)));
}
