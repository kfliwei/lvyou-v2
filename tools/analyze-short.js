var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var empty = 0, ultraShort = [];
var byFile = {};
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  (ctx.window.SITES||[]).forEach(function(s){
    if(!s || !s.name) return;
    var d = (s.desc||'').trim();
    var len = d.length;
    if(len === 0) empty++;
    else if(len < 10) ultraShort.push({file:f, name:s.name, desc:d});
    byFile[f] = byFile[f] || {total:0, short:0};
    byFile[f].total++;
    if(len < 20) byFile[f].short++;
  });
});
console.log('desc 为空的景点数:', empty);
console.log('desc < 10 字的景点数:', ultraShort.length);
console.log('\n=== desc < 10 字样例（前40）===');
ultraShort.slice(0,40).forEach(function(s){ console.log('['+s.file.replace('-data.js','').replace('data.js','sx')+'] '+s.name+' => "'+s.desc+'"'); });
console.log('\n=== 各文件 desc<20字 占比（最差的10个）===');
Object.keys(byFile).map(function(f){return {f:f, total:byFile[f].total, short:byFile[f].short, r:(byFile[f].short/byFile[f].total*100).toFixed(0)};})
  .sort(function(a,b){return b.r-a.r;}).slice(0,10)
  .forEach(function(x){ console.log(x.f.replace('-data.js','').replace('data.js','sx')+': '+x.short+'/'+x.total+' ('+x.r+'%)'); });
