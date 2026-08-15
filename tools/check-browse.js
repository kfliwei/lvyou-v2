/* 验证：浏览弹层 + 删除/清空/当前位置 + 重新规划 + 地图真实路线降级 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  /* stub geolocation */
  await p.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (ok, err) => ok({ coords: { latitude: 30.57, longitude: 104.06 } }) }, configurable: true });
  });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 输入意图 → 勾选 3 个 */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去云南玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    for (let i = 0; i < 3; i++) cs[i].click();
  });
  await sleep(600);
  /* 1. 浏览按钮存在 */
  const b1 = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#summbar button')].map(b => b.textContent.trim());
    return { has: btns.includes('👁 浏览'), btns };
  });
  ok('summbar 有浏览按钮', b1.has, b1.btns.join('|'));
  /* 2. 点浏览 → 弹层 3 项 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(500);
  const b2 = await p.evaluate(() => ({
    mask: !!document.getElementById('browseMask'),
    items: document.querySelectorAll('#browseMask [style*="border-bottom"]').length,
    title: (document.querySelector('#browseMask b') || { textContent: '' }).textContent
  }));
  ok('浏览弹层显示已选 3 项', b2.mask && b2.items === 3, b2.title + ' items=' + b2.items);
  /* 3. 删除第 1 项 → 剩 2 项 */
  await p.evaluate(() => { const b = document.querySelector('#browseMask button[onclick*="plannerRemovePick(0)"]'); if (b) b.click(); });
  await sleep(500);
  const b3 = await p.evaluate(() => ({
    items: document.querySelectorAll('#browseMask [style*="border-bottom"]').length,
    summ: (document.getElementById('summInfo') || { textContent: '' }).textContent
  }));
  ok('删除单项后剩 2', b3.items === 2 && /已选 <b>2<\/b>|已选/.test(b3.summ), 'items=' + b3.items + ' ' + b3.summ.replace(/<[^>]+>/g, '').slice(0, 20));
  /* 4. 加入当前位置 → 3 项 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('当前位置')); if (b) b.click(); });
  await sleep(700);
  const b4 = await p.evaluate(() => ({
    items: document.querySelectorAll('#browseMask [style*="border-bottom"]').length,
    hasCur: (document.querySelector('#browseMask') || { textContent: '' }).textContent.includes('当前位置')
  }));
  ok('加入当前位置', b4.items === 3 && b4.hasCur, 'items=' + b4.items);
  /* 5. 清空 → 弹层关 + summbar 隐藏 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('清空')); if (b) b.click(); });
  await sleep(500);
  const b5 = await p.evaluate(() => ({
    mask: !!document.getElementById('browseMask'),
    bar: document.getElementById('summbar').style.display
  }));
  ok('清空后关闭弹层', !b5.mask && b5.bar === 'none', 'bar=' + b5.bar);
  /* 6. 重新勾选 2 → 排期 → actRow 有重新规划 + 地图降级不崩 */
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand, [class*="cand"]');
    for (let i = 0; i < 2; i++) cs[i].click();
  });
  await sleep(400);
  await p.evaluate(() => { const b = document.getElementById('scheduleBtn'); if (b) b.click(); });
  await sleep(2500);
  const b6 = await p.evaluate(() => ({
    resched: [...document.querySelectorAll('#actRow button')].some(b => /重新|规划/.test(b.textContent)),
    lines: document.querySelectorAll('.leaflet-overlay-pane svg path, .leaflet-overlay-pane path').length,
    mapBox: !!document.getElementById('mapBox')
  }));
  ok('重新规划按钮存在', b6.resched, 'actRow 有重新规划');
  ok('地图渲染（降级直线）', b6.mapBox && b6.lines > 0, 'path=' + b6.lines);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== BROWSE FAIL ===' : '=== BROWSE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
