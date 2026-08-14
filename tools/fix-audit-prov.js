/* 修正 loadProvince：PROV_FILE 精确映射 + window.SITES 快照/恢复 */
const fs = require('fs');
let s = fs.readFileSync('topic-common.js', 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP tc:' + tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK   tc:' + tag);
}

/* 1. PROV_FILE 精确映射（region 短名 → 数据文件） */
rep(
  `  var PROV_FILE = {
    '北京':'bj','天津':'tj','河北':'he','山西':'sx','内蒙古':'nmg','辽宁':'ln','吉林':'jl','黑龙江':'hlj',
    '上海':'sh','江苏':'js','浙江':'zj','安徽':'ah','福建':'fj','江西':'cz','山东':'sd','河南':'ha','湖北':'hb',
    '湖南':'hn','广东':'gd','广西':'gy','海南':'hi','重庆':'cq','四川':'sc','贵州':'gz','云南':'gy','西藏':'xz',
    '陕西':'sx2','甘肃':'gs','青海':'qh','宁夏':'nx','新疆':'xj','香港':'hk','澳门':'mo','台湾':'tw'
  };`,
  `  var PROV_FILE = {
    '北京':'bj-data.js','天津':'tj-data.js','河北':'he-data.js','山西':'data.js','内蒙古':'nmg-data.js',
    '辽宁':'ln-data.js','吉林':'jl-data.js','黑龙江':'hlj-data.js','上海':'sh-data.js','江苏':'js-data.js',
    '浙江':'zj-data.js','安徽':'ah-data.js','福建':'fj-data.js','江西':'changzheng-data.js','山东':'sd-data.js',
    '河南':'ha-data.js','湖北':'hb-data.js','湖南':'hn-data.js','广东':'gd-data.js','广西':'gxyn-data.js',
    '海南':'hi-data.js','重庆':'cq-data.js','四川':'sc-data.js','贵州':'gz-data.js','云南':'gxyn-data.js',
    '西藏':'xz-data.js','陕西':'sx-data.js','甘肃':'gs-data.js','青海':'qh-data.js','宁夏':'nx-data.js',
    '新疆':'xj-data.js','香港':'hk-data.js','澳门':'mo-data.js','台湾':'tw-data.js'
  };`,
  '1.prov map exact'
);

/* 2. loadProvince：快照 + 恢复全局 + loading 状态 */
rep(
  `  function loadProvince(key, cb) {
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
  }`,
  `  function loadProvince(file, cb) {
    if (provLoaded[file]) { cb(); return; }
    provLoaded[file] = 1; /* loading 中 */
    var base = window.SITES.slice(); /* 快照（加载前全局，防省文件覆盖） */
    var s2 = document.createElement('script');
    s2.src = file;
    s2.onload = function () {
      var prov = window.SITES || [];
      window.SITES = base; /* 恢复全局（省文件会覆盖 window.SITES） */
      prov.forEach(function (x) {
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
    s2.onerror = function () { provLoaded[file] = 2; cb(); };
    document.head.appendChild(s2);
  }`,
  '2.loadProvince snapshot'
);

/* 3. ensureDetail 传文件名 */
rep(
  `    var k = PROV_FILE[s.region];
    if (!k || provLoaded[k] === 2) { if (cb) cb(); return; }
    loadProvince(k, cb);`,
  `    var k = PROV_FILE[s.region];
    if (!k || provLoaded[k] === 2) { if (cb) cb(); return; }
    loadProvince(k, cb);`,
  '3.ensureDetail (unchanged)'
);

fs.writeFileSync('topic-common.js', s, 'utf8');
console.log('=== prov fixes:', n, '===');
