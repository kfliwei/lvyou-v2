/* 探测：wishlist 存储 key + 首页搜索绑定 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* wishlist：写入后看哪个 key 生效 */
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2000);
  await p.evaluate(() => {
    /* 先清所有候选 key */
    ['tn_wishlist', 'wishlist', 'wl', 'tn_wishes'].forEach(k => localStorage.removeItem(k));
    /* 用 Wish API 添加（真实链路） */
    if (window.Wish) Wish.toggle({ label: '故宫', theme: '古建', region: '北京', city: '北京', lat: 39.9, lng: 116.4 });
  });
  await sleep(500);
  const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /wish|wl/i.test(k)));
  console.log('wish keys after API add:', JSON.stringify(keys));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const has = await p.evaluate(() => !!document.querySelector('.wl-item'));
  console.log('wishlist renders after reload:', has);
  await p.close();

  /* 首页搜索绑定 */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p2.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  const bind = await p2.evaluate(() => {
    const inp = document.getElementById('homeSearch');
    const out = { hasInput: !!inp, keys: [] };
    if (inp) {
      out.keys.push('oninput:' + (typeof inp.oninput), 'onkeydown:' + (typeof inp.onkeydown));
    }
    const searchEl = document.querySelector('.hero__search');
    if (searchEl) out.keys.push('hero onclick:' + (typeof searchEl.onclick));
    /* 回车触发搜索 */
    inp.value = '拉萨';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return out;
  });
  console.log('home search bindings:', JSON.stringify(bind));
  await sleep(2500);
  console.log('after enter url:', p2.url().split('/').pop());
  await p2.close();
  await browser.close();
})();
