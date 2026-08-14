/* 验证：我的地点搜索栏移至底部 */
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
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => {
    const q = document.getElementById('q');
    const bar = document.querySelector('.nsearch-bar');
    const topbar = document.querySelector('.nm-topbar');
    const keyBtn = document.getElementById('qKey');
    const r = q.getBoundingClientRect();
    const br = bar ? bar.getBoundingClientRect() : null;
    return {
      inTopbar: topbar ? topbar.contains(q) : false,
      inBottomBar: bar ? bar.contains(q) : false,
      inputW: Math.round(r.width),
      barBottom: br ? Math.round(br.bottom) : -1,
      viewportH: 844,
      keyBtnInBar: keyBtn ? bar.contains(keyBtn) : false,
      inputVisible: r.width > 60
    };
  });
  ok('搜索栏已移出顶栏', !d.inTopbar, '');
  ok('搜索栏在底部固定栏', d.inBottomBar, '');
  ok('底部搜索栏输入框宽度充足', d.inputW > 100, 'w=' + d.inputW);
  ok('底部栏浮动（不贴边沿，底部留间距）', d.barBottom <= 840 && d.barBottom >= 810, 'bottom=' + d.barBottom);
  ok('Key 按钮随搜索栏在底部', d.keyBtnInBar, '');
  ok('输入框可见可输入', d.inputVisible, '');

  // 搜索功能仍正常（输入本地关键词）
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '故宫';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 800));
  const rs = await page.evaluate(() => {
    const sheet = document.getElementById('rsSheet');
    return sheet ? getComputedStyle(sheet).display !== 'none' : false;
  });
  ok('搜索功能正常（结果面板弹出）', rs, '');

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== NSBAR CHECK FAIL ===' : '=== NSBAR CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
