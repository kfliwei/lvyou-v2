/* tools/gen-site-images.js — 高德 POI 照片批量抓取 → site-images.js
 * 用法: $env:AMAP_KEY="你的高德Web服务Key"; node tools/gen-site-images.js [limit]
 * 范围: 必去(m)/网红(h) 节点优先；limit 默认 300（按需调整）
 */
const fs = require('fs');
const vm = require('vm');
const KEY = process.env.AMAP_KEY || '';
if (!KEY) { console.log('请设置环境变量 AMAP_KEY（高德 Web 服务 Key）'); process.exit(1); }
const LIMIT = parseInt(process.argv[2] || '300', 10);

/* 读节点 */
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('nation-data.js', 'utf8'), ctx);
const sites = ctx.window.NATION_SITES || ctx.window.SITES || [];
/* 优先必去/网红 */
const pri = sites.filter(s => s.flag && s.flag.indexOf('m') >= 0);
const sec = sites.filter(s => s.flag && s.flag.indexOf('h') >= 0);
const rest = sites.filter(s => !s.flag || (s.flag.indexOf('m') < 0 && s.flag.indexOf('h') < 0));
const ordered = pri.concat(sec, rest).slice(0, LIMIT);

/* 高德 POI 搜索（extensions=all 带 photos） */
function fetchPhoto(s) {
  const url = 'https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(KEY) +
    '&keywords=' + encodeURIComponent(s.name) + '&city=' + encodeURIComponent(s.city || '') +
    '&offset=1&page=1&extensions=all';
  return fetch(url).then(r => r.json()).then(d => {
    if (d && d.status === '1' && d.pois && d.pois[0]) {
      const p = d.pois[0];
      const ph = (p.photos && p.photos[0] && p.photos[0].url) || '';
      return { id: s.id, name: s.name, url: ph };
    }
    return { id: s.id, name: s.name, url: '' };
  }).catch(() => ({ id: s.id, name: s.name, url: '' }));
}

(async () => {
  const out = {};
  let done = 0, hit = 0;
  const CONC = 5;
  for (let i = 0; i < ordered.length; i += CONC) {
    const batch = ordered.slice(i, i + CONC);
    const results = await Promise.all(batch.map(fetchPhoto));
    results.forEach(r => {
      if (r.url) { out[r.id] = r.url; hit++; }
    });
    done += batch.length;
    if (done % 50 === 0) console.log('进度', done, '/', ordered.length, '命中', hit);
  }
  fs.writeFileSync('site-images.js', 'window.SITE_IMAGES=' + JSON.stringify(out) + ';\n', 'utf8');
  console.log('完成: 处理', done, '命中', hit, '→ site-images.js');
})();
