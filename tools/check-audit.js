/* 验证：nation 按省懒加载 + 详情补齐 + P0 修复回归 */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });

  /* nation 页懒加载 */
  const bigLoaded = { found: false };
  page.on('request', r => { if (r.url().includes('nation-data.js')) bigLoaded.found = true; });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  const st = await page.evaluate(() => ({
    n: (window.SITES || []).length,
    lazy: !!window.SITES_LAZY,
    idx: (window.NATION_SITES_RAW || '').split('\n').length,
    firstDesc: (window.SITES && window.SITES[0] && window.SITES[0].desc) || ''
  }));
  ok('nation 使用轻量索引', st.lazy && st.n === st.idx, 'sites=' + st.n);
  ok('nation 未加载 3MB 全量', !bigLoaded.found);
  ok('索引节点无 desc（待按省补）', st.firstDesc === '', 'desc=' + st.firstDesc.slice(0, 20));

  /* 打开节点 → 按省补详情（headless 下 LOD marker 点击不可靠，直接走 openSheet 验证懒加载链路） */
  await page.evaluate(() => {
    const idx = (window.SITES || []).findIndex(x => x.name === '云冈石窟');
    window.TopicEngine.openSheet(idx >= 0 ? idx : 0);
  });
  await sleep(2500);
  const detail = await page.evaluate(() => ({
    sheet: !!document.querySelector('#locSheet.show'),
    desc: (document.querySelector('#locSheet .ls-desc') || {}).textContent || ''
  }));
  ok('节点详情面板打开', detail.sheet);
  ok('按省懒加载补出详情', detail.desc.length > 10, detail.desc.slice(0, 30));
  await page.close();

  /* 首页：双引导已合并（无 tnGuide 残留、onboarded 一套） */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message.slice(0, 150)));
  await p2.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);
  const g = await p2.evaluate(() => ({
    tnGuide: !!document.getElementById('tnGuide'),
    guideRef: !!document.getElementById('gNext'),
    ob: !!document.querySelector('.ob-mask')
  }));
  ok('首页无 tnGuide 残留', !g.tnGuide && !g.guideRef);
  ok('首启引导仅剩一套（ob-mask）', g.ob);
  const real2 = errs2.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('首页无脚本错误', real2.length === 0, real2.join(' | ').slice(0, 100));
  await p2.close();

  /* 搜索：断网降级（模拟索引加载失败） */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs3 = [];
  p3.on('pageerror', e => errs3.push(e.message.slice(0, 150)));
  /* 拦截 nation-index.js 使其失败 */
  await p3.setRequestInterception(true);
  p3.on('request', r => { if (r.url().includes('nation-index.js')) r.abort(); else r.continue(); });
  await p3.goto('file:///' + path.join(ROOT, 'search.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  const off = await p3.evaluate(() => {
    const secs = [...document.querySelectorAll('.sec-t')].map(x => x.textContent || '');
    const items = document.querySelectorAll('#result .item').length;
    return { secs: secs.join('|'), items };
  });
  ok('断网时游记分组仍渲染', off.secs.includes('游记') || off.items > 0, off.secs.slice(0, 40));
  const real3 = errs3.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('搜索无脚本错误', real3.length === 0, real3.join(' | ').slice(0, 100));
  await p3.close();

  await browser.close();
  console.log(fails ? '=== AUDIT-FIX FAIL: ' + fails + ' ===' : '=== AUDIT-FIX ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
