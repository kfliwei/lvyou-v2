/* 审核修复批次 2：nation 专题按省懒加载（3MB → 0.63MB 首屏，点击节点按省补详情） */
const fs = require('fs');

/* ===== topic.html 启动器：nation 改用 nation-index.js 轻量加载 ===== */
let t = fs.readFileSync('topic.html', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "  loadScript(cfg.dataJs, function () {\n    if (cfg.routesKey) { loadScript('routes-data.js', function () { R = window.TOPIC_ROUTES || {}; if (cfg.foodJs) loadScript(cfg.foodJs, boot); else boot(); }); }\n    else if (cfg.foodJs) loadScript(cfg.foodJs, boot);\n    else boot();\n  });";
const to = "  /* 全国页懒加载（审核修复）：加载轻量索引渲染，节点详情按省按需补充 */\n  function loadNationIndex() {\n    loadScript('nation-index.js?v=20260815', function () {\n      window.SITES = (window.NATION_SITES_RAW || '').split('\\n').map(function (line) {\n        var p = line.split('|');\n        return { name: p[0], label: p[1], region: p[2], city: p[3], county: p[4], theme: p[5], flag: p[6], lat: +p[7], lng: +p[8] };\n      });\n      window.SITES_LAZY = true;\n      boot();\n    });\n  }\n  if (cfg.dataJs === 'nation-data.js') loadNationIndex();\n  else loadScript(cfg.dataJs, function () {\n    if (cfg.routesKey) { loadScript('routes-data.js', function () { R = window.TOPIC_ROUTES || {}; if (cfg.foodJs) loadScript(cfg.foodJs, boot); else boot(); }); }\n    else if (cfg.foodJs) loadScript(cfg.foodJs, boot);\n    else boot();\n  });";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic.html', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('OK   topic.html nation lazy');
} else {
  console.log('SKIP topic.html (loader pattern changed)');
}

/* ===== topic-common.js：ensureDetail 按省补详情 ===== */
let s = fs.readFileSync('topic-common.js', 'utf8');
const crlf2 = s.includes('\r\n');
if (crlf2) s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from2, to2, tag) {
  if (!s.includes(from2)) { console.log('SKIP tc:' + tag); return; }
  s = s.split(from2).join(to2);
  n++;
  console.log('OK   tc:' + tag);
}

/* 1. 省文件映射 + ensureDetail（插到 openSheet 前） */
rep(
  '  function openSheet(i) {',
  `  /* ---------- 全国页按省懒加载详情（审核修复批次 2） ---------- */
  var PROV_FILE = {
    '北京':'bj','天津':'tj','河北':'he','山西':'sx','内蒙古':'nmg','辽宁':'ln','吉林':'jl','黑龙江':'hlj',
    '上海':'sh','江苏':'js','浙江':'zj','安徽':'ah','福建':'fj','江西':'cz','山东':'sd','河南':'ha','湖北':'hb',
    '湖南':'hn','广东':'gd','广西':'gy','海南':'hi','重庆':'cq','四川':'sc','贵州':'gz','云南':'gy','西藏':'xz',
    '陕西':'sx2','甘肃':'gs','青海':'qh','宁夏':'nx','新疆':'xj','香港':'hk','澳门':'mo','台湾':'tw'
  };
  var provLoaded = {};
  function loadProvince(key, cb) {
    if (provLoaded[key]) { cb(); return; }
    var s2 = document.createElement('script');
    s2.src = key + '-data.js';
    s2.onload = function () {
      provLoaded[key] = 1;
      var full = window.SITES || [];
      var keys = Object.keys(full);
      (window.SITES || []).forEach(function (x) {
        if (!x.desc) return;
        for (var i = 0; i < SITES.length; i++) {
          if (SITES[i].name === x.name && !SITES[i].desc) {
            SITES[i].desc = x.desc; SITES[i].best = x.best; SITES[i].img = x.img;
            SITES[i].dy = x.dy; SITES[i].ty = x.ty;
          }
        }
      });
      cb();
    };
    s2.onerror = function () { provLoaded[key] = 2; cb(); };
    document.head.appendChild(s2);
  }
  function ensureDetail(s, cb) {
    if (!s || s.desc || !window.SITES_LAZY) { if (cb) cb(); return; }
    var k = PROV_FILE[s.region];
    if (!k || provLoaded[k] === 2) { if (cb) cb(); return; }
    loadProvince(k, cb);
  }
  function openSheet(i) {`,
  '1.ensureDetail'
);

/* 2. openSheet 里补详情后刷新面板 */
rep(
  `  function openSheet(i) {
    curSite = i;
    $('lsBody').innerHTML = buildSheet(i);
    $('locSheet').classList.add('show');
    setActiveNode(i);`,
  `  function openSheet(i) {
    curSite = i;
    $('lsBody').innerHTML = buildSheet(i);
    $('locSheet').classList.add('show');
    setActiveNode(i);
    /* 全国页：按省懒加载详情后刷新面板 */
    var _s0 = SITES[i];
    if (_s0 && window.SITES_LAZY && !_s0.desc) {
      ensureDetail(_s0, function () { refreshSheet(); });
    }`,
  '2.openSheet lazy'
);

fs.writeFileSync('topic-common.js', crlf2 ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('=== batch2 tc patches:', n, '===');
