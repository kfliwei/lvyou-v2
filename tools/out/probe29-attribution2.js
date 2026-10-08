/* tools/out/probe29-attribution2.js — 把版权条那两条页内规则的真伪一次量清：
 * 页内 .leaflet-control-attribution 是单类（0,1,0），Leaflet 自带 .leaflet-container .leaflet-control-attribution
 * 是 0,2,0（vendor/leaflet/leaflet.css:413 声明 margin:0 与 background:rgba(255,255,255,.8)），
 * 所以 travel-map.html:96 与 :101 的 background 到底谁赢，只能读 computed，不能读源码。
 * 暗色那一条（.theme-dark …，0,2,0 且在后）一并量，看是不是「亮色死、暗色活」的双标现场。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'b29-probe-attribution2.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const say = s => { log.push(s); console.log(s); };

const READ = () => {
  const a = document.querySelector('.leaflet-control-attribution');
  const s = getComputedStyle(a);
  const mr = document.getElementById('map').getBoundingClientRect();
  const r = a.getBoundingClientRect();
  return {
    mb: s.marginBottom, bg: s.backgroundColor, color: s.color, pad: s.padding, fs: s.fontSize,
    theme: document.documentElement.className + '/' + document.body.className,
    rect: { top: Math.round(r.top - mr.top), bot: Math.round(r.bottom - mr.top), left: Math.round(r.left - mr.left), w: Math.round(r.width), h: Math.round(r.height) },
    hit: (() => { const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h ? String(h.id || h.className || h.tagName) : 'null'; })()
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => say('  页内报错 ' + String(e.message).slice(0, 120)));
  await page.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  say('1. 亮色 ' + JSON.stringify(await page.evaluate(READ)));
  await page.evaluate(() => { document.documentElement.classList.add('theme-dark'); });
  await sleep(200);
  say('2. 暗色（手动加类）' + JSON.stringify(await page.evaluate(READ)));
  await page.evaluate(() => { document.documentElement.classList.remove('theme-dark'); });
  await sleep(200);
  say('3. 回落亮色 ' + JSON.stringify(await page.evaluate(READ)));
  say('4. 版权条下方 328 档还有谁（点 (266,715) 与 (160,715)）' + await page.evaluate(() => {
    return [[266, 715], [160, 715], [30, 715]].map(p => {
      const h = document.elementFromPoint(p[0], p[1]);
      return p + '→' + (h ? String(h.id || h.className || h.tagName) : 'null');
    }).join(' | ');
  }));
  await browser.close();
  fs.writeFileSync(OUT, log.join('\n') + '\n');
})();
