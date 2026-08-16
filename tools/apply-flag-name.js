/* tools/apply-flag-name.js — 按景点名定位，批量补标 flag（必去 m / 网红 h）
 * 用法: node tools/apply-flag-name.js [patchFile]
 * 读取 flag-patches.js（window.FLAG_PATCHES = { 文件名: { 景点名: 'm'|'h'|'mh' } }）
 * 在 "name" 字段后插入或覆盖 "flag" 字段。
 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var patchFile = path.join(__dirname, process.argv[2] || 'flag-patches.js');
if (!fs.existsSync(patchFile)) { console.error('缺少 ' + (process.argv[2] || 'flag-patches.js')); process.exit(1); }
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(patchFile, 'utf8'), ctx);
var PATCHES = ctx.window.FLAG_PATCHES || {};

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

var total = 0, miss = 0, over = 0;
Object.keys(PATCHES).forEach(function (f) {
  var p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP (not found):', f); return; }
  var src = fs.readFileSync(p, 'utf8');
  var done = 0;
  Object.keys(PATCHES[f]).forEach(function (name) {
    var newFlag = PATCHES[f][name];
    // 匹配 name 字段 + 其后可选的现有 flag 字段
    var re = new RegExp('("name"\\s*:\\s*"' + escRe(name) + '"\\s*,)(\\s*"flag"\\s*:\\s*"[^"]*"\\s*,)?', 'g');
    var matched = false, replaced = false;
    src = src.replace(re, function (m, p1, p2) {
      matched = true;
      if (p2) { replaced = true; over++; }
      return p1 + '"flag":"' + newFlag + '",';
    });
    if (matched) done++; else { miss++; console.log('  ✗ 未匹配 name:', f, '->', name); }
  });
  fs.writeFileSync(p, src, 'utf8');
  total += done;
  console.log('OK:', f, '补标', done, '条');
});
console.log('\n共补标', total, '条' + (miss ? '，未匹配 ' + miss + ' 条' : '') + (over ? '，覆盖已有 ' + over + ' 条' : ''));
