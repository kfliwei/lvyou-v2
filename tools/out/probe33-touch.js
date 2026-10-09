/* probe33-touch.js — 批次 33-A 地基实测：触控地板 / z 分层 / story 两屏（只读，不改产品码）
 *
 * 待量的是清单里三条「闸门全绿但用户在手机上看得见」的候选，全部先量再定修法：
 *   ① 随手记面板关闭钮 34×34（travel-notes.js:407 `.tn-head .tn-x`）低于全站 44px 触控地板——
 *      但「哪几枚低于」必须一次量全：面板三屏 + 列表 + 编辑页 + 看图器 + 确认层 + 名言检索层，
 *      逐次补测就会像批次 25 那样改一轮漏一族。
 *   ② index.html:498 那条「距上次备份已超 30 天」提醒条 z-index:9500，而录音面板 .tn-panel 是 9001、
 *      页内确认层 .tn-cfm 是 9700——条压在面板之上是不是真把面板里某枚控件吃掉了，要用
 *      elementFromPoint 的命中链定性（批次 32 已经用 9px 网格推翻过一次「点遮罩丢内容」的说法）。
 *      顺带量另一头：tn_lastBackup 从没写过的用户，`+null||0` → 每次冷启动都弹这条，算不算骚扰也要读数。
 *   ③ story 两屏：日卡的「时分」在不在屏上（批次 31 统一口径时被 dayText 收掉），
 *      以及底部翻页浮条与正文的重叠带（静止态/最大滚动/中间滚动三档）。
 *
 * 口径照浏览器腿那一族：328×723 dpr2（§37 真机主档）、静态 http 服务、seed 直写 IndexedDB、
 * 打了 tn_onboarded 才读（首启蒙层 z9990 会吃掉命中测试，见 [[index-smoke-needs-tn-onboarded]]）。
 * 动画一律等收尾再量（[[geometry-measure-after-animation]]）。
 *
 * 用法: PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe33-touch.js \
 *        > tools/out/b33-probe-33a.txt 2>&1
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8173', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const VW = 328, VH = 723;
const FLOOR = 44;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function dump() {
  try { fs.writeFileSync(path.join(__dirname, 'b33-probe-33a.txt'), lines.join('\n') + '\n'); }
  catch (e) { console.log('落盘失败：' + e.message); }
}

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml'
        : p.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* 种子：3 篇游记，date 串带时分（story 那屏要看 dayText 有没有把时刻收掉），1 篇带真图 */
function seedLocal() {
  return new Promise(function (resolve) {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('tn_onboarded', '1');
    var r1 = indexedDB.open('gujian-notes', 1);
    r1.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        var st = db.createObjectStore('notes', { keyPath: 'id' });
        st.createIndex('by_city', 'city', { unique: false });
        st.createIndex('by_day', 'day', { unique: false });
        st.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    r1.onsuccess = function (e) {
      var db = e.target.result;
      var tx = db.transaction('notes', 'readwrite');
      var st = tx.objectStore('notes');
      st.clear();
      var seed = [
        { id: 's1', title: '应县木塔', siteName: '应县木塔', lat: 39.66, lng: 113.19, ts: new Date('2026-10-02T09:12:00+08:00').getTime(),
          date: '2026-10-02 09:12', day: '2026-10-02', text: '正文一', photos: [], audio: '' },
        { id: 's2', title: '悬空寺', siteName: '悬空寺', lat: 39.66, lng: 113.7, ts: new Date('2026-10-03T14:37:00+08:00').getTime(),
          date: '2026-10-03 14:37', day: '2026-10-03', text: '正文二', photos: [], audio: '' },
        { id: 's3', title: '云冈石窟', siteName: '云冈石窟', lat: 40.07, lng: 113.13, ts: new Date('2026-10-04T07:05:00+08:00').getTime(),
          date: '2026-10-04 07:05', day: '2026-10-04',
          text: '这一篇正文写得比较长，故意写到能铺满一整屏，用来量底部翻页浮条与正文行的重叠带。'
            + '第二段还是很长，接着往下排，一直排到卡片底部。'
            + '第三段第三段第三段，让这张卡在 328 档至少有二十行文字。',
          photos: ['images/sites/034ab1d51239cd1e.jpg'], audio: '' }
      ];
      seed.forEach(function (n) { st.put(n); });
      tx.oncomplete = function () { db.close(); resolve('seeded-3'); };
      tx.onerror = function () { db.close(); resolve('notes-write-fail'); };
    };
    r1.onerror = function () { resolve('notes-open-fail'); };
  });
}

function mkLabel() {
  return '(' + function () {
    function label(e) {
      var s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
      if (c.length) s += '.' + c.join('.');
      return s.slice(0, 130);
    }
    window.__L = label;
    return 'label-ready';
  } + ')()';
}

/* 交互件枚举：矩形 + 中心点命中链（blocked=中心点落不到自己或自己后代） */
async function enumRoot(page, rootSel, tag) {
  const r = await page.evaluate(function (rs, fl, tg) {
    if (!window.__L) {
      window.__L = function (e) {
        var s = e.tagName.toLowerCase();
        if (e.id) s += '#' + e.id;
        var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean);
        if (c.length) s += '.' + c.join('.');
        return s.slice(0, 130);
      };
    }
    const root = document.querySelector(rs);
    if (!root) return { root: rs, present: false, items: [] };
    const label = window.__L;
    const list = Array.from(root.querySelectorAll(
      'button,[role="button"],a[href],input[type="submit"],.tn-x,.tn-pill,.sn-btn,.tn-quote,.tg button'));
    const cs = getComputedStyle(root);
    const items = list.map(function (e) {
      const b = e.getBoundingClientRect();
      const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2);
      const hit = document.elementFromPoint(cx, cy);
      const reachable = !!hit && (hit === e || e.contains(hit) || hit.contains(e));
      const own = getComputedStyle(e);
      return {
        label: label(e),
        txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16),
        w: Math.round(b.width), h: Math.round(b.height),
        top: Math.round(b.top), left: Math.round(b.left),
        inFrame: b.top < window.innerHeight && b.bottom > 0 && b.width > 0 && b.height > 0,
        disabled: !!e.disabled,
        visible: own.display !== 'none' && own.visibility !== 'hidden' && b.width > 0 && b.height > 0,
        hit: hit ? label(hit) : 'null',
        reachable: reachable
      };
    }).filter(function (x) { return x.visible; });
    return {
      root: rs, present: true, tag: tg,
      rootDisplay: cs.display,
      vw: window.innerWidth, vh: window.innerHeight,
      items: items,
      under: items.filter(function (x) { return !x.disabled && (x.w < fl || x.h < fl); }),
      unreachable: items.filter(function (x) { return !x.disabled && !x.reachable; })
    };
  }, rootSel, FLOOR, tag);
  say('—— ' + r.root + '：' + (r.present ? '在场' : '不在场（这一屏本轮没打开，不进结论）'));
  if (!r.present) return r;
  say('   根节点 display=' + r.rootDisplay + '，视口 ' + r.vw + '×' + r.vh + '，可见交互件 ' + r.items.length + ' 枚');
  r.items.forEach(function (x) {
    const bad = (!x.disabled && (x.w < FLOOR || x.h < FLOOR));
    say('   ' + (bad ? '[<' + FLOOR + '] ' : '  ') + x.w + '×' + x.h
      + '  top=' + x.top + (x.inFrame ? '' : ' （不在取景框内）')
      + (x.disabled ? '  disabled' : '')
      + (x.reachable ? '' : '  命中=' + x.hit + '（中心点打不到自己）')
      + '  ' + x.label + (x.txt ? '  「' + x.txt + '」' : ''));
  });
  say('   小结：低于 ' + FLOOR + 'px 地板 ' + r.under.length + ' 枚；中心点打不到自己 ' + r.unreachable.length + ' 枚');
  return r;
}

/* 动画收尾：只等「有限次」的动画跑完（index 上有无限循环的氛围动画，等它就把每一腿都拖成超时）；
   再补一帧稳定。判据不许比被测修复更松（[[geometry-measure-after-animation]]）。 */
async function settle(page, extra) {
  try {
    await page.waitForFunction(
      () => document.getAnimations().every(a => a.playState !== 'running'
        || (a.effect && a.effect.getTiming().iterations === Infinity)),
      { timeout: 4000 });
  } catch (e) { say('   （4s 内有限动画没收尾，按现状继续读：' + e.message.slice(0, 60) + '）'); }
  await sleep(extra || 260);
}

/* 浮层出现：waitForFunction 传表达式串时 `var` 不合法，一律走函数 */
async function waitShown(page, sel, ms) {
  await page.waitForFunction(s => {
    const e = document.querySelector(s);
    return !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  }, { timeout: ms || 10000 }, sel);
}

async function newPage(browser, url, beforeSeed) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push((e && e.message || e)));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(mkLabel());
  if (beforeSeed) await page.evaluate(beforeSeed);
  await page.evaluate(seedLocal);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
  /* reload 会把手挂没——枚举器全靠 window.__L，必须在 reload 之后重新挂一次 */
  await page.evaluate(mkLabel());
  await settle(page, 500);
  return { page, errs };
}

/* ================= 腿 ①：随手记面板族 ================= */
async function legPanel(browser) {
  say('');
  say('==================== 腿 ① 随手记面板族：触控目标实测（328×723 dpr2，地板 44px）====================');
  const { page, errs } = await newPage(browser, '/index.html');
  await page.evaluate('TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await waitShown(page, '.tn-panel');
  await settle(page);

  /* 面板里所有浮层当前的实际高度分布（.tn-panel inset 0 全铺，底部控件是量点） */
  say('· 录音/编辑屏（.tn-panel）');
  const rec = await enumRoot(page, '.tn-panel', 'rec');

  await page.evaluate('var q=document.getElementById("tnQuote");if(q)q.click();');
  await settle(page);
  const quo = await enumRoot(page, '#tnQuotes', 'quotes');
  /* 反证：#tnQuoteClear 中心点命中的是背后的 #tnTabExp——真鼠标点下去谁收到？
     判据看两件事：搜索框有没有被清空（=清钮赢了），档位有没有跳到「记开销」（=背后的档钮吃了这发）。*/
  await page.evaluate('var q=document.getElementById("tnQuoteSearch");if(q){q.value="云冈";q.dispatchEvent(new Event("input",{bubbles:true}));}');
  const cc = await page.evaluate(function () {
    const e = document.getElementById('tnQuoteClear');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (cc) {
    await page.mouse.click(cc.x, cc.y);
    await settle(page);
    const after = await page.evaluate(function () {
      const q = document.getElementById('tnQuoteSearch');
      return { value: q ? q.value : 'layer-gone',
        expOn: !!(document.getElementById('tnTabExp') && document.getElementById('tnTabExp').classList.contains('on')),
        panelExpense: (() => { const e = document.querySelector('.tn-panel'); return !!e && e.classList.contains('is-expense'); })(),
        quotesShown: (() => { const e = document.getElementById('tnQuotes'); return !!e && getComputedStyle(e).display !== 'none'; })() };
    });
    say('· 真鼠标点 #tnQuoteClear 中心（' + cc.x + ',' + cc.y + '）之后：' + JSON.stringify(after));
  }
  await page.evaluate('var x=document.getElementById("tnQuoteBack");if(x)x.click();');
  await settle(page);

  /* 造脏：转写框里打字，让关闭钮走 .tn-cfm 那条路 */
  await page.evaluate(function () {
    const t = document.getElementById('tnRawEdit') || document.querySelector('.tn-panel textarea');
    if (t) { t.value = '测试脏内容'; t.dispatchEvent(new Event('input', { bubbles: true })); }
    const t2 = document.getElementById('tnTitle');
    if (t2) { t2.value = '测试'; t2.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await sleep(200);
  await page.evaluate('var x=document.getElementById("tnX");if(x)x.click();');
  await settle(page);
  const cfm = await enumRoot(page, '.tn-cfm', 'cfm');
  if (!cfm.present) {
    const anyCfm = await page.evaluate('!!document.querySelector(".tn-cfm")');
    say('   （脏检查确认层没出来；文档里 .tn-cfm 在场=' + anyCfm + '）');
  }
  /* 走「关掉不保存」把面板收起，再开列表屏 */
  await page.evaluate(function () {
    /* .tc-ok 才是「关掉不保存」（travel-notes.js:1054 传的 okLabel），.tc-no 是「继续编辑」不关面板 */
    const b = document.querySelector('.tn-cfm .tc-ok');
    if (b) b.click();
  });
  await settle(page);

  await page.evaluate('TravelNotes.openList()');
  await waitShown(page, '.tn-list');
  await settle(page);
  const list = await enumRoot(page, '.tn-list', 'list');
  await page.evaluate('var t=document.getElementById("tnViewTime");if(t)t.click();');
  await settle(page);
  const listTime = await enumRoot(page, '.tn-list', 'list-时间线档（行卡动作钮）');

  await page.evaluate(function () {
    const b = document.querySelector('.tn-item [data-a="edit"]') || document.querySelector('[data-a="edit"]');
    if (b) b.click();
  });
  await settle(page);
  const edit = await enumRoot(page, '.tn-editpage', 'editpage');
  await page.evaluate(function () {
    const b = document.querySelector('.tn-editpage .tn-x') || document.querySelector('.tn-editpage button');
    if (b) b.click();
  });
  await settle(page);

  await page.evaluate('if(TravelNotes.zoomPhotoIdx)TravelNotes.zoomPhotoIdx("s3",0)');
  await settle(page);
  const viewer = await enumRoot(page, '.tn-viewer', 'viewer');

  say('· 面板族汇总（只数在屏上的）');
  const tot = [rec, quo, cfm, list, edit, viewer].filter(x => x.present);
  const all = tot.reduce((a, x) => a.concat(x.under), []);
  say('   低于 44px 的共 ' + all.length + ' 枚：' + all.map(x => x.label.replace(/^(button|a|input|span|div)/, '') + '(' + x.w + '×' + x.h + ')').join(' | '));
  say('   页面未捕获报错：' + (errs.length ? errs.join(' | ') : '0 条'));
  await page.close();
}

/* ================= 腿 ②：z 分层与备份提醒条 ================= */
async function legZ(browser) {
  say('');
  say('==================== 腿 ② 备份提醒条（index.html:498 z9500）与面板 9001 / .tn-cfm 9700 ====================');
  const { page } = await newPage(browser, '/index.html');

  const layers = async (tag) => page.evaluate(function (t) {
    const out = [];
    const sel = ['#tnPanel', '.tn-panel', '.tn-mask', '.tn-cfm', '.tn-editpage', '.tn-list', '.tn-quotes', '.tn-viewer', '.ob-mask', '.bottom-nav', '.tabbar', '.story-nav'];
    sel.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (e) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        out.push({ sel: s, label: window.__L(e), z: cs.zIndex, pos: cs.position,
          top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
          left: Math.round(r.left), w: Math.round(r.width) });
      });
    });
    /* 那条提醒条是内联样式的 DIV：按文本特征认，不靠 id */
    Array.from(document.body.children).forEach(function (e) {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed') return;
      if (e.id === 'tnPanel' || e.classList.contains('bottom-nav')) return;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      out.push({ sel: 'body>fixed', label: window.__L(e).slice(0, 60), z: cs.zIndex, pos: cs.position,
        top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
        left: Math.round(r.left), w: Math.round(r.width),
        txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) });
    });
    return { tag: t, vh: window.innerHeight, layers: out };
  }, tag);

  const dumpLayers = async (tag) => {
    const r = await layers(tag);
    say('· ' + tag + '（视口高 ' + r.vh + '）');
    r.layers.sort((a, b) => (+a.z || 0) - (+b.z || 0)).forEach(function (l) {
      say('   z=' + l.z + '  ' + l.pos + '  top=' + l.top + ' bottom=' + l.bottom + ' h=' + l.h
        + '  ' + l.sel + '  ' + l.label + (l.txt ? '  「' + l.txt + '」' : ''));
    });
    return r;
  };

  const bar = await page.evaluate(function () {
    const b = Array.from(document.body.children).find(function (e) {
      if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return false;
      return /距上次备份/.test(e.textContent || '');
    });
    if (!b) return { present: false };
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    const go = document.getElementById('bkGo');
    const gr = go ? go.getBoundingClientRect() : null;
    return { present: true, top: Math.round(r.top), bottom: Math.round(r.bottom),
      h: Math.round(r.height), w: Math.round(r.width), z: cs.zIndex,
      lastBackupKey: localStorage.getItem('tn_lastBackup'),
      goBtn: gr ? { w: Math.round(gr.width), h: Math.round(gr.height), top: Math.round(gr.top) } : null,
      ttl: '12000ms 后自动 remove' };
  });
  say('· 提醒条在场=' + bar.present + (bar.present
    ? '，rect top=' + bar.top + ' bottom=' + bar.bottom + ' h=' + bar.h + '，z=' + bar.z
      + '，#bkGo ' + (bar.goBtn ? bar.goBtn.w + '×' + bar.goBtn.h : 'null')
      + '，tn_lastBackup=' + bar.lastBackupKey + '（'+ '没写过 → `+null||0` → 恒判「超 30 天」' + '）'
    : ''));

  await dumpLayers('index 静止态');

  /* 面板打开后：条还压不压得住面板，以及它压住了面板里哪一枚控件 */
  await page.evaluate('TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await waitShown(page, '.tn-panel');
  await settle(page);
  const z2 = await dumpLayers('openPanel 之后');
  const hit = await page.evaluate(function () {
    const b = Array.from(document.body.children).find(function (e) {
      if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return false;
      return /距上次备份/.test(e.textContent || '');
    });
    if (!b) return { barGone: true };
    const br = b.getBoundingClientRect();
    const blocked = [];
    document.querySelectorAll('.tn-panel button, .tn-panel [role="button"]').forEach(function (e) {
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      if (cx < br.left || cx > br.right || cy < br.top || cy > br.bottom) return;
      const top = document.elementFromPoint(cx, cy);
      const own = !!top && (top === e || e.contains(top));
      blocked.push({ label: window.__L(e), txt: (e.textContent || '').trim().slice(0, 12),
        center: cx + ',' + cy, topEl: top ? window.__L(top).slice(0, 46) : 'null', ownHit: own });
    });
    /* 9px 网格：条覆盖范围内命中链的落点分布 */
    const grid = {}; let n = 0;
    for (let y = Math.ceil(br.top); y <= br.bottom; y += 9) {
      for (let x = Math.ceil(br.left); x <= br.right; x += 9) {
        const t = document.elementFromPoint(x, y);
        if (!t) continue;
        n++;
        const key = window.__L(t).slice(0, 40);
        grid[key] = (grid[key] || 0) + 1;
      }
    }
    const overlapPanel = (() => {
      const p = document.querySelector('.tn-panel');
      if (!p) return null;
      const pr = p.getBoundingClientRect();
      const ow = Math.max(0, Math.min(br.right, pr.right) - Math.max(br.left, pr.left));
      const oh = Math.max(0, Math.min(br.bottom, pr.bottom) - Math.max(br.top, pr.top));
      return { area: Math.round(ow * oh), pctOfBar: +(100 * ow * oh / ((br.right - br.left) * (br.bottom - br.top))).toFixed(1) };
    })();
    return { barGone: false, overlapPanel: overlapPanel, blocked: blocked,
      gridPoints: n, gridTop: Object.keys(grid).map(k => [k, grid[k]]).sort((a, b) => b[1] - a[1]).slice(0, 6) };
  });
  if (hit.barGone) say('· 面板打开时条已被 remove（要么 12s 到点，要么面板自己摘的）——那「压面板」不成立');
  else {
    say('· 面板打开时条仍在：与 .tn-panel 重叠面积 ' + (hit.overlapPanel ? hit.overlapPanel.area + ' px²（占条 ' + hit.overlapPanel.pctOfBar + '%）' : 'n/a'));
    say('   9px 网格命中链 top6：' + hit.gridTop.map(x => x[0] + '×' + x[1]).join(' | '));
    say('   中心点落进条矩形里的面板控件 ' + hit.blocked.length + ' 枚：');
    hit.blocked.forEach(function (b) {
      say('     ' + (b.ownHit ? '仍能命中自己' : '被条吃掉') + '  中心=' + b.center + '  顶层=' + b.topEl + '  ' + b.label + '「' + b.txt + '」');
    });
  }

  /* 确认层出现时：条 vs .tn-cfm（9700 > 9500） */
  await page.evaluate(function () {
    const t = document.getElementById('tnRawEdit') || document.querySelector('.tn-panel textarea');
    if (t) { t.value = '测试脏内容'; t.dispatchEvent(new Event('input', { bubbles: true })); }
    const t2 = document.getElementById('tnTitle');
    if (t2) { t2.value = '测试'; t2.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await sleep(200);
  await page.evaluate('var x=document.getElementById("tnX");if(x)x.click();');
  await settle(page);
  await dumpLayers('脏面板 .tn-cfm 出现时');
  const cfmOk = await page.evaluate(function () {
    const okb = document.querySelector('.tn-cfm .tc-ok');
    if (!okb) return null;
    const r = okb.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    return { rect: Math.round(r.width) + '×' + Math.round(r.height), top: Math.round(r.top),
      hit: top ? window.__L(top).slice(0, 46) : 'null', own: !!top && (top === okb || okb.contains(top)) };
  });
  say('· .tn-cfm 主按钮几何/命中：' + JSON.stringify(cfmOk));

  /* 反向对照：tn_lastBackup 写成「昨天」，条就不该出现 */
  const page2 = await (async () => {
    const p = await browser.newPage();
    await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.evaluate(mkLabel());
    await p.evaluate(function () {
      try { localStorage.clear(); } catch (e) {}
      localStorage.setItem('tn_onboarded', '1');
      localStorage.setItem('tn_lastBackup', String(Date.now() - 864e5));
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction('window.UI && window.TravelNotes', { timeout: 20000 });
    await sleep(700);
    return p;
  })();
  const bar2 = await page2.evaluate(function () {
    return !!Array.from(document.body.children).find(function (e) {
      if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return false;
      const cs = getComputedStyle(e);
      return cs.position === 'fixed' && /距上次备份/.test(e.textContent || '');
    });
  });
  say('· 反向对照：tn_lastBackup=昨天 → 提醒条在场=' + bar2 + '（应为 false；为 true 说明那 30 天门没有真的在算）');
  await page2.close();
  await page.close();
  void z2;
}

/* ================= 腿 ③：story 两屏 ================= */
async function legStory(browser) {
  say('');
  say('==================== 腿 ③ story：日卡时刻 + 底部翻页浮条的重叠带 ====================');
  const { page, errs } = await newPage(browser, '/story.html');
  await page.waitForFunction('document.querySelector(".story-card") || document.querySelector(".story-empty")', { timeout: 15000 });
  await settle(page, 500);

  const dates = await page.evaluate(function () {
    return Array.from(document.querySelectorAll('.story-card')).slice(0, 4).map(function (c) {
      const d = c.querySelector('.sc-date');
      const n = d ? (d.textContent || '').trim() : null;
      return { date: n,
        raw: null };
    });
  });
  const model = await page.evaluate(function () {
    const out = {};
    try {
      out.dayText = TravelNotes.dayText(TravelNotes.list()[0]);
      out.noteDay = TravelNotes.noteDay(TravelNotes.list()[0]);
      out.fmtClock = typeof TravelNotes.fmtClock === 'function' ? TravelNotes.fmtClock(TravelNotes.list()[0].ts) : 'no-fn';
      out.fmtDayText = typeof TravelNotes.fmtDayText === 'function' ? TravelNotes.fmtDayText(TravelNotes.list()[0].ts) : 'no-fn';
      out.rawDate = TravelNotes.list()[0].date;
    } catch (e) { out.err = e.message; }
    return out;
  });
  say('· 卡面日期实际读数：' + JSON.stringify(dates));
  say('· 出口对照（第一篇）：raw n.date=' + model.rawDate + ' | noteDay=' + model.noteDay
    + ' | dayText=' + model.dayText + ' | fmtDayText=' + model.fmtDayText + ' | fmtClock=' + model.fmtClock
    + (model.err ? ' | 取数异常=' + model.err : ''));
  say('· 判据：屏上有没有「时分」→ ' + (dates.every(d => d.date && /\d{1,2}:\d{2}/.test(d.date)) ? '有' : '没有（批次 31 统一口径顺手收掉了）'));

  const geom = await page.evaluate(function () {
    const nav = document.querySelector('.story-nav');
    const nr = nav.getBoundingClientRect();
    const cs = getComputedStyle(nav);
    const cards = Array.from(document.querySelectorAll('.story-card'));
    const texts = [];
    cards.forEach(function (c) {
      ['.sc-txt', '.sc-pics', '.sc-tags', '.sc-place'].forEach(function (s) {
        c.querySelectorAll(s).forEach(function (e) {
          const r = e.getBoundingClientRect();
          if (r.height > 0) texts.push({ sel: s, top: Math.round(r.top), bottom: Math.round(r.bottom) });
        });
      });
    });
    const band = (label) => {
      const ov = texts.filter(function (t) { return t.top < nr.bottom && t.bottom > nr.top; });
      const area = ov.reduce(function (a, t) {
        return a + Math.max(0, Math.min(t.bottom, nr.bottom) - Math.max(t.top, nr.top)) * Math.round(nr.width);
      }, 0);
      return { label: label, overlapped: ov.length, px2: area,
        firstOverlapTop: ov.length ? ov[0].top : null };
    };
    const out = {
      nav: { top: Math.round(nr.top), bottom: Math.round(nr.bottom), h: Math.round(nr.height),
        w: Math.round(nr.width), left: Math.round(nr.left), z: cs.zIndex,
        background: cs.backgroundColor, backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter },
      snBtn: Array.from(document.querySelectorAll('.story-nav .sn-btn')).map(function (b) {
        const r = b.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        return { id: b.id, w: Math.round(r.width), h: Math.round(r.height),
          disabled: !!b.disabled, hit: hit ? window.__L(hit).slice(0, 40) : 'null' };
      }),
      docHeight: Math.round(document.documentElement.scrollHeight),
      innerH: window.innerHeight,
      cardsCount: cards.length,
      cardsPadBottom: getComputedStyle(document.getElementById('cards')).paddingBottom,
      hasTabbar: !!document.querySelector('.bottom-nav, .tabbar'),
      scrollY: Math.round(window.scrollY)
    };
    out.bandAtCurrentScroll = band('当前滚动位');
    window.scrollTo(0, document.documentElement.scrollHeight);
    return out;
  });
  say('· 翻页浮条：top=' + geom.nav.top + ' bottom=' + geom.nav.bottom + ' h=' + geom.nav.h + ' w=' + geom.nav.w
    + ' z=' + geom.nav.z + ' 背景=' + geom.nav.background + ' backdrop=' + geom.nav.backdropFilter);
  say('· 条内两颗钮实测：' + JSON.stringify(geom.snBtn));
  say('· #cards padding-bottom=' + geom.cardsPadBottom + '，文档高 ' + geom.docHeight + '，视口高 ' + geom.innerH
    + '，卡片数 ' + geom.cardsCount + '，本页有底部导航=' + geom.hasTabbar);
  say('· 起始滚动位重叠：' + JSON.stringify(geom.bandAtCurrentScroll));

  await settle(page, 400);
  const atMax = await page.evaluate(function () {
    const nav = document.querySelector('.story-nav');
    const nr = nav.getBoundingClientRect();
    const texts = [];
    document.querySelectorAll('.story-card .sc-txt, .story-card .sc-pics, .story-card .sc-tags').forEach(function (e) {
      const r = e.getBoundingClientRect();
      if (r.height > 0) texts.push({ sel: (e.className || ''), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    });
    const ov = texts.filter(function (t) { return t.top < nr.bottom && t.bottom > nr.top; });
    /* 正文行的行高逐行量：把条覆盖的那几行按 line-height 拆开，报「被压的行数」 */
    const lines = [];
    document.querySelectorAll('.story-card .sc-txt').forEach(function (e) {
      const lh = parseFloat(getComputedStyle(e).lineHeight) || 20;
      const r = e.getBoundingClientRect();
      if (r.bottom < nr.top || r.top > nr.bottom) return;
      const covered = Math.max(0, Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top));
      lines.push({ top: Math.round(r.top), totalLines: Math.round(r.height / lh), coveredLines: +(covered / lh).toFixed(2) });
    });
    return { scrollY: Math.round(window.scrollY),
      gapLastCardToNav: (() => {
        const c = document.querySelector('.story-card:last-child');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return Math.round(nr.top - r.bottom);
      })(),
      overlappedBlocks: ov.length, overlapped: ov.slice(0, 6), textLines: lines };
  });
  say('· 最大滚动位（scrollY=' + atMax.scrollY + '）：最后一张卡底到条顶 ' + atMax.gapLastCardToNav + ' px');
  say('   落在条带里的内容块 ' + atMax.overlappedBlocks + ' 个：' + JSON.stringify(atMax.overlapped));
  say('   其中正文段落被压的行数：' + JSON.stringify(atMax.textLines));

  /* 中间滚动位：用户读卡片时最常停的地方 */
  const mid = await page.evaluate(function () {
    const nav = document.querySelector('.story-nav');
    const nr = nav.getBoundingClientRect();
    const res = [];
    for (let y = 0; y <= document.documentElement.scrollHeight - window.innerHeight; y += 180) {
      window.scrollTo(0, y);
      const hits = [];
      document.querySelectorAll('.story-card .sc-txt').forEach(function (e) {
        const lh = parseFloat(getComputedStyle(e).lineHeight) || 20;
        const r = e.getBoundingClientRect();
        if (r.bottom < nr.top || r.top > nr.bottom) return;
        hits.push({ scrollY: Math.round(window.scrollY),
          coveredLines: +((Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top)) / lh).toFixed(2),
          totalLines: Math.round(r.height / lh) });
      });
      res.push(hits);
    }
    window.scrollTo(0, 0);
    return res.filter(function (h) { return h.length; });
  });
  say('· 逐 180px 扫滚动位：有 ' + mid.length + ' 个停靠位存在「正文段落被条带压住」，样本 ' + JSON.stringify(mid.slice(0, 5)));

  say('· story 未捕获报错：' + (errs.length ? errs.join(' | ') : '0 条'));
  await page.close();
}

(async () => {
  const srv = staticServer();
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2']
  });
  try {
    await legPanel(browser);
    await legZ(browser);
    await legStory(browser);
  } finally {
    await browser.close();
    srv.close();
    dump();
    say('');
    say('=== probe33-touch 跑完 ===');
    dump();
  }
})().catch(e => { console.log('探针异常：' + (e && e.stack || e)); dump(); process.exit(1); });
