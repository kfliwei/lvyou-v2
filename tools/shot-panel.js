const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  // 关闭首启引导，避免遮挡
  await page.evaluate(() => {
    try { localStorage.setItem('tn_guide', '1'); localStorage.setItem('tn_onboarded', '1'); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => { window.TravelNotes.openPanel({ label: '故宫博物院', lat: 39.916, lng: 116.397 }); });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'F:\\MyAi\\trace\\.openclaw\\tmp\\panel-v3.png' });
  // 像素采样：面板顶部（头部区域）和中部
  const px = await page.evaluate(() => {
    const head = document.querySelector('.tn-head').getBoundingClientRect();
    const panel = document.querySelector('.tn-panel').getBoundingClientRect();
    return { headRect: { y: Math.round(head.y), h: Math.round(head.height) }, panelRect: { y: Math.round(panel.y), h: Math.round(panel.height) } };
  });
  console.log(JSON.stringify(px));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
