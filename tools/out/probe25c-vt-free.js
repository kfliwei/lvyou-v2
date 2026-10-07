/* 探针（批次 25-C 附带）：链跑时 smoke-trip T37 红的那条 InvalidStateError 到底从哪来。
 * 假设：trip.html?trip=free 在载入时自己 location.replace 到 expense.html，
 *      而 design.css 开着 @view-transition{navigation:auto}＝每次跨文档导航都带转场；
 *      转场还没跑完就被下一次导航打断，浏览器抛 InvalidStateError。这是浏览器内部的转场，
 *      UI.vt 那三条 catch 管不到它。争用让转场更容易跑到一半被打断，所以只在链跑时冒。
 * A/B：同一个 free 入口，A 腿用真 trip.html（会重定向），B 腿用把重定向那一行换成空块的副本
 *      （空块不是删掉整句——删了会把后面的 else if 劈成语法错误，那就不叫 A/B 了）。
 *      两腿都量：VT 报错计数 + 最终落点（重定向到底还成不成立，那才是用户看得见的那半）。
 * 噪声口径与 smoke-trip 同一把筛子（NOISE），否则「非 VT 报错」会把瓦片失败算成真报错。
 * 用法: NODE_PATH=tools/node_modules node tools/out/probe25c-vt-free.js [轮数] [争用页个数]
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOISE = /Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile|Failed to fetch|favicon/;
const VT = /Transition was aborted|ViewTransition/;

const N = parseInt(process.argv[2] || '10', 10);
const LOAD = parseInt(process.argv[3] || '0', 10);

/* B 腿的副本：只把重定向那次调用换成空块，其它一字节不动（放 ROOT，本脚本跑完自己删） */
const VAR = '_probe25c_trip_noredir.html';
function makeVariant() {
  const src = fs.readFileSync(path.join(ROOT, 'trip.html'), 'utf8');
  const line = "if (q === Expense.FREE_ID) { location.replace('expense.html?trip=' + Expense.FREE_ID); }";
  if (src.indexOf(line) < 0) throw new Error('锚点行没找到，副本口径失效：' + line);
  fs.writeFileSync(path.join(ROOT, VAR),
    src.replace(line, 'if (q === Expense.FREE_ID) { /* 探针：重定向已拆掉 */ }'), 'utf8');
}
function rmVariant() { try { fs.unlinkSync(path.join(ROOT, VAR)); } catch (e) {} }

async function leg(browser, target, label, rec) {
  const p = await browser.newPage();
  const got = [];
  p.on('pageerror', e => got.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') got.push('console: ' + m.text().slice(0, 160)); });
  await p.setViewport({ width: 328, height: 723, isMobile: true, hasTouch: true });
  /* 先播种再进 free 入口：与 smoke-trip 的 T09 同一前置。
     形状必须照 smoke-trip 的 SEED（startDate + days:[{stops:[…]}]），
     上一版探针图省事写了 {start, days:3, stops:[]}，落点页 expense.js 读的是真形状，
     于是量出来一堆 ((t&&t.days)||[]).forEach is not a function＝探针自己的坑，不是产品缺陷。 */
  await p.goto(U('trip.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([{
      id: 't-live', name: '探针趟', createdAt: 1700000000000, startDate: '2026-10-06', logStart: '2026-10-06', realDays: 2,
      travelBy: 'drive', dist: 100,
      days: [{ stops: [{ name: '甲', city: '', done: 0 }], driveKm: 10, driveH: 0.2, playH: 2, totalH: 3 }]
    }]));
  });
  await p.goto(U(target), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(500);
  const url = p.url();
  await p.close();
  rec.push({
    label, url,
    vt: got.filter(x => VT.test(x)).length,
    real: got.filter(x => !VT.test(x) && !NOISE.test(x)).length,
    vtSample: got.filter(x => VT.test(x))[0] || '',
    realSample: got.filter(x => !VT.test(x) && !NOISE.test(x))[0] || ''
  });
}

function tally(rec, name) {
  const vt = rec.reduce((s, r) => s + r.vt, 0);
  const real = rec.reduce((s, r) => s + r.real, 0);
  const landed = rec.filter(r => /expense\.html\?trip=free/.test(r.url)).length;
  console.log(name + ': VT 报错 ' + vt + ' 次 / ' + rec.length + ' 轮；非 VT 真实报错 ' + real +
    '；落到 expense.html?trip=free ' + landed + ' 轮');
  const s = rec.filter(r => r.vt)[0] || rec.filter(r => r.real)[0];
  if (s) console.log('   样本: ' + (s.vtSample || s.realSample));
  return vt;
}

(async () => {
  makeVariant();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  /* 争用腿：几页反复重开重页，模拟链跑时同机的 CPU 压力 */
  for (let i = 0; i < LOAD; i++) {
    const q = await browser.newPage();
    q.on('pageerror', () => {});
    (async () => {
      for (let k = 0; k < 60; k++) {
        try { await q.goto(U(i % 2 ? 'topic.html' : 'planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch (e) {}
        await sleep(30);
      }
    })().catch(() => {});
  }
  const A = [], B = [];
  for (let i = 0; i < N; i++) await leg(browser, 'trip.html?trip=free', 'A', A);
  for (let i = 0; i < N; i++) await leg(browser, VAR + '?trip=free', 'B', B);
  console.log('轮数 ' + N + '，争用页 ' + LOAD);
  const a = tally(A, 'A 腿（真页，free 入口会重定向）');
  const b = tally(B, 'B 腿（副本，同一 free 入口但不重定向）');
  console.log('判读: ' + (a > 0 && b === 0 ? 'VT 报错跟着重定向走 ⇒ 假设成立（载入即跳转打断自己的转场）'
    : a > 0 && b > 0 ? '两腿都出 ⇒ 与重定向无关，是转场本身在争用下被中断'
      : '本轮没复现 ⇒ 需要更高的争用或换路径再试'));
  await browser.close();
  rmVariant();
  console.log('副本已删除: ' + !fs.existsSync(path.join(ROOT, VAR)));
})().catch(e => { rmVariant(); console.error('探针异常: ' + e.message); process.exit(2); });
