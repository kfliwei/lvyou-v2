/* tools/smoke-photo.js — UI-4 实景图统一压色的浏览器侧验证
 * 存在的理由：verify.js §22 只能证明「design.css 里写了这条规则」，证明不了三件事——
 *   ① 规则真的命中了页面里的照片表面（选择器写错、类名漂了，源码看着一样绿）；
 *   ② 后加载的 map.css / 页内 <style> 没有把它覆盖掉（.ls-img 的 box-shadow 在 map.css 里
 *      就有两条声明，第二条一旦忘了合并 inset 环，描边会静默消失）；
 *   ③ 压色真的落到像素上（computed style 对了，但如果那张图其实是 <picture>/背景图/被 mask 盖住，
 *      像素不会变）。所以最后一档直接把同一张封面拍两次：带压色 / 把两个 token 摘成恒等，
 *      比平均亮度差——差值必须落在一个「看得见但没压糊」的区间里。
 * 前置态与 visual-check / smoke-motion 一致：跳引导、冻时钟、钉 reduced-motion、起本地 http（不吃外网）。
 * NODE_PATH 需指到 tools/node_modules。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8141', 10);
const BASE = 'http://127.0.0.1:' + PORT;

const results = [];
let failures = 0;
function check(name, pass, detail) {
  results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  if (!pass) failures++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  [' + detail + ']'));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer(function (req, res) {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
      : p.endsWith('.css') ? 'text/css;charset=utf-8'
      : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
      : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
    res.end(data);
  });
});

const CLOCK = `const __T = new Date('2026-10-04T10:00:00+08:00').getTime();
  Date.now = () => __T;
  const _d = new Date(__T);
  Date = new Proxy(Date, { construct(t, a) { return a.length ? new t(...a) : _d; } });
  performance.now = () => 1000;`;

/* 读一个元素（含 ::after）的压色三件套 */
const PROBE = `(sel)=>{const el=document.querySelector(sel);if(!el)return {missing:true};
  const cs=getComputedStyle(el), af=getComputedStyle(el,'::after');
  return {filter:cs.filter, shadow:cs.boxShadow, afterBg:af.backgroundImage, afterColor:af.backgroundColor,
    afterContent:af.content, pos:cs.position, hasImg:!!el.querySelector(':scope>img')};}`;

const VEIL = 'rgba(33, 26, 19, 0.1)';
const EDGE = 'rgba(33, 26, 19, 0.2)';
const LOOK = 'saturate(0.94)';
/* Chrome 把 inset 规范化到每层阴影的「末尾」而不是开头，所以描边断言一律按这个顺序匹配 */
const INSET_EDGE = new RegExp('^' + EDGE.replace(/[.,()]/g, '\\$&') + ' 0px 0px 0px 1px inset\\b');

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.evaluateOnNewDocument(CLOCK);
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: 452, height: 995, deviceScaleFactor: 2 });
  const probe = async sel => pg.evaluate(new Function('return ' + PROBE)(), sel);

  /* ---------- A 专题页列表卡缩略图：filter + veil + 内描边 ---------- */
  await pg.goto(BASE + '/topic.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(4000);
  await pg.evaluate(() => { const b = document.querySelector('[data-tab="list"]'); b && b.click(); });
  await sleep(2000);
  const thumb = await pg.evaluate(() => {
    const im = [].slice.call(document.querySelectorAll('.card .ph img'))
      .find(i => (i.getAttribute('src') || '').indexOf('images/sites/') === 0);
    if (!im) return null;
    im.scrollIntoView({ block: 'center' });
    return im.parentNode.className;
  });
  check('A1 列表里有带本地镜像实景照的缩略图', !!thumb, thumb === null ? '一张都没找到' : String(thumb));
  const ph = await probe('.card .ph');
  check('A2 .card .ph 的 ::after 压色层真的在（veil 色 + inset 满铺）',
    /linear-gradient\(0deg, rgba\(33, 26, 19, 0\.1\)|rgba\(33, 26, 19, 0\.1\)/.test(ph.afterBg + ' ' + ph.afterColor),
    'afterBg=' + ph.afterBg.slice(0, 60) + ' afterColor=' + ph.afterColor);
  check('A3 .card .ph 吃内描边（inset 0 0 0 1px 暖墨）', INSET_EDGE.test(ph.shadow), ph.shadow.slice(0, 70));
  const phi = await probe('.card .ph img');
  check('A4 缩略图 <img> 吃 --photo-look 滤镜', phi.filter === LOOK, 'filter=' + phi.filter);
  const empty = await pg.evaluate(() => {
    const el = document.querySelector('.card .ph.is-ph');
    if (!el) return null;
    const af = getComputedStyle(el, '::after');
    return { img: af.backgroundImage, col: af.backgroundColor };
  });
  check('A5 占位态（首字占位、没有 <img>）不被压色，否则空态被压成脏灰',
    empty === null || (empty.img === 'none' && empty.col === 'rgba(0, 0, 0, 0)'),
    empty === null ? '本页无占位缩略图（覆盖不到这条）' : JSON.stringify(empty));

  /* ---------- B 详情面板封面：map.css 后发声明不许吃掉描边 ---------- */
  const opened = await pg.evaluate(() => {
    const T = window.TopicEngine, S = window.SITES || [], M = window.SITE_IMAGES_LOCAL || {};
    if (!T || !T.openSheet) return 'no TopicEngine.openSheet';
    for (let i = 0; i < S.length; i++) if (S[i] && M[S[i].name]) { T.openSheet(i); return S[i].name; }
    return 'no site with local photo';
  });
  check('B1 打开一个有实景照的景点面板', typeof opened === 'string' && opened.indexOf('no ') !== 0, String(opened));
  await sleep(2500);
  /* Chrome 把 inset 规范化到每层阴影的「末尾」，不是开头——断言一律按「第一层是 inset 暖墨环」写 */
  const ls = await probe('.ls-img');
  check('B2 封面描边在 map.css 第二条 box-shadow 声明之后仍然在（inset 环没被覆盖掉）',
    INSET_EDGE.test(ls.shadow), ls.shadow.slice(0, 80));
  check('B3 封面压色层自带影 + veil 两层（同一元素只有一个 ::after，必须合并写；veil 落在末层背景色上）',
    /rgba\(32, 32, 29, 0\.22\)/.test(ls.afterBg) && ls.afterColor === VEIL,
    'afterBg=' + ls.afterBg.slice(0, 70) + ' afterColor=' + ls.afterColor);
  const lsi = await probe('.ls-img>img');
  check('B4 封面 <img> 吃 --photo-look', lsi.filter === LOOK, 'filter=' + lsi.filter);

  /* ---------- C 像素对账：压色到底落到画面上没有 ---------- */
  const lum = async tag => {
    const el = await pg.$('.ls-img>img');
    if (!el) return -1;
    const buf = await el.screenshot();
    const png = await pg.evaluate(async b => {
      const blob = await (await fetch('data:image/png;base64,' + b)).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(64, 64), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(bmp, 0, 0, 64, 64);
      const d = x.getImageData(0, 0, 64, 64).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114);
      return s / (d.length / 4);
    }, buf.toString('base64'));
    console.log('     （' + tag + ' 平均亮度 ' + png.toFixed(2) + '）');
    return png;
  };
  const on = await lum('带压色');
  await pg.evaluate(() => {
    document.documentElement.style.setProperty('--photo-veil', 'rgba(33,26,19,0)');
    document.documentElement.style.setProperty('--photo-look', 'none');
  });
  await sleep(400);
  const off = await lum('摘掉两个 token');
  await pg.evaluate(() => {
    document.documentElement.style.removeProperty('--photo-veil');
    document.documentElement.style.removeProperty('--photo-look');
  });
  const drop = off - on;
  /* 单位是 0–255 的平均亮度。veil α=.10 压在「每图平均亮度 ≈ 45%」的照片上，理论降幅 ≈ 0.10×(0.45−0.13)×255 ≈ 8.2，
     实测 8.6（filter 那档 saturate 对亮度只有二阶影响）。区间取 5–14：
     低于 5 = 压色根本没落到像素上（选择器断了 / token 被覆盖）；高于 14 = 有人把 α 往上拧却没重新核定（照片会开始发闷）。 */
  check('C1 压色真的改到像素：veil+filter 让封面平均亮度下降 5–14（0–255 域）',
    on > 0 && drop >= 5 && drop <= 14, '原样=' + off.toFixed(2) + ' 压色后=' + on.toFixed(2) + ' 降幅=' + drop.toFixed(2));

  /* ---------- D 首页精选大图（背景图型表面：filter 够不着，只能靠 ::after） ---------- */
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await pg.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
  await pg.evaluate(async () => { const r = window.loadTestData && window.loadTestData(); if (r && r.idb) { try { await r.idb; } catch (e) {} } });
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(2500);
  const tf = await probe('.trip-feature__img');
  check('D1 首页精选大图的 ::after 压色层在', /rgba\(33, 26, 19, 0\.1\)/.test(tf.afterBg + ' ' + tf.afterColor),
    'afterBg=' + tf.afterBg.slice(0, 60) + ' afterColor=' + tf.afterColor);
  check('D2 首页精选大图吃内描边', INSET_EDGE.test(tf.shadow), tf.shadow.slice(0, 70));
  check('D3 它是背景图表面：容器必须自己站住 position:relative', tf.pos === 'relative', 'position=' + tf.pos);

  /* ---------- E 相册 / 随笔：裸 <img> 走外圈描边，暗色档翻成亮细线 ---------- */
  await pg.goto(BASE + '/album.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(2500);
  const al = await probe('.al-ch-img');
  check('E1 相册章节图吃滤镜 + 外圈描边', al.filter === LOOK && al.shadow.indexOf(EDGE) >= 0 && al.shadow.indexOf('inset') < 0,
    'filter=' + al.filter + ' shadow=' + al.shadow.slice(0, 60));
  await pg.evaluate(() => document.body.classList.add('theme-dark'));
  await sleep(300);
  const alDark = await probe('.al-ch-img');
  const hair = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--edge-hair').trim());
  check('E2 暗色档下外圈描边翻成 --edge-hair（画在表面上，不翻就等于没有）',
    alDark.shadow.indexOf(hair.replace('rgba', 'rgba').replace(/\s+/g, ' ')) >= 0 || /rgba\(239, 233, 220/.test(alDark.shadow),
    'edge-hair=' + hair + ' shadow=' + alDark.shadow.slice(0, 60));
  await pg.goto(BASE + '/md-manager.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(2500);
  const md = await probe('.md-item .thumbs img');
  check('E3 随笔缩略图吃滤镜 + 外圈描边', md.filter === LOOK && md.shadow.indexOf(EDGE) >= 0,
    'filter=' + md.filter + ' shadow=' + md.shadow.slice(0, 60));

  await browser.close();
  server.close();
  console.log('\n=== smoke-photo: ' + (results.length - failures) + '/' + results.length + ' 通过 ===');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('SMOKE_PHOTO_CRASH ' + (e && e.message)); try { server.close(); } catch (e2) {} process.exit(2); });
