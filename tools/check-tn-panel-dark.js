/* 验证：语音记录面板暗色模式（大字标题 tn-now__place 可读） */
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
  /* 打开语音面板 */
  await p.evaluate(() => {
    if (window.TravelNotes && TravelNotes.openPanel) TravelNotes.openPanel({ label: '当前位置（GPS）', lat: 39.9, lng: 116.4 });
  });
  await sleep(1000);
  const st = await p.evaluate(() => {
    const panel = document.querySelector('.tn-panel');
    if (!panel || getComputedStyle(panel).display === 'none') return null;
    const place = document.querySelector('.tn-now__place');
    const title = document.querySelector('.tn-title');
    return {
      panelBg: getComputedStyle(panel).backgroundImage,
      placeColor: place ? getComputedStyle(place).color : 'none',
      placeText: place ? place.textContent.slice(0, 16) : '',
      titleColor: title ? getComputedStyle(title).color : 'none'
    };
  });
  ok('语音面板已打开', !!st);
  if (st) {
    const lum = c => { const m = c.match(/\d+/g); if (!m) return 0; return (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3; };
    ok('面板背景为深色变量', st.panelBg.includes('var(--color-surface)') || st.panelBg.includes('color-surface'), st.panelBg.slice(0, 40));
    ok('大字标题「当前位置（GPS）」浅色可读', st.placeText.includes('当前位置') && lum(st.placeColor) > 140, st.placeColor + ' | ' + st.placeText);
    ok('头部标题可读', lum(st.titleColor) > 140, st.titleColor);
  }
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'auto'); });
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== PANEL-DARK FAIL ===' : '=== PANEL-DARK ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
