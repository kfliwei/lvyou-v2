/* tools/smoke-font.js — 批次 35-B「字体族三档 + 出图锁字库」浏览器闸门
 *
 * 用户点单（逐字）：「全面审核 项目的功能和UI视觉的完整性、实用性和操作便利性」→ 审核报告 §4 第 5 条
 * 「全站硬写桌面字体名，手机上一种都不命中」。批次 35-A 实测的两把尺子在这一节里必须一起在场：
 *   ① 泄漏那一条：travel-notes.js 的注入串在 :root 上重声明 17 枚与 design.css 同名的令牌，后来者胜 ⇒
 *      面板一出现就把全站那 17 枚换成面板的米白皮。本批改名成 --tnp-* 私有名 + 摘 design.css 别名一族。
 *      口径要说清：35-A 的像素腿实测「补上那一枚 <style> 前后 pixelmatch 差 0 个像素」——泄漏在令牌层是真的，
 *      当场没有承重元素吃到它。所以这一节守的是**结构**（同名覆盖不许回潮），不是修好了一次视觉事故；
 *      把 0 像素说成「用户看到了米白皮」就是谎报战果。
 *   ② canvas 那一条：ctx.font 只认字面族名（写 var(--font-*) 是无效值 → 整条 font 被丢 → 落 UA 默认），
 *      而 font-display 管不到 canvas：字库没就位就把兜底字**永久烤进 PNG**。35-A 实测两团墨 3425／2689。
 *      所以出图口动笔前必须 await document.fonts.load()，见 ui.js fontsReady()。
 *
 * 为什么只能由浏览器腿守：源码腿（§51）能数「② 档每一行含 TRACE Serif」「③ 档点名表还在」，
 *   但它看不见「同名令牌在 :root 上谁胜」「字库没 load 时画出来的是兜底字」「保险丝把出图整个吃掉」。
 *   最后一条尤其反直觉：把 fontsReady 改成永不 resolve，屏上不会报错，只会「点了没反应」——
 *   那是新增的一种静默失效，源码腿读不出来，只能真点一次并数 fillText 到底发生没发生。
 *
 * 页内三把刀（__TOK／__INK／__HOOK）必须先 evaluate 装进页面、再在页面里按 window.__x 调用：
 *   puppeteer 只把**第一个**函数参数序列化进页面，嵌套参数里的函数不会被还原
 *   （第一版就是这么写的，落到页面里是 `{}`，整腿红成 `TypeError: T is not a function`）。
 *   每次导航都要重装一次（新文档，旧挂载点跟着没了）。
 *
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-font.js
 * 名字前缀 FO（font）。视口 328x723（§37 真机档）。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PANEL_BG = '#f6f1e5';   /* 注入串 --tnp-bg 的真值（批次 35-B 只改名字，值一个字没动） */

let checks = 0, fails = 0;
const lines = [];
function ok(name, cond, extra) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']');
  console.log(s); lines.push(s);
  if (!cond) fails++;
}

/* 三篇带位置的游记：轨迹卡要 ≥2 个节点、海报要 ≥1 个 pts、分享卡要正文非空 */
const SEED = () => {
  const long = '那天的风很大，古城墙的影子在地上拉得很长。我在墙下站了很久，数城楼的斗拱，一层一层数不清。';
  const now = Date.now();
  const mk = o => Object.assign({
    province: '山西', city: '大同', county: '平城区', photos: [], audio: '', tags: ['古城'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ id: 'fontA', title: '大同古城', siteName: '大同古城', lat: 39.5606, lng: 114.0862, ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long }),
    mk({ id: 'fontB', title: '华严寺', siteName: '华严寺', lat: 39.5636, lng: 114.0779, ts: now - 2 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '薄伽教藏殿里的辽代彩塑，站着看了很久。', raw: '薄伽教藏殿里的辽代彩塑，站着看了很久。' }),
    mk({ id: 'fontC', title: '悬空寺', siteName: '悬空寺', lat: 39.6605, lng: 113.7086, ts: now + 24 * 3600e3, date: '2026-10-03 11:00', day: '2026-10-03', text: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', raw: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。' }),
  ];
  return new Promise((res, rej) => {
    const rq = indexedDB.open('gujian-notes', 1);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        const st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    rq.onsuccess = () => {
      const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
      os.clear(); list.forEach(r => os.put(r));
      tx.oncomplete = () => { db.close(); res(list.length); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    rq.onerror = () => rej(rq.error);
  });
};

/* 装进页面那一侧的三把刀（一次 evaluate，返回三件都在场的回执） */
const INSTALL = () => {
  window.__TOK = function (names) {
    var cs = getComputedStyle(document.documentElement), o = {};
    names.forEach(function (n) { o[n] = (cs.getPropertyValue(n) || '').trim(); });
    return o;
  };
  window.__INK = function (font) {
    var c = document.createElement('canvas'); c.width = 560; c.height = 120;
    var g = c.getContext('2d');
    g.font = font; g.fillStyle = '#000'; g.textBaseline = 'top';
    g.fillText('行迹山海 2026', 6, 8);
    var d = g.getImageData(0, 0, 560, 120).data, n = 0;
    for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  };
  window.__HOOK = function (reset) {
    if (!window.__foHooked) {
      var proto = CanvasRenderingContext2D.prototype, orig = proto.fillText;
      window.__foCap = [];
      proto.fillText = function (t, x, y, mw) {
        window.__foCap.push({ font: this.font, text: String(t).slice(0, 20) });
        return orig.call(this, t, x, y, mw);
      };
      window.__foHooked = 1;
      window.__foRealFontsReady = window.UI && window.UI.fontsReady;
    }
    if (reset) window.__foCap = [];
    return window.__foCap.length;
  };
  /* 自校准：__INK 这把尺子必须能量出差别——同一串字，两种族名读回来的墨量不同才算它在量字，不在量噪声 */
  var a = window.__INK('400 64px monospace'), b = window.__INK('400 64px cursive,monospace');
  return { three: typeof window.__TOK === 'function' && typeof window.__INK === 'function' && typeof window.__HOOK === 'function', inkDiff: a !== b, a: a, b: b };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  const ALIAS17 = ['--fd', '--fb', '--b6', '--b7', '--b9', '--a3', '--d3', '--bg', '--sf', '--sf2', '--ln', '--i9', '--i7', '--i5', '--sm', '--tf', '--tn'];
  if (ALIAS17.length !== 17) { console.log('✗ 名单自己缩水：' + ALIAS17.length + ' 枚／期望 17（名单短了，下面那个「0 枚」就是空断言）'); process.exit(2); }

  /* ============ 一 泄漏收口（travel-map.html：宿主页与面板同一屏） ============ */
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_dark', 'light'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  const INST = await page.evaluate(INSTALL);
  await sleep(1800);
  lines.push('=== smoke-font · 视口 ' + VW + 'x' + VH + ' · 播种 3 篇（都有坐标）· 强制 light 档 ===');
  ok('FO00 页内三把刀在场且 __INK 有牙（两种族名量出两团不同的墨）', INST.three && INST.inkDiff,
    '三把=' + INST.three + ' monospace=' + INST.a + ' cursive=' + INST.b);

  const PRE = await page.evaluate(names => {
    return {
      tok: window.__TOK(names.concat(['--color-bg'])),
      inject: /--tnp-fd/.test(Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('')),
      styles: document.querySelectorAll('style').length,
      dark: document.documentElement.classList.contains('theme-dark'),
    };
  }, ALIAS17);
  ok('FO01 注入串不在场时，宿主的 --bg 与 design.css 自己的 --color-bg 同值',
    PRE.tok['--bg'].toUpperCase() === PRE.tok['--color-bg'].toUpperCase() && PRE.inject === false,
    '--bg=' + PRE.tok['--bg'] + ' --color-bg=' + PRE.tok['--color-bg'] + ' 注入串在场=' + PRE.inject + ' 暗色档=' + PRE.dark + ' <style>数=' + PRE.styles);

  await page.evaluate(() => { window.TravelNotes.ensureUI(); });
  await sleep(400);
  const POST = await page.evaluate(names => {
    const t = window.__TOK(names.concat(['--tnp-bg', '--color-bg']));
    let cream = 0, sample = '';
    document.querySelectorAll('*').forEach(function (el) {
      if (getComputedStyle(el).backgroundColor.replace(/\s/g, '') === 'rgb(246,241,229)') {
        cream++; if (!sample) sample = String(el.id || el.className || el.tagName).slice(0, 40);
      }
    });
    return {
      tok: t, cream: cream, sample: sample,
      leaked: names.filter(n => n !== '--bg' && (t[n] || '').trim() !== ''),
      styles: document.querySelectorAll('style').length,
      inject: /--tnp-fd/.test(Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('')),
    };
  }, ALIAS17);
  ok('FO02 面板 CSS 注入后（注入串确实在场），宿主的 --bg 仍与 --color-bg 同值——改前这一枚会被换成 ' + PANEL_BG,
    POST.tok['--bg'].toUpperCase() === POST.tok['--color-bg'].toUpperCase() && POST.inject === true,
    '--bg=' + POST.tok['--bg'] + ' --color-bg=' + POST.tok['--color-bg'] + ' 注入串在场=' + POST.inject + ' <style>数=' + POST.styles);
  ok('FO03 面板自己的私名还在（--tnp-bg 落回 ' + PANEL_BG + '），改名没把面板的皮一起改掉',
    POST.tok['--tnp-bg'].toLowerCase() === PANEL_BG, '--tnp-bg=' + POST.tok['--tnp-bg']);
  ok('FO04 屏上确实有元素按私名解析出那层米白皮（不是只有声明在、没人吃）',
    POST.cream > 0, '吃到 var(--tnp-bg) 的元素=' + POST.cream + ' 个，首个=' + POST.sample);
  ok('FO05 那 16 枚旧名在 :root 计算值上全为空（design.css 别名块摘了，注入串也不再声明它们）',
    POST.leaked.length === 0, '仍非空：' + (POST.leaked.map(n => n + '=' + POST.tok[n]).join(' ') || '(无)'));

  /* 反向对照：上面那三条「同值／归零」必须由能把它们翻过来的那一发代证 */
  const REV = await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'fo-rev'; s.textContent = ':root{--bg:#f6f1e5;--fd:"Kaiti SC",serif}';
    document.head.appendChild(s);
    const h = window.__TOK(['--bg', '--fd']);
    s.remove();
    return { bg: h['--bg'], fd: h['--fd'], after: window.__TOK(['--bg', '--fd']) };
  });
  ok('FO06 反向对照：现场补一条同名 :root 覆盖，--bg 立刻翻成面板纸色、--fd 立刻非空（上面那两个读数不是尺子读空）',
    REV.bg.toLowerCase() === PANEL_BG && REV.fd.indexOf('Kaiti') >= 0 && REV.after['--fd'] === '',
    '注入后 --bg=' + REV.bg + ' --fd=' + REV.fd + ' ／ 摘掉后 --bg=' + REV.after['--bg'] + ' --fd="' + REV.after['--fd'] + '"');

  const DARK = await page.evaluate(() => {
    document.documentElement.classList.add('theme-dark');
    const t = window.__TOK(['--bg', '--tnp-bg', '--color-bg']);
    document.documentElement.classList.remove('theme-dark');
    return t;
  });
  ok('FO07 暗色档那一支跟着改名一起活下来了（:root.theme-dark 里 --tnp-bg 仍让位给 --color-bg）',
    DARK['--tnp-bg'] === DARK['--color-bg'] && DARK['--bg'] === DARK['--color-bg'],
    '--bg=' + DARK['--bg'] + ' --tnp-bg=' + DARK['--tnp-bg'] + ' --color-bg=' + DARK['--color-bg']);

  /* ============ 二 出图字库（canvas 只认字面族名；兜底字会被永久烤进 PNG） ============ */
  const FR = await page.evaluate(() => {
    return window.UI.fontsReady().then(function (v) {
      return {
        ready: v, check: document.fonts.check('400 64px "TRACE Serif"'),
        brand: window.__INK('400 64px "TRACE Serif",serif'), again: window.__INK('400 64px "TRACE Serif",serif'),
        fb: window.__INK('400 64px serif'), bad: window.__INK('400 64px var(--font-serif)'),
        ua: window.__INK('10px sans-serif'),
      };
    });
  });
  ok('FO08 UI.fontsReady() 是单点、返回 Promise 且这一发 resolve 成「字库可用」', FR.ready === true, 'ready=' + FR.ready);
  ok('FO09 内嵌字库在 canvas 侧确实命中（document.fonts.check 认那枚字面族名）', FR.check === true, 'check=' + FR.check);
  ok('FO10 品牌族与兜底族是两团不同的墨（35-A 实测 3425／2689，同一串字）',
    FR.brand > 0 && FR.fb > 0 && FR.brand !== FR.fb, 'brand=' + FR.brand + ' fallback=' + FR.fb);
  ok('FO11 墨量这把尺子自校准：同一族连量两次读数相同（否则 FO10 那个「不等」是噪声）',
    FR.brand === FR.again, '两次=' + FR.brand + '/' + FR.again);
  ok('FO12 ctx.font 写 var(--font-serif) 时整条 font 被丢（连 64px 一起丢），落回 UA 默认那一档——②档为什么不许用令牌，这条就是现场证据',
    FR.bad === FR.ua && FR.bad !== FR.fb && FR.bad !== FR.brand,
    'var()=' + FR.bad + ' UA默认(10px sans-serif)=' + FR.ua + ' 兜底64px=' + FR.fb);

  const TRACK = await page.evaluate(() => {
    window.__HOOK(true);
    renderTrack('ink');
    return new Promise(r => setTimeout(() => r(window.__foCap.slice()), 900));
  });
  const trackBrand = TRACK.filter(c => /TRACE Serif/.test(c.font)).length;
  ok('FO13 轨迹卡真动笔时每一笔的 ctx.font 都写着字面品牌族（源码腿数的是行，这里数的是落笔）',
    TRACK.length > 0 && trackBrand === TRACK.length,
    '落笔=' + TRACK.length + ' 含 TRACE Serif=' + trackBrand + ' 首笔=' + (TRACK[0] ? TRACK[0].font : '(没落笔)'));

  const GATE = await page.evaluate(() => {
    window.UI.fontsReady = () => new Promise(function () {});   // 永不落定：字库那一路卡住
    window.__HOOK(true);
    renderTrack('ink');
    return new Promise(r => setTimeout(() => r(window.__foCap.length), 400));
  });
  ok('FO14 出图口真的排在字库后面：fontsReady 永不落定时一笔都没画（这一发同时反证「闸门装了」）',
    GATE === 0, '400ms 内落笔=' + GATE);

  const GATE2 = await page.evaluate(() => {
    window.UI.fontsReady = () => Promise.reject(new Error('no font'));   // 读不到字库：照样放行
    window.__HOOK(true);
    renderTrack('ink');
    return new Promise(r => setTimeout(() => {
      window.UI.fontsReady = window.__foRealFontsReady;
      r(window.__foCap.length);
    }, 900));
  });
  ok('FO15 读不到字库时不许把出图整个吃掉：reject 那一支照样动笔（出一张兜底字的图，比点下去没反应好）',
    GATE2 > 0, 'reject 档落笔=' + GATE2);

  /* ============ 三 海报（poster.js 只在 review.html 在场） ============ */
  await page.goto(P('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.FootprintPoster && window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await page.evaluate(INSTALL);
  await sleep(1600);
  const POST1 = await page.evaluate(() => {
    window.__HOOK(true);
    window.FootprintPoster.generate(false, 'carto');
    return new Promise(r => setTimeout(() => r(window.__foCap.slice()), 900));
  });
  const pBrand = POST1.filter(c => /TRACE Serif/.test(c.font)).length;
  ok('FO16 海报落笔逐笔都含品牌族（②档 poster.js 那 7 行的运行时形状）',
    POST1.length > 0 && pBrand === POST1.length,
    '落笔=' + POST1.length + ' 含 TRACE Serif=' + pBrand + ' 样本=' + POST1.slice(0, 2).map(c => c.font).join(' / '));

  const POST2 = await page.evaluate(() => {
    const real = window.UI.fontsReady;
    window.UI.fontsReady = () => new Promise(function () {});
    window.__HOOK(true);
    window.FootprintPoster.generate(false, 'ink');
    return new Promise(r => setTimeout(() => { window.UI.fontsReady = real; r(window.__foCap.length); }, 400));
  });
  ok('FO17 海报同样排在字库后面：卡住时不落笔', POST2 === 0, '400ms 内落笔=' + POST2);

  /* ============ 四 随手记分享卡片（面板里那颗「卡」钮才是出口） ============ */
  await page.goto(P('travel-map.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await page.evaluate(INSTALL);
  await sleep(1800);
  await page.evaluate(() => { window.TravelNotes.openList(); });
  await sleep(600);
  await page.evaluate(() => {
    const h = document.querySelector('#tnListBody .tn-trip-head');
    const card = document.querySelector('#tnListBody .tn-trip');
    if (h && card && !card.classList.contains('open')) h.click();
  });
  await page.waitForFunction(() => !!document.querySelector('#tnListBody [data-a=card]'), { timeout: 4000, polling: 150 }).catch(() => {});
  await sleep(300);
  const HASBTN = await page.evaluate(() => !!document.querySelector('#tnListBody [data-a=card]'));
  ok('FO18 列表里有那颗「卡」钮（出口在场，FO19/FO20 不是在 0 个点上空跑）', HASBTN === true, '找到=' + HASBTN);

  const CARD1 = await page.evaluate(() => {
    window.__HOOK(true);
    const b = document.querySelector('#tnListBody [data-a=card]');
    if (b) b.click();
    return new Promise(r => setTimeout(() => r({ cap: window.__foCap.slice(), btn: !!b }), 1000));
  });
  const cBrand = CARD1.cap.filter(c => /TRACE Serif/.test(c.font)).length;
  const cGeneric = CARD1.cap.filter(c => /sans-serif/.test(c.font) && !/TRACE/.test(c.font)).length;
  ok('FO19 分享卡片落笔含 3 笔品牌族（标题／地点名／正文），日期那一笔设计内留 generic',
    CARD1.btn && cBrand === 3 && cGeneric === 1,
    '落笔=' + CARD1.cap.length + ' 品牌=' + cBrand + ' 留 generic=' + cGeneric + ' 字体=' + CARD1.cap.map(c => c.font).join(' / '));

  await sleep(1700);   // genCard 里那 1.5s 防连点：两臂之间不隔开，第二发会被静默吞掉，红成「保险丝没装」的假象
  const CARD2 = await page.evaluate(() => {
    const real = window.UI.fontsReady;
    window.UI.fontsReady = () => new Promise(function () {});
    window.__HOOK(true);
    const b = document.querySelector('#tnListBody [data-a=card]');
    if (b) b.click();
    return new Promise(r => setTimeout(() => { window.UI.fontsReady = real; r({ btn: !!b, cap: window.__foCap.length }); }, 400));
  });
  ok('FO20 卡片那一路也排在字库后面：点得到钮、400ms 内不落笔', CARD2.btn === true && CARD2.cap === 0,
    '钮=' + CARD2.btn + ' 落笔=' + CARD2.cap);

  ok('FO21 全程没有未捕获的页面异常（启动崩溃在这条腿里表现为静默卡住，必须先看见才敢认读数）',
    errs.length === 0, errs.slice(0, 3).join(' ｜ '));
  ok('FO22 条数守卫：判据 23 条一条都不许被顺手删（腿是顺序跑的，中间抛了＝后面的判据一条没执行，那种「全绿」是空转）',
    checks >= 22, 'checks=' + checks);

  await browser.close();
  const tail = '\n' + checks + ' 条判据，失败 ' + fails + ' 条';
  console.log(tail); lines.push(tail);
  require('fs').writeFileSync(path.join(__dirname, 'out', 'b35b-smoke-font.txt'), lines.join('\n') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('腿自身抛了: ' + ((e && e.stack) || e)); process.exit(2); });
