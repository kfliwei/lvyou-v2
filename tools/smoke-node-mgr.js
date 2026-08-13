/* tools/smoke-node-mgr.js — node-manager.html 空地图节点管理工作台冒烟 + 专题页无节点管理验证 */
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

  /* ============ A. 节点管理页 ============ */
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  const init = await page.evaluate(() => ({
    map: !!document.querySelector('#mapEl.leaflet-container'),
    fab: !!document.querySelector('.nm-fab'),
    mineBtn: !!document.querySelector('#mineBtn'),
    sites: (window.NATION_SITES_RAW || '').split('\n').length,
    userMerged: (window.SITES || []).length
  }));
  ok('A.空地图初始化', init.map && init.fab && init.mineBtn);
  ok('A.系统节点索引加载', init.sites === 7782, 'sites=' + init.sites);

  /* 高 zoom 显示节点（含 LOD） */
  await page.evaluate(() => { window.NM && window.NM._map ? 0 : 0; });
  /* 通过地图容器拿实例不可行，直接检查 LOD 渲染后的 DOM */
  await page.evaluate(() => {
    const m = document.querySelector('#mapEl');
    if (m && m._leaflet_id) { /* leaflet 实例从 window 拿不到，用 setView 模拟：直接触发 moveend 即可 */
    }
  });
  /* 用 Leaflet 全局拿不到 map 实例，验证区域统计条通过 moveend 触发即可 */
  const stats = await page.evaluate(() => {
    const el = document.querySelector('.region-stats');
    return el ? el.textContent.slice(0, 40) : '';
  });
  ok('A.初始视野统计条', stats.includes('当前区域'), stats);

  /* FAB 菜单 */
  await page.click('.nm-fab');
  await sleep(300);
  const menu = await page.evaluate(() => document.querySelectorAll('.nm-menu-item').length);
  ok('A.FAB 菜单 4 项', menu === 4);

  /* 地图选点 → 表单 → 保存：先关闭菜单，预置数据后 reload 验证链路 */
  await page.click('#nmMenuClose');
  await sleep(300);
  await page.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'test1', name: '测试茶馆', lat: 39.92, lng: 116.40, province: '北京市', city: '北京', category: '茶馆', tags: ['拍照'], desc: '测试节点', createdAt: Date.now() }]));
  });
  /* 重新加载让预置用户节点进入 SITES，缩放到北京查看节点图标 */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.evaluate(() => {
    window.NM.map.setView([39.92, 116.40], 12);
  });
  await sleep(1500);
  const userNode = await page.evaluate(() => {
    const els = document.querySelectorAll('#mapEl .tr-user');
    return els.length;
  });
  ok('A.用户节点绿色图标渲染', userNode > 0, 'tr-user=' + userNode);

  /* 我的节点列表 */
  await page.click('#mineBtn');
  await sleep(400);
  const mineTxt = await page.evaluate(() => (document.querySelector('#nmList') || {}).textContent || '');
  ok('A.我的节点列表显示', mineTxt.includes('测试茶馆'));

  /* 编辑 */
  await page.evaluate(() => window.NM.edit('test1'));
  await sleep(400);
  const formName = await page.evaluate(() => (document.getElementById('nmName') || {}).value || '');
  ok('A.编辑表单回填', formName === '测试茶馆');
  await page.evaluate(() => {
    const el = document.getElementById('nmName');
    el.value = '测试茶馆2';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#nmSave');
  await sleep(600);
  const renamed = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_userNodes'))[0].name);
  ok('A.编辑保存生效', renamed === '测试茶馆2', renamed);

  /* 删除（带确认） */
  await page.evaluate(() => window.NM.remove('test1'));
  await sleep(500);
  await page.click('.ui-modal-mask.show .ui-btn-primary.danger');
  await sleep(600);
  const afterDel = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_userNodes') || '[]').length);
  ok('A.删除持久化', afterDel === 0);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('A.无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await page.close();

  /* ============ B. 专题页：无节点管理功能 ============ */
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  page2.on('pageerror', e => errs2.push('pageerror: ' + e.message.slice(0, 150)));
  await page2.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const b = await page2.evaluate(() => ({
    fab: !!document.querySelector('.nm-fab'),
    engineHasEdit: typeof (window.TopicEngine && window.TopicEngine.editUserNode),
    stats: !!(document.querySelector('.region-stats'))
  }));
  ok('B.专题页无 FAB', !b.fab);
  ok('B.专题页无节点管理 API', b.engineHasEdit === 'undefined');
  /* 先缩放触发统计条 */
  await page2.evaluate(() => {
    window.TopicEngine._map.setView([39.92, 116.40], 11);
  });
  await sleep(1500);
  const statsAfter = await page2.evaluate(() => (document.querySelector('.region-stats') || {}).textContent || '');
  ok('B.专题页区域统计保留', statsAfter.includes('当前区域'), statsAfter.slice(0, 30));
  /* 打开节点详情，确认无编辑/删除菜单 */
  await page2.evaluate(() => {
    const m = window.TopicEngine._map;
    m.setView([39.92, 116.40], 13);
  });
  await sleep(1200);
  await page2.evaluate(() => {
    const n = document.querySelector('#mapEl .tr-node');
    if (n) n.click();
  });
  await sleep(600);
  const sheetTxt = await page2.evaluate(() => (document.querySelector('#locSheet') || {}).textContent || '');
  ok('B.节点详情无编辑删除菜单', !sheetTxt.includes('编辑节点') && !sheetTxt.includes('删除节点'));
  const real2 = errs2.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('B.无脚本错误', real2.length === 0, real2.join(' | ').slice(0, 120));
  await page2.close();

  await browser.close();
  console.log(fails ? '=== NODE-MGR SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== NODE-MGR SMOKE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
