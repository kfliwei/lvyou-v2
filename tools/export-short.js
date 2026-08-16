var fs = require('fs');
var vm = require('vm');
var path = require('path');
var target = process.argv[2]; // 文件名，如 hk-data.js
if(!target){ console.log('用法: node tools/export-short.js <file>'); process.exit(1); }
var p = path.join(__dirname, '..', target);
var src = fs.readFileSync(p, 'utf8');
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
var out = (ctx.window.SITES||[]).filter(function(s){ return s && s.name && (s.desc||'').trim().length < 20; })
  .map(function(s){ return { name: s.name, theme: s.theme||s.ty||'', old: (s.desc||'').trim() }; });
var fname = 'short-' + target.replace('.js','') + '.json';
fs.writeFileSync(path.join(__dirname,'..','tools',fname), JSON.stringify(out, null, 0), 'utf8');
console.log(target, '短介绍', out.length, '个 -> tools/' + fname);
// 打印全部（name | old）
out.forEach(function(x){ console.log(x.name + ' || ' + x.old); });
