/* tools/smoke-share.js — 批次 9（P1-5 只读行程分享）行为验证
 * 用法：NODE_PATH=<repo>/tools/node_modules node tools/smoke-share.js
 * 自己起 127.0.0.1:PORT 的静态服务，puppeteer 开无痕上下文加载 share.html#<载荷>，验四件事：
 *   ① 编码往返：脏行程（带照片/备注/Key）出去的内容只剩白名单字段；
 *   ② 渲染一致：页面上的日数/站数/逐日里程与源行程逐字相等；
 *   ③ 断网可读：拦掉全部 http(s) 请求后站点列表仍然完整；
 *   ④ 降级诚实：>7000 字符不出链接、无基址出文本、坏载荷/空载荷各有一句实话。
 * 截图入 tools/out/shots/<日期>-b9-share/，报告写 tools/out/share-smoke-report.json。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const vm = require('vm');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8133', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const _d = new Date();
const OUT = path.join(__dirname, 'out', 'shots',
  [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-') + '-b9-share');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const REPORT = path.join(__dirname, 'out', 'share-smoke-report.json');

let pass = 0, fail = 0;
const checks = [];
function ok(name, cond, detail) {
  if (cond) { pass++; checks.push({ name, ok: true, detail: detail === undefined ? '' : String(detail) }); }
  else { fail++; checks.push({ name, ok: false, detail: detail === undefined ? '' : String(detail) }); console.log('FAIL ' + name + (detail === undefined ? '' : ' → ' + detail)); }
}

/* ---------- 行程夹具：站点上挂着绝不该出现在链接里的东西 ---------- */
function fixture() {
  const spots = [
    ['五台山', 39.0812, 113.5518], ['平遥古城', 37.2050, 112.1830], ['乔家大院', 37.4612, 112.0351],
    ['太原晋祠', 37.7215, 112.1450], ['壶口瀑布', 36.1420, 110.4410], ['西安城墙', 34.2710, 108.9410],
    ['兵马俑', 34.3840, 109.2780], ['华山', 34.4810, 110.0910], ['龙门石窟', 34.5580, 112.4670],
    ['少林寺', 34.5080, 112.9330], ['清明上河园', 34.7930, 114.3510], ['商丘古城', 34.4120, 115.6210]
  ];
  const plan = [[0, 3], [3, 5], [5, 7], [7, 9], [9, 12]];
  const days = plan.map((rg, i) => ({
    driveKm: 47.5 + i * 23, totalH: 6.5 + i,
    stops: spots.slice(rg[0], rg[1]).map(s => ({
      name: s[0], lat: s[1], lng: s[2],
      photo: 'data:image/jpeg;base64,' + 'AAAA'.repeat(40),
      note: '只有本机可见的私密备注' + s[0],
      audio: 'indexeddb:gujian-notes/' + s[0]
    }))
  }));
  return {
    name: '晋陕豫 5 日自驾', startDate: '2026-10-20',
    start: { name: '北京', lat: 39.9042, lng: 116.4074 },
    end: { name: '北京', lat: 39.9042, lng: 116.4074, isLoop: true },
    dist: { 'k1': 1 },
    narrative: { story: '这段游记正文绝不能出现在别人的浏览器里' },
    aiKeyRef: 'tn_key_deepseek',
    days
  };
}

/* ---------- 在沙箱里跑 share.js（与浏览器同一份源码，同一份 vendor/pako） ---------- */
function loadShare(loc) {
  const store = {};
  const win = {};
  const ctx = vm.createContext({
    window: win, console, JSON, Math, Number, String, Array, Object, isFinite, parseInt, RegExp, Error, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    encodeURIComponent, decodeURIComponent,
    location: loc || { protocol: 'http:', pathname: '/share.html', origin: BASE },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  });
  win.pako = require(path.join(ROOT, 'vendor', 'pako.min.js'));
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'share.js'), 'utf8'), ctx, { filename: 'share.js' });
  return { Share: win.Share, store };
}

const MIME = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}

function errors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    /* 拦请求那一轮里瓦片的 net::ERR_* 是预期的，不算页面报错 */
    if (/net::ERR|Failed to load resource/.test(t)) return;
    errs.push('console: ' + t);
  });
  return errs;
}

async function open(browser, url, opts) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = errors(page);
  await page.setViewport({ width: 375, height: 720 });
  if (opts && opts.offline) {
    await page.setRequestInterception(true);
    page.on('request', r => (/^https?:/.test(r.url()) && r.url().indexOf(BASE) !== 0) ? r.abort() : r.continue());
    await page.evaluateOnNewDocument(u => {
      const of = window.fetch;
      window.fetch = function (x) { return /^https?:/.test(String(typeof x === 'string' ? x : (x && x.url))) && String(typeof x === 'string' ? x : (x && x.url)).indexOf(u) !== 0 ? Promise.reject(new Error('offline')) : of.apply(this, arguments); };
    }, BASE);
  }
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
  return { ctx, page, errs };
}

const readDom = () => {
  const q = s => document.querySelectorAll(s);
  return {
    cards: [].map.call(q('.day-card'), c => ({
      seal: (c.querySelector('.day-seal') || {}).textContent,
      ds: (c.querySelector('.day-seal') || {}).className,
      meta: (c.querySelector('.dmeta') || {}).textContent,
      stops: [].map.call(c.querySelectorAll('.stop .lbl'), e => e.textContent),
      nums: [].map.call(c.querySelectorAll('.stop .n'), e => e.textContent)
    })),
    title: (document.querySelector('.hero h1') || {}).textContent,
    chips: [].map.call(q('.hero .chips span'), e => e.textContent),
    ruler: (document.querySelector('.ruler') || {}).textContent,
    route: (document.querySelector('.hero .route') || {}).textContent,
    pins: q('.map-pin').length,
    bad: (document.querySelector('.bad-state b') || {}).textContent,
    art: q('.empty-art').length,
    vtitle: q('.vtitle').length,
    sbar: (document.querySelector('.sbar b') || {}).textContent,
    copyBtn: !!document.querySelector('[onclick="window.shareCopyText()"]'),
    taVisible: (document.getElementById('shareText') || { style: { display: 'none' } }).style.display,
    body: document.body.innerText
  };
};

(async () => {
  const server = await serve();
  const { Share } = loadShare();

  /* ===== ① 出包前的隐私闸 ===== */
  const trip = fixture();
  Share.setBase(BASE + '/');
  const built = Share.build(trip);
  ok('有基址时产出链接', built.ok === true, built.url && built.url.slice(0, 40));
  ok('链接长度在上限内', built.chars > 0 && built.chars <= Share.URL_LIMIT, built.chars);
  const hash = built.url.split('#')[1];
  ['photo', 'note', 'audio', 'story', 'AAAA', 'tn_key', 'indexeddb', '私密备注', '游记正文']
    .forEach(w => ok('链接不含「' + w + '」', decodeURIComponent(built.url).indexOf(w) < 0 && built.text.indexOf(w) < 0));
  const rt = Share.decodePayload(hash);
  ok('解码回得到 5 天', rt && rt.days.length === 5);
  ok('解码回得到 12 站', rt && Share.summary(rt).stops === 12);
  ok('解码后逐日里程一致', rt && rt.days.map(d => d.km).join(',') === trip.days.map(d => Math.round(d.driveKm)).join(','), rt && rt.days.map(d => d.km).join(','));
  ok('解码后尺子标注为真实道路', rt && rt.r === 1);
  ok('环线标注', rt && rt.loop === true);
  ok('白名单外字段为空', rt && Share.strayKeys(rt).length === 0);

  /* 超长：造一份压不动的行程，必须拒绝出链接而不是发一条会被截断的 */
  const huge = JSON.parse(JSON.stringify(trip));
  huge.days = [];
  for (let i = 0; i < 30; i++) {
    const st = [];
    for (let j = 0; j < 15; j++) {
      const seed = (i * 131 + j * 7919) % 1000003;
      st.push({ name: '景点' + seed.toString(36) + '·' + ((seed * 31) % 9973).toString(36) + '台', lat: 20 + seed % 7000 / 1000, lng: 100 + seed % 9000 / 1000 });
    }
    huge.days.push({ driveKm: 20 + i, totalH: 6, stops: st });
  }
  const hb = Share.build(huge);
  ok('超长行程拒绝出链接', hb.ok === false && hb.degrade === 'too-long' && !hb.url, hb.chars);
  ok('超长行程仍给文本版', !!hb.text && hb.text.length > 100);

  /* 无基址（本机 file:// 的现实）：给文本，不给一条对方打不开的假链接 */
  const local = loadShare({ protocol: 'file:', pathname: '/storage/emulated/0/planner.html', origin: 'null' });
  const lb = local.Share.build(trip);
  ok('file:// 无基址时降级', lb.ok === false && lb.degrade === 'no-base' && !lb.url);
  ok('降级文本带署名', /由 行迹 TRACE 生成/.test(lb.text));
  const est = JSON.parse(JSON.stringify(trip)); est.dist = {};
  ok('估算里程在文本里说清是折算', /折算/.test(Share.textOf(Share.payloadOf(est))));

  /* ===== 浏览器侧 ===== */
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const url = BASE + '/share.html#' + hash;

  const online = await open(browser, url, {});
  const d1 = await online.page.evaluate(readDom);
  ok('联网态无页面报错', online.errs.length === 0, online.errs.join(' | '));
  ok('渲染 5 张日卡', d1.cards.length === 5, d1.cards.length);
  ok('渲染 12 站', d1.cards.reduce((n, c) => n + c.stops.length, 0) === 12);
  ok('标题一致', d1.title === trip.name, d1.title);
  ok('起讫与环线标注', /北京/.test(d1.route) && /环线/.test(d1.route), d1.route);
  ok('汇总芯片天数', d1.chips.join(' ').indexOf('共 5 天') >= 0, d1.chips.join(' | '));
  ok('汇总芯片站数', d1.chips.join(' ').indexOf('12 站') >= 0, d1.chips.join(' | '));
  ok('尺子说明为真实道路', /真实道路/.test(d1.ruler), d1.ruler);
  d1.cards.forEach((c, i) => {
    ok('D' + (i + 1) + ' 里程与源行程相等', c.meta.indexOf('约 ' + Math.round(trip.days[i].driveKm) + ' km') >= 0, c.meta);
    ok('D' + (i + 1) + ' 站点名逐个相等', c.stops.join(',') === trip.days[i].stops.map(s => s.name).join(','), c.stops.join(','));
    ok('D' + (i + 1) + ' 蜡封章走 ds-' + (i % 6 + 1), c.ds === 'day-seal ds-' + (i % 6 + 1) && c.seal === 'D' + (i + 1), c.ds + '/' + c.seal);
  });
  ok('地图立针数=站点数', d1.pins === 12, d1.pins);
  ok('品牌条在页首', d1.sbar === '行迹');
  ok('卷首竖排题签', d1.vtitle === 1);
  ok('复制按钮有实现', d1.copyBtn === true);
  /* 320 档（最小在售机 CSS 宽度）：不许出现横向溢出 */
  await online.page.setViewport({ width: 320, height: 700 });
  await new Promise(r => setTimeout(r, 250));
  const narrow = await online.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok('320 宽无横向溢出', narrow.sw <= narrow.cw + 1, JSON.stringify(narrow));
  /* 只查"行程内容"那部分：页脚的隐私说明本来就会写「不含游记正文」这类字样 */
  const rendered = d1.cards.map(c => c.stops.join(',')).join('|') + d1.title + d1.route + d1.ruler + d1.chips.join('');
  ok('渲染出的行程内容里没有私密字段', ['私密备注', 'data:image', 'AAAA', '游记正文'].every(w => rendered.indexOf(w) < 0), rendered.slice(0, 60));
  await online.page.screenshot({ path: path.join(OUT, 'share-online.png'), fullPage: false });

  /* 把剪贴板钉成"必被拒"：127.0.0.1 是安全上下文，成功分支在 CI 里反而是随机的，
     而真机 WebView 恰恰经常拒——被测的必须是这条兜底路径。 */
  await online.page.evaluate(() => {
    try { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('blocked')), configurable: true }); } catch (e) {}
  });
  await online.page.click('[onclick="window.shareCopyText()"]');
  await new Promise(r => setTimeout(r, 400));
  const afterCopy = await online.page.evaluate(() => {
    const ta = document.getElementById('shareText');
    return { visible: ta.style.display, len: (ta.value || '').length, text: (ta.value || '').slice(0, 4000), toast: (document.querySelector('.ui-toast') || {}).textContent || '' };
  });
  ok('剪贴板被拒时展开可见文字版', afterCopy.visible === 'block' && afterCopy.len > 80, JSON.stringify({ visible: afterCopy.visible, len: afterCopy.len }));
  ok('展开时告知怎么复制', /长按|全选/.test(afterCopy.toast), afterCopy.toast);
  ok('文字版里没有私密字段', ['私密备注', 'data:image', 'AAAA'].every(w => afterCopy.text.indexOf(w) < 0));
  ok('文字版逐日站点齐全', afterCopy.text.split('\n').filter(l => /^\s+\d+\./.test(l)).length === 12,
    afterCopy.text.split('\n').filter(l => /^\s+\d+\./.test(l)).length);

  const offline = await open(browser, url, { offline: true });
  const d2 = await offline.page.evaluate(readDom);
  ok('断网态无页面报错', offline.errs.length === 0, offline.errs.join(' | '));
  ok('断网仍渲染 5 天 12 站', d2.cards.length === 5 && d2.cards.reduce((n, c) => n + c.stops.length, 0) === 12, d2.cards.length);
  ok('断网日卡里程不变', d2.cards.map(c => c.meta).join('|') === d1.cards.map(c => c.meta).join('|'));
  ok('断网有地图失败的实话', /联网|断网|示意/.test(d2.body), '');
  await offline.page.screenshot({ path: path.join(OUT, 'share-offline.png') });

  const noHash = await open(browser, BASE + '/share.html', {});
  const d3 = await noHash.page.evaluate(readDom);
  ok('空载荷不报错', noHash.errs.length === 0, noHash.errs.join(' | '));
  ok('空载荷有一句实话', /没有带上行程/.test(d3.bad || ''), d3.bad);
  ok('空载荷用内联线稿', d3.art === 1);
  await noHash.page.screenshot({ path: path.join(OUT, 'share-nohash.png') });
  await noHash.ctx.close();

  const broken = await open(browser, BASE + '/share.html#v1.' + hash.slice(0, Math.floor(hash.length / 2)), {});
  const d4 = await broken.page.evaluate(readDom);
  ok('截断载荷不报错', broken.errs.length === 0, broken.errs.join(' | '));
  ok('截断载荷说明被截断', /读不出来|截断/.test(d4.bad || ''), d4.bad);
  await broken.page.screenshot({ path: path.join(OUT, 'share-truncated.png') });

  await online.ctx.close(); await offline.ctx.close(); await broken.ctx.close();
  await browser.close();

  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), pass, fail, checks }, null, 2));
  console.log('分享冒烟: 通过 ' + pass + ' · 失败 ' + fail + '（报告 tools/out/share-smoke-report.json）');
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + e.stack); process.exit(2); });
