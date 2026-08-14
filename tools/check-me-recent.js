/* 验证：我的页最近记录读取 IndexedDB 游记 */
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

  // 先注入 2 篇游记到 IndexedDB
  await page.goto('file:///' + path.join(ROOT, 'me.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const injected = await page.evaluate(() => {
    return new Promise(res => {
      const req = indexedDB.open('gujian-notes', 1);
      req.onsuccess = function () {
        const db = req.result;
        const tx = db.transaction('notes', 'readwrite');
        const st = tx.objectStore('notes');
        st.put({ id: 'v1', title: '语音记录一', siteName: '故宫', text: '今天天气很好', raw: '今天天气很好', lat: 39.916, lng: 116.397, region: '北京市', ts: Date.now() - 1000, tags: [], city: '北京市' });
        st.put({ id: 'v2', title: '语音记录二', siteName: '长城', text: '爬长城累但值得', raw: '爬长城累但值得', lat: 40.36, lng: 116.02, region: '北京市', ts: Date.now(), tags: [], city: '北京市' });
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { res(false); };
      };
      req.onerror = function () { res(false); };
    });
  });
  ok('测试游记注入成功', injected, '');

  // 重新加载 me.html，检查最近记录
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  const d = await page.evaluate(() => ({
    recentHtml: document.getElementById('meRecent').innerHTML,
    sub: document.getElementById('meSub').textContent,
    hasEmpty: document.getElementById('meRecent').textContent.includes('还没有游记'),
    recCount: document.querySelectorAll('#meRecent .rec').length
  }));
  ok('最近记录显示 2 篇游记', d.recCount === 2 && !d.hasEmpty, 'rec=' + d.recCount + ' ' + d.sub);
  ok('最近记录含语音记录标题', d.recentHtml.includes('语音记录'), '');

  // 清理
  await page.evaluate(() => {
    return new Promise(res => {
      const req = indexedDB.open('gujian-notes', 1);
      req.onsuccess = function () {
        const tx = req.result.transaction('notes', 'readwrite');
        const st = tx.objectStore('notes');
        st.delete('v1'); st.delete('v2');
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { res(false); };
      };
      req.onerror = function () { res(false); };
    });
  });

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== ME RECENT CHECK FAIL ===' : '=== ME RECENT CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
