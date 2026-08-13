/* tools/smoke-nodes.js — 节点管理 + 区域统计 + 筛选双态冒烟测试（topic.html?p=bj） */
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

  /* 1. FAB + 菜单 */
  const fab = await page.$('.nm-fab');
  ok('FAB 存在', !!fab);
  await page.click('.nm-fab');
  await sleep(300);
  const menuItems = await page.evaluate(() => document.querySelectorAll('.nm-menu-item').length);
  ok('添加菜单 4 项', menuItems === 4, 'items=' + menuItems);

  /* 2. 我的节点空态 */
  await page.evaluate(() => localStorage.removeItem('tn_userNodes'));
  await page.click('.nm-menu-item[data-a="mine"]');
  await sleep(400);
  const emptyTxt = await page.evaluate(() => (document.querySelector('#nmList') || {}).textContent || '');
  ok('我的节点空态', emptyTxt.includes('还没有自己添加的节点'));
  await page.click('#nmClose');
  await sleep(300);

  /* 3. 地图选点 → 表单 → 保存 */
  await page.click('.nm-fab');
  await sleep(300);
  await page.click('.nm-menu-item[data-a="pick"]');
  await sleep(300);
  const hint = await page.evaluate(() => (document.querySelector('.ui-toast') || {}).textContent || '');
  ok('选点提示 toast', hint.includes('点击选择位置'));
  await page.evaluate(() => {
    const m = window.TopicEngine._map;
    m.fire('click', { latlng: L.latLng(39.92, 116.40) });
  });
  await sleep(600);
  const formShown = await page.evaluate(() => !!document.querySelector('.nm-form'));
  ok('选点后表单出现', formShown);
  if (formShown) {
    await page.type('#nmName', '测试小茶馆');
    await page.type('#nmCity', '北京');
    await page.type('#nmCat', '茶馆');
    await page.click('#nmSave');
    await sleep(600);
    const saved = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('tn_userNodes') || '[]');
      return { n: arr.length, name: arr[0] && arr[0].name };
    });
    ok('节点保存到本地', saved.n === 1 && saved.name === '测试小茶馆', 'n=' + saved.n);
    const inSites = await page.evaluate(() => (window.SITES || []).filter(x => x.source === 'user').length);
    ok('用户节点合并进 SITES', inSites === 1);
  }

  /* 4. 重复检测 */
  await page.click('.nm-fab');
  await sleep(300);
  await page.click('.nm-menu-item[data-a="pick"]');
  await sleep(300);
  await page.evaluate(() => {
    const m = window.TopicEngine._map;
    m.fire('click', { latlng: L.latLng(39.92, 116.40) });
  });
  await sleep(500);
  await page.type('#nmName', '测试小茶馆');
  await sleep(400);
  const dupWarn = await page.evaluate(() => (document.querySelector('.nm-dup') || {}).textContent || '');
  ok('重复节点实时提示', dupWarn.includes('附近已有相似节点'));
  await page.click('#nmCancel');
  await sleep(300);

  /* 5. 我的节点列表 → 删除（含确认） */
  await page.click('.nm-fab');
  await sleep(300);
  await page.click('.nm-menu-item[data-a="mine"]');
  await sleep(400);
  const listHas = await page.evaluate(() => (document.querySelector('#nmList') || {}).textContent || '');
  ok('列表显示已添加节点', listHas.includes('测试小茶馆'));
  await page.evaluate(() => window.TopicEngine.delUserNode(JSON.parse(localStorage.getItem('tn_userNodes'))[0].id));
  await sleep(500);
  const confirmShown = await page.evaluate(() => !!document.querySelector('.ui-modal-mask.show .ui-btn-primary.danger'));
  ok('删除确认框弹出', confirmShown);
  if (confirmShown) {
    await page.click('.ui-modal-mask.show .ui-btn-primary.danger');
    await sleep(600);
    const delPersist = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_userNodes') || '[]').length);
    ok('删除已持久化', delPersist === 0);
    const inSitesAfter = await page.evaluate(() => (window.SITES || []).filter(x => x.source === 'user').length);
    ok('节点从 SITES 移除', inSitesAfter === 0);
  }

  /* 6. 区域统计条（高 zoom 后 moveend 触发） */
  await page.evaluate(() => {
    window.TopicEngine._map.setView([39.92, 116.40], 11);
  });
  let statsTxt = '';
  for (let i = 0; i < 8; i++) {
    await sleep(600);
    statsTxt = await page.evaluate(() => (document.querySelector('.region-stats') || {}).textContent || '');
    if (statsTxt.includes('当前区域')) break;
  }
  ok('区域统计条出现', statsTxt.includes('当前区域'), statsTxt.slice(0, 40));

  /* 7. 筛选双态：高 zoom 节点渲染模式下，主题筛选非匹配节点 tr-dim */
  await page.evaluate(() => {
    window.TopicEngine._map.setView([39.92, 116.40], 12);
  });
  await sleep(1500);
  const beforeDim = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  ok('高 zoom 节点已渲染', beforeDim > 0, 'nodes=' + beforeDim);
  await page.evaluate(() => {
    const chips = document.querySelectorAll('#dynChips .chip');
    for (const c of chips) { if (c.textContent.includes('古建')) { c.click(); break; } }
  });
  await sleep(1500);
  const dimCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-dim').length);
  const allCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  ok('筛选双态：非匹配节点降透明', dimCount > 0 && allCount > dimCount, 'dim=' + dimCount + ' total=' + allCount);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));

  await browser.close();
  console.log(fails ? '=== NODES SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== NODES SMOKE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
