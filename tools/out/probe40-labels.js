/* 批次 40 范围证明：这一改在屏幕上动了多少颗标签（不跑浏览器，只按产品口径离线复算）
   两问：① 配置侧有几个名字被别名表改了口（＝chip/图例文字变了）；
        ② 新加的「本页零命中就不造这颗 chip」守卫撤掉了几颗。 */
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
run('topic-meta.js');
const W = ctx.window, ALIAS = W.THEME_ALIAS, REG = W.TOPIC_REGISTRY;
const norm = t => ALIAS[t] || t;

let pages = 0, renamed = 0, dropped = 0, collided = 0, noData = [];
const lines = [];
for (const k of Object.keys(REG)) {
  const t = REG[k];
  if (!t || !t.themes) continue;
  const order = t.themeOrder || Object.keys(t.themes);
  let sites = [];
  try {
    /* 同一个沙箱跑 36 页：不清空就会拿着上一页的景点判这一页的零命中 */
    W.SITES = null;
    run(t.dataJs);
    /* 全国页走 topic.html 的懒加载口径：数据是 nation-index.js 里那一根竖线串，
       产品侧 split 后才成 window.SITES——探针不照抄这一步就会读到 undefined，
       于是整页主题全被判成「零命中要撤 chip」，那是探针的锅不是产品的。 */
    sites = W.SITES || (t.p === 'nation'
      ? (W.NATION_SITES_RAW || '').split('\n').map(l => { const p = l.split('|'); return { theme: p[5] }; })
      : []);
  } catch (e) { sites = []; }
  const key = t.themeKey || 'theme';
  if (!sites.length) noData.push(k);
  const rn = order.filter(x => norm(x) !== x);
  const canon = [];
  order.forEach(x => { const n = norm(x); if (canon.indexOf(n) < 0) canon.push(n); });
  const coll = order.length - canon.length;
  const zero = canon.filter(n => !sites.some(s => norm(s[key]) === n));
  if (!rn.length && !zero.length && !coll) { pages++; continue; }
  pages++; renamed += rn.length; dropped += zero.length; collided += coll;
  lines.push('  ' + k.padEnd(12) + ' 改名字 ' + rn.length + (rn.length ? ' [' + rn.map(x => x + '→' + norm(x)).join('、') + ']' : '')
    + '｜撤 chip ' + zero.length + (zero.length ? ' [' + zero.join('、') + ']' : '')
    + (coll ? '｜撞名并掉 ' + coll : ''));
}
console.log('有配置页 ' + pages + '｜配置侧名字被别名表改口 ' + renamed + ' 处｜零命中守卫撤掉 ' + dropped + ' 颗｜撞名并掉 ' + collided + ' 颗');
console.log('探针读不到数据的页（这些页的「撤 chip」不算数）: ' + (noData.length ? noData.join('、') : '无'));
lines.forEach(l => console.log(l));
