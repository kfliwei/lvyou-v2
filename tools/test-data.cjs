/* tools/test-data.cjs — 数据完整性校验：node tools/test-data.cjs
 * 校验项：
 *   1. 每个 *-data.js 的 SITES 数组可解析（容忍 /* 注释 *\/）、必填字段齐全、坐标合法、无重复
 *   2. nation-data.js 的 SITES 同样校验（3362 节点）
 *   3. 各省计数与 topic-counts.js 一致
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
/* 提取 window.X = [...] JSON 数组（括号匹配 + 剥离块注释） */
function extractArray(src, varName) {
  const idx = src.indexOf('window.' + varName + ' =');
  if (idx < 0) return null;
  const start = src.indexOf('[', idx);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
function validateSites(name, sites) {
  ok(name + ' 可解析且非空', Array.isArray(sites) && sites.length > 0, 'len=' + (sites && sites.length));
  if (!Array.isArray(sites) || !sites.length) return 0;
  const dup = new Set(), badCoord = [], noName = [], noTheme = [];
  sites.forEach(s => {
    if (!s || !s.name) noName.push(s && s.label);
    if (!s.theme && !s.ty) noTheme.push(s && s.name);
    if (s.lat == null || s.lng == null || isNaN(+s.lat) || isNaN(+s.lng) || +s.lat < 3 || +s.lat > 56 || +s.lng < 70 || +s.lng > 140) badCoord.push(s && s.name);
    const k = s.name + '|' + s.lat + '|' + s.lng;
    if (dup.has(k)) badCoord.push('重复:' + s.name);
    dup.add(k);
  });
  ok(name + ' 名称齐全', noName.length === 0, noName.slice(0, 3).join(','));
  ok(name + ' 主题齐全', noTheme.length === 0, noTheme.slice(0, 3).join(','));
  ok(name + ' 坐标合法且无重复', badCoord.length === 0, badCoord.slice(0, 3).join(','));
  return sites.length;
}
function parseArray(file, varName) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) { ok(file + ' 文件存在', false); return null; }
  const src = fs.readFileSync(p, 'utf8');
  const arrText = extractArray(src, varName);
  if (!arrText) { ok(file + ' 提取 ' + varName, false); return null; }
  const clean = arrText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  try { return JSON.parse(clean); } catch (e) { ok(file + ' JSON 可解析', false, e.message.slice(0, 60)); return null; }
}
/* ---- 1. 各省 + 专题数据文件 ---- */
const DATA_FILES = ['data.js', 'changzheng-data.js', 'gxyn-data.js', 'qz-data.js', 'sc-data.js', 'gs-data.js', 'xj-data.js', 'gz-data.js', 'qh-data.js', 'xz-data.js', 'nmg-data.js', 'hn-data.js', 'hb-data.js', 'cq-data.js', 'nx-data.js'];
const counts = {};
DATA_FILES.forEach(f => {
  const sites = parseArray(f, 'SITES');
  if (sites) counts[f] = validateSites(f, sites);
});
/* ---- 2. nation-data.js（window.SITES，3362 节点） ---- */
const ns = parseArray('nation-data.js', 'SITES');
if (ns) {
  validateSites('nation-data', ns);
  ok('nation 节点数 >= 3000', ns.length >= 3000, 'len=' + ns.length);
  const noProv = ns.filter(s => !s.province).length;
  ok('nation 省份字段齐全', noProv === 0, '缺省=' + noProv);
}
/* ---- 3. 与 topic-counts.js 一致性 ---- */
const tcPath = path.join(dir, 'topic-counts.js');
if (fs.existsSync(tcPath)) {
  const tcSrc = fs.readFileSync(tcPath, 'utf8');
  const m = tcSrc.match(/window\.TOPIC_COUNTS = (\{[\s\S]*?\});/);
  if (m) {
    const tc = JSON.parse(m[1]);
    const map = { cz: 'changzheng-data.js', gy: 'gxyn-data.js', qt: 'qz-data.js', sx: 'data.js', sc: 'sc-data.js', gs: 'gs-data.js', xj: 'xj-data.js', gz: 'gz-data.js' };
    Object.keys(map).forEach(k => {
      const f = map[k];
      ok('计数一致 ' + k, tc[k] === counts[f], 'topic-counts=' + tc[k] + ' 实际=' + counts[f]);
    });
  } else { ok('topic-counts 可解析', false); }
} else { ok('topic-counts.js 存在', false); }
console.log('--- ' + pass + ' passed, ' + fail + ' failed ---');
process.exit(fail ? 1 : 0);
