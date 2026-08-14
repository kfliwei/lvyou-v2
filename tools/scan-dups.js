/* 全面扫描所有专题数据文件的重复内容
 * A. 文件内同名重复（name 完全相同）
 * B. 文件内同坐标疑似重复（lat/lng 完全相等 + 名称相似）
 * C. 全国索引层同坐标重叠对（跨专题，仅报告）
 */
const fs = require('fs');
const path = require('path');
const dir = 'F:/MyAi/trace/lvyou-v2';
const files = fs.readdirSync(dir).filter(f => /-data\.js$/.test(f) && !/^(nation|test)/.test(f));

function readSites(fp) {
  const buf = fs.readFileSync(fp);
  let txt;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('gbk').decode(buf); }
  const m = txt.match(/window\.SITES\s*=\s*\[([\s\S]*?)\]\s*;\s*(?:window\.FOOD|$)/);
  if (!m) return null;
  // 用 vm 求值更可靠
  const vm = require('vm');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  try { vm.runInContext(txt, ctx); } catch (e) { console.log('  EVAL ERR', fp, e.message.slice(0, 80)); return null; }
  return ctx.window.SITES || [];
}

/* 名称归一化：去省市前缀与"景区/风景区/国家地质公园"等后缀，用于判断同一景点 */
function normName(n) {
  return String(n || '')
    .replace(/^(北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|香港|澳门|内蒙古|广西|西藏|宁夏|新疆)/, '')
    .replace(/(国家|国家级)?(风景名胜区|旅游景区|旅游度假区|森林公园|地质公园|自然保护区|风景区|景区|公园|博物馆|纪念馆|遗址公园|旧址|古村|古镇|古城|老街|大道|广场|大街|步行街|山|湖|河|江|岛|塔|寺|庙|宫|楼|园|洞|沟|谷|寨|镇|县|市|区|村|滩|湾|泉|关|桥|渠|陵|墓|窑|坊|街|港|口|站|亭|台|阁|祠|院|窟|峡|峰|岭|坡|坪|坝|塘|湾)$/g, '')
    .replace(/[·\s（）()]/g, '');
}

let totalA = 0, totalB = 0;
const crossPairs = [];

files.forEach(f => {
  const sites = readSites(path.join(dir, f));
  if (!sites || !sites.length) return;
  const byName = {}, byPos = {};
  sites.forEach((s, i) => {
    if (!s || !s.name) return;
    (byName[s.name] = byName[s.name] || []).push(i);
    if (s.lat != null && s.lng != null) {
      const k = (+s.lat).toFixed(4) + ',' + (+s.lng).toFixed(4);
      (byPos[k] = byPos[k] || []).push(i);
    }
  });
  const dupA = Object.keys(byName).filter(k => byName[k].length > 1);
  const dupB = [];
  Object.keys(byPos).forEach(k => {
    const idxs = byPos[k];
    if (idxs.length < 2) return;
    for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
      const A = sites[idxs[a]], B = sites[idxs[b]];
      if (A.name === B.name) continue; // 同名重复已归 A 类
      const na = normName(A.name), nb = normName(B.name);
      if (!na || !nb) continue;
      if (na === nb || na.includes(nb) || nb.includes(na)) {
        dupB.push({ a: A.name, b: B.name, themeA: A.theme, themeB: B.theme });
      }
    }
  });
  if (dupA.length || dupB.length) {
    console.log('===== ' + f + ' (' + sites.length + ' 条) =====');
    if (dupA.length) {
      console.log('  [同名重复 x' + dupA.length + ']');
      dupA.forEach(k => console.log('    ' + k + ' x' + byName[k].length));
    }
    if (dupB.length) {
      console.log('  [同坐标疑似重复 x' + dupB.length + ']');
      dupB.forEach(d => console.log('    "' + d.a + '"(' + (d.themeA || '') + ') ≡ "' + d.b + '"(' + (d.themeB || '') + ')'));
    }
    totalA += dupA.length;
    totalB += dupB.length;
  }
});

console.log('\n=== 汇总 ===');
console.log('同名重复组:', totalA, '| 同坐标疑似重复对:', totalB);

/* C. 全国索引层同坐标重叠（报告跨专题重复，供人工判断） */
const vm = require('vm');
const src = fs.readFileSync(path.join(dir, 'nation-data.js'), 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const sites = ctx.window.SITES || [];
const byPos = {};
sites.forEach((s, i) => {
  if (s.lat != null && s.lng != null) {
    const k = (+s.lat).toFixed(4) + ',' + (+s.lng).toFixed(4);
    (byPos[k] = byPos[k] || []).push(i);
  }
});
let crossN = 0;
Object.keys(byPos).forEach(k => {
  const idxs = byPos[k];
  if (idxs.length < 2) return;
  const names = idxs.map(i => sites[i].name);
  const ns = names.map(n => normName(n));
  for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
    if (ns[a] && ns[b] && (ns[a] === ns[b] || ns[a].includes(ns[b]) || ns[b].includes(ns[a]))) {
      crossPairs.push(names[a] + ' ≡ ' + names[b] + ' @' + k);
      crossN++;
    }
  }
});
console.log('\n=== 全国索引层同坐标疑似重复对:', crossN, '===');
crossPairs.slice(0, 40).forEach(p => console.log('  ' + p));
