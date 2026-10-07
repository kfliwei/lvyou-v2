/* 批次 25-B 收尾普查：地图浮控件一族「盒子 vs 按钮」的宽度是否吻合。
   design.css 用 !important 把 .ctl button / .leaflet-control-zoom a 点到 36，
   而各页自己的 .ctl 盒子还写着 44（travel-map 内联）/ 40（map.css）——按钮贴左、右边空一条。
   写 §39 判据前先量：到底是几条、空几条、在哪些档。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['travel-map.html', 'topic.html', 'explore-map.html', 'node-manager.html', 'planner.html'];
const ARMS = [[328, 723], [320, 640], [452, 995]];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  for (const f of PAGES) {
    for (const [w, h] of ARMS) {
      const p = await b.newPage();
      await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true });
      await p.goto('file:///' + ROOT + f, { waitUntil: 'load', timeout: 40000 });
      await sleep(f === 'node-manager.html' ? 5200 : 1800);
      const r = await p.evaluate(() => {
        const box = el => { const q = el.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), Math.round(q.left), Math.round(q.right)]; };
        const out = {};
        const ctl = document.querySelector('.ctl');
        if (ctl) {
          out.ctlBox = box(ctl);
          out.ctlBtns = Array.from(ctl.querySelectorAll('button')).map(el => {
            const q = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { r: [Math.round(q.width), Math.round(q.height)], ml: cs.marginLeft, mr: cs.marginRight, d: Math.round(q.right - ctl.getBoundingClientRect().right) };
          });
          const sep = ctl.querySelector('.sep');
          if (sep) out.sep = box(sep);
        }
        const zo = document.querySelectorAll('.leaflet-control-zoom a');
        if (zo.length) out.zoom = Array.from(zo).map(el => { const q = el.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; });
        const bar = document.querySelector('.leaflet-control-zoom.leaflet-bar');
        if (bar) out.zoomBar = box(bar);
        const lay = document.querySelector('.laymenu');
        if (lay) { out.lay = box(lay); out.layVis = getComputedStyle(lay).display; }
        out.scrollW = document.documentElement.scrollWidth;
        out.clientW = document.documentElement.clientWidth;
        return out;
      });
      console.log(w + 'x' + h + ' ' + f + ' :: ' + JSON.stringify(r));
      await p.close();
    }
  }
  await b.close();
})();
