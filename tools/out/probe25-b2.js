/* 定点复核：#infoSheet 的四枚 .is-btn（其中两枚带 TI 图标）到底是断行，还是探针把 svg 与文字算成两行 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 328, height: 723, deviceScaleFactor: 1 });
  await p.goto('file:///' + ROOT + 'node-manager.html', { waitUntil: 'load', timeout: 40000 });
  await new Promise(r => setTimeout(r, 2600));
  await p.evaluate(() => { const q = document.getElementById('q'); q.value = '故宫'; });
  await p.click('#qGo');
  await new Promise(r => setTimeout(r, 1400));
  await p.evaluate(() => { const it = document.querySelector('#rsBody .rs-item[data-k="local"]'); if (it) it.click(); });
  await new Promise(r => setTimeout(r, 1000));
  console.log(JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#infoSheet .is-btn')).map((el, i) => {
    const bb = el.getBoundingClientRect();
    const kids = Array.from(el.childNodes).map(n => {
      if (n.nodeType === 3) {
        const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, n.length);
        return Array.from(r.getClientRects()).filter(x => x.width > 0).map(x => '#text top' + Math.round(x.top) + ' h' + Math.round(x.height) + ' "' + n.textContent.trim().slice(0, 6) + '"');
      }
      const r = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
      return [n.nodeName + (r ? ' top' + Math.round(r.top) + ' h' + Math.round(r.height) : ' (no box)')];
    }).flat();
    return { i: i, cls: el.className, w: Math.round(bb.width), h: Math.round(bb.height),
      scrollH: el.scrollHeight, lineH: getComputedStyle(el).lineHeight, fs: getComputedStyle(el).fontSize, kids: kids };
  }), null, 1)));
  await b.close();
})();
