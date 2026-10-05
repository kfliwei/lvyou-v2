/* b13-offcenter-attr.js — 复现 smoke-usable 的 U5/U6 红并逐枚归因
 *
 * U5/U6 的第二条断言是 `a2.out.length === 0 && a2.offCenter.length === 0`，
 * 日志里 detail 只打了「越界 0」，所以红一定来自 offCenter。本脚本按闸门同一口径重算，
 * 并把每枚标记的「期望中心 / 实际中心 / 产品会不会挪它」三件事摆出来：
 *   - 产品侧 clampCapsules 只 querySelectorAll('.lod-cl')，节点标记从来不被内收；
 *   - 闸门侧 analyze() 却对**所有** marks 用了「锚点夹进可用区±半盒」的期望。
 * 若红枚全是 k='nd'，就是闸门公式外溢；若含 k='cl'，那是产品内收漏了。
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8169', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

/* 与 smoke-usable.js 的 PROBE 同口径，但多报两样：这枚是不是 .lod-cl（产品只内收胶囊）、
   以及盒宽/盒高与可用区宽高的关系（clampCapsules 有「比可用区还宽就不挪」的护栏） */
const PROBE = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const BANDS = ['.routeBanner', '.region-stats', '.tabbar', '.tripbar.open'];
  let t = 0, r = 0, b = 0, l = 0;
  BANDS.forEach(function (sel) {
    [].slice.call(document.querySelectorAll(sel)).forEach(function (n) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      const rr = n.getBoundingClientRect();
      const ix = Math.max(0, Math.min(rr.right, mr.right) - Math.max(rr.left, mr.left));
      const iy = Math.max(0, Math.min(rr.bottom, mr.bottom) - Math.max(rr.top, mr.top));
      if (ix < 12 || iy < 12) return;
      if (ix / mr.width >= 0.6) {
        if ((rr.top + rr.bottom) / 2 < mr.top + mr.height / 2) t = Math.max(t, rr.bottom - mr.top);
        else b = Math.max(b, mr.bottom - rr.top);
      } else if (iy / mr.height >= 0.6) {
        if ((rr.left + rr.right) / 2 > mr.left + mr.width / 2) r = Math.max(r, mr.right - rr.left);
        else l = Math.max(l, rr.right - mr.left);
      }
    });
  });
  t = Math.max(0, Math.min(t, mr.height - 40)); b = Math.max(0, Math.min(b, mr.height - 40));
  l = Math.max(0, Math.min(l, mr.width - 40)); r = Math.max(0, Math.min(r, mr.width - 40));
  const use = { l: mr.left + l, t: mr.top + t, r: mr.right - r, b: mr.bottom - b };
  const TE = window.TopicEngine;
  const ins = TE.usableInsets();
  const arr = o => [o.top, o.right, o.bottom, o.left];
  const rows = [];
  [].slice.call(document.querySelectorAll('#mapEl .leaflet-marker-icon')).forEach(function (cont) {
    const cap = cont.querySelector('.lod-cl');
    const cr = cont.getBoundingClientRect();
    let rr;
    if (cap) rr = cap.getBoundingClientRect();
    else { const inner = cont.firstElementChild ? cont.firstElementChild.getBoundingClientRect() : cr; rr = (inner.height < 4 && cr.height >= 4) ? cr : inner; }
    if (!rr.width && !rr.height) return;
    const w = rr.width, h = rr.height;
    const ax = cr.left + cr.width / 2, ay = cr.top + cr.height / 2;
    const ex = Math.min(Math.max(ax, use.l + w / 2), Math.max(use.l + w / 2, use.r - w / 2));
    const ey = Math.min(Math.max(ay, use.t + h / 2), Math.max(use.t + h / 2, use.b - h / 2));
    const d = Math.abs((rr.left + rr.right) / 2 - ex) + Math.abs((rr.top + rr.bottom) / 2 - ey);
    const over = Math.max(0, use.l - rr.left, rr.right - use.r) + Math.max(0, use.t - rr.top, rr.bottom - use.b);
    rows.push({
      k: cap ? 'cl' : 'nd', t: (cont.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 12),
      d: +d.toFixed(1), over: +over.toFixed(1),
      box: [rr.left, rr.top, rr.right, rr.bottom].map(Math.round),
      wh: [Math.round(w), Math.round(h)],
      anch: [Math.round(ax), Math.round(ay)],
      exp: [Math.round(ex), Math.round(ey)],
      cx: Math.round((rr.left + rr.right) / 2), cy: Math.round((rr.top + rr.bottom) / 2),
      dx: cap ? (parseFloat(cap.style.getPropertyValue('--lod-dx')) || 0) : null,
      dy: cap ? (parseFloat(cap.style.getPropertyValue('--lod-dy')) || 0) : null,
      wider: w > (use.r - use.l), taller: h > (use.b - use.t)
    });
  });
  return { vp: [innerWidth, innerHeight], gate: [t, r, b, l], prod: arr(ins), zoom: TE._map.getZoom(),
           use: [use.l, use.t, use.r, use.b].map(Math.round), rows: rows };
})()`;

const BOXES = '(() => [].slice.call(document.querySelectorAll("#mapEl .leaflet-marker-icon")).map(e => { const q = e.getBoundingClientRect(); const c = e.querySelector(".lod-cl"); const s = c ? c.getBoundingClientRect() : q; return [e.textContent.slice(0,10), Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)].join("|"); }).join(";"))()';
const MOVING = '(() => [].slice.call(document.querySelectorAll("#mapEl .leaflet-marker-icon")).filter(e => e.getAnimations && e.getAnimations().some(a => a.playState === "running")).length)()';
async function settle(page, maxMs) {
  let prev = null, same = 0, waited = 0;
  while (waited < maxMs) {
    await sleep(120); waited += 120;
    const cur = await page.evaluate(BOXES);
    const n = await page.evaluate(MOVING);
    if (cur && cur === prev && n === 0) { if (++same >= 2) return { stable: true, waited, moving: n }; }
    else same = 0;
    prev = cur;
  }
  return { stable: false, waited, moving: await page.evaluate(MOVING) };
}

function report(tag, s) {
  console.log('\n### ' + tag + '  zoom=' + s.zoom + '  内缩(上右下左)=' + s.gate.join(',') +
    ' 产品=' + s.prod.join(',') + '  可用区=' + s.use.join('/') + '  标记 ' + s.rows.length + ' 枚');
  const bad = s.rows.filter(r => r.d > 1.5);
  console.log('offCenter(>1.5px) ' + bad.length + ' 枚；其中 cl ' + bad.filter(r => r.k === 'cl').length + ' 枚 / nd ' + bad.filter(r => r.k === 'nd').length + ' 枚');
  console.log('越界(>2px) ' + s.rows.filter(r => r.over > 2).length + ' 枚');
  s.rows.forEach(r => {
    console.log((r.d > 1.5 ? '✗ ' : '  ') + r.k + ' ' + (r.t || '(无名)').padEnd(12) +
      ' 偏移 ' + String(r.d).padStart(6) + '  盒' + r.box.join('/') + ' ' + r.wh.join('×') +
      '  锚' + r.anch.join(',') + '  中心' + r.cx + ',' + r.cy + '  期望' + r.exp.join(',') +
      (r.dx === null ? '  (无内收变量)' : '  内收dx=' + r.dx + ',dy=' + r.dy) +
      (r.wider ? '  【盒宽>可用区宽】' : '') + (r.taller ? '  【盒高>可用区高】' : ''));
  });
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new' });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_layer', 'amapStreet'); } catch (e) {} });
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  await page.goto(BASE + '/topic.html?p=sx', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  report('首屏（U3/U4 绿，作为对照）', await page.evaluate(PROBE));
  for (const n of [1, 2, 3]) {
    await page.evaluate("document.getElementById('zoomIn').click()");
    const st = await settle(page, 6000);
    report('点 + ' + n + ' 次（稳定=' + st.stable + ' waited=' + st.waited + 'ms）', await page.evaluate(PROBE));
  }
  await page.evaluate("document.getElementById('zoomOut').click()");
  const st = await settle(page, 6000);
  report('再点 − 一次（U7 绿，作为对照）', await page.evaluate(PROBE));
  await browser.close();
  server.close();
})();
