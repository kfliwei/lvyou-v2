/* 验证：心愿单分组 / 空态 CTA / 深色瓦片 */
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

  // 1. 心愿单分组
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    localStorage.setItem('tn_wishlist', JSON.stringify([
      { id: '故宫|39.916|116.397', label: '故宫', lat: 39.916, lng: 116.397, region: '北京市', city: '北京', theme: '古建寺院', ts: Date.now(), visited: 0 },
      { id: '西湖|30.24|120.15', label: '西湖', lat: 30.24, lng: 120.15, region: '浙江省', city: '杭州', theme: '江河湖泊', ts: Date.now(), visited: 0 },
      { id: '灵隐寺|30.24|120.10', label: '灵隐寺', lat: 30.24, lng: 120.10, region: '浙江省', city: '杭州', theme: '佛寺', ts: Date.now(), visited: Date.now() },
      { id: '外滩|31.24|121.49', label: '外滩', lat: 31.24, lng: 121.49, region: '上海市', city: '上海', theme: '城市地标', ts: Date.now(), visited: 0 }
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  const grp = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('.wl-group-head')].map(h => h.textContent.trim()),
    groups: document.querySelectorAll('.wl-group').length,
    items: document.querySelectorAll('.wl-item').length
  }));
  ok('心愿单按省分组（北京/浙江/上海 + 已打卡）', grp.groups === 4 && grp.heads.some(h => h.includes('北京市')) && grp.heads.some(h => h.includes('已打卡')), JSON.stringify(grp.heads));
  ok('分组后条目完整', grp.items === 4, 'items=' + grp.items);
  // 折叠浙江组
  await page.evaluate(() => {
    const head = [...document.querySelectorAll('.wl-group-head')].find(h => h.textContent.includes('浙江省'));
    if (head) head.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const collapsed = await page.evaluate(() => {
    const head = [...document.querySelectorAll('.wl-group-head')].find(h => h.textContent.includes('浙江省'));
    const group = head ? head.parentElement : null;
    return group ? group.querySelectorAll('.wl-item').length : -1;
  });
  ok('省组可折叠', collapsed === 0, '组内条目=' + collapsed);
  // 再展开
  await page.evaluate(() => {
    const head = [...document.querySelectorAll('.wl-group-head')].find(h => h.textContent.includes('浙江省'));
    if (head) head.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const expanded = await page.evaluate(() => {
    const head = [...document.querySelectorAll('.wl-group-head')].find(h => h.textContent.includes('浙江省'));
    const group = head ? head.parentElement : null;
    return group ? group.querySelectorAll('.wl-item').length : -1;
  });
  ok('省组可再展开', expanded === 1, '组内条目=' + expanded);

  // 2. search 空态 CTA
  await page.goto('file:///' + path.join(ROOT, 'search.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '不存在的地方zzz';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 1200));
  const se = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.empty a')];
    return { cta: links.map(a => a.textContent.trim()), href: links[0] ? links[0].getAttribute('href') : '' };
  });
  ok('搜索空态 CTA（去全国地图）', se.cta.some(t => t.includes('全国地图')), JSON.stringify(se));

  // 3. 深色瓦片
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=sx').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.evaluate(() => { document.documentElement.classList.add('theme-dark'); });
  await new Promise(r => setTimeout(r, 800));
  const dark = await page.evaluate(() => {
    const tile = document.querySelector('#mapEl .leaflet-tile');
    return tile ? getComputedStyle(tile).filter : 'no-tile';
  });
  ok('深色模式瓦片压暗', /brightness/.test(dark), dark);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== POLISH2 CHECK FAIL: ' + fails + ' ===' : '=== POLISH2 CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
