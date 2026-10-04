/* vp-type-probe.js — 真机宽度档的排版实测：字号字面量分布 + 每行汉字数 + 卡片尺寸占比
 * 用法: NODE_PATH=… node tools/out/vp-type-probe.js [375 424 452]
 * 出这份数的原因：#76 要决定「按机型重定字号刻度」，但全站字号是 token 还是 px 字面量、
 * 大屏上每行汉字数到底飘到哪，必须先量，不能凭「感觉小气」。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VPS = (process.argv.slice(2).length ? process.argv.slice(2) : ['375', '424', '452']).map(Number);
const PAGES = ['index.html', 'review.html', 'topic.html', 'planner.html'];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  for (const W of VPS) {
    const H = Math.round(W * 2800 / 1272);
    console.log('\n########## CSS 视口 ' + W + ' x ' + H + ' ##########');
    const sizes = {};
    for (const p of PAGES) {
      await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
      await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1400));
      const m = await pg.evaluate(() => {
        const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const out = { rootFs, samples: [], cards: [], hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        const seen = new Set();
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (el.children.length === 0 && el.textContent.trim() && cs.display !== 'none' && parseFloat(cs.opacity) > .1) {
            const fs = +parseFloat(cs.fontSize).toFixed(1);
            const r = el.getBoundingClientRect();
            if (r.width < 12 || r.height < 4) continue;
            const key = cs.fontFamily.split(',')[0].replace(/["']/g, '') + '|' + fs + '|' + cs.fontWeight;
            if (!seen.has(key)) {
              seen.add(key);
              const perLine = Math.floor(r.width / fs);
              out.samples.push({ fs, weight: cs.weight || cs.fontWeight, fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').slice(0, 14), w: Math.round(r.width), chars: perLine, txt: el.textContent.trim().slice(0, 10) });
            }
          }
        }
        for (const c of document.querySelectorAll('.card')) {
          const r = c.getBoundingClientRect();
          if (r.width > 40 && r.top < innerHeight && r.bottom > 0) out.cards.push({ w: Math.round(r.width), h: Math.round(r.height), pctW: +(r.width / innerWidth * 100).toFixed(1) });
          if (out.cards.length > 5) break;
        }
        return out;
      });
      console.log('--- ' + p + '  root=' + m.rootFs + 'px  横向溢出=' + m.hScroll + 'px');
      m.samples.sort((a, b) => b.fs - a.fs).forEach(s => {
        sizes[s.fs] = (sizes[s.fs] || 0) + 1;
        console.log('    ' + String(s.fs).padStart(5) + 'px w' + s.weight + ' ' + s.fam.padEnd(15) + ' 行宽' + String(s.w).padStart(4) + 'px ≈ ' + String(s.chars).padStart(3) + ' 字  「' + s.txt + '」');
      });
      if (m.cards.length) console.log('    卡片: ' + m.cards.map(c => c.w + '×' + c.h + '(' + c.pctW + '%宽)').join(' | '));
    }
    console.log('  >> 本页族字号集合: ' + Object.keys(sizes).sort((a, b) => b - a).join(' '));
  }
  await browser.close();
})();
