/* 临时验证脚本：wishlist 规划叠加地图（修复 4）— 用完即删 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto('file:///' + path.join(ROOT, 'wishlist.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 注入 5 个带坐标的心愿节点（分布在两片区域，触发多天规划）
  await page.evaluate(() => {
    const KEY = 'tn_wishlist';
    const pts = [
      { name: '大理古城', label: '大理古城', lat: 25.689, lng: 100.156, region: '云南省', city: '大理', theme: '古城古镇' },
      { name: '洱海', label: '洱海', lat: 25.785, lng: 100.188, region: '云南省', city: '大理', theme: '高原湖泊' },
      { name: '丽江古城', label: '丽江古城', lat: 26.872, lng: 100.233, region: '云南省', city: '丽江', theme: '古城古镇' },
      { name: '玉龙雪山', label: '玉龙雪山', lat: 27.098, lng: 100.175, region: '云南省', city: '丽江', theme: '雪山冰川' },
      { name: '都江堰', label: '都江堰', lat: 31.003, lng: 103.605, region: '四川省', city: '成都', theme: '江河瀑布' }
    ];
    localStorage.setItem(KEY, JSON.stringify(pts));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // 点「规划行程」
  await page.click('#wlPlanBtn');
  await new Promise(r => setTimeout(r, 2500));

  const res = await page.evaluate(() => {
    const mapBox = document.getElementById('wlMap');
    const planBox = document.getElementById('wlPlan');
    const days = window.__planDays || [];
    // divIcon 渲染为 .leaflet-marker-icon；polyline 为 overlay pane 内的 SVG path
    const markers = document.querySelectorAll('#wlMap .leaflet-marker-icon').length;
    const lines = document.querySelectorAll('#wlMap .leaflet-overlay-pane path').length;
    return {
      mapVisible: mapBox.style.display === 'block',
      planVisible: planBox.style.display === 'block',
      dayCount: days.length,
      stations: days.reduce((s, d) => s + d.length, 0),
      markers, lines,
      btnText: document.getElementById('wlMapBtn').textContent
    };
  });

  ok('规划后地图自动打开', res.mapVisible);
  ok('计划卡片显示', res.planVisible, res.dayCount + ' 天 / ' + res.stations + ' 站');
  ok('按地理分日 >= 2 天', res.dayCount >= 2, 'days=' + res.dayCount);
  ok('地图标记数 = 站点数', res.markers === res.stations, 'markers=' + res.markers + ' stations=' + res.stations);
  ok('路线连线已绘制', res.lines >= 1, 'lines=' + res.lines);
  ok('地图按钮状态同步', res.btnText === '列表', res.btnText);

  // 收起计划：地图同步关闭
  await page.evaluate(() => { document.getElementById('wlPlanClose').click(); });
  await new Promise(r => setTimeout(r, 500));
  const closed = await page.evaluate(() => ({
    mapVisible: document.getElementById('wlMap').style.display === 'block',
    planVisible: document.getElementById('wlPlan').style.display === 'block',
    btnText: document.getElementById('wlMapBtn').textContent
  }));
  ok('收起计划后地图关闭', !closed.mapVisible && !closed.planVisible, 'btn=' + closed.btnText);

  const real = errors.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|CORS/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');

  console.log(fails ? '=== PLAN-MAP SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== PLAN-MAP SMOKE ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
