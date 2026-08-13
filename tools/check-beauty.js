/* 验证：足迹海报制图风主题 + 首页启动遮罩 + me 图标 + 美化回归 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* 1. index：启动遮罩 + 淡出 */
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p1.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const splash0 = await p1.evaluate(() => !!document.getElementById('bootSplash'));
  await sleep(1600);
  const splashGone = await p1.evaluate(() => !document.getElementById('bootSplash'));
  ok('启动遮罩显示后淡出', splash0 && splashGone);
  await p1.close();

  /* 2. me.html：图标已 SVG 化（无 emoji 图标） */
  const p2 = await browser.newPage();
  await p2.goto('file:///' + path.join(ROOT, 'me.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500);
  const me = await p2.evaluate(() => ({
    svg: document.querySelectorAll('.entry .ic svg').length,
    emoji: [...document.querySelectorAll('.entry .ic')].filter(el => /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(el.textContent)).length
  }));
  ok('me 入口图标 SVG 化', me.svg >= 6 && me.emoji === 0, 'svg=' + me.svg + ' emoji=' + me.emoji);
  await p2.close();

  /* 3. review：制图海报生成（需预置游记） */
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p3.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await p3.goto('file:///' + path.join(ROOT, 'review.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  /* 预置一条带坐标游记 */
  await p3.evaluate(() => {
    const KEY = 'travelNotes';
    const old = JSON.parse(localStorage.getItem(KEY) || '[]');
    old.push({ id: 'pt1', title: '测试足迹', siteName: '故宫', lat: 39.92, lng: 116.4, ts: Date.now(), date: '2026-08-01', text: 'x', province: '北京市', raw: '' });
    localStorage.setItem(KEY, JSON.stringify(old));
  });
  await p3.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const cartoBtn = await p3.evaluate(() => !!document.getElementById('posterCarto'));
  ok('review 制图海报按钮存在', cartoBtn);
  const genOk = await p3.evaluate(() => {
    try { window.FootprintPoster.generate(false, 'carto'); return true; } catch (e) { return 'ERR:' + e.message; }
  });
  ok('制图风海报可生成', genOk === true, String(genOk).slice(0, 60));
  const inkOk = await p3.evaluate(() => {
    try { window.FootprintPoster.generate(); return true; } catch (e) { return 'ERR:' + e.message; }
  });
  ok('默认墨色海报仍正常', inkOk === true, String(inkOk).slice(0, 60));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await p3.close();

  await browser.close();
  console.log(fails ? '=== BEAUTY FAIL ===' : '=== BEAUTY ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
