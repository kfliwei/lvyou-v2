/* 复现心愿单页：打卡/记录/移除无响应 + 规划不显示地图 + 滚动问题 */
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
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|manifest/.test(m.text())) console.log('CONSOLE:', m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));

  // 注入 3 个心愿节点
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '长城|40.36|116.02', label: '长城', lat: 40.36, lng: 116.02, region: '北京市', city: '北京', theme: '关隘长城', ts: Date.now(), visited: 0 },
      { id: '颐和园|39.99|116.27', label: '颐和园', lat: 39.99, lng: 116.27, region: '北京市', city: '北京', theme: '皇家园林', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1800));

  // 列表渲染检查
  const items = await page.evaluate(() => document.querySelectorAll('.wl-item').length);
  ok('心愿列表渲染', items === 3, 'items=' + items);

  // 0. 规划行程 → 地图显示 + 可滚动（数据 3 个未打卡）
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2500));
  const plan = await page.evaluate(() => ({
    mapDisp: document.getElementById('wlMap').style.display,
    planDisp: document.getElementById('wlPlan').style.display,
    markers: document.querySelectorAll('#wlMap .leaflet-marker-icon').length,
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    bodyScroll: getComputedStyle(document.body).overflowY
  }));
  ok('规划后地图显示', plan.mapDisp === 'block' && plan.markers > 0, JSON.stringify(plan));
  ok('页面可滚动', plan.scrollH > plan.clientH, 'scrollH=' + plan.scrollH + ' clientH=' + plan.clientH);

  // 3. 移除（UI.confirm 弹窗 → 点确认）
  await page.evaluate(() => { const b = document.querySelector('.wl-remove'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.ui-modal button, .ui-dlg button, .ui-confirm button')];
    const okBtn = btns.find(b => /移除|确定|OK/.test(b.textContent));
    if (okBtn) okBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const afterRemove = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_wishlist') || '[]').length);
  ok('移除生效', afterRemove < 3, 'count=' + afterRemove);

  // 4. 页面宽度溢出检查（排除地图内部元素——被 #wlMap overflow:hidden 裁剪）
  const overflow = await page.evaluate(() => {
    let max = 0, el = '';
    const wlMap = document.getElementById('wlMap');
    document.querySelectorAll('body *').forEach(e => {
      if (wlMap && wlMap.contains(e)) return;
      const r = e.getBoundingClientRect();
      if (r.right > max && r.width > 50) { max = r.right; el = e.className || e.id || e.tagName; }
    });
    return { maxRight: Math.round(max), el };
  });
  ok('无横向溢出', overflow.maxRight <= 391, JSON.stringify(overflow));

  console.log(fails ? '=== WL REPRO FAIL: ' + fails + ' ===' : '=== WL REPRO ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
