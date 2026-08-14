/* 验证：跨天起点站衔接 + 导出面板提示 */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  // 6 个节点分布 3 省，跨天必然发生
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: 'A|39.9|116.4', label: '北京A', lat: 39.9, lng: 116.4, region: '北京市', city: '北京', theme: '城市地标', ts: Date.now(), visited: 0 },
      { id: 'B|39.7|116.2', label: '北京B', lat: 39.7, lng: 116.2, region: '北京市', city: '北京', theme: '城市地标', ts: Date.now(), visited: 0 },
      { id: 'C|30.2|120.1', label: '杭州C', lat: 30.2, lng: 120.1, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: 'D|30.3|120.2', label: '杭州D', lat: 30.3, lng: 120.2, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: 'E|31.2|121.4', label: '上海E', lat: 31.2, lng: 121.4, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 },
      { id: 'F|31.3|121.5', label: '上海F', lat: 31.3, lng: 121.5, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { document.getElementById('wlPlanBtn').click(); });
  await new Promise(r => setTimeout(r, 2500));

  // 1. 跨天起点站检查
  const link = await page.evaluate(() => {
    const days = window.__planDays || [];
    if (days.length < 2) return { multiDay: false };
    const d2 = days[1];
    return {
      multiDay: true,
      d1End: days[0][days[0].length - 1].label,
      d2StartIsStart: !!(d2[0] && d2[0].isStart),
      d2StartLabel: d2[0] ? d2[0].label : null,
      same: d2[0] && d2[0].label === days[0][days[0].length - 1].label
    };
  });
  ok('跨天发生且 D2 首站为起点站', link.multiDay && link.d2StartIsStart, JSON.stringify(link));
  ok('D2 起点站 = D1 末站', link.same === true, link.d2StartLabel + ' vs ' + link.d1End);

  // 2. 渲染：起点行显示"起"
  const ui = await page.evaluate(() => {
    const txt = document.getElementById('wlPlan').textContent;
    return {
      hasStartRow: txt.includes('起') && txt.includes('本天出发地'),
      navBtns: [...document.querySelectorAll('#wlPlan button')].filter(b => b.textContent.includes('导航')).length
    };
  });
  ok('起点行渲染（起 · 本天出发地）', ui.hasStartRow, '');
  ok('每天导航按钮存在', ui.navBtns >= 2, 'nav=' + ui.navBtns);

  // 3. 起点站锁定：起点行（含起点文案、无移动按钮）
  const lock = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#wlPlan div')].filter(d => d.textContent.includes('本天出发地') && d.textContent.length < 60 && !d.textContent.includes('↑') && !d.textContent.includes('↓'));
    return rows.length > 0;
  });
  ok('起点行无移动按钮（锁定）', lock, '');

  // 4. 导出面板提示
  await page.evaluate(() => { const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 400));
  const msg = await page.evaluate(() => {
    const bar = document.getElementById('planMsg');
    return bar ? { display: bar.style.display, text: bar.textContent } : null;
  });
  ok('导出面板提示条出现', msg && msg.display === 'block' && /导出/.test(msg.text), JSON.stringify(msg));
  await new Promise(r => setTimeout(r, 1600));
  const msg2 = await page.evaluate(() => {
    const bar = document.getElementById('planMsg');
    return bar ? bar.textContent : null;
  });
  ok('导出完成提示（含文件名）', msg2 && /已导出|已保存/.test(msg2) && /\.gpx/.test(msg2), msg2);

  // 5. 空计划提示：清空 __planDays 模拟
  await page.evaluate(() => { window.__planDays = []; });
  await page.evaluate(() => { const b = document.querySelector('#wlPlan [onclick*="__exportPlan"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));
  const emptyMsg = await page.evaluate(() => {
    const bar = document.getElementById('planMsg');
    return bar ? bar.textContent : null;
  });
  ok('不符合条件时明确提示', /请先规划行程/.test(emptyMsg || ''), emptyMsg);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== PLAN-LINK CHECK FAIL ===' : '=== PLAN-LINK CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
