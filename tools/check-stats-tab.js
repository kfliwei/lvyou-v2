/* 验证：tab 切换时「当前区域」统计条显隐 */
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
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  /* 地图 tab：统计条出现 */
  await p.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 11); });
  await sleep(1200);
  const onMap = await p.evaluate(() => {
    const el = document.querySelector('.region-stats');
    return el ? getComputedStyle(el).display : 'none';
  });
  ok('地图 tab 统计条显示', onMap === 'flex', onMap);
  /* 切列表 tab → 隐藏 */
  await p.evaluate(() => { const b = document.querySelector('.tabbar button[data-tab="list"]'); if (b) b.click(); });
  await sleep(800);
  const onList = await p.evaluate(() => {
    const el = document.querySelector('.region-stats');
    return el ? getComputedStyle(el).display : 'none';
  });
  ok('列表 tab 统计条隐藏', onList === 'none', onList);
  /* 切回地图 → 恢复 */
  await p.evaluate(() => { const b = document.querySelector('.tabbar button[data-tab="map"]'); if (b) b.click(); });
  await sleep(1200);
  const backMap = await p.evaluate(() => {
    const el = document.querySelector('.region-stats');
    return el ? getComputedStyle(el).display : 'none';
  });
  ok('回地图统计条恢复', backMap === 'flex', backMap);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== STATS-TAB FAIL ===' : '=== STATS-TAB ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
