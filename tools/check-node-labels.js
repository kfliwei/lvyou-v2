/* 验证：节点半透明名称标签 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* 专题页：高 zoom 节点出现名称标签 */
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  await p.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 13); });
  await sleep(1800);
  const labels = await p.evaluate(() => {
    const els = [...document.querySelectorAll('#mapEl .node-label')];
    return {
      count: els.length,
      opacity: els.length ? getComputedStyle(els[0]).opacity : 0,
      sample: els.length ? els[0].textContent.slice(0, 12) : ''
    };
  });
  ok('高 zoom 节点显示名称标签', labels.count > 0, labels.count + ' 个');
  ok('标签半透明(≤0.6)', labels.count > 0 && parseFloat(labels.opacity) <= 0.6, 'opacity=' + labels.opacity);
  ok('标签内容为景点名', labels.sample.length > 1, labels.sample);
  /* 低 zoom 不显示标签 */
  await p.evaluate(() => { window.TopicEngine._map.setView([34.5, 105], 5); });
  await sleep(1500);
  const lowCount = await p.evaluate(() => document.querySelectorAll('#mapEl .node-label').length);
  ok('低 zoom 不显示标签', lowCount === 0, 'count=' + lowCount);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await p.close();
  await browser.close();
  console.log(fails ? '=== LABEL FAIL ===' : '=== LABEL ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
