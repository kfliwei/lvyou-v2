/* 验证：搜索栏可见 + 高德 Key 配置入口 */
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

  // 1. node-manager：搜索栏可见（input 宽度 > 0）
  await page.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const nm = await page.evaluate(() => {
    const q = document.getElementById('q');
    const keyBtn = document.getElementById('qKey');
    const r = q.getBoundingClientRect();
    return { inputW: Math.round(r.width), visible: r.width > 60, hasKeyBtn: !!keyBtn, keyBtnW: keyBtn ? Math.round(keyBtn.getBoundingClientRect().width) : 0 };
  });
  ok('搜索栏可见（宽度 >60px）', nm.visible, 'inputW=' + nm.inputW);
  ok('顶栏有 Key 配置按钮', nm.hasKeyBtn, '');
  // 点齿轮弹 Key 配置框
  await page.evaluate(() => { document.getElementById('qKey').click(); });
  await new Promise(r => setTimeout(r, 500));
  const keyModal = await page.evaluate(() => !!document.getElementById('akKey'));
  ok('齿轮点击弹出 Key 配置', keyModal, '');
  await page.evaluate(() => { const m = document.querySelector('.nm-mask'); if (m) m.remove(); });

  // 2. settings：高级设置含高德 Key 配置
  await page.goto('file:///' + path.join(ROOT, 'settings.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const st = await page.evaluate(() => {
    const input = document.getElementById('amapKeyInput');
    return { hasInput: !!input, hasSave: typeof window.saveAmapKey === 'function', inAdvanced: !!(input && input.closest('#advGroup')) };
  });
  ok('设置页高级设置有高德 Key 配置', st.hasInput && st.hasSave && st.inAdvanced, JSON.stringify(st));
  // 保存 Key
  await page.evaluate(() => {
    document.getElementById('amapKeyInput').value = 'test-key-123';
    window.saveAmapKey();
  });
  const saved = await page.evaluate(() => localStorage.getItem('tn_amap_key'));
  ok('Key 保存到 tn_amap_key', saved === 'test-key-123', saved);
  await page.evaluate(() => { try { localStorage.removeItem('tn_amap_key'); } catch (e) {} });

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== KEY-SBAR CHECK FAIL ===' : '=== KEY-SBAR CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
