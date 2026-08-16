var fs = require('fs');
var vm = require('vm');
var path = require('path');
var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];
var all = [];
var seen = {};
var total = 0;
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
    all.push({ file: f, name: s.name, label: s.label, region: s.region, lat: s.lat, lng: s.lng, desc: s.desc||'', flag: s.flag||'', theme: s.theme||s.ty||'' });
  });
});

// 1. desc 长度分布
var lens = { '<10':0, '10-20':0, '20-40':0, '40-80':0, '>=80':0 };
var shortDesc = [];
all.forEach(function(s){
  var d = (s.desc||'').length;
  if(d < 10) lens['<10']++;
  else if(d < 20) lens['10-20']++;
  else if(d < 40) lens['20-40']++;
  else if(d < 80) lens['40-80']++;
  else lens['>=80']++;
  if(d < 20) shortDesc.push(s);
});
console.log('=== 站点总数:', total, '===');
console.log('desc 长度分布:', JSON.stringify(lens));
console.log('desc < 20 字的景点数:', shortDesc.length);

// 2. flag 缺失
var noFlag = all.filter(function(s){ return !s.flag || !/[mh]/.test(s.flag); });
var hasM = all.filter(function(s){ return /m/.test(s.flag||''); });
var hasH = all.filter(function(s){ return /h/.test(s.flag||''); });
console.log('无必去/网红标识:', noFlag.length, '| 必去(m):', hasM.length, '| 网红(h):', hasH.length);

// 3. 重复检测（同名）
var nameCount = {};
all.forEach(function(s){ var k = s.name; nameCount[k] = (nameCount[k]||0)+1; });
var dupNames = Object.keys(nameCount).filter(function(k){ return nameCount[k] > 1; });
console.log('完全同名重复的景点名数:', dupNames.length, '(涉及', dupNames.reduce(function(a,k){return a+nameCount[k];},0), '条)');

// 4. 近坐标重复（不同名但坐标<500m）
var nearDup = 0;
for(var i=0;i<all.length;i++){
  for(var j=i+1;j<all.length;j++){
    var a=all[i], b=all[j];
    if(a.lat==null||b.lat==null) continue;
    var dLat=Math.abs(a.lat-b.lat), dLng=Math.abs(a.lng-b.lng);
    if(dLat<0.004 && dLng<0.005){ nearDup++; }
  }
}
console.log('近坐标(约<500m)重复对:', nearDup);

// 输出短介绍样例（前 30 条）
console.log('\n=== desc 过短样例（前30）===');
shortDesc.slice(0,30).forEach(function(s){
  console.log('[' + s.file + '] ' + s.name + ' | ' + (s.desc||'(空)'));
});
