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
  // 示例 → 意图卡
  await page.evaluate(() => { document.getElementById('seedExample').click(); });
  await new Promise(r => setTimeout(r, 4000));
  const d = await page.evaluate(() => {
    const card = document.getElementById('intentCard');
    return {
      noIntentStart: !document.getElementById('intentStart'),
      noIntentEnd: !document.getElementById('intentEnd'),
      noUseLoc: !document.getElementById('useLocBtn'),
      noIntentLoop: !document.getElementById('intentLoop'),
      txt: card ? card.textContent.slice(0, 150) : ''
    };
  });
  ok('意图卡无出发地/终到地/环线/当前位置（重复字段已移除）', d.noIntentStart && d.noIntentEnd && d.noUseLoc && d.noIntentLoop, JSON.stringify(d));

  // 向导仍可走通（起终点在向导第 1 步）
  await page.evaluate(() => {
    const ck = document.querySelectorAll('#candList .cand .ck');
    for (let i = 0; i < Math.min(3, ck.length); i++) ck[i].click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { document.getElementById('scheduleBtn').click(); });
  await new Promise(r => setTimeout(r, 800));
  const w1 = await page.evaluate(() => ({
    hasWStart: !!document.getElementById('wStart'),
    hasWEnd: !!document.getElementById('wEnd'),
    hasLoopY: !!document.getElementById('wLoopY') || !!document.getElementById('wNext')
  }));
  ok('向导第 1 步起终点存在', w1.hasWStart && w1.hasWEnd, JSON.stringify(w1));
  // 填起终点并排期
  await page.evaluate(() => {
    document.getElementById('wStart').value = '开封';
    document.getElementById('wEnd').value = '开封';
    document.getElementById('wNext').click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wLoopY').click(); document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wNext').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { document.getElementById('wDone').click(); });
  await new Promise(r => setTimeout(r, 2500));
  const res = await page.evaluate(() => {
    const body = document.getElementById('resultBody');
    const txt = body ? body.textContent : '';
    return { stage: document.getElementById('stageResult').style.display, hasLoop: txt.includes('环线'), hasKai: txt.includes('开封') };
  });
  ok('向导排期正常（含开封环线）', res.stage === 'block' && res.hasLoop && res.hasKai, JSON.stringify(res));

  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  ok('无脚本错误', errs.length === 0, errs[0] || '');
  console.log(fails ? '=== INTENT-CLEAN CHECK FAIL ===' : '=== INTENT-CLEAN CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
