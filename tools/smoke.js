/* tools/smoke.js — 真实浏览器冒烟测试（puppeteer-core + 本机 Chrome）
 * 覆盖：index / search / wishlist / travel-map / settings / md-manager
 * 验证：无 JS 报错、首启引导、搜索加载与"加载更多"、UI 组件存在、地图初始化
 * 用法: node tools/smoke.js
 */
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

  async function openPage(file, waitMs) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    await page.goto('file:///' + path.join(ROOT, file).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(waitMs || 2500);
    return { page, errors };
  }
  function realErrors(errors) {
    // 过滤瓦片/网络资源/manifest(CORS) 类噪声，只留真正的脚本错误
    return errors.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest/.test(e));
  }

  /* 1. 首页 + 首启引导 */
  {
    const { page, errors } = await openPage('index.html', 3000);
    const ob = await page.$('.ob-mask');
    ok('index: 首启引导显示', !!ob);
    if (ob) {
      await page.click('#obNext'); await page.click('#obNext');
      await page.click('#obNext');
      await sleep(600);
      ok('index: 引导完成后消失', !(await page.$('.ob-mask')));
      ok('index: tn_onboarded 已标记', await page.evaluate(() => localStorage.getItem('tn_onboarded') === '1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(2500);
      ok('index: 二次访问不再显示引导', !(await page.$('.ob-mask')));
    }
    ok('index: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  /* 2. 搜索页：数据加载 + 防抖搜索 + 加载更多 */
  {
    const { page, errors } = await openPage('search.html', 3500);
    const n = await page.evaluate(() => (window.NATION_SITES_RAW || '').split('\n').length);
    ok('search: 索引加载 7782+ 条', n >= 7782, 'n=' + n);
    await page.type('#q', '拉萨');
    await sleep(900);
    const hits = await page.evaluate(() => {
      const t = document.querySelector('.sec-t b');
      const items = document.querySelectorAll('#result .item').length;
      return { label: t ? t.textContent : '', items };
    });
    ok('search: 关键词"拉萨"有结果', hits.items > 0, hits.label + ' / items=' + hits.items);
    const more = await page.$('#moreBtn');
    if (more) {
      const before = await page.evaluate(() => document.querySelectorAll('#result .item').length);
      await page.click('#moreBtn');
      await sleep(400);
      const after = await page.evaluate(() => document.querySelectorAll('#result .item').length);
      ok('search: 加载更多生效', after > before, before + ' -> ' + after);
    } else {
      console.log('INFO  search: 结果未超 20 条，无加载更多按钮');
    }
    ok('search: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  /* 3. 想去清单：空态 + UI 组件 + 规划提示 */
  {
    const { page, errors } = await openPage('wishlist.html', 3000);
    ok('wishlist: UI 组件存在', await page.evaluate(() => !!window.UI && !!window.UI.toast && !!window.UI.confirm));
    const planBind = await page.evaluate(() => {
      const b = document.getElementById('wlPlanBtn');
      if (!b) return '';
      if (b.onclick) return 'bound';
      return b.getAttribute('onclick') || '';
    });
    ok('wishlist: 规划按钮跳转 planner', planBind === 'bound' || /planner\.html/.test(planBind), planBind);
    ok('wishlist: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  /* 4. 足迹地图：Leaflet 初始化 */
  {
    const { page, errors } = await openPage('travel-map.html', 8000);
    const mapReady = await page.evaluate(() => !!document.querySelector('#map.leaflet-container'));
    ok('travel-map: Leaflet 地图初始化', mapReady);
    ok('travel-map: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  /* 5. 设置页：UI 组件 + 清除数据确认对话框 */
  {
    const { page, errors } = await openPage('settings.html', 3000);
    ok('settings: UI 组件存在', await page.evaluate(() => !!window.UI && !!window.UI.confirm));
    const dlg = await page.evaluate(() => {
      window.UI.confirm({ title: '测试', text: '确认对话框冒烟', okText: '确定' }, () => {});
      return new Promise(r => setTimeout(() => r(!!document.querySelector('.ui-modal')), 200));
    });
    ok('settings: 确认对话框可弹出', dlg);
    ok('settings: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  /* 6. MD 库：UI 组件存在 */
  {
    const { page, errors } = await openPage('md-manager.html', 3000);
    ok('md-manager: UI 组件存在', await page.evaluate(() => !!window.UI && !!window.UI.confirm));
    ok('md-manager: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
    await page.close();
  }

  await browser.close();
  console.log(fails ? '=== SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== SMOKE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
