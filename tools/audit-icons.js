/* audit-icons.js — P0-1 图标体系验收探针（真浏览器 + 真像素，量四件以前只能靠眼睛的事）
   1) 有墨：暗色/亮色下每个已渲染图标，从其包围盒截真实像素，扣掉背景主色后必须剩 ≥0.5% 墨迹。
      用像素而不是 computed color，是因为品牌按钮/落款胶囊的背景是渐变，色值推算会骗人。
   2) 对比：墨色与背景的 WCAG 亮度比 ≥3:1（图形最小对比度）。
   3) 基线：行内图标视觉中线与同行文字中线的偏差 ≤1.5px。
   4) 热区：纯图标可点元素命中区 ≥40×40。
   另出一张 16px 联络表（实际用到的字形 × 亮/暗）给人审——机器只能证明「画出来了」，
   「认得出是哪个物件」必须靠眼睛，这条不假装自动化。
用法: node tools/audit-icons.js            全站 15 页 × 亮/暗
      node tools/audit-icons.js review.html 只看指定页
输出: tools/out/audit-icons.json + tools/out/shots/<日期>-p01/ */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* 本地日期：toISOString() 是 UTC，本地 00:00–08:00 之间跑会把物证写进昨天的目录
   （实测 2026-10-04 07:39 那一轮就盖了 2026-10-03-p01/ 的 7 张图）。 */
const _d = new Date();
const DAY = [_d.getFullYear(), String(_d.getMonth() + 1).padStart(2, '0'), String(_d.getDate()).padStart(2, '0')].join('-');
const SHOTS = path.join(ROOT, 'tools', 'out', 'shots', DAY + '-p01');
fs.mkdirSync(SHOTS, { recursive: true });

const PAGES = ['index.html', 'explore-map.html', 'topic.html', 'search.html', 'wishlist.html',
  'review.html', 'travel-map.html', 'planner.html', 'me.html', 'settings.html',
  'node-manager.html', 'md-manager.html', 'album.html', 'album-edit.html', 'story.html'];
const SEED_PAGES = new Set(['review.html', 'album.html', 'story.html', 'travel-map.html']);
const VW = 390, VH = 844, DPR = 2;
/* 阈值 2.5px 是量出来的：正确居中（align-items:center）时最大偏差 1.59px，来自衬线字体的
   行框与字形中线差；故意抽掉 align-items 后同一处变 12.09px。取两者之间。 */
const MIN_INK = 0.005, MIN_CONTRAST = 3, MAX_BASELINE = 2.5, MIN_HIT = 40;

const args = process.argv.slice(2).filter(a => a.endsWith('.html'));
const pages = args.length ? args : PAGES;

/* ---------- 像素工具 ---------- */
function lum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }

/* 从整页截图里裁出图标包围盒：返回背景主色、墨迹占比、墨迹均色 */
function measureIcon(png, rect) {
  const x0 = Math.max(0, Math.round(rect.x * DPR)), y0 = Math.max(0, Math.round(rect.y * DPR));
  const w = Math.max(1, Math.round(rect.width * DPR)), h = Math.max(1, Math.round(rect.height * DPR));
  const x1 = Math.min(png.width, x0 + w), y1 = Math.min(png.height, y0 + h);
  const hist = new Map();
  const px = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (png.width * y + x) << 2;
    const c = [png.data[i], png.data[i + 1], png.data[i + 2]];
    const k = c.join(',');
    hist.set(k, (hist.get(k) || 0) + 1);
    px.push(c);
  }
  if (!px.length) return null;
  let bgK = null, bgN = -1;
  for (const [k, n] of hist) if (n > bgN) { bgN = n; bgK = k; }
  const bg = bgK.split(',').map(Number);
  /* 墨迹 = 与背景主色差得远的像素。描边图标本身只占包围盒一小部分，0.5% 是实测下限 */
  const ink = px.filter(c => dist(c, bg) > 40);
  /* 对比度取「笔画核心」而不是全部墨迹均值：描边只有 1-2px，抗锯齿边缘像素被拉向背景，
     取均值会把白字在砖红底上的 3.7:1 误判成 2.7:1（首跑实测）。按离背景远近排序取最远的 1/4。 */
  const core = ink.slice().sort((a, b) => dist(b, bg) - dist(a, bg)).slice(0, Math.max(1, Math.round(ink.length * 0.25)));
  const sum = core.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
  const inkColor = core.length ? sum.map(v => Math.round(v / core.length)) : bg;
  return { inkRatio: ink.length / px.length, bg, inkColor, contrast: ratio(inkColor, bg) };
}

/* ---------- 页面内取样 ---------- */
const PROBE = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05; };
  const tag = el => {
    const use = el.querySelector('use');
    const id = use ? (use.getAttribute('href') || use.getAttribute('xlink:href') || '') : '';
    const cls = (el.getAttribute('class') || '').split(/\\s+/).filter(x => x && x !== 'ti')[0] || '';
    let p = el, path = [];
    while (p && p !== document.body && path.length < 4) {
      if (p.id) { path.unshift('#' + p.id); break; }
      const c = [...p.classList].filter(x => !/^ti$/.test(x))[0];
      if (c) path.unshift('.' + c);
      p = p.parentElement;
    }
    return { glyph: id.replace('#ti-', ''), chain: path.join(' ') || el.tagName.toLowerCase(), cls };
  };
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const icons = [...document.querySelectorAll('svg')].filter(s => (s.querySelector('use') || /(^|\\s)ti(\\s|$)/.test(s.className.baseVal || '')) && vis(s));

  /* 行内图标与同行文字的中线偏差。宿主是 flex/grid 时同样要量——align-items 写错就是这里露馅，
     所以不跳过弹性布局；文字优先取宿主的直接文本节点，没有就往一层子元素里找。 */
  const textOf = host => {
    const kids = [...host.childNodes];
    let tn = kids.find(n => n.nodeType === 3 && n.textContent.trim());
    if (!tn) for (const k of kids) {
      if (k.nodeType !== 1) continue;
      const t = [...k.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (t) { tn = t; break; }
    }
    return tn;
  };
  const inline = icons.map(el => {
    /* 图标常被包在 .ic > [aria-hidden] 这类纯壳里，文字在祖父节点上，所以往上找最多 3 层 */
    let host = null, tn = null;
    for (let h = el.parentElement, d = 0; h && d < 3; h = h.parentElement, d++) {
      const t = textOf(h);
      if (t) { host = h; tn = t; break; }
    }
    if (!host) return null;
    const rg = document.createRange(); rg.selectNodeContents(tn);
    const rr = rg.getBoundingClientRect();
    if (!rr.height) return null;
    const ir = el.getBoundingClientRect();
    /* 只量「并排在同一行」的图标与文字：文字必须在图标左/右侧（不是压在下面，底部导航是
       图标在上标签在下，量它等于量排版高度），且两者中线距离在同一条带内。
       注意不能用垂直重叠当门槛——真把 align-items 写坏时图标会跑离文字，重叠为 0 反而漏测。 */
    const beside = rr.left >= ir.right - 2 || rr.right <= ir.left + 2;
    const band = Math.abs((ir.top + ir.height / 2) - (rr.top + rr.height / 2));
    if (!beside || band > Math.max(ir.height * 2, 24)) return null;
    return { ...tag(el), delta: +(((ir.top + ir.height / 2) - (rr.top + rr.height / 2)).toFixed(2)),
      text: tn.textContent.trim().slice(0, 12), host: String(host.getAttribute('class') || host.tagName),
      align: getComputedStyle(host).alignItems };
  }).filter(Boolean);

  /* 纯图标可点元素的热区 */
  const hit = [...document.querySelectorAll('a,button,[onclick],[role=button]')]
    .filter(el => vis(el))
    .filter(el => !el.textContent.trim() && el.querySelector('svg'))
    .map(el => { const r = rect(el); return { ...tag(el), sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\\s+/)[0] : ''), ...r, cursor: getComputedStyle(el).cursor }; });

  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const covered = el => {
    const r = rect(el), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!top || top === el || el.contains(top) || top.contains(el)) return '';
    return label(top);
  };
  return {
    icons: icons.map(el => {
      const r = rect(el);
      /* 半截出屏的行裁出来几乎全是背景，会被误判成「无墨」——单独归类，不混进缺陷 */
      return { ...tag(el), ...r, clipped: r.y < 0 || r.y + r.height > innerHeight, coveredBy: covered(el) };
    }),
    inline, hit,
    /* 未收进 sprite 的内联 SVG：不算缺陷，但要说清这页还有多少图标没走统一体系 */
    legacy: [...document.querySelectorAll('svg')].filter(s => !s.querySelector('use') && !/(^|\s)ti(\s|$)/.test(s.className.baseVal || '') && vis(s)).length,
    ink: { count: [...document.querySelectorAll('svg use')].length, ti: typeof window.TI === 'function' }
  };
})()`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  const out = { day: DAY, pages: {} };
  const used = new Set();
  const lines = [];
  let fail = 0;
  let sampleTotal = 0;   /* 基线样本总数：少于 10 处等于这条没测，见收尾判定 */
  /* 「全绿」只说明没越线，不说明离线多远。这三个极值把距离也记下来，验收时看得出是「刚好过」还是「有余量」。 */
  let minContrastSeen = Infinity, maxBaselineSeen = 0, minHitSeen = Infinity;

  /* 种子数据：回顾/相册/故事/足迹要先有记录 */
  if (pages.some(p => SEED_PAGES.has(p))) {
    await pg.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' }).catch(() => {});
    await pg.evaluate(() => { try { window.loadTestData && window.loadTestData(); } catch (e) {} });
  }

  for (const p of pages) {
    const url = 'file:///' + path.join(ROOT, p).replace(/\\/g, '/');
    out.pages[p] = {};
    for (const theme of ['light', 'dark']) {
      await pg.goto(url, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      if (theme === 'dark') {
        /* 只加应用自己的 .theme-dark 类，不额外补色——暗色下看不清正是要抓的东西 */
        await pg.evaluate(() => document.documentElement.classList.add('theme-dark'));
      }
      /* 开屏遮罩是 position:fixed inset:0 z-index:9999，不等它退场就会把整页图标量成「无墨」（首跑踩过） */
      await pg.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 6000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
      const probe = await pg.evaluate(PROBE);
      if (!probe.ink.ti) { lines.push(p + '/' + theme + ': TI 未定义（icons.js 没加载或顺序不对）'); fail++; continue; }
      probe.icons.forEach(i => { if (i.glyph) used.add(i.glyph); });
      /* 量像素和存证必须用同一张图，否则报「无墨」而人看图是好的（首跑就是这个矛盾暴露的） */
      const buf = await pg.screenshot({ type: 'png', animations: 'disabled' });
      await fs.promises.writeFile(path.join(SHOTS, p.replace('.html', '') + '.' + theme + '.png'), buf);
      const shot = PNG.sync.read(buf);
      const rec = { icons: probe.icons.length, legacy: probe.legacy, samples: probe.inline.length, clipped: 0, covered: [], blind: [], thin: [], baseline: [], small: [] };

      for (const ic of probe.icons) {
        if (ic.clipped) { rec.clipped++; continue; }
        if (ic.coveredBy) { rec.covered.push({ glyph: ic.glyph, chain: ic.chain, by: ic.coveredBy }); continue; }
        const m = measureIcon(shot, ic);
        if (!m) continue;
        if (m.inkRatio < MIN_INK) rec.blind.push({ glyph: ic.glyph, chain: ic.chain, ink: +(m.inkRatio * 100).toFixed(2) + '%' });
        else {
          if (m.contrast < minContrastSeen) minContrastSeen = m.contrast;
          if (m.contrast < MIN_CONTRAST) rec.thin.push({ glyph: ic.glyph, chain: ic.chain, contrast: +m.contrast.toFixed(2) });
        }
      }
      rec.baseline = probe.inline.filter(x => Math.abs(x.delta) > MAX_BASELINE);
      for (const x of probe.inline) if (Math.abs(x.delta) > maxBaselineSeen) maxBaselineSeen = Math.abs(x.delta);
      sampleTotal += probe.inline.length;
      rec.small = probe.hit.filter(x => x.width < MIN_HIT || x.height < MIN_HIT);
      for (const h of probe.hit) { const s = Math.min(h.width, h.height); if (s < minHitSeen) minHitSeen = s; }
      out.pages[p][theme] = rec;

      const bad = rec.covered.length + rec.blind.length + rec.thin.length + rec.baseline.length + rec.small.length;
      fail += bad;
      lines.push(p + '/' + theme + ': sprite 图标 ' + rec.icons + ' 个（基线样本 ' + rec.samples + '，未收口内联 SVG ' + rec.legacy + '，出屏裁切 ' + rec.clipped + '）'
        + (bad ? ' → 遮挡 ' + rec.covered.length + ' / 无墨 ' + rec.blind.length + ' / 低对比 ' + rec.thin.length + ' / 基线 ' + rec.baseline.length + ' / 热区 ' + rec.small.length : ' → OK'));
      for (const c of rec.covered) lines.push('    遮挡  ' + c.glyph + ' @ ' + c.chain + ' 被 ' + c.by + ' 压住');
      for (const b of rec.blind) lines.push('    无墨  ' + b.glyph + ' @ ' + b.chain + ' (' + b.ink + ')');
      for (const t of rec.thin) lines.push('    低对比 ' + t.glyph + ' @ ' + t.chain + ' = ' + t.contrast + ':1');
      for (const b of rec.baseline) lines.push('    基线偏 ' + b.delta + 'px  ' + b.glyph + ' @ ' + b.host + ' 「' + b.text + '」');
      for (const st of rec.small) lines.push('    热区 ' + Math.round(st.width) + '×' + Math.round(st.height) + '  ' + st.glyph + ' @ ' + st.sel);
    }
  }

  /* 16px 联络表：全站实际用到的字形，亮/暗各一组 44px 格子。
     机器半边：每格都必须有墨且对比 >=3:1（证明 16px 下描边没糊成一片）；
     人半边：出图交眼睛判「认不认得出是这个物件」——这条不假装自动化。 */
  const list = [...used].sort();
  const sheetFile = path.join(ROOT, 'tools', 'out', 'icon-sheet.html');
  const cell = (n, dark) => '<span class="c" data-g="' + n + '" data-k="' + (dark ? 'd' : 'l') + '" style="display:inline-grid;place-items:center;width:44px;height:44px;'
    + (dark ? 'background:#1D1C19;color:#EFE9DC;' : 'background:#F7F5EF;color:#20201D;') + 'border-radius:8px;margin:2px">{{' + n + '}}</span>';
  fs.writeFileSync(sheetFile, '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><script src="../../icons.js"></scr' + 'ipt></head><body style="margin:0;background:#fff">'
    + '<div style="font:11px monospace;color:#7D7970;padding:4px">16px 亮底（应用真实用色）</div><div>' + list.map(n => cell(n, false)).join('') + '</div>'
    + '<div style="font:11px monospace;color:#7D7970;padding:4px">16px 暗底</div><div>' + list.map(n => cell(n, true)).join('') + '</div>'
    + '</body></html>', 'utf8');
  await pg.goto('file:///' + sheetFile.replace(/\\/g, '/'), { waitUntil: 'networkidle2' }).catch(() => {});
  await pg.evaluate(() => {
    document.body.innerHTML = document.body.innerHTML.replace(/\{\{([\w-]+)\}\}/g, function (m, n) { return TI(n, 16); });
  });
  {
    const rects = await pg.evaluate(() => [...document.querySelectorAll('.c')].map(el => {
      const r = el.getBoundingClientRect();
      return { g: el.dataset.g, k: el.dataset.k, x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    const shot = PNG.sync.read(await pg.screenshot({ type: 'png' }));
    const blind = [], thin = [];
    for (const rc of rects) {
      const m = measureIcon(shot, rc);
      if (!m || m.inkRatio < MIN_INK) blind.push(rc.g + '/' + rc.k);
      else if (m.contrast < MIN_CONTRAST) thin.push(rc.g + '/' + rc.k + '=' + m.contrast.toFixed(2));
    }
    fail += blind.length + thin.length;
    lines.push('16px 联络表: ' + list.length + ' 个在用字形，无墨 ' + blind.length + '，低对比 ' + thin.length);
    if (blind.length) lines.push('    无墨格: ' + blind.join(' '));
    if (thin.length) lines.push('    低对比格: ' + thin.join(' '));
    await fs.promises.writeFile(path.join(SHOTS, 'glyph-16px-sheet.png'), PNG.sync.write(shot));
    lines.push('    图: shots/' + DAY + '-p01/glyph-16px-sheet.png（认不认识需人审）');
  }
  fs.unlinkSync(sheetFile);

  if (sampleTotal < 10) { lines.push('基线样本只有 ' + sampleTotal + ' 处（<10：这条判据等于没测，判红）'); fail++; }
  else lines.push('基线样本合计 ' + sampleTotal + ' 处（阈值 ±' + MAX_BASELINE + 'px，实测最大 ' + maxBaselineSeen.toFixed(2) + 'px）');
  lines.push('余量: 最低图标对比 ' + (minContrastSeen === Infinity ? 'n/a' : minContrastSeen.toFixed(2) + ':1（线 ' + MIN_CONTRAST + '）')
    + '，最小 icon-only 热区 ' + (minHitSeen === Infinity ? 'n/a' : Math.round(minHitSeen) + 'px（线 ' + MIN_HIT + '）'));

  out.totalFail = fail;
  out.observed = { baselineSamples: sampleTotal, maxBaseline: +maxBaselineSeen.toFixed(2), minContrast: minContrastSeen === Infinity ? null : +minContrastSeen.toFixed(2), minHit: minHitSeen === Infinity ? null : Math.round(minHitSeen) };
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'audit-icons.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(lines.join('\n'));
  console.log(fail ? '=== 图标审计 FAIL: ' + fail + ' 处 ===' : '=== 图标审计 ALL OK ===');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
