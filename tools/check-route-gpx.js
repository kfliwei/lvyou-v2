/* 验证：规划地图真实导航线路（OSRM）+ GPX 导出反馈 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '长城|40.36|116.02', label: '长城', lat: 40.36, lng: 116.02, region: '北京市', city: '北京', theme: '关隘长城', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2000));

  // 直线阶段：2 段直线
  const straight = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('#wlMap .leaflet-overlay-pane path')];
    return lines.map(p => { const d = p.getAttribute('d') || ''; return { len: d.length, pts: (d.match(/L/g) || []).length + 1 }; });
  });
  ok('先画直线（即时反馈）', straight.length >= 1, JSON.stringify(straight));

  // 等待 OSRM 返回（真实道路线点数应远多于 2）
  await new Promise(r => setTimeout(r, 12000));
  const real = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('#wlMap .leaflet-overlay-pane path')];
    const info = lines.map(p => { const d = p.getAttribute('d') || ''; return { pts: (d.match(/L/g) || []).length + 1, len: d.length }; });
    return { count: lines.length, maxPts: Math.max.apply(null, info.map(i => i.pts)), maxLen: Math.max.apply(null, info.map(i => i.len)) };
  });
  ok('真实导航线路已替换（道路折线点多）', real.maxPts > 3, JSON.stringify(real));

  // GPX 导出反馈：点击后出现"正在导出"提示
  await page.evaluate(() => { const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));
  const gpx = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('body > div')].filter(d => d.style.position === 'fixed' && d.textContent);
    return divs.map(d => d.textContent.slice(0, 30));
  });
  ok('导出 GPX 有即时反馈', gpx.some(t => /GPX|导出/.test(t)), JSON.stringify(gpx));

  const realE = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', realE.length === 0, realE[0] || '');
  console.log(fails ? '=== ROUTE-GPX CHECK FAIL ===' : '=== ROUTE-GPX CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
