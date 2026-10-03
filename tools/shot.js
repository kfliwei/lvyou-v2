/* shot.js - 页面截图（视觉基线用）：node tools/shot.js <page>... [--vp 390x844] [--tag before] */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const vpi = argv.indexOf('--vp'), tagi = argv.indexOf('--tag');
const vp = vpi >= 0 ? argv[vpi + 1] : '390x844';
const WH = vp.split('x').map(Number);
const TAG = tagi >= 0 ? argv[tagi + 1] : 'shot';
const skip = new Set();
if (vpi >= 0) { skip.add(vpi); skip.add(vpi + 1); }
if (tagi >= 0) { skip.add(tagi); skip.add(tagi + 1); }
const pages = argv.filter((a, i) => !a.startsWith('--') && !skip.has(i));
const OUT = path.join(ROOT, 'tools', 'out', 'shots', TAG);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  const page = await browser.newPage();
  await page.setViewport({ width: WH[0], height: WH[1], deviceScaleFactor: 2 });
  for (const p of pages) {
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 80)));
    await page.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => errs.push('nav:' + e.message.slice(0, 60)));
    await new Promise(r => setTimeout(r, 1200));
    const f = path.join(OUT, p.replace('.html', '') + '.png');
    await page.screenshot({ path: f });
    console.log((errs.length ? 'ERR ' + errs.join('|') + ' -> ' : 'OK  ') + path.basename(f));
  }
  await browser.close();
})();
