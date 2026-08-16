/* 修正审核流程：勾选 2 个 → scheduleBtn → 结果验证 */
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
  p.on('pageerror', e => errs.push(e.message.slice(0, 130)));
  await p.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  /* 输入意图 */
  await p.evaluate(() => {
    const inp = document.getElementById('promptInput');
    inp.value = '6天，西双版纳周边+广西，喜欢自然风光';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.evaluate(() => document.getElementById('genBtn').click());
  await sleep(3000);
  const candN = await p.evaluate(() => document.querySelectorAll('.cand').length);
  ok('候选列表', candN >= 2, 'cand=' + candN);
  /* 勾选前 3 个 */
  await p.evaluate(() => {
    const cs = document.querySelectorAll('.cand');
    for (let i = 0; i < Math.min(3, cs.length); i++) cs[i].click();
  });
  await sleep(500);
  const selN = await p.evaluate(() => (document.querySelectorAll('.cand.on').length));
  ok('勾选 3 个', selN === 3, 'sel=' + selN);
  /* 排期 */
  await p.evaluate(() => document.getElementById('scheduleBtn').click());
  await sleep(2500);
  const r = await p.evaluate(() => {
    const days = document.querySelectorAll('#resultBody [class*="day-"]').length + document.querySelectorAll('#resultBody .day').length;
    return {
      title: (document.getElementById('resultTitle') || {}).textContent || '',
      days,
      map: !!document.querySelector('#mapBox .leaflet-container'),
      actBtns: (document.getElementById('actRow') || {}).textContent || '',
      bodyLen: (document.getElementById('resultBody') || {}).innerHTML ? document.getElementById('resultBody').innerHTML.length : 0
    };
  });
  console.log('排期结果:', JSON.stringify(r).slice(0, 250));
  ok('排期标题（天/站/km）', r.title.includes('天') && r.title.includes('站'), r.title.slice(0, 40));
  ok('每日卡片渲染', r.days >= 1 || r.bodyLen > 100, 'days=' + r.days + ' body=' + r.bodyLen);
  ok('操作按钮（保存/复制/GPX/路书）', /保存|复制|GPX|路书/.test(r.actBtns), r.actBtns.slice(0, 30));
  /* 地图（需在结果里点地图？resultMap 存在即检查） */
  ok('地图容器就绪', r.map, 'map=' + r.map);
  /* 保存行程（localStorage） */
  await p.evaluate(() => { const b = [...document.querySelectorAll('#actRow .btn')].find(x => /保存/.test(x.textContent)); if (b) b.click(); });
  await sleep(600);
  const saved = await p.evaluate(() => {
    try { const trips = JSON.parse(localStorage.getItem('tn_trips') || '[]'); return trips.length; } catch (e) { return -1; }
  });
  console.log('保存行程数:', saved);
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await browser.close();
  console.log(fails ? '=== PLANNER2 FAIL ===' : '=== PLANNER2 ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
