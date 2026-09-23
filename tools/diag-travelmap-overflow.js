/* diag-travelmap-overflow.js — 实测 travel-map.html 及其「游记列表」面板的横向溢出元素 */
const p = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await p.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 390, height: 844 });
  await pg.goto('file:///F:/myai/trace/travel-map.html');
  await new Promise(r => setTimeout(r, 2000));

  async function measure(label) {
    const r = await pg.evaluate(() => {
      const vw = window.innerWidth;
      const doc = document.documentElement;
      const out = { vw, scrollW: Math.max(doc.scrollWidth, document.body.scrollWidth), offenders: [] };
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || el.getBoundingClientRect().width === 0 && !el.offsetParent) {
          const rc0 = el.getBoundingClientRect();
          if (rc0.width === 0 && cs.display === 'none') return;
        }
        const rc = el.getBoundingClientRect();
        if (rc.width > 0 && (rc.right > vw + 1 || rc.left < -1)) {
          out.offenders.push({
            d: (el.closest('.tn-list') ? '[list] ' : '') + el.tagName.toLowerCase() +
              (el.id ? '#' + el.id : '') + ' ' +
              String(el.className.baseVal !== undefined ? el.className.baseVal : (el.className || '')).split(' ').slice(0, 2).join('.'),
            L: Math.round(rc.left), R: Math.round(rc.right), W: Math.round(rc.width)
          });
        }
      });
      out.offenders.sort((a, b2) => b2.R - a.R);
      return out;
    });
    console.log(`--- ${label}: viewport=${r.vw} scrollWidth=${r.scrollW} ${r.scrollW > r.vw ? 'OVERFLOW ⚠️' : 'ok'}`);
    r.offenders.slice(0, 12).forEach(o => console.log(`   ${o.d}  L${o.L} R${o.R} W${o.W}`));
    return r;
  }

  await measure('基础页(地图)');
  await pg.evaluate(() => { try { TravelNotes.openList(); } catch (e) { console.log('openList fail', e.message); } });
  await new Promise(r => setTimeout(r, 600));
  await measure('打开游记列表后');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
