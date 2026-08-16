var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
// 同文件内：同名 OR (坐标<150m 且 名字去掉括号后缀后相同)
var trueDup = [];
FILES.forEach(function(f){
  var p = path.join(__dirname, '..', f);
  if(!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch(e){ return; }
  var arr = (ctx.window.SITES||[]).filter(function(s){return s && s.name;});
  for(var i=0;i<arr.length;i++){
    for(var j=i+1;j<arr.length;j++){
      var a=arr[i], b=arr[j];
      if(a.name === b.name){ trueDup.push({file:f, a:a.name, b:b.name, why:'同名'}); continue; }
      if(a.lat==null||b.lat==null) continue;
      var dLat=Math.abs(a.lat-b.lat), dLng=Math.abs(a.lng-b.lng);
      if(dLat<0.0013 && dLng<0.0015){
        // 名字归一（去括号/后缀）
        var na=String(a.name).replace(/[（(].*?[)）]/g,'').trim();
        var nb=String(b.name).replace(/[（(].*?[)）]/g,'').trim();
        if(na===nb) trueDup.push({file:f, a:a.name, b:b.name, why:'同点近名'});
      }
    }
  }
});
console.log('=== 同文件内真重复（应删除其一）===');
console.log('总数:', trueDup.length);
trueDup.forEach(function(d){ console.log('['+d.file.replace('-data.js','').replace('data.js','sx')+'] "'+d.a+'" vs "'+d.b+'" ('+d.why+')'); });
