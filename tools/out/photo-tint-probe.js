/* UI-4 · 实景图「统一压色」取数探针：75 张本地镜像实景照，量哪种手法真的把它们收成一档
 * 用法: NODE_PATH=… node tools/out/photo-tint-probe.js
 *
 * 为什么要跑它（它把「凭手感写滤镜」这条路堵死了）：
 *   要解决的问题是「同一列里几张图源白平衡/曝光各异，看起来像从别处贴过来的」。
 *   直觉做法是给 <img> 加一条 filter（saturate/brightness/contrast）。实测结论：乘性滤镜只是让
 *   整批一起变闷，批内离散度基本不动（σ(S) 15.8 → 15.1，只降 4%）——「统一」这件事它没做到。
 *   真正压离散度的是「向同一个颜色做凸组合」：veil = (1-α)·照片 + α·暖墨。
 *   每个通道的批内 σ 都乘 (1-α)，顺带给全部照片压上同一层品牌色偏。
 *   两种手法放在同一口径下对账，选出来的 α 才有数字支撑。
 *
 * 口径：每图缩到 64×64 采样；S/L 取 HSL 的每图像素均值；色温用每图 mean(R)-mean(B)（0–1 域）。
 *   「批内 σ」= 75 个每图均值的总体标准差，这才是「看起来统不统一」的量。
 *   反向约束：过暗计数（每图 mean L < .28）——封面图上要压白字，压太狠 §12 对比度会假绿。
 * 前置：--allow-file-access-from-files + 落脚页 _probe-blank.html（file:// 图源要在 file:// 文档里
 *   解码才喂得进 canvas；about:blank / data: 拿不到路径，且不加该开关画布被污染、getImageData 抛 SecurityError）。
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const srcJs = fs.readFileSync(path.join(ROOT, 'site-images-local.js'), 'utf8');
const files = [...srcJs.matchAll(/"(images\/sites\/[^"]+)"/g)].map(m => pathToFileURL(path.join(ROOT, m[1])).href);

/* 暖墨 = design.css 的 --color-ink #211A13；veil 就是它按 α 压在照片上 */
const MODES = [
  ['（原样）', null],
  ['filter saturate(.88) brightness(.97) contrast(1.03)', { filter: 'saturate(.88) brightness(.97) contrast(1.03)' }],
  ['veil 暖墨 α=.06', { veil: .06 }],
  ['veil 暖墨 α=.10', { veil: .10 }],
  ['veil 暖墨 α=.14', { veil: .14 }],
  ['veil 暖墨 α=.18', { veil: .18 }],
  ['veil .10 + filter saturate(.94)', { veil: .10, filter: 'saturate(.94)' }]
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files']
  });
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', r => (/^https?:/i.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {})));
  await pg.goto(pathToFileURL(path.join(__dirname, '_probe-blank.html')).href, { waitUntil: 'load' });

  const rows = [];
  let errs = [];
  for (const [label, mode] of MODES) {
    const stat = await pg.evaluate(async (list, m) => {
      const c = document.getElementById('c'), x = c.getContext('2d', { willReadFrequently: true });
      const S = [], L = [], TB = [];
      window.__err = [];
      for (const u of list) {
        const img = new Image();
        img.src = u;
        let d;
        try {
          await img.decode();
          x.clearRect(0, 0, 64, 64);
          x.filter = m && m.filter ? m.filter : 'none';
          x.drawImage(img, 0, 0, 64, 64);
          x.filter = 'none';
          if (m && m.veil) { x.fillStyle = 'rgba(33,26,19,' + m.veil + ')'; x.fillRect(0, 0, 64, 64); }
          d = x.getImageData(0, 0, 64, 64).data;
        } catch (e) { window.__err.push(u.split('/').pop() + ': ' + e.name + ' ' + e.message); continue; }
        let ss = 0, ll = 0, rr = 0, bb = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), li = (mx + mn) / 2;
          ss += mx === mn ? 0 : (li > .5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
          ll += li; rr += r; bb += b; n++;
        }
        S.push(ss / n); L.push(ll / n); TB.push((rr - bb) / n);
      }
      const mean = a => a.reduce((p, v) => p + v, 0) / a.length;
      const sd = a => Math.sqrt(a.reduce((p, v) => p + (v - mean(a)) ** 2, 0) / a.length);
      return { n: S.length, err: window.__err.slice(0, 3),
        sMean: mean(S), sSd: sd(S), lMean: mean(L), lSd: sd(L),
        tbMean: mean(TB), tbSd: sd(TB), dark: L.filter(v => v < .28).length };
    }, files, mode);
    if (stat.err && stat.err.length) errs = stat.err;
    rows.push([label, stat]);
  }
  await browser.close();
  if (errs.length) { console.log('解码/取像素失败样本：' + errs.join(' | ')); process.exit(1); }

  const base = rows[0][1];
  console.log('样本：site-images-local.js 里的 ' + files.length + ' 张本地镜像实景照');
  console.log('σ = 批内标准差（越小越统一）；括号 = 相对原样的变化\n');
  rows.forEach(([label, r]) => {
    const cell = (v, bv) => (v * 100).toFixed(1) + (bv === undefined ? '' : '（' + ((v / bv - 1) * 100).toFixed(0) + '%）');
    console.log(label.padEnd(46) + ' 张=' + r.n +
      '  σ(S)=' + cell(r.sSd, r === base ? undefined : base.sSd) +
      '  σ(明度)=' + cell(r.lSd, r === base ? undefined : base.lSd) +
      '  σ(色温R-B)=' + cell(r.tbSd, r === base ? undefined : base.tbSd) +
      '  均值明度=' + (r.lMean * 100).toFixed(1) + '%  过暗=' + r.dark);
  });
})().catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1); });
