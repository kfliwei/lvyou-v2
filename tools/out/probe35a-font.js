/* probe35a-font.js — 批次 35-A 地基实测：travel-notes.js:330 那个 :root 到底把字换成了什么
 * 用法: node tools/out/probe35a-font.js [页名，默认 index.html]
 * 为什么还差这一条腿：源码侧只能证明「出处与顺序」——
 *   · design.css:275-276 把 --fd/--fb 定义成 var(--font-serif)/var(--font-sans)（品牌族在队首）
 *   · travel-notes.js:330 的注入串自己又写了一遍 :root{--fd:"LXGW WenKai","Kaiti SC",serif;--fb:...}
 *   · 那份 <style> 是 buildUI()（:638-642）时才 append 到 head 的 ⇒ 必然排在 design.css 之后，
 *     同为 :root、同特异度 → 后加载者赢（批次 33-B 刚为同一根因收过一次）
 *   但「后加载者赢」只说明 CSS 里问的是哪个名字，不说明**画出来的是哪套字**。所以要读 computed 值。
 * 判据口径（刻意不用 document.fonts.check）：
 *   check('12px "不存在的族"') 在 Chrome 上返回 true（它按回退族算「已加载」），拿它断言「这族没命中」会得出假结论。
 *   改成量**同一串文本、同字号同字重下的 offsetWidth**：
 *     正对照 = 'monospace'（必须与其它几族都不同，证明这把尺子量得出字族差异）
 *     负对照 = 'TRACE Serif' 与 var(--font-serif)（必须相同，证明差异不是测量噪声）
 *     被试   = 泄漏族的解析值 与 design.css 品牌族的解析值
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = process.argv[2] || 'index.html';
const TOKENS = ['--fd', '--fb', '--tf', '--tn', '--bg', '--sf', '--sf2', '--ln', '--i9', '--i7', '--i5', '--sm', '--b6', '--b7', '--d3', '--a3'];

const out = [];
function p(s) { out.push(s); console.log(s); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  for (const pg0 of await browser.pages()) await pg0.close();
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', req => { const u = req.url(); if (/^https?:/i.test(u)) { req.abort().catch(() => {}); return; } req.continue().catch(() => {}); });
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e && e.message).slice(0, 160)));
  await pg.goto(pathToFileURL(path.join(ROOT, PAGE)).href, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  const readTokens = () => pg.evaluate((list) => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    for (const t of list) o[t] = (cs.getPropertyValue(t) || '').trim();
    return o;
  }, TOKENS);

  p('== 0. 前置：页内注册的 @font-face 族名（证明品牌字族在场，不是「库里没这枚字」）');
  const faces = await pg.evaluate(() => {
    const s = new Set();
    document.fonts.forEach(f => s.add(f.family + ' ' + f.weight));
    return { n: document.fonts.size, list: [...s].sort() };
  });
  p('   FontFaceSet size=' + faces.n + ' → ' + faces.list.join(' | '));
  for (const f of ['fonts/NotoSerifSC-400.woff2', 'fonts/NotoSerifSC-700.woff2']) {
    const abs = path.join(ROOT, f);
    p('   ' + f + ' 在场? ' + (fs.existsSync(abs) ? '是（' + fs.statSync(abs).size + ' 字节）' : '否') + '；已同步进壳 assets? '
      + (fs.existsSync(path.join(ROOT, '..', 'lvyou-v2-android', 'app', 'src', 'main', 'assets', f)) ? '是' : '否'));
  }

  p('');
  p('== 1. 开面板「之前」documentElement 上的别名解析值（design.css 那套）');
  const before = await readTokens();
  for (const t of TOKENS) p('   ' + t.padEnd(6) + '= ' + (before[t] === '' ? '(未定义)' : before[t]));

  p('');
  p('== 2. 开面板（TravelNotes.openPanel → buildUI() 才 append 那份 <style>）');
  const opened = await pg.evaluate(() => {
    if (!window.TravelNotes || !TravelNotes.openPanel) return 'NO-API';
    TravelNotes.openPanel({ label: '鹳雀楼', lat: 34.85, lng: 110.35 });
    return 'ok';
  });
  await new Promise(r => setTimeout(r, 1200));
  p('   openPanel → ' + opened + '；面板节点 .tn-panel 在场? '
    + await pg.evaluate(() => String(!!document.querySelector('.tn-panel'))));

  const order = await pg.evaluate(() => {
    const st = [...document.querySelectorAll('style')];
    const withFd = st.map((s, i) => ({ i, has: /(^|[;\s{])--fd\s*:/.test(s.textContent), len: s.textContent.length })).filter(x => x.has);
    return { total: st.length, withFd, lastIsFd: withFd.length ? withFd[withFd.length - 1].i === st.length - 1 : null };
  });
  p('   head 里 <style> 共 ' + order.total + ' 枚，含 `--fd:` 定义的：'
    + order.withFd.map(x => '#' + x.i + '(' + x.len + ' 字符)').join(' , ')
    + '；「含 --fd 的那枚是不是 head 最后一个 style」= ' + order.lastIsFd);
  p('   design.css 是外链 <link>，不进上面这个计数 ⇒ 顺序判据要读的是「注入串排在所有链接样式之后」，见上面枚数与 #id');

  p('');
  p('== 3. 开面板「之后」同一批别名（逐条标 变/不变）');
  const after = await readTokens();
  let changed = 0;
  for (const t of TOKENS) {
    const d = before[t] !== after[t];
    if (d) changed++;
    p('   ' + (d ? '变  ' : '=   ') + t.padEnd(6) + '= ' + (after[t] === '' ? '(未定义)' : after[t]));
  }
  p('   → ' + TOKENS.length + ' 个别名里 ' + changed + ' 个被这份注入串改写（整份文档级，不只面板内）');

  p('');
  p('== 4. computed font-family 的实际读数（面板里的标题族 vs 面板外用同族的地方）');
  const fam = await pg.evaluate(() => {
    const g = sel => { const e = document.querySelector(sel); return e ? { sel, ff: getComputedStyle(e).fontFamily, fs: getComputedStyle(e).fontSize, fw: getComputedStyle(e).fontWeight } : { sel, ff: null }; };
    const tnTitle = g('.tn-title');
    const out2 = [tnTitle, g('.tn-now__place'), g('.tn-item h4'), g('body')];
    /* 面板外那处用 var(--fd) 的内联样式（:1963「月份分布」在统计浮层里，本探针不触发它，改为现造一枚同写法） */
    const s = document.createElement('b');
    s.setAttribute('style', 'font-size:var(--fs-5);font-family:var(--fd)');
    s.textContent = '月份分布';
    document.body.appendChild(s);
    out2.push({ sel: '造一枚 font-family:var(--fd)（面板外，挂 body）', ff: getComputedStyle(s).fontFamily, fs: getComputedStyle(s).fontSize });
    s.remove();
    return out2;
  });
  for (const f of fam) p('   ' + f.sel.padEnd(46) + ' → ' + (f.ff === null ? '(不在场)' : f.ff) + (f.fs ? '   [' + f.fs + ' / ' + f.fw + ']' : ''));

  p('');
  p('== 5. 宽度对照：同一串文本、24px / 700 / nowrap，量字族是否真的换了');
  const widths = await pg.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const cases = [
      ['泄漏族的解析值 getComputedStyle(:root).--fd', (cs.getPropertyValue('--fd') || '').trim()],
      ['design.css 品牌族 var(--font-serif)', (cs.getPropertyValue('--font-serif') || '').trim()],
      ['① 档字面族 "Songti SC",serif（results.js 那五处弹层头部用的）', '"Songti SC",serif'],
      ['① 档字面族 "Noto Sans SC",sans-serif（travel-notes.js 两处 popup）', '"Noto Sans SC",sans-serif'],
      ['负对照 TRACE Serif（应 == var(--font-serif)）', "'TRACE Serif'"],
      ['正对照 monospace（必须与其它都不同）', 'monospace'],
      ['正对照 sans-serif', 'sans-serif'],
      ['--fb 泄漏族解析值', (cs.getPropertyValue('--fb') || '').trim()],
      ['--fb 品牌族 var(--font-sans)', (cs.getPropertyValue('--font-sans') || '').trim()],
    ];
    const TXT = '留下这一刻鹳雀楼九月二十六日';
    const res = cases.map(([label, stack]) => {
      const sp = document.createElement('span');
      sp.textContent = TXT;
      sp.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:24px;font-weight:700;white-space:nowrap;letter-spacing:normal;font-variant:normal';
      sp.style.fontFamily = stack;
      document.body.appendChild(sp);
      const w = +sp.getBoundingClientRect().width.toFixed(2);
      sp.remove();
      return { label, stack, w };
    });
    return { txt: TXT, n: TXT.length, res };
  }, TOKENS);
  p('   文本『' + widths.txt + '』× 24px / 700（' + widths.n + ' 字）');
  for (const r of widths.res) p('   ' + String(r.w).padStart(8) + ' px  ' + r.label + '   ← 族串: ' + r.stack);

  const idx = n => widths.res.findIndex(r => r.label.startsWith(n));
  const wFd = widths.res[idx('泄漏族')].w, wSerif = widths.res[idx('design.css')].w;
  const wTrace = widths.res[idx('负对照')].w, wMono = widths.res[idx('正对照 monospace')].w;
  const wFbLeak = widths.res[idx('--fb 泄漏族')].w, wFbBrand = widths.res[idx('--fb 品牌族')].w;
  p('');
  p('   判读：');
  p('   · 尺子有效? monospace ' + wMono + ' vs 品牌衬线 ' + wSerif + ' → 差 ' + (wMono - wSerif).toFixed(2) + ' px（必须明显非 0）');
  p('   · 负对照有效? TRACE Serif ' + wTrace + ' vs var(--font-serif) ' + wSerif + ' → 差 ' + (wTrace - wSerif).toFixed(2) + ' px（必须为 0，否则噪声会冒充差异）');
  p('   · --fd 中招了吗? 泄漏族 ' + wFd + ' vs 品牌族 ' + wSerif + ' → 差 ' + (wFd - wSerif).toFixed(2) + ' px（' + (Math.abs(wFd - wSerif) > 0.5 ? '换了字' : '同一套字，只是名字难看') + '）');
  p('   · --fb 中招了吗? 泄漏族 ' + wFbLeak + ' vs 品牌族 ' + wFbBrand + ' → 差 ' + (wFbLeak - wFbBrand).toFixed(2) + ' px');

  p('');
  p('== 6. 本机环境注记（读数的适用边界）');
  p('   本机 = Windows Chrome。这批名字里 Songti SC／Kaiti SC／LXGW WenKai／PingFang SC 在 Windows 与 Android 都不命中，');
  p('   但 Microsoft YaHei 在 Windows **命中**、在 Android 不命中 ⇒ 「sans 一族差异小」这条读数在手机上只会更差，不会更好。');
  p('   页面未捕获异常: ' + (errs.length ? errs.join(' | ') : '无'));
  fs.writeFileSync(path.join(__dirname, 'b35a-font.txt'), out.join('\n') + '\n');
  await browser.close();
})().catch(e => { console.log('THROW ' + (e && e.message)); fs.writeFileSync(path.join(__dirname, 'b35a-font.txt'), out.join('\n') + '\nTHROW ' + (e && e.stack)); process.exit(1); });
