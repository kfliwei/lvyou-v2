/* vp-overflow-audit.js — 全页文字溢出/裁切审计（字号上浮后的回归闸门探针）
 * 用法: NODE_PATH=… node tools/out/vp-overflow-audit.js [452x995] [320x704]
 * 判据：可见文本叶子节点，在自身 overflow 为 hidden/clip 的轴上 scroll* > client* + 1px
 *      → 文字被静默裁掉（用户看到的是断句，不是省略号）。
 *      横向滚动容器（overflow-x:auto/scroll，如 .chip-row）不算，那是设计内的。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VPS = (process.argv.slice(2).length ? process.argv.slice(2) : ['452x995', '320x704']);
const fs = require('fs');
const PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^(test-data|icons-demo)\.html$/.test(f));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  let total = 0;
  for (const wh of VPS) {
    const [W, H] = wh.split('x').map(Number);
    console.log('\n########## ' + wh + ' ##########');
    await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    for (const p of PAGES) {
      await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      const m = await pg.evaluate(() => {
        const out = { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, clip: [] };
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || !el.textContent.trim()) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasOwnText) continue;
          const clipX = (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1;
          const clipY = (cs.overflowY === 'hidden' || cs.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 1;
          if (clipX || clipY) {
            /* text-overflow:ellipsis 是设计内的截断，只登记「无省略号的硬裁」 */
            if (cs.textOverflow === 'ellipsis' && clipX && !clipY) continue;
            out.clip.push({ axis: (clipX ? 'x' : '') + (clipY ? 'y' : ''), cls: (el.className || el.tagName).toString().slice(0, 34), lost: (clipX ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight), txt: el.textContent.trim().slice(0, 16) });
          }
        }
        return out;
      });
      total += m.clip.length;
      const head = (m.doc > 0 ? 'HOVERFLOW+' + m.doc + 'px ' : '        ') + p.padEnd(20) + ' 硬裁 ' + m.clip.length;
      console.log(head);
      m.clip.slice(0, 6).forEach(c => console.log('        ' + c.axis.toUpperCase() + ' 丢 ' + c.lost + 'px  .' + c.cls + '  「' + c.txt + '」'));
    }
  }
  console.log('\n合计疑似硬裁 ' + total + ' 处（' + PAGES.length + ' 页 × ' + VPS.length + ' 档）');
  await browser.close();
})();
