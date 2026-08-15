/* 验证：无图节点详情显示占位图片框 */
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
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  /* 找无静态图节点 */
  const r = await p.evaluate(() => {
    const m = window.SITE_IMAGES || {};
    const all = window.SITES || [];
    const noImg = all.find(s => !m[s.name] && (!s.img || s.img.indexOf('s0.svg') >= 0 || !s.img.length)) || all.find(s => !m[s.name]) || all[0];
    const i = all.indexOf(noImg);
    window.TopicEngine.openSheet(i);
    return { name: noImg.name };
  });
  await sleep(1200);
  const st = await p.evaluate(() => {
    const box = document.getElementById('lsImgBox');
    if (!box) return null;
    const ph = box.querySelector('.ls-img-ph');
    return {
      box: !!box,
      ph: !!ph,
      phText: ph ? ph.textContent.slice(0, 20) : '',
      img: !!box.querySelector('img')
    };
  });
  console.log('测试节点:', r.name);
  ok('无图节点有图片框', st && st.box);
  ok('显示占位（首字+提示）', st && st.ph && st.phText.length > 2, st ? st.phText : '');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== PLACEHOLDER FAIL ===' : '=== PLACEHOLDER ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
