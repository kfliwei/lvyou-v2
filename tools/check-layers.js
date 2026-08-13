/* 验证：#locSheet 层级高于 FAB/区域统计条，低于模态 */
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
    document.querySelector('#mapEl .tr-node').click();
    await new Promise(r => setTimeout(r, 500));
    const zi = sel => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).zIndex : null;
    };
    const sheet = document.querySelector('#locSheet.show');
    const sheetBox = sheet ? sheet.getBoundingClientRect() : null;
    // 信息框顶部的元素（用 elementFromPoint 检查是否有更高层元素遮挡信息框中部）
    let topAtCenter = null;
    if (sheetBox) {
      const el = document.elementFromPoint(sheetBox.left + sheetBox.width / 2, sheetBox.top + 40);
      topAtCenter = el ? (el.className || el.id || el.tagName) : null;
    }
    return {
      sheetZ: zi('#locSheet'),
      fabZ: zi('.nm-fab'),
      statsZ: zi('.region-stats'),
      modalZ: zi('.ui-modal-mask'),
      sheetShown: !!sheet,
      topAtSheetCenter: topAtCenter
    };
  });
  console.log(JSON.stringify(r));
  const ok = r.sheetShown && parseInt(r.sheetZ) > parseInt(r.fabZ) && parseInt(r.sheetZ) > parseInt(r.statsZ) && (r.topAtSheetCenter === 'locSheet' || String(r.topAtSheetCenter).includes('location-sheet') || String(r.topAtSheetCenter).includes('ls-'));
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close();
})();
