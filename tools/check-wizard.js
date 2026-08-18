/* 验证：排期向导 4 步流程（含正/倒序） */
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
  page.on('pageerror', e => console.log('PAGE:', e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  // 示例 → 候选 → 勾选 3 个
  await page.evaluate(() => { document.getElementById('seedExample').click(); });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => {
    const ck = document.querySelectorAll('#candList .cand .ck');
    for (let i = 0; i < Math.min(3, ck.length); i++) ck[i].click();
  });
  await new Promise(r => setTimeout(r, 800));
  // 点"开始排期"→ 向导出现
  await page.evaluate(() => { document.getElementById('scheduleBtn').click(); });
  await new Promise(r => setTimeout(r, 800));
  const w1 = await page.evaluate(() => {
    const box = document.getElementById('wizardBox');
    return {
      shown: box ? box.style.display === 'block' : false,
      txt: box ? box.textContent.slice(0, 150) : '',
      hasStart: !!document.getElementById('wStart'),
      hasEnd: !!document.getElementById('wEnd'),
      steps: box ? box.querySelectorAll('.chip[data-s]').length : 0
    };
  });
  ok('向导第 1 步（起终点）显示', w1.shown && w1.hasStart && w1.hasEnd && w1.steps === 4, JSON.stringify(w1));

  // 第 2 步：环线
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  const w2 = await page.evaluate(() => ({
    hasLoopY: !!document.getElementById('wLoopY'),
    hasLoopN: !!document.getElementById('wLoopN')
  }));
  ok('向导第 2 步（环线）显示', w2.hasLoopY && w2.hasLoopN, '');
  // 选环线=是
  await page.evaluate(() => { document.getElementById('wLoopY').click(); });
  await new Promise(r => setTimeout(r, 400));

  // 第 3 步：排序
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  const w3 = await page.evaluate(() => ({
    hasGeo: !!document.getElementById('wSortGeo'),
    hasAmap: !!document.getElementById('wSortAmap'),
    hasAsc: !!document.getElementById('wOrderAsc'),
    hasDesc: !!document.getElementById('wOrderDesc')
  }));
  ok('向导第 3 步（排序+方向）显示', w3.hasGeo && w3.hasAmap && w3.hasAsc && w3.hasDesc, '');
  // 切倒序
  await page.evaluate(() => { document.getElementById('wOrderDesc').click(); });
  await new Promise(r => setTimeout(r, 400));

  // 第 4 步：确认排期
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  const w4 = await page.evaluate(() => ({
    txt: document.getElementById('wizardBox').textContent.slice(0, 200),
    hasDone: !!document.getElementById('wDone'),
    hasBack: !!document.getElementById('wBack')
  }));
  ok('向导第 4 步（汇总确认）显示', w4.hasDone && w4.hasBack && w4.txt.includes('环线'), w4.txt.slice(0, 100));
  // 上一步回退（体验：可回退调整）
  await page.evaluate(() => { document.getElementById('wBack').click(); });
  await new Promise(r => setTimeout(r, 400));
  const back = await page.evaluate(() => !!document.getElementById('wOrderDesc'));
  ok('上一步可回退到排序步', back, '');

  // 回第 4 步并排期
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wDone').click(); });
  await new Promise(r => setTimeout(r, 2500));
  const res = await page.evaluate(() => {
    const body = document.getElementById('resultBody');
    return { stage: document.getElementById('stageResult').style.display, txt: body ? body.textContent.slice(0, 200) : '' };
  });
  ok('排期结果生成', res.stage === 'block' && res.txt.length > 0, res.txt.slice(0, 80));

  console.log(fails ? '=== WIZARD CHECK FAIL ===' : '=== WIZARD CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
