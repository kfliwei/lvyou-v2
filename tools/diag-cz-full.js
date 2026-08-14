/* 诊断 cz（长征）专题：分组/分层/瓦片/筛选联动/放大空白 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|manifest/.test(m.text())) console.log('CONSOLE:', m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=cz').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  // 1. 专题配置 + 数据概况
  const cfg = await page.evaluate(() => {
    const M = window.TOPIC_REGISTRY['cz'];
    return {
      center: M.center, zoom: M.zoom, routesKey: M.routesKey,
      total: window.SITES ? window.SITES.length : -1,
      majorThemes: M.majorThemes,
      regionCount: [...new Set((window.SITES || []).map(s => s.region))],
      cityCount: [...new Set((window.SITES || []).map(s => s.city))].length,
      countyCount: [...new Set((window.SITES || []).map(s => s.county))].length,
      flagM: (window.SITES || []).filter(s => s.flag && s.flag.indexOf('m') >= 0).length,
      flagH: (window.SITES || []).filter(s => s.flag && s.flag.indexOf('h') >= 0).length,
      // 同名县（跨市/跨省）检查
      countyDup: (() => {
        const m = {};
        (window.SITES || []).forEach(s => { const k = s.county; if (k) { (m[k] = m[k] || []).push(s.region + '·' + s.city); } });
        return Object.keys(m).filter(k => new Set(m[k]).size > 1).map(k => k + ':' + [...new Set(m[k])].join('/'));
      })(),
      cityDup: (() => {
        const m = {};
        (window.SITES || []).forEach(s => { const k = s.city; if (k) { (m[k] = m[k] || []).push(s.region); } });
        return Object.keys(m).filter(k => new Set(m[k]).size > 1).map(k => k + ':' + [...new Set(m[k])].join('/'));
      })()
    };
  });
  console.log('=== cz 配置 ===');
  console.log(JSON.stringify(cfg, null, 1));

  // 2. 各级 zoom 的渲染情况（含筛选前后）
  const levels = [4, 5.5, 6.5, 8, 9, 10.2, 10.8, 11.5];
  for (const z of levels) {
    const d = await page.evaluate((z) => {
      const map = window.TopicEngine._map;
      map.setView(map.getCenter(), z);
      return new Promise(res => setTimeout(() => {
        const caps = [...document.querySelectorAll('#mapEl .lod-cl')];
        const capSum = caps.reduce((s, c) => s + (+(c.querySelector('.lod-cl__n') || {}).textContent || 0), 0);
        const nodes = [...document.querySelectorAll('#mapEl .tr-node')];
        const capTxts = caps.map(c => c.textContent.trim()).slice(0, 8);
        res({ z, caps: caps.length, capSum, nodes: nodes.length, samples: capTxts });
      }, 1000));
    }, z);
    console.log(`z=${d.z} 胶囊=${d.caps}(和=${d.capSum}) 节点=${d.nodes} 样本=${JSON.stringify(d.samples)}`);
  }

  // 3. 瓦片加载状态
  const tiles = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#mapEl img.leaflet-tile')];
    const ok = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
    return { total: imgs.length, loaded: ok };
  });
  console.log('瓦片:', JSON.stringify(tiles));

  // 4. 必去筛选联动
  await page.evaluate(() => {
    const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const f = await page.evaluate((z) => {
    const map = window.TopicEngine._map;
    map.setView(map.getCenter(), z);
    return new Promise(res => setTimeout(() => {
      const caps = [...document.querySelectorAll('#mapEl .lod-cl')];
      const capSum = caps.reduce((s, c) => s + (+(c.querySelector('.lod-cl__n') || {}).textContent || 0), 0);
      const dims = document.querySelectorAll('#mapEl .lod-dim').length;
      const nodes = [...document.querySelectorAll('#mapEl .tr-node')];
      res({ caps: caps.length, capSum, dims, nodes: nodes.length, trDim: document.querySelectorAll('#mapEl .tr-dim').length });
    }, 1000));
  }, 6.5);
  console.log('必去筛选 z6.5:', JSON.stringify(f));
  await page.evaluate(() => { const a = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '全部'); if (a) a.click(); });
  await new Promise(r => setTimeout(r, 800));

  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
