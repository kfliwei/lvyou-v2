/* tools/out/probe28-sched.js — 批次 28 定性腿（一次性，只读，不改产品代码）
 *
 * 用户报（逐字）：「我就在大同，在行程规划选择应县木塔和悬空寺，起始点按默认当前位置为空没填，
 *   终点填的当前位置（或是选还线），得出的都不对，本来一天的行程，规划结果的是两天，一天一个景点，
 *   而且没有起始地和终到地。」
 *
 * 六个形状各跑一遍真实序列（意图→选点→向导 4 步→排期），逐形状读：
 *   日卡张数 / 每张几个站 / 排期时 DOM 里那个「天数」输入框的值 / 落盘 trip 的 start·end 形状 /
 *   结果页头部那行有没有「出发地」/ 底部有没有「终」那一行。
 * 用法: node tools/out/probe28-sched.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'planner.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 向导可能被改回上一步（环线缺出发地那条守卫），所以「点到末步」要按按钮在不在走，不能按次数走 */
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
    const ok = await page.evaluate(() => { const e = document.getElementById('wNext'); if (!e) return false; e.click(); return true; });
    if (!ok) return false;
    await sleep(320);
  }
  return false;
}
async function lastToast(page) {
  return page.evaluate(() => {
    const t = document.querySelectorAll('.ui-toast');
    return t.length ? t[t.length - 1].innerText.replace(/\s+/g, ' ') : '';
  });
}

async function runArm(browser, cfg) {
  const page = await browser.newPage();
  const errs = [];
  let bounce = false, toastAfterLoc = '', toastAfterLoop = '';
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* file:// 同源共享 localStorage/sessionStorage：逐档清场，否则上一档的快照直接恢复 */
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  /* 真实序列：一句话（无 Key → 纯规则召回）→ 进选点 */
  await page.type('#promptInput', '我想去山西玩');
  await page.click('#genBtn');
  await sleep(1200);
  /* 按名字在候选里筛出那两站并勾上（每次重查 DOM，重渲染会让句柄失效） */
  for (const name of ['应县木塔', '悬空寺']) {
    await page.evaluate(n => { const f = document.getElementById('candFilter'); f.value = n; f.dispatchEvent(new Event('input')); }, name);
    await sleep(350);
    const clicked = await page.evaluate(n => {
      const els = Array.prototype.slice.call(document.querySelectorAll('#candList .cand'));
      const hit = els.filter(e => e.textContent.indexOf(n) >= 0)[0];
      if (hit) hit.click();
      return !!hit;
    }, name);
    if (!clicked) errs.push('候选里没筛到 ' + name);
    await sleep(200);
  }
  await page.evaluate(() => { const f = document.getElementById('candFilter'); f.value = ''; f.dispatchEvent(new Event('input')); });
  await sleep(400);
  const selN = await page.evaluate(() => document.querySelectorAll('#candList .cand .ckbox.on').length);

  /* 排期前那一眼：选点页汇总条自己写的「预计 N 天」 */
  const estDays = await page.evaluate(() => {
    const m = /预计 <b>(\d+)<\/b> 天/.exec(document.getElementById('summInfo').innerHTML);
    return m ? +m[1] : -1;
  });
  const daysBefore = await page.evaluate(() => {
    const el = document.getElementById('intentDays');
    return el ? { value: el.value, has: true } : { has: false };
  });

  /* 向导：第 1 步按需填起终点，第 2 步按需点环线，第 3 步保持地理最近邻 */
  await page.click('#scheduleBtn');
  await sleep(400);
  if (cfg.geoStub != null) {
    /* 桩只验「按钮 → locate → state.start → 落盘」这条接线，不代表真 GPS。 */
    await page.evaluate(ll => {
      navigator.geolocation.getCurrentPosition = function (cb) { cb({ coords: { latitude: ll[0], longitude: ll[1], accuracy: 30 } }); };
    }, cfg.geoStub);
  }
  if (cfg.start != null) await page.evaluate(v => { const e = document.getElementById('wStart'); e.value = v; e.dispatchEvent(new Event('change')); }, cfg.start);
  if (cfg.end != null) await page.evaluate(v => { const e = document.getElementById('wEnd'); e.value = v; e.dispatchEvent(new Event('change')); }, cfg.end);
  await sleep(200);
  if (cfg.locBtn) { await page.click('#wStartLoc'); await sleep(900); }
  toastAfterLoc = await lastToast(page);
  await page.click('#wNext'); await sleep(320);
  if (cfg.loop === true) {
    const stepBefore = await currentStep(page);
    await page.click('#wLoopY'); await sleep(400);
    toastAfterLoop = await lastToast(page);
    bounce = stepBefore === 2 && (await currentStep(page)) === 1;
  }
  if (!(await advanceToEnd(page))) errs.push('走不到末步（#wDone 始终没出现）');
  /* 末步确认页显示的那三行（用户看到的就是这几行） */
  const confirm = await page.evaluate(() => document.getElementById('wizardBox').innerText.replace(/\s+/g, ' '));
  /* 点「开始排期」之前把天数改掉（改后必须走 onchange，产品就是这么读的） */
  if (cfg.daysSet != null) {
    await page.evaluate(v => { const e = document.getElementById('intentDays'); e.value = String(v); e.dispatchEvent(new Event('change')); }, cfg.daysSet);
    await sleep(150);
  }
  const daysAtSchedule = await page.evaluate(() => { const e = document.getElementById('intentDays'); return e ? e.value : 'no-el'; });
  await page.click('#wDone');
  await sleep(1800);

  const snap = await page.evaluate(() => {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem('tn_planner_state') || 'null'); } catch (e) {}
    const t = s && s.trip;
    return {
      stateDays: s ? s.days : null,
      start: t ? t.start : null,
      end: t ? t.end : null,
      isLoop: s ? !!s.isLoop : null,
      tripName: t ? t.name : null,
      days: t ? t.days.map(d => ({ stops: d.stops.map(x => x.name), km: Math.round(d.driveKm), h: +d.totalH.toFixed(2), transit: !!d.transit })) : null
    };
  });
  const dom = await page.evaluate(() => {
    const body = document.getElementById('resultBody');
    const head = body ? body.innerText.split('\n').slice(0, 6).join(' / ') : '';
    return {
      dayCards: document.querySelectorAll('#resultBody .day-card').length,
      title: (document.getElementById('resultTitle') || {}).textContent || '',
      endRowText: (() => {
        const ns = Array.prototype.slice.call(document.querySelectorAll('#resultBody .stop .n'));
        const hit = ns.filter(n => n.textContent.trim() === '终')[0];
        return hit ? hit.closest('.stop').innerText.replace(/\s+/g, ' ') : '';
      })(),
      startRowText: (() => {
        const ns = Array.prototype.slice.call(document.querySelectorAll('#resultBody .stop .n'));
        const hit = ns.filter(n => n.textContent.trim() === '起')[0];
        return hit ? hit.closest('.stop').innerText.replace(/\s+/g, ' ') : '';
      })(),
      headStartMentions: !!body && /出发地/.test(body.innerText),
      headText: head
    };
  });
  await page.close();
  return { selN, estDays, daysBefore, daysAtSchedule, confirm, snap, dom, errs, bounce, toastAfterLoc, toastAfterLoop };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const arms = [
    ['A 用户那次：出发地空、终到地空、天数没碰', { start: '', end: '' }],
    ['B 同 A，但天数显式改成 1', { start: '', end: '', daysSet: 1 }],
    ['C 出发地填「大同」，终到地空', { start: '大同', end: '' }],
    ['D 出发地空 + 环线=是（「或是选环线」那一支）', { start: '', end: '', loop: true }],
    ['E 出发地「大同」+ 环线=是', { start: '大同', end: '', loop: true }],
    ['F 终到地填字面「当前位置」', { start: '', end: '当前位置' }],
    ['G 出发地按「当前位置」钮（定位桩在大同坐标）', { start: '', end: '', locBtn: true, geoStub: [40.0917, 113.301] }]
  ];
  for (const [label, cfg] of arms) {
    let r;
    try { r = await runArm(browser, cfg); } catch (e) { console.log(label + ' → 探针自己挂了: ' + e.message); continue; }
    console.log('\n================ ' + label);
    console.log('已选站点 ' + r.selN + ' / 排期前汇总条预计 ' + r.estDays + ' 天 / intentDays 排期前=' + JSON.stringify(r.daysBefore) +
      ' 排期时=' + JSON.stringify(r.daysAtSchedule));
    console.log('向导末步：' + r.confirm.replace(/排期设置/g, '').slice(0, 150));
    console.log('落盘 state.days=' + JSON.stringify(r.snap.stateDays) + ' trip.name=' + JSON.stringify(r.snap.tripName));
    console.log('trip.start=' + JSON.stringify(r.snap.start) + ' trip.end=' + JSON.stringify(r.snap.end) + ' isLoop=' + r.snap.isLoop);
    console.log('日卡 ' + r.dom.dayCards + ' 张 → ' + JSON.stringify(r.snap.days));
    console.log('resultTitle: ' + r.dom.title);
    console.log('结果页头部含「出发地」=' + r.dom.headStartMentions + ' / 「起」行=' + JSON.stringify(r.dom.startRowText) +
      ' / 「终」行=' + JSON.stringify(r.dom.endRowText));
    console.log('头部两行: ' + r.dom.headText.slice(0, 260));
    console.log('环线被弹回第 1 步=' + r.bounce + ' / 环线提示=' + JSON.stringify(r.toastAfterLoop) +
      ' / 定位提示=' + JSON.stringify(r.toastAfterLoc));
    if (r.errs.length) console.log('异常: ' + r.errs.join(' | '));
  }
  await browser.close();
})();
