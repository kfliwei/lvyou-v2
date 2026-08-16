/* tools/smoke-planner.js — 行程规划页真实浏览器冒烟测试（puppeteer-core + 本机 Chrome）
 * 覆盖：页面无 JS 报错、AI 开关渲染、目的地 chips、一句话生成→候选→排期→结果全链路
 * 用法: node tools/smoke-planner.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto('file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  ok('页面加载', true);
  ok('AI 开关渲染', !!(await page.$('#aiSwitch')));
  ok('目的地 chips 渲染', !!(await page.$('#destChips .chip')));

  // 一句话生成
  await page.type('#promptInput', '我想去川西玩5天，喜欢自然风光');
  await page.click('#genBtn');
  await sleep(1200);
  ok('进入选点阶段', await page.evaluate(() => document.getElementById('stagePick').style.display === 'block'));
  const candN = await page.$$eval('#candList .cand', els => els.length);
  ok('候选列表非空', candN > 0, '候选 ' + candN + ' 处');
  ok('意图卡显示目的地', await page.evaluate(() => (document.getElementById('intentRegions').textContent || '').length > 0));

  // 候选内筛选
  await page.type('#candFilter', 'zzzz');
  await sleep(300);
  const filteredN = await page.$$eval('#candList .cand', els => els.length);
  ok('候选筛选生效', filteredN === 0, '筛选后 ' + filteredN + ' / ' + candN);
  await page.evaluate(() => { const f = document.getElementById('candFilter'); f.value = ''; f.dispatchEvent(new Event('input')); });
  await sleep(300);

  // 选 3 个候选（每次重新查询 DOM，避免重渲染后句柄失效）
  for (let i = 0; i < 3; i++) {
    await page.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await sleep(400);
  const summ = await page.$eval('#summbar', el => el.style.display).catch(() => 'none');
  ok('汇总条出现', summ === 'flex');

  // 排期
  await page.click('#scheduleBtn');
  await sleep(1600);
  ok('进入结果阶段', await page.evaluate(() => document.getElementById('stageResult').style.display === 'block'));
  const dayN = await page.$$eval('#resultBody .day-card', els => els.length);
  ok('每日安排生成', dayN >= 1, dayN + ' 天');
  ok('落地动作条', !!(await page.$('#actRow .btn')));

  // 移除一站
  const beforeStop = await page.$$eval('#resultBody .stop', els => els.length);
  await page.evaluate(() => { const b = document.querySelector('#resultBody .mv[aria-label="移除"]'); if (b) b.click(); });
  await sleep(500);
  const afterStop = await page.$$eval('#resultBody .stop', els => els.length);
  ok('移除站点生效', afterStop < beforeStop, beforeStop + ' -> ' + afterStop);

  // 上下移 + 重新排期
  await page.evaluate(() => { const b = document.querySelector('#resultBody .mv[aria-label="上移"]'); if (b) b.click(); });
  await sleep(400);
  await page.evaluate(() => { window.plannerReschedule(); });
  await sleep(800);
  ok('重新排期无报错', await page.$$eval('#resultBody .day-card', els => els.length >= 1));

  // 季节校验懒加载（四川 → sc-data.js）不报错
  await sleep(2500);
  const hasBest = await page.evaluate(() => /最佳|月|封路|全年/.test(document.getElementById('resultBody').innerText));
  ok('季节字段回填', hasBest);

  const real = errors.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile/.test(e));
  ok('无 JS 报错', real.length === 0, real.slice(0, 3).join(' | '));

  await browser.close();
  console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
