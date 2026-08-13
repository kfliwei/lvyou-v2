/* 验证：规范节点管理功能（FAB/长按/表单新字段/详情操作/列表增强） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4500));

  /* 1. FAB + 菜单 */
  ok('FAB 存在', !!(await page.$('.nm-fab')));
  await page.click('.nm-fab');
  await new Promise(r => setTimeout(r, 400));
  const menu = await page.evaluate(() => [...document.querySelectorAll('.nm-menu-item')].map(b => b.dataset.a).join(','));
  ok('FAB 菜单 4 项', menu === 'pick,cur,search,mine', menu);

  /* 2. 地图选点 → 表单（含地址/照片/移动位置字段） */
  await page.click('.nm-menu-item[data-a="pick"]');
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const m = window.NM.map; if (m) m.fire('click', { latlng: L.latLng(39.92, 116.40) }); });
  await new Promise(r => setTimeout(r, 700));
  const form = await page.evaluate(() => ({
    open: !!document.querySelector('.nm-form'),
    addr: !!document.getElementById('nmAddr'),
    photo: !!document.getElementById('nmPhotoBox'),
    file: !!document.getElementById('nmFile'),
    elev: !!document.getElementById('nmElev'),
    gen: !!document.getElementById('nmGenDesc')
  }));
  ok('选点打开表单', form.open);
  ok('表单含地址字段', form.addr);
  ok('表单含照片入口', form.photo && form.file);
  ok('表单含海拔/AI生成', form.elev && form.gen);
  await page.evaluate(() => { const b = document.getElementById('nmCancel'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));

  /* 3. 桌面右键等效长按 → 表单 */
  await page.evaluate(() => { const m = window.NM.map; if (m) m.fire('contextmenu', { latlng: L.latLng(30.2, 120.1) }); });
  await new Promise(r => setTimeout(r, 700));
  const longPressForm = await page.evaluate(() => !!document.querySelector('.nm-form'));
  ok('长按/右键快速添加', longPressForm);
  await page.evaluate(() => { const b = document.getElementById('nmCancel'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));

  /* 4. 预置用户节点 → 详情新操作（想去/语音记录） */
  await page.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 's1', name: '规范测试点', lat: 39.92, lng: 116.40, gcj: false, province: '北京市', city: '北京', category: '茶馆', tags: [], desc: 'x', elev: '50', address: '东城区某巷', createdAt: Date.now() }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));
  /* 搜索定位到用户节点 → 打开详情 */
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '规范测试点';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { const it = document.querySelector('#rsBody .rs-item'); if (it) it.click(); });
  await new Promise(r => setTimeout(r, 700));
  const info = await page.evaluate(() => (document.querySelector('#infoSheet') || {}).textContent || '');
  ok('用户节点详情含想去', info.includes('想去'), info.slice(0, 50));
  ok('用户节点详情含语音记录', info.includes('语音记录'));
  ok('用户节点详情含地址海拔', info.includes('东城区某巷') && info.includes('50'));
  /* 点想去 → 状态切换 */
  await page.evaluate(() => { window.NM.toggleWish('s1'); });
  await new Promise(r => setTimeout(r, 600));
  const wished = await page.evaluate(() => {
    const txt = (document.querySelector('#infoSheet') || {}).textContent || '';
    return txt.includes('已想去');
  });
  ok('想去状态切换', wished);
  /* 清理 */
  await page.evaluate(() => {
    localStorage.removeItem('tn_userNodes');
    const wl = JSON.parse(localStorage.getItem('***') || '[]');
    localStorage.setItem('***', JSON.stringify(wl.filter(x => !String(x.id || '').includes('规范测试点'))));
  });
  await page.evaluate(() => window.NM.closeInfo());

  /* 5. 系统节点详情：想去 + 语音记录 */
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '故宫';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { const it = document.querySelector('#rsBody .rs-item'); if (it) it.click(); });
  await new Promise(r => setTimeout(r, 700));
  const sysInfo = await page.evaluate(() => (document.querySelector('#infoSheet') || {}).textContent || '');
  ok('系统节点详情含想去/语音记录', sysInfo.includes('想去') && sysInfo.includes('语音记录'));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await browser.close();
  console.log(fails ? '=== SPEC FAIL ===' : '=== SPEC ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
