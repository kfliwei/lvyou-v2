/* 去重执行：A 类同名重复（自动，保留更完整条目）+ B 类真重复（人工甄别清单）
 * 规则：删除指定 name 的条目；同名重复保留 flag/desc/wiki 更完整的一条
 */
const fs = require('fs');
const path = require('path');
const dir = 'F:/MyAi/trace/lvyou-v2';

/* B 类：{ 文件: [要删除的 name, ...] }（人工甄别的真重复，保留另一条） */
const B = {
  'nx-data.js': ['石嘴山沙湖', '火石寨国家地质公园', '中卫寺口子峡谷'],
  'qh-data.js': ['大通老爷山', '仙米国家森林公园', '热贡艺术（同仁）'],
  'qingzang-data.js': ['大通老爷山', '仙米国家森林公园', '热贡艺术（同仁）', '波密桃花谷', '勒布沟门巴风情'],
  'xz-data.js': ['波密桃花谷', '勒布沟门巴风情'],
  'hb-data.js': ['归元禅寺', '宜昌三峡大坝', '恩施屏山峡谷', '宜昌三峡人家风景区'],
  'sh-data.js': ['上海明珠塔'],
  'changzheng-data.js': ['于都（中央红军长征出发地纪念园）', '泸定桥（飞夺泸定桥）', '会宁会师旧址（会师楼）'],
  'nmg-data.js': ['乌兰布统', '莫尔道嘎', '三盛公水利枢纽'],
  'cq-data.js': ['江津四面山', '江津中山古镇', '南川金佛山'],
  'bj-data.js': ['中国科技馆新馆'],
  'sc-data.js': ['恩阳红色古镇'],
  'sx-data.js': ['安康瀛湖'],
  'gz-data.js': ['安顺镇宁夜郎洞溶洞', '铜仁思南石林公园']
};

function processFile(fp, delNames) {
  const buf = fs.readFileSync(fp);
  let txt;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('gbk').decode(buf); }
  const vm = require('vm');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(txt, ctx);
  const sites = ctx.window.SITES || [];
  const before = sites.length;

  /* A 类：同名重复，保留更完整一条（flag 优先 > desc 长度 > wiki 长度 > 先出现） */
  const nameIdx = {};
  sites.forEach((s, i) => { (nameIdx[s.name] = nameIdx[s.name] || []).push(i); });
  const dupNames = Object.keys(nameIdx).filter(k => nameIdx[k].length > 1);
  dupNames.forEach(n => {
    const idxs = nameIdx[n];
    let keep = idxs[0];
    idxs.forEach(i => {
      const a = sites[i];
      const score = (a.flag ? 1 : 0) * 100 + (a.desc || '').length + (a.wiki || '').length;
      const ks = (sites[keep].flag ? 1 : 0) * 100 + (sites[keep].desc || '').length + (sites[keep].wiki || '').length;
      if (score > ks) keep = i;
    });
    idxs.forEach(i => { if (i !== keep) sites[i] = null; });
  });

  /* B 类：删除清单 */
  delNames.forEach(n => {
    sites.forEach((s, i) => { if (s && s.name === n) sites[i] = null; });
  });

  const removed = sites.filter(s => s === null).length;
  const kept = sites.filter(Boolean);
  if (!removed) return { file: path.basename(fp), before, after: before, removed: 0, note: '无变化' };

  /* 重建 JS 文本：只替换 SITES 数组部分 */
  const start = txt.indexOf('window.SITES');
  const arrStart = txt.indexOf('[', start);
  const arrEnd = txt.indexOf(']', arrStart);
  // 找到数组结束的 '];' —— 从 arrStart 做括号匹配
  let depth = 0, end = -1;
  for (let i = arrStart; i < txt.length; i++) {
    if (txt[i] === '[') depth++;
    else if (txt[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  const newArr = JSON.stringify(kept, null, 1).replace(/\n/g, '\n');
  txt = txt.slice(0, arrStart) + newArr + txt.slice(end + 1);
  fs.writeFileSync(fp, txt, 'utf8');
  return { file: path.basename(fp), before, after: kept.length, removed, note: '' };
}

const report = [];
Object.keys(B).forEach(f => report.push(processFile(path.join(dir, f), B[f])));
/* A 类自动去重也应用到所有文件 */
const files = fs.readdirSync(dir).filter(f => /-data\.js$/.test(f) && !/^(nation|test)/.test(f) && !B[f]);
files.forEach(f => report.push(processFile(path.join(dir, f), [])));

report.forEach(r => {
  if (r.removed) console.log((r.file + ': ').padEnd(20) + '删 ' + r.removed + ' 条 (' + r.before + ' → ' + r.after + ')' + (r.note ? ' ' + r.note : ''));
});
console.log('完成');
