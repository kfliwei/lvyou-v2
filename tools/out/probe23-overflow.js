/* 批次 23 探针：真机口径（CSS 视口 328×723 + 系统字体 1.35）下的横向溢出与关闭 X 可见性普查。
   三档对照是为了分家两个成因：视口窄 / textZoom 大。
   textZoom 在 Chrome 侧用 --blink-settings=defaultFontSize 近似（16→22 ≈ 1.375）。 */
const puppeteer = require('../node_modules/puppeteer-core');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const OUT = ROOT + 'tools/out/b23-overflow.txt';

const CONFIGS = [
  { name: '328 + zoom135（真机现状）', w: 328, h: 723, font: 22 },
  { name: '328 + zoom100（修壳后）', w: 328, h: 723, font: 16 },
  { name: '452 + zoom135（闸门主档 + 放大）', w: 452, h: 995, font: 22 }
];
const PAGES = ['index.html', 'planner.html', 'topic.html', 'search.html', 'settings.html',
  'checklist.html', 'wishlist.html', 'album.html', 'travel-map.html', 'node-manager.html'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const MEASURE = `(() => {
  const W = innerWidth, bad = [];
  const inScroller = el => { for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n); if (/auto|scroll/.test(cs.overflowX)) return true; } return false; };
  const path = el => { let s = el.tagName.toLowerCase();
    if (el.id) s = '#' + el.id; else if (el.className && typeof el.className === 'string')
      s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); return s; };
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const over = Math.max(r.right - W, -r.left);
    if (over <= 1) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    if (cs.position === 'fixed' && r.left < -1 && !el.className.toString().match(/show|open/)) return;  /* 离屏抽屉 */
    bad.push({ sel: path(el), over: Math.round(over), right: Math.round(r.right),
      txt: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 20),
      scroller: inScroller(el), pos: cs.position });
  });
  return { W, root: getComputedStyle(document.documentElement).fontSize,
    scrollW: document.documentElement.scrollWidth, bodyW: document.body.getBoundingClientRect().width,
    bad: bad.filter(b => !b.scroller).slice(0, 10),
    scrolled: bad.filter(b => b.scroller).length };
})()`;

(async () => {
  const lines = [];
  const log = s => { lines.push(s); };
  for (const cfg of CONFIGS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME, headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
        '--blink-settings=defaultFontSize=' + cfg.font,
        '--blink-settings=defaultFixedFontSize=' + cfg.font,
        '--blink-settings=defaultMinimumFontSize=' + Math.round(cfg.font * 0.75)]
    });
    log('=== ' + cfg.name + ' ===');
    for (const f of PAGES) {
      const p = await browser.newPage();
      await p.setViewport({ width: cfg.w, height: cfg.h, deviceScaleFactor: 1 });
      try {
        await p.goto('file:///' + ROOT.replace(/\\/g, '/') + f, { waitUntil: 'load', timeout: 20000 });
        await sleep(f === 'travel-map.html' ? 2600 : 1200);
        if (f === 'planner.html') {   /* 排期向导第 3 步才有那两枚方向按钮 */
          await p.click('#scheduleBtn').catch(() => {});
          await sleep(400);
          for (let s = 1; s < 3; s++) { await p.click('#wNext').catch(() => {}); await sleep(300); }
        }
        const m = await p.evaluate(MEASURE);
        log(f.padEnd(20) + ' root=' + m.root.padEnd(7) + ' scrollW=' + String(m.scrollW).padStart(4) +
          '/' + m.W + '  溢出条=' + m.bad.length + '（可滚容器内 ' + m.scrolled + '）');
        m.bad.forEach(b => log('    ' + ('+' + b.over + 'px').padEnd(8) + b.sel.padEnd(30) +
          ' right=' + String(b.right).padStart(4) + '  「' + b.txt + '」'));
      } catch (e) { log(f.padEnd(20) + ' ERR ' + e.message.slice(0, 70)); }
      await p.close();
    }
    await browser.close();
  }
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
})();
