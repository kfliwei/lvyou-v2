/* 批次 23-B 探针 v3。v2 的 planner 行是假绿：向导没走到第 3 步，两枚方向按钮根本不在 DOM，
   却照印「溢出 0 条」。这版按 smoke-planner 的真实序列走到第 3 步再量：
   一句话生成（纯规则，本地库有数据）→ 选 5 枚候选 → #scheduleBtn → wNext ×2 → 第 3 步「排序」。
   textZoom 用注入 html{font-size:calc(21.6px*…)} 忠实模拟（v1 的 --blink-settings 被 Chrome 忽略）。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const M = `(() => {
  const W = innerWidth;
  const box = id => { const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width),
      scrollW: e.scrollWidth, clientW: e.clientWidth }; };
  const css = id => { const e = document.getElementById(id); if (!e) return null;
    const c = getComputedStyle(e); return { minW: c.minWidth, ws: c.whiteSpace, tov: c.textOverflow, flex: c.flex }; };
  const rowOf = id => { const e = document.getElementById(id); if (!e || !e.parentElement) return null;
    const p = e.parentElement, r = p.getBoundingClientRect(), c = getComputedStyle(p);
    return { cls: p.className, flexWrap: c.flexWrap, overflowX: c.overflowX,
      w: Math.round(r.width), right: Math.round(r.right), scrollW: p.scrollWidth }; };
  return {
    W: W, root: getComputedStyle(document.documentElement).fontSize,
    asc: box('wOrderAsc'), desc: box('wOrderDesc'), ascCss: css('wOrderDesc'),
    row: rowOf('wOrderDesc'),
    wiz: box('wizardBox'), card: (function () {
      const e = document.getElementById('wizardBox'); if (!e) return null;
      const c = e.closest ? e.closest('.card') : null; if (!c) return null;
      const r = c.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), scrollW: c.scrollWidth };
    })(),
    lbl: (function () { const e = document.getElementById('wOrderDesc');
      if (!e) return ''; return (e.textContent || '').replace(/\\s+/g, ' ').trim(); })(),
    step: (function () { const t = document.querySelector('#wizardBox .sec-title');
      return t ? (t.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24) : ''; })()
  };
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
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 80)));
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
    const m = await p.evaluate(M);
    console.log('=== ' + cfg.name + ' ===');
    console.log('  stepTitle=' + JSON.stringify(m.step) + ' root=' + m.root);
    console.log('  asc  =', JSON.stringify(m.asc));
    console.log('  desc =', JSON.stringify(m.desc), '文本「' + m.lbl + '」');
    console.log('  desc css =', JSON.stringify(m.ascCss));
    console.log('  row  =', JSON.stringify(m.row));
    console.log('  wizardBox =', JSON.stringify(m.wiz), ' card =', JSON.stringify(m.card));
    const bad = [];
    if (!m.desc || !m.asc) bad.push('分母失守：方向按钮不在 DOM');
    else {
      if (m.desc.right > m.W + 1) bad.push('倒序按钮 right=' + m.desc.right + ' 越出视口 ' + m.W);
      if (m.desc.scrollW > m.desc.clientW + 1) bad.push('倒序按钮文本被自身裁切 ' + m.desc.scrollW + '>' + m.desc.clientW);
      if (m.row && m.row.right > m.W + 1) bad.push('按钮行越界 right=' + m.row.right);
    }
    console.log('  判定: ' + (bad.length ? bad.join(' ; ') : 'OK 未见裁切'));
    if (errs.length) console.log('  页面报错: ' + errs.join(' | '));
    try { await p.screenshot({ path: ROOT + 'tools/out/b23-wiz-' + cfg.w + (cfg.tz ? '135' : '100') + '.png' }); } catch (e) {}
    await p.close(); await browser.close();
  }
})();
