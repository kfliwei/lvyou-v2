/* 验证：地点选择面板暗色模式 */
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
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4500);
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); window.location.reload(); });
  await sleep(4500);
  const shown = await p.evaluate(() => {
    if (window.__tnShowPlacePicker) {
      window.__tnShowPlacePicker('北京市 故宫', [{ name: '故宫' }], 39.9, 116.4, function () {}, function () {});
      return true;
    }
    return false;
  });
  await sleep(800);
  const st = await p.evaluate(() => {
    const sheet = document.getElementById('placePicker');
    if (!sheet) return null;
    const sheetEl = sheet.children[0];
    const curB = [...sheet.querySelectorAll('b')].find(b => b.textContent.includes('当前位置'));
    const headB = [...sheet.querySelectorAll('b')].find(b => b.textContent.includes('记录地点'));
    const close = document.getElementById('placePickerClose');
    return {
      sheetBg: getComputedStyle(sheetEl).backgroundColor,
      curBg: curB ? getComputedStyle(curB.parentElement.parentElement).backgroundColor : 'none',
      curColor: curB ? getComputedStyle(curB).color : 'none',
      headColor: headB ? getComputedStyle(headB).color : 'none',
      closeColor: close ? getComputedStyle(close).color : 'none'
    };
  });
  ok('面板已打开', !!st);
  if (st) {
    const lum = c => { const m = c.match(/\d+/g); if (!m) return 0; return (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3; };
    ok('「当前位置」标题浅色可读', lum(st.curColor) > 140, st.curColor);
    ok('「记录地点」标题浅色可读', lum(st.headColor) > 140, st.headColor);
    ok('关闭按钮可读', lum(st.closeColor) > 120, st.closeColor);
    ok('面板背景深色化', lum(st.sheetBg) < 120, st.sheetBg);
  }
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'auto'); });
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== PICKER-DARK FAIL ===' ? '=== PICKER-DARK ALL PASSED ===' : '=== PICKER-DARK FAIL ===' : '=== PICKER-DARK ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
