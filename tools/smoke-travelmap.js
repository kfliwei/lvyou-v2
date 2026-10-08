/* tools/smoke-travelmap.js — 批次 29「足迹页底部游记记录点不开、卡片文字看不全、照片不显示」浏览器闸门
 *
 * 用户报（逐字，2026-10-08）：「实际情况是点不开，看不全，一是文字只能看固定部分，多出的看不到，照片不显示。」
 *
 * 两条根因（改前实测见 tools/out/b29-probe-travelmap-card.txt / -card2.txt）：
 *   R1 遮挡：统计条被「制图分享／回放」两枚钮撑到 94px，而时间线的 bottom 是另一个硬编码数（150），
 *      两者重叠 45px、z 1000 > 900 → chip 中心 elementFromPoint 命中的是统计条。绑定一直在，
 *      只是这一下永远点不到它。（我上一轮据此说「能点开」是错的：绑定在场 ≠ 命中得到。）
 *   R2 定高裁切：抽屉写死 212/485，#msBody 虽 overflow-y:auto 但零提示 → 正文末行 top=699 落在
 *      卡片可见底 511 之外，整条照片行 577..721 也在外面。用户读到的就是「只能看固定部分」「照片不显示」。
 *   附带达标项：chip 高 35px（<44）、chip 上只有时间戳没有地点名（读起来像坐标轴刻度，没人预期它可点）、
 *      卡内关闭钮 30px、底部两排横向内容超出时无任何提示。
 *
 * 所以这一节断言的是**实测矩形 + 真点命中**，不是「按钮在不在」：
 *   一（TM01–TM10）统计条展开态：重叠 0、整条时间线在它之上、--tm-gap 由 JS 写下且等于实测高+8、
 *     chip ≥44 / 带地点名 / 带 aria-label / 中心命中自己 / 真点一下能把抽屉开起来。
 *   二（TM11–TM15）统计条收起态：换成 44px 圆钮那一档，时间线落下来但不压钮；再展开回到一（单点两态都跑）。
 *   三（TM16–TM27）抽屉：卡片高度、照片行在可见区内、照片解码、溢出提示 ms-clip 随 scrollTop 生灭、
 *     滚到底末行读得到、关闭钮 ≥44 且命中自己，以及开卡时地图怎么让位（TM25–TM27，见下）。
 *   四（TM28–TM31）横向两排（胶囊 / 照片）与关闭态：渐隐口、滚到头自己收、display 回 none。
 *   五（TM32–TM37）反证（把遮挡做回来闸门必须红）+ 一次开卡只许挪一次 + 零未捕获报错 + 版权条 computed 底色 + 本闸门自己的条数下限。
 *     TM36 是 §44 那条「坐在基线外的 bottom:calc 全部走同一颗基线」的对账抓出来的：travel-map.html 里那条
 *     .leaflet-control-attribution{margin-bottom:calc(env(...)+94px)} 一辈子没生效过（vendor 的 .leaflet-container
 *     .leaflet-control-attribution{margin:0} 是两级类，页内单类打不过），连同一族的底色也是白底——
 *     「源码里写了」≠「computed 里生效」，这一条只能由浏览器腿守。
 *
 * TM25–TM27 这条改了三版，最后一版才是对的，别再退回前两种写法：
 *   旧代码开卡 map.panBy([0,-180],{duration:420})：Leaflet 的 duration 单位是「秒」，420＝七分半＝等于没动；
 *   第二版把单位改成 .52（并把位移按卡片实测高算），探针 tools/out/b29-probe-pan*.txt 量出来还是不动——
 *   真原因有两条：① panBy 的符号是「视口往哪走」，负值是把被看的那个点往屏幕「下」推，旧写法一开卡
 *   就把这一点推进卡片里（travel-map 与 topic-common 两处同形，都是这个反号）；
 *   ② 点胶囊那条路径先起了 flyTo，动画在飞的每一帧都在重设视图，带 duration 的 panBy 位移被吞光。
 *   终版＝只挪「被盖住的那一截」：卡片上沿以上的地图带 ≥120px 才抬，抬到带下沿；带太窄（长正文那档
 *   卡占 593，上面只剩 26px）就一点不动；animate:false 瞬移，躲开与 flyTo 抢帧；关卡按挪出的数原样还。
 *   终版自己还炸出第四条（TM34，探针 tools/out/b29-probe-stack.txt 数到 1253 帧）：我们自己那次瞬移也会
 *   发 moveend 回到同一个函数，残余 0.4px 经 Math.round 得 0，而 map.panBy([0,0]) 照样派发 moveend——
 *   于是 抬→事件→抬 0→事件 同步自激；同一步还把 sheetRaised 抹成 0，关卡就不知道该还多少（TM27 那条红）。
 *   所以门坎必须是「不足 1px 就不挪」，不是「压住了就挪」：瞬移一次后残余恒 <0.5px，这条自己就能停手。
 *
 * 名字前缀 TM（travel-map）。真机腿不在这里：手机上的照片是壳写的 file:// 绝对路径，
 * WebView 能不能解码那条浏览器腿看不到 —— 记在 README 与本节注释里，出包后要在 Ace 6T 上人工验。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-travelmap.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.join(ROOT, 'travel-map.html').replace(/\\/g, '/');
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

/* 播种：一条长正文 + 2 张内嵌照片（canvas 现造，必须页内跑），一条短记录同地点，
   再加一条中等正文不带照片的（卡片矮到露得出地图带，TM26/TM27 那两条「该抬才抬」要用它）。 */
const SEED = () => {
  function pic(seed) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const g = c.getContext('2d');
    const lin = g.createLinearGradient(0, 0, 900, 600);
    lin.addColorStop(0, ['#C86D4B', '#59685A', '#5F6D76'][seed % 3]); lin.addColorStop(1, '#20201D');
    g.fillStyle = lin; g.fillRect(0, 0, 900, 600);
    g.fillStyle = '#FAF8F3'; g.font = '90px sans-serif'; g.fillText('P' + seed, 40, 140);
    return c.toDataURL('image/jpeg', 0.82);
  }
  const long = ('那天的风很大，木塔的影子在地上拉得很长。' +
    '我在塔下站了很久，抬头数斗拱，一层一层数不清，旁边卖凉粉的老乡说这塔几百年没倒过。' +
    '后来我沿着街走，走到城门口又折回来，买了两串糖葫芦，坐在台阶上把刚才看见的都写下来。' +
    '回程的路上一直在想，古人建这座塔的时候，是不是也这样仰着头。').repeat(2);
  const now = Date.now();
  const mk = o => Object.assign({
    id: 'tmg' + Math.random().toString(36).slice(2, 8),
    title: '应县木塔', siteName: '应县木塔', province: '山西', city: '朔州', county: '应县',
    lat: 39.5606, lng: 114.0862, photos: [], audio: '', tags: ['古建'], weather: '晴 18℃', style: 'ink',
  }, o);
  const list = [
    mk({ ts: now - 6 * 3600e3, date: '2026-10-02 09:00', day: '2026-10-02', text: long, raw: long, photos: [pic(1), pic(2)], title: '大同古城' }),
    mk({ ts: now - 1 * 3600e3, date: '2026-10-02 15:00', day: '2026-10-02', text: '第二次上木塔，云层很低。', raw: '第二次上木塔，云层很低。' }),
    /* 第三条：中等正文、不带照片＝卡片矮到地图上沿露得出（TM26 那一档「该抬才抬」要用它） */
    mk({ ts: now - 3 * 3600e3, date: '2026-10-02 11:00', day: '2026-10-02', title: '悬空寺', siteName: '悬空寺', text: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。', raw: '恒山边上风大，栈道贴着崖壁走了一半就折回来了。' }),
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

/* 一屏底部三层的矩形 + 每枚 chip 的真点命中（elementFromPoint 落在 chip 自己或其子节点上才算命中） */
const GEOM = () => {
  const r = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), left: Math.round(b.left), right: Math.round(b.right) }; };
  const stat = document.getElementById('statBar'), so = document.getElementById('statOpen'), tl = document.getElementById('mmTimeline');
  const rs = r(stat), rt = r(tl);
  const chips = Array.from(tl.querySelectorAll('.tl-chip')).map(c => {
    const b = c.getBoundingClientRect(), x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
    const hit = document.elementFromPoint(x, y);
    return { text: (c.textContent || '').trim(), name: (c.querySelector('.tl-name') || {}).textContent || '', aria: c.getAttribute('aria-label') || '', h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), x, y, cx: b.left, hit: hit ? (hit.id || (typeof hit.className === 'string' ? hit.className : hit.tagName)) : 'null', self: !!hit && (hit === c || c.contains(hit)), onScreen: x <= window.innerWidth };
  });
  return {
    stat: rs, statDisp: getComputedStyle(stat).display, openDisp: getComputedStyle(so).display, open: r(so),
    tl: rt, gapInline: tl.style.getPropertyValue('--tm-gap'), tlClip: tl.classList.contains('h-clipped'),
    tlCw: Math.round(tl.clientWidth), tlSw: Math.round(tl.scrollWidth),
    chips,
    overlapStat: Math.round(Math.max(0, Math.min(rs.bottom, rt.bottom) - Math.max(rs.top, rt.top))),
    overlapOpen: Math.round(Math.max(0, Math.min(r(so).bottom, rt.bottom) - Math.max(r(so).top, rt.top))),
  };
};

/* 抽屉打开后的版面读数：照片行在不在可见区、末行在滚到底之后读不读得到、溢出提示生灭 */
const SHEET = () => {
  const s = document.getElementById('memSheet'), b = document.getElementById('msBody');
  const sr = s.getBoundingClientRect();
  const story = b.querySelector('.ms-story'), row = b.querySelector('.ms-photos');
  const lastLine = () => { if (!story) return null; const rg = document.createRange(); rg.selectNodeContents(story); const rc = Array.from(rg.getClientRects()); return rc.length ? Math.round(rc[rc.length - 1].top) : null; };
  const close = s.querySelector('.ms-close');
  const cb = close ? close.getBoundingClientRect() : null;
  const cx = cb ? Math.round(cb.left + cb.width / 2) : 0, cy = cb ? Math.round(cb.top + cb.height / 2) : 0;
  const ch = cb ? document.elementFromPoint(cx, cy) : null;
  return {
    cls: s.className, disp: getComputedStyle(s).display,
    sheet: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), h: Math.round(sr.height) },
    body: { sh: b.scrollHeight, ch: b.clientHeight, scrollTop: b.scrollTop },
    clipText: getComputedStyle(s, '::after').content,
    story: story ? { chars: (story.textContent || '').length, top: Math.round(story.getBoundingClientRect().top), h: Math.round(story.getBoundingClientRect().height) } : null,
    lastLineTop: lastLine(),
    row: row ? { top: Math.round(row.getBoundingClientRect().top), bottom: Math.round(row.getBoundingClientRect().bottom), clip: row.classList.contains('h-clipped'), cw: Math.round(row.clientWidth), sw: Math.round(row.scrollWidth) } : null,
    imgs: Array.from(b.querySelectorAll('.ms-photos img')).map(i => { const q = i.getBoundingClientRect(); return { nat: i.naturalWidth + 'x' + i.naturalHeight, w: Math.round(q.width), h: Math.round(q.height), complete: i.complete }; }),
    close: cb ? { w: Math.round(cb.width), h: Math.round(cb.height), self: !!ch && (ch === close || close.contains(ch)) } : null,
  };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'], headless: 'new' });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.TravelNotes && TravelNotes.list().length === 3, { timeout: 20000, polling: 150 });
  await sleep(2200);
  lines.push('=== smoke-travelmap · 视口 ' + VW + 'x' + VH + ' · 播种 3 条（长正文＋2 张内嵌照片 / 短记录 / 中等正文无照片）===');

  /* ---- 一 统计条展开态 ---- */
  const A = await page.evaluate(GEOM);
  ok('TM01 统计条与时间线零重叠（改前 45px，chip 中心命中的是统计条）', A.overlapStat === 0, 'stat ' + A.stat.top + '..' + A.stat.bottom + ' / tl ' + A.tl.top + '..' + A.tl.bottom + ' 重叠=' + A.overlapStat);
  ok('TM02 时间线整条坐在统计条顶边之上', A.tl.bottom <= A.stat.top, 'tl.bottom=' + A.tl.bottom + ' stat.top=' + A.stat.top);
  ok('TM03 --tm-gap 由 JS 写在行内且＝统计条实测高+8（CSS 里那个 102 只是 JS 前的兜底）', A.gapInline === (A.stat.h + 8) + 'px', 'inline=' + A.gapInline + ' statH=' + A.stat.h);
  ok('TM04 每枚记录胶囊高 ≥44px（改前 35）', A.chips.length > 0 && A.chips.every(c => c.h >= 44), A.chips.map(c => c.h).join('/'));
  ok('TM05 胶囊上写着地点名，不只是时间戳', A.chips.every(c => c.name.length > 0), A.chips.map(c => c.text).join(' | '));
  ok('TM06 胶囊带 aria-label 并点名「点开看全文与照片」', A.chips.every(c => /点开看全文与照片/.test(c.aria) && c.aria.indexOf(c.name) >= 0), (A.chips[0] || {}).aria);
  const onScreen = A.chips.filter(c => c.onScreen);
  ok('TM07 屏内每枚胶囊中心 elementFromPoint 命中自己', onScreen.length > 0 && onScreen.every(c => c.self === true), onScreen.map(c => c.name + '→' + c.hit).join(' | '));
  const off = A.chips.filter(c => !c.onScreen);
  ok('TM08 屏外那几枚是被横排右边缘切掉的（不是被谁压住）：左沿落在时间线可见右沿附近，且纵向仍在排内', off.every(c => c.cx >= A.tl.right - 60 && c.top >= A.tl.top && c.bottom <= A.tl.bottom), off.map(c => c.name + ' left=' + Math.round(c.cx) + ' top=' + c.top + '..' + c.bottom).join(' | ') + ' / 时间线右沿=' + A.tl.right);

  /* ---- 真点一下：tap 屏内那枚，抽屉要开起来 ---- */
  const tapTo = onScreen[0];
  await page.touchscreen.tap(tapTo.x, tapTo.y);
  await sleep(1600);
  const OPEN = await page.evaluate(() => ({
    cls: document.getElementById('memSheet').className,
    place: (document.querySelector('#msBody .ms-place') || {}).textContent || '',
    active: Array.from(document.querySelectorAll('.tl-chip.active')).map(e => (e.querySelector('.tl-name') || {}).textContent || ''),
  }));
  ok('TM09 点这一下 #memSheet 真的开起来了（class 含 show——用户说的「点不开」）', /(^|\s)show(\s|$)/.test(OPEN.cls), 'tap@(' + tapTo.x + ',' + tapTo.y + ') cls="' + OPEN.cls + '"');
  ok('TM10 开的是被点的那一篇，时间线高亮跟着走', OPEN.active.length === 1 && OPEN.active[0] === tapTo.name && OPEN.place === tapTo.name, 'active=' + JSON.stringify(OPEN.active) + ' 卡头=' + OPEN.place + ' 点的=' + tapTo.name);
  await page.evaluate(() => closeMemSheet());
  await sleep(900);

  /* ---- 二 统计条收起态（单点两态都要跑） ---- */
  await page.evaluate(() => document.getElementById('statClose').click());
  await sleep(500);
  const C = await page.evaluate(GEOM);
  ok('TM11 收起后 #statBar 隐、#statOpen 现', C.statDisp === 'none' && C.openDisp !== 'none', 'stat=' + C.statDisp + ' open=' + C.openDisp);
  ok('TM12 收起后 --tm-gap 换成圆钮那一档（44+8）', C.gapInline === (C.open.h + 8) + 'px', 'inline=' + C.gapInline + ' openH=' + C.open.h);
  ok('TM13 时间线与 44px 圆钮零重叠（只量 statBar 会压到钮上）', C.overlapOpen === 0, 'tl ' + C.tl.top + '..' + C.tl.bottom + ' / open ' + C.open.top + '..' + C.open.bottom + ' 重叠=' + C.overlapOpen);
  ok('TM14 时间线确实往下落了（收起统计条腾出的位置被用上）', C.tl.bottom > A.tl.bottom, '展开态 tl.bottom=' + A.tl.bottom + ' → 收起态 ' + C.tl.bottom);
  await page.evaluate(() => document.getElementById('statOpen').click());
  await sleep(500);
  const D = await page.evaluate(GEOM);
  ok('TM15 再展开回到一那一档：重叠仍是 0', D.overlapStat === 0 && D.gapInline === (D.stat.h + 8) + 'px', '重叠=' + D.overlapStat + ' inline=' + D.gapInline);

  /* ---- 三 抽屉版面（长正文那条） ---- */
  const centerPre = await page.evaluate(() => [+map.getCenter().lat.toFixed(5), +map.getCenter().lng.toFixed(5)]);
  await page.evaluate(() => openMemSheetById(TravelNotes.list().filter(n => n.title === '大同古城')[0].id));
  await sleep(1100);
  const E = await page.evaluate(SHEET);
  await sleep(700);   /* fillSheet 的让位是 80ms 后触发的 420ms 动画，等它跑完再取样 */
  const OPEN_center = await page.evaluate(() => [+map.getCenter().lat.toFixed(5), +map.getCenter().lng.toFixed(5)]);
  ok('TM16 卡片高度抬够了（改前 485，长正文与照片全被 overflow:hidden 裁在外面）', E.sheet.h >= 560, 'h=' + E.sheet.h + ' 可见 ' + E.sheet.top + '..' + E.sheet.bottom);
  ok('TM17 照片行整条落在卡片可见区内（用户说的「照片不显示」的第一条成因）', !!E.row && E.row.top >= E.sheet.top && E.row.bottom <= E.sheet.bottom, 'row ' + (E.row && E.row.top) + '..' + (E.row && E.row.bottom) + ' / 卡 ' + E.sheet.top + '..' + E.sheet.bottom);
  ok('TM18 照片排在正文之前（先看见图，再读字；顺带当「卡片还有下文」的暗示）', !!E.row && !!E.story && E.row.top < E.story.top, 'row.top=' + (E.row && E.row.top) + ' 正文 top=' + (E.story && E.story.top));
  ok('TM19 内嵌照片在这一条腿上有版面、已解码（浏览器腿只证明 data URL；手机是 file:// 路径，另说）', E.imgs.length >= 2 && E.imgs.every(i => i.complete && i.nat !== '0x0' && i.w >= 100 && i.h >= 100), JSON.stringify(E.imgs));
  const clipped = E.lastLineTop !== null && E.lastLineTop > E.sheet.bottom;
  ok('TM20 正文末行在 scrollTop=0 时确实在卡片外（承认裁切存在，才要那条可见口）', clipped, '末行 top=' + E.lastLineTop + ' 卡底=' + E.sheet.bottom);
  ok('TM21 溢出时 ms-clip 在场并写着「↑ 上滑看全文」', /(^|\s)ms-clip(\s|$)/.test(E.cls) && E.clipText.indexOf('上滑看全文') >= 0, 'cls="' + E.cls + '" content=' + E.clipText);
  const F = await page.evaluate(async () => {
    const b = document.getElementById('msBody'), wait = ms => new Promise(r => setTimeout(r, ms));
    b.scrollTop = 999999; await wait(300);
    const s = document.getElementById('memSheet'), sr = s.getBoundingClientRect();
    const story = b.querySelector('.ms-story');
    const rg = document.createRange(); rg.selectNodeContents(story); const rc = Array.from(rg.getClientRects());
    const out = { scrollTop: b.scrollTop, lastLineTop: rc.length ? Math.round(rc[rc.length - 1].top) : null, sheetBottom: Math.round(sr.bottom), clip: /(^|\s)ms-clip(\s|$)/.test(s.className) };
    b.scrollTop = 0; return out;
  });
  ok('TM22 滚到底能把末行读进可见区（「多出的看不到」这条消掉了）', F.scrollTop > 0 && F.lastLineTop !== null && F.lastLineTop < F.sheetBottom, 'scrollTop=' + F.scrollTop + ' 末行 top=' + F.lastLineTop + ' 卡底=' + F.sheetBottom);
  ok('TM23 滚到底提示自己收（没有下文了不该还挂着）', F.clip === false, 'ms-clip=' + F.clip);
  ok('TM24 卡内关闭钮 ≥44px 且中心命中自己（改前 30px）', !!E.close && E.close.w >= 44 && E.close.h >= 44 && E.close.self === true, JSON.stringify(E.close));
  await page.evaluate(() => closeMemSheet());
  await sleep(1200);
  const centerAfter = await page.evaluate(() => [+map.getCenter().lat.toFixed(6), +map.getCenter().lng.toFixed(6)]);
  ok('TM25 长正文那档开/关卡地图一点都不动（卡片 593、上面只剩 26px：挪了没地方看；旧写法还把点往卡片底下推）',
    Math.abs(centerPre[0] - OPEN_center[0]) < 1e-5 && Math.abs(centerPre[0] - centerAfter[0]) < 1e-5,
    '开前 ' + centerPre.join(',') + ' → 开时 ' + OPEN_center.join(',') + ' → 关后 ' + centerAfter.join(','));

  /* 卡片矮到露得出地图带时，被盖住的那个点要抬到卡片上沿之上——只挪被盖住的那一截，关卡原样还 */
  const MID = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const n = TravelNotes.list().filter(x => x.title === '悬空寺')[0];
    const xy = () => Math.round(map.latLngToContainerPoint(gxy(n.lat, n.lng)).y);
    const pan = [];                     /* 记下每次瞬移的 y 分量：自激的形状就是「一次开卡挪个没完」，超 40 刀断，别让闸门自己爆栈 */
    const op = map.panBy.bind(map);
    map.panBy = function (off, opt) {
      pan.push(Math.round(off && off.y != null ? off.y : (off && off[1]) || 0));
      if (pan.length > 40) return map;
      return op(off, opt);
    };
    map.panBy([0, -240], { animate: false });      /* 把这个点推到屏幕下半部（视图落在那儿的一档） */
    await wait(120);
    const sunk = { y: xy(), center: +map.getCenter().lat.toFixed(6) };
    const nOpen = pan.length;
    openMemSheetById(n.id);
    await wait(800);
    const s = document.getElementById('memSheet'), cr = s.getBoundingClientRect();
    const open = { y: xy(), band: Math.round(cr.top), h: Math.round(cr.height) };
    const openPans = pan.slice(nOpen);
    const nClose = pan.length;
    closeMemSheet();
    await wait(300);
    return { sunk, open, openPans, closePans: pan.slice(nClose), panTotal: pan.length, back: +map.getCenter().lat.toFixed(6) };
  });
  ok('TM26 卡片矮到露得出地图带时，被盖住的那一个点抬到卡片上沿之上（旧写法符号是反的：开卡把点推进卡片里）',
    MID.open.band >= 120 && MID.sunk.y > MID.open.band && MID.open.y <= MID.open.band && MID.open.y >= 0,
    '开卡前点 y=' + MID.sunk.y + ' 卡片上沿=' + MID.open.band + '（卡高 ' + MID.open.h + '）→ 开卡后点 y=' + MID.open.y);
  ok('TM27 关卡原样回到开卡前那个中心（挪多少还多少，不做第二次）', MID.back === MID.sunk.center, '开前 ' + MID.sunk.center + ' → 关后 ' + MID.back);
  const closedDisp = await page.evaluate(() => getComputedStyle(document.getElementById('memSheet')).display);
  ok('TM28 关闭后抽屉 display:none（关闭钮与手势两条腿都走 UI.sheet 单点）', closedDisp === 'none', 'display=' + closedDisp);

  /* ---- 四 横向两排的渐隐口 ---- */
  const G4 = await page.evaluate(GEOM);
  ok('TM29 底部胶囊排内容露不下时给渐隐口', !(G4.tlSw > G4.tlCw + 8) || G4.tlClip === true, 'cw=' + G4.tlCw + ' sw=' + G4.tlSw + ' clip=' + G4.tlClip);
  const G5 = await page.evaluate(async () => {
    const tl = document.getElementById('mmTimeline'), wait = ms => new Promise(r => setTimeout(r, ms));
    tl.scrollLeft = 999999; await wait(300);
    const out = { clip: tl.classList.contains('h-clipped'), left: Math.round(tl.scrollLeft) };
    tl.scrollLeft = 0; return out;
  });
  ok('TM30 胶囊排滚到头，渐隐口自己收', !(G4.tlSw > G4.tlCw + 8) || (G5.left > 0 && G5.clip === false), 'scrollLeft=' + G5.left + ' clip=' + G5.clip);
  await page.evaluate(() => openMemSheetById(TravelNotes.list().filter(n => n.title === '大同古城')[0].id));
  await sleep(1000);
  const H = await page.evaluate(SHEET);
  ok('TM31 卡内照片排同样：露不下才提示，全露得出就不提示', !(H.row.sw > H.row.cw + 8) || H.row.clip === true, 'cw=' + (H.row && H.row.cw) + ' sw=' + (H.row && H.row.sw) + ' clip=' + (H.row && H.row.clip));
  await page.evaluate(() => closeMemSheet());
  await sleep(700);

  /* ---- 五 反证：把遮挡做回来，TM01/TM07 必须一起红 ---- */
  const NEG = await page.evaluate(async () => {
    const tl = document.getElementById('mmTimeline'), wait = ms => new Promise(r => setTimeout(r, ms));
    tl.style.setProperty('--tm-gap', '0px');          /* 退回旧硬编码之前的形状：时间线压在统计条下面 */
    await wait(120);
    const r = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    const rs = r(document.getElementById('statBar')), rt = r(tl);
    const c = tl.querySelector('.tl-chip'), cb = c.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(cb.left + cb.width / 2), Math.round(cb.top + cb.height / 2));
    const back = { overlap: Math.round(Math.max(0, Math.min(rs.bottom, rt.bottom) - Math.max(rs.top, rt.top))), hit: hit ? (hit.id || hit.className || hit.tagName) : 'null', self: !!hit && (hit === c || c.contains(hit)) };
    layoutBottomStack();                               /* 立刻收回，别污染后面的判据 */
    return back;
  });
  ok('TM32 反证：把 --tm-gap 归零，重叠与「命中不到自己」应当同时出现（说明 TM01/TM07 真在守这件事）', NEG.overlap > 0 && NEG.self === false, '重叠=' + NEG.overlap + ' 命中=' + NEG.hit);
  const AFTER = await page.evaluate(GEOM);
  ok('TM33 反证后收回原状：重叠仍是 0', AFTER.overlapStat === 0, '重叠=' + AFTER.overlapStat);

  ok('TM34 一次开卡只许挪一次、关卡只许还一次，而且不许出现零位移的 panBy（残余 0.4px 走 Math.round→0，而 panBy([0,0]) 照样派发 moveend：探针实测重入 1253 帧后爆栈）',
    MID.openPans.length === 1 && MID.openPans[0] >= 1 && MID.closePans.length === 1 && MID.closePans[0] <= -1 && MID.panTotal <= 40,
    '开卡 ' + JSON.stringify(MID.openPans) + ' 关卡 ' + JSON.stringify(MID.closePans) + ' 全程 panBy 次数=' + MID.panTotal);
  ok('TM35 全程零未捕获报错（这类页启动崩溃表现为静默卡住）', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* 版权条这一枚是 §44 的动态对账抓出来的第四条腿：页内原来写的是单类 .leaflet-control-attribution，
     而 vendor/leaflet/leaflet.css:413 是 .leaflet-container .leaflet-control-attribution（两级类）——
     声明了但一辈子没生效，computed 一直是 Leaflet 自己的白底；「坐在基线外的底部数」那条 margin 同样死在那儿。
     源码腿读得到选择器，读不到「谁赢」，所以这一条只有浏览器腿能守。 */
  const ATR = await page.evaluate(() => {
    const a = document.querySelector('.leaflet-control-attribution');
    const s = getComputedStyle(a), r = a.getBoundingClientRect();
    const mr = document.getElementById('map').getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return { bg: s.backgroundColor, mb: s.marginBottom, text: (a.textContent || '').trim(), self: !!hit && (hit === a || a.contains(hit)), inside: Math.round(mr.bottom - r.bottom) >= 0 && r.bottom <= mr.bottom + 1 };
  });
  const PAPER = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper-bar').trim());
  /* token 是十六进制（#FAF8F3），computed style 是 rgb(...)——不换算的话这一条永远红，而它守的是「底色到底换了没有」 */
  const norm = v => {
    const h = /^#?([0-9a-f]{6})$/i.exec(v.trim());
    if (h) { const n = parseInt(h[1], 16); return 'rgb(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ')'; }
    return v.replace(/\s+/g, '');
  };
  ok('TM36 版权条的底色真换到了页内那颗 token（单类写赢不了 vendor 的 .leaflet-container …，computed 才是事实；探针 tools/out/b29-probe-attribution2.txt）',
    norm(ATR.bg) === norm(PAPER) && /高德|OpenStreetMap/.test(ATR.text), '底色=' + ATR.bg + ' token=' + PAPER + ' 文案=' + ATR.text.slice(0, 24));
  ok('TM36b 版权条读得到（中心命中自己）且不越过地图底边——署名不许藏在某一摞底下', ATR.self === true && ATR.inside === true, '命中自己=' + ATR.self + ' 在图内=' + ATR.inside);
  ok('TM37 判据条数 ≥ 38（这一节自己也是会被删的）', checks >= 37, 'checks=' + checks + '（本条自身是第 ' + (checks + 1) + ' 条）');

  lines.push('=== smoke-travelmap: ' + checks + ' 项，失败 ' + fails + ' ===');
  console.log('=== smoke-travelmap: ' + checks + ' 项，失败 ' + fails + ' ===');
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b29-smoke-travelmap.txt'), lines.join('\n') + '\n'); } catch (e) { console.log('读数落盘失败：' + e.message); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { lines.push('FATAL ' + ((e && e.stack) || e)); try { fs.writeFileSync(path.join(__dirname, 'out', 'b29-smoke-travelmap.txt'), lines.join('\n') + '\n'); } catch (x) {} console.log('FATAL ' + ((e && e.message) || e)); process.exit(1); });
