/* tools/smoke-export.js — 批次 16 导出闸门的真实浏览器腿（ICS 日历 + 打印友好路书）。
 * 这一节证明的是 §28 那堆源码锚证明不了的两件事：
 * ① 点「导出日历」真产出一份**能被日历收下**的 .ics——判据是一个最小 ICS 校验器逐条读产品自己
 *    交给下载通道的那段字节（CRLF / 每行 ≤75 字节 / 转义 / UID+DTSTAMP+SUMMARY / DTEND=次日），
 *    不是"代码里写了 \r\n"；
 * ② 导出的路书 HTML 在 `print` 介质下的**计算样式**真的换了档（分页、字号、不靠颜色承载信息）。
 * 取样口径：ICS 走 URL.createObjectURL 的透传桩（真实现照常执行，只顺手留底），路书走 a[download]
 * 的 data: href 解码——两者都是产品交给系统的那份原物，不是另造一份。
 * 用法: node tools/smoke-export.js（NODE_PATH 需指到 tools/node_modules） */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const _d = new Date();
const OUT = path.join(__dirname, 'out', 'shots',
  [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-') + '-b16-export');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || String(8220 + (Date.now() % 40)), 10);
const BASE = 'http://127.0.0.1:' + PORT;

const checks = [];
function ok(id, pass, detail) { checks.push({ id, pass: !!pass, detail: detail === undefined ? '' : String(detail) }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- 夹具：三条行程，字段表照 planner 自己的结构抄（没有时刻、没有逐日日期） ----------
 * day = {stops,driveKm,driveH,playH,endKm,totalH}；转日另有 {transit,from,to,tla,tlo}
 * stop = {name,lat,lng,city,region,theme} */
function mkTrip(i) {
  const st = a => a.map(x => ({ name: x[0], lat: x[1], lng: x[2], city: x[3], region: '山西', theme: '古迹' }));
  const d1 = { driveKm: 120.4, driveH: 2.2, playH: 5, endKm: 0, totalH: 7.5,
    stops: st([['晋祠', 37.72, 112.56, '太原'], ['平遥古城, 含「；」测; 分号与逗号', 37.2, 112.18, '晋中']]) };
  const d2 = { transit: true, from: '太原', to: '大同', tla: 37.87, tlo: 113.31, driveKm: 250.7, driveH: 3.4, playH: 0, endKm: 0, totalH: 3.4, stops: [] };
  const d3 = { driveKm: 30.2, driveH: 0.8, playH: 4.2, endKm: 0, totalH: 5.1,
    stops: st([['云冈石窟', 40.11, 113.13, '大同'], ['华严寺', 40.11, 113.29, '大同']]) };
  if (i === 0) return { id: 'p16a', name: '晋陕豫 5 日自驾·含转日', createdAt: 1759000000000, startDate: '2026-10-20',
    start: { name: '北京', lat: 39.9, lng: 116.4 }, end: { name: '西安', lat: 34.3, lng: 108.9 }, aiLevel: 'off',
    days: [d1, d2, d3], dist: null, narrative: { story: '夜色落在斗拱上' } };
  if (i === 1) return { id: 'p16b', name: '没选日期的那趟', createdAt: 1759000000001, startDate: '',
    start: { name: '北京' }, end: { name: '西安' }, aiLevel: 'off', days: [d1, d3], dist: null, narrative: null };
  return { id: 'p16c', name: '一天·转义与 emoji 😀', createdAt: 1759000000002, startDate: '2026-12-31',
    start: { name: '太原' }, end: { name: '太原', isLoop: true }, aiLevel: 'off', days: [d3], dist: null, narrative: null };
}

async function boot() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const http = require('http');
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  return { browser, server };
}

/* 起一个干净页：破 SW / HTTP 缓存 / 本机键，把夹具灌进 tn_trips（产品自己的已保存行程表）。
 * 外部请求一律拦掉，但**单独数 restapi.amap.com**：E6 要证明的是"生成日历这条腿一次网都没迈"，
 * 而天气那条腿本来就会去够 open-meteo——两件事不许混在一个计数里。 */
async function openPlanner(browser, trips) {
  const page = await browser.newPage();
  await page.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  const amapReqs = [];
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) r.continue();
    else { if (u.indexOf('restapi.amap.com') >= 0) amapReqs.push(u); r.abort(); }
  });
  await page.goto(BASE + '/planner.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(list => {
    try { localStorage.clear(); } catch (e) {}
    try { navigator.serviceWorker.getRegistrations().then(a => a.forEach(x => x.unregister())); } catch (e) {}
    localStorage.setItem('tn_trips', JSON.stringify(list));
  }, trips);
  await page.reload({ waitUntil: 'load' });
  await sleep(1400);
  await page.evaluate(() => {
    window.__cap = [];
    window.__dl = [];
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) {
      const u = real(b);
      window.__cap.push({ url: u, mime: b && b.type, size: b && b.size, blob: b });
      return u;
    };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__dl.push({ name: String(this.download), href: String(this.href) });
      return realClick.apply(this, arguments);
    };
  });
  page.__amapReqs = amapReqs;
  return page;
}

/* 用产品自己的入口把行程开到结果页：已保存行程 → plannerOpenTrip（它会重走 renderResult，
   按钮行也是那一次渲染出来的，所以"入口在不在"量的就是产品那条渲染路径）。 */
async function toResult(page, i) {
  await page.evaluate(k => { window.plannerOpenTrip(k); }, i);
  await sleep(1200);
  return page.evaluate(() => ({
    stage: document.getElementById('stageResult').style.display,
    btns: Array.prototype.slice.call(document.querySelectorAll('#actRow button')).map(b => ({
      text: b.textContent.trim(), opacity: b.style.opacity, disabled: b.disabled, onclick: b.getAttribute('onclick'),
    })),
  }));
}

const clickBtn = (page, re) => page.evaluate(src => {
  const rx = new RegExp(src);
  const b = Array.prototype.slice.call(document.querySelectorAll('#actRow button')).filter(x => rx.test(x.textContent))[0];
  if (!b) return false;
  b.click();
  return true;
}, re.source);
/* 聚合所有 .ui-toast：结果页同时挂着 boot 那条「未配置高德 Key…」和本批的引导 toast，
 * 只读第一条量到的是队列顺序，不是产品判据。 */
const toastText = page => page.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('.ui-toast')).map(t => t.textContent).join(' ⫸ '));

/* ---------- 最小 ICS 校验器：只按 RFC 5545 的硬约束读字节 ----------
 * 为什么要自己写一个：日历 App 在手机上只会说「打不开」，不会说「第 13 行 78 字节」。
 * 长度一律按 UTF-8 字节算——String.prototype.length 在这里一律不算数。 */
function validateIcs(text) {
  const bad = [];
  const B = s => Buffer.byteLength(s, 'utf8');
  if (!text.endsWith('\r\n')) bad.push('末尾缺 CRLF');
  if (/\r(?!\n)/.test(text)) bad.push('出现裸 CR');
  if (text.replace(/\r\n/g, '').indexOf('\n') >= 0) bad.push('剥掉 CRLF 后仍有裸 LF（= 有行没用 CRLF 结束）');
  const lines = text.split('\r\n');
  lines.forEach((l, i) => { if (B(l) > 75) bad.push('第' + (i + 1) + '行 ' + B(l) + ' 字节 > 75：' + l.slice(0, 20)); });
  const raw = text.replace(/\r\n$/, '').split('\r\n');
  const logical = [];
  for (let i = 0; i < raw.length; i++) {
    let l = raw[i];
    while (i + 1 < raw.length && raw[i + 1][0] === ' ') { l += raw[i + 1].slice(1); i++; }
    logical.push(l);
  }
  if ((text.match(/BEGIN:VEVENT/g) || []).length !== (text.match(/END:VEVENT/g) || []).length)
    bad.push('VEVENT 不配对');
  if (logical[0] !== 'BEGIN:VCALENDAR') bad.push('首行不是 BEGIN:VCALENDAR：' + logical[0]);
  if (logical[logical.length - 1] !== 'END:VCALENDAR') bad.push('末行不是 END:VCALENDAR：' + logical[logical.length - 1]);
  const top = {};
  const evs = [];
  let cur = null;
  logical.forEach(l => {
    if (l === 'BEGIN:VEVENT') { cur = { __k: {} }; evs.push(cur); return; }
    if (l === 'END:VEVENT') { cur = null; return; }
    const ix = l.indexOf(':');
    if (ix < 0) { bad.push('有行没有冒号：' + l.slice(0, 20)); return; }
    const full = l.slice(0, ix), val = l.slice(ix + 1);
    if (cur) { cur.__k[full] = val; cur[full.split(';')[0]] = val; }
    else top[full] = val;
  });
  ['VERSION', 'PRODID', 'CALSCALE', 'METHOD'].forEach(k => {
    if (!(k in top)) bad.push('日历级缺 ' + k);
  });
  evs.forEach((e, i) => {
    ['UID', 'DTSTAMP', 'SUMMARY'].forEach(k => { if (!(k in e)) bad.push('第' + (i + 1) + '个事件缺 ' + k); });
    if (e.DTSTAMP && !/^\d{8}T\d{6}Z$/.test(e.DTSTAMP)) bad.push('第' + (i + 1) + '个事件 DTSTAMP 不是 YYYYMMDDTHHMMSSZ：' + e.DTSTAMP);
    if (!('DTSTART;VALUE=DATE' in e.__k)) bad.push('第' + (i + 1) + '个事件 DTSTART 不是全天事件的值形式（;VALUE=DATE）');
    if (!/^\d{8}$/.test(e.DTSTART || '')) bad.push('第' + (i + 1) + '个事件 DTSTART 值不是 8 位日期：' + e.DTSTART);
    if (!/^\d{8}$/.test(e.DTEND || '')) bad.push('第' + (i + 1) + '个事件 DTEND 值不是 8 位日期：' + e.DTEND);
  });
  const uids = evs.map(e => e.UID);
  if (new Set(uids).size !== uids.length) bad.push('UID 有重复：' + uids.join(','));
  const descOf = e => (e.DESCRIPTION || '');
  return { bad, evs, top, logical, lines, descOf };
}

function ymd(d) { const p = n => (n < 10 ? '0' : '') + n; return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); }
function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d).replace(/-/g, ''); }

(async () => {
  const { browser, server } = await boot();
  const TRIPS = [mkTrip(0), mkTrip(1), mkTrip(2)];
  let page = null, page1 = null, page2 = null, pageB = null, doc = null;
  try {
    /* ===== 一、有日期 + 含转日：整份 .ics 逐条校验 ===== */
    page = await openPlanner(browser, TRIPS);
    const r0 = await toResult(page, 0);
    const icsBtn = r0.btns.filter(b => /导出日历/.test(b.text))[0];
    ok('E1 结果页按钮行真有「导出日历」入口', !!icsBtn && icsBtn.onclick === 'window.plannerExportIcs()', JSON.stringify(r0.btns.map(b => b.text)));
    ok('E2 有出发日期时入口不置灰', !!icsBtn && icsBtn.opacity === '' && icsBtn.disabled === false, icsBtn && icsBtn.opacity);

    const clicked = await clickBtn(page, /导出日历/);
    await sleep(900);
    const cap = await page.evaluate(() => window.__cap.map(c => ({ mime: c.mime, size: c.size })));
    const dl = await page.evaluate(() => window.__dl.map(x => ({ name: x.name, head: x.href.slice(0, 24) })));
    const href0 = await page.evaluate(() => (window.__dl[0] || {}).href || '');
    ok('E3 点击后真走了一次导出通道（blob 被 createObjectURL 接住）', clicked && cap.length === 1, JSON.stringify(cap));
    ok('E4 MIME 是 text/calendar（导出物要能被日历认，不是硬编码 text/html）', cap[0] && cap[0].mime === 'text/calendar;charset=utf-8', cap[0] && cap[0].mime);
    ok('E5 文件名以 .ics 结尾且没有路径分隔符', dl.length === 1 && /\.ics$/.test(dl[0].name) && dl[0].name.indexOf('/') < 0, dl[0] && dl[0].name);
    ok('E6 生成日历全程零次高德请求（门票腿只吃种子）', page.__amapReqs.length === 0, 'restapi ' + page.__amapReqs.length + ' 次');

    const icsText = await page.evaluate(async () => {
      const c = window.__cap[0];
      return c ? await c.blob.text() : '';
    });
    fs.writeFileSync(path.join(OUT, 'trip-a.ics'), icsText, 'binary');
    const v = validateIcs(icsText);
    ok('V1 结构合法（CRLF / 每行 ≤75 字节 / 配对 / 缺字段 / UID 唯一）', v.bad.length === 0, v.bad.slice(0, 4).join(' ; '));
    ok('V2 事件数 = 1 条总览 + 3 条逐日', v.evs.length === 4, 'evs=' + v.evs.length);
    ok('V3 全天事件用日期值（DTSTART;VALUE=DATE:8 位，不带时区、无 VTIMEZONE）',
      v.evs.every(e => /^\d{8}$/.test(e.DTSTART) && 'DTSTART;VALUE=DATE' in e.__k) && icsText.indexOf('VTIMEZONE') < 0,
      v.evs.map(e => e.DTSTART).join(','));
    ok('V4 逐日 DTEND = 次日；总览 DTEND = 末日次日（各家日历对"含末"解释不一，钉成断言）',
      v.evs[0].DTEND === addDays('2026-10-20', 3) && v.evs[1].DTEND === addDays('2026-10-20', 1) &&
      v.evs[2].DTSTART === addDays('2026-10-20', 1) && v.evs[3].DTEND === addDays('2026-10-20', 3),
      v.evs.map(e => e.DTSTART + '→' + e.DTEND).join(' | '));
    ok('V5 逐日 SUMMARY 是「第N天 · 城市漫游 / A→B」',
      v.evs[1].SUMMARY === '第1天 · 太原漫游' && v.evs[2].SUMMARY === '第2天 · 太原→大同' && v.evs[3].SUMMARY === '第3天 · 大同漫游',
      [v.evs[1].SUMMARY, v.evs[2].SUMMARY, v.evs[3].SUMMARY].join(' | '));
    ok('V6 UID 形如 tripId[-dN]@lvyou-trace', v.evs[0].UID === 'p16a@lvyou-trace' && v.evs[1].UID === 'p16a-d0@lvyou-trace' && v.evs[3].UID === 'p16a-d2@lvyou-trace', v.evs.map(e => e.UID).join(','));
    ok('V7 站点名里的逗号与分号按 RFC 转义', /平遥古城\\, 含「；」测\\; 分号与逗号/.test(v.descOf(v.evs[1])), (v.descOf(v.evs[1]).match(/2\. 平遥[^\\\\]*/) || [''])[0].slice(0, 40));
    /* 期望不硬编码种子文案（那是数据，会随批次 15 的种子表漂移），改为向产品自己的门票模块现取一份
     * 晋祠，再用 RFC 5545 的转义规则独立重算一遍要出现在日历里的那段。这样「种子没汇进来」和
     * 「汇进来但逗号没转义」两种坏法都会红，而种子改字不会假红。 */
    const seedLit = await page.evaluate(() => new Promise(res => {
      try { SiteTickets.get({ name: '晋祠', label: '晋祠', lat: 37.72, lng: 112.56 }, t => res(t)); } catch (e) { res(null); }
    }));
    const seedEsc = seedLit ? String(seedLit.h).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,') : '';
    const l8 = v.descOf(v.evs[1]).split('\\n')[0];
    ok('V8 门票腿把种子的营业时间+票价+更新于汇进日历（且营业时间里的逗号按 RFC 转义）',
      !!seedLit && /^1\. 晋祠 · /.test(l8) && l8.indexOf(seedEsc) >= 0 && /公园免费/.test(l8) && / · 更新于 \d{4}-\d{2}$/.test(l8),
      (seedLit ? seedLit.h : '种子腿没返回') + ' ⇒ ' + l8);
    ok('V9 未收录景点（华严寺）只出名字，行内不出现「元」', v.descOf(v.evs[3]).split('\\n').filter(s => /华严寺/.test(s)).every(s => s.indexOf('元') < 0 && /2\. 华严寺$/.test(s)), v.descOf(v.evs[3]).split('\\n').join(' ⏎ '));
    ok('V10 LOCATION 取当天首站', v.evs[1].LOCATION === '晋祠' && v.evs[3].LOCATION === '云冈石窟', [v.evs[1].LOCATION, v.evs[3].LOCATION].join('|'));
    ok('V11 折行真发生了，且 unfolding（去掉 CRLF+一个空格）能逐字节还原',
      /\r\n /.test(icsText) && icsText.replace(/\r\n /g, '') === v.logical.join('\r\n') + '\r\n',
      'folded=' + (icsText.match(/\r\n /g) || []).length + ' logical=' + v.logical.length);

    /* ===== 二、空 startDate：不出事件、给引导、不静默 ===== */
    page1 = await openPlanner(browser, TRIPS);
    const r1 = await toResult(page1, 1);
    const btn1 = r1.btns.filter(b => /导出日历/.test(b.text))[0];
    ok('G1 没选日期时按钮置灰但没被 disabled 吃掉点击', !!btn1 && btn1.opacity !== '' && btn1.disabled === false && /要先/.test(btn1.text), JSON.stringify(btn1));
    const capBefore = await page1.evaluate(() => window.__cap.length);
    const toastBefore = await toastText(page1);
    await clickBtn(page1, /导出日历/);
    await sleep(700);
    const capAfter = await page1.evaluate(() => window.__cap.length);
    const toastAfter = await toastText(page1);
    ok('G2 点击后一个字节都没生成（绝不静默产出 1970 事件）', capAfter === capBefore, 'cap ' + capBefore + '→' + capAfter);
    ok('G3 toast 说要缺什么（引导去选出发日期，且不是原本就在的 toast）', /出发日期/.test(toastAfter) && !/出发日期/.test(toastBefore), toastAfter);
    await page1.close();

    /* ===== 三、单日 + 名字含 emoji：代理对不许被折行劈开 ===== */
    page2 = await openPlanner(browser, TRIPS);
    await toResult(page2, 2);
    await clickBtn(page2, /导出日历/);
    await sleep(800);
    const ics2 = await page2.evaluate(async () => {
      const c = window.__cap[window.__cap.length - 1];
      return c ? await c.blob.text() : '';
    });
    fs.writeFileSync(path.join(OUT, 'trip-c.ics'), ics2, 'binary');
    const v2 = validateIcs(ics2);
    ok('V12 单日行程结构同样合法', v2.bad.length === 0, v2.bad.slice(0, 3).join(' ; '));
    ok('V13 名字里的 emoji 😀 原样在 SUMMARY 里（没出现 U+FFFD 替换符）', /😀/.test(v2.logical.join('')) && ics2.indexOf('\uFFFD') < 0, (v2.evs[0] && v2.evs[0].SUMMARY) || '');
    ok('V14 无叙事（narrative:null）时总览事件仍在且描述齐', v2.evs.length === 2 && /第1天/.test(v2.descOf(v2.evs[0])), 'evs=' + v2.evs.length);
    await page2.close();

    /* ===== 四、打印友好路书：导出 HTML 在 print 介质下的计算样式 ===== */
    pageB = await openPlanner(browser, TRIPS);
    await toResult(pageB, 0);
    await clickBtn(pageB, /导出路书/);
    await sleep(900);
    const book = await pageB.evaluate(() => {
      const h = (window.__dl.filter(x => /\.html$/.test(x.name))[0] || {}).href || '';
      return h.indexOf('data:') === 0 ? decodeURIComponent(h.replace(/^data:[^,]*,/, '')) : '';
    });
    ok('P1 路书 HTML 真从下载通道出来（data: URL 解得开，日卡包了 .daycard）', book.length > 400 && (book.match(/class="daycard"/g) || []).length === 3, 'len=' + book.length);
    fs.writeFileSync(path.join(OUT, 'book.html'), book, 'utf8');
    doc = await browser.newPage();
    await doc.setContent(book);
    const screen = await doc.evaluate(() => {
      const h2 = document.querySelector('h2');
      return { dayN: document.querySelectorAll('.daycard').length, h2: getComputedStyle(h2).fontSize, body: getComputedStyle(document.body).backgroundColor };
    });
    ok('P2 屏幕态：一天一包，盒数 = 天数', screen.dayN === 3, JSON.stringify(screen));
    ok('P3 屏幕态：h2 字号是写死的 17px（独立文档里 var(--fs-8) 从来不解析，这条才有意义）', screen.h2 === '17px', screen.h2);
    const cssom = await doc.evaluate(() => {
      const out = { page: null, media: [] };
      try {
        Array.prototype.forEach.call(document.styleSheets[0].cssRules, r => {
          const cn = r.constructor.name;
          if (cn === 'CSSPageRule') out.page = { margin: r.style.margin, sides: [r.style.marginTop, r.style.marginRight, r.style.marginBottom, r.style.marginLeft].join(' ') };
          if (cn === 'CSSMediaRule') Array.prototype.forEach.call(r.cssRules, mr => out.media.push({ cond: r.conditionText, sel: mr.selectorText || '', brk: (mr.style && (mr.style.breakInside || mr.style.getPropertyValue('break-inside'))) || '' }));
        });
      } catch (e) { out.err = String(e.message); }
      return out;
    });
    ok('P4 @page 的 14mm 边距真进了 CSSOM（不是只写在字符串里）', !!cssom.page && /14mm/.test((cssom.page.margin || '') + ' ' + (cssom.page.sides || '')), JSON.stringify(cssom.page || cssom.err || ''));
    ok('P5 @media print 块里的 .daycard 规则真被解析（打印样式没漏到 media 外面）', cssom.media.some(m => /\.daycard/.test(m.sel) && /print/.test(m.cond)), JSON.stringify(cssom.media.map(m => m.sel).slice(0, 8)));
    await doc.emulateMediaType('print');
    const pr = await doc.evaluate(() => {
      const d = document.querySelector('.daycard'), h2 = document.querySelector('h2'), b = document.body;
      const cs = getComputedStyle(d);
      return { brk: cs.breakInside || cs.getPropertyValue('break-inside') || cs.pageBreakInside,
        body: getComputedStyle(b).backgroundColor, h2border: getComputedStyle(h2).borderLeftColor, h2size: getComputedStyle(h2).fontSize };
    });
    ok('P6 打印态：日卡 break-inside 计算值 = avoid（分页锚点真生效，不是 auto）', pr.brk === 'avoid', JSON.stringify(pr));
    ok('P7 打印态：屏幕那层米白纸底退回纯白（纸上不铺底色，模糊与投影一类屏幕态装饰同理关掉）', pr.body === 'rgb(255, 255, 255)', pr.body);
    ok('P8 打印态：h2 题签描边退回黑（打印不许靠颜色承载信息）', pr.h2border === 'rgb(0, 0, 0)', pr.h2border);
    ok('P9 打印态：字号换成固定 pt（不吃手机「加大字号」档位），与屏幕态不同', /px$/.test(pr.h2size) && pr.h2size !== screen.h2, screen.h2 + ' → ' + pr.h2size);
    await doc.close(); doc = null;
    await pageB.close(); pageB = null;
    await page.close(); page = null;
  } catch (e) {
    ok('EXCEPTION', false, e.message + ' | ' + String(e.stack || '').slice(0, 240));
  } finally {
    /* 每条腿各自 close()；这里只兜没被关掉的（重复 close 会抛 ProtocolError，把报告一起吃掉——
       上一轮就是这么没有输出直接 exit 1 的）。close 一律包 try，报告必须出得来。 */
    for (const p of [page, page1, page2, pageB, doc]) { try { if (p) await p.close(); } catch (e) {} }
    try { await browser.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
  }

  const pass = checks.filter(c => c.pass).length;
  checks.forEach(c => console.log((c.pass ? 'PASS ' : 'FAIL ') + c.id + (c.detail ? '  [' + c.detail + ']' : '')));
  console.log('smoke-export: ' + pass + ' PASS / ' + (checks.length - pass) + ' FAIL（共 ' + checks.length + ' 条）');
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ checks, pass, at: new Date().toISOString() }, null, 2));
  process.exit(pass === checks.length ? 0 : 1);
})();
