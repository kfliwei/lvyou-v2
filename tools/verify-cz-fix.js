/* cz 专项验证：胶囊合并 / 路线区放大 / 空白提示 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=cz').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4500));

  async function view(lat, lng, z, wait) {
    await page.evaluate((lat, lng, z) => { window.TopicEngine._map.setView([lat, lng], z); }, lat, lng, z);
    await new Promise(r => setTimeout(r, wait || 1200));
    return page.evaluate(() => ({
      caps: [...document.querySelectorAll('#mapEl .lod-cl')].map(c => c.textContent.trim()),
      nodes: document.querySelectorAll('#mapEl .tr-node').length,
      hint: (document.getElementById('emptyHint') || {}).style ? document.getElementById('emptyHint').style.opacity : 'n/a',
      hintTxt: (document.getElementById('emptyHint') || {}).textContent || ''
    }));
  }

  // 1. 黔东南（贵州，city 写法变体区）z=7 city 层：应合并为一个胶囊
  let d = await view(26.6, 107.9, 7);
  const qdn = d.caps.filter(c => c.includes('黔东南'));
  ok('黔东南合并为单个胶囊', qdn.length === 1, JSON.stringify(qdn));
  ok('黔东南胶囊数字=2(黎平+瓮安)', qdn.length === 1 && /^2/.test(qdn[0]), qdn[0] || '');

  // 2. 遵义（路线密集）z=8 county 层有胶囊
  d = await view(27.7, 106.9, 8);
  ok('遵义 z8 county 胶囊出现', d.caps.length > 0, JSON.stringify(d.caps.slice(0, 4)));
  ok('z8 无空白提示', d.hint === '0', 'hint=' + d.hint);

  // 3. 遵义 z=10.5 节点层：普通节点不消失（稀疏不过滤）
  d = await view(27.7, 106.9, 10.5);
  ok('遵义 z10.5 节点可见(非必去不消失)', d.nodes > 0, 'nodes=' + d.nodes);

  // 4. 空白区（四川广安 30.5,106.5 无节点）z=8.5：空白提示出现
  d = await view(30.5, 106.5, 8.5);
  ok('空白区提示显示', d.hint === '1', 'hint=' + d.hint + ' txt=' + d.hintTxt);

  // 5. region 层 label 归一化（z=4 新疆显示为简称）
  d = await view(30, 106, 4);
  const hasXinjiang = d.caps.some(c => c.includes('新疆'));
  const hasFullName = d.caps.some(c => c.includes('维吾尔'));
  ok('region 层新疆归一化为简称', hasXinjiang && !hasFullName, JSON.stringify(d.caps.filter(c => c.includes('新'))));

  // 6. 筛选联动保持
  await page.evaluate(() => { const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去'); if (bq) bq.click(); });
  await new Promise(r => setTimeout(r, 1200));
  d = await view(30, 106, 5.5);
  const capSum = await page.evaluate(() => [...document.querySelectorAll('#mapEl .lod-cl__n')].reduce((s, e) => s + (+e.textContent || 0), 0));
  const dims = await page.evaluate(() => document.querySelectorAll('#mapEl .lod-dim').length);
  ok('必去筛选联动：数字=视野内必去数 且 0匹配组降透明', capSum > 0 && capSum <= 20 && dims > 0, 'capSum=' + capSum + ' dims=' + dims);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== CZ FIX VERIFY FAIL: ' + fails + ' ===' : '=== CZ FIX VERIFY ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
