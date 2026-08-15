/* 验证：线路介绍 + 途经点弹窗 v2 样式渲染 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sc').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 线路 tab */
  await page.evaluate(() => { const b = document.querySelector('.tabbar button[data-tab="route"]'); if (b) b.click(); });
  await sleep(1500);
  const route = await page.evaluate(() => {
    const rh = document.querySelector('.route .rh');
    if (!rh) return null;
    const cs = getComputedStyle(rh);
    const dot = document.querySelector('.route .rh-dot');
    const tip = document.querySelector('.route .daytip');
    return {
      bg: cs.backgroundColor,
      borderLeft: cs.borderLeftWidth + ' ' + cs.borderLeftColor,
      h3color: getComputedStyle(rh.querySelector('h3')).color,
      dot: dot ? getComputedStyle(dot).backgroundColor : 'none',
      tipBg: tip ? getComputedStyle(tip).backgroundColor : 'none'
    };
  });
  ok('线路头为宣纸底+主题色边条', route && route.bg !== 'rgba(0, 0, 0, 0)' && route.borderLeft !== '0px none rgb(0, 0, 0)' && route.h3color !== 'rgb(250, 248, 243)', JSON.stringify(route));
  /* 途经点弹窗（点击地图空白触发 spotRec） */
  await page.evaluate(() => {
    const m = window.TopicEngine._map;
    m.fire('click', { latlng: L.latLng(30.6, 104.0) });
  });
  await sleep(1000);
  const pop = await page.evaluate(() => {
    const wrap = document.querySelector('.trippop .leaflet-popup-content-wrapper');
    if (!wrap) return null;
    const cs = getComputedStyle(wrap);
    const btn = document.querySelector('.trippop .addtrip.tnvo');
    return {
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      btnBg: btn ? getComputedStyle(btn).backgroundColor : 'none',
      title: (document.querySelector('.trippop .pop b') || {}).textContent || ''
    };
  });
  ok('途经点弹窗 v2 样式', pop && pop.title === '途经点随手记' && pop.btnBg !== 'none', JSON.stringify(pop));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== UI-CONSISTENCY FAIL ===' : '=== UI-CONSISTENCY ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
