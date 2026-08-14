/* 验证 explore-map 全部封面图真实加载（无破图） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const fails = [];
  page.on('requestfailed', r => { if (/topic-.*\.svg/.test(r.url())) fails.push(r.url().split('/').pop()); });
  await page.goto('file:///' + path.join(ROOT, 'explore-map.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 60000 });
  const r = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.story-item__stamp img')];
    const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'));
    return { total: imgs.length, broken };
  });
  console.log('封面图总数:', r.total, '| 破图:', r.broken.length ? r.broken.join(',') : '无');
  console.log('请求失败:', fails.length ? fails.join(',') : '无');
  console.log(r.broken.length === 0 && fails.length === 0 ? '=== COVER CHECK PASSED ===' : '=== COVER CHECK FAILED ===');
  await browser.close();
  process.exit(r.broken.length === 0 && fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
