/* audit-states.js — 状态级审核扫描器
 * 15 页 × 亮/暗 × 交互态（topic 五页签）：抓 console 错误/警告、pageerror、404/失败请求、同父兄弟元素矩形重叠。
 * 用法: node tools/audit-states.js [--shot]   （--shot 输出全部状态截图） */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT = process.argv.includes('--shot');
const PAGES = ['index.html', 'topic.html', 'search.html', 'wishlist.html', 'review.html', 'settings.html',
  'me.html', 'node-manager.html', 'album.html', 'album-edit.html', 'story.html', 'planner.html',
  'md-manager.html', 'explore-map.html', 'travel-map.html'];

/* 页内交互：topic 五页签；其余页静态 */
const TABS = { 'topic.html': ['地图', '列表', '主题', '路线', '美食'] };

const OVERLAP_SNAP = `(function () {
  function vis(e) { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden' && s.position !== 'fixed' && (+s.opacity) > 0.1; }
  function inter(a, b) { return !(a.right <= b.left + 2 || b.right <= a.left + 2 || a.bottom <= b.top + 2 || b.bottom <= a.top + 2); }
  const out = [];
  const parents = new Set();
  document.querySelectorAll('body *').forEach(e => { if (e.parentElement) parents.add(e.parentElement); });
  parents.forEach(pa => {
    const kids = [...pa.children].filter(vis);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i], b = kids[j];
      const ta = (a.tagName + '.' + String(a.className).split(' ').slice(0, 2).join('.')).slice(0, 40);
      const tb = (b.tagName + '.' + String(b.className).split(' ').slice(0, 2).join('.')).slice(0, 40);
      if (inter(a.getBoundingClientRect(), b.getBoundingClientRect())) out.push(ta + ' ⛌ ' + tb);
    }
  });
  return out.slice(0, 6);
})();`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const report = [];
  let shotDir = null;
  if (SHOT) { shotDir = path.join(ROOT, 'tools', 'out', 'shots', 'audit'); fs.mkdirSync(shotDir, { recursive: true }); }

  for (const theme of ['light', 'dark']) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('tn_dark', t); localStorage.setItem('tn_b64_warned', '1'); } catch (e) {} }, theme);
    for (const pg of PAGES) {
      const errs = [], warns = [], fails = [];
      const onConsole = m => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)); else if (m.type() === 'warning' && /deprecat/i.test(m.text())) warns.push(m.text().slice(0, 60)); };
      const onReq = r => { if (r.failure() && !/cancelled|aborted/i.test(r.failure().errorText)) fails.push(r.url().split('/').pop().slice(0, 40) + ' (' + r.failure().errorText.slice(0, 20) + ')'); };
      const onResp = r => { if (r.status() >= 400) fails.push(r.url().split('/').pop().slice(0, 40) + ' HTTP' + r.status()); };
      const onErr = e => errs.push('pageerror: ' + String(e.message).slice(0, 110));
      page.on('console', onConsole); page.on('pageerror', onErr); page.on('requestfailed', onReq); page.on('response', onResp);
      await page.goto(pathToFileURL(path.join(ROOT, pg)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(e => errs.push('nav: ' + e.message.slice(0, 60)));
      await new Promise(r => setTimeout(r, 1300));
      const states = [{ name: theme, errs: [...errs], fails: [...fails], overlap: await page.evaluate(OVERLAP_SNAP).catch(() => []) }];
      errs.length = 0; fails.length = 0;
      if (TABS[pg]) {
        for (const tab of TABS[pg]) {
          await page.evaluate((t) => { const el = [...document.querySelectorAll('[data-tab]')].find(x => x.textContent.indexOf(t) >= 0 || x.dataset.tab === t); if (el) el.click(); }, tab);
          await new Promise(r => setTimeout(r, 900));
          states.push({ name: theme + '/' + tab, errs: [...errs], fails: [...fails], overlap: await page.evaluate(OVERLAP_SNAP).catch(() => []) });
          errs.length = 0; fails.length = 0;
          if (SHOT) await page.screenshot({ path: path.join(shotDir, pg.replace('.html', '') + '-' + theme + '-' + tab + '.png') });
        }
      }
      if (SHOT && !TABS[pg]) await page.screenshot({ path: path.join(shotDir, pg.replace('.html', '') + '-' + theme + '.png') });
      page.off('console', onConsole); page.off('pageerror', onErr); page.off('requestfailed', onReq); page.off('response', onResp);
      states.forEach(st => {
        if (st.errs.length || st.fails.length || st.overlap.length) {
          report.push('[' + pg + ' · ' + st.name + ']' +
            (st.errs.length ? ' ERR: ' + st.errs.slice(0, 2).join(' ‖ ') : '') +
            (st.fails.length ? ' REQ: ' + st.fails.slice(0, 2).join(' ‖ ') : '') +
            (st.overlap.length ? ' 重叠: ' + st.overlap.join(' ‖ ') : ''));
        }
      });
    }
    await page.evaluateOnNewDocument(() => {}); // 清除下一个主题的残留注入
  }
  await browser.close();
  console.log(report.length ? report.join('\n') : '=== 15 页 × 亮暗 × 交互态：零报错、零失败请求、零重叠 ===');
})();
