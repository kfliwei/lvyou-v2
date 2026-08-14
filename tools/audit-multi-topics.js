/* 抽查多专题 LOD：四川(大省)/宁夏(小省)/长征(跨省)/青藏(跨省) */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }

async function audit(page, p, zs) {
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=' + p).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3800));
  const out = [];
  for (const z of zs) {
    const d = await page.evaluate((z) => {
      const map = window.TopicEngine._map;
      map.setView(map.getCenter(), z);
      return new Promise(res => setTimeout(() => {
        const markers = [...document.querySelectorAll('#mapEl .leaflet-marker-icon')];
        const caps = [...document.querySelectorAll('#mapEl .lod-cl')];
        const capSum = caps.reduce((s, c) => s + (+(c.querySelector('.lod-cl__n') || {}).textContent || 0), 0);
        const nodes = [...document.querySelectorAll('#mapEl .tr-node')];
        const pos = {}; let dup = 0;
        markers.forEach(m => { const t = m.style.transform; if (t) { pos[t] = (pos[t] || 0) + 1; if (pos[t] === 2) dup++; } });
        res({ z, markers: markers.length, caps: caps.length, capSum, nodes: nodes.length, dup, both: caps.length > 0 && nodes.length > 0 });
      }, 900));
    }, z);
    out.push(d);
    console.log(`  [${p}] z=${d.z} 胶囊=${d.caps}(和=${d.capSum}) 节点=${d.nodes} 重复=${d.dup} 并存=${d.both}`);
  }
  const bad = out.filter(d => d.dup > 0 || d.both);
  ok(p + ': 各级别无重复/并存', bad.length === 0, 'bad=' + bad.length);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));

  await audit(page, 'sc', [5, 7, 9, 10.5, 11.5]);
  await audit(page, 'nx', [5, 7, 9, 10.5, 11.5]);
  await audit(page, 'cz', [5, 6.5, 8, 10.5, 11.5]);
  await audit(page, 'qz', [4, 6, 8, 10.5, 11.5]);
  await audit(page, 'gxyn', [4.5, 6, 8, 10.5, 11.5]);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== MULTI-TOPIC AUDIT FAIL: ' + fails + ' ===' : '=== MULTI-TOPIC AUDIT ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
