/* 验证：用户节点在专题页/全国地图显示（含 GCJ 坐标节点） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const userNodes = [
    { id: 'v1', name: 'WGS茶馆', lat: 39.92, lng: 116.40, gcj: false, province: '北京市', city: '北京', category: '茶馆', tags: [], desc: 'wgs', createdAt: Date.now() },
    { id: 'v2', name: 'GCJ观景台', lat: 39.91, lng: 116.39, gcj: true, province: '北京市', city: '北京', category: '观景台', tags: [], desc: 'gcj', createdAt: Date.now() }
  ];

  /* 专题页 bj */
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  await page.evaluate(nodes => localStorage.setItem('tn_userNodes', JSON.stringify(nodes)), userNodes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 13); });
  await sleep(1800);
  const bj = await page.evaluate(() => {
    const users = [...document.querySelectorAll('#mapEl .tr-user')];
    const total = document.querySelectorAll('#mapEl .tr-node').length;
    const cnt = (document.getElementById('totalTag') || {}).textContent || '';
    return { users: users.length, total, cnt };
  });
  ok('专题页显示用户节点', bj.users >= 2, 'tr-user=' + bj.users);
  ok('专题页计数含用户节点', /共 \d+ 处/.test(bj.cnt) && bj.cnt.includes('处'), bj.cnt.slice(0, 20));
  /* 打开用户节点详情（WGS 茶馆）确认 buildSheet 正常 */
  await page.evaluate(() => {
    const m = document.querySelectorAll('#mapEl .tr-user')[0];
    if (m) m.closest('.leaflet-marker-icon').click();
  });
  await sleep(700);
  const sheet = await page.evaluate(() => (document.querySelector('#locSheet') || {}).textContent || '');
  ok('用户节点详情可打开', sheet.includes('WGS茶馆') || sheet.includes('GCJ观景台'), sheet.slice(0, 30));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('专题页无脚本错误', real.length === 0, real.join(' | ').slice(0, 100));
  await page.close();

  /* 全国地图 nation */
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs2 = [];
  page2.on('pageerror', e => errs2.push(e.message.slice(0, 150)));
  await page2.goto('file:///' + path.join(ROOT, 'topic.html?p=nation').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await page2.evaluate(nodes => localStorage.setItem('tn_userNodes', JSON.stringify(nodes)), userNodes);
  await page2.reload({ waitUntil: 'domcontentloaded' });
  await sleep(6000);
  await page2.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 13); });
  await sleep(1800);
  const nat = await page2.evaluate(() => document.querySelectorAll('#mapEl .tr-user').length);
  ok('全国地图显示用户节点', nat >= 2, 'tr-user=' + nat);
  const real2 = errs2.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('全国地图无脚本错误', real2.length === 0, real2.join(' | ').slice(0, 100));
  await page2.close();

  await browser.close();
  console.log(fails ? '=== USER-NODES-VISIBLE FAIL ===' : '=== USER-NODES-VISIBLE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
