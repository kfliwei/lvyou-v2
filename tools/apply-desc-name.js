/* tools/apply-desc-name.js — 按景点名定位，批量写回 desc
 * 用法: node tools/apply-desc-name.js
 * 读取同目录 desc-patches.js（window.DESC_PATCHES = { 文件名: { 景点名: 新desc } }），
 * 用正则定位 "name":"景点名" 后的 "desc":"..." 并替换。
 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var patchFile = path.join(__dirname, process.argv[2] || 'desc-patches.js');
if (!fs.existsSync(patchFile)) { console.error('缺少 ' + (process.argv[2] || 'desc-patches.js')); process.exit(1); }
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(patchFile, 'utf8'), ctx);
var PATCHES = ctx.window.DESC_PATCHES || {};

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

var total = 0, miss = 0;
Object.keys(PATCHES).forEach(function (f) {
  var p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP (not found):', f); return; }
  var src = fs.readFileSync(p, 'utf8');
  var done = 0;
  Object.keys(PATCHES[f]).forEach(function (name) {
    var newDesc = PATCHES[f][name];
    var re = new RegExp('("name":\\s*"' + escRe(name) + '"[^{}]*?"desc":\\s*")([^"]*)(")', 'g');
    var matched = false;
    src = src.replace(re, function (m, p1, p2, p3) { matched = true; return p1 + newDesc + p3; });
    if (matched) done++; else { miss++; console.log('  ✗ 未匹配 name:', f, '->', name); }
  });
  fs.writeFileSync(p, src, 'utf8');
  total += done;
  console.log('OK:', f, '补全', done, '条');
});
console.log('\n共补全', total, '条' + (miss ? '，未匹配 ' + miss + ' 条' : ''));
