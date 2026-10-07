/* 批次 25-B 补充普查：三个顶栏容器（.topbar/.nm-topbar/.story-bar）里**所有**可点/可输控件的高度，
   不只是 button,a。写闸门判据前要先知道有没有漏网的（select/input 之前不在口径里）。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['travel-map.html','expense.html','trip.html','checklist.html','md-manager.html','me.html',
  'node-manager.html','planner.html','settings.html','wishlist.html','explore-map.html','review.html','story.html','index.html'];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu','--allow-file-access-from-files'] });
  for (const f of PAGES) {
    const p = await b.newPage();
    await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
    await p.goto('file:///' + ROOT + f, { waitUntil: 'load', timeout: 40000 });
    await sleep(f === 'node-manager.html' ? 5200 : 1600);
    const r = await p.evaluate(() => {
      const bar = document.querySelector('.topbar') || document.querySelector('.nm-topbar') || document.querySelector('.story-bar');
      if (!bar) return { none: true };
      const out = [];
      bar.querySelectorAll('button,a,select,input,[role=button]').forEach(el => {
        const q = el.getBoundingClientRect();
        if (!q.height) return;
        out.push([el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0], Math.round(q.width), Math.round(q.height)]);
      });
      return { out: out };
    });
    console.log(f + ' :: ' + JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
