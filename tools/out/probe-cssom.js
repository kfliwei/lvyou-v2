/* 探针：把 CSSOM 里被判「裸时序」的那一段原样打出来（查 C8 到底命中什么） */
const puppeteer = require('puppeteer-core');
const path = require('path'), http = require('http'), fs = require('fs');
const REAL = 'F:/MyAi/trace/lvyou-v2';
(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(REAL, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8' : p.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(d); });
  });
  await new Promise(r => server.listen(8198, '127.0.0.1', r));
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8198/topic.html', { waitUntil: 'load' });
  const out = await pg.evaluate(() => {
    const res = [];
    for (const sh of document.styleSheets) {
      if (/\/vendor\//.test(sh.href || '')) continue;
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      const walk = (list) => {
        for (const ru of list || []) {
          if (ru.cssRules && !(ru instanceof CSSStyleRule)) { walk(ru.cssRules); continue; }
          const tx = ru.cssText || '';
          if (tx.indexOf('locSheet') < 0) continue;
          const m = tx.match(/(?:^|[\s;{])(transition|animation)(-duration|-delay)?:[^;}]*/g) || [];
          res.push({ href: (sh.href || '').split('/').pop(), segs: m, head: tx.slice(0, 300) });
        }
      };
      walk(rules);
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close(); server.close();
})();
