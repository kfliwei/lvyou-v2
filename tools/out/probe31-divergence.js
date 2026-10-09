/* tools/out/probe31-divergence.js — 批次 31 的改前/改后实测：同一天写五种历史形状，屏上那一行日期有几种写法。
   用法: node tools/out/probe31-divergence.js            （默认 328×723 真机档）
   种子走产品自己的 TravelNotes.replaceNotes（不手抄存储键、不直接写 IDB）。
   五种形状都是 §41 注释里点过的历史形状：2026-10-8／2026.10.08／2026年10月8日／只有 ts／date 坏且 ts 也坏。
   落点：review.html 的 #dayBox .eyebrow（归一键）与 .md-item .meta（屏上那行），me.html .rec .d，
         以及 review.html「今日重现」#todayBox（需一条往年今日的种子才会出现）。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const wait = ms => new Promise(r => setTimeout(r, ms));
const DAY = new Date(2026, 9, 8, 9, 30).getTime();
const _t = new Date();
const TMD = String(_t.getMonth() + 1).padStart(2, '0') + '-' + String(_t.getDate()).padStart(2, '0');

/* 归一：与 noteDay 同形状（任意非数字分隔符的年月日 → 补零 YYYY-MM-DD），只在 Node 侧造种子用 */
function normDay(s) {
  const m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  return m ? m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0') : '';
}
var _uid = 0;
function mk(p) {
  if (!p.day) p.day = normDay(p.date);
  /* 取样纪律：缺 ts 要真的缺。写 ts:0 会被 !p.ts 这一支重新填成 DAY（0 是假值），
     于是「只有坏 date、没有可用 ts」那一格在地基证据里从来没被测过——而它正是本批
     三条真缺陷（时间线空胶囊 / 跨 NaN 天）的成因形状。要造这一格就别给 ts。 */
  if (!('ts' in p)) p.ts = DAY;
  p.id = 'p31x' + (++_uid);
  return p;
}
const SEED = [
  mk({ title: 'P31形状A点号缺', site: '测试点A', city: '测试市', date: '2026-10-8', text: '探针正文A', lat: 30.1, lng: 120.1 }),
  mk({ title: 'P31形状B点号齐', site: '测试点B', city: '测试市', date: '2026.10.08', text: '探针正文B', lat: 30.2, lng: 120.2 }),
  mk({ title: 'P31形状C中文', site: '测试点C', city: '测试市', date: '2026年10月8日', text: '探针正文C', lat: 30.3, lng: 120.3 }),
  mk({ title: 'P31形状D只有ts', site: '测试点D', city: '测试市', date: '', text: '探针正文D', lat: 30.4, lng: 120.4 }),
  mk({ title: 'P31形状E日期全坏', site: '测试点E', city: '测试市', date: '十月八号', text: '探针正文E', lat: 30.5, lng: 120.5 }),
  /* 往年今日：喂 review.html 的「今日重现」那一支，月日=跑探针当天、年份必须不同 */
  mk({ title: 'P31形状F往年今日', site: '测试点F', city: '测试市', date: (_t.getFullYear() - 2) + '.' + TMD.replace('-', '.'), ts: new Date(_t.getFullYear() - 2, +TMD.slice(0, 2) - 1, +TMD.slice(3), 9, 0).getTime(), text: '探针正文F', lat: 30.6, lng: 120.6 })
];

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  /* 播种：index.html 上 TravelNotes 已就绪，整批替换 */
  await p.goto(url('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof window.TravelNotes === 'object' && typeof window.TravelNotes.replaceNotes === 'function', { timeout: 15000, polling: 150 }).catch(() => {});
  const seeded = await p.evaluate(notes => {
    window.TravelNotes.replaceNotes(notes);
    return window.TravelNotes.list().length;
  }, SEED);
  await wait(1200);

  const lines = [];
  lines.push('=== 播种 ' + seeded + ' 条（同一天 2026-10-08 的五种源形状 + 一条往年今日） ===');
  lines.push('归一键(noteDay 同形)=' + JSON.stringify(SEED.map(n => normDay(n.date) || ('ts→' + new Date(n.ts).toISOString().slice(0, 10)))));

  /* review.html 日历：点有记录的 2026-10-08，读 eyebrow（归一键）与每行 .meta（屏上那行） */
  await p.goto(url('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(2600);
  const cal = await p.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('#calGrid .cal-cell.has')).map(c => c.dataset.d));
  await p.evaluate(() => {
    var cell = document.querySelector('#calGrid .cal-cell.has[data-d="2026-10-08"]') || document.querySelector('#calGrid .cal-cell.has');
    if (cell) cell.click();
  });
  await wait(700);
  const rv = await p.evaluate(() => {
    var box = document.getElementById('dayBox');
    var pick = sel => Array.prototype.slice.call(document.querySelectorAll(sel)).map(e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60));
    return {
      calKeys: Array.prototype.slice.call(document.querySelectorAll('#calGrid .cal-cell.has')).map(c => c.dataset.d),
      eyebrow: (box.querySelector('.eyebrow') || {}).textContent || '',
      metas: pick('#dayBox .md-item .meta'),
      todayMetas: pick('#todayBox .md-item .meta'),
      todayEyebrow: (document.querySelector('#todayBox .eyebrow') || {}).textContent || ''
    };
  });
  lines.push('--- review.html 日历键与点开那天的 eyebrow ---');
  lines.push('  日历 has 键=' + JSON.stringify(cal) + ' 点开那天的 eyebrow=' + JSON.stringify(rv.eyebrow));
  lines.push('--- review.html #dayBox .md-item .meta（屏上那行日期）---');
  (rv.metas.length ? rv.metas : ['(没读到)']).forEach(t => lines.push('  ' + JSON.stringify(t)));
  lines.push('--- review.html #todayBox（往年今日那一支）---');
  lines.push('  eyebrow=' + JSON.stringify(rv.todayEyebrow));
  (rv.todayMetas.length ? rv.todayMetas : ['(没读到)']).forEach(t => lines.push('  ' + JSON.stringify(t)));

  /* me.html「最近随手记」那一行的 .d */
  await p.goto(url('me.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(2200);
  const me = await p.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('.rec .d')).map(e => (e.textContent || '').trim().slice(0, 44)));
  lines.push('--- me.html .rec .d ---');
  (me.length ? me : ['(没读到 .rec .d)']).forEach(t => lines.push('  ' + JSON.stringify(t)));

  /* 单点函数的返回值（改前应报「没有这个出口」，改后应五个源形状出同一个屏上串） */
  const fn = await p.evaluate(ns => {
    var T = window.TravelNotes || {};
    var out = { dayText: typeof T.dayText, nowDayText: typeof T.nowDayText };
    if (out.dayText === 'function') out.r = ns.map(n => T.dayText(n));
    if (out.nowDayText === 'function') out.now = T.nowDayText();
    return out;
  }, SEED);
  lines.push('--- TravelNotes.dayText / nowDayText ---');
  lines.push('  dayText=' + fn.dayText + ' nowDayText=' + fn.nowDayText);
  if (fn.r) lines.push('  逐形状读数=' + JSON.stringify(fn.r));
  if (fn.now) lines.push('  nowDayText()=' + JSON.stringify(fn.now));

  lines.push('--- 页面报错 ---');
  lines.push('  ' + (errs.length ? errs.join(' | ').slice(0, 400) : '无'));
  const txt = lines.join('\n');
  /* 落盘名要显式给：PROBE_OUT 缺省时写 b31-divergence.txt——第一次复跑就是这么把改前的地基读数原地覆盖掉的
     （改前那份只剩 README 与审核文档里抄着的五条串）。复跑一律带 PROBE_OUT=...。 */
  const OUT = process.env.PROBE_OUT || 'b31-divergence.txt';
  require('fs').writeFileSync(path.join(ROOT, 'tools', 'out', OUT), txt);
  console.log('written -> tools/out/' + OUT);
  await b.close();
})();
