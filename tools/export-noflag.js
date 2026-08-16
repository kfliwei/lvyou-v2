var fs = require('fs');
var vm = require('vm');
var path = require('path');
var target = process.argv[2];
if(!target){ console.log('用法: node tools/export-noflag.js <file>'); process.exit(1); }
var p = path.join(__dirname, '..', target);
var src = fs.readFileSync(p, 'utf8');
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
var out = (ctx.window.SITES||[]).filter(function(s){ return s && s.name && !/[mh]/.test(s.flag||''); })
  .map(function(s){ return s.name; });
console.log(target, '无标识', out.length, '个');
console.log(out.join(' | '));
