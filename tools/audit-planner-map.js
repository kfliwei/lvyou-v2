/* 验证：排期结果 → 足迹地图轨迹 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 130)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西，喜欢自然风光';
    document.getElementById('genBtn').click();
  });
  await sleep(3000);
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand');
    for (let i = 0; i < Math.min(3, cs.length); i++) cs[i].click();
  });
  await sleep(300);
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(2000);
  /* 点"足迹地图"按钮 */
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#actRow .btn')].find(x => /足迹地图/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  const r = await p.evaluate(() => ({
    map: !!document.querySelector('.leaflet-container'),
    lines: document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane polyline').length,
    markers: document.querySelectorAll('.leaflet-marker-icon, #mapEl .tr-node').length
  }));
  console.log(JSON.stringify(r));
  ok('轨迹地图初始化', r.map);
  ok('轨迹线/站点渲染', r.lines >= 1 || r.markers >= 1, 'lines=' + r.lines + ' markers=' + r.markers);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await browser.close();
  console.log(fails ? '=== MAP FAIL ===' : '=== MAP ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
