/* tools/smoke-album-edit-obscure.js — 验证：文字输入框不被底部固定栏遮挡
 * 场景1：新增章节后（用户截图场景）新章节输入框应完整露出
 * 场景2：聚焦输入框时滚动校正
 * 场景3：长文本+滚动到底后聚焦校正
 * 用法: node tools/smoke-album-edit-obscure.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'file:///' + path.join(ROOT, 'album-edit.html').replace(/\\/g, '/');

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
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const hasText = await page.evaluate(() => !!document.querySelector('.ech-text'));
  ok('edit: 文字编辑框存在', hasText);
  if (!hasText) { await browser.close(); process.exit(1); }

  /* 场景1（用户截图）：点「添加文字」新增空章节 → 新输入框不被底栏遮挡 */
  await page.evaluate(() => { const b = document.getElementById('addText'); if (b) b.click(); });
  await sleep(900);   // 等 render + scrollLastChapterIntoView(80ms) + smooth 滚动
  await sleep(500);
  const s1 = await page.evaluate(() => {
    const cards = document.querySelectorAll('.ed-chapter');
    const last = cards[cards.length - 1];
    const el = last.querySelector('.ech-text');
    const bar = document.querySelector('.add-bar');
    const wrap = document.querySelector('.ed-wrap');
    const r = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), barTop: Math.round(b.top), wrapBottom: Math.round(wrap.getBoundingClientRect().bottom), scrollTop: Math.round(wrap.scrollTop), chapters: cards.length };
  });
  ok('场景1: 新增章节输入框下沿 <= 底栏顶部(不被遮挡)', s1.bottom <= s1.barTop + 1, JSON.stringify(s1));

  /* 场景2：聚焦输入框（模拟点按）→ 校正滚动 */
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.ed-chapter');
    const last = cards[cards.length - 1];
    const el = last.querySelector('.ech-text');
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    el.focus();
  });
  await sleep(800);
  const s2 = await page.evaluate(() => {
    const cards = document.querySelectorAll('.ed-chapter');
    const last = cards[cards.length - 1];
    const el = last.querySelector('.ech-text');
    const bar = document.querySelector('.add-bar');
    const r = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), barTop: Math.round(b.top) };
  });
  ok('场景2: 聚焦后输入框下沿不重叠底栏', s2.bottom <= s2.barTop + 1, JSON.stringify(s2));

  /* 场景3：长文本撑高 + 滚到底 + 聚焦 → 自动校正 */
  const s3 = await page.evaluate(() => {
    const cards = document.querySelectorAll('.ed-chapter');
    const last = cards[cards.length - 1];
    const el = last.querySelector('.ech-text');
    el.textContent = '测试文字\n'.repeat(30);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const wrap = document.querySelector('.ed-wrap');
    wrap.scrollTop = wrap.scrollHeight;
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    el.focus();
    return true;
  });
  await sleep(1000);
  const s3r = await page.evaluate(() => {
    const el = document.querySelectorAll('.ed-chapter')[document.querySelectorAll('.ed-chapter').length - 1].querySelector('.ech-text');
    const bar = document.querySelector('.add-bar');
    const r = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), barTop: Math.round(b.top) };
  });
  ok('场景3: 长文本+滚动后自动校正不遮挡', s3r.bottom <= s3r.barTop + 1, JSON.stringify(s3r));

  const real = errors.filter(e => !/Failed to load resource|net::|ERR_/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 150));
  await browser.close();
  console.log(fails === 0 ? '\nALL PASS' : '\nFAILS: ' + fails);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
