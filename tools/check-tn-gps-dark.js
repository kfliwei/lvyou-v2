/* 验证：随手记地点选择器在暗色模式下文字可读 */
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
  /* 打开 topic 页（travel-notes 已加载）→ 暗色 → 触发地点选择器 */
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4500);
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'dark'); window.location.reload(); });
  await sleep(4500);
  const dark = await p.evaluate(() => document.documentElement.classList.contains('theme-dark') || document.body.classList.contains('theme-dark'));
  ok('暗色模式生效', dark);
  /* 打开地点选择器：__tnPickPlace 需要定位（无 GPS 环境用 fallback？）——直接调 pickPlace 接口 */
  const shown = await p.evaluate(() => {
    if (window.__tnPickPlace) { window.__tnPickPlace(39.9, 116.4, function () {}, function () {}); return true; }
    return false;
  });
  await sleep(800);
  const colors = await p.evaluate(() => {
    const els = [...document.querySelectorAll('b, small')].filter(el => el.textContent.includes('当前位置'));
    const out = [];
    els.forEach(el => {
      const cs = getComputedStyle(el);
      out.push({ t: el.textContent.slice(0, 8), color: cs.color });
    });
    return out;
  });
  ok('地点选择器已打开', shown);
  /* 检查「当前位置」标题颜色是否为浅色（暗色下可读） */
  const titleColor = colors.find(c => c.t.includes('当前位置'));
  ok('当前位置标题暗色可读（浅色）', titleColor && /rgb\((2\d\d|1\d\d|230|220|2[0-4]\d)/.test(titleColor.color), titleColor ? titleColor.color : 'not found');
  /* 对比度粗验：亮色文字（如 rgb(233,228,216) 系） */
  const r = titleColor ? titleColor.color.match(/\d+/g).map(Number) : [0, 0, 0];
  ok('亮度足够', (r[0] + r[1] + r[2]) / 3 > 150, 'avg=' + Math.round((r[0] + r[1] + r[2]) / 3));
  await p.evaluate(() => { localStorage.setItem('tn_dark', 'auto'); });
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== GPS-DARK FAIL ===' : '=== GPS-DARK ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
