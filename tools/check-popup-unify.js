/* 验证：全局 popup v2 化 + travel-notes 硬编码清理 */
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
  /* 触发途经点 popup（全局样式检查） */
  await page.evaluate(() => {
    const m = window.TopicEngine._map;
    m.fire('click', { latlng: L.latLng(30.6, 104.0) });
  });
  await sleep(1000);
  const pop = await page.evaluate(() => {
    const wrap = document.querySelector('.trippop .leaflet-popup-content-wrapper');
    if (!wrap) return null;
    const cs = getComputedStyle(wrap);
    return { radius: cs.borderRadius, border: cs.borderWidth, shadow: cs.boxShadow !== 'none' };
  });
  ok('途经点弹窗 v2 卡片', pop && pop.radius === '16px' && pop.border !== '0px', JSON.stringify(pop));
  /* 线路 popup（698 行线路点击）——触发一条线路在地图查看 */
  await page.evaluate(() => {
    const b = document.querySelector('.tabbar button[data-tab="route"]');
    if (b) b.click();
  });
  await sleep(1200);
  await page.evaluate(() => {
    const b = document.querySelector('[data-show]');
    if (b) b.click();
  });
  await sleep(1500);
  /* 检查全局 popup 规则存在（静态验证足够） */
  const cssOk = await page.evaluate(() => {
    const sheets = [...document.styleSheets];
    let found = false;
    for (const sh of sheets) {
      try {
        for (const r of sh.cssRules) {
          if (r.selectorText && r.selectorText.includes('leaflet-popup-content-wrapper')) {
            if ((r.style.borderRadius || '').includes('16')) found = true;
          }
        }
      } catch (e) {}
    }
    return found;
  });
  ok('全局 popup 规则生效', cssOk);
  /* travel-notes 面板硬编码已变量化（静态） */
  const fs = require('fs');
  const tn = fs.readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
  ok('tn-recbox 已用变量', tn.includes('.tn-recbox{width:100%;margin-top:12px;background:var(--color-surface)'));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== POPUP-UNIFY FAIL ===' : '=== POPUP-UNIFY ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
