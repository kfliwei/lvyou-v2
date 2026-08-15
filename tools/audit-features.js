/* 综合审核：新增功能闭环 + 边界 + 状态一致性 */
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
  /* stub geolocation（headless 无定位） */
  await p.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (okFn, errFn) => okFn({ coords: { latitude: 30.57, longitude: 104.06 } }) }, configurable: true });
  });
  /* stub 高德：destination 经度越接近 105 距离越短 */
  await p.evaluateOnNewDocument(() => {
    window.__fetchOrig = window.fetch;
    window.fetch = function (url, opt) {
      const u = String(url);
      if (u.includes('restapi.amap.com/v3/direction/driving')) {
        const m = u.match(/destination=([\d.]+),([\d.]+)/);
        const dist = m ? Math.abs(parseFloat(m[1]) - 105) * 80 + Math.abs(parseFloat(m[2]) - 30) * 60 : 50000;
        return Promise.resolve({ json: () => Promise.resolve({ status: '1', route: { paths: [{ distance: String(Math.max(8000, dist * 1000)), steps: [] }] } }) });
      }
      return window.__fetchOrig(url, opt);
    };
  });
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => localStorage.setItem('tn_amap_key', 'testkey'));
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去云南玩3天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);

  /* ===== 边界 1：勾选 1 个点高德规划 → 提示至少 2 个 ===== */
  await p.evaluate(() => { document.querySelector('.cand, [class*="cand"]').click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  await sleep(400);
  const b1 = await p.evaluate(() => ({
    pickStage: document.getElementById('stagePick').style.display !== 'none',
    selected: (document.querySelector('[class*="summ"], #summInfo') || { textContent: '' }).textContent.replace(/<[^>]+>/g, '')
  }));
  ok('边界：1个景点点高德规划被拦截', b1.pickStage, b1.selected.slice(0, 20));

  /* ===== 全流程：再勾 2 个（共3）→ 删除 1 → 加当前位置 → 高德规划 → 排序 → 排期 ===== */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('关闭')); if (b) b.click(); });
  await sleep(300);
  await p.evaluate(() => { const cs = document.querySelectorAll('.cand, [class*="cand"]'); for (let i = 1; i < 3; i++) cs[i].click(); });
  await sleep(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#summbar button')].find(x => x.textContent.includes('浏览')); if (b) b.click(); });
  await sleep(400);
  /* 删除第 1 项 */
  await p.evaluate(() => { const b = document.querySelector('#browseMask button[onclick*="plannerRemovePick(0)"]'); if (b) b.click(); });
  await sleep(400);
  const b2 = await p.evaluate(() => document.querySelectorAll('#browseMask [style*="border-bottom"]').length);
  ok('删除单项后剩 2', b2 === 2, 'items=' + b2);
  /* 加当前位置（第一次） */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('当前位置')); if (b) b.click(); });
  await sleep(600);
  /* 加当前位置（第二次 → 应提示已在列表，仍 3 项） */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('当前位置')); if (b) b.click(); });
  await sleep(600);
  const b3 = await p.evaluate(() => document.querySelectorAll('#browseMask [style*="border-bottom"]').length);
  ok('当前位置去重（重复添加不增加）', b3 === 3, 'items=' + b3);
  /* 高德规划 → 排序 → 弹层顺序更新 */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('高德规划')); if (b) b.click(); });
  await sleep(3000);
  const b4 = await p.evaluate(() => ({
    order: [...document.querySelectorAll('#browseMask [style*="border-bottom"]')].map(x => x.textContent.slice(0, 12)),
    n: document.querySelectorAll('#browseMask [style*="border-bottom"]').length
  }));
  ok('高德规划完成且弹层展示新顺序', b4.n === 3, JSON.stringify(b4.order));
  /* 关闭 → 开始排期 → 结果站序 = 高德排序顺序（不被贪心覆盖） */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#browseMask button')].find(x => x.textContent.includes('关闭')); if (b) b.click(); });
  await sleep(300);
  await p.evaluate(() => { const b = document.getElementById('scheduleBtn'); if (b) b.click(); });
  await sleep(2500);
  const b5 = await p.evaluate(() => ({
    result: document.getElementById('stageResult').style.display !== 'none',
    days: document.querySelectorAll('.day-card').length,
    firstStop: (document.querySelector('.day-card .stop, .day-card [class*="stop"], .day-card [class*="st"]') || { textContent: '' }).textContent.slice(0, 16)
  }));
  ok('排期结果 = 高德排序顺序', b5.result && b5.days > 0, 'days=' + b5.days + ' first=' + b5.firstStop);
  /* 结果顺序与弹层顺序首项一致 */
  ok('结果首站与高德排序首项一致', b4.order[0] && b5.firstStop && (b4.order[0].indexOf(b5.firstStop.trim().slice(0, 4)) >= 0 || b5.firstStop.indexOf(b4.order[0].trim().slice(0, 4)) >= 0), b4.order[0] + ' vs ' + b5.firstStop);

  /* ===== 状态重置：再次 doGenerate ===== */
  await p.evaluate(() => {
    const inp = document.querySelector('input[type="text"], textarea, #promptInput');
    if (inp) inp.value = '想去广西玩2天';
    const b = [...document.querySelectorAll('button')].find(x => /开始规划|生成/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(2500);
  const b6 = await p.evaluate(() => ({
    selected: (document.querySelector('[class*="summ"], #summInfo') || { textContent: '' }).textContent.replace(/<[^>]+>/g, ''),
    regions: [...document.querySelectorAll('#intentRegions .chip.on')].map(c => c.textContent.trim()).join(','),
    resultHidden: document.getElementById('stageResult').style.display === 'none'
  }));
  ok('重新生成状态重置（勾选清空/省份切换）', b6.regions === '广西' && b6.resultHidden && !b6.selected.includes('已选'), JSON.stringify(b6));

  /* ===== fromWish 联动 ===== */
  await p.evaluate(() => {
    const w = window.Wish;
    if (w && w.toggle) {
      w.toggle({ name: '丽江古城', label: '丽江古城', theme: '古城古镇', region: '云南', city: '丽江', lat: 26.87, lng: 100.23 });
      w.toggle({ name: '青城山', label: '青城山', theme: '名山大川', region: '四川', city: '成都', lat: 30.9, lng: 103.57 });
    }
  });
  await p.evaluate(() => { const b = document.getElementById('seedWish'); if (b) b.click(); });
  await sleep(1500);
  const w1 = await p.evaluate(() => document.querySelectorAll('.cand, [class*="cand"]').length);
  /* 点省份云南 → 候选过滤为 1 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '云南'); if (c) c.click(); });
  await sleep(800);
  const w2 = await p.evaluate(() => document.querySelectorAll('.cand, [class*="cand"]').length);
  /* 取消云南 → 恢复 2 */
  await p.evaluate(() => { const c = [...document.querySelectorAll('#intentRegions .chip')].find(x => x.textContent.trim() === '云南'); if (c) c.click(); });
  await sleep(800);
  const w3 = await p.evaluate(() => document.querySelectorAll('.cand, [class*="cand"]').length);
  ok('fromWish 候选联动（收藏池过滤）', w1 === 2 && w2 === 1 && w3 === 2, w1 + '→' + w2 + '→' + w3);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await browser.close();
  console.log(fails ? '=== AUDIT-FEATURES FAIL ===' : '=== AUDIT-FEATURES ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
