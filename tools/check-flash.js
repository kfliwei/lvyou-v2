/* 验证：打开节点详情时图例/标签闪烁提示 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  const r = await page.evaluate(async () => {
    window.TopicEngine._map.setView([39.92, 116.40], 13);
    await new Promise(r => setTimeout(r, 1000));
    const first = document.querySelector('#mapEl .tr-node');
    first.click();
    await new Promise(r => setTimeout(r, 300));
    return {
      chipFlash: document.querySelectorAll('#dynChips .chip.flash').length,
      legFlash: document.querySelectorAll('#legBody .lg.flash').length,
      sheet: !!document.querySelector('#locSheet.show')
    };
  });
  console.log(JSON.stringify(r));
  console.log(r.chipFlash > 0 && r.legFlash > 0 && r.sheet ? 'PASS' : 'FAIL');
  await browser.close();
})();
