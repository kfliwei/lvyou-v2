/* tools/patch-sw.js — SW 缓存升级 v12：预缓存新增数据文件 + ui.js + nation-index.js */
const fs = require('fs');
const p = 'sw.js';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('trace-v12')) {
  s = s.replace('trace-v11', 'trace-v12');
  const add = [
    "  './routes-data.js',",
    "  './ui.js',",
    "  './nation-index.js',",
    "  './bj-data.js',",
    "  './tj-data.js',",
    "  './he-data.js',",
    "  './ha-data.js',",
    "  './sd-data.js',",
    "  './ln-data.js',",
    "  './jl-data.js',",
    "  './hlj-data.js',",
    "  './sh-data.js',",
    "  './js-data.js',",
    "  './zj-data.js',",
    "  './ah-data.js',",
    "  './fj-data.js',",
    "  './jx-data.js',",
    "  './gd-data.js',",
    "  './hi-data.js',",
    "  './hk-data.js',",
    "  './mo-data.js',",
    "  './tw-data.js',",
    ''
  ].join('\n');
  s = s.replace("  './routes-data.js',\n", add);
  if (!s.includes('./ui.js')) s = s.replace("  './routes-data.js',\r\n", add);
  fs.writeFileSync(p, s, 'utf8');
  console.log('sw.js upgraded to v12 + shell files added');
} else {
  console.log('already v12');
}
