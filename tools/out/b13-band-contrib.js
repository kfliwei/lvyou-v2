/* b13-band-contrib.js — 逐条浮层对「底部死带」的贡献（批次 13 变异 M4 归属的实测依据）
 *
 * 为什么量这个：mut-usable.js 的 M4「带名单里去掉 .tabbar」在浏览器侧没打红 U2。
 * 要么是「U2 那条对账是死的」，要么是「tabbar 的贡献本来就被 region-stats 盖住了」。
 * 这两者必须分开：前者要修闸，后者要把 M4 的归属改成源码侧，并换一条真能红的带变异。
 *
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/b13-band-contrib.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8191', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const PROBE = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const out = [];
  ['.routeBanner', '.region-stats', '.tabbar', '.tripbar.open'].forEach(function (sel) {
    [].slice.call(document.querySelectorAll(sel)).forEach(function (n) {
      const cs = getComputedStyle(n);
      const rr = n.getBoundingClientRect();
      const ix = Math.max(0, Math.min(rr.right, mr.right) - Math.max(rr.left, mr.left));
      const iy = Math.max(0, Math.min(rr.bottom, mr.bottom) - Math.max(rr.top, mr.top));
      out.push({
        sel: sel, disp: cs.display, vis: cs.visibility, op: cs.opacity,
        top: Math.round(rr.top), bottom: Math.round(rr.bottom), h: Math.round(rr.height),
        widthRatio: +(ix / mr.width).toFixed(3),
        /* 这条带单独贡献的底内缩（闸门同一算法：mr.bottom − rr.top） */
        bottomIn: Math.round(Math.max(0, mr.bottom - rr.top)),
        spans: ix / mr.width >= 0.6
      });
    });
  });
  const TE = window.TopicEngine;
  const i = TE && TE.usableInsets ? TE.usableInsets() : null;
  return { el: [Math.round(mr.left), Math.round(mr.top), Math.round(mr.width), Math.round(mr.height)], bands: out, prod: i };
})()`;

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new' });
  for (const [w, h, tag] of [[452, 995, '452×995'], [390, 844, '390×844']]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_layer', 'amapStreet'); } catch (e) {} });
    await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const s = await page.evaluate(PROBE);
    console.log('### ' + tag + '  元素=' + s.el.join('/') + '  产品内缩(上右下左)=' + JSON.stringify(s.prod));
    s.bands.forEach(b => {
      console.log('  ' + b.sel.padEnd(15) + ' display=' + b.disp.padEnd(6) + ' op=' + b.op +
        ' 顶/底=' + b.top + '/' + b.bottom + ' 高=' + b.h +
        ' 占宽=' + b.widthRatio + (b.spans ? '（成带）' : '（不成带）') +
        ' 单独贡献底内缩=' + b.bottomIn + 'px');
    });
    await page.close();
  }
  await browser.close();
  server.close();
})();
