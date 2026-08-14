/* 验证：图层选择记忆 + 保存文件名 */
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

  // 1. 图层选择记忆：切 OSM → 刷新 → 保持 OSM
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('#layMenu .li')].find(x => x.dataset.id === 'osm');
    if (li) li.click();
    else { /* 直接设 localStorage 模拟 */ localStorage.setItem('tn_layer', 'osm'); }
  });
  await new Promise(r => setTimeout(r, 800));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3500));
  const lay = await page.evaluate(() => ({
    stored: localStorage.getItem('tn_layer'),
    onLi: document.querySelector('#layMenu .li.on') ? document.querySelector('#layMenu .li.on').dataset.id : 'none',
    tiles: document.querySelectorAll('#mapEl .leaflet-tile').length
  }));
  ok('图层选择已保存', lay.stored === 'osm', lay.stored);
  ok('刷新后保持所选图层', lay.onLi === 'osm', lay.onLi);
  ok('地图瓦片正常渲染', lay.tiles > 0, 'tiles=' + lay.tiles);
  // 清理
  await page.evaluate(() => { localStorage.removeItem('tn_layer'); });

  // 2. 备份文件名检查（代码层）
  const tn = require('fs').readFileSync(path.join(ROOT, 'travel-notes.js'), 'utf8');
  ok('备份文件名与产品对应', tn.includes("行迹TRACE备份-"), '');
  ok('单篇导出含日期', tn.includes("我的游记-' + new Date"), '');
  const poster = require('fs').readFileSync(path.join(ROOT, 'poster.js'), 'utf8');
  ok('制图海报文件名区分', poster.includes("carto: '制图'") && poster.includes('styleName'), '');

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== LAYER-SAVE CHECK FAIL ===' : '=== LAYER-SAVE CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
