/* LOD 全面审查：专题页 + 全国页，多 zoom 级别检测重复/错乱 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }

async function inspect(page, label, z) {
  const d = await page.evaluate((z) => {
    const map = window.TopicEngine._map;
    map.setView(map.getCenter(), z);
    return new Promise(res => {
      setTimeout(() => {
        const markers = [...document.querySelectorAll('#mapEl .leaflet-marker-icon')];
        const cls = markers.map(m => m.className);
        // 聚合胶囊
        const caps = [...document.querySelectorAll('#mapEl .lod-cl')];
        const capSum = caps.reduce((s, c) => s + (+(c.querySelector('.lod-cl__n') || {}).textContent || 0), 0);
        // 节点标记
        const nodes = [...document.querySelectorAll('#mapEl .tr-node')];
        // 同坐标重复检测（divIcon 的 transform 定位）
        const pos = {};
        let dup = 0;
        markers.forEach(m => {
          const t = m.style.transform;
          if (t) { pos[t] = (pos[t] || 0) + 1; if (pos[t] === 2) dup++; }
        });
        // 聚合与节点并存
        const both = caps.length > 0 && nodes.length > 0;
        res({ z, markers: markers.length, caps: caps.length, capSum, nodes: nodes.length, dup, both });
      }, 900);
    });
  }, z);
  console.log(`  z=${d.z} markers=${d.markers} 胶囊=${d.caps}(和=${d.capSum}) 节点=${d.nodes} 同坐标重复组=${d.dup} 聚合节点并存=${d.both}`);
  return d;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));

  // ===== 专题页 sx（山西古建，省内多市多县） =====
  console.log('===== 专题页 sx =====');
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  let sxBad = 0;
  for (const z of [5, 7, 8.5, 10.3, 10.8, 11.5, 12.5]) {
    const d = await inspect(page, 'sx', z);
    if (d.dup > 0 || d.both) sxBad++;
  }
  ok('sx: 各层级无重复标记/无聚合节点并存', sxBad === 0, 'bad=' + sxBad);

  // 筛选状态下检测
  await page.evaluate(() => {
    const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  const dF = await inspect(page, 'sx+必去', 10.8);
  ok('sx+必去 z10.8: 无重复', dF.dup === 0, 'dup=' + dF.dup);
  ok('sx+必去 z10.8: 无并存', !dF.both, 'both=' + dF.both);
  await page.evaluate(() => { const a = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '全部'); if (a) a.click(); });
  await new Promise(r => setTimeout(r, 800));

  // ===== 全国页（region 多） =====
  console.log('===== 全国页 nation =====');
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  let naBad = 0;
  for (const z of [3, 4.5, 6, 8, 9.5, 11, 12.5]) {
    const d = await inspect(page, 'nation', z);
    if (d.dup > 0 || d.both) naBad++;
  }
  ok('nation: 各层级无重复标记/无聚合节点并存', naBad === 0, 'bad=' + naBad);

  // 全国页筛选
  await page.evaluate(() => {
    const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  const dN = await inspect(page, 'nation+必去', 6);
  ok('nation+必去 z6: 无重复', dN.dup === 0, 'dup=' + dN.dup);
  ok('nation+必去 z6: 胶囊数字>0', dN.capSum > 0, 'capSum=' + dN.capSum);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== LOD AUDIT FAIL: ' + fails + ' ===' : '=== LOD AUDIT ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
