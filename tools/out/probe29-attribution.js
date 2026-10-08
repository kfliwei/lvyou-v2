/* tools/out/probe29-attribution.js — §44 的动态对账抓到 travel-map.html:96 那条
 * `.leaflet-control-attribution{margin-bottom:calc(env(safe-area-inset-bottom,0px) + 94px)}`。
 * 先量清楚它是「R1 同一族（又一个硬编码的底部数）」还是「正则误伤（margin-bottom 不参与那一摞）」：
 * 328×723 各量 attribution 矩形、z-index、中心点命中的是谁、以及底部那一摞其它成员的位置。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-attribution.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => say('  页内报错 ' + String(e.message).slice(0, 120)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);

  const R = () => page.evaluate(() => {
    const a = document.querySelector('.leaflet-control-attribution');
    const mr = map.getContainer().getBoundingClientRect();
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top - mr.top), bot: Math.round(r.bottom - mr.top), left: Math.round(r.left - mr.left), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const out = { attr: rect(a), mapH: Math.round(mr.height), mb: getComputedStyle(a).marginBottom };
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.center = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    out.hit = hit ? String(hit.id || hit.className || hit.tagName) : 'null';
    out.hitIsSelf = !!(hit && a.contains(hit));
    out.z = getComputedStyle(a).zIndex;
    out.text = (a.textContent || '').trim().slice(0, 40);
    out.collapsed = document.documentElement.className + ' / statBar=' + getComputedStyle(document.getElementById('statBar')).display;
    return out;
  });
  say('1. 默认态 ' + JSON.stringify(await R()));
  say('2. 底部那一摞的成员 ' + await page.evaluate(() => ['statBar', 'statOpen', 'mmTimeline', 'memSheet', 'tabDock'].map(id => {
    const el = document.getElementById(id);
    if (!el) return id + '=NOEL';
    const s = getComputedStyle(el), mr = map.getContainer().getBoundingClientRect(), r = el.getBoundingClientRect();
    return id + '{' + s.display + ' top-from-mapTop=' + Math.round(r.top - mr.top) + ' bot-from-mapBot=' + Math.round(mr.bottom - r.bottom) + ' h=' + Math.round(r.height) + ' z=' + s.zIndex + '}';
  }).join(' ')));
  say('3. 版权条父容器（leaflet-bottom.leaflet-right）' + await page.evaluate(() => {
    const p = document.querySelector('.leaflet-control-attribution').parentNode, s = getComputedStyle(p), r = p.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect();
    return '{' + String(p.className) + ' pos=' + s.position + ' bottom=' + s.bottom + ' bot-from-mapBot=' + Math.round(mr.bottom - r.bottom) + ' h=' + Math.round(r.height) + ' z=' + s.zIndex + '}';
  }));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})();
