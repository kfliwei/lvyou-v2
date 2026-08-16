/* 一句话加节点：功能测试（规则解析路径） */
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
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await p.goto('file:///' + path.join(ROOT, 'node-manager.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  /* 找 AI 加节点入口按钮 */
  const r0 = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter(b => /加节点|添加/.test(b.textContent));
    return btns.map(b => b.textContent.trim()).slice(0, 5);
  });
  console.log('入口按钮:', JSON.stringify(r0));
  /* 点 FAB → 菜单 → AI 加节点 */
  const opened = await p.evaluate(() => {
    const fab = document.querySelector('.nm-fab');
    if (fab) fab.click();
    return !!fab;
  });
  await sleep(500);
  const menuClicked = await p.evaluate(() => {
    const item = document.querySelector('.nm-menu-item[data-a="ai"]');
    if (item) { item.click(); return true; }
    return false;
  });
  await sleep(600);
  const r1 = await p.evaluate(() => ({
    modal: !!document.getElementById('aiNodeInput'),
    placeholder: document.getElementById('aiNodeInput') ? document.getElementById('aiNodeInput').placeholder : ''
  }));
  ok('一句话输入弹层打开', opened && menuClicked && r1.modal, r1.placeholder);
  /* 输入一句话 → 点搜索（go） */
  await p.evaluate(() => {
    const inp = document.getElementById('aiNodeInput');
    inp.value = '我想加成都武侯祠，三国文化';
    const go = document.getElementById('aiNodeGo');
    if (go) go.click();
  });
  await sleep(1500);
  const r2 = await p.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('tn_userNodes') || '[]');
    const n = arr.find(x => x.name === '武侯祠');
    return {
      saved: !!n,
      province: n ? n.province : '',
      city: n ? n.city : '',
      category: n ? n.category : '',
      coord: n ? (n.lat != null) : false,
      modalClosed: !document.getElementById('aiNodeInput'),
      tip: (document.querySelector('[class*="tip"], [class*="toast"]') || { textContent: '' }).textContent.slice(0, 30)
    };
  });
  ok('一句话解析并保存（武侯祠/四川/成都）', r2.saved && r2.province === '四川' && (r2.city === '成都' || r2.city === '成都市'), JSON.stringify(r2).slice(0, 120));
  ok('坐标本地匹配', r2.coord, 'coord=' + r2.coord);
  ok('弹层关闭 + 提示', r2.modalClosed, r2.tip);
  /* 重复添加 → 提示已有 */
  await p.evaluate(() => {
    const fab = document.querySelector('.nm-fab');
    if (fab) fab.click();
  });
  await sleep(500);
  await p.evaluate(() => {
    const item = document.querySelector('.nm-menu-item[data-a="ai"]');
    if (item) item.click();
  });
  await sleep(500);
  await p.evaluate(() => {
    const inp = document.getElementById('aiNodeInput');
    inp.value = '我要加武侯祠';
    const go = document.getElementById('aiNodeGo');
    if (go) go.click();
  });
  await sleep(1200);
  const r3 = await p.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('tn_userNodes') || '[]');
    return { count: arr.filter(x => x.name === '武侯祠').length };
  });
  ok('重复添加不产生第二条', r3.count === 1, 'count=' + r3.count);
  /* 无坐标场景：本地无此景点 */
  await p.evaluate(() => {
    const inp = document.getElementById('aiNodeInput');
    if (inp) inp.value = '我想加一个沧州铁狮子';
    const go = document.getElementById('aiNodeGo');
    if (go) go.click();
  });
  await sleep(1500);
  const r4 = await p.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('tn_userNodes') || '[]');
    const n = arr.find(x => x.name.includes('铁狮子'));
    return n ? { saved: true, coord: n.lat != null, name: n.name } : { saved: false };
  });
  ok('无坐标景点仍可添加（提示补位）', r4.saved === true, JSON.stringify(r4));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));
  await browser.close();
  console.log(fails ? '=== ONELINE FAIL ===' : '=== ONELINE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
