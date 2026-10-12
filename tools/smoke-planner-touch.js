/* tools/smoke-planner-touch.js — 批次 39-C 常驻腿：排期结果页的触控地板与行宽
 *
 * 39-A 的地基读数（tools/out/b39-probe-backlog.txt）：结果页上「移除」钮 30×30（破坏性操作低于地板）、
 * 「记一笔」28 高、「导航」42 高，把「移除」抬到 44 之后一行又挤出盒子右缘 6px。
 * 39-C 的做法：尺寸回到单点（design.css 的 `.stop-acts .mv.mv-del`、`.stop-acts .btn.mini`），
 * 行宽靠 gap 8→6 与左内衬 28→0 收回来；同时把 planner.js 里**内联写死 min-height** 的那几枚收掉——
 * 那是触控尺寸的第三种写法（design.css 单点／页内 <style>／内联 style），只有内联这一种 CSS 管不住。
 * 这一腿钉住改后的现场，并把「可逆轻操作留 30」那一档也钉住（不许被顺手抬上去）。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-planner-touch.js
 * 口径：328×723 dpr2；每腿独立上下文；证据由脚本自己写盘。期望值取自 tools/out/b39-probe-after.txt 的 W' 段。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const LOG = path.join(ROOT, 'tools', 'out', 'b39-smoke-planner-touch.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const out = [];
let fails = 0, total = 0;
const ERRS = [];
function say(s) { out.push(s); console.log(s); }
function ok(id, name, cond, extra) {
  total++;
  say((cond ? 'PASS  ' : 'FAIL  ') + id + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => ERRS.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  return { ctx, page };
}

/* 结果页可点东西的尺寸普查：按「族|高|宽」去重，好把低于 44 的那几族原样列出来 */
const WCENS = function () {
  var sel = '#resultBody button, #resultBody a, #resultBody input, #resultBody [role="button"], #resultBody .chip';
  var seen = {}, list = [];
  document.querySelectorAll(sel).forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    var cls = String(el.className || el.tagName).split(' ')[0] + (el.classList && el.classList.contains('mv-del') ? '-del' : '');
    var key = cls + '|' + Math.round(r.height) + '|' + Math.round(r.width);
    if (!seen[key]) {
      seen[key] = { cls: cls, n: 0, w: Math.round(r.width), h: Math.round(r.height),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 10) };
      list.push(seen[key]);
    }
    seen[key].n++;
  });
  var acts = document.querySelector('.stop-acts');
  var acs = acts ? getComputedStyle(acts) : null;
  var arect = acts ? acts.getBoundingClientRect() : null;
  var opsRows = [].map.call(document.querySelectorAll('.stop-acts'), function (a) {
    var o = a.querySelector('.ops'), r = o ? o.getBoundingClientRect() : null;
    var ar = a.getBoundingClientRect();
    var del = o ? o.querySelector('.mv-del') : null;
    return {
      opsNeed: r ? Math.round(r.width) : null,
      delW: del ? Math.round(del.getBoundingClientRect().width) : null,
      delH: del ? Math.round(del.getBoundingClientRect().height) : null,
      actsH: Math.round(ar.height),
      spill: r ? Math.round(r.right - ar.right) : null
    };
  });
  var cards = [].map.call(document.querySelectorAll('.day-card'), function (c) { return c.scrollWidth - c.clientWidth; });
  var mini = document.querySelector('.stop-acts .btn.mini');
  var nav = document.querySelector('.day-card .dhead .btn');
  var mv30 = [].filter.call(document.querySelectorAll('#resultBody .mv'), function (e) {
    var r = e.getBoundingClientRect();
    return Math.round(r.width) === 30 && Math.round(r.height) === 30;
  });
  return {
    dayCards: document.querySelectorAll('#resultBody .day-card').length,
    stopRows: document.querySelectorAll('#resultBody .stop').length,
    opsRowN: opsRows.length,
    travelOn: !!mini,
    actsPad: acs ? acs.paddingLeft : null,
    opsRows: opsRows,
    spillAny: opsRows.some(function (x) { return x.spill > 1; }),
    delAll: opsRows.length > 0 && opsRows.every(function (x) { return x.delW === 44 && x.delH === 44; }),
    cardSpillMax: cards.length ? Math.max.apply(null, cards) : null,
    pageScrollW: document.documentElement.scrollWidth, pageClientW: document.documentElement.clientWidth,
    miniH: mini ? Math.round(mini.getBoundingClientRect().height) : null,
    navH: nav ? Math.round(nav.getBoundingClientRect().height) : null,
    navInline: nav ? (nav.getAttribute('style') || '') : null,
    mv30N: mv30.length,
    mv30Label: mv30.length ? (mv30[0].getAttribute('aria-label') || '') : null,
    all: list
  };
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 39-C 常驻腿：排期结果页触控档与行宽（328×723）===');

  const P = await newPage(browser);
  await P.page.goto(U('planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2800);
  await P.page.type('#promptInput', '我想去川西玩3天，喜欢自然风光');
  await P.page.click('#genBtn');
  await sleep(1600);
  for (let i = 0; i < 5; i++) {
    await P.page.evaluate(idx => { const e = document.querySelectorAll('#candList .cand'); if (e[idx]) e[idx].click(); }, i);
    await sleep(160);
  }
  await P.page.click('#scheduleBtn'); await sleep(450);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wNext'); await sleep(350);
  await P.page.click('#wDone'); await sleep(2400);

  function wreport(tag, w) {
    say('  ┌ ' + tag);
    say('  │ 日卡 ' + w.dayCards + ' 张 / 站点行 ' + w.stopRows + ' 行 / .stop-acts ' + w.opsRowN + ' 处；「记一笔」' +
      (w.travelOn ? '在场 高 ' + w.miniH : '不在场') + '｜「导航」高 ' + w.navH + '（内联：' + w.navInline + '）');
    say('  │ .stop-acts 左内衬 ' + w.actsPad);
    w.opsRows.forEach(function (r, i) {
      say('  │   第 ' + (i + 1) + ' 行：.ops 实占 ' + r.opsNeed + 'px，移除钮 ' + r.delW + '×' + r.delH + '，行高 ' + r.actsH + 'px，右缘越界 ' + r.spill + 'px');
    });
    say('  │ 移除钮每行 44×44？' + (w.delAll ? '是' : '★否') + '｜挤出盒外？' + (w.spillAny ? '★是' : '否') +
      '｜日卡内横向溢出最大 ' + w.cardSpillMax + 'px｜文档 scrollW/clientW=' + w.pageScrollW + '/' + w.pageClientW);
    say('  │ 低于 44 的一族：' + (w.all.filter(function (x) { return x.h < 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n + '枚「' + x.label + '」'; }).join(' | ') || '无'));
    say('  │ ≥44 的一族：' + (w.all.filter(function (x) { return x.h >= 44; }).map(function (x) { return '.' + x.cls + ' ' + x.w + '×' + x.h + '×' + x.n + '枚「' + x.label + '」'; }).join(' | ') || '无'));
    say('  │ .mv 基础档 30×30：' + w.mv30N + ' 枚「' + w.mv30Label + '」');
  }

  const w0 = await P.page.evaluate(WCENS);
  say('');
  say("【未出行态】");
  wreport('W1', w0);
  ok('T00', '结果页在场：日卡 5 张、站点行 5 行、.stop-acts 5 处（取样分母）',
    w0.dayCards === 5 && w0.stopRows === 5 && w0.opsRowN === 5, '日卡 ' + w0.dayCards + '／站点行 ' + w0.stopRows + '／ops 行 ' + w0.opsRowN);
  ok('T01', '「移除」钮（破坏性操作）每行都 44×44（改前 30×30）', w0.delAll, '逐行 ' + JSON.stringify(w0.opsRows.map(x => x.delW + '×' + x.delH)));
  ok('T02', '没有一行把 .ops 挤出 .stop-acts 右缘（抬够 44 之后行宽要收得住，改后越界 0）', !w0.spillAny && w0.opsRows.every(x => x.spill <= 0),
    '逐行越界 ' + JSON.stringify(w0.opsRows.map(x => x.spill)));
  ok('T03', '日卡内零横向溢出，文档 scrollW=clientW=328（不靠横向滚动才能点全）',
    w0.cardSpillMax === 0 && w0.pageScrollW === w0.pageClientW && w0.pageClientW === VW, '溢出 ' + w0.cardSpillMax + '，文档 ' + w0.pageScrollW + '/' + w0.pageClientW);
  ok('T04', '「导航」钮 ≥44 高，且它的高度不再由内联 style 写死（第三种写法：CSS 管不住内联）',
    w0.navH >= 44 && w0.navInline.indexOf('min-height') < 0, '高 ' + w0.navH + '，内联「' + w0.navInline + '」');
  ok('T05', '.stop-acts 的左内衬回到 0（改前 28px 白占一行宽，是挤出右缘的另一半原因）', w0.actsPad === '0px', '读到 ' + w0.actsPad);
  const low0 = w0.all.filter(x => x.h < 44);
  const fams = low0.map(x => x.cls).sort().join(',');
  /* 低于地板的两族是登记过的现状：.mv＝可逆轻操作那一档（批次 39-A 定的口径，故意留 30），
     .chip「自动」＝待点单项（审核报告里挂着，还没抬）。白名单式对账：出现第三族即红。 */
  ok('T06', '低于 44 的只有登记的那两族（mv 可逆轻操作 + chip 自动＝待点单），没有第三族混进来',
    fams === 'chip,mv' && low0.every(x => x.cls === 'chip' || x.cls === 'mv'),
    '现读 ' + low0.map(x => '.' + x.cls + ' ' + x.w + '×' + x.h + '「' + x.label + '」×' + x.n).join(' | '));
  ok('T07', '可逆轻操作那一档没被顺手抬上去：.mv 基础档实测仍是 30×30 且 ≥1 枚在场', w0.mv30N >= 1, w0.mv30N + ' 枚「' + w0.mv30Label + '」');

  await P.page.evaluate(() => { window.plannerStartTrip(); });
  await sleep(1200);
  const w1 = await P.page.evaluate(WCENS);
  say('');
  say("【出行态：多一枚「记一笔」，那一行最挤】");
  wreport('W2', w1);
  ok('T08', '出行态：「记一笔」在场且高 ≥44（改前 28，那一行是最挤的一行）', w1.travelOn && w1.miniH >= 44, '「记一笔」高 ' + w1.miniH);
  ok('T09', '出行态（最挤）：移除钮 44×44、零越界、日卡零溢出、文档 328/328 四项同时成立',
    w1.delAll && !w1.spillAny && w1.cardSpillMax === 0 && w1.pageScrollW === w1.pageClientW,
    'delAll ' + w1.delAll + '，越界 ' + w1.spillAny + '，日卡溢出 ' + w1.cardSpillMax + '，文档 ' + w1.pageScrollW + '/' + w1.pageClientW);
  const low1 = w1.all.filter(x => x.h < 44);
  ok('T10', '出行态里低于 44 的族没有增加（「记一笔」进来后没把别的挤下地板）', low1.length === low0.length,
    '未出行 ' + low0.length + ' 族，出行 ' + low1.length + ' 族：' + low1.map(x => '.' + x.cls + ' ' + x.h).join(' | '));

  /* ---- 行程清单那一行：「打开」与「删除行程」从前内联写死 30px ---- */
  const Q = await newPage(browser);
  await Q.page.goto(U('planner.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2200);
  await Q.page.evaluate(function () {
    var stops = ['成都双流机场T2到达层', '宽窄巷子（这里的人流在下午四点之后才开始堆起来）', '人民公园鹤鸣茶社'];
    var days = [1, 2, 3].map(function (d) {
      return { title: '第 ' + d + ' 天：川西环线上一段很长的名字用来把这一行撑到极限', stops: stops.map(function (s) { return { name: s, lat: 30.5, lng: 104.0 }; }) };
    });
    localStorage.setItem('tn_trips', JSON.stringify([
      { id: 'pl39a', name: '川西小环线（这一条名字故意写到能撑破一行的宽度为止）', createdAt: new Date().toISOString(), days: days }
    ]));
  });
  await Q.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2400);
  const tp = await Q.page.evaluate(function () {
    var rows = [].map.call(document.querySelectorAll('#tripsHomeList .cand'), function (c) {
      var btns = [].map.call(c.querySelectorAll('button'), function (b) {
        var r = b.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), inline: b.getAttribute('style') || '',
          label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 6) };
      });
      return { spill: c.scrollWidth - c.clientWidth, rowW: Math.round(c.getBoundingClientRect().width), btns: btns };
    });
    return { rows: rows, pageScrollW: document.documentElement.scrollWidth, pageClientW: document.documentElement.clientWidth,
      cardShown: (document.getElementById('tripsHome') || {}).style ? document.getElementById('tripsHome').style.display : null };
  });
  const bt = (tp.rows[0] || {}).btns || [];
  say('');
  say('【行程清单那一行（第一页「已保存的行程」）】');
  say('  行 ' + JSON.stringify(tp.rows) + '｜文档 ' + tp.pageScrollW + '/' + tp.pageClientW + '｜卡片显示 ' + tp.cardShown);
  ok('T11', '行程清单行里的两枚钮（打开／删除行程）都 ≥44 高，且内联里没有 min-height（改前写死 30px）',
    tp.rows.length === 1 && bt.length === 2 && bt.every(b => b.h >= 44 && b.inline.indexOf('min-height') < 0),
    '钮 ' + JSON.stringify(bt.map(b => b.label + ' ' + b.w + '×' + b.h)));
  ok('T12', '那两枚钮都有可达名（纯图标那颗「删除行程」从前只有一枚 ✕，读屏念得出「按钮」念不出删什么）',
    bt.length === 2 && bt.every(b => b.label.length >= 2), '读到 ' + JSON.stringify(bt.map(b => b.label)));
  ok('T13', '行程清单那一行（名字撑到最长）零横向溢出，文档 scrollW=clientW',
    tp.rows.every(r => r.spill === 0) && tp.pageScrollW === tp.pageClientW, '溢出 ' + JSON.stringify(tp.rows.map(r => r.spill)) + '，文档 ' + tp.pageScrollW + '/' + tp.pageClientW);

  ok('T14', '全程零未捕获报错', ERRS.length === 0, ERRS.slice(0, 3).join(' | '));
  ok('T15', '本腿条数守卫（≥15 条前置判据，且没有 FAIL 行）', total >= 15, '实际执行 ' + total + ' 条');

  say('');
  say(fails ? ('=== ' + fails + ' 项失败 ===') : '=== 全部通过 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => {
  say('腿异常：' + e.message);
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(2);
});
