/* tools/split-nation.js — 从 nation-data.js 提取轻量索引 nation-index.js
 * 紧凑行格式（管道分隔，键名只出现一次），供 search.html 快速加载。
 * 用法: node tools/split-nation.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'nation-data.js');
const outPath = path.join(__dirname, '..', 'nation-index.js');
const src = fs.readFileSync(srcPath, 'utf8');

const ctx = { window: {}, console: console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const sites = ctx.window.NATION_SITES || ctx.NATION_SITES || ctx.window.SITES || ctx.SITES;
if (!Array.isArray(sites) || !sites.length) {
  console.error('FAIL: cannot locate site array in nation-data.js');
  process.exit(1);
}

/* 字段顺序: name,label,region,city,county,theme,flag,lat,lng（desc/wiki/img 等详情字段不进索引） */
const KEYS = ['name', 'label', 'region', 'city', 'county', 'theme', 'flag', 'lat', 'lng'];
const lines = sites.map(function (s) {
  return KEYS.map(function (k) {
    var v = s[k];
    if (v == null) return '';
    v = String(v);
    return v.indexOf('|') >= 0 ? v.replace(/\|/g, ' ') : v;
  }).join('|');
});

const out = 'window.NATION_SITES_RAW=' + JSON.stringify(lines.join('\n')) + ';';
fs.writeFileSync(outPath, out, 'utf8');

const inMB = (src.length / 1048576).toFixed(2);
const outMB = (out.length / 1048576).toFixed(2);
console.log('sites:', sites.length, '| nation-data.js:', inMB, 'M chars -> nation-index.js:', outMB, 'M chars (', (out.length / src.length * 100).toFixed(0) + '% )');
