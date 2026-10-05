/* b13-bands.js — 枚举压在 #mapEl 上的浮层，逐条给「成带判定」的实际数字
 *
 * 为什么单独量这个：可用区口径（产品侧 usableInsets 与闸门侧）都靠「哪些浮层算带」这一条，
 * 而 60% 这条线是拍出来的。routeBanner max-width:62vw、region-stats max-width:92vw、
 * tabbar 满宽——差一档就是把顶带误判成点（首轮探针就这么把 269px 宽的顶带扣成左内缩 281）。
 *
 * 用法：NODE_PATH=… node tools/out/b13-bands.js [id…]        VP=452x995 可切档
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const PORT = 8166;
const BASE = 'http://localhost:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(d); });
});
const SNAP = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const out = [];
  [].slice.call(document.querySelectorAll('body *')).forEach(function (el) {
    if (el.contains(mapEl) || mapEl.contains(el)) return;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') return;
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    const zi = parseInt(cs.zIndex || '0', 10);
    if (zi < 100) return;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) return;
    const ix = Math.max(0, Math.min(r.right, mr.right) - Math.max(r.left, mr.left));
    const iy = Math.max(0, Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top));
    if (ix * iy < 4000) return;
    out.push({
      t: (el.id || el.className || el.tagName).toString().split(' ')[0].slice(0, 24),
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
      zi: zi, spanW: +(ix / mr.width).toFixed(3), spanH: +(iy / mr.height).toFixed(3),
      band: (ix / mr.width) >= 0.6 ? 'h' : ((iy / mr.height) >= 0.6 ? 'v' : 'spot'),
      rel: [Math.round(r.left - mr.left), Math.round(r.top - mr.top), Math.round(r.right - mr.left), Math.round(r.bottom - mr.top)]
    });
  });
  return { mr: [Math.round(mr.width), Math.round(mr.height)], overlays: out };
})()`;
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  const vp = (process.env.VP || '452x995').split('x').map(Number);
  await page.setViewport({ width: vp[0], height: vp[1], deviceScaleFactor: 2 });
  for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : ['sx', 'nation'])) {
    try {
      await page.goto(`${BASE}/topic.html?p=${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await sleep(6000);
      const s = await page.evaluate(SNAP);
      console.log(`\n=== p=${id} @${vp[0]}×${vp[1]} 地图元素 ${s.mr[0]}×${s.mr[1]} ===`);
      s.overlays.sort((a, b) => (a.band === b.band ? 0 : a.band === 'spot' ? 1 : -1)).forEach(o =>
        console.log(`  ${o.band.padEnd(4)} z${String(o.zi).padEnd(5)} 占宽 ${String(o.spanW).padEnd(6)} 占高 ${String(o.spanH).padEnd(6)} 相对元素 ${o.rel.join('/')}  ${o.sel.slice(0, 52)}`));
    } catch (e) { console.log(`p=${id} FAIL ${String(e).slice(0, 120)}`); }
  }
  await browser.close();
  server.close();
})();
