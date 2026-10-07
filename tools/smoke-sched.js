/* tools/smoke-sched.js — 批次 28「一天行程被排成两天，且看不到起始地/终到地」浏览器闸门
 *
 * 用户报（逐字，2026-10-07）：「我就在大同，在行程规划选择应县木塔和悬空寺，起始点按默认当前位置
 * 为空没填，终点填的当前位置（或是选还线），得出的都不对，本来一天的行程，规划结果的是两天，
 * 一天一个景点，而且没有起始地和终到地。」
 *
 * 四条独立成因（改前实测见 tools/out/b28-probe-sched.txt）：
 *   ① 天数框预填了一个没人说过的 5，而 splitIntoDays 把 5 当硬约束：ceil(2 站 / 5 天)＝每天 1 站
 *      → 两站排成两天。同一屏的汇总条还写着「预计 1 天」（估算读 state、排期读 DOM，两本账）。
 *   ② 出发地留空时首日 0 km，结果页又只在头部小字里露一次名字、没有「起」这一行 →「没有起始地」；
 *      标签还写着「可不填，缺省=当前位置」，而全站没有一处把定位接到出发地（零调用者的承诺）。
 *   ③ 环线＋空出发地是死控件：isLoop=true 而 end=null，末步印着「是 · 回到起点」，那 86 km 返程没排。
 *   ④ 终到地名认不出坐标时照印「0 km」，看着像"终点就在隔壁"，其实是没匹配到。
 * 所以这一节断言的是**排出来的日卡张数、落盘的 start/end 形状、屏上那几行字**，不是「按钮在不在」。
 * 名字前缀 S（schedule）。七档形状各跑一遍真实序列（一句话→选点→向导 4 步→排期）。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-sched.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;                 /* 一加 Ace 6T 真机档（批次 23-D 口径） */
const sleep = ms => new Promise(r => setTimeout(r, ms));

let checks = 0, fails = 0;
const lines = [];
function ok(name, cond, extra) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']');
  console.log(s); lines.push(s);
  if (!cond) fails++;
}

/* 两站是真数据（nation-index.js）：应县木塔 39.56/113.19、悬空寺 39.6597/113.7883，直线 52.4 km。
   没有 AI Key 时走纯规则召回，所以这条腿离线也跑得动。 */
const STOP_A = '应县木塔', STOP_B = '悬空寺';
const DATONG = [40.0917, 113.301];        /* 「大同」在 cityCoord 里的坐标：填名字与定位桩用同一个点 */

async function currentStep(page) {
  return page.evaluate(() => {
    const chips = Array.prototype.slice.call(document.querySelectorAll('#wizardBox [data-s]'));
    const on = chips.filter(c => (c.getAttribute('style') || '').indexOf('background:var(--color-primary);') >= 0)[0];
    return on ? +on.getAttribute('data-s') : -1;
  });
}
async function advanceToEnd(page) {
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => !!document.getElementById('wDone'))) return true;
    const clicked = await page.evaluate(() => { const e = document.getElementById('wNext'); if (!e) return false; e.click(); return true; });
    if (!clicked) return false;
    await sleep(320);
  }
  return false;
}
async function lastToast(page) {
  return page.evaluate(() => {
    const t = document.querySelectorAll('.ui-toast');
    return t.length ? t[t.length - 1].textContent.replace(/\s+/g, ' ') : '';
  });
}

async function runArm(browser, cfg) {
  const errs = [];
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(U('planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* file:// 同源共享 localStorage/sessionStorage：逐档清场，否则上一档的状态快照直接恢复 */
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.type('#promptInput', '我想去山西玩');
  await page.click('#genBtn');
  await sleep(1200);
  for (const name of [STOP_A, STOP_B]) {
    await page.evaluate(n => { const f = document.getElementById('candFilter'); f.value = n; f.dispatchEvent(new Event('input')); }, name);
    await sleep(340);
    const hit = await page.evaluate(n => {
      const els = Array.prototype.slice.call(document.querySelectorAll('#candList .cand'));
      const t = els.filter(e => e.textContent.indexOf(n) >= 0)[0];
      if (t) t.click();
      return !!t;
    }, name);
    if (!hit) errs.push('候选里没筛到 ' + name);
    await sleep(200);
  }
  await page.evaluate(() => { const f = document.getElementById('candFilter'); f.value = ''; f.dispatchEvent(new Event('input')); });
  await sleep(400);
  const selN = await page.evaluate(() => document.querySelectorAll('#candList .cand .ckbox.on').length);
  /* 排期前那一眼：汇总条自己写的「预计 N 天」+ 天数框此刻的值与提示语 */
  const estDays = await page.evaluate(() => {
    const m = /预计 <b>(\d+)<\/b> 天/.exec((document.getElementById('summInfo') || {}).innerHTML || '');
    return m ? +m[1] : -1;
  });
  const pre = await page.evaluate(() => {
    const el = document.getElementById('intentDays');
    /* 认准输入框自己那一栏的标签：全站还有「游玩天数」这类含「天数」的 label，按文字挑会读错对象 */
    const fld = el ? el.closest('.fld') : null;
    const lab = fld ? fld.querySelector('label') : null;
    return {
      has: !!el, value: el ? el.value : null, placeholder: el ? el.placeholder : null,
      label: lab ? lab.textContent.replace(/\s+/g, ' ') : ''
    };
  });

  await page.click('#scheduleBtn');
  await sleep(420);
  /* 定位桩只验「按钮 → locate → state.start → 落盘 → 排期」这条接线，不代表真 GPS：
     headless 下 file:// 授不到位权，不桩就没有第二条腿能证明这颗钮真接上了。 */
  if (cfg.geoStub) {
    await page.evaluate(ll => {
      navigator.geolocation.getCurrentPosition = function (cb) { cb({ coords: { latitude: ll[0], longitude: ll[1], accuracy: 30 } }); };
    }, cfg.geoStub);
  }
  const wiz1 = await page.evaluate(() => {
    const g = document.getElementById.bind(document);
    const bs = g('wStartLoc');
    const lab = Array.prototype.slice.call(document.querySelectorAll('label')).filter(x => /出发地/.test(x.textContent))[0];
    const elab = Array.prototype.slice.call(document.querySelectorAll('label')).filter(x => /终到地/.test(x.textContent))[0];
    return {
      hasStart: !!g('wStart'), hasEnd: !!g('wEnd'), hasLoc: !!bs,
      locText: bs ? bs.textContent.replace(/\s+/g, ' ') : '',
      startLabel: lab ? lab.textContent.replace(/\s+/g, ' ') : '',
      endLabel: elab ? elab.textContent.replace(/\s+/g, ' ') : ''
    };
  });
  if (cfg.start != null) await page.evaluate(v => { const e = document.getElementById('wStart'); e.value = v; e.dispatchEvent(new Event('change')); }, cfg.start);
  if (cfg.end != null) await page.evaluate(v => { const e = document.getElementById('wEnd'); e.value = v; e.dispatchEvent(new Event('change')); }, cfg.end);
  await sleep(200);
  if (cfg.locBtn) { await page.click('#wStartLoc'); await sleep(850); }
  const toastLoc = await lastToast(page);
  const startAfterLoc = await page.evaluate(() => {
    try { const s = JSON.parse(sessionStorage.getItem('tn_planner_state') || '{}'); return s.start || null; } catch (e) { return null; }
  });

  await page.click('#wNext'); await sleep(320);
  let bounce = false, toastLoop = '';
  if (cfg.loop) {
    const before = await currentStep(page);
    await page.click('#wLoopY'); await sleep(420);
    toastLoop = await lastToast(page);
    bounce = before === 2 && (await currentStep(page)) === 1;
  }
  if (!(await advanceToEnd(page))) errs.push('走不到末步（#wDone 始终没出现）');
  const confirm = await page.evaluate(() => (document.getElementById('wizardBox') || {}).innerText.replace(/\s+/g, ' ') || '');
  if (cfg.daysSet != null) {
    await page.evaluate(v => { const e = document.getElementById('intentDays'); e.value = String(v); e.dispatchEvent(new Event('change')); }, cfg.daysSet);
    await sleep(160);
  }
  const daysAtSchedule = await page.evaluate(() => { const e = document.getElementById('intentDays'); return e ? e.value : 'no-el'; });
  await page.click('#wDone');
  await sleep(1900);

  const snap = await page.evaluate(() => {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null'); } catch (e) {}
    const t = s && s.trip;
    return {
      stateDays: s ? s.days : null,
      isLoop: s ? !!s.isLoop : null,
      name: t ? t.name : null,
      start: t ? t.start : null,
      end: t ? t.end : null,
      days: t ? t.days.map(d => ({ stops: d.stops.map(x => x.name), km: Math.round(d.driveKm), h: +d.totalH.toFixed(2) })) : null
    };
  });
  const dom = await page.evaluate(() => {
    const body = document.getElementById('resultBody');
    const txt = body ? body.innerText.replace(/\s+/g, ' ') : '';
    const rows = Array.prototype.slice.call(document.querySelectorAll('#resultBody .stop .n')).map(n => ({
      tag: n.textContent.trim(),
      text: n.closest('.stop').innerText.replace(/\s+/g, ' ')
    }));
    return {
      cards: document.querySelectorAll('#resultBody .day-card').length,
      title: (document.getElementById('resultTitle') || {}).textContent || '',
      startRow: (rows.filter(r => r.tag === '起')[0] || {}).text || '',
      endRow: (rows.filter(r => r.tag === '终')[0] || {}).text || '',
      txt: txt
    };
  });
  await page.close();
  return { selN, estDays, pre, wiz1, toastLoc, startAfterLoc, bounce, toastLoop, confirm, daysAtSchedule, snap, dom, errs };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const arms = [
    ['A', { start: '', end: '' }],
    ['B1', { start: '', end: '', daysSet: 1 }],
    ['B2', { start: '', end: '', daysSet: 2 }],
    ['C', { start: '大同', end: '' }],
    ['D', { start: '', end: '', loop: true }],
    ['E', { start: '大同', end: '', loop: true }],
    ['F', { start: '', end: '当前位置' }],
    ['G', { start: '', end: '', locBtn: true, geoStub: DATONG }]
  ];
  const R = {};
  for (const [k, cfg] of arms) {
    try { R[k] = await runArm(browser, cfg); }
    catch (e) { ok('S00 档 ' + k + ' 跑完整条真实序列', false, '探针自己挂了：' + e.message); R[k] = null; }
  }
  const a = R.A || {}, b1 = R.B1 || {}, b2 = R.B2 || {}, c = R.C || {}, d = R.D || {}, e = R.E || {}, f = R.F || {}, g = R.G || {};

  ok('S01 两站确实选中了（后续所有断言的分母）', a.selN === 2, 'selN=' + a.selN);
  ok('S02 天数框排期前是空的：没人说过的默认值不再替用户做主', a.pre.value === '', 'value=' + JSON.stringify(a.pre.value) + ' placeholder=' + JSON.stringify(a.pre.placeholder));
  ok('S03 天数框的提示语把留空的后果讲在标签里', /留空＝按里程与时长自动分日/.test(a.pre.label), a.pre.label);
  ok('S04 A 档：2 站排成 1 张日卡（改前是 2 张、每天 1 站＝用户点名的症状）', a.dom.cards === 1, 'cards=' + a.dom.cards + ' days=' + JSON.stringify(a.snap && a.snap.days));
  ok('S05 A 档：那一张卡装着两站，没有一天一个景点', !!(a.snap && a.snap.days && a.snap.days.length === 1 && a.snap.days[0].stops.length === 2), JSON.stringify(a.snap && a.snap.days));
  ok('S06 A 档：落盘 state.days 是 0（不限天数），不是那个 5', a.snap && a.snap.stateDays === 0, 'stateDays=' + (a.snap && a.snap.stateDays));
  ok('S07 A 档：排期前「预计 1 天」与排期后 1 张日卡是同一本账（改前先印 1 天再排 2 天）', a.estDays === a.dom.cards && a.estDays === 1, 'est=' + a.estDays + ' cards=' + a.dom.cards);
  ok('S08 A 档：标题的天数/站数/里程跟着日卡一起改', /1 天 · 2 站/.test(a.dom.title), a.dom.title);
  ok('S09 A 档：头部明说「未填出发地：首日里程只含站与站之间的路」', /未填出发地：首日里程只含站与站之间的路/.test(a.dom.txt), a.dom.txt.slice(0, 120));
  ok('S10 A 档：没填出发地时全页不出现「当前位置」这句话（改前标签就这么承诺）', a.dom.txt.indexOf('当前位置') < 0, a.dom.txt.slice(0, 80));
  ok('S11 A 档：头部没有孤零零的「；；」（部件表 join，缺什么说什么）', a.dom.txt.indexOf('；；') < 0, a.dom.txt.slice(0, 120));

  ok('S12 B1 档：显式 1 天仍然是 1 张（用户说出口的天数依然是硬约束）', b1.dom.cards === 1 && b1.daysAtSchedule === '1', 'cards=' + b1.dom.cards + ' input=' + b1.daysAtSchedule);
  ok('S13 B2 档：显式 2 天就排成 2 张（"留空＝自动"没有被改成"永远一天"）', b2.dom.cards === 2, 'cards=' + b2.dom.cards + ' days=' + JSON.stringify(b2.snap && b2.snap.days));

  ok('S14 C 档：出发地填「大同」后结果页有「起」这一行', /起 大同/.test(c.dom.startRow), c.dom.startRow);
  ok('S15 C 档：「起」行报真实里程而不是 0 km（大同→应县木塔 81 km）', /至首站 \d+ km/.test(c.dom.startRow) && !/0 km/.test(c.dom.startRow), c.dom.startRow);
  ok('S16 C 档：首日里程把「起点→首站」算进去了（改前留空时首日只含站间 71 km）', c.snap.days[0].km > 71, 'km=' + c.snap.days[0].km);
  ok('S17 C 档：头部同时报出出发地，两处读数是同一份 state', /出发地 大同/.test(c.dom.txt) && c.snap.start && c.snap.start.name === '大同', c.dom.txt.slice(0, 100));
  ok('S18 C 档：单程（没填终到地）就不该冒出一行「终」', c.dom.endRow === '' && c.snap.end == null, 'endRow=' + JSON.stringify(c.dom.endRow) + ' end=' + JSON.stringify(c.snap.end));

  ok('S19 D 档：空出发地点「环线=是」被带回第 1 步（改前是静默翻个高亮的死控件）', d.bounce === true, 'bounce=' + d.bounce);
  ok('S20 D 档：并给出原因提示，不是把人扔在第 1 步不说话', /环线要先填出发地/.test(d.toastLoop), JSON.stringify(d.toastLoop));
  ok('S21 D 档：落盘 isLoop=false 且 end=null（改前 isLoop=true 而 end=null，末步却印着回到起点）', d.snap.isLoop === false && d.snap.end == null, 'isLoop=' + d.snap.isLoop + ' end=' + JSON.stringify(d.snap.end));
  ok('S22 D 档：向导末步不再印「是 · 回到起点」', !/是\s*·\s*回到起点/.test(d.confirm) && /环线：\s*否\s*·\s*单程/.test(d.confirm), d.confirm.slice(0, 140));

  ok('S23 E 档：出发地+环线 → 终点自动等于出发地，且是副本不是同一个对象', !!(e.snap.end && e.snap.end.name === '大同' && e.snap.end.isLoop === true && e.snap.start && e.snap.start.isLoop === undefined), 'start=' + JSON.stringify(e.snap.start) + ' end=' + JSON.stringify(e.snap.end));
  ok('S24 E 档：环线有「终」行并标注回到起点，里程是真实返程（86 km）', /终 大同（回到起点 · 环线） 末站至此 \d+ km/.test(e.dom.endRow), e.dom.endRow);
  ok('S25 E 档：返程那段确实进了日卡里程（改前排期里根本没有那 86 km）', e.snap.days[0].km > c.snap.days[0].km + 60, 'E=' + e.snap.days[0].km + ' C=' + c.snap.days[0].km);

  ok('S26 F 档：终到地认不出坐标时印「未匹配到坐标 · 不参与里程」', /终 当前位置（抵达地） 未匹配到坐标 · 不参与里程/.test(f.dom.endRow), f.dom.endRow);
  ok('S27 F 档：不再印「0 km」（看着像"终点就在隔壁"，其实是没匹配到）', f.dom.endRow.indexOf('0 km') < 0 && f.dom.startRow.indexOf('0 km') < 0, f.dom.endRow);
  ok('S28 F 档：向导末步同样点明坐标没匹配到', /终到地：\s*当前位置（未匹配到坐标 · 不参与里程）/.test(f.confirm), f.confirm.slice(0, 160));

  ok('S29 G 档：出发地这枚「当前位置」按钮把坐标真落进了 state（改前这条腿零调用者）', !!(g.snap.start && g.snap.start.lat === DATONG[0] && g.snap.start.lng === DATONG[1]), 'start=' + JSON.stringify(g.snap.start));
  ok('S30 G 档：定位成功后文本框回读不许把坐标洗成 null（名字没改就沿用现值）', g.startAfterLoc && g.startAfterLoc.lat === DATONG[0], JSON.stringify(g.startAfterLoc));
  ok('S31 G 档：「起」行用的是定位坐标算出的里程，与填城市那一档同口径', /起 当前位置 至首站 \d+ km/.test(g.dom.startRow) && g.snap.days[0].km === c.snap.days[0].km, 'row=' + g.dom.startRow + ' km=' + (g.snap.days && g.snap.days[0].km));
  ok('S32 G 档：按钮本身在向导第 1 步的出发地那一行里，且文案是「当前位置」', g.wiz1.hasLoc === true && g.wiz1.hasStart === true && g.wiz1.hasEnd === true && /当前位置/.test(g.wiz1.locText), 'wiz1=' + JSON.stringify(g.wiz1));
  ok('S33 向导第 1 步的两条标签都不再承诺没说过的缺省值', /留空＝首日只算站与站之间的路/.test(g.wiz1.startLabel) && /留空＝单程/.test(g.wiz1.endLabel), g.wiz1.startLabel + ' ／ ' + g.wiz1.endLabel);

  const allErrs = arms.map(function (k) { return (R[k[0]] && R[k[0]].errs) || []; }).reduce(function (t, x) { return t.concat(x); }, []);
  ok('S34 八档全程零未捕获报错（启动崩溃在这类页里表现为静默卡住）', allErrs.length === 0, allErrs.slice(0, 3).join(' | '));
  ok('S35 判据条数 ≥ 30（这一节自己也是会被删的）', checks >= 30, 'checks=' + checks);

  console.log('=== smoke-sched: ' + checks + ' 项，失败 ' + fails + ' ===');
  lines.push('=== smoke-sched: ' + checks + ' 项，失败 ' + fails + ' ===');
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b28-smoke-sched.txt'), lines.join('\n') + '\n'); } catch (err) { console.log('读数落盘失败：' + err.message); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
