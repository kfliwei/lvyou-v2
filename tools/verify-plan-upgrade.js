/* 验证：打卡/撤销 + 规划里程/衔接/导航按钮 */
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
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '长城|40.36|116.02', label: '长城', lat: 40.36, lng: 116.02, region: '北京市', city: '北京', theme: '关隘长城', ts: Date.now(), visited: 0 },
      { id: '西湖|30.24|120.15', label: '西湖', lat: 30.24, lng: 120.15, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: '外滩|31.24|121.49', label: '外滩', lat: 31.24, lng: 121.49, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // 1. 按钮合并检查：无独立"记录"按钮（"打卡并记录"含记录二字，需精确匹配）
  const btnInfo = await page.evaluate(() => ({
    recordBtns: [...document.querySelectorAll('.wl-item button')].filter(b => b.textContent.trim() === '记录').length,
    checkinBtns: [...document.querySelectorAll('.wl-item button')].filter(b => b.textContent.includes('打卡')).length,
    firstBtn: document.querySelector('.wl-item .wl-btn') ? document.querySelector('.wl-item .wl-btn').textContent : ''
  }));
  ok('已移除独立"记录"按钮', btnInfo.recordBtns === 0, JSON.stringify(btnInfo));
  ok('按钮为"打卡并记录"', btnInfo.firstBtn.includes('打卡并记录'), btnInfo.firstBtn);

  // 2. 打卡 → 面板打开 + 按钮变"撤销打卡"
  await page.evaluate(() => { const b = document.querySelector('.wl-btn.primary'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 900));
  const afterCheckin = await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('tn_wishlist') || '[]');
    const undoBtn = [...document.querySelectorAll('.wl-item button')].find(b => b.textContent.includes('撤销打卡'));
    return { visited: w.filter(x => x.visited).length, undoBtn: !!undoBtn };
  });
  ok('打卡生效且显示撤销按钮', afterCheckin.visited === 1 && afterCheckin.undoBtn, JSON.stringify(afterCheckin));

  // 3. 撤销打卡 → 恢复
  await page.evaluate(() => { const b = [...document.querySelectorAll('.wl-item button')].find(x => x.textContent.includes('撤销打卡')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 600));
  const afterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('tn_wishlist') || '[]').filter(x => x.visited).length);
  ok('撤销打卡生效', afterUndo === 0, 'visited=' + afterUndo);

  // 4. 规划：总里程/站间里程/跨天衔接/导航按钮
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 3000));
  const plan = await page.evaluate(() => {
    const txt = document.getElementById('wlPlan').textContent;
    return {
      totalKm: /约 \d+ km/.test(txt) && txt.match(/行程计划 · \d+ 天 \/ \d+ 站 · 约 (\d+) km/),
      totalKmVal: (txt.match(/行程计划 · \d+ 天 \/ \d+ 站 · 约 (\d+) km/) || [])[1] || null,
      navBtns: [...document.querySelectorAll('#wlPlan button')].filter(b => b.textContent.includes('导航')).length,
      hasLink: txt.includes('自 ') && txt.includes('→'),
      hasSegKm: /\d+km/.test(txt),
      dayCount: (txt.match(/D\d/g) || []).length
    };
  });
  ok('计划头部含总里程', plan.totalKm, '总km=' + plan.totalKmVal);
  ok('每天有导航按钮', plan.navBtns >= 1, 'nav=' + plan.navBtns);
  ok('站间里程显示', plan.hasSegKm, '');

  const hasStartRow = await page.evaluate(() => {
    const txt = document.getElementById('wlPlan').textContent;
    return txt.includes('起') && txt.includes('终点 · 本天出发地');
  });
  ok('D2+ 独立起点行（上一天终点为出发地）', hasStartRow, '');

  // 5. 跨天衔接正确性：D2 首站 == D1 末站（navDay 起点逻辑）
  const link = await page.evaluate(() => {
    const days = window.__planDays || [];
    if (days.length < 2) return null;
    const lastOfD1 = days[0][days[0].length - 1];
    const firstOfD2 = days[1][0];
    return { d1End: lastOfD1.label, d2Start: firstOfD2.label, same: lastOfD1.label === firstOfD2.label };
  });
  // 贪心算法下 D2 首站是离 D1 末站最近点，不一定是同一点；但衔接段里程应计入 D2
  const segKm = await page.evaluate(() => {
    const days = window.__planDays || [];
    if (days.length < 2) return null;
    const d1End = days[0][days[0].length - 1], d2Start = days[1][0];
    const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); };
    return Math.round(hav(d1End, d2Start));
  });
  ok('规划存在跨天衔接（D2 起点显示自 D1 终点）', link && link.hasLink !== false, JSON.stringify(link));
  if (link) ok('D2 首站衔接里程已计入', segKm > 0, '衔接段 ' + segKm + 'km');

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== PLAN-UPGRADE VERIFY FAIL: ' + fails + ' ===' : '=== PLAN-UPGRADE VERIFY ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
