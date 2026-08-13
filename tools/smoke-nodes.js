/* tools/smoke-nodes.js — 专题页地图功能回归（区域统计 + 筛选双态；节点管理已移至 node-manager.html） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  /* 1. 专题页无节点管理 FAB */
  ok('专题页无 FAB', !(await page.$('.nm-fab')));

  /* 2. 区域统计条（高 zoom 后 moveend 触发） */
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 11); });
  let statsTxt = '';
  for (let i = 0; i < 8; i++) {
    await sleep(600);
    statsTxt = await page.evaluate(() => (document.querySelector('.region-stats') || {}).textContent || '');
    if (statsTxt.includes('当前区域')) break;
  }
  ok('区域统计条出现', statsTxt.includes('当前区域'), statsTxt.slice(0, 40));

  /* 3. 统计条 chip 点击 → 筛选强调 */
  await page.evaluate(() => {
    const chip = document.querySelector('.region-stats .rs-chip');
    if (chip) chip.click();
  });
  await sleep(1500);
  const chipDim = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-dim').length);
  ok('统计条 chip 触发筛选强调', chipDim > 0, 'dim=' + chipDim);
  /* 清除筛选 */
  await page.evaluate(() => { const c = document.querySelector('#dynChips .chip.all'); if (c) c.click(); });
  await sleep(800);

  /* 4. 高 zoom 节点渲染 + 筛选双态（主题 chip） */
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 12); });
  await sleep(1500);
  const before = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  ok('高 zoom 节点已渲染', before > 0, 'nodes=' + before);
  await page.evaluate(() => {
    for (const c of document.querySelectorAll('#dynChips .chip')) { if (c.textContent.includes('古建')) { c.click(); break; } }
  });
  await sleep(1500);
  const dimCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-dim').length);
  const allCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  ok('筛选双态：非匹配节点降透明', dimCount > 0 && allCount > dimCount, 'dim=' + dimCount + ' total=' + allCount);

  /* 5. 图例联动 */
  const legOn = await page.evaluate(() => [...document.querySelectorAll('#legBody .lg')].filter(l => l.classList.contains('on')).map(l => l.dataset.th || '全部'));
  ok('图例选中态同步', legOn.length > 0, legOn.join(','));
  const chipOn = await page.evaluate(() => [...document.querySelectorAll('#dynChips .chip')].filter(c => c.classList.contains('on')).map(c => c.textContent.trim().slice(0, 10)));
  ok('顶部标签选中态同步', chipOn.some(t => t.includes('古建')), chipOn.join(','));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));

  await browser.close();
  console.log(fails ? '=== NODES SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== NODES SMOKE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
