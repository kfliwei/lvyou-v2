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
  // 点"给我一个示例"进入意图卡
  await page.evaluate(() => { const b = document.getElementById('seedExample'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 4000));
  // 勾选候选（前 3 个）
  await page.evaluate(() => {
    const ck = document.querySelectorAll('#candList .cand .ck');
    for (let i = 0; i < Math.min(3, ck.length); i++) ck[i].click();
  });
  await new Promise(r => setTimeout(r, 800));
  // 填出发地/终到地=开封，勾环线
  await page.evaluate(() => {
    document.getElementById('intentStart').value = '开封';
    document.getElementById('intentEnd').value = '开封';
    const loop = document.getElementById('intentLoop');
    loop.checked = true;
    loop.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));
  // 确认 state 已保存
  const st = await page.evaluate(() => {
    // 通过 planner 内部不可直接访问，检查 DOM 值
    return {
      startVal: document.getElementById('intentStart').value,
      endVal: document.getElementById('intentEnd').value,
      loopChecked: document.getElementById('intentLoop').checked
    };
  });
  ok('起终点已填', st.startVal === '开封' && st.endVal === '开封' && st.loopChecked, JSON.stringify(st));

  // 触发排期（向导流程：点排期 → 向导第 1 步 → 下一步 ×3 → 开始排期）
  await page.evaluate(() => { const b = document.getElementById('scheduleBtn'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 800));
  // 向导第 1 步填起终点
  await page.evaluate(() => {
    const s = document.getElementById('wStart');
    const e = document.getElementById('wEnd');
    if (s) s.value = '开封';
    if (e) e.value = '开封';
    const nxt = document.getElementById('wNext'); if (nxt) nxt.click();
  });
  await new Promise(r => setTimeout(r, 400));
  // 第 2 步：环线选是
  await page.evaluate(() => { const y = document.getElementById('wLoopY'); if (y) y.click(); const nxt = document.getElementById('wNext'); if (nxt) nxt.click(); });
  await new Promise(r => setTimeout(r, 400));
  // 第 3 步：默认地理正序，下一步
  await page.evaluate(() => { const nxt = document.getElementById('wNext'); if (nxt) nxt.click(); });
  await new Promise(r => setTimeout(r, 400));
  // 第 4 步：开始排期
  await page.evaluate(() => { const d = document.getElementById('wDone'); if (d) d.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const res = await page.evaluate(() => {
    const body = document.getElementById('resultBody');
    return {
      stage: document.getElementById('stageResult').style.display,
      bodyTxt: body ? body.textContent.slice(0, 300) : ''
    };
  });
  ok('排期结果页显示', res.stage === 'block' || res.bodyTxt.length > 0, res.stage);
  ok('结果含终到地/环线', res.bodyTxt.includes('开封') && res.bodyTxt.includes('环线'), res.bodyTxt.slice(0, 120));

  console.log(fails ? '=== LOOP CHECK FAIL ===' : '=== LOOP CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });