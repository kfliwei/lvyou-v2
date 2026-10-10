/* probe33f-geom.js — 33-F 重拍前的两问：① 红的那一条是不是我改的那一条；② 没红的页是「取景/态拍不到」还是「真的没动」
 * 用法: node tools/out/probe33f-geom.js
 * 口径：完全继承 tools/visual-check.js 的冻结前置（tn_onboarded + CLOCK 桩 + 拦全部 http(s) + prefers-reduced-motion
 *       + 走产品自己的 loadTestData/clearTestData 摆数据态），否则量到的不是基线那一屏
 *       （批次 32 第一版探针就栽在没继承这套，静止态自己飘 0.4%）。
 * 跑序纪律：**所有「空库态」的测量必须排在灌种子/灌账之前**——基线里空库态就是全量跑的第一批，
 *       一旦先 ensureSeed()，同一档案里 IDB 再也回不到空库，量出来的「空库」是假的。
 * 输出只写 tools/out/b33f-geom.txt；页内「改前串宽度」是运行时临时改 textContent 量的，不落盘、不改产品文件。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CLOCK = `const __T = new Date('2026-10-03T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return _raf(function () { cb(1000); }); };
  Math.random = (function () { var s = 20261003; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();`;

const out = [];
function p(s) { out.push(s); console.log(s); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'] });
  for (const pg0 of await browser.pages()) await pg0.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const goto = async (file, W, H) => {
    await pg.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await pg.goto(pathToFileURL(path.join(ROOT, file)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
  };
  const ensureSeed = async () => {
    await goto('index.html', 390, 844);
    await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
    await pg.evaluate(async () => { const r = window.loadTestData && window.loadTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
  };
  const ensureLedger = async () => {
    await goto('index.html', 390, 844);
    await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
    await pg.evaluate(async () => { const r = window.clearTestData && window.clearTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
    await pg.addScriptTag({ path: path.join(ROOT, 'tools', 'visual-ledger.js') });
    const got = await pg.evaluate(() => (window.loadTestLedger ? window.loadTestLedger() : { err: '夹具没载进 loadTestLedger' }));
    if (!got || got.err || !got.trips) { p('!! 有账夹具载入失败 ' + JSON.stringify(got)); process.exit(1); }
  };

  /* ================= 第一段：空库态（此时档案里什么都没有） ================= */
  p('=== ① 空库态：me.html 的 .rec 有几行、在不在帧内（34-B 接线 + 33-B 的 44 地板） ===');
  await goto('me.html', 390, 844);
  await new Promise(r => setTimeout(r, 1400));
  let m = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('.rec')];
    const one = rows.length ? rows[0].getBoundingClientRect() : null;
    return {
      n: rows.length,
      first: one ? { y: +one.y.toFixed(1), h: +one.height.toFixed(1), bottom: +one.bottom.toFixed(1) } : null,
      vh: innerHeight, scrollY: Math.round(scrollY), docH: Math.round(document.documentElement.scrollHeight),
      emptyShown: !!document.querySelector('.empty')
    };
  });
  p('  me.html 空库@390×844 → .rec 行数 ' + m.n + '  首行 ' + JSON.stringify(m.first) + '  空态块 ' + (m.emptyShown ? '在' : '不在') + '  scrollY ' + m.scrollY + ' 文档高 ' + m.docH);

  p('\n=== ② 空库态：index.html 那条备份提醒条出不出屏（33-C z 9500→8000） ===');
  for (const [W, H] of [[328, 723], [390, 844]]) {
    await goto('index.html', W, H);
    await new Promise(r => setTimeout(r, 1400));
    const s = await pg.evaluate(() => {
      const bars = [...document.querySelectorAll('body>div')].filter(e => /距上次备份/.test(e.textContent || ''));
      const b = bars.length ? bars[0].getBoundingClientRect() : null;
      return {
        n: bars.length,
        rect: b ? { y: +b.y.toFixed(0), h: +b.height.toFixed(0), z: getComputedStyle(bars[0]).zIndex } : null,
        tnNodes: document.querySelectorAll('[class^="tn-"],[class*=" tn-"]').length,
        panel: !!document.getElementById('tnPanel')
      };
    });
    p('  ' + W + '×' + H + ' → 提醒条出现 ' + s.n + ' 次 ' + JSON.stringify(s.rect) + '  页内 tn-* 节点 ' + s.tnNodes + '  #tnPanel 存在=' + s.panel);
  }

  p('\n=== ③ 空库态：settings.html 批次 36 那三处在不在帧内 ===');
  for (const [W, H] of [[320, 640], [328, 723], [390, 844], [452, 995], [768, 1024], [1440, 900]]) {
    await goto('settings.html', W, H);
    await new Promise(r => setTimeout(r, 1400));
    const s = await pg.evaluate(() => {
      const f = id => {
        const e = document.getElementById(id);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { y: +b.y.toFixed(0), h: +b.height.toFixed(0), in: b.top >= 0 && b.bottom <= innerHeight, ph: (e.getAttribute && e.getAttribute('placeholder')) || null, txt: (e.textContent || '').trim().slice(0, 26) };
      };
      return { wdUrl: f('wdUrl'), wdPass: f('wdPass'), wdHelp: f('wdHelp'), wdPresetJg: f('wdPresetJg'), scrollY: Math.round(scrollY), docH: Math.round(document.documentElement.scrollHeight), vh: innerHeight };
    });
    p('  ' + W + '×' + H + '  scrollY ' + s.scrollY + '  文档高 ' + s.docH + '  视口 ' + s.vh);
    for (const k of ['wdUrl', 'wdPass', 'wdHelp', 'wdPresetJg']) {
      const v = s[k];
      p('    #' + k + ' → ' + (v ? 'top=' + v.y + ' h=' + v.h + ' ' + (v.in ? '在帧内' : '不在帧内') + (v.ph ? '  placeholder=『' + v.ph + '』' : '') + (v.txt ? '  文本=『' + v.txt + '』' : '') : '读不到'));
    }
  }

  /* ================= 第二段：story 种子态（红的就是这一页） ================= */
  p('\n=== ④ story.html 翻页浮条：33-B 抬 .sn-btn、33-D 加长 #snSub，各动在哪 ===');
  await ensureSeed();
  for (const [W, H] of [[390, 844], [328, 723]]) {
    await goto('story.html', W, H);
    await new Promise(r => setTimeout(r, 1400));
    const s = await pg.evaluate(() => {
      const bar = document.querySelector('.story-nav');
      const prev = document.getElementById('snPrev'), next = document.getElementById('snNext');
      const ttl = document.getElementById('snTitle'), sub = document.getElementById('snSub');
      const rr = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
      const cs = e => e ? getComputedStyle(e) : null;
      const nowTxt = sub ? sub.textContent : '';
      const oldTxt = nowTxt.replace(/ · \d{2}:\d{2}$/, '');
      let wOld = 0;
      if (sub) { sub.textContent = oldTxt; wOld = sub.scrollWidth; sub.textContent = nowTxt; }
      const card = document.querySelector('.sc-date');
      return {
        cards: document.querySelectorAll('.story-card').length,
        bar: rr(bar), barBottom: bar ? +bar.getBoundingClientRect().bottom.toFixed(1) : null, vh: innerHeight,
        prev: rr(prev), next: rr(next),
        prevCss: cs(prev) ? { width: cs(prev).width, height: cs(prev).height, minWidth: cs(prev).minHeight } : null,
        title: ttl ? { text: ttl.textContent, scrollW: ttl.scrollWidth, clientW: ttl.clientWidth } : null,
        sub: sub ? { text: nowTxt, oldText: oldTxt, wNew: sub.scrollWidth, wOld: wOld, clientW: sub.clientWidth, h: +sub.getBoundingClientRect().height.toFixed(1), lineH: cs(sub).lineHeight } : null,
        scDate: card ? card.textContent : null
      };
    });
    p('\n视口 ' + W + '×' + H + '  卡面数 ' + s.cards + '  日卡首行 .sc-date=『' + s.scDate + '』');
    p('  .story-nav ' + JSON.stringify(s.bar) + '  底边 ' + s.barBottom + ' / 视口高 ' + s.vh + (s.barBottom <= s.vh ? ' → 整条在帧内' : ' → 超出帧底'));
    p('  #snPrev ' + JSON.stringify(s.prev) + '  #snNext ' + JSON.stringify(s.next) + '  computed=' + JSON.stringify(s.prevCss));
    if (s.title) p('  #snTitle 『' + s.title.text + '』 scrollW ' + s.title.scrollW + ' clientW ' + s.title.clientW + ' → ' + (s.title.scrollW > s.title.clientW ? '被省略号裁' : '放得下'));
    if (s.sub) {
      p('  #snSub 现串『' + s.sub.text + '』 scrollW ' + s.sub.wNew + ' / 容器 ' + s.sub.clientW + ' → ' + (s.sub.wNew > s.sub.clientW ? '溢出' : '放得下'));
      p('  #snSub 改前串『' + s.sub.oldText + '』 scrollW ' + s.sub.wOld + ' → 33-D 加长 ' + (s.sub.wNew - s.sub.wOld) + 'px');
      p('  #snSub 实测高 ' + s.sub.h + '  行高 ' + s.sub.lineH + (parseFloat(s.sub.lineH) > 0 && s.sub.h > parseFloat(s.sub.lineH) * 1.5 ? ' → 已折成两行' : ' → 单行'));
    }
  }

  /* ================= 第三段：me 有账态（.rec 有没有内容可拍） ================= */
  p('\n=== ⑤ me.html 有账态：.rec 行数（基线 me.ledger 那一格到底拍没拍到这批改动） ===');
  await ensureLedger();
  await goto('me.html', 390, 844);
  await new Promise(r => setTimeout(r, 5000));
  m = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('.rec')];
    const one = rows.length ? rows[0].getBoundingClientRect() : null;
    return {
      n: rows.length,
      first: one ? { y: +one.y.toFixed(1), h: +one.height.toFixed(1), bottom: +one.bottom.toFixed(1) } : null,
      heights: rows.slice(0, 4).map(r2 => +r2.getBoundingClientRect().height.toFixed(1)),
      scrollY: Math.round(scrollY), docH: Math.round(document.documentElement.scrollHeight), vh: innerHeight
    };
  });
  p('  me.html 有账@390×844 → .rec 行数 ' + m.n + '  首行 ' + JSON.stringify(m.first) + '  前四行高 ' + JSON.stringify(m.heights) + '  scrollY ' + m.scrollY + ' 文档高 ' + m.docH + ' 视口 ' + m.vh);

  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-geom.txt'), out.join('\n') + '\n');
  p('\n（已写盘 tools/out/b33f-geom.txt）');
})().catch(e => { console.error('探针异常：' + (e && e.stack || e)); fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'b33f-geom.txt'), out.join('\n') + '\n探针异常：' + (e && e.stack || e) + '\n'); process.exit(1); });
