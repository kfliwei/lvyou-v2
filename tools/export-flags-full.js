var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var out = [];
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  (ctx.window.SITES||[]).forEach(function(s){
    if(!s || !s.name) return;
    if(!/[mh]/.test(s.flag||'')) return;
    if((s.desc||'').trim().length >= 20) return; // 只导出需要补全的
    out.push({f:f.replace('-data.js','').replace('data.js','sx'), name:s.name, region:s.region, theme:s.theme||s.ty||'', old:(s.desc||'').trim()});
  });
});
// 按文件分组排序
out.sort(function(a,b){ return a.f===b.f ? a.name.localeCompare(b.name,'zh') : a.f.localeCompare(b.f); });
fs.writeFileSync(path.join(__dirname,'..','tools','flag-todo.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('需补全的必去/网红:', out.length, '个，已写入 tools/flag-todo.json');
// 打印概览（按文件计数）
var cnt={};
out.forEach(function(x){cnt[x.f]=(cnt[x.f]||0)+1;});
console.log('按文件:', JSON.stringify(cnt));
