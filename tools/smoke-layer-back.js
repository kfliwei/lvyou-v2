/* tools/smoke-layer-back.js — 批次 39-D 常驻腿：三处浮层的物理返回键必须与屏上那扇门同一条路
 *
 * 用户报的形状（2026-10-11 前的审核遗留项）：App 里按物理返回键，某些浮层「裸关」——
 * 刚填的内容一句话都不问就直接没了；而新开页面时按返回键等于退出应用，因为 DOM 层根本不进历史。
 * 39-D 的做法（照批次 37 已定型的形状复制）：开层时 history.pushState 压一条，popstate 里
 * 「重压一条 + 走同一套脏检查」，屏上那扇门改成「先摘/藏层再 back」，压不进就不许发 back。
 *
 * 三处口径（第一版探针读数错在这里，不是产品错）：
 *   ①「压了几条」的基线取进本页时那一格，不取「开层之后」（开层自己就压了，取晚了读成 0）
 *   ②「历史收没收回」读 history.state，不读 history.length——back 只移动 index，length 永不减
 *   ③ 每一步开始前 rewind：上一层／上一个确认框没清场，后面几步的读数全是污染
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-layer-back.js
 * 口径：328×723 dpr2；每层独立上下文（各自一份 IndexedDB）；证据由脚本自己写盘。
 * 期望值取自 tools/out/b39-probe-after.txt 的 X'/Y'/Z' 三段。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const LOG = path.join(ROOT, 'tools', 'out', 'b39-smoke-layer-back.txt');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const out = [];
let fails = 0, total = 0;
function say(s) { out.push(s); console.log(s); }
function ok(id, name, cond, extra) {
  total++;
  say((cond ? 'PASS  ' : 'FAIL  ') + id + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  return { ctx, page, errs };
}

/* 每层的六步形状一样，只差「怎么开层／往哪一格打字／屏上那扇门是谁／怎么读现场」。
 * 这些差异全收在配置里，跑出来的读数交给下面的判据。 */
const LAY = [
  { k: 'X', first: 'B00', name: 'node-manager.html 自建地点表单', page: 'node-manager.html', load: 3000, api: '!!(window.NM&&NM.map)',
    open: function (page) { return page.evaluate(function () { NM.map.fire('touchstart', { latlng: NM.map.getCenter() }); }).then(() => sleep(900)); },
    type: function (page) { return page.type('#nmName', '鹳雀楼（试验）').then(() => sleep(200)); },
    /* 机器填的那两格（逆地理城市 / 海拔）走异步请求：不等它们落地就发返回，测到的是「请求还没回来」
       那一档，判出来的「没内容也拦」是竞态不是缺陷。这里轮询到数值稳定再走下一步。 */
    afterOpen: function (page) {
      return page.evaluate(function () {
        return new Promise(function (res) {
          var last = null, same = 0, guard = 0;
          (function tick() {
            var c = ((document.querySelector('#nmCity') || {}).value) || '';
            var e = ((document.querySelector('#nmElev') || {}).value) || '';
            var cur = c + '|' + e;
            if (cur === last) { if (++same >= 4) return res({ city: c, elev: e, frames: guard }); }
            else { same = 0; last = cur; }
            if (guard++ > 60) return res({ city: c, elev: e, frames: guard, to: 1 });
            setTimeout(tick, 150);
          })();
        });
      }).then(function (v) { return sleep(500).then(function () { return v; }); });
    },
    field: '#nmName', door: '#nmCancel',
    read: function () {
      var m = document.querySelector('.ui-modal-mask:not(.nm-mask)');
      return { hist: history.length, st: histState(), alive: !!document.querySelector('#nmName'),
        typed: ((document.querySelector('#nmName') || {}).value || '').slice(0, 12) || null,
        ask: !!m, askText: m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
    },
    ok: function () { const b = document.querySelector('.ui-modal-mask:not(.nm-mask) .ui-btn-primary'); if (b) b.click(); },
    no: function () { const b = document.querySelector('.ui-modal-mask:not(.nm-mask) .ui-btn-ghost'); if (b) b.click(); },
    doorClick: function () { const b = document.getElementById('nmCancel'); if (b) b.click(); } },
  { k: 'Y', first: 'B08', name: 'review.html 行程生成表单', page: 'review.html', load: 2600, api: '!!(window.Results&&Results.itinerary)',
    open: function (page) {
      return page.evaluate(function () {
        Results.itinerary([{ name: '云冈石窟', lat: 40.032, lng: 113.135 }, { name: '华严寺', lat: 40.091, lng: 113.259 }], '山西');
      }).then(() => sleep(900));
    },
    type: function (page) { return page.type('#ipref', '不看博物馆，只看地上文物').then(() => sleep(200)); },
    field: '#ipref', door: '#ix',
    read: function () {
      var m = document.querySelector('.ui-modal-mask');
      return { hist: history.length, st: histState(), alive: !!document.querySelector('#igo'),
        typed: ((document.querySelector('#ipref') || {}).value || '').slice(0, 12) || null,
        ask: !!m, askText: m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
    },
    ok: function () { const b = document.querySelector('.ui-modal-mask .ui-btn-primary'); if (b) b.click(); },
    no: function () { const b = document.querySelector('.ui-modal-mask .ui-btn-ghost'); if (b) b.click(); },
    doorClick: function () { const b = document.getElementById('ix'); if (b) b.click(); } },
  { k: 'Z', first: 'B16', name: 'travel-map.html 随手记面板', page: 'travel-map.html', load: 2400, api: '!!(window.TravelNotes&&TravelNotes.openPanel)',
    open: function (page) {
      return page.evaluate(function () { TravelNotes.openPanel({ label: '云冈石窟', name: '云冈石窟', lat: 40.032, lng: 113.135 }); }).then(() => sleep(1000));
    },
    type: function (page) {
      return page.evaluate(function () {
        var ta = document.querySelector('#tnRawEdit');
        if (ta) { ta.value = '先说一段话试试：今天风很大，护栏还在修。'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      }).then(() => sleep(250));
    },
    field: '#tnRawEdit', door: '#tnX',
    read: function () {
      var p = document.querySelector('.tn-panel'), c = document.querySelector('.tn-cfm');
      return { hist: history.length, st: histState(), alive: !!p && getComputedStyle(p).display !== 'none',
        typed: ((document.querySelector('#tnRawEdit') || {}).value || '').slice(0, 14) || null,
        ask: !!c, askText: c ? (c.innerText || '').replace(/\s+/g, ' ').slice(0, 44) : null };
    },
    ok: function () { const b = document.querySelector('.tn-cfm .tc-ok'); if (b) b.click(); },
    no: function () { const b = document.querySelector('.tn-cfm .tc-no'); if (b) b.click(); },
    doorClick: function () { const b = document.getElementById('tnX'); if (b) b.click(); } }
];

/* 探针自己往页面挂一个读数器：history.length 证明不了「历史收掉了」（back 只移动 index，不减 length），
   能观测的是 history.state 落回哪一格。产品码一行不改。 */
async function injectHistState(page) {
  await page.evaluate(function () {
    window.histState = function () { try { return history.state ? JSON.stringify(history.state).slice(0, 24) : 'null'; } catch (e) { return 'err'; } };
  });
}
async function rewind(A, cfg) {
  for (let i = 0; i < 4; i++) {
    const s = await A.page.evaluate(cfg.read);
    if (s.ask) { await A.page.evaluate(cfg.ok); await sleep(700); continue; }
    if (s.alive) { await A.page.evaluate(cfg.doorClick); await sleep(600); continue; }
    break;
  }
  await sleep(300);
}

/* 六步跑一遍，返回读数；判据在调用方逐条写（编号要能被 verify.js 的齐备检数到，不能拼出来） */
async function layerRun(A, cfg) {
  const base = await A.page.evaluate(() => history.length);
  await A.page.goto(U(cfg.page), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(cfg.load);
  await injectHistState(A.page);
  const hIn = await A.page.evaluate(() => ({ hist: history.length, st: histState() }));
  const avail = await A.page.evaluate(function (fn) {
    try { return { v: !!((new Function('return (' + fn + ')'))()) }; } catch (e) { return { v: false, err: String(e.message).slice(0, 50) }; }
  }, cfg.api);
  if (!avail.v) return { avail: false, err: avail };
  const r = { avail: true, base: base, hIn: hIn };
  await cfg.open(A.page);
  r.fill1 = cfg.afterOpen ? await cfg.afterOpen(A.page) : null;
  r.openClean = await A.page.evaluate(cfg.read);
  await cfg.type(A.page);
  const q = await A.page.evaluate(cfg.read);
  r.push = r.openClean.hist - hIn.hist;
  r.pushedState = r.openClean.st;
  r.typedWhileOpen = q.typed;
  await A.page.evaluate(() => history.back());
  await sleep(1400);
  r.ask = await A.page.evaluate(cfg.read);
  await A.page.evaluate(cfg.ok);
  await sleep(1300);
  r.closed = await A.page.evaluate(cfg.read);
  r.back = r.closed.st === hIn.st;
  await rewind(A, cfg);
  const pre4 = await A.page.evaluate(cfg.read);
  await cfg.open(A.page);
  r.fill4 = cfg.afterOpen ? await cfg.afterOpen(A.page) : null;
  r.r4a = await A.page.evaluate(cfg.read);
  await A.page.evaluate(() => history.back());
  await sleep(1400);
  r.clean = await A.page.evaluate(cfg.read);
  r.pre4 = pre4;
  await rewind(A, cfg);
  const pre5 = await A.page.evaluate(cfg.read);
  await cfg.open(A.page);
  await cfg.type(A.page);
  await A.page.evaluate(cfg.doorClick);
  await sleep(1000);
  r.door = await A.page.evaluate(cfg.read);
  r.pre5 = pre5;
  await A.page.evaluate(cfg.no);
  await sleep(800);
  r.stay = await A.page.evaluate(cfg.read);
  await A.page.evaluate(cfg.ok);
  await sleep(900);
  return r;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files']
  });
  say('=== 批次 39-D 常驻腿：三处浮层的返回键与屏上那扇门（328×723）===');

  const R = {};
  for (let i = 0; i < LAY.length; i++) {
    const cfg = LAY[i];
    say('');
    say('【' + cfg.k + ' ' + cfg.name + '】');
    const A = await newPage(browser);
    R[cfg.k] = await layerRun(A, cfg);
    R[cfg.k].errs = A.errs;
    if (!R[cfg.k].avail) {
      say('  ★入口不在场：' + JSON.stringify(R[cfg.k]) + ' ⇒ 这一条腿没量到，不能算过');
      ok(cfg.first, cfg.k + ' 入口在场（后面七条没跑＝这一层没量到）', false, JSON.stringify(R[cfg.k].err || ''));
    } else {
      const r = R[cfg.k];
      say('  ① 开层（进本页 hist=' + r.hIn.hist + '）→ 开完 hist=' + r.openClean.hist + '｜这一层压了 ' + r.push + ' 条｜state ' + r.openClean.st +
        (r.fill1 ? '｜机器填的 city=「' + r.fill1.city + '」elev=「' + r.fill1.elev + '」' : '') + '｜打字后 hist ' + r.hIn.hist + '→' + r.ask.hist + '（打字不压条）');
      say('  ② 脏着发返回：' + JSON.stringify(r.ask));
      say('  ③ 关掉不存：' + JSON.stringify(r.closed) + '｜state ' + r.pushedState + ' → ' + r.closed.st + '（进本页 ' + r.hIn.st + '）');
      say('  ④ 干净层（开层前 state ' + r.pre4.st + '，开完 ' + r.r4a.st + (r.fill4 ? '，机器填完 city=「' + r.fill4.city + '」elev=「' + r.fill4.elev + '」' : '') + '）发返回：' + JSON.stringify(r.clean));
      say('  ⑤ 脏着点屏上那扇门 ' + cfg.door + '：' + JSON.stringify(r.door));
      say('  ⑥ 确认框点「继续填」：' + JSON.stringify(r.stay));
    }
    await A.ctx.close();
  }

  /* ---- X：node-manager 表单 ---- */
  {
    const r = R.X;
    ok('B00', 'X 入口在场：NM.map 在（不在场时下面七条全是空的，先单独红这一条）', r.avail, '');
    ok('B01', 'X 开层压一条历史（改前 0 条：新开页按返回＝退出应用）', r.avail && r.push === 1, '压了 ' + (r.avail ? r.push : '没跑') + ' 条');
    ok('B02', 'X 脏着按返回：落回这一层并问出口，字还在', r.avail && r.ask.ask && r.ask.alive && !!r.ask.typed, '读到 ' + JSON.stringify(r.ask && { ask: r.ask.ask, alive: r.ask.alive, typed: r.ask.typed }));
    ok('B03', 'X 点「关掉不存」：层摘掉、确认框自己摘干净（同一发返回不许问两遍）、state 落回进本页那一格',
      r.avail && !r.closed.alive && !r.closed.ask && r.back, '读到 ' + JSON.stringify(r.closed && { alive: r.closed.alive, ask: r.closed.ask }) + '，state ' + (r.avail ? r.pushedState + '→' + r.closed.st + '（进本页 ' + r.hIn.st + '）' : ''));
    ok('B04', 'X 干净层直接摘、不白问一句（机器异步填的海拔不许算成「有内容」）',
      r.avail && !r.clean.alive && !r.clean.ask, '机器填 elev=「' + (r.fill4 ? r.fill4.elev : '?') + '」，读到 ' + JSON.stringify(r.clean && { alive: r.clean.alive, ask: r.clean.ask }));
    ok('B05', 'X 屏上那扇门 #nmCancel 与返回键走同一条脏检查',
      r.avail && r.door.ask && r.door.alive, '读到 ' + JSON.stringify(r.door && { alive: r.door.alive, ask: r.door.ask, st: r.door.st }));
    ok('B06', 'X 点「继续填」：层留着、字留着，且这一层的历史条目还在场（不收就不许再叠一条）',
      r.avail && r.stay.alive && !r.stay.ask && !!r.stay.typed && r.stay.st === r.door.st, '读到 ' + JSON.stringify(r.stay && { alive: r.stay.alive, ask: r.stay.ask, typed: r.stay.typed, st: r.stay.st }));
    ok('B07', 'X 全程零未捕获报错', r.avail && r.errs.length === 0, (r.errs || []).slice(0, 2).join(' | '));
  }
  /* ---- Y：review 行程表单 ---- */
  {
    const r = R.Y;
    ok('B08', 'Y 入口在场：Results.itinerary 在', r.avail, '');
    ok('B09', 'Y 开层压一条历史', r.avail && r.push === 1, '压了 ' + (r.avail ? r.push : '没跑') + ' 条');
    ok('B10', 'Y 脏着按返回：落回这一层并问出口，字还在', r.avail && r.ask.ask && r.ask.alive && !!r.ask.typed, '读到 ' + JSON.stringify(r.ask && { ask: r.ask.ask, alive: r.ask.alive, typed: r.ask.typed }));
    ok('B11', 'Y 点「关掉不存」：层摘掉、不重复问、state 落回进本页那一格',
      r.avail && !r.closed.alive && !r.closed.ask && r.back, 'state ' + (r.avail ? r.pushedState + '→' + r.closed.st : ''));
    ok('B12', 'Y 干净层直接摘、不白问一句', r.avail && !r.clean.alive && !r.clean.ask, '读到 ' + JSON.stringify(r.clean && { alive: r.clean.alive, ask: r.clean.ask }));
    ok('B13', 'Y 屏上那扇门 #ix 与返回键走同一条脏检查', r.avail && r.door.ask && r.door.alive, '读到 ' + JSON.stringify(r.door && { alive: r.door.alive, ask: r.door.ask }));
    ok('B14', 'Y 点「继续填」：层留着、字留着、历史条目还在场',
      r.avail && r.stay.alive && !r.stay.ask && !!r.stay.typed && r.stay.st === r.door.st, '读到 ' + JSON.stringify(r.stay && { alive: r.stay.alive, typed: r.stay.typed, st: r.stay.st }));
    ok('B15', 'Y 全程零未捕获报错', r.avail && r.errs.length === 0, (r.errs || []).slice(0, 2).join(' | '));
  }
  /* ---- Z：travel-map 随手记面板 ---- */
  {
    const r = R.Z;
    ok('B16', 'Z 入口在场：TravelNotes.openPanel 在', r.avail, '');
    ok('B17', 'Z 开面板压一条历史', r.avail && r.push === 1, '压了 ' + (r.avail ? r.push : '没跑') + ' 条');
    ok('B18', 'Z 脏着按返回：面板还在并问出口，正文还在（同一发返回只许问一遍，不许叠第二层）',
      r.avail && r.ask.ask && r.ask.alive && !!r.ask.typed, '读到 ' + JSON.stringify(r.ask && { ask: r.ask.ask, alive: r.ask.alive, typed: r.ask.typed }));
    ok('B19', 'Z 点「关掉不存」：面板收起、确认框自己摘干净、state 落回进本页那一格',
      r.avail && !r.closed.alive && !r.closed.ask && r.back, 'state ' + (r.avail ? r.pushedState + '→' + r.closed.st : ''));
    ok('B20', 'Z 干净面板直接收、不白问一句', r.avail && !r.clean.alive && !r.clean.ask, '读到 ' + JSON.stringify(r.clean && { alive: r.clean.alive, ask: r.clean.ask }));
    ok('B21', 'Z 屏上那扇门 #tnX 与返回键走同一条脏检查', r.avail && r.door.ask && r.door.alive, '读到 ' + JSON.stringify(r.door && { alive: r.door.alive, ask: r.door.ask }));
    ok('B22', 'Z 点「继续填」：面板留着、正文留着、历史条目还在场（UI.vt 的 hide 不许把这一发抢走）',
      r.avail && r.stay.alive && !r.stay.ask && !!r.stay.typed && r.stay.st === r.door.st, '读到 ' + JSON.stringify(r.stay && { alive: r.stay.alive, typed: r.stay.typed, st: r.stay.st }));
    ok('B23', 'Z 全程零未捕获报错', r.avail && r.errs.length === 0, (r.errs || []).slice(0, 2).join(' | '));
  }

  ok('B24', '本腿条数守卫（24 条前置判据齐备，且没有 FAIL 行）',
    total >= 24 && out.filter(l => /^FAIL/.test(l)).length === 0, '实际执行 ' + total + ' 条');

  say('');
  say(fails ? ('=== ' + fails + ' 项失败 ===') : '=== 全部通过 ===');
  fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => {
  say('腿异常：' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n'));
  try { fs.writeFileSync(LOG, out.join('\n') + '\n', 'utf8'); } catch (_) {}
  process.exit(2);
});
