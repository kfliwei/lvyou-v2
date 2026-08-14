/* 一次性自检：explore-map 文案/视觉 + nation 专题页数据加载 */
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
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // explore-map
  await page.goto('file:///' + path.join(ROOT, 'explore-map.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  const em = await page.evaluate(() => {
    const hero = document.querySelector('.hero__sub');
    const search = document.querySelector('.hero a[href="search.html"]');
    const stamps = [...document.querySelectorAll('.story-item__stamp')];
    const imgStamps = stamps.filter(s => s.querySelector('img')).length;
    const textStamps = stamps.filter(s => !s.querySelector('img') && s.textContent.trim()).length;
    const noBg = stamps.filter(s => getComputedStyle(s).backgroundColor === 'rgba(0, 0, 0, 0)').length;
    return {
      heroTxt: hero ? hero.textContent : '',
      searchTxt: search ? search.textContent : '',
      total: stamps.length, imgStamps, textStamps, noBg
    };
  });
  ok('explore: 搜索文案更新', em.searchTxt.includes('7782'), em.searchTxt.trim());
  ok('explore: hero 副标题更新', em.heroTxt.includes('三十四省'), em.heroTxt);
  ok('explore: 专题卡片齐全', em.total === em.imgStamps + em.textStamps && em.total >= 30, 'total=' + em.total + ' 图=' + em.imgStamps + ' 字=' + em.textStamps);
  ok('explore: 无透明空章', em.noBg === 0, 'noBg=' + em.noBg);
  ok('explore: 无脚本错误', errors.length === 0, errors[0] || '');

  // nation 专题页
  await page.goto('file:///' + path.join(ROOT, 'topic.html').replace(/\\/g, '/') + '?p=nation', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  const nt = await page.evaluate(() => ({
    meta: (window.NATION_META && window.NATION_META.count) || null,
    sites: (window.SITES && window.SITES.length) || 0,
    flagged: (window.SITES || []).filter(s => s.flag).length
  }));
  ok('nation: 数据加载', nt.sites >= 7800, 'sites=' + nt.sites);
  ok('nation: flag 已带出', nt.flagged > 100, 'flagged=' + nt.flagged);
  ok('nation: 无脚本错误', errors.length === 0, errors[0] || '');

  console.log(fails ? '=== SELF-CHECK FAIL: ' + fails + ' ===' : '=== SELF-CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
