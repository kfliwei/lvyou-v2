/* tools/dedupe-data.cjs — 数据去重：node tools/dedupe-data.cjs
 * 只删除 name|lat|lng 完全重复的条目（保留第一条），不改变其他内容与格式段
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
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
const FILES = ['data.js', 'changzheng-data.js', 'gxyn-data.js', 'qz-data.js', 'sc-data.js', 'gs-data.js', 'xj-data.js', 'gz-data.js', 'qh-data.js', 'xz-data.js', 'nmg-data.js', 'hn-data.js', 'hb-data.js', 'cq-data.js', 'nx-data.js', 'nation-data.js'];
let totalRemoved = 0;
FILES.forEach(f => {
  const p = path.join(dir, f);
  const src = fs.readFileSync(p, 'utf8');
  const arrText = extractArray(src, 'SITES');
  if (!arrText) { console.log('SKIP ' + f + ' (无 SITES 数组)'); return; }
  const clean = arrText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  let sites;
  try { sites = JSON.parse(clean); } catch (e) { console.log('SKIP ' + f + ' (解析失败)'); return; }
  const seen = new Set();
  const uniq = sites.filter(s => {
    const k = s.name + '|' + s.lat + '|' + s.lng;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const removed = sites.length - uniq.length;
  if (removed > 0) {
    fs.writeFileSync(p, src.replace(arrText, JSON.stringify(uniq)));
    totalRemoved += removed;
    console.log('去重 ' + f + ': ' + removed + ' 条（' + sites.length + ' → ' + uniq.length + '）');
  } else {
    console.log('OK   ' + f + ' 无重复（' + sites.length + ' 条）');
  }
});
console.log('共移除重复: ' + totalRemoved + ' 条');
