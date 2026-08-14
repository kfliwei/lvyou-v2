/* 打磨项快速检查：hero 首屏密度 / 字号三档 / 弱网提示 */
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

  // 1. 首页首屏：hero 压缩后「最近的旅行」在首屏内可见
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_guide', '1'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  const hero = await page.evaluate(() => {
    const title = document.querySelector('.hero__title');
    const trip = document.querySelector('#tripbarEmpty') || document.querySelector('#tripbar');
    const tr = trip ? trip.getBoundingClientRect() : null;
    return {
      titleSize: title ? Math.round(parseFloat(getComputedStyle(title).fontSize)) : null,
      tripTop: tr ? Math.round(tr.top) : null,
      inFirstScreen: tr ? tr.top < 844 : false
    };
  });
  ok('首页标题缩小', hero.titleSize !== null && hero.titleSize <= 48, 'size=' + hero.titleSize);
  ok('最近的旅行进入首屏', hero.inFirstScreen, 'tripTop=' + hero.tripTop);

  // 2. 字号三档
  await page.goto('file:///' + path.join(ROOT, 'settings.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1800));
  const fonts = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#chFont .chip')].map(c => c.textContent.trim());
    return chips;
  });
  ok('字号三档（小字/标准/大字）', fonts.length === 3 && fonts.includes('大字'), fonts.join('/'));
  // 切大字生效
  await page.evaluate(() => { const c = [...document.querySelectorAll('#chFont .chip')].find(x => x.textContent.trim() === '大字'); if (c) c.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const lgSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  ok('大字档生效（>16px）', lgSize > 16, 'root=' + lgSize);
  await page.evaluate(() => { try { localStorage.setItem('tn_font', 'md'); } catch (e) {} });

  // 3. 弱网提示（模拟 offline 事件）
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.evaluate(() => { window.dispatchEvent(new Event('offline')); });
  await new Promise(r => setTimeout(r, 500));
  const net = await page.evaluate(() => {
    const el = document.getElementById('netHint');
    return el ? el.style.opacity : 'no-el';
  });
  ok('断网提示出现', net === '1', 'opacity=' + net);
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); });

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== POLISH CHECK FAIL: ' + fails + ' ===' : '=== POLISH CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
