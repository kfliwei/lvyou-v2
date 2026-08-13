/* tools/smoke-node-mgr.js — 节点管理页冒烟（实时模糊搜索 + 高德 Key 流程 + 表单海拔/AI介绍 + 我的节点）
 * 高德 POI/逆地理/海拔真实调用需有效 Key，测试覆盖 UI 链路；Open-Meteo 海拔在无 Key 时也会尝试（网络可用则自动填充）
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

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  const init = await page.evaluate(() => ({
    map: !!document.querySelector('#mapEl.leaflet-container'),
    nodes: document.querySelectorAll('#mapEl .tr-node, #mapEl .leaflet-marker-icon').length,
    idx: (window.NATION_SITES_RAW || '').split('\n').length
  }));
  ok('A.空地图初始化', init.map);
  ok('A.地图不显示任何节点', init.nodes === 0, 'markers=' + init.nodes);
  ok('A.本地索引就绪', init.idx === 7782, 'idx=' + init.idx);

  /* 实时模糊搜索：输入"故"（不点按钮）→ 自动出结果 */
  await page.type('#q', '故');
  await sleep(900);
  const rs1 = await page.evaluate(() => ({
    sheet: !!document.querySelector('#rsSheet.show'),
    sec: (document.querySelector('#rsBody .rs-sec') || {}).textContent || '',
    items: document.querySelectorAll('#rsBody .rs-item').length
  }));
  ok('A.实时搜索：输入即出结果', rs1.sheet && rs1.sec.includes('本地节点') && rs1.items > 0, rs1.sec + ' / items=' + rs1.items);
  /* 继续输入补全 → 结果更新 */
  await page.type('#q', '宫');
  await sleep(900);
  const rs2 = await page.evaluate(() => (document.querySelector('#rsBody .rs-item .nm') || {}).textContent || '');
  ok('A.实时搜索：模糊补全更新结果', rs2.includes('故宫'), rs2.slice(0, 20));
  await page.evaluate(() => { const it = document.querySelector('#rsBody .rs-item'); if (it) it.click(); });
  await sleep(600);
  const infoTxt = await page.evaluate(() => (document.querySelector('#infoSheet') || {}).textContent || '');
  ok('A.本地节点详情（已存在）', infoTxt.includes('系统节点'), infoTxt.slice(0, 30));
  await page.evaluate(() => window.NM.closeInfo());
  await sleep(300);
  /* 清空输入 → 面板关闭 */
  await page.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(500);
  const closed = await page.evaluate(() => !document.querySelector('#rsSheet.show'));
  ok('A.清空输入关闭结果面板', closed);

  /* 无结果 → 高德 Key 弹窗 */
  await page.evaluate(() => { document.getElementById('q').value = 'zzzz不存在的茶馆xyz'; });
  await page.type('#q', 'z');
  await sleep(900);
  const keyDlg = await page.evaluate(() => (document.querySelector('.nm-form .ui-modal-title') || {}).textContent || '');
  ok('A.无结果触发高德 Key 配置', keyDlg.includes('高德搜索 Key'), keyDlg);
  await page.evaluate(() => { const b = document.getElementById('akCancel'); if (b) b.click(); });
  await sleep(300);
  await page.evaluate(() => { document.getElementById('q').value = ''; });

  /* 表单新字段：海拔输入 + AI 介绍按钮 + 保存含海拔 */
  await page.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'test1', name: '测试茶馆', lat: 39.92, lng: 116.40, gcj: false, province: '北京市', city: '北京', category: '茶馆', tags: ['拍照'], desc: '测试', elev: '120', createdAt: Date.now() }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.evaluate(() => window.NM.edit('test1'));
  await sleep(600);
  const form = await page.evaluate(() => ({
    name: (document.getElementById('nmName') || {}).value || '',
    elev: (document.getElementById('nmElev') || {}).value || '',
    genBtn: !!document.getElementById('nmGenDesc'),
    elevGo: !!document.getElementById('nmElevGo')
  }));
  ok('A.编辑回填（含海拔）', form.name === '测试茶馆' && form.elev === '120', 'elev=' + form.elev);
  ok('A.表单含海拔获取按钮', form.elevGo);
  ok('A.表单含 AI 生成介绍按钮', form.genBtn);
  /* 改名保存（不误报自身） */
  await page.evaluate(() => {
    const el = document.getElementById('nmName');
    el.value = '测试茶馆2';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(400);
  const dup = await page.evaluate(() => (document.querySelector('.nm-dup') || {}).textContent || '');
  ok('A.编辑改名不误报自身重复', !dup.includes('附近已有'), dup.slice(0, 30));
  await page.click('#nmSave');
  await sleep(600);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_userNodes'))[0]);
  ok('A.保存生效（含海拔）', saved.name === '测试茶馆2' && saved.elev === '120', 'elev=' + saved.elev);
  await page.evaluate(() => window.NM.remove('test1'));
  await sleep(500);
  await page.click('.ui-modal-mask.show .ui-btn-primary.danger');
  await sleep(600);
  const afterDel = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_userNodes') || '[]').length);
  ok('A.删除持久化', afterDel === 0);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest|open-meteo/.test(e));
  ok('A.无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await page.close();

  /* ============ B. 专题页无节点管理 ============ */
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  page2.on('pageerror', e => errs2.push('pageerror: ' + e.message.slice(0, 150)));
  await page2.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const b = await page2.evaluate(() => ({
    fab: !!document.querySelector('.nm-fab'),
    editApi: typeof (window.TopicEngine && window.TopicEngine.editUserNode)
  }));
  ok('B.专题页无 FAB', !b.fab);
  ok('B.专题页无节点管理 API', b.editApi === 'undefined');
  await page2.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 13); });
  await sleep(1500);
  await page2.evaluate(() => { const n = document.querySelector('#mapEl .tr-node'); if (n) n.click(); });
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
