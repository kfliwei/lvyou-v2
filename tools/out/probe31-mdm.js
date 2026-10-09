/* tools/out/probe31-mdm.js — 批次 31：给 md-manager.html 补引 travel-notes.js 的副作用实测 + A 桶接线后的读数。
   问题：md-manager.html 是全项目唯一「显示游记日期却没引 travel-notes.js」的页面。接线前必须先坐实
        「多载一个 167KB 的库会不会往这页注入可见 UI / 抛错」。
   判据：1) pageerror/console error 归零；2) 本页 body 直接子节点里不出现 travel-notes.js 的面板/遮罩（TN 的 UI 全在调用时造）；
        3) 五种历史日期形状在卡片/详情/月份分组三处都读成同一个 YYYY-MM-DD。
   种子走产品自己的 TravelNotes.replaceNotes（这页现在也引了它）。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const wait = ms => new Promise(r => setTimeout(r, ms));
const DAY = new Date(2026, 9, 8, 9, 30).getTime();

function normDay(s) {
  const m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  return m ? m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0') : '';
}
var _uid = 0;
function mk(p) {
  if (!p.day) p.day = normDay(p.date);
  if (!p.ts) p.ts = DAY;
  p.id = 'p31m' + (++_uid);
  return p;
}
const SEED = [
  mk({ title: 'P31M形状A点号缺', siteName: '测试点A', city: '测试市', date: '2026-10-8', text: '正文A' }),
  mk({ title: 'P31M形状B点号齐', siteName: '测试点B', city: '测试市', date: '2026.10.08', text: '正文B' }),
  mk({ title: 'P31M形状C中文', siteName: '测试点C', city: '测试市', date: '2026年10月8日', text: '正文C' }),
  mk({ title: 'P31M形状D只有ts', siteName: '测试点D', city: '测试市', date: '', text: '正文D' }),
  mk({ title: 'P31M形状E日期全坏', siteName: '测试点E', city: '测试市', date: '十月八号', ts: 0, text: '正文E' })
];

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  const lines = [];

  /* 1) 先在任何页面播好种子（用产品自己的入口） */
  await p.goto(url('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.TravelNotes && window.TravelNotes.replaceNotes, { timeout: 15000, polling: 150 }).catch(() => {});
  const seeded = await p.evaluate(notes => { window.TravelNotes.replaceNotes(notes); return window.TravelNotes.list().length; }, SEED);
  await wait(1200);
  lines.push('=== 播种 ' + seeded + ' 条（同一天 2026-10-08 的五种源形状） ===');
  lines.push('归一键=' + JSON.stringify(SEED.map(n => n.day || 'UNDATED')));

  /* 2) 打开 md-manager.html：TN 的 dayText 应可用且不抛错 */
  await p.goto(url('md-manager.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(2600);

  const boot = await p.evaluate(() => {
    var tn = window.TravelNotes;
    return {
      hasTravelNotes: !!tn,
      dayTextType: tn ? typeof tn.dayText : 'n/a',
      bodyKids: document.body.children.length,
      bodyKidIds: Array.prototype.slice.call(document.body.children).map(e => e.id || e.className || e.tagName).slice(0, 24),
      fixedEls: Array.prototype.slice.call(document.querySelectorAll('body *')).filter(e => {
        var cs = getComputedStyle(e);
        return (cs.position === 'fixed' || cs.position === 'absolute') && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && e.getBoundingClientRect().height > 0;
      }).map(e => (e.id || e.className || e.tagName) + '@' + Math.round(e.getBoundingClientRect().height)).slice(0, 20)
    };
  });
  lines.push('--- 载入后：TravelNotes=' + boot.hasTravelNotes + ' dayText=' + boot.dayTextType + ' | body 直接子节点=' + boot.bodyKids + ' ---');
  lines.push('  body 子节点=' + JSON.stringify(boot.bodyKidIds));
  lines.push('  可见 fixed/absolute=' + JSON.stringify(boot.fixedEls));

  /* 3) 卡片列表：月份分组头 + 每张卡的 .meta 第一个 span（屏上那行日期） */
  const list = await p.evaluate(() => ({
    months: Array.prototype.slice.call(document.querySelectorAll('#listBody .month')).map(e => (e.textContent || '').trim().replace(/\s+/g, ' ')),
    items: Array.prototype.slice.call(document.querySelectorAll('#listBody .md-item')).map(it => ({
      title: (it.querySelector('h3') || {}).textContent || '',
      date: ((it.querySelectorAll('.meta span')[0] || {}).textContent || '').trim()
    }))
  }));
  lines.push('--- 卡片列表 ---');
  lines.push('  月份分组头=' + JSON.stringify(list.months));
  list.items.forEach(it => lines.push('  ' + JSON.stringify(it.title) + ' → ' + JSON.stringify(it.date)));
  lines.push('  期望: A/B/C/D 都读 2026-10-08（D 走 ts 反推），E 读空串（日期与 ts 全坏）；分组头只有一个 2026 年 10 月');

  /* 4) 详情：.art-meta + fm-card 的「日期」行 + 源码视图的 frontmatter date: */
  const titles = list.items.map(it => it.title);
  const detail = [];
  for (const t of titles) {
    await p.evaluate(tt => {
      var it = Array.prototype.slice.call(document.querySelectorAll('#listBody .md-item')).filter(x => ((x.querySelector('h3') || {}).textContent || '') === tt)[0];
      if (it) it.click();
    }, t);
    await wait(500);
    var d = await p.evaluate(() => {
      var rows = Array.prototype.slice.call(document.querySelectorAll('#artBox .fm-card dt')).map((dt, i) => dt.textContent.trim() + '=' + (document.querySelectorAll('#artBox .fm-card dd')[i] || {}).textContent);
      return {
        artMeta: ((document.querySelector('#artBox .art-meta') || {}).textContent || '').trim().replace(/\s+/g, ' '),
        dateRow: (rows.filter(r => r.indexOf('日期=') === 0)[0] || '(无日期行)'),
        coordRow: (rows.filter(r => r.indexOf('坐标=') === 0)[0] || '(无坐标行)')
      };
    });
    /* 源码视图里的 frontmatter date: 行 */
    await p.evaluate(() => { if (window.toggleSrc) window.toggleSrc(); });
    await wait(350);
    d.srcDate = await p.evaluate(() => {
      var pre = document.querySelector('#artBox .src-box pre');
      if (!pre) return '(没有源码视图)';
      var m = /^date:\s*(.*)$/m.exec(pre.textContent || '');
      return m ? m[1] : '(frontmatter 无 date 行)';
    });
    await p.evaluate(() => { if (window.toggleSrc) window.toggleSrc(); });
    await wait(250);
    await p.evaluate(() => { if (window.goList) window.goList(); });
    await wait(400);
    d.title = t;
    detail.push(d);
  }
  lines.push('--- 详情（卡片顺序同上）---');
  detail.forEach(d => lines.push('  ' + JSON.stringify(d.title) + ' art-meta=' + JSON.stringify(d.artMeta) + ' | ' + d.dateRow + ' | ' + d.coordRow + ' | fm date=' + JSON.stringify(d.srcDate)));

  /* 5) 复制/导出那条文案（copyNoteText 走 dayText）+ Vault.mdFor 的 date 行 */
  const api = await p.evaluate(ns => {
    var out = { dayText: [], mdForDate: [] };
    ns.forEach(n => {
      out.dayText.push(window.TravelNotes && window.TravelNotes.dayText ? window.TravelNotes.dayText(n) : 'n/a');
      var md = window.Vault && window.Vault.mdFor ? window.Vault.mdFor(n) : '';
      var m = /^date:\s*(.*)$/m.exec(md);
      out.mdForDate.push(m ? m[1] : '(无)');
    });
    return out;
  }, SEED);
  lines.push('--- TravelNotes.dayText(种子)=' + JSON.stringify(api.dayText));
  lines.push('--- Vault.mdFor 的 frontmatter date=' + JSON.stringify(api.mdForDate));

  lines.push('--- 页面报错 ---');
  lines.push('  ' + (errs.length ? errs.join(' | ').slice(0, 600) : '无'));

  const txt = lines.join('\n');
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b31-mdm.txt'), txt);
  console.log('written');
  await b.close();
})();
