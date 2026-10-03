/* gen-tickets.js — 票价种子生成器（营业时间来自高德 v5，票价字段保留人工维护值）
 * 用法: node tools/gen-tickets.js --names "晋祠,故宫,西湖" [--city 城市]
 * 行为: 逐个 v5 搜索+详情 → 取 business.opentime_week → 合并进 site-tickets.js SEED；
 *       已有条目的 p/u（人工票价）原样保留，只更新 h。QPS 间隔 350ms。可重复跑（幂等）。 */
const fs = require('fs');
const vm = require('vm');
const argv = process.argv.slice(2);
const ni = argv.indexOf('--names');
const NAMES = (ni >= 0 ? argv[ni + 1] : '').split(',').map(s => s.trim()).filter(Boolean);
if (!NAMES.length) { console.log('用法: node tools/gen-tickets.js --names "晋祠,故宫"'); process.exit(1); }

const kc = { window: {} };
vm.createContext(kc);
vm.runInContext(fs.readFileSync('tn-key.js', 'utf8'), kc);
const KEY = kc.window.__TN_AMAP_KEY__;
if (!KEY) { console.error('tn-key.js 无 __TN_AMAP_KEY__'); process.exit(1); }

/* 从索引取城市/坐标（同名异地保护） */
const ic = { window: {} };
vm.createContext(ic);
vm.runInContext(fs.readFileSync('nation-index.js', 'utf8'), ic);
const indexRows = ic.window.NATION_SITES_RAW.split('\n').filter(Boolean).map(l => l.split('|'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = p => fetch('https://restapi.amap.com/v5/' + p + '&key=' + KEY).then(r => r.json());

(async () => {
  const out = {};
  for (const name of NAMES) {
    const row = indexRows.find(p => p[0] === name) || indexRows.find(p => p[0].indexOf(name) === 0);
    if (!row) { console.log('SKIP(索引无): ' + name); continue; }
    const lat = +row[7], lng = +row[8], city = row[3] || row[2];
    try {
      const s = await q('place/text?keywords=' + encodeURIComponent(name) + '&city=' + encodeURIComponent(city) + '&citylimit=true');
      if (s.status !== '1' || !s.pois.length) { console.log('FAIL(搜索): ' + name); await sleep(350); continue; }
      const poi = s.pois.find(p => { const l = (p.location || '').split(',').map(Number); return l.length === 2 && Math.abs(l[0] - lng) < 0.2 && Math.abs(l[1] - lat) < 0.2; });
      if (!poi) { console.log('SKIP(异地同名): ' + name + ' → ' + s.pois[0].name); await sleep(350); continue; }
      const d = await q('place/detail?id=' + poi.id + '&show_fields=business');
      const b = d.status === '1' && d.pois && d.pois[0] ? (d.pois[0].business || {}) : {};
      out[name] = { h: b.opentime_week || b.opentime_today || '', p: '', u: '' };
      console.log((out[name].h ? 'OK  ' : 'EMPTY ') + name + ' → ' + (out[name].h || '（高德未收录营业时间）').slice(0, 70));
    } catch (e) { console.log('ERR ' + name + ': ' + e.message.slice(0, 60)); }
    await sleep(350);
  }
  /* 合并进 site-tickets.js：保留既有条目的 p/u（人工票价），只更新 h */
  const file = fs.readFileSync('site-tickets.js', 'utf8');
  const m = file.match(/var SEED = (window\.SITE_TICKETS_SEED \|\| \{\});/);
  let seed = {};
  try { seed = JSON.parse(file.match(/SITE_TICKETS_SEED = (\{[\s\S]*?\});/)[1].replace(/,(\s*[}\]])/g, '$1')); } catch (e) {}
  for (const k of Object.keys(out)) seed[k] = Object.assign({}, seed[k], { h: out[k].h });
  const body = JSON.stringify(seed, null, 2).replace(/^/, '');
  const next = file.replace(/var SEED = window\.SITE_TICKETS_SEED \|\| \{\};/, 'var SEED = window.SITE_TICKETS_SEED = ' + body + ';');
  /* 自检后再写盘 */
  const chk = { window: {} };
  vm.createContext(chk);
  vm.runInContext(next, chk);
  const cnt = Object.keys(chk.window.SITE_TICKETS_SEED).length;
  if (cnt !== Object.keys(seed).length) { console.error('自检失败'); process.exit(1); }
  fs.writeFileSync('site-tickets.js', next);
  console.log('site-tickets.js 更新: ' + cnt + ' 条种子');
})();
