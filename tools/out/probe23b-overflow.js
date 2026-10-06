/* 批次 23 探针 v2。修两件事：
   ① v1 的 --blink-settings=defaultFontSize 被 Chrome 忽略（实测 root 仍 15px），
      改注入 html{font-size:calc(21.6px*…)} 忠实模拟 Android textZoom=1.35
      （textZoom 只乘相对字号，本站阶梯全 rem，故等价）；
   ② 分母自检：向导没走到第 3 步时「溢出 0 条」是假绿，必须先断言两枚按钮在 DOM 且可见。
   另加：被 overflow:hidden 祖先裁掉的（地图瓦片、SVG path）单列，不混进真溢出。 */
const puppeteer = require('../node_modules/puppeteer-core');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const OUT = ROOT + 'tools/out/b23-overflow2.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MEASURE = `(() => {
  const W = innerWidth, clipped = [], real = [];
  const clipOf = el => { for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/hidden|clip/.test(cs.overflowX)) return 'clip';
      if (/auto|scroll/.test(cs.overflowX)) return 'scroll'; } return ''; };
  const path = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''));
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const over = Math.max(r.right - W, -r.left);
    if (over <= 1) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const c = clipOf(el);
    const rec = { sel: path(el), over: Math.round(over), right: Math.round(r.right),
      txt: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 18), c };
    (c ? clipped : real).push(rec);
  });
  const btn = ['wOrderAsc', 'wOrderDesc'].map(id => {
    const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { id: id, right: Math.round(r.right), w: Math.round(r.width),
      minW: getComputedStyle(e).minWidth, in: r.right <= W + 1 };
  }).filter(Boolean);
  return { W, root: getComputedStyle(document.documentElement).fontSize,
    scrollW: document.documentElement.scrollWidth,
    real: real.slice(0, 12), clippedN: clipped.length,
    clipped: clipped.slice(0, 3).map(x => x.sel + '+' + x.over + '(' + x.c + ')'),
    btn: btn, btnDenom: btn.length };
})()`;

(async () => {
  const lines = [];
  const log = s => { lines.push(s); };
  for (const cfg of [
    { name: '328 + textZoom135（真机现状）', w: 328, h: 723, tz: 'calc(21.6px * var(--fs-bucket) * var(--fs-stage))' },
    { name: '328 + textZoom100（修壳后应有口径）', w: 328, h: 723, tz: '' },
    { name: '452 + textZoom135（闸门主档 + 放大）', w: 452, h: 995, tz: 'calc(21.6px * var(--fs-bucket) * var(--fs-stage))' }
  ]) {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
    log('=== ' + cfg.name + ' ===');
    for (const f of ['planner.html', 'index.html', 'settings.html', 'checklist.html', 'topic.html', 'travel-map.html']) {
      const p = await browser.newPage();
      await p.setViewport({ width: cfg.w, height: cfg.h, deviceScaleFactor: 1 });
      try {
        await p.goto('file:///' + ROOT.replace(/\\/g, '/') + f, { waitUntil: 'load', timeout: 20000 });
        if (cfg.tz) await p.addStyleTag({ content: 'html{font-size:' + cfg.tz + '!important}' });
        await sleep(f === 'travel-map.html' ? 2600 : 1000);
        if (f === 'planner.html') {
          await p.click('#scheduleBtn').catch(() => {});
          await sleep(400);
          for (let s = 1; s < 3; s++) { await p.click('#wNext').catch(() => {}); await sleep(300); }
        }
        const m = await p.evaluate(MEASURE);
        const flag = f === 'planner.html' ? (m.btnDenom === 2 ? '' : '  ←← 分母失守：向导按钮不在 DOM，本行溢出数不可信') : '';
        log(f.padEnd(18) + 'root=' + m.root.padEnd(8) + 'scrollW=' + String(m.scrollW).padStart(4) + '/' + m.W +
          '  真溢出=' + m.real.length + '  被裁(不计)=' + m.clippedN + flag);
        if (m.btn.length) log('    方向按钮: ' + JSON.stringify(m.btn));
        m.real.forEach(b => log('      ' + ('+' + b.over + 'px').padEnd(8) + b.sel.padEnd(24) + 'right=' + String(b.right).padStart(4) + ' 「' + b.txt + '」'));
        if (m.clipped.length) log('      被裁样本: ' + m.clipped.join(' , '));
      } catch (e) { log(f.padEnd(18) + ' ERR ' + e.message.slice(0, 60)); }
      await p.close();
    }
    await browser.close();
  }
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
})();
