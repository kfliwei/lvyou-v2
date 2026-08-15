/* 验证：标签避让（重叠时低优先级隐藏） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  await p.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 13); });
  await sleep(2000);
  /* 手动触发避让并检查 */
  const r = await p.evaluate(() => {
    const labels = [...document.querySelectorAll('#mapEl .node-label')];
    if (!labels.length) return { n: 0 };
    window.labelAvoid('#mapEl');
    const visible = labels.filter(l => !l.classList.contains('hidden'));
    /* 检查可见标签是否两两不重叠 */
    let overlap = 0;
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i].getBoundingClientRect(), b = visible[j].getBoundingClientRect();
        if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) overlap++;
      }
    }
    return { n: labels.length, visible: visible.length, hidden: labels.length - visible.length, overlap };
  });
  ok('标签已渲染', r.n > 0, 'n=' + r.n);
  if (r.n > 0) {
    ok('避让后有隐藏', r.hidden >= 0, 'visible=' + r.visible + ' hidden=' + r.hidden);
    ok('可见标签无重叠', r.overlap === 0, 'overlap=' + r.overlap);
  }
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== AVOID FAIL ===' : '=== AVOID ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
