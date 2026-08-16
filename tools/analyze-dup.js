var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var all = [];
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  (ctx.window.SITES||[]).forEach(function(s){
    if(!s || !s.name) return;
    all.push({ file: f, name: s.name, region: s.region, lat: s.lat, lng: s.lng, desc: s.desc||'' });
  });
});

// 同名重复：列出具体
var nameMap = {};
all.forEach(function(s){ (nameMap[s.name] = nameMap[s.name] || []).push(s); });
var dupNames = Object.keys(nameMap).filter(function(k){ return nameMap[k].length > 1; });
console.log('=== 完全同名重复（284 个名）分布 ===');
// 按"是否跨文件"分类
var crossFile = dupNames.filter(function(k){ var files={}; nameMap[k].forEach(function(s){files[s.file]=1;}); return Object.keys(files).length>1; });
var sameFile = dupNames.filter(function(k){ var files={}; nameMap[k].forEach(function(s){files[s.file]=1;}); return Object.keys(files).length===1; });
console.log('跨文件重复（同一景点出现在多个 data）:', crossFile.length, '个名');
console.log('同文件内重复:', sameFile.length, '个名');
console.log('\n跨文件重复样例（前20）:');
crossFile.slice(0,20).forEach(function(k){
  console.log('  ' + k + ' -> ' + nameMap[k].map(function(s){return s.file.replace('-data.js','').replace('data.js','sx');}).join(', '));
});
console.log('\n同文件内重复样例（前20）:');
sameFile.slice(0,20).forEach(function(k){
  console.log('  ' + k + ' -> ' + nameMap[k].map(function(s){return s.file.replace('-data.js','').replace('data.js','sx');}).join(', '));
});
