/* 验证：起终点 + 环线 */
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
      { id: 'A|39.9|116.4', label: '北京站', lat: 39.9, lng: 116.4, region: '北京市', city: '北京', theme: '城市地标', ts: Date.now(), visited: 0 },
      { id: 'B|30.2|120.1', label: '杭州站', lat: 30.2, lng: 120.1, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: 'C|31.2|121.4', label: '上海站', lat: 31.2, lng: 121.4, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // 先规划一次让 DOM 创建（起终点输入框在 renderPlan 里）
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2000));
  // 1. 起终点 UI 存在
  const ui = await page.evaluate(() => ({
    hasStart: !!document.getElementById('planStart'),
    hasEnd: !!document.getElementById('planEnd'),
    hasLoop: !!document.getElementById('planLoop'),
    hasDatalist: !!document.getElementById('wlList')
  }));
  ok('起终点输入框存在', ui.hasStart && ui.hasEnd && ui.hasLoop, JSON.stringify(ui));
  ok('datalist 存在', ui.hasDatalist, '');

  // 2. 填出发地 "北京站" + 规划
  await page.evaluate(() => {
    document.getElementById('planStart').value = '北京站';
    document.getElementById('planEnd').value = '上海站';
    document.getElementById('wlPlanBtn').click();
  });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => ({
    start: window.__planStart,
    end: window.__planEnd,
    days: (window.__planDays || []).length,
    txt: document.getElementById('wlPlan').textContent.slice(0, 200),
    hasStartRow: document.getElementById('wlPlan').textContent.includes('出发地'),
    hasEndRow: document.getElementById('wlPlan').textContent.includes('抵达地'),
    lastDayEnd: (() => {
      const days = window.__planDays || [];
      if (!days.length) return null;
      const last = days[days.length - 1];
      return last[last.length - 1];
    })()
  }));
  ok('出发地已记录', d.start && d.start.label === '北京站', JSON.stringify(d.start));
  ok('终到地已记录', d.end && d.end.label === '上海站', JSON.stringify(d.end));
  ok('起点行渲染', d.hasStartRow, '');
  ok('终点站已追加', d.lastDayEnd && d.lastDayEnd.isEnd && d.lastDayEnd.label === '上海站', JSON.stringify(d.lastDayEnd));
  ok('终点行渲染', d.hasEndRow, '');

  // 3. 环线：出发地=终到地
  await page.evaluate(() => {
    document.getElementById('planStart').value = '北京站';
    document.getElementById('planEnd').value = '北京站';
    document.getElementById('planLoop').checked = true;
    document.getElementById('wlPlanBtn').click();
  });
  await new Promise(r => setTimeout(r, 2000));
  const loop = await page.evaluate(() => ({
    end: window.__planEnd,
    txt: document.getElementById('wlPlan').textContent.includes('环线'),
    lastDayEnd: (() => {
      const days = window.__planDays || [];
      if (!days.length) return null;
      const last = days[days.length - 1];
      return last[last.length - 1];
    })()
  }));
  ok('环线：终到地=出发地', loop.end && loop.end.label === '北京站', '');
  ok('环线标注显示', loop.txt, '');
  ok('环线终点站 isLoop', loop.lastDayEnd && loop.lastDayEnd.isLoop, '');

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== START-END CHECK FAIL ===' : '=== START-END CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });