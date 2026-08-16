var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var total=0, hasM=0, hasH=0, both=0, none=0;
var flagVals = {};
var samples = { m:[], h:[], both:[], none:[] };
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  (ctx.window.SITES||[]).forEach(function(s){
    if(!s || !s.name) return;
    total++;
    var fl = s.flag || '';
    flagVals[fl] = (flagVals[fl]||0)+1;
    var m = /m/.test(fl), h = /h/.test(fl);
    if(m && h){ both++; if(samples.both.length<5) samples.both.push(s.name+' flag='+JSON.stringify(fl)); }
    else if(m){ hasM++; if(samples.m.length<8) samples.m.push(s.name+' flag='+JSON.stringify(fl)); }
    else if(h){ hasH++; if(samples.h.length<8) samples.h.push(s.name+' flag='+JSON.stringify(fl)); }
    else { none++; if(samples.none.length<5) samples.none.push(s.name+' flag='+JSON.stringify(fl)); }
  });
});
console.log('总站点:', total);
console.log('必去(m):', hasM, '| 网红(h):', hasH, '| 两者(both):', both, '| 无标识(none):', none);
console.log('\nflag 取值分布:', JSON.stringify(flagVals));
console.log('\n必去样例:', samples.m.join(' | '));
console.log('网红样例:', samples.h.join(' | '));
console.log('both样例:', samples.both.join(' | '));
console.log('无标识样例:', samples.none.join(' | '));
