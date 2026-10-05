/* tools/smoke-checklist.js — 行前清单真实浏览器冒烟（批次 17）
 * A 组：planner 结果页「出发前」卡（syncAuto 落盘 / 预览条数与死热区 / 计数口径 / 刷新幂等）
 * B 组：checklist.html（规则条目实况 / 勾选 round-trip / 增删撤 / 空态出口 / 离线装载）
 * C 组：autoPlan 规则矩阵（海拔三档的边界值、两组月份窗口、月份回绕、best 自由文本的形态、
 *   预约/门票两条来源腿）+ syncAuto 的剪枝所有权。判据取自真实模块现调的结果。
 * 判据一律取自 DOM 与 localStorage 实况；源码锚点是 verify.js §29 的活，这里不重复。
 * 视口 452×995 = 一加 Ace 6T 真机档。
 * 用法: node tools/smoke-checklist.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* file:// 同源共享 localStorage：开新页前先在一次性页面里清场，
   否则后一段直接命中前一段的桶，「幂等」这类判据会假绿。 */
async function freshPage(browser, url, errs) {
  const wipe = await browser.newPage();
  await wipe.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wipe.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await wipe.close();
  const p = await browser.newPage();
  await p.setViewport({ width: 452, height: 995, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return p;
}

/* 走真实交互排一趟 3 天川西：输入 → 选 4 处候选 → 向导 → 结果页 */
async function planOnce(page) {
  await sleep(3000);                                    /* nation-index.js 是 defer 的 1.4MB */
  await page.type('#promptInput', '我想去川西玩3天');
  await page.click('#genBtn');
  await sleep(1400);
  if (!await page.evaluate(() => document.getElementById('stagePick').style.display === 'block')) return false;
  const n = await page.$$eval('#candList .cand', els => els.length);
  if (!n) return false;
  for (let i = 0; i < Math.min(4, n); i++) {
    await page.evaluate(idx => { const els = document.querySelectorAll('#candList .cand'); if (els[idx]) els[idx].click(); }, i);
    await sleep(150);
  }
  await page.click('#scheduleBtn'); await sleep(400);
  for (let s = 1; s < 3; s++) { await page.click('#wNext'); await sleep(300); }
  await page.click('#wNext'); await sleep(300);
  await page.click('#wDone');
  await sleep(2800);                                    /* 排期渲染 + 分省详情到货后 renderDaysBody 再跑一遍 */
  return await page.evaluate(() => document.getElementById('stageResult').style.display === 'block');
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const errs = [];

  /* ================= A 组：结果页「出发前」卡 ================= */
  const page = await freshPage(browser, U('planner.html'), errs);
  ok('A0 排期链路跑通（结果页在场）', await planOnce(page));

  const A = await page.evaluate(() => {
    const box = document.getElementById('pretripCard');
    const s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null');
    let raw = []; try { raw = JSON.parse(localStorage.getItem('tn_checklist') || '[]'); } catch (e) {}
    const tid = s && s.trip ? s.trip.id : null;
    return {
      disp: box ? box.style.display : 'missing',
      tid: tid,
      count: (document.getElementById('ptCount') || {}).textContent || '',
      barW: (document.getElementById('ptBar') || {}).style.width || '',
      rows: [].map.call(document.querySelectorAll('#ptList .cand'), el => ({
        box: !!el.querySelector('.ckbox'), src: (el.querySelector('small') || {}).textContent || ''
      })),
      raw: raw,
      bucket: raw.filter(x => tid && x.tripId === tid),
      badHash: raw.filter(x => x.id !== Checklist.ckId(x.tripId, x.text)).length
    };
  });
  ok('A1 「出发前」卡在结果页显示', A.disp === 'block', 'display=' + A.disp);
  ok('A2 行程有 id 且已写进快照（跳页回来对得上同一个桶）', !!A.tid && /^p\d+$/.test(String(A.tid)), String(A.tid));
  ok('A3 syncAuto 按 tripId 落盘 localStorage', A.bucket.length > 0, '本趟 ' + A.bucket.length + ' 条 / 全库 ' + A.raw.length + ' 条');
  ok('A4 每条 id === ckId(tripId, text)（散列在页面里现算对账）', A.badHash === 0, A.raw.length + ' 条中 ' + A.badHash + ' 条不符');
  const base = ['身份证', '少量现金', '充电宝', '常用药'];
  ok('A5 通识四件恒在（没有站点事实也兜底）', base.every(t => A.bucket.some(x => x.text === t)), base.join('/'));
  ok('A6 结果页这一段的条目全是 by=auto', A.bucket.every(x => x.by === 'auto'), [...new Set(A.bucket.map(x => x.by))].join(','));
  ok('A7 预览 ≤4 行且一行一个 .src 尾巴都不缺（auto 必带来源）',
    A.rows.length <= 4 && A.bucket.filter(x => x.src).length >= 1, '预览 ' + A.rows.length + ' 行，带来源 ' + A.bucket.filter(x => x.src).length + ' 条');
  ok('A8 预览行不给勾选框（点了没反应的热区比没有更糟）', A.rows.every(r => !r.box), A.rows.filter(r => r.box).length + ' 行有死勾选框');
  const cnt = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null');
    const st = Checklist.statsOf(s.trip.id);
    return { st: st, txt: document.getElementById('ptCount').textContent, w: document.getElementById('ptBar').style.width };
  });
  ok('A9 计数口径 = statsOf（已打包 done / total），不是行数感觉',
    cnt.txt === '已打包 ' + cnt.st.done + ' / ' + cnt.st.total, cnt.txt + ' vs ' + JSON.stringify(cnt.st));
  ok('A10 进度条宽 = round(done/total*100)%', cnt.w === Math.round(cnt.st.done / cnt.st.total * 100) + '%', cnt.w);

  /* 幂等 + done 态存活：勾一条 → 刷新（走快照恢复→renderDaysBody→syncAuto 重跑） */
  const picked = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null'), tid = s.trip.id;
    const raw = JSON.parse(localStorage.getItem('tn_checklist'));
    const one = raw.filter(x => x.tripId === tid)[0];
    one.done = 1;
    localStorage.setItem('tn_checklist', JSON.stringify(raw));
    return { tid: tid, text: one.text, total: raw.length, bucket: raw.filter(x => x.tripId === tid).length };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3400);
  const R = await page.evaluate(t => {
    const raw = JSON.parse(localStorage.getItem('tn_checklist'));
    const b = raw.filter(x => x.tripId === t.tid);
    return {
      stage: document.getElementById('stageResult').style.display,
      total: raw.length, bucket: b.length,
      done: b.filter(x => x.done).map(x => x.text),
      count: document.getElementById('ptCount').textContent
    };
  }, picked);
  ok('A11 刷新重跑 syncAuto 不翻倍（幂等）', R.bucket === picked.bucket && R.total === picked.total,
    '刷新后 本趟 ' + R.bucket + ' / 全库 ' + R.total + '，刷新前 ' + picked.bucket + ' / ' + picked.total);
  ok('A12 刷新后仍停在结果页（快照恢复没把清单入口弄丢）', R.stage === 'block', 'stage=' + R.stage);
  ok('A13 已勾那条刷新后仍是已勾（syncAuto 保 doneMap）', R.done.length === 1 && R.done[0] === picked.text, JSON.stringify(R.done));
  ok('A14 计数随刷新更新（「已打包 1 / N」）', /^已打包 1 \/ \d+$/.test(R.count), R.count);
  await page.close();

  /* ================= B 组：checklist.html ================= */
  const c = await freshPage(browser, U('checklist.html'), errs);
  await c.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([{
      id: 'p111', name: '川西三日', startDate: '2026-11-08',
      days: [{ stops: [{ name: '黄龙风景区' }, { name: '九寨沟' }] }, { stops: [{ name: '西岭雪山' }] }]
    }]));
  });
  await c.goto(U('checklist.html') + '?trip=p111', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await c.evaluate(() => Checklist.syncAuto('p111', {
    stops: [{ name: '黄龙风景区' }, { name: '九寨沟' }, { name: '西岭雪山' }],
    details: {
      '黄龙风景区': { elev: 3900, best: '全年' },
      '九寨沟': { elev: 3000, best: '9-10月' },
      '西岭雪山': { elev: 5364, best: '冬季' }
    },
    startDate: '2026-11-08', days: 3
  }));
  await c.reload({ waitUntil: 'domcontentloaded' });
  await sleep(700);
  const B = await c.evaluate(() => ({
    list: document.getElementById('listCard').style.display,
    empty: document.getElementById('ckEmpty').style.display,
    pick: document.getElementById('pickCard').style.display,
    label: document.getElementById('tripLabel').textContent,
    groups: [].map.call(document.querySelectorAll('#ckBody .ck-group'), el => el.textContent),
    rows: [].map.call(document.querySelectorAll('#ckBody .ck-row'), el => ({
      text: el.querySelector('b').textContent,
      box: !!el.querySelector('.ckbox'), rm: !!el.querySelector('.ck-remove'),
      src: (el.querySelector('small') || {}).textContent || ''
    })),
    count: document.getElementById('ckCount').textContent
  }));
  ok('B0 选定行程：清单卡在场，空态与选择器都收起', B.list === 'block' && B.empty === 'none' && B.pick === 'none',
    B.list + '/' + B.empty + '/' + B.pick);
  ok('B1 行程名上了页头', B.label.indexOf('川西三日') >= 0, B.label);
  const texts = B.rows.map(r => r.text);
  ok('B2 海拔 ≥3000 出高原四件', ['高原反应药', '便携氧气瓶', '保温杯', '唇膏面霜（干燥）'].every(t => texts.indexOf(t) >= 0),
    '条目：' + texts.join('、').slice(0, 120));
  ok('B3 11 月出行出冬季三件', ['羽绒/厚外套', '暖手宝', '防滑鞋'].every(t => texts.indexOf(t) >= 0));
  ok('B4 低海拔雨天规则没被误点亮（maxE=5364 ≥1000）', ['折叠伞', '驱蚊液'].every(t => texts.indexOf(t) < 0), texts.join('、').slice(0, 60));
  ok('B5 中档（2000-3000 的冲锋衣/防晒）不与高档叠发', texts.indexOf('冲锋衣（昼夜温差）') < 0 && texts.indexOf('防晒 SPF50') < 0);
  ok('B6 每条带来源的 auto 都写了推导依据（海拔或季节）',
    B.rows.filter(r => r.src).every(r => /海拔|季节|出发日期|原文|票价/.test(r.src)), B.rows.filter(r => r.src).length + ' 条带来源');
  ok('B7 分组渲染且组头带 x/y 计数', B.groups.length >= 2 && B.groups.every(g => /\d+ \/ \d+/.test(g)), JSON.stringify(B.groups));
  ok('B8 行 = 勾选框 + 文本 + 40px 移除键', B.rows.length > 0 && B.rows.every(r => r.box && r.rm), B.rows.length + ' 行');
  ok('B9 计数与行数一致', B.count === '已打包 0 / ' + B.rows.length, B.count + ' vs ' + B.rows.length + ' 行');

  const first = B.rows[0].text;
  await c.evaluate(t => {
    [].filter.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === t)[0].click();
  }, first);
  await sleep(350);
  const C1 = await c.evaluate(t => {
    const it = JSON.parse(localStorage.getItem('tn_checklist')).filter(x => x.text === t)[0];
    const row = [].filter.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === t)[0];
    return { done: it.done, on: !!row.querySelector('.ckbox.on'), deco: getComputedStyle(row.querySelector('b')).textDecorationLine };
  }, first);
  ok('B10 点一行＝勾选：存储 done=1 + .ckbox.on + 文字划掉', C1.done === 1 && C1.on && /line-through/.test(C1.deco), JSON.stringify(C1));
  await c.reload({ waitUntil: 'domcontentloaded' });
  await sleep(700);
  const C2 = await c.evaluate(t => {
    const row = [].filter.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === t)[0];
    return { on: row ? !!row.querySelector('.ckbox.on') : 'no-row', count: document.getElementById('ckCount').textContent };
  }, first);
  ok('B11 刷新后勾选仍在（真落盘，不是内存态）', C2.on === true && /^已打包 1 \/ \d+$/.test(C2.count), JSON.stringify(C2));

  await c.evaluate(() => {
    document.querySelector('#ckCats .chip[data-c="证件"]').click();
    document.getElementById('ckInput').value = '港澳通行证';
    document.getElementById('ckAdd').click();
  });
  await sleep(350);
  const AD = await c.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('tn_checklist'));
    const it = raw.filter(x => x.text === '港澳通行证')[0];
    return {
      it: it, n: raw.filter(x => x.text === '港澳通行证').length,
      inDom: [].some.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === '港澳通行证'),
      input: document.getElementById('ckInput').value,
      under: !![].filter.call(document.querySelectorAll('#ckBody .ck-group'), el => /证件/.test(el.textContent))[0]
    };
  });
  ok('B12 自定义条目按所选 chip 分类入库（by=user）并出现在该组', !!AD.it && AD.it.by === 'user' && AD.it.cat === '证件' && AD.inDom,
    JSON.stringify(AD.it || {}));
  ok('B13 添加后输入框清空', AD.input === '');
  await c.evaluate(() => { document.getElementById('ckInput').value = '港澳通行证'; document.getElementById('ckAdd').click(); });
  await sleep(350);
  const DUP = await c.evaluate(() => ({
    n: JSON.parse(localStorage.getItem('tn_checklist')).filter(x => x.text === '港澳通行证').length,
    /* toast 是堆叠的：取栈尾，否则读到上一条还没退场的提示，断言就在测采样时机 */
    toast: (([].slice.call(document.querySelectorAll('.ui-toast')).pop() || {}).textContent) || ''
  }));
  ok('B14 重复添加不产生第二条，并讲清原因', DUP.n === 1 && /已经在清单里/.test(DUP.toast), JSON.stringify(DUP));

  await c.evaluate(t => {
    [].filter.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === t)[0]
      .querySelector('.ck-remove').click();
  }, first);
  await sleep(350);
  const CFM = await c.evaluate(() => ({ title: (document.querySelector('.ui-modal-title') || {}).textContent || '', text: (document.querySelector('.ui-modal-text') || {}).textContent || '' }));
  ok('B15 移除走确认卡（不是原生 confirm），并说清建议条目会长回来', CFM.text.indexOf('重新长回来') >= 0, JSON.stringify(CFM));
  await c.evaluate(() => document.querySelector('.ui-modal .ui-btn-primary').click());
  await sleep(350);
  const RM = await c.evaluate(t => {
    const last = [].slice.call(document.querySelectorAll('.ui-toast')).pop() || {};
    return {
      gone: !JSON.parse(localStorage.getItem('tn_checklist')).some(x => x.text === t),
      toast: last.textContent || '',
      /* 撤销键必须挂在这条 toast 上：只查全局会在别的提示在场时假绿 */
      act: !!last.querySelector('.ui-toast-act')
    };
  }, first);
  ok('B16 确认后条目消失 + 出带撤销按钮的 toast', RM.gone && RM.act && /已移除/.test(RM.toast), JSON.stringify(RM));
  await c.evaluate(() => { [].slice.call(document.querySelectorAll('.ui-toast')).pop().querySelector('.ui-toast-act').click(); });
  await sleep(350);
  const UN = await c.evaluate(t => {
    const it = JSON.parse(localStorage.getItem('tn_checklist')).filter(x => x.text === t)[0];
    const row = [].filter.call(document.querySelectorAll('#ckBody .ck-row'), el => el.querySelector('b').textContent === t)[0];
    return { it: it, on: row ? !!row.querySelector('.ckbox.on') : 'no-row' };
  }, first);
  ok('B17 撤销原样还原（done 态一起回来，不是重长一条未勾的）', !!UN.it && UN.it.done === 1 && UN.on === true, JSON.stringify(UN));

  /* 出口三态：无行程→选择器空文案；认得但空桶→清单卡 + 手动补件；认不出来→整页空态 + 换一趟 */
  const e = await freshPage(browser, U('checklist.html'), errs);
  await sleep(500);
  const E1 = await e.evaluate(() => ({
    pick: document.getElementById('pickCard').style.display,
    note: (document.querySelector('#pickList .note') || {}).textContent || '',
    list: document.getElementById('listCard').style.display
  }));
  ok('B18 无参数且无行程：进选择器并讲清先去排一趟', E1.pick === 'block' && E1.note.indexOf('行程规划') >= 0 && E1.list === 'none', JSON.stringify(E1));

  await e.evaluate(() => localStorage.setItem('tn_trips', JSON.stringify([{ id: 'p222', name: '空桶行程', days: [] }])));
  await e.goto(U('checklist.html') + '?trip=p222', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const E2 = await e.evaluate(() => ({
    list: document.getElementById('listCard').style.display,
    none: document.getElementById('ckNone').style.display,
    body: document.getElementById('ckBody').style.display,
    count: document.getElementById('ckCount').textContent,
    canAdd: !!document.querySelector('#listCard .add-row') && getComputedStyle(document.querySelector('#listCard .add-row')).display !== 'none'
  }));
  ok('B19 认得的行程即使空桶也进清单卡（不是整页空态），并解释建议从哪来',
    E2.list === 'block' && E2.none === 'block' && E2.body === 'none' && E2.count === '还没有条目', JSON.stringify(E2));
  await e.evaluate(() => { document.getElementById('ckInput').value = '相机电池'; document.getElementById('ckAdd').click(); });
  await sleep(350);
  const E2b = await e.evaluate(() => ({
    rows: document.querySelectorAll('#ckBody .ck-row').length,
    none: document.getElementById('ckNone').style.display,
    it: JSON.parse(localStorage.getItem('tn_checklist')).filter(x => x.tripId === 'p222')[0]
  }));
  ok('B20 空桶照样能手动补件（add-row 从没被藏掉）', E2b.rows === 1 && E2b.none === 'none' && E2b.it.by === 'user', JSON.stringify(E2b));

  await e.goto(U('checklist.html') + '?trip=pZZZ', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const E3 = await e.evaluate(() => ({
    empty: document.getElementById('ckEmpty').style.display,
    list: document.getElementById('listCard').style.display,
    sw: document.getElementById('ckSwitchWrap').style.display,
    label: document.getElementById('tripLabel').textContent,
    wrote: localStorage.getItem('tn_checklist')
  }));
  ok('B21 认不出的 trip（换机/已删）：整页空态 + 换一趟出口', E3.empty === 'block' && E3.list === 'none' && E3.sw === 'block' && /没找到/.test(E3.label), JSON.stringify(E3));
  ok('B22 认不出的 id 不会被拿去建桶（孤儿桶是 localStorage 的无界增长点）', !E3.wrote || JSON.parse(E3.wrote).every(x => x.tripId !== 'pZZZ'), String(E3.wrote).slice(0, 60));
  await e.evaluate(() => document.getElementById('ckSwitch').click());
  await sleep(400);
  const E4 = await e.evaluate(() => ({
    pick: document.getElementById('pickCard').style.display,
    empty: document.getElementById('ckEmpty').style.display,
    q: location.search, label: document.getElementById('tripLabel').textContent,
    subs: [].map.call(document.querySelectorAll('#pickList .trip-pick small'), el => el.textContent)
  }));
  ok('B23 点「换一趟」回选择器、清 URL、页头复位，且每趟标出清单状态',
    E4.pick === 'block' && E4.empty === 'none' && E4.q === '' && /还没选定/.test(E4.label) && E4.subs.some(s => /清单/.test(s)), JSON.stringify(E4.subs));
  /* 选择器真能点开：这里曾把 DOM 行当行程对象传进 open()，点一行只会弹「还没有编号」 */
  await e.evaluate(() => document.querySelector('#pickList .trip-pick').click());
  await sleep(450);
  const E5 = await e.evaluate(() => ({
    list: document.getElementById('listCard').style.display,
    label: document.getElementById('tripLabel').textContent,
    q: location.search,
    toast: (document.querySelector('.ui-toast') || {}).textContent || ''
  }));
  ok('B24 在选择器点一行 = 打开那趟（对象别传成 DOM 行）', E5.list === 'block' && /空桶行程/.test(E5.label) && /trip=p222/.test(E5.q) && !E5.toast, JSON.stringify(E5));
  await e.close();

  /* 离线装载：清单是纯本机数据，断网也必须整页出得来 */
  const o = await freshPage(browser, U('checklist.html'), errs);
  await o.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([{ id: 'p333', name: '离线趟', startDate: '2026-06-11', days: [{ stops: [] }] }]));
    /* 站点事实来自分省详情（懒加载大文件），清单页不背它：这里直接种一桶，只验「断网还能读」 */
    Checklist.syncAuto('p333', { stops: [], details: {}, startDate: '2026-06-11', days: 3 });
  });
  await o.setOfflineMode(true);
  await o.goto(U('checklist.html') + '?trip=p333', { waitUntil: 'domcontentloaded' });
  await sleep(900);
  const O = await o.evaluate(() => ({
    list: document.getElementById('listCard').style.display,
    rows: document.querySelectorAll('#ckBody .ck-row').length,
    texts: [].map.call(document.querySelectorAll('#ckBody .ck-row b'), el => el.textContent)
  }));
  ok('B25 断网整页照常出清单（通识四件兜底，零网络依赖）', O.list === 'block' && O.rows === 4, JSON.stringify(O.texts));
  await o.setOfflineMode(false);
  await o.close();

  /* ================= C 组：autoPlan 规则矩阵 + 重算所有权 =================
     §29 钉的是源码字符串；2999/3000、999/1000 这种边界、跨年回绕、「全年」不点亮任何
     季节规则、预约腿印出来的「原文」到底是不是那句预约——只有真调一遍才会红。
     开头先做一次运行时阈值对账：万一页面吃的是 SW 缓存里的旧 checklist.js，
     下面整组矩阵会绿得毫无意义。 */
  const m = await freshPage(browser, U('checklist.html'), errs);
  let gC = 0;
  const okC = (name, cond, extra) => { gC++; ok(name, cond, extra); };
  const inp = (elev, best, start, days) => ({
    stops: [{ name: 'S' }],
    details: elev == null ? {} : { S: { elev: elev, best: best || '' } },
    startDate: start || '', days: days || 1
  });
  const plan = i => m.evaluate(x => window.Checklist.autoPlan(x).map(r => ({ t: r.text, cat: r.cat, src: r.src })), i);
  const tx = rows => rows.map(r => r.t);
  const srcOf = (rows, t) => (rows.filter(r => r.t === t)[0] || {}).src || '';
  const HIGH = ['高原反应药', '便携氧气瓶', '保温杯', '唇膏面霜（干燥）'];
  const MID = ['冲锋衣（昼夜温差）', '防晒 SPF50'];
  const COLD = ['羽绒/厚外套', '暖手宝', '防滑鞋'];
  const RAIN = ['折叠伞', '驱蚊液'];

  const THR = await m.evaluate(() => ({ hi: Checklist.ELEV_HIGH, mid: Checklist.ELEV_MID, low: Checklist.ELEV_LOW, base: Checklist.BASE.length }));
  okC('C1 运行时阈值＝§29 锚的 3000/2000/1000（跑的是这一版规则表，不是缓存里的旧表）',
    THR.hi === 3000 && THR.mid === 2000 && THR.low === 1000 && THR.base === 4, JSON.stringify(THR));

  const r3000 = await plan(inp(3000, '', '2026-04-10'));
  okC('C2 海拔 3000 恰好进高档（>= 不是 >），且不与中档叠发',
    HIGH.every(t => tx(r3000).indexOf(t) >= 0) && !MID.some(t => tx(r3000).indexOf(t) >= 0), tx(r3000).join('、'));
  const r2999 = await plan(inp(2999, '', '2026-04-10'));
  okC('C3 海拔 2999 落回中档：高档四条一条不发',
    MID.every(t => tx(r2999).indexOf(t) >= 0) && !HIGH.some(t => tx(r2999).indexOf(t) >= 0), tx(r2999).join('、'));
  const r2000 = await plan(inp(2000, '', '2026-04-10'));
  okC('C4 海拔 2000 恰好进中档（>=）', MID.every(t => tx(r2000).indexOf(t) >= 0), tx(r2000).join('、'));
  const r1999 = await plan(inp(1999, '', '2026-04-10'));
  okC('C5 海拔 1999 + 4 月：三档都不点亮，只剩通识四件', tx(r1999).length === 4, tx(r1999).join('、'));
  const r999 = await plan(inp(999, '', '2026-07-05'));
  okC('C6 海拔 999 + 7 月出雨季两条（< ELEV_LOW 命中）', RAIN.every(t => tx(r999).indexOf(t) >= 0), tx(r999).join('、'));
  const r1000 = await plan(inp(1000, '', '2026-07-05'));
  okC('C7 海拔 1000 不发雨季条目（阈值是 < 不是 <=，1000 归"不算低海拔"）', !RAIN.some(t => tx(r1000).indexOf(t) >= 0), tx(r1000).join('、'));
  okC('C8 高档依据印的是数值（海拔 3000 m），不是「这是高原」这种空话',
    /海拔 3000 m/.test(srcOf(r3000, '高原反应药')), srcOf(r3000, '高原反应药'));

  const sweep = await m.evaluate(ms => {
    const out = {};
    ms.forEach(mm => {
      const d = mm < 10 ? '0' + mm : String(mm);
      out[mm] = Checklist.autoPlan({ stops: [{ name: 'S' }], details: { S: { elev: 400 } }, startDate: '2026-' + d + '-05', days: 1 }).map(x => x.text);
    });
    return out;
  }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  okC('C9 雨季命中月恰为 6/7/8（5 月、9 月一条不发）',
    [6, 7, 8].every(mm => RAIN.every(t => sweep[mm].indexOf(t) >= 0)) && [5, 9].every(mm => !RAIN.some(t => sweep[mm].indexOf(t) >= 0)),
    [4, 5, 6, 7, 8, 9, 10].map(mm => mm + '月:' + sweep[mm].length).join(' '));
  okC('C10 冷季命中月恰为 11/12/1/2/3（10 月、4 月不发）',
    [11, 12, 1, 2, 3].every(mm => COLD.every(t => sweep[mm].indexOf(t) >= 0)) && [10, 4].every(mm => !COLD.some(t => sweep[mm].indexOf(t) >= 0)),
    [1, 3, 4, 10, 11, 12].map(mm => mm + '月:' + sweep[mm].length).join(' '));
  okC('C11 十二个月里没有任何一个月同时点亮雨季与冷季（两个窗口必须互斥）',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(mm => !(RAIN.some(t => sweep[mm].indexOf(t) >= 0) && COLD.some(t => sweep[mm].indexOf(t) >= 0))));

  const TM = await m.evaluate(() => ({
    cross: Checklist.tripMonths('2026-07-31', 3),
    wrap: Checklist.tripMonths('2026-12-30', 5),
    one: Checklist.tripMonths('2026-05-20', 1),
    long: Checklist.tripMonths('2026-01-05', 40),
    none: Checklist.tripMonths('', 7),
    junk: Checklist.tripMonths('尚未决定', 3)
  }));
  okC('C12 末日按真实日历：7-31 走 3 天＝7、8 月（起始月+天数会算成 7、9）', JSON.stringify(TM.cross) === '[7,8]', JSON.stringify(TM.cross));
  okC('C13 跨年回绕：12-30 走 5 天＝12、1 月', JSON.stringify(TM.wrap) === '[12,1]', JSON.stringify(TM.wrap));
  okC('C14 单天行程只落一个月份', JSON.stringify(TM.one) === '[5]', JSON.stringify(TM.one));
  okC('C15 40 天长跨度回绕到 2 月就停（不是循环满 12 个）', JSON.stringify(TM.long) === '[1,2]', JSON.stringify(TM.long));
  okC('C16 没填或读不出的出发日期返回空集，交给最佳季回退腿（不拿 createdAt 顶替）',
    TM.none.length === 0 && TM.junk.length === 0, JSON.stringify([TM.none, TM.junk]));

  const MO = await m.evaluate(() => {
    const g = s => Checklist.monthsOf(s);
    return {
      dash: g('4-10月'), zhi: g('4月至10月'), next: g('10月-次年3月'), one: g('10月'),
      season: g('春秋季'), all: g('全年合适'), junk: g('13月'), empty: g(''), prose: g('最佳游览时间：9-10月')
    };
  });
  okC('C17 区间「4-10月」读成 4..10 七个月', MO.dash.join(',') === '4,5,6,7,8,9,10', MO.dash.join(','));
  okC('C18 中文连接符「4月至10月」同样命中', MO.zhi.join(',') === '4,5,6,7,8,9,10', MO.zhi.join(','));
  okC('C19 「10月-次年3月」跨年回绕不截断', MO.next.join(',') === '10,11,12,1,2,3', MO.next.join(','));
  okC('C20 单月与四季字各走各的腿（「10月」=[10]，「春秋季」=3·4·5·9·10·11）',
    MO.one.join(',') === '10' && MO.season.join(',') === '3,4,5,9,10,11', MO.one.join(',') + ' / ' + MO.season.join(','));
  okC('C21 「全年」＝没有季节信息（空集，不是 1..12）；空串同样',
    MO.all.length === 0 && MO.empty.length === 0, JSON.stringify([MO.all, MO.empty]));
  okC('C22 读不出的写法不猜（「13月」空集）', MO.junk.length === 0, JSON.stringify(MO.junk));
  okC('C23 「最佳游览时间：9-10月」这种带散文的仍走区间腿', MO.prose.join(',') === '9,10', MO.prose.join(','));

  const fb = await plan(inp(500, '6-8月', '', 3));
  okC('C24 无出发日期→退回该站最佳季，依据标「最佳季 6·7·8月」（换了来源就换标签，不假称出发日期）',
    /最佳季 6·7·8月/.test(srcOf(fb, '折叠伞')), srcOf(fb, '折叠伞'));
  const sd = await plan(inp(500, '6-8月', '2026-11-08', 3));
  okC('C25 有出发日期时出发日期优先，即使它和最佳季冲突（11 月走＝冬季条目点亮、雨季条目不发）',
    /出发日期 11月/.test(srcOf(sd, '羽绒/厚外套')) && tx(sd).indexOf('折叠伞') < 0, srcOf(sd, '羽绒/厚外套') + ' / ' + tx(sd).join('、'));

  const SEED = await m.evaluate(() => {
    const real = window.SITE_TICKETS_SEED;
    try {
      window.SITE_TICKETS_SEED = {
        '预约窟': { p: '旺季 200 元', h: '需提前 30 天预约', u: '10-01' },
        '收费峡': { p: '80 元', h: '', u: '09-20' },
        '免费园': { p: '免费', h: '' }
      };
      const run = (name, best) => {
        const det = {};
        det[name] = { elev: 1400, best: best || '' };
        return Checklist.autoPlan({ stops: [{ name: name }], details: det, startDate: '2026-04-10', days: 1 })
          .filter(x => x.cat === '预约').map(x => x.text + '|' + x.src);
      };
      return { best: run('预约窟', '需预约'), hint: run('预约窟', ''), price: run('收费峡', ''), free: run('免费园', ''), unknown: run('无名坡', '') };
    } finally { window.SITE_TICKETS_SEED = real; }
  });
  okC('C26 best 原文写「需预约」→ 出「预约凭据」，依据引 best',
    SEED.best.length === 1 && /预约凭据/.test(SEED.best[0]) && /原文「需预约」/.test(SEED.best[0]), JSON.stringify(SEED.best));
  okC('C27 best 空、只有票价记录的 h 含预约 → 仍出「预约凭据」，且印出来的「原文」自己就含「预约」二字',
    SEED.hint.length === 1 && /预约凭据/.test(SEED.hint[0]) && /原文「[^」]*预约[^」]*」/.test(SEED.hint[0]) && !/原文「旺季 200 元」/.test(SEED.hint[0]),
    JSON.stringify(SEED.hint));
  okC('C28 只有票价、哪里都没有预约字样 → 降级出「门票」，依据标「票价记录」，同站不双发两条',
    SEED.price.length === 1 && /门票/.test(SEED.price[0]) && !/预约凭据/.test(SEED.price[0]) && /票价记录「80 元」/.test(SEED.price[0]),
    JSON.stringify(SEED.price));
  okC('C29 票价记录写着「免费」→ 一条不发（不把「有记录」写成「要买票」）', SEED.free.length === 0, JSON.stringify(SEED.free));
  okC('C30 站点不在门票表里 → 一条不发（不猜有没有门票）', SEED.unknown.length === 0, JSON.stringify(SEED.unknown));
  okC('C31 种子带 u 就跟着印「· 更新于」，与门票卡同一口径',
    /· 更新于 09-20/.test(SEED.price[0] || ''), SEED.price[0] || '(无数)');

  const multi = await plan({ stops: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], details: { A: { elev: 1200 }, B: { elev: 3580 }, C: { elev: 2900 } }, startDate: '2026-04-10', days: 1 });
  okC('C32 多站取最高海拔（依据上是 3580，不是最后一站的 2900）',
    /海拔 3580 m/.test(srcOf(multi, '高原反应药')), srcOf(multi, '高原反应药'));
  const noFact = await plan(inp(null, '', '2026-07-05', 3));
  okC('C33 站点没带上事实（details 空）时连雨季规则也不点亮——没数据就少说，不猜海拔',
    tx(noFact).length === 4, tx(noFact).join('、'));

  const HI = { stops: [{ name: 'S' }], details: { S: { elev: 3900, best: '全年' } }, startDate: '2026-11-08', days: 3 };
  const EMPTY = { stops: [], details: {}, startDate: '2026-11-08', days: 3 };
  await m.evaluate(() => {
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: 'p900', name: '剪枝趟', startDate: '2026-11-08', days: [{ stops: [] }] },
      { id: 'p901', name: '别趟', startDate: '2026-11-09', days: [{ stops: [] }] }
    ]));
  });
  const S1 = await m.evaluate(h => {
    const first = Checklist.syncAuto('p900', h);
    const again = Checklist.syncAuto('p900', h);
    Checklist.add('p900', '相机电池', '装备');
    const u = Checklist.add('p900', '望远镜', '装备');
    Checklist.toggle('p900', u.id);
    const hi = Checklist.listOf('p900').filter(x => x.text === '高原反应药')[0];
    Checklist.toggle('p900', hi.id);
    return { first: first, again: again, n: Checklist.listOf('p900').length };
  }, HI);
  okC('C34 首轮长出 11 条 auto（高档四 + 冬季三 + 通识四，「全年」不点亮任何季节以外的）',
    S1.first.added === 11 && S1.first.removed === 0, JSON.stringify(S1.first));
  okC('C35 同输入重跑返回 added=0 / removed=0（tripId+text 散列 id 让 syncAuto 幂等）',
    S1.again.added === 0 && S1.again.removed === 0, JSON.stringify(S1.again));

  const S2 = await m.evaluate(e => {
    const r = Checklist.syncAuto('p900', e, false);
    const l = Checklist.listOf('p900');
    const hi = l.filter(x => x.text === '高原反应药')[0] || {};
    return { r: r, n: l.length, hiDone: hi.done, user: l.filter(x => x.by === 'user').length };
  }, EMPTY);
  okC('C36 prune=false（事实还没到齐那一腿）只生长不剪枝：清掉站点后 13 条一条条不少',
    S2.n === 13 && S2.r.removed === 0, JSON.stringify(S2));
  okC('C37 prune=false 时上一轮勾上的高原条目仍是已勾（不是"先删后长"回落成未勾）',
    S2.hiDone === 1, 'hiDone=' + S2.hiDone);

  const S3 = await m.evaluate(e => {
    const r = Checklist.syncAuto('p900', e);
    const l = Checklist.listOf('p900');
    return {
      r: r, autoTexts: l.filter(x => x.by === 'auto').map(x => x.text), auto: l.filter(x => x.by === 'auto').length,
      user: l.filter(x => x.by === 'user').length, userDone: l.filter(x => x.by === 'user' && x.done).length
    };
  }, EMPTY);
  okC('C38 prune 默认开：规则不再命中的 auto 随站点变化一起消失（不是永久攒在库里）',
    S3.auto === 7 && S3.r.removed === 4 && S3.autoTexts.indexOf('高原反应药') < 0, JSON.stringify(S3.r) + ' auto=' + S3.auto);
  okC('C39 剪枝只拥有 auto 那一半：用户两条原样在，勾过的那条仍算已勾',
    S3.user === 2 && S3.userDone === 1, 'user=' + S3.user + ' done=' + S3.userDone);
  /* 冷季三条挂在出行日期上、不看海拔，所以清空站点剪掉的是海拔驱动那四条，
     剩下的 7 条＝通识四件 + 冬季三件。这里把 7 拆开钉，别让人把「还剩 7 条」读成漏剪。 */
  okC('C40 剪完剩的正好是通识四件 + 出行日期决定的冬季三件（月份驱动的规则不受站点清空影响）',
    S3.autoTexts.length === 7 && ['身份证', '少量现金', '充电宝', '常用药'].every(t => S3.autoTexts.indexOf(t) >= 0) && COLD.every(t => S3.autoTexts.indexOf(t) >= 0),
    S3.autoTexts.join('、'));

  const S4 = await m.evaluate(h => {
    Checklist.syncAuto('p901', h);
    const before = JSON.parse(localStorage.getItem('tn_checklist')).length;
    const n = Checklist.clearTrip('p900');
    const raw = JSON.parse(localStorage.getItem('tn_checklist'));
    return { before: before, n: n, left: raw.length, only: raw.every(x => x.tripId === 'p901'), p901: raw.filter(x => x.tripId === 'p901').length };
  }, HI);
  okC('C41 clearTrip 只清本趟并回报条数（行程删除时不留孤儿桶，也不顺手清别人的）',
    S4.n === 9 && S4.left === S4.before - 9 && S4.only && S4.p901 === 11, JSON.stringify(S4));
  const S5 = await m.evaluate(() => ({ none: Checklist.clearTrip(''), ghost: Checklist.clearTrip('pZZZ'), total: JSON.parse(localStorage.getItem('tn_checklist')).length }));
  okC('C42 空 id / 认不出的 id：返回 0 且一条不动（clearTrip 不许把整库当本趟清掉）',
    S5.none === 0 && S5.ghost === 0 && S5.total === 11, JSON.stringify(S5));

  ok('C43 规则矩阵跑满 ' + gC + ' 条断言（下限 20；条数掉了就是有分支被删却没说）', gC >= 20, gC + ' 条');

  ok('Z 全程零页面报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? '\n=== SMOKE FAIL: ' + fails + ' 条 ===' : '\n=== SMOKE ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CRASH', (e && e.stack) || e); process.exit(2); });
