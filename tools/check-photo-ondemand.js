/* 验证：按需拉取实景照（静态未命中节点 → 实时高德 → 显示） */
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
  /* 注入高德 Key（本地测试用，不落盘代码） */
  const AMAP_KEY = process.env.AMAP_KEY || '';
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  await p.evaluate(k => { try { localStorage.setItem('tn_amap_key', k); } catch (e) {} }, AMAP_KEY);
  /* 找一个静态映射未命中的山西节点（如"应县木塔"——不在 site-images 或未知） */
  const r = await p.evaluate(async () => {
    const all = window.SITES || [];
    /* 优先找 SITE_IMAGES 未命中且名字明确的景点 */
    const m = window.SITE_IMAGES || {};
    const target = all.find(s => !m[s.name] && s.name && s.name.length > 2) || all[0];
    const i = all.indexOf(target);
    window.TopicEngine.openSheet(i);
    return { name: target.name, hasStatic: !!m[target.name] };
  });
  await sleep(4000); /* 等 JSONP + 图片 */
  const img = await p.evaluate(() => {
    const el = document.querySelector('#locSheet .ls-img img');
    return el ? { src: el.getAttribute('src'), shown: getComputedStyle(el).display !== 'none' } : null;
  });
  console.log('测试节点:', r.name, '| 静态命中:', r.hasStatic);
  ok('按需拉取成功（实时高德图）', img && img.src.includes('autonavi') && img.shown, img ? img.src.slice(0, 60) : 'no img');
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join('|').slice(0, 80));
  await browser.close();
  console.log(fails ? '=== ONDEMAND FAIL ===' : '=== ONDEMAND ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
