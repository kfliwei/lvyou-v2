/* tools/smoke-viewer.js — 批次 27「弹层关闭钮没有 X + 点照片不放大」浏览器闸门
 *
 * 用户报两条（2026-10-07）：①「我的游记页面，点按导入、导出弹出的窗口关闭按钮没 x」；
 * ②「游记内容有照片的点击照片不能放大」。两条都不是逻辑坏了，是**发出去的东西没人接**：
 * ① 拼 HTML 时 `<button … aria-label="关闭"` 漏了收尾的 >，紧随的 `<svg class="ti" …>` 整串被
 *    解析器当成 button 的属性吞掉，DOM 里只剩一枚裸 <use>（不 paint），class="ti" 还泄漏到 BUTTON 上。
 *    全库扫出 5 处同形状（travel-notes 导出/导入/选点 + results 定制路书/纪念册）。
 * ② .tn-viewer 与 .tn-cal-* 这 24 行住在 map.css，而 map.css 只被 15 个宿主页里的 3 页加载。
 *    手机上（index / travel-map）读到的是空类：点照片后 .tn-viewer 确实进了 DOM，
 *    但它是文档流里一个裸 DIV（改前实测 328×63、z-index:auto），既没铺满也没盖住页面 →「点了没反应」；
 *    日历格子是 <span>，没有 grid 就排成一行裸日号（批次 26「只有 1234567」的第二条腿）。
 * 所以这一节断言的是**计算样式与真 DOM**，不是「节点在不在」：
 * 关闭钮要量到 svg + ≥44×44 + 完整落在 328 视口内，查看器要 position:fixed + 铺满 328×723 + z 9900，
 * 日历要 display:grid + 7 列 + 多行。名字前缀 V（viewer）。
 * 用法: NODE_PATH=tools/node_modules node tools/smoke-viewer.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
const VW = 328, VH = 723;                 /* 一加 Ace 6T 真机档（批次 23-D 口径） */

let checks = 0, fails = 0;
const lines = [];
function ok(name, cond, extra) {
  checks++;
  const s = (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined || extra === '' ? '' : '  [' + extra + ']');
  console.log(s); lines.push(s);
  if (!cond) fails++;
}

/* 1x1 GIF，两枚不同色，好分辨「翻页真的换了图」；差异在第 38 个字符，别截断比较。
   这两串是从标准 1x1 GIF 改调色板来的，结构合法——必须验：假图一旦解码失败，
   UI.imgFail 会把 <img> 换成 <div class="img-fallback">，查看器腿就变成空断言（V00 管这个）。 */
const PH_A = 'data:image/gif;base64,R0lGODlhAQABAIAAAMhtSwAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const PH_B = 'data:image/gif;base64,R0lGODlhAQABAIAAADyMggAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

function note(ts, day, title, photos) {
  return {
    id: 'sv_' + title, title: title, siteName: '鹳雀楼', siteIndex: -1,
    lat: 34.84, lng: 110.49, ts: ts, date: day + ' 09:12', day: day,
    province: '山西', city: '运城', county: '永济',
    raw: '正文·' + title, text: '正文·' + title, style: 'plain',
    photos: photos, audio: '', tags: []
  };
}

async function openCtx(browser, rows, errs, file) {
  const ctx = await browser.createBrowserContext();   /* file:// 下 IDB 是共享的，逐腿隔开了种 */
  const page = await ctx.newPage();
  await page.setViewport({ width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 90)));
  await page.goto(U(file), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(function () { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await page.evaluate(function (rs) {
    return new Promise(function (res, rej) {
      const rq = indexedDB.open('gujian-notes', 1);
      rq.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      rq.onsuccess = function () {
        const db = rq.result, tx = db.transaction('notes', 'readwrite'), os = tx.objectStore('notes');
        os.clear(); rs.forEach(r => os.put(r));
        tx.oncomplete = function () { db.close(); res(rs.length); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
      rq.onerror = function () { rej(rq.error); };
    });
  }, rows);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function (n) { return window.TravelNotes && TravelNotes.list().length === n; }, { timeout: 20000, polling: 150 }, rows.length)
    .catch(function () { lines.push('  (笔记没按条数到货，按现状读)'); });
  return { ctx: ctx, page: page };
}

/* 页内公共读数器：一枚「关闭钮」要看的是它有没有真的画出一张图标、有没有溢出屏幕，
   而不是它在不在 DOM 里（改前那五枚全都在 DOM 里，也全都看不见）。 */
const READX = function (sel) {
  const b = document.querySelector(sel);
  if (!b) return null;
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  const svg = b.querySelector('svg'), use = b.querySelector('use');
  const href = use ? (use.getAttribute('href') || use.getAttribute('xlink:href') || '') : '';
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(','),
    cls: (typeof b.className === 'string' ? b.className : ''),
    aria: b.getAttribute('aria-label') || '',
    svg: !!svg, svgDisp: svg ? getComputedStyle(svg).display : 'none',
    use: href, sym: href ? !!document.querySelector(href) : false,
    kids: b.children.length, text: (b.textContent || '').trim(),
    /* 命中的必须是这枚钮自己或它内置的那张图标（svg 会挡住 elementFromPoint，
       点 svg 一样冒泡到 button）；命中别的元素＝被别的东西盖住了。 */
    hit: (function () { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && (e === b || b.contains(e)); })(),
    hitTag: (function () { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e ? e.tagName : 'null'; })()
  };
};
const XGOOD = function (x, wantCls) {
  return !!x && x.w >= 44 && x.h >= 44 && x.svg && x.svgDisp !== 'none' && x.use === '#ti-close' && x.sym
    && x.cls === wantCls && x.aria === '关闭' && x.text === '' && x.hit === true;
};
/* 完整落在 328×723 视口内：右上角一枚钮被 safe-area / 圆角挤出屏，等于看不见也点不着 */
const XINVW = function (x, vw, vh) {
  if (!x) return false;
  const p = x.box.split(',').map(Number);
  return p[0] >= 0 && p[1] >= 0 && p[2] <= vw && p[3] <= vh;
};

/* 等几何稳定再量。.ui-modal 入场是 transform:scale(.94)→scale(1) 的过渡，
   在动画里量会读出 41×41（= 44×0.94）——量的时机不能比被测的修复更松（在案教训）。
   逐拍比对 rect，连续 3 拍不动才算收尾。用 setTimeout 而不是 rAF 轮询：
   后台/无遮挡状态下的 rAF 会只走一帧就停在过渡起点，rAF 版实测把 41 当成稳定值。 */
async function settle(p, sel) {
  return p.evaluate(function (s) {
    return new Promise(function (res) {
      let last = '', same = 0, n = 0;
      (function step() {
        const el = document.querySelector(s);
        const r = el ? el.getBoundingClientRect() : null;
        const cur = r ? [r.width, r.height, r.left, r.top].map(Math.round).join(',') : 'null';
        if (cur === last) { if (++same >= 3) return res({ frames: n }); }
        else { same = 0; last = cur; }
        if (++n > 60) return res({ frames: n, capped: true });
        setTimeout(step, 40);
      })();
    });
  }, sel);
}

(async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  const Y = 2026, MO = 8;                    /* 固定落在 2026-09，不跟系统月走，免得跨月跑形状变 */
  const pad = n => (n < 10 ? '0' : '') + n;
  const dk = d => Y + '-' + pad(MO + 1) + '-' + pad(d);
  const ts = d => new Date(Y, MO, d, 9, 12).getTime();
  const rows = [note(ts(18), dk(18), '两张照片', [PH_A, PH_B]), note(ts(17), dk(17), '一张照片', [PH_A])];

  /* ================= ① 照片放大（时间线 + 日历两条腿） ================= */
  const { ctx, page } = await openCtx(browser, rows, errs, 'travel-map.html');
  const fx = await page.evaluate(function (urls) {
    return new Promise(function (res) {
      let n = 0; const out = [];
      urls.forEach(function (u) {
        const im = new Image();
        im.onload = function () { out.push(im.naturalWidth + 'x' + im.naturalHeight); if (++n === urls.length) res(out.join(',')); };
        im.onerror = function () { out.push('ERR'); if (++n === urls.length) res(out.join(',')); };
        im.src = u;
      });
    });
  }, [PH_A, PH_B]);
  ok('V00 测试假图自己能解码成 1×1（解码失败会被 UI.imgFail 换成占位块，下面整节腿就空了）', fx === '1x1,1x1', fx);
  const TLZOOM = function () {
    const q = s => document.querySelector(s);
    TravelNotes.openList();
    q('#tnViewTime').click();
    const imgs = Array.prototype.slice.call(document.querySelectorAll('.tn-item .pics img'));
    if (!imgs.length) return { imgs: 0 };
    const first = imgs[0].getAttribute('src');
    imgs[0].click();
    const v = q('.tn-viewer');
    const out = { imgs: imgs.length, first: first, got: !!v };
    if (!v) return out;
    const cs = getComputedStyle(v), r = v.getBoundingClientRect();
    const im = v.querySelector('img');
    out.pos = cs.position; out.z = cs.zIndex; out.disp = cs.display;
    out.rect = Math.round(r.width) + 'x' + Math.round(r.height);
    out.anim = cs.animationName;
    out.bg = cs.backgroundColor;
    out.imgSrc = im ? im.getAttribute('src') : '';
    out.counter = (v.querySelector('.tn-viewer-i') || {}).textContent || '';
    out.navs = v.querySelectorAll('.tn-viewer-nav').length;
    return out;
  };
  const z1 = await page.evaluate(TLZOOM);
  ok('V01 时间线里有照片（.tn-item .pics img ≥3 枚）', z1.imgs >= 3, 'imgs=' + z1.imgs);
  ok('V02 点照片后 .tn-viewer 进了 DOM（这条改前也过，所以它下面全是计算样式）', !!z1.got);
  ok('V03 查看器 position 是 fixed（改前读到 static：样式表压根没被这一页加载）', z1.pos === 'fixed', z1.pos);
  ok('V04 查看器 z-index 9900（盖在面板与底导航之上）', z1.z === '9900', z1.z);
  ok('V05 查看器铺满真机视口 328×723', z1.rect === VW + 'x' + VH, z1.rect);
  ok('V06 底是压深的那一层而不是透明', /^rgba?\(12, 12, 10/.test(z1.bg || ''), z1.bg);
  ok('V07 入场动画名解析到 tnPickFade（关键帧由面板注入，顺序错了就没有淡入）', z1.anim === 'tnPickFade', z1.anim);
  ok('V08 查看器里那张图＝点的那张', z1.imgSrc === z1.first);
  ok('V09 多图计数从「1 / 2」起', z1.counter === '1 / 2', z1.counter);
  ok('V10 两张图时左右翻页钮在场（.tn-viewer-nav 恰 2 枚）', z1.navs === 2, 'navs=' + z1.navs);

  const x1 = await page.evaluate(READX, '.tn-viewer-x');
  ok('V11 查看器关闭钮：图标真画出来 + ≥44×44 + 类名单点', XGOOD(x1, 'tn-viewer-x'), JSON.stringify(x1));

  const z2 = await page.evaluate(function () {
    const v = document.querySelector('.tn-viewer');
    if (!v) return { after: '' };
    v.querySelector('#tvR').click();
    const im = v.querySelector('img');
    return { after: im ? im.getAttribute('src') : 'NOIMG', tag: im ? im.tagName : 'null', counter: (v.querySelector('.tn-viewer-i') || {}).textContent || '' };
  });
  ok('V12 点右箭头真的换 src（切到第二张那张图）', z2.tag === 'IMG' && z2.after === PH_B && z2.after !== z1.imgSrc, z2.tag + ' ' + (z2.after || '').slice(36, 42));
  ok('V13 计数跟到「2 / 2」', z2.counter === '2 / 2', z2.counter);

  const closed = await page.evaluate(function () {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return !document.querySelector('.tn-viewer');
  });
  ok('V14 Escape 能收掉查看器（键盘出口在样式表之外那条腿上）', closed);

  /* ---------- 日历视图（同一条放大出口，走 #calDay 那一支） ---------- */
  const CALR = function () {
    const q = s => document.querySelector(s);
    const slice = n => Array.prototype.slice.call(n);
    q('#tnViewCal').click();
    const grid = q('.tn-cal-grid'), cs = grid ? getComputedStyle(grid) : null;
    const cells = slice(document.querySelectorAll('.tn-cal-d[data-day]'));
    const tops = {};
    cells.slice(0, 14).forEach(c => { tops[Math.round(c.getBoundingClientRect().top)] = 1; });
    const has = cells.filter(c => c.classList.contains('has'));
    const plain = cells.filter(c => !c.classList.contains('has'))[0];
    const nav = q('.tn-cal-nav'), today = q('.tn-cal-today'), tip = q('.tn-cal-day-tip');
    /* 所有读数在「点日期」之前取完：点下去会把 #calDay 里那行提示整个换掉，
       之后再对一个已脱离文档的元素 getComputedStyle 会读到空串（首轮就把这当成「display 没生效」）。 */
    const nr = nav ? nav.getBoundingClientRect() : null, tr = today ? today.getBoundingClientRect() : null;
    const out = {
      disp: cs ? cs.display : 'none', cols: cs ? cs.gridTemplateColumns.trim().split(/\s+/).length : 0,
      cellH: cells.length ? Math.round(cells[0].getBoundingClientRect().height) : 0,
      rows: Object.keys(tops).length, has: has.length,
      hasBg: has.length ? getComputedStyle(has[0]).backgroundColor : '',
      plainBg: plain ? getComputedStyle(plain).backgroundColor : '',
      navW: nr ? Math.round(nr.width) : 0, navH: nr ? Math.round(nr.height) : 0,
      todayH: tr ? Math.round(tr.height) : 0,
      tipDisp: tip ? getComputedStyle(tip).display : 'NODE' + (tip === null ? ':null' : ''),
      tipTxt: tip ? (tip.textContent || '').trim().slice(0, 40) : '',
      pic: 0, acts: 0, viewer: 'no-has-cell'
    };
    const first = has.length ? has[has.length - 1] : null;    /* 有记录的那格 */
    if (first) {
      first.click();
      const item = q('#calDay .tn-item');
      out.pic = document.querySelectorAll('#calDay .tn-item .pics img').length;
      out.acts = item ? item.querySelectorAll('.tg button').length : 0;
      const img = q('#calDay .tn-item .pics img');
      if (img) {
        img.click();
        const v = q('.tn-viewer');
        if (v) {
          const c2 = getComputedStyle(v), r2 = v.getBoundingClientRect();
          out.viewer = c2.position + '/' + c2.zIndex + '/' + Math.round(r2.width) + 'x' + Math.round(r2.height);
          v.remove();
        } else out.viewer = 'no-viewer';
      }
    }
    return out;
  };
  const c1 = await page.evaluate(CALR);
  ok('V15 日历网格是 display:grid（改前这一页读不到 map.css，那格是默认 inline）', c1.disp === 'grid', c1.disp);
  ok('V16 网格恰好 7 列', c1.cols === 7, 'cols=' + c1.cols);
  ok('V17 日格有高度（aspect-ratio 生效，不再是行高 17px 的裸 span）', c1.cellH >= 24, 'cellH=' + c1.cellH);
  ok('V18 日格真的分了多行（≥3 行才算铺成月历）', c1.rows >= 3, 'rows=' + c1.rows);
  ok('V19 有记录的那一格底色与空格子不同且不是全透明', c1.hasBg !== c1.plainBg && parseFloat((c1.hasBg.match(/([\d.]+)\)$/) || [])[1]) > 0, c1.hasBg + ' vs ' + c1.plainBg);
  ok('V20 月份导航钮 ≥44×44（改前 36×36，且这一屏从没加载过那条规则）', c1.navW >= 44 && c1.navH >= 44, c1.navW + 'x' + c1.navH);
  ok('V21 「本月」胶囊 ≥44 高（改前 min-height:34px）', c1.todayH >= 44, 'h=' + c1.todayH);
  ok('V22 说明行落在 .tn-cal-day-tip 上且 display:flex（批次 26 那条样式此前住在错的表里）', c1.tipDisp === 'flex', c1.tipDisp + ' ' + c1.tipTxt);
  ok('V23 点开那天的卡是「那一张卡」：.tg 的出口恰 6 枚（时间线同款，日历不再自己拼窄卡）', c1.acts === 6, 'acts=' + c1.acts);
  ok('V24 日历里点开那天看得到照片（#calDay 的 .pics img ≥1）', c1.pic >= 1, 'pic=' + c1.pic);
  ok('V25 日历里点照片同样开全屏查看器（fixed/9900/铺满）', c1.viewer === 'fixed/9900/' + VW + 'x' + VH, c1.viewer);

  /* ================= ② 五处「拼串漏 >」的关闭钮 ================= */
  const del = s => page.evaluate(function (x) { const m = document.querySelector(x); if (m) m.remove(); }, s);
  async function openAndRead(opener, xsel) {
    await page.evaluate(opener);
    await settle(page, xsel);              /* 弹层入场是 scale(.94)→scale(1)，中途量到 41×41 */
    return page.evaluate(READX, xsel);
  }

  const ex = await openAndRead(function () { document.querySelector('#tnExpBtn').click(); }, '#tnExpX');
  ok('V26 导出备份弹层的关闭钮：图标真画出来 + ≥44 + 挂 .ui-modal-x', XGOOD(ex, 'ui-modal-x'), JSON.stringify(ex));
  ok('V27 这枚钮完整落在 328×723 视口内（右上角不被 safe-area / 圆角挤出屏）', XINVW(ex, VW, VH), ex && ex.box);
  await del('.ui-modal-mask');
  const imp = await openAndRead(function () { document.querySelector('#tnImpBtn').click(); }, '#tnImpX');
  ok('V28 导入备份弹层的关闭钮同上（用户点名的那一枚）', XGOOD(imp, 'ui-modal-x'), JSON.stringify(imp));
  const gone = await page.evaluate(function () {
    const x = document.querySelector('#tnImpX');
    if (x) x.click();
    return !document.querySelector('#tnImpX');
  });
  ok('V29 点这枚 X 真的收掉了弹层（看不见≠点不动，这条分开验）', gone);

  const pick = await openAndRead(function () {
    window.__tnShowPlacePicker('山西·运城·永济', [{ name: '鹳雀楼', lat: 34.84, lng: 110.49 }], 34.84, 110.49, function () {}, function () {});
  }, '#placePickerClose');
  ok('V30 选点弹层的关闭钮也在同一族里（第三处同形状漏口）', XGOOD(pick, 'ui-modal-x'), JSON.stringify(pick));
  await del('#placePicker');

  const ix = await openAndRead(function () {
    window.Results.itinerary([{ name: '鹳雀楼', label: '鹳雀楼', lat: 34.84, lng: 110.49, city: '运城', county: '永济', theme: '', ty: '' }], '闸门测试');
  }, '#ix');
  ok('V31 results.js 定制路书的关闭钮（第四处，同一次扫描里揪出来的）', XGOOD(ix, 'ui-modal-x'), JSON.stringify(ix));
  await del('.rz-dlg');

  const rz = await openAndRead(function () {
    /* 纪念册这一支要先过「选范围」面板，点了「生成」才出预览层（saveDoc 的 #rzX） */
    window.Results.album();
    var go = document.querySelector('.rz-dlg #fgo');
    if (go) go.click();
  }, '#rzX');
  ok('V32 results.js 纪念册预览的关闭钮（第五处）', XGOOD(rz, 'ui-modal-x'), JSON.stringify(rz));
  await del('.rz-dlg');

  /* ================= ③ 换一个宿主页：证明样式住在「全都加载的那张表」里 ================= */
  {
    const c2 = await openCtx(browser, rows, errs, 'index.html');
    const r = await c2.page.evaluate(function () {
      const q = s => document.querySelector(s);
      TravelNotes.openList();
      q('#tnViewTime').click();
      const img = q('.tn-item .pics img');
      if (!img) return { imgs: 0, viewer: false };
      img.click();
      const v = q('.tn-viewer');
      if (!v) return { imgs: 1, viewer: false };
      const cs = getComputedStyle(v), rr = v.getBoundingClientRect();
      return { imgs: document.querySelectorAll('.tn-item .pics img').length, viewer: true, pos: cs.position, rect: Math.round(rr.width) + 'x' + Math.round(rr.height) };
    });
    ok('V33 首页（第二个宿主页）点照片也是全屏 fixed 查看器（map.css 不在这一页的名单里）', r.viewer && r.pos === 'fixed' && r.rect === VW + 'x' + VH, JSON.stringify(r));
    await c2.ctx.close();
  }

  ok('V34 全程零未捕获报错', errs.length === 0, errs.slice(0, 3).join(' | '));
  ok('V35 判据条数 ≥ 30（这一节自己也是会被删的）', checks >= 30, 'checks=' + checks);

  console.log('=== smoke-viewer: ' + checks + ' 项，失败 ' + fails + ' ===');
  lines.push('=== smoke-viewer: ' + checks + ' 项，失败 ' + fails + ' ===');
  try { fs.writeFileSync(path.join(__dirname, 'out', 'b27-smoke-viewer.txt'), lines.join('\n') + '\n'); } catch (e) { console.log('读数落盘失败：' + e.message); }
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
