/* 验证：聚合层 + 节点层的 flag/主题筛选联动 */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4500));

  // 默认 zoom（聚合层）胶囊总数
  const before = await page.evaluate(() => {
    const ns = [...document.querySelectorAll('.lod-cl__n')].map(e => +e.textContent);
    return { total: ns.reduce((a, b) => a + b, 0), caps: ns.length };
  });
  ok('聚合胶囊存在', before.caps > 0, 'caps=' + before.caps + ' 总数=' + before.total);

  // 点击"必去"
  await page.evaluate(() => {
    const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  const after = await page.evaluate(() => {
    const ns = [...document.querySelectorAll('.lod-cl__n')].map(e => +e.textContent);
    return {
      sum: ns.reduce((a, b) => a + b, 0),
      dims: document.querySelectorAll('.lod-dim').length,
      chipOn: [...document.querySelectorAll('#dynChips .chip')].filter(c => c.classList.contains('on')).map(c => c.textContent.trim())
    };
  });
  ok('必去筛选：胶囊数字变为匹配数', after.sum < before.total && after.sum > 0, '总数 ' + before.total + ' → 必去匹配 ' + after.sum);
  ok('0 匹配组降透明', after.dims > 0, 'dim=' + after.dims);
  ok('必去标签高亮', after.chipOn.includes('必去'), after.chipOn.join(','));

  // 点击"全部"恢复
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '全部');
    if (all) all.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const restored = await page.evaluate(() => {
    const ns = [...document.querySelectorAll('.lod-cl__n')].map(e => +e.textContent);
    return { sum: ns.reduce((a, b) => a + b, 0), dims: document.querySelectorAll('.lod-dim').length };
  });
  ok('全部恢复：数字还原且无降透明', restored.sum === before.total && restored.dims === 0, 'sum=' + restored.sum + ' dims=' + restored.dims);

  // 高 zoom 节点层：换北京页（节点密集）验证"必去"筛选 tr-dim
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 11); });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const bq = [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim() === '必去');
    if (bq) bq.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const nodeDim = await page.evaluate(() => ({
    dim: document.querySelectorAll('#mapEl .tr-dim').length,
    total: document.querySelectorAll('#mapEl .tr-node').length
  }));
  ok('节点层：网红筛选降透明', nodeDim.dim > 0 && nodeDim.total > nodeDim.dim, 'dim=' + nodeDim.dim + ' total=' + nodeDim.total);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== FLAG-LINK SMOKE FAIL: ' + fails + ' ===' : '=== FLAG-LINK SMOKE ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
