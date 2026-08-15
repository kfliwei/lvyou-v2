/* gen-site-count.js — 统计真实数据并更新各处硬编码数字 */
const fs = require('fs');
const vm = require('vm');

/* 统计 */
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-data.js', 'utf8'), ctx);
const sites = ctx.window.NATION_SITES || ctx.window.SITES || [];
const siteCount = sites.length;

const mctx = { window: {}, console };
vm.createContext(mctx);
vm.runInContext(fs.readFileSync('topic-meta.js', 'utf8'), mctx);
const reg = mctx.window.TOPIC_REGISTRY || {};
const topicCount = Object.keys(reg).length;
let routeCount = 0;
Object.keys(reg).forEach(k => { if (reg[k].routes && reg[k].routes.length) routeCount++; });

/* 风味数：food 文件合计 */
let foodCount = 0;
const foodFiles = ['food.js', 'food-gxyn.js'].filter(f => fs.existsSync(f));
foodFiles.forEach(f => {
  const fc = { window: {}, console };
  vm.createContext(fc);
  try { vm.runInContext(fs.readFileSync(f, 'utf8'), fc); const fl = fc.window.FOOD || fc.FOOD || []; foodCount += fl.length; } catch (e) {}
});
/* 各省 food 文件（gx-* -food.js 等） */
fs.readdirSync('.').filter(f => /-food\.js$/.test(f) && !foodFiles.includes(f)).forEach(f => {
  const fc = { window: {}, console };
  vm.createContext(fc);
  try { vm.runInContext(fs.readFileSync(f, 'utf8'), fc); foodCount += (fc.window.FOOD || fc.FOOD || []).length; } catch (e) {}
});
/* 省数 */
const provs = {};
sites.forEach(s => { if (s.province) provs[s.province] = 1; });
const provCount = Object.keys(provs).length;

console.log('节点:', siteCount, '| 专题:', topicCount, '| 省:', provCount, '| 风味:', foodCount, '| 路线:', routeCount);

/* 更新 index.html */
let idx = fs.readFileSync('index.html', 'utf8');
const idxCrlf = idx.includes('\r\n');
if (idxCrlf) idx = idx.replace(/\r\n/g, '\n');
let n1 = 0;
const p1 = 'placeholder="搜索全部景点（7782 处）"';
const t1 = 'placeholder="搜索全部景点（' + siteCount + ' 处）"';
if (idx.includes(p1)) { idx = idx.split(p1).join(t1); n1++; }
const p2 = "d:'7782 处景点 · 31 省专题地图 · 搜索直达，山川湖海一键抵达'";
const t2 = "d:'" + siteCount + " 处景点 · " + topicCount + " 省专题地图 · 搜索直达，山川湖海一键抵达'";
if (idx.includes(p2)) { idx = idx.split(p2).join(t2); n1++; }
fs.writeFileSync('index.html', idxCrlf ? idx.replace(/\n/g, '\r\n') : idx, 'utf8');
console.log('index 更新:', n1, '处');

/* 更新 explore-map.html */
let em = fs.readFileSync('explore-map.html', 'utf8');
const emCrlf = em.includes('\r\n');
if (emCrlf) em = em.replace(/\r\n/g, '\n');
const p3 = '19 专题 · 6700+ 处 · 34 省 · 561 道风味 · 63 条路线';
const t3 = topicCount + ' 专题 · ' + siteCount + ' 处 · ' + provCount + ' 省 · ' + foodCount + ' 道风味 · ' + routeCount + ' 条路线';
if (em.includes(p3)) { em = em.split(p3).join(t3); fs.writeFileSync('explore-map.html', emCrlf ? em.replace(/\n/g, '\r\n') : em, 'utf8'); console.log('explore-map 更新'); }
else console.log('explore-map 文案未匹配');
/* 探索页搜索框 placeholder（伪搜索框） */
const p4 = '🔍 搜索全部景点（7782 处）';
const t4 = '🔍 搜索全部景点（' + siteCount + ' 处）';
if (em.includes(p4)) { em = em.split(p4).join(t4); fs.writeFileSync('explore-map.html', emCrlf ? em.replace(/\n/g, '\r\n') : em, 'utf8'); console.log('explore-map 搜索框更新'); }
else console.log('explore-map 搜索框未匹配');
