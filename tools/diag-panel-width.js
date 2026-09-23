/* diag-panel-width.js — 同一移动端视口下对比 travel-map 与 topic 的游记面板宽度 */
const p = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGES = [
  ['travel-map', 'file:///F:/myai/trace/travel-map.html'],
  ['topic(sc)', 'file:///F:/myai/trace/topic.html?p=sc']
];
(async () => {
  const b = await p.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const [name, url] of PAGES) {
    await pg.goto(url);
    await new Promise(r => setTimeout(r, 2500));
    const r = await pg.evaluate(() => {
      const out = { vw: window.innerWidth, docW: document.documentElement.scrollWidth, panels: {} };
      const probe = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const rc = el.getBoundingClientRect();
        return { w: Math.round(rc.width), left: Math.round(rc.left), pos: cs.position, leftCss: cs.left, rightCss: cs.right, maxW: cs.maxWidth, fontRoot: getComputedStyle(document.documentElement).fontSize };
      };
      out.panels['tn-list'] = probe('.tn-list');
      out.panels['tn-panel'] = probe('.tn-panel');
      out.panels['tn-listbar'] = probe('.tn-listbar');
      out.panels['tn-item(first)'] = probe('.tn-item');
      /* 找列表里最宽的子元素 */
      const lb = document.querySelector('.tn-listbody');
      if (lb) {
        let widest = null;
        lb.querySelectorAll('*').forEach(el => {
          const w = el.getBoundingClientRect().width;
          if (!widest || w > widest.w) widest = { tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + String(el.className || '').split(' ')[0], w: Math.round(w) };
        });
        out.widestInList = widest;
      }
      return out;
    });
    console.log(`=== ${name} vw=${r.vw} docScrollW=${r.docW} rootFont=${(r.panels['tn-list'] || r.panels['tn-panel'] || {}).fontRoot}`);
    Object.keys(r.panels).forEach(k => { const v = r.panels[k]; if (v) console.log(`  ${k}: W=${v.w} L=${v.left} ${v.pos} left=${v.leftCss} right=${v.rightCss} maxW=${v.maxW}`); });
    if (r.widestInList) console.log('  widest in listbody:', JSON.stringify(r.widestInList));
  }
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
