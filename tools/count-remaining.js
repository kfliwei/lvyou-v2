var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var byFile = {};
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  var short = (ctx.window.SITES||[]).filter(function(s){ return s && s.name && (s.desc||'').trim().length < 20; }).length;
  if (short > 0) byFile[f] = short;
});
var arr = Object.keys(byFile).map(function(f){ return {f:f, n:byFile[f]}; }).sort(function(a,b){ return b.n - a.n; });
console.log('剩余 desc<20 字的文件（按数量降序）:');
var total = 0;
arr.forEach(function(x){ total += x.n; console.log('  ' + x.f.replace('-data.js','').replace('data.js','sx') + ': ' + x.n); });
console.log('合计:', total);
