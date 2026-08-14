/* 验证：全国地图半径查询 → 缩小 → 放大 → 点击圈内节点弹信息框 */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  const clickNode = () => page.evaluate(() => {
    // 找到可点击的节点标记（优先补画高亮层，其次普通节点），派发 click
    const el = document.querySelector('#mapEl .tr-halo, #mapEl .tr-node') || document.querySelector('#mapEl .leaflet-marker-icon');
    if (!el) return false;
    const target = el.closest('.leaflet-marker-icon') || el;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  });
  const sheetShown = () => page.evaluate(() => {
    const s = document.getElementById('locSheet');
    return !!(s && s.classList.contains('show'));
  });
  const nodeCount = () => page.evaluate(() => ({
    markers: document.querySelectorAll('#mapEl .leaflet-marker-icon').length,
    halos: document.querySelectorAll('#mapEl .tr-halo').length,
    nearBar: (document.getElementById('nearBar') || {}).style ? document.getElementById('nearBar').style.display : 'n/a'
  }));

  // 1. 北京区域 z=5（city 聚合层）点地图选半径
  await page.evaluate(() => { window.TopicEngine._map.setView([39.9, 116.4], 5); });
  await new Promise(r => setTimeout(r, 1500));
  await page.mouse.click(195, 420);
  await new Promise(r => setTimeout(r, 800));
  ok('选点后半径条出现', (await page.evaluate(() => (document.getElementById('nearBar') || { style: {} }).style.display)) === 'flex');

  // 2. 点 50km
  await page.evaluate(() => { const c = document.querySelector('#nearBar .nk[data-k="50"]'); if (c) c.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const n1 = await nodeCount();
  ok('50km 查询后圈内节点高亮', n1.halos > 0, JSON.stringify(n1));

  // 3. 聚合层直接点击高亮补画节点 → 应弹框（修复点 1）
  await clickNode();
  await new Promise(r => setTimeout(r, 600));
  ok('聚合层点击高亮节点弹信息框', await sheetShown());
  await page.evaluate(() => { const s = document.getElementById('locSheet'); if (s) s.classList.remove('show'); });
  await new Promise(r => setTimeout(r, 300));

  // 4. 缩小 z=3.5（region 聚合）
  await page.evaluate(() => { window.TopicEngine._map.setView([39.9, 116.4], 3.5); });
  await new Promise(r => setTimeout(r, 1500));

  // 5. 放大到节点层 z=11 → 点击节点应弹框（修复点 2：残留补画层已清理）
  await page.evaluate(() => { window.TopicEngine._map.setView([39.9, 116.4], 11); });
  await new Promise(r => setTimeout(r, 1800));
  const n2 = await nodeCount();
  const clicked = await clickNode();
  await new Promise(r => setTimeout(r, 600));
  ok('缩小再放大后点击节点弹信息框', clicked && await sheetShown(), 'markers=' + n2.markers + ' halos=' + n2.halos + ' clicked=' + clicked);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== NEAR-CLICK VERIFY FAIL: ' + fails + ' ===' : '=== NEAR-CLICK VERIFY ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
