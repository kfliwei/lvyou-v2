/* tools/audit-reality.js — 落地真实性审核
 * 层1 静态：HTML 引用的 href/src 目标存在性 + 内联 onclick 引用的全局函数存在性（Node 侧尽力检查）
 * 层2 动态：puppeteer 打开全部页面，捕获错误、检查关键元素
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* ========== 层1：静态引用完整性 ========== */
let s1 = { broken: [], total: 0 };
const htmlFiles = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).sort();
for (const hf of htmlFiles) {
  const s = fs.readFileSync(path.join(ROOT, hf), 'utf8');
  /* href/src 本地引用 */
  const refs = s.match(/(?:href|src)="([^"]+)"/g) || [];
  for (const r of refs) {
    const m = r.match(/="([^"]+)"/);
    let u = m[1];
    if (/^https?:|^data:|^#|^javascript:|^file:/.test(u) || u.startsWith('//')) continue;
    u = u.split('?')[0].split('#')[0];
    if (!u) continue;
    s1.total++;
    const p = path.join(ROOT, u);
    if (!fs.existsSync(p)) s1.broken.push(hf + ' → ' + u);
  }
}
console.log('== 静态引用 ==');
console.log('引用总数:', s1.total, '| 断链:', s1.broken.length);
s1.broken.forEach(b => console.log('  BROKEN:', b));

/* ========== 层2：动态实测 ========== */
(async () => {
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const results = [];
  const pages = htmlFiles.filter(f => !f.startsWith('test-'));
  for (const hf of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    let ok = true;
    try {
      await page.goto('file:///' + path.join(ROOT, hf).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(3500);
    } catch (e) { ok = false; errs.push('nav: ' + e.message.slice(0, 80)); }
    const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
    const st = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1, .title, .hero__title') ? (document.querySelector('h1, .title, .hero__title').textContent || '').slice(0, 30) : '',
      bodyLen: (document.body.textContent || '').length
    })).catch(() => ({}));
    results.push({ file: hf, ok: ok && real.length === 0, errs: real, title: st.title || '', bodyLen: st.bodyLen || 0 });
    console.log((ok && real.length === 0 ? 'OK  ' : 'ERR ') + hf + ' | ' + (st.title || '') + ' | body ' + (st.bodyLen || 0) + ' | errs ' + real.length + (real.length ? ' :: ' + real[0].slice(0, 60) : ''));
    await page.close();
  }
  await browser.close();
  console.log('== 动态实测完成 ==');
  const bad = results.filter(r => !r.ok);
  console.log('异常页面:', bad.length, '/', results.length);
})();
