var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var flagged = [];
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  (ctx.window.SITES||[]).forEach(function(s){
    if(!s || !s.name) return;
    if(/[mh]/.test(s.flag||'')) flagged.push({file:f, name:s.name, region:s.region, city:s.city||'', flag:s.flag, desc:(s.desc||'').length});
  });
});
console.log('必去/网红总数:', flagged.length);
var m = flagged.filter(function(x){return /m/.test(x.flag);});
var h = flagged.filter(function(x){return /h/.test(x.flag);});
console.log('必去(m):', m.length, '| 网红(h):', h.length, '| 两者: ', flagged.length - m.length - h.length + flagged.filter(function(x){return /m/.test(x.flag)&&/h/.test(x.flag);}).length);
// desc 短的优先
flagged.sort(function(a,b){ return a.desc - b.desc; });
console.log('\n=== desc 最短的必去/网红（前 40）===');
flagged.slice(0,40).forEach(function(s){ console.log('['+s.file.replace('-data.js','').replace('data.js','sx')+'] '+s.name+' ('+s.flag+') desc='+s.desc+'字'); });
