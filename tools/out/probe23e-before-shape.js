/* 批次 23-B 探针 v4：把「改前形状」在活页面上回放一遍，量出改前的真实余量。
   probe23c 只能在修复后量（读的是当前源码），而本批文档要写「328＋textZoom100 只剩 4px」
   这种改前数——只有把它做成可复跑的才不算转抄。
   做法：按 smoke-planner 的序列走到向导第 3 步，然后就在活 DOM 上做三件事：
   ① 容器摘掉 row-opt 类（回到裸 .row，flex-wrap/align-self 那套全失效）；
   ② 两枚按钮的文案合回不可断的整串（改前就是一根字符串）；
   ③ 不动其它任何样式，量按钮与行的右缘。
   只改内存里的 DOM，不落盘、不改源码，进程退出即消失。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SNAP = `(() => {
  const g = id => document.getElementById(id);
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }; };
  const desc = g('wOrderDesc');
  const row = desc ? desc.parentElement : null;
  return { W: innerWidth, root: getComputedStyle(document.documentElement).fontSize,
    asc: box(g('wOrderAsc')), desc: box(desc), row: box(row),
    rowCls: row ? row.className : null,
    lbl: desc ? (desc.textContent || '').replace(/\\s+/g, ' ').trim() : '' };
})()`;

/* 改前形状回放：整串文案（含中间那个分隔点）+ 裸 row。文案从当前两段拼回旧的整串写法。 */
const REPLAY = `(() => {
  const desc = document.getElementById('wOrderDesc'), asc = document.getElementById('wOrderAsc');
  if (!desc || !asc) return 'no-buttons';
  const row = desc.parentElement;
  row.className = 'row';
  row.style.cssText = 'gap:10px';
  asc.textContent = '正序 · 从起点出发';
  desc.textContent = '倒序 · 从远端返回';
  return 'ok';
})()`;

(async () => {
  for (const cfg of [
    { name: '328 + textZoom135（真机现状）', w: 328, h: 723, tz: true },
    { name: '328 + textZoom100（修壳后）', w: 328, h: 723, tz: false },
    { name: '452 + textZoom135（闸门主档 + 放大）', w: 452, h: 995, tz: true }
  ]) {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
    const p = await browser.newPage();
    await p.setViewport({ width: cfg.w, height: cfg.h, deviceScaleFactor: 1 });
    await p.goto('file:///' + ROOT + 'planner.html', { waitUntil: 'load', timeout: 40000 });
    if (cfg.tz) await p.addStyleTag({ content: 'html{font-size:calc(21.6px * var(--fs-bucket) * var(--fs-stage))!important}' });
    await sleep(1600);
    await p.evaluate(() => { const i = document.getElementById('promptInput');
      i.value = '我想去川西玩5天，喜欢自然风光'; i.dispatchEvent(new Event('input')); });
    await p.click('#genBtn').catch(() => {});
    await sleep(1400);
    for (let i = 0; i < 5; i++) {
      await p.evaluate(idx => { const e = document.querySelectorAll('#candList .cand')[idx]; if (e) e.click(); }, i);
      await sleep(160);
    }
    await p.click('#scheduleBtn').catch(() => {});
    await sleep(500);
    for (let s = 1; s < 3; s++) { await p.click('#wNext').catch(() => {}); await sleep(380); }

    console.log('=== ' + cfg.name + ' ===');
    const cur = await p.evaluate(SNAP);
    console.log('  改后（当前源码）root=' + cur.root + ' 文本「' + cur.lbl + '」');
    console.log('    asc=' + JSON.stringify(cur.asc) + ' desc=' + JSON.stringify(cur.desc) + ' row=' + JSON.stringify(cur.row) + ' cls=' + cur.rowCls);
    const slack = cur.W - cur.desc.right;
    console.log('    右缘余量 = 视口 ' + cur.W + ' - desc.right ' + cur.desc.right + ' = ' + slack + 'px');

    const done = await p.evaluate(REPLAY);
    if (done !== 'ok') { console.log('    改前回放失败：' + done); await p.close(); await browser.close(); continue; }
    const old = await p.evaluate(SNAP);
    console.log('  改前形状回放（裸 .row + 整串文案，只动内存 DOM）');
    console.log('    asc=' + JSON.stringify(old.asc) + ' desc=' + JSON.stringify(old.desc) + ' row=' + JSON.stringify(old.row) + ' cls=' + old.rowCls);
    const oslack = cur.W - old.desc.right;
    console.log('    右缘余量 = ' + oslack + 'px' + (oslack < 0
      ? '  ← 已越出视口（内容被裁，用户报的「后面看不到」）'
      : '  ← 刀锋：只要文案再长一点或字号再大一档就溢出'));
    await p.screenshot({ path: ROOT + 'tools/out/b23-before-' + cfg.w + (cfg.tz ? '135' : '100') + '.png' }).catch(() => {});
    await p.close(); await browser.close();
  }
})();
