/* 验证：随手记地点选择（高德逆地理 + POI 面板 + 降级） */
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
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // mock 高德 JSONP：拦截 script 请求并返回模拟 regeo 响应
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.indexOf('restapi.amap.com/v3/geocode/regeo') >= 0) {
      const cb = (url.match(/callback=([\w]+)/) || [])[1] || 'cb';
      req.respond({
        status: 200,
        contentType: 'application/javascript',
        body: cb + '({' +
          '"status":"1","regeocode":{' +
          '"formatted_address":"北京市东城区景山前街4号",' +
          '"pois":[' +
          '{"name":"故宫博物院","location":"116.397,39.916","distance":"120","address":"景山前街4号"},' +
          '{"name":"景山公园","location":"116.397,39.928","distance":"450","address":"景山西街44号"},' +
          '{"name":"天安门广场","location":"116.397,39.903","distance":"900","address":"东长安街"}' +
          ']}})'
      });
    } else if (url.startsWith('http')) {
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. 无 Key：直接回退当前位置
  let picked = null;
  await page.evaluate(() => { try { localStorage.removeItem('tn_amap_key'); } catch (e) {} });
  picked = await page.evaluate(() => new Promise(res => {
    window.__tnPickPlace(39.9, 116.4, function (p) { res(p); }, function () { res('CANCELLED'); });
  }));
  ok('无 Key 直接回退当前位置', picked && picked.label.includes('当前位置'), JSON.stringify(picked));

  // 2. 有 Key：面板出现 + POI 列表
  await page.evaluate(() => { try { localStorage.setItem('tn_amap_key', 'mock-key'); } catch (e) {} });
  const pickResult = await page.evaluate(() => new Promise(res => {
    window.__tnPickPlace(39.9, 116.4, function (p) { res({ picked: p }); }, function () { res({ cancelled: true }); });
    setTimeout(function () {
      const el = document.getElementById('placePicker');
      if (el) {
        const t = el.textContent;
        res({ panel: true, hasCur: t.includes('当前位置'), hasPoi1: t.includes('故宫博物院'), hasPoi2: t.includes('景山公园'), hasDist: t.includes('120 米') });
      } else res({ panel: false });
    }, 1500);
  }));
  ok('有 Key 时地点选择面板出现', pickResult.panel === true, JSON.stringify(pickResult).slice(0, 120));
  ok('面板含当前位置 + POI 列表 + 距离', pickResult.hasCur && pickResult.hasPoi1 && pickResult.hasPoi2 && pickResult.hasDist, JSON.stringify(pickResult));

  // 3. 选择 POI：点击"景山公园"行
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#placePicker div')];
    const row = rows.find(r => r.textContent.includes('景山公园') && r.textContent.length < 60 && !r.textContent.includes('故宫'));
    if (row) row.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const chosen = await page.evaluate(() => {
    const el = document.getElementById('placePicker');
    return { closed: !el };
  });
  ok('选择后面板关闭', chosen.closed, '');

  // 4. 取消：点 ✕ 触发 onCancel
  await page.evaluate(() => { try { localStorage.setItem('tn_amap_key', 'mock-key'); } catch (e) {} });
  const cancelResult = await page.evaluate(() => new Promise(res => {
    window.__tnPickPlace(39.9, 116.4, function () { res('PICKED'); }, function () { res('CANCELLED'); });
    setTimeout(function () {
      const c = document.getElementById('placePickerClose');
      if (c) c.click(); else res('NO_PANEL');
    }, 1200);
    setTimeout(function () { res('TIMEOUT'); }, 2500);
  }));
  ok('取消按钮触发 onCancel', cancelResult === 'CANCELLED', cancelResult);

  // 5. 关闭拦截
  await page.setRequestInterception(false);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== PICK-PLACE CHECK FAIL ===' : '=== PICK-PLACE CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
