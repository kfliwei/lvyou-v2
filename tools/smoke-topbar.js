/* tools/smoke-topbar.js — 批次 25-B「顶栏一族」真实浏览器闸门（rect 量化，不读源码字符串）
 *
 * 用户报的三条症状都在**真机 CSS 视口 328×723** 上（一加 Ace 6T，ColorOS「显示大小」拉满 →
 * Override density 620 → 1272/(620/160)≈328），外加批次 25-B 普查时补出来的第四颗
 * （story.html 顶栏那颗 34px 的换故事下拉）。改前实测（tools/out/b25b-probe-before.txt）：
 *   · wishlist.html 标题 clientW **2px**（四个字一个都看不见），travel-map.html **62px**；
 *   · node-manager.html 详情卡四枚 .is-btn 各 61px 宽，「语音记录」断成 **3 行**；
 *   · 顶栏可点控件 40×40（返回键、跳转圆钮、mic、移除钮）——同一族几何在
 *     design.css / map.css / 页内 <style> / 内联 style 各写一遍，谁后加载谁说了算；
 *   · planner.html 顶栏被挤成两行（63→115px），因为标题 flex-basis:auto 的**假想主轴宽**
 *     等于整条 nowrap 文案宽，装箱时那枚 44 的钮被单独挤下去。
 * 收口过程中普查另捞出三处同族，一并量化进本闸门：
 *   · 地图浮控件：design.css 把钮点名成 36，玻璃柱的**宽**还是各页自己写的 44/40，
 *     按钮贴左、右侧空一条（实测留白 0/8 与 0/4 → K31）；
 *   · 内容区「移除／删除／打开附件」三枚 40px（`.ck-remove`／`.ech-del`／`.tb-open`），
 *     与 `.wl-remove` 同一语义却不同档 → K32；
 *   · story.html 那颗 34px 换故事下拉 → K27。
 *
 * 为什么必须量 rect：这一族的错法在界面上是「字变小/断行/钮变小」，源码字符串完全看不出来；
 * 而「看上去对」的读数（scrollWidth==clientWidth）也不够——断字不产生溢出，只产生第二行。
 * 所以标题下限按 **7em**（= 本档 7 个汉字）量、按钮按「逐 childNode 的 rect.top 是否同排」量。
 *
 * 判据口径（两条踩过坑的规矩）：
 *   ① 取样档位必须是被测对象真落到的那一档：328×723（真机主档）**和** 320×640（装箱最紧），
 *      只跑 452 就是批次 23-D 那次「验的是一台不存在的手机」的同一个形状。
 *   ② `lines` 不能只看 Range client rects 聚类：design.css 的 `.ti` 图标是按 flex 父容器写的，
 *      放进普通 block 按钮会下沉 1.5–2px（实测 svg top680 / 文字 top675），Range 会把一枚
 *      单行按钮数成「2 行」假阳性。所以 K15 走逐 childNode 的 rect，并在产品侧给带图标的按钮
 *      统一挂 `.ic`（inline-flex + align-items:center）。
 *
 * 用法：node tools/smoke-topbar.js
 */
const path = require('path');
const puppeteer = require(path.join(__dirname, 'node_modules', 'puppeteer-core'));

const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const ran = [];
function ok(name, cond, extra) {
  /* 齐备检认「id + 空格」这一形状（§31 的教训：只认前缀的话，改名成 K15x 这条判据就静默消失） */
  ran.push(String(name).split(' ')[0]);
  const pass = !!cond;
  if (!pass) fails++;
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + (extra === undefined ? '' : '  [' + extra + ']'));
  return pass;
}

/* 顶栏宿主：三张页各自的历史名字，都算「同一个一族」——K00 就是钉这张名单。 */
const BAR_PAGES = ['travel-map.html', 'expense.html', 'trip.html', 'checklist.html', 'md-manager.html',
  'me.html', 'node-manager.html', 'planner.html', 'settings.html', 'wishlist.html',
  'explore-map.html', 'review.html', 'story.html'];
const WRAPPED_OK = ['wishlist.html'];            /* 允许付垂直空间（动作组整组换行）的页 */

/* ---------- 页面侧探针 ---------- */
const BAR = `(() => {
  const bar = document.querySelector('.topbar') || document.querySelector('.nm-topbar') || document.querySelector('.story-bar');
  if (!bar) return { none: true };
  const bb = bar.getBoundingClientRect();
  const items = [];
  bar.querySelectorAll('button,a,select,input,[role=button]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.height) return;
    items.push({ cls: el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\\s+/)[0],
      w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom),
      aria: el.getAttribute('aria-label') || '' });
  });
  const t = bar.querySelector('.title');
  const tcs = t ? getComputedStyle(t) : null;
  const row = bar.querySelector('.t-row');
  const acts = bar.querySelector('.trow-acts');
  const de = document.documentElement;
  return {
    barH: Math.round(bb.height), barBottom: Math.round(bb.bottom),
    items: items,
    title: t ? { text: (t.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 20),
      clientW: t.clientWidth, scrollW: t.scrollWidth, fs: parseFloat(tcs.fontSize),
      trunc: t.scrollWidth > t.clientWidth + 1, te: tcs.textOverflow, ov: tcs.overflow,
      minW: tcs.minWidth, basis: tcs.flexBasis } : null,
    rowKids: row ? row.children.length : 0,
    actsTops: acts ? Array.from(acts.children).map(c => Math.round(c.getBoundingClientRect().top)) : null,
    actsBottom: acts ? Math.round(acts.getBoundingClientRect().bottom) : null,
    docScrollW: de.scrollWidth, clientW: de.clientWidth,
  };
})()`;

/* 专题页顶栏：BAR_PAGES 那 13 页里没有 topic.html，K08 的 barH 检对它失明（批次 25-B 的
   「游记被顶到第二行」就是像素闸门先看见的）。这里只取 K33 要用的三件事：行高、两颗动作钮的
   真 rect 与 .act-label 在不在、aria-label 有没有保住。 */
const TOPICBAR = `(() => {
  const row = document.querySelector('.t-row');
  if (!row) return { rowH: -1, acts: [] };
  return { rowH: Math.round(row.getBoundingClientRect().height),
    acts: Array.from(row.querySelectorAll('.act')).map(b => {
      const lab = b.querySelector('.act-label'); const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), aria: b.getAttribute('aria-label') || '',
        labelShown: !!lab && lab.getBoundingClientRect().height > 0 };
    }) };
})()`;

/* 逐 childNode 的行判定：文本节点自建 Range，元素节点用自身 rect。
   同一枚按钮里出现两个相距 >4px 的 top ＝ 内容被排成了两排（断字或图标下沉）。 */
const ISACTS = `(() => {
  const box = document.querySelector('#infoSheet .is-acts');
  if (!box) return { none: true };
  const bcs = getComputedStyle(box);
  return {
    boxCount: document.querySelectorAll('#infoSheet .is-acts').length,
    wrap: bcs.flexWrap, display: bcs.display, boxW: Math.round(box.getBoundingClientRect().width),
    btns: Array.from(box.children).map(b => {
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      const tops = [];
      Array.from(b.childNodes).forEach(n => {
        let rr = null;
        if (n.nodeType === 3 && (n.textContent || '').trim()) { const rg = document.createRange(); rg.selectNodeContents(n); rr = rg.getBoundingClientRect(); }
        else if (n.nodeType === 1) { rr = n.getBoundingClientRect(); }
        if (rr && rr.width && rr.height) { if (!tops.some(x => Math.abs(x - rr.top) < 4)) tops.push(Math.round(rr.top)); }
      });
      return { txt: (b.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 10),
        w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
        nowrap: cs.whiteSpace === 'nowrap', clipped: b.scrollWidth > b.clientWidth + 1,
        rows: tops.length, disp: cs.display, align: cs.alignItems,
        ic: b.classList.contains('ic') };
    }) };
})()`;

async function newPage(browser, vp, seeds) {
  const p = await browser.newPage();
  await p.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
  p.__errs = [];
  p.on('pageerror', e => p.__errs.push('pageerror: ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error') p.__errs.push('console: ' + String(m.text()).slice(0, 120)); });
  if (seeds) await p.evaluateOnNewDocument(seeds);
  return p;
}
const WISH_SEED = () => {
  localStorage.setItem('tn_wishlist', JSON.stringify([
    { id: '鹳雀楼|40.5|110.2', label: '鹳雀楼', theme: '古城', region: '山西', city: '运城', lat: 40.5, lng: 110.2, ts: 1, visited: 0 },
    { id: '平遥古城|37.2|112.18', label: '平遥古城', theme: '古城', region: '山西', city: '晋中', lat: 37.2, lng: 112.18, ts: 2, visited: 0 }]));
  localStorage.setItem('tn_onboarded', '1');
};
const NODE_SEED = () => {
  localStorage.setItem('tn_userNodes', JSON.stringify([
    { id: 'u-kg', name: '自定义地点观测点', category: '观景点', city: '北京', lat: 39.915, lng: 116.404, tags: ['自采'], ts: 1 }]));
};
const load = async (p, file, ms) => {
  await p.goto('file:///' + ROOT + file, { waitUntil: 'load', timeout: 60000 });
  await sleep(ms || 1500);
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const allErrs = [];
  const V328 = { width: 328, height: 723 };
  const V320 = { width: 320, height: 640 };

  /* ============ A. 顶栏一族（13 页 × 328 + 320 两档） ============ */
  const hosts = [], lowAll = [], fortyAll = [], titleShort = [], noEllipsis = [], overflow = [],
    actsSplit = [], clippedBar = [], wrappedPages = [], backBad = [];
  for (const vp of [V328, V320]) {
    for (const f of BAR_PAGES) {
      const p = await newPage(browser, vp, f === 'wishlist.html' ? WISH_SEED : null);
      await load(p, f, f === 'node-manager.html' ? 5200 : 1700);
      const b = await p.evaluate(BAR);
      const tag = vp.width + '/' + f;
      if (b.none) { hosts.push(tag); await p.close(); continue; }
      allErrs.push.apply(allErrs, (p.__errs || []).map(e => tag + ' ' + e));
      hosts.push(tag);
      b.items.forEach(it => {
        if (it.h < 44) lowAll.push(tag + ' ' + it.cls + '=' + it.w + '×' + it.h);
        if (it.w === 40 || it.h === 40) fortyAll.push(tag + ' ' + it.cls + '=' + it.w + '×' + it.h);
      });
      if (b.title) {
        const floor = b.title.fs * 7;
        if (b.title.clientW < floor - 1) titleShort.push(tag + ' ' + b.title.clientW + '<' + floor.toFixed(1) + '「' + b.title.text + '」');
        if (b.title.trunc && !(b.title.te === 'ellipsis' && /hidden/.test(b.title.ov))) noEllipsis.push(tag + ' ' + JSON.stringify([b.title.te, b.title.ov]));
      }
      if (b.docScrollW > b.clientW) overflow.push(tag + ' ' + b.docScrollW + '>' + b.clientW);
      if (b.actsTops && b.actsTops.length > 1 && new Set(b.actsTops).size > 1) actsSplit.push(tag + ' tops=' + b.actsTops.join(','));
      const lows = b.items.filter(it => it.bottom > b.barBottom + 1);
      if (lows.length) clippedBar.push(tag + ' ' + lows.map(x => x.cls + '@' + x.bottom).join(','));
      if (b.actsBottom !== null && b.actsBottom > b.barBottom + 1) clippedBar.push(tag + ' acts@' + b.actsBottom);
      if (b.barH > 70) wrappedPages.push(tag + '=' + b.barH);
      const back = b.items.filter(x => /^button\.back|^a\.back/.test(x.cls))[0];
      if (back && (back.w !== 44 || back.h !== 44)) backBad.push(tag + ' back=' + back.w + '×' + back.h);
      await p.close();
    }
  }
  ok('K00 分母自检：13 页顶栏宿主 × 2 档都读到（读到 none 或漏页＝某一页把顶栏改名/整页漏测）',
    hosts.length === BAR_PAGES.length * 2 && !hosts.some(h => h.indexOf('[') >= 0), hosts.length + ' 条');
  ok('K01 顶栏内可点控件零矮于 44px（含 select/input——批次 25-B 普查就是靠把这两类加进选择器才捞出 story 那颗 34px 下拉）',
    lowAll.length === 0, lowAll.slice(0, 5).join(' | ') || '0 条');
  ok('K02 顶栏内 40×40 一族零残留（改前 13 页里 11 页命中；这族曾经的错法是 design.css/map.css/页内联/内联 style 各写一遍，谁后加载谁说了算）',
    fortyAll.length === 0, fortyAll.slice(0, 5).join(' | ') || '0 条');
  ok('K03 标题可读下限＝7em（本档 7 个汉字）：装不下宁可换行，也不许把标题压成 2px（改前 wishlist 2／travel-map 62）',
    titleShort.length === 0, titleShort.slice(0, 5).join(' | ') || '0 条');
  ok('K04 标题被截断时必须是省略号截断（overflow:hidden + text-overflow:ellipsis），不许硬裁成半个字',
    noEllipsis.length === 0, noEllipsis.slice(0, 4).join(' | ') || '0 条');
  ok('K05 手机两档零横向溢出（顶栏换行/纯图标退档都不该把布局视口撑宽）',
    overflow.length === 0, overflow.slice(0, 5).join(' | ') || '0 条');
  ok('K06 动作组整组换行：.trow-acts 内所有孩子同一排（贪心装箱会留「一枚孤钮掉第二行」，按行装箱必须整组走）',
    actsSplit.length === 0, actsSplit.slice(0, 4).join(' | ') || '0 条');
  ok('K07 顶栏盒包住盒内一切（改前 map.css 的 .t-row{height:42px} 会把换行第二行直接裁掉，界面看不出问题、点也点不到）',
    clippedBar.length === 0, clippedBar.slice(0, 4).join(' | ') || '0 条');
  const wrappedPages2 = Array.from(new Set(wrappedPages.map(t => t.split('/')[1].split('=')[0])));
  ok('K08 付垂直空间的页恰是白名单（只有 wishlist 的顶栏是两行，barH>70 的其它页＝某页退档失效或被挤成两行）',
    wrappedPages2.join(',') === WRAPPED_OK.join(',') && wrappedPages.length === WRAPPED_OK.length * 2,
    wrappedPages.join(' | '));
  ok('K09 每页返回键 .back 实测 44×44（.t-ic 与它同一条 CSS，两档 26 页次里不许有一枚漂回 40/36）',
    backBad.length === 0, backBad.slice(0, 4).join(' | ') || '0 条');

  /* ============ B. node-manager.html 详情卡 .is-btn（断字那一族） ============ */
  const pn = await newPage(browser, V328, NODE_SEED);
  await load(pn, 'node-manager.html', 5200);
  await pn.evaluate(() => { const q = document.getElementById('q'); q.value = '故宫'; });
  await pn.click('#qGo'); await sleep(1500);
  await pn.evaluate(() => { const it = document.querySelector('#rsBody .rs-item[data-k="local"]'); if (it) it.click(); });
  await sleep(1100);
  const sys = await pn.evaluate(ISACTS);
  ok('K10 系统地点详情：#infoSheet 里 .is-acts 恰一枚，按钮都读到了（分母自检，缺容器就没法把「0 条违规」当证据）',
    !sys.none && sys.boxCount === 1 && sys.btns.length >= 3, sys.none ? 'no-acts' : JSON.stringify([sys.boxCount, sys.btns.length]));
  ok('K11 每枚 .is-btn 计算样式 white-space:nowrap（CJK 可在任意字符断行，改前 61px 的钮把「语音记录」排成 3 行）',
    sys.btns.every(b => b.nowrap), JSON.stringify(sys.btns.map(b => [b.txt, b.nowrap])));
  ok('K12 每枚 .is-btn 高度 ≥44px（弹层主操作，口径里的高频）',
    sys.btns.every(b => b.h >= 44), JSON.stringify(sys.btns.map(b => b.h)));
  ok('K13 每枚标签没被压断（scrollWidth ≤ clientWidth：nowrap 之后装不下必须由容器换行，而不是裁字）',
    sys.btns.every(b => !b.clipped), JSON.stringify(sys.btns.map(b => [b.txt, b.clipped])));
  ok('K14 .is-acts 的 flex-wrap＝wrap（nowrap 的标签配上可换行的容器，才既有整条标签又不裁字）',
    sys.wrap === 'wrap', 'wrap=' + sys.wrap);
  ok('K15 带图标的按钮逐 childNode 同排（rows===1 且 align-items:center）：改前 .ti 在 block 按钮里下沉 5px，Range 数行会把这读成断字假阳性，所以量 rect 而不是数行数',
    sys.btns.filter(b => b.ic).length >= 2 && sys.btns.every(b => b.rows === 1) &&
      sys.btns.filter(b => b.ic).every(b => /flex/.test(b.disp) && b.align === 'center'),
    JSON.stringify(sys.btns.map(b => [b.txt, b.rows, b.ic])));
  /* 我的地点详情：按钮更多（编辑/想去/语音/删除/关闭），比系统地点更容易装不下 */
  await pn.evaluate(() => window.NM.closeInfo()); await sleep(400);
  await pn.evaluate(() => window.NM.locate('u-kg')); await sleep(1600);
  await pn.evaluate(() => {
    const m = Array.from(document.querySelectorAll('#mapEl .leaflet-marker-icon')).filter(x => x.querySelector('.tr-user'))[0];
    if (m) m.click();
  });
  await sleep(900);
  const usr = await pn.evaluate(ISACTS);
  ok('K16 我的地点详情（多一枚按钮的那张卡）同样：整组 wrap、每枚 nowrap、每枚 ≥44、每条标签不裁',
    !usr.none && usr.boxCount === 1 && usr.wrap === 'wrap' && usr.btns.length >= 4 &&
      usr.btns.every(b => b.nowrap && b.h >= 44 && !b.clipped && b.rows === 1),
    usr.none ? 'no-acts' : JSON.stringify(usr.btns.map(b => [b.txt, b.w, b.h, b.rows])));
  const twice = await pn.evaluate(() => {
    const before = document.querySelectorAll('#infoSheet .is-acts').length;
    window.NM.closeInfo();
    return before;
  });
  await sleep(400);
  await pn.evaluate(() => {
    const m = Array.from(document.querySelectorAll('#mapEl .leaflet-marker-icon')).filter(x => x.querySelector('.tr-user'))[0];
    if (m) m.click();
  });
  await sleep(900);
  const again = await pn.evaluate(ISACTS);
  ok('K17 二次打开详情不叠 DOM（.is-acts 仍恰一枚、按钮数不变：内框重画要整段替换，append 会把动作组越叠越长）',
    twice === 1 && !again.none && again.boxCount === 1 && again.btns.length === usr.btns.length,
    JSON.stringify([twice, again.boxCount, again.btns.length, usr.btns.length]));

  /* ============ C. ≤360 退档 + 地图浮控件 36px 点名 ============ */
  const tm328 = await newPage(browser, V328);
  await load(tm328, 'travel-map.html', 2800);
  const c328 = await tm328.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const acts = Array.from(document.querySelectorAll('.t-row .act'));
    const ctl = document.querySelector('.ctl'), lay = document.querySelector('.laymenu');
    const cr = ctl.getBoundingClientRect();
    const btns = Array.from(ctl.querySelectorAll('button')).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    /* 留白：按钮左右各离盒子边缘多远。盒子是各页自己写的宽（travel-map 44／topic 40），
       按钮尺寸由 design.css 点名成 36——两边没人对账时按钮就贴左、右侧空一条。 */
    const gaps = Array.from(ctl.querySelectorAll('button')).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left - cr.left), Math.round(cr.right - r.right)]; });
    return {
      acts: acts.map(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
        const lab = b.querySelector('.act-label');
        return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius,
          labelShown: !!lab && lab.getBoundingClientRect().height > 0, aria: b.getAttribute('aria-label') || '' }; }),
      barBottom: Math.round(bar.bottom), ctlTop: Math.round(cr.top),
      ctlH: Math.round(cr.height), layTop: lay ? Math.round(lay.getBoundingClientRect().top) : null,
      ctlBtns: btns, ctlGaps: gaps,
    };
  });
  ok('K18 真机档 328：travel-map 两颗动作钮退成 44×44 圆钮（标题因此拿回可读宽度；地图页顶栏不能长第二行压瓦片）',
    c328.acts.length === 2 && c328.acts.every(a => a.w === 44 && a.h === 44), JSON.stringify(c328.acts));
  ok('K19 真机档 328：退成图标时 .act-label 收起（文字留着就是 96px 装不下，正是改前把标题压到 62px 的那只手）',
    c328.acts.every(a => !a.labelShown), JSON.stringify(c328.acts.map(a => a.labelShown)));
  ok('K20 真机档 328：名字靠 aria-label 保住（收掉文字不等于收掉可访问名，§36 那套口径不许被这批改坏）',
    c328.acts.every(a => a.aria.length > 0), JSON.stringify(c328.acts.map(a => a.aria)));
  const tm452 = await newPage(browser, { width: 452, height: 995 });
  await load(tm452, 'travel-map.html', 2800);
  const c452 = await tm452.evaluate(() => Array.from(document.querySelectorAll('.t-row .act')).map(b => {
    const lab = b.querySelector('.act-label'); const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), labelShown: !!lab && lab.getBoundingClientRect().height > 0 };
  }));
  ok('K21 452 档：文字标签仍在（退档是 ≤360 定向的，不是把全站顶栏按钮删字；阈值写错成 700 这条就红）',
    c452.length === 2 && c452.every(a => a.labelShown && a.w > 44), JSON.stringify(c452));
  ok('K22 真机档 328：右上控件组 top ≥ 顶栏下缘（--tb-h 挂在 body 上，因为 .ctl/.laymenu 是顶栏的兄弟，自定义属性只往下继承；改前写死 56px 会压在 44 的顶栏上）',
    c328.ctlTop >= c328.barBottom, JSON.stringify([c328.ctlTop, c328.barBottom]));
  ok('K23 .ctl 里的缩放钮恰 36×36（**点名允许**低于 44：有双指手势替代，且浮在地图上；抬到 44 会挤掉瓦片可读区，所以尺寸漂回 40 也要红）',
    c328.ctlBtns.length >= 2 && c328.ctlBtns.every(x => x[0] === 36 && x[1] === 36), JSON.stringify(c328.ctlBtns));
  const zoomNm = await pn.evaluate(() => Array.from(document.querySelectorAll('.leaflet-control-zoom a')).map(a => {
    const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)];
  }));
  ok('K24 node-manager 的 Leaflet 缩放控件恰 36×36（同一族第二处：页内联从前写 40px，靠后加载盖掉 design.css）',
    zoomNm.length === 2 && zoomNm.every(x => x[0] === 36 && x[1] === 36), JSON.stringify(zoomNm));

  /* ============ D. 一族其余成员（内容区里的 44 族） ============ */
  const pw = await newPage(browser, V328, WISH_SEED);
  await load(pw, 'wishlist.html', 2200);
  const wl = await pw.evaluate(() => {
    const b = document.querySelector('.wl-remove');
    const row = b ? b.parentElement.getBoundingClientRect() : null;
    const r = b ? b.getBoundingClientRect() : null;
    return { rm: r ? [Math.round(r.width), Math.round(r.height)] : null,
      aria: b ? b.getAttribute('aria-label') || '' : '',
      rowRight: row ? Math.round(row.right) : 0, cw: document.documentElement.clientWidth };
  });
  ok('K25 wishlist 条目「移除」钮 44×44（破坏性操作在设计标准的豁免之外，改前 40×40；它不在顶栏里，K01 抓不到，必须单列）',
    wl.rm && wl.rm[0] === 44 && wl.rm[1] === 44 && /移除/.test(wl.aria), JSON.stringify(wl));
  const ps = await newPage(browser, V328);
  await load(ps, 'search.html', 2200);
  const mic = await ps.evaluate(() => { const m = document.querySelector('.sbar .mic'); if (!m) return null; const r = m.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  ok('K26 搜索页录音钮 44×44（改前 40，且 design.css 的 !important 与页内联 40 同特异度、后加载者赢——这一族的错法是两处各写一遍）',
    mic && mic[0] === 44 && mic[1] === 44, JSON.stringify(mic));
  const pty = await newPage(browser, V328);
  await load(pty, 'story.html', 2200);
  const sel = await pty.evaluate(() => { const s = document.querySelector('.story-bar select'); if (!s) return null; const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  ok('K27 story 换故事下拉 44px 高（批次 25-B 普查补出来的第四颗：34px 既不在高频档也不在 36 的点名豁免里）',
    sel && sel[1] === 44, JSON.stringify(sel));
  const pt = await newPage(browser, V328);
  await load(pt, 'topic.html?theme=古城', 3400);
  const mv = await pt.evaluate(() => {
    const row = document.getElementById('tripRow'); if (!row) return null;
    const mk = cls => { const b = document.createElement('button'); b.className = cls; b.textContent = '↑'; row.appendChild(b); const cs = getComputedStyle(b); const o = [cs.minWidth, cs.minHeight]; b.remove(); return o; };
    const ctl = document.querySelector('.ctl');
    const cg = ctl ? Array.from(ctl.querySelectorAll('button')).map(b => { const r = b.getBoundingClientRect(), cr = ctl.getBoundingClientRect(); return [Math.round(r.left - cr.left), Math.round(cr.right - r.right)]; }) : null;
    return { bar: getComputedStyle(document.getElementById('tripBar')).display, mv: mk('mv'), x: mk('x'), ctlGaps: cg };
  });
  ok('K28 行程条的上下移/删除 computed min ≥44px（驾驶场景高频；条形默认收起没有真 rect，所以量 computed min-*——注意这条只守 CSS 不守调用点）',
    mv && mv.mv[0] === '44px' && mv.mv[1] === '44px' && mv.x[0] === '44px' && mv.x[1] === '44px', JSON.stringify(mv));
  ok('K31 地图浮控件在玻璃柱里左右留白相等（travel-map 盒 44／topic 盒 40，按钮是点名允许的 36：改前留白 0/8 与 0/4——design.css 把钮收到 36 之后各页的盒宽没人对齐，图标贴左、柱子右侧空一条）',
    !!c328.ctlGaps && c328.ctlGaps.length >= 2 && c328.ctlGaps.every(g => Math.abs(g[0] - g[1]) <= 1) &&
    !!mv && !!mv.ctlGaps && mv.ctlGaps.every(g => Math.abs(g[0] - g[1]) <= 1),
    JSON.stringify([c328.ctlGaps, mv && mv.ctlGaps]));

  /* ============ D2. 内容区「移除／删除／打开附件」一族（不在顶栏里，K01 抓不到） ============ */
  const pck = await newPage(browser, V328);
  await load(pck, 'checklist.html?trip=p111', 2200);
  const ckq = await pck.evaluate(() => ({
    ck: (() => { const b = document.createElement('button'); b.className = 'ck-remove'; document.body.appendChild(b); const cs = getComputedStyle(b); const o = [cs.width, cs.height]; b.remove(); return o; })(),
    tb: (() => { const b = document.createElement('button'); b.className = 'tb-open'; document.body.appendChild(b); const cs = getComputedStyle(b); const o = [cs.width, cs.height]; b.remove(); return o; })(),
  }));
  const pal = await newPage(browser, V328);
  await load(pal, 'album-edit.html', 2200);
  const alq = await pal.evaluate(() => {
    const b = document.createElement('button'); b.className = 'ech-del'; document.body.appendChild(b);
    const cs = getComputedStyle(b); const o = [cs.width, cs.height, cs.borderRadius]; b.remove(); return o;
  });
  ok('K32 内容区那三枚「移除／删除／打开附件」computed 44×44（.ck-remove／.ech-del／.tb-open：与 .wl-remove 同一档，尺寸只在 design.css 点名，页内只留皮肤。口径同 K28——注入探针只守 CSS，不守调用点）',
    ckq.ck.join(',') === '44px,44px' && ckq.tb.join(',') === '44px,44px' && alq[0] === '44px' && alq[1] === '44px',
    JSON.stringify([ckq, alq]));

  /* ============ D3. 顶栏一族分母之外的那一页（K08 的盲区） ============ */
  /* BAR_PAGES 那 13 页里没有 topic.html，所以 K08「barH>70 只许 wishlist」从没量过专题页。
     批次 25-B 把标题下限收到 7em 之后，专题页在 328/320 放不下「返回+标题+随手记+游记」，
     「游记」被顶到第二行：t-row 44→96，整条顶栏 137→189，下面的专题地图凭空少 52 CSS px 可用高。
     这一档只有像素闸门（topic.328x723 残差 32.85%）看得见——所以补这条浏览器腿，把「退档」的口径
     从 travel-map 一页扩到同族的专题页。 */
  const tq328 = await pt.evaluate(TOPICBAR);
  const tq320 = await newPage(browser, V320);
  await load(tq320, 'topic.html?theme=古城', 3400);
  const tq320b = await tq320.evaluate(TOPICBAR);
  const tq390 = await newPage(browser, { width: 390, height: 844 });
  await load(tq390, 'topic.html?theme=古城', 3400);
  const tq390b = await tq390.evaluate(TOPICBAR);
  const iconOnly = function (t) {
    return t.rowH <= 60 && t.acts.length === 2 && t.acts.every(a => a.w === 44 && a.h === 44 && a.aria && !a.labelShown);
  };
  ok('K33 专题页顶栏在 328/320 两档仍是一行、两颗动作钮退成 44 圆钮且名字靠 aria-label 保住（topic.html 不在 K00–K08 的 13 页分母里，这条是它唯一的闸门腿；退档失效→第二行会红，阈值写错到 700→390 那颗标签没了也会红）',
    iconOnly(tq328) && iconOnly(tq320b) &&
    tq390b.rowH <= 60 && tq390b.acts.length === 2 && tq390b.acts.every(a => a.labelShown && a.w > 44),
    JSON.stringify([tq328, tq320b, tq390b]));

  /* ============ E. 全程零报错 + 条数守卫 ============ */
  const NOISE = /Failed to load resource|net::|ERR_|manifest\.webmanifest|瓦片|tile|Failed to fetch|favicon/i;
  const real = allErrs.concat((pn.__errs || []), (tm328.__errs || []), (tm452.__errs || []), (pw.__errs || []), (ps.__errs || []), (pty.__errs || []), (pt.__errs || []), (pck.__errs || []), (pal.__errs || []), (tq320.__errs || []), (tq390.__errs || [])).filter(e => !NOISE.test(e));
  ok('K29 全程零真实页面报错（几何收口不许把任何一页改崩）',
    real.length === 0, real.slice(0, 3).join(' | ') || '0 条');
  const EXPECT = [];
  for (let i = 0; i <= 33; i++) EXPECT.push('K' + String(i).padStart(2, '0'));
  ok('K30 条数与齐备检：K00–K33 除自身外全部执行且 ≥33 条（少一条或改名成 K15x 都要红——§31 那课：判据齐备检只认前缀会自己消失）',
    EXPECT.every(e => e === 'K30' || ran.indexOf(e) >= 0) && new Set(ran).size >= 33,
    '执行 ' + new Set(ran).size + ' 条 / 期望 ' + (EXPECT.length - 1) + ' 条' +
      (EXPECT.filter(e => e !== 'K30' && ran.indexOf(e) < 0).length ? ' 缺 ' + EXPECT.filter(e => e !== 'K30' && ran.indexOf(e) < 0).join(',') : ''));

  console.log(fails ? '=== smoke-topbar: ' + fails + ' 条 FAIL ===' : '=== smoke-topbar: 全部通过（' + ran.length + ' 条）===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(2); });
