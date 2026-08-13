/* 验证：节点保存后地图可见 + 编辑/删除同步 + 定位 */
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
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => { localStorage.removeItem('tn_userNodes'); });

  /* 保存 → marker 出现 */
  await page.evaluate(() => window.NM.edit('nope')); /* no-op 保底 */
  await page.evaluate(() => {
    /* 直接走保存链路：预置一个节点并通过编辑保存触发 placeUserMarker */
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'm1', name: '可见性测试点', lat: 39.92, lng: 116.40, gcj: false, province: '北京市', city: '北京', category: '其他', tags: [], desc: '', createdAt: Date.now() }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));
  /* 编辑保存（触发 placeUserMarker） */
  await page.evaluate(() => window.NM.edit('m1'));
  await new Promise(r => setTimeout(r, 500));
  await page.click('#nmSave');
  await new Promise(r => setTimeout(r, 600));
  const afterSave = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-user').length);
  ok('保存后地图显示用户节点标记', afterSave === 1, 'tr-user=' + afterSave);

  /* marker 点击 → 信息面板 */
  await page.evaluate(() => {
    const m = document.querySelector('#mapEl .tr-user');
    if (m) m.closest('.leaflet-marker-icon').click();
  });
  await new Promise(r => setTimeout(r, 500));
  const info = await page.evaluate(() => (document.querySelector('#infoSheet') || {}).textContent || '');
  ok('标记点击打开信息面板', info.includes('可见性测试点') && info.includes('我的节点'));
  await page.evaluate(() => window.NM.closeInfo());
  await new Promise(r => setTimeout(r, 200));

  /* 删除 → marker 移除 */
  await page.evaluate(() => window.NM.remove('m1'));
  await new Promise(r => setTimeout(r, 500));
  await page.click('.ui-modal-mask.show .ui-btn-primary.danger');
  await new Promise(r => setTimeout(r, 600));
  const afterDel = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-user').length);
  ok('删除后标记移除', afterDel === 0, 'tr-user=' + afterDel);

  /* 定位：预置 → locate → flyTo + marker */
  await page.evaluate(() => {
    localStorage.setItem('tn_userNodes', JSON.stringify([{ id: 'm2', name: '定位测试点', lat: 30.25, lng: 120.15, gcj: false, province: '浙江省', city: '杭州', category: '其他', tags: [], desc: '', createdAt: Date.now() }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => window.NM.locate('m2'));
  await new Promise(r => setTimeout(r, 1600));
  const loc = await page.evaluate(() => {
    const c = document.querySelector('#mapEl .leaflet-container');
    return { marker: document.querySelectorAll('#mapEl .tr-user').length, info: (document.querySelector('#infoSheet') || {}).textContent || '' };
  });
  ok('定位：flyTo 并显示标记+信息', loc.marker === 1 && loc.info.includes('定位测试点'), 'marker=' + loc.marker);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== VISIBLE FAIL ===' : '=== VISIBLE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
