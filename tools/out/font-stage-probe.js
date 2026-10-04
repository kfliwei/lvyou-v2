/* font-stage-probe.js — 「阅读字号」三档到底是真功能还是假功能的实测（#76 收口证据）
 *
 * 为什么要单独测这个：收口前全站 998 处 font-size 只有 17 处走 var(--fs-*)，
 * 而设置页那套「小字/标准/大字」只作用在走 var 的那部分上——切档时绝大多数文字一动不动，
 * 等于 shipped 了一个假功能。字号进 rem 之后，理论上是根字号带着整族一起动。
 * 这条线不实测就没法写进文档。
 *
 * 口径：同一页在 md / sm / lg 三档各加载一次，给每个「可见的叶子文字节点」打一个稳定的
 * 结构键（tag + class + 同键序号），比对 md→lg 的 computed font-size 变化比例。
 * 预期：除 clamp() 的展示级标题（vw 驱动，本来就不跟根字号走）以外全部变化。
 *
 * 用法: NODE_PATH=F:/MyAi/trace/lvyou-v2/tools/node_modules node tools/out/font-stage-probe.js [375 452]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WPS = (process.argv.slice(2).length ? process.argv.slice(2) : ['375', '452']).map(Number);
const PAGES = ['index.html', 'review.html', 'planner.html', 'settings.html'];

const SNAP = () => {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const map = {}; const seen = {};
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < .1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 4) continue;
    const key = el.tagName + '.' + (el.className && el.className.toString ? el.className.toString().split(' ').filter(Boolean).join('.') : '') ;
    seen[key] = (seen[key] || 0) + 1;
    map[key + '#' + seen[key]] = { fs: +parseFloat(cs.fontSize).toFixed(2), txt: el.textContent.trim().slice(0, 8) };
  }
  return { root, map, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));

  for (const W of WPS) {
    const H = Math.round(W * 2800 / 1272);
    console.log('\n########## CSS 视口 ' + W + ' x ' + H + ' ##########');
    for (const p of PAGES) {
      const snap = {};
      for (const stage of ['md', 'sm', 'lg']) {
        await pg.evaluateOnNewDocument(s => {
          try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_font', s); } catch (e) {}
        }, stage);
        await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
        await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1300));
        snap[stage] = await pg.evaluate(SNAP);
      }
      const keys = Object.keys(snap.md.map);
      let moved = 0, still = [];
      keys.forEach(k => {
        const a = snap.md.map[k].fs, b = snap.lg.map[k] ? snap.lg.map[k].fs : a;
        if (b !== a) moved++; else still.push(k + '=' + a + '「' + snap.md.map[k].txt + '」');
      });
      const smRatio = (snap.sm.root / snap.md.root * 100).toFixed(1);
      const lgRatio = (snap.lg.root / snap.md.root * 100).toFixed(1);
      console.log('--- ' + p + '  根字号 md=' + snap.md.root + 'px / sm=' + snap.sm.root + '(' + smRatio + '%) / lg=' + snap.lg.root + '(' + lgRatio + '%)');
      console.log('    可见叶子文字 ' + keys.length + ' 个，md→lg 真变号 ' + moved + ' 个（' + (keys.length ? (moved / keys.length * 100).toFixed(1) : '-') + '%），没动 ' + still.length + ' 个');
      if (still.length) console.log('    没动的: ' + still.slice(0, 8).join(' | '));
      console.log('    横向溢出 md/sm/lg = ' + snap.md.hScroll + '/' + snap.sm.hScroll + '/' + snap.lg.hScroll + 'px');
    }
  }
  await browser.close();
})();
