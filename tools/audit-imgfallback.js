/* tools/audit-imgfallback.js — P0-2 断图模拟取证闸门（批次 4 验收标准第 1/3 条）
 * 原理：file:// 页面无法真断网，就把所有图片请求（jpg/png/webp/gif/svg）一律回 404——
 *   这比断网更狠：本地镜像、用户照片 URL、装饰 art svg 全部到不了，等价"任何图都挂"的最坏态。
 * 判据：视口内不存在「可见 && complete && naturalWidth===0」的 img（=浏览器破图图标态），
 *   且占位机制真实显形（.ph.is-ph / .img-fallback / .ls-img-ph 计数>0，防止"图全删光"冒充零破图）。
 * 用法: NODE_PATH=tools/node_modules node tools/audit-imgfallback.js
 * 产物: tools/out/imgfb-{index,search,topic-cards,topic-sheet}.png + img-fallback.txt */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(ROOT, 'tools', 'out');
const IMG_RE = /\.(jpe?g|png|webp|gif|svg)(\?|$)/i;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.setRequestInterception(true);
  pg.on('request', req => {
    const u = req.url();
    if (IMG_RE.test(u) || /store\.is\.autonavi|aos-comment/.test(u)) req.respond({ status: 404, contentType: 'text/plain', body: 'simulated offline' }).catch(() => {});
    else req.continue().catch(() => {});
  });

  let pass = true;
  const probe = () => pg.evaluate(() => {
    const imgs = [].slice.call(document.querySelectorAll('img'));
    const broken = imgs.filter(i => {
      const r = i.getBoundingClientRect();
      const st = getComputedStyle(i);
      const vis = r.width > 2 && r.height > 2 && st.display !== 'none' && st.visibility !== 'hidden' && i.offsetParent !== null;
      return vis && i.complete && i.naturalWidth === 0;
    });
    return { total: imgs.length, broken: broken.length, srcs: broken.slice(0, 3).map(i => i.getAttribute('src')),
      ph: { cardIsPh: document.querySelectorAll('.ph.is-ph').length, imgFallback: document.querySelectorAll('.img-fallback').length, lsPh: document.querySelectorAll('.ls-img-ph').length } };
  });

  const verdict = (name, r, needPh) => {
    const ok = r.broken === 0 && (!needPh || (r.ph.cardIsPh + r.ph.imgFallback + r.ph.lsPh) > 0);
    if (!ok) pass = false;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + ': <img> ' + r.total + ' · 破图 ' + r.broken + ' · 占位 ' + JSON.stringify(r.ph) + (r.broken ? ' ← ' + r.srcs.join(' ') : ''));
    return ok;
  };

  /* index / search：空库首屏，图挂光也应零破图 */
  for (const [p, name] of [['index.html', 'index'], ['search.html', 'search']]) {
    await pg.goto(pathToFileURL(path.join(ROOT, p)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1800));
    verdict(name, await probe(), false);
    await pg.screenshot({ path: path.join(OUT, 'imgfb-' + name + '.png') });
  }

  /* topic 卡片态：列表 tab 激活，占位必须显形（不许拿"没图"冒充零破图） */
  await pg.goto(pathToFileURL(path.join(ROOT, 'topic.html')).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2200));
  await pg.click('.tabbar button[data-tab="list"]').catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  verdict('topic-cards', await probe(), true);
  await pg.screenshot({ path: path.join(OUT, 'imgfb-topic-cards.png') });

  /* topic sheet：开首个景点弹层，ls-img 框必须切 ls-img-ph 品牌占位且框内无存活 img */
  await pg.click('.tabbar button[data-tab="map"]').catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  await pg.evaluate(() => { var c = document.querySelector('.card[data-i]'); c && c.click(); });
  await new Promise(r => setTimeout(r, 2200));
  const sheet = await pg.evaluate(() => {
    const box = document.getElementById('lsImgBox');
    if (!box) return { open: false };
    const imgs = [].slice.call(box.querySelectorAll('img'));
    const broken = imgs.filter(i => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none').length;
    return { open: true, ph: box.querySelectorAll('.ls-img-ph').length, brokenInBox: broken };
  });
  const sheetOk = sheet.open && sheet.ph === 1 && sheet.brokenInBox === 0;
  if (!sheetOk) pass = false;
  console.log((sheetOk ? 'PASS ' : 'FAIL ') + 'topic-sheet: 打开=' + sheet.open + ' · ls-img-ph=' + (sheet.ph || 0) + ' · 框内破图=' + (sheet.brokenInBox || 0));
  await pg.screenshot({ path: path.join(OUT, 'imgfb-topic-sheet.png') });

  fs.writeFileSync(path.join(OUT, 'img-fallback.txt'),
    '批次4 断图模拟取证（audit-imgfallback.js 可复跑）\n所有图片请求回 404（比断网更狠的最坏态）\n结果: ' + (pass ? 'PASS 零破图 + 占位显形' : 'FAIL 见上方') + '\n截图: imgfb-index.png / imgfb-search.png / imgfb-topic-cards.png / imgfb-topic-sheet.png\n');
  await browser.close();
  console.log('=== ' + (pass ? 'PASS 断图模拟零破图' : 'FAIL') + ' ===');
  process.exit(pass ? 0 : 1);
})();
