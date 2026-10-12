/* tools/smoke-nodes.js — 专题页地图功能回归（区域统计 + 筛选双态；节点管理已移至 node-manager.html） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let fails = 0, total = 0;
function ok(name, cond, extra) {
  total++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  /* 1. 专题页无节点管理 FAB */
  ok('专题页无 FAB', !(await page.$('.nm-fab')));

  /* 2. 区域统计条（高 zoom 后 moveend 触发） */
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 11); });
  let statsTxt = '';
  for (let i = 0; i < 8; i++) {
    await sleep(600);
    statsTxt = await page.evaluate(() => (document.querySelector('.region-stats') || {}).textContent || '');
    if (statsTxt.includes('当前区域')) break;
  }
  ok('区域统计条出现', statsTxt.includes('当前区域'), statsTxt.slice(0, 40));

  /* 3. 统计条 chip 点击 → 筛选强调 */
  await page.evaluate(() => {
    const chip = document.querySelector('.region-stats .rs-chip');
    if (chip) chip.click();
  });
  await sleep(1500);
  const chipDim = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-dim').length);
  ok('统计条 chip 触发筛选强调', chipDim > 0, 'dim=' + chipDim);
  /* 清除筛选 */
  await page.evaluate(() => { const c = document.querySelector('#dynChips .chip.all'); if (c) c.click(); });
  await sleep(800);

  /* 4. 高 zoom 节点渲染 + 筛选双态（主题 chip）
     取样不再硬写标签名（改前写死「古建」，而那颗 chip 恰好就是坏的那一颗：chip 存别名原名、
     筛选比归一值 → 一点全淡，判据永远只能验到「dim>0」这半边）。现在从当前视野里真有点亮节点
     的主题中取命中最多的一颗，视野里没有的主题不算。 */
  await page.evaluate(() => { window.TopicEngine._map.setView([39.92, 116.40], 12); });
  await sleep(1500);
  const before = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  ok('高 zoom 节点已渲染', before > 0, 'nodes=' + before);

  /* 主题族形状检（这批 bug 本体）：chip 与图例必须同名单、chip 文案不许是别名、
     每条 chip 至少能命中一个景点。任一条破 = 点下去整张图变淡、零结果。
     名单从 TOPIC_META.themeOrder 取，不用 .chip-dot 认主题——必去/网红/这一带也带圆点。 */
  const shape = await page.evaluate('(function(){' +
    'var A=window.THEME_ALIAS||{},M=window.TOPIC_META||{},S=window.SITES||[];' +
    'var order=M.themeOrder||[];' +
    'var labels=[].slice.call(document.querySelectorAll("#dynChips .chip")).map(function(c){return c.textContent.trim();})' +
    '  .filter(function(t){return order.indexOf(t)>=0;});' +
    'var legs=[].slice.call(document.querySelectorAll("#legBody .lg")).map(function(l){return l.dataset.th;}).filter(Boolean);' +
    'var norm=function(t){return A[t]||t;};' +
    'var cnt={};S.forEach(function(s){var t=norm(s[M.themeKey||"theme"]);cnt[t]=(cnt[t]||0)+1;});' +
    'return {order:order,labels:labels,legs:legs,' +
    ' aliasLeft:labels.filter(function(t){return A[t];}),' +
    ' dupLabels:labels.filter(function(t,i){return labels.indexOf(t)!==i;}),' +
    ' zeroHit:labels.filter(function(t){return !cnt[t];}),' +
    ' legMissing:labels.filter(function(t){return legs.indexOf(t)<0;}),' +
    ' noColor:order.filter(function(t){return !M.themes[t];})};})()');
  ok('chip 名单=归一后的 themeOrder（' + shape.labels.length + ' 颗）', shape.labels.length === shape.order.length, JSON.stringify(shape.order));
  ok('主题 chip 全是标准名（点下去筛得中，不是别名空枪）', shape.aliasLeft.length === 0, shape.aliasLeft.join(','));
  ok('主题 chip 无重名（撞车的第二颗已丢掉）', shape.dupLabels.length === 0, shape.dupLabels.join(','));
  ok('每颗主题 chip 在本页至少命中 1 个景点', shape.zeroHit.length === 0, shape.zeroHit.join(','));
  ok('chip 与图例同名单（联动不会因为名字不同而落空）', shape.legMissing.length === 0, shape.legMissing.join(','));
  ok('themeOrder 里每个名字都查得到配色（不会静默退灰）', shape.noColor.length === 0, shape.noColor.join(','));

  /* 取样：逐颗点一遍，只记「视野里真点亮了几枚」，取命中最多的一颗做后面的双态判据。
     视野里没有的主题亮 0 是正常的，所以判据必须建立在这个取样上，不能任选一颗。 */
  const picked = await page.evaluate((order) => {
    let best = null;
    order.forEach(l => {
      const c = [...document.querySelectorAll('#dynChips .chip')].filter(x => x.textContent.trim() === l)[0];
      if (!c) return;
      c.click();
      const lit = [...document.querySelectorAll('#mapEl .tr-node')].filter(n => !n.classList.contains('tr-dim')).length;
      if (!best || lit > best.lit) best = { lit, label: l };
    });
    return best;
  }, shape.order);
  ok('视野内有点亮节点的主题取样成功（' + picked.label + ' 亮 ' + picked.lit + ' 枚）', picked && picked.lit > 0, JSON.stringify(picked));
  /* 取样循环最后点的是名单末尾那颗，判据要落在 picked 上 → 再点一次选中它 */
  await page.evaluate((l) => {
    const c = [...document.querySelectorAll('#dynChips .chip')].filter(x => x.textContent.trim() === l)[0];
    if (c) c.click();
  }, picked.label);
  await sleep(1200);
  const dimCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-dim').length);
  const allCount = await page.evaluate(() => document.querySelectorAll('#mapEl .tr-node').length);
  const litCount = allCount - dimCount;
  ok('筛选双态：命中的亮、非命中的降透明', dimCount > 0 && litCount > 0, 'dim=' + dimCount + ' lit=' + litCount + ' total=' + allCount);
  /* 图例那枚点是 inline style，浏览器读回来是 rgb()，配色表里是 #RRGGBB —— 先换算再比，
     别用 indexOf（'#8A5A44' 永远不在 'RGB(138, 90, 68)' 里，判据自己会假红）。 */
  function hexOf(v) {
    const s = (v || '').trim();
    const m = s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (m) return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('').toUpperCase();
    return s.toUpperCase();
  }
  const colorHit = await page.evaluate((l) => {
    const M = window.TOPIC_META || {};
    const want = ((M.themes || {})[l] || '').toUpperCase();
    if (!want) return { want: want, ok: false, why: '配色表查不到' };
    const chip = [...document.querySelectorAll('#dynChips .chip')].filter(x => x.textContent.trim() === l)[0];
    const leg = [...document.querySelectorAll('#legBody .lg')].filter(x => x.dataset.th === l)[0];
    const head = [...document.querySelectorAll('.tl-head')].filter(x => x.dataset.th === l || x.textContent.indexOf(l) >= 0)[0];
    const rd = (n) => n ? ((n.getAttribute('style') || '') + '|' + (n.querySelector('.dot,.d') ? (n.querySelector('.dot,.d').getAttribute('style') || '') : '')) : '(缺)';
    return {
      want: want,
      chipDot: (chip ? chip.style.getPropertyValue('--dot') : '(无chip)').toUpperCase(),
      legDot: leg ? rd(leg) : '(无图例行)',
      headDot: head ? rd(head) : '(无分组头)',
    };
  }, picked.label);
  const legHex = colorHit.legDot && colorHit.legDot.indexOf('background:') >= 0
    ? hexOf((colorHit.legDot.match(/background:\s*([^;]+)/) || [])[1]) : '';
  const headHex = colorHit.headDot && colorHit.headDot.indexOf('background:') >= 0
    ? hexOf((colorHit.headDot.match(/background:\s*([^;]+)/) || [])[1]) : '';
  ok('chip 圆点颜色=配色表里「' + picked.label + '」那支 ' + colorHit.want, colorHit.chipDot === colorHit.want,
    'chip=' + colorHit.chipDot + ' 表=' + colorHit.want);
  ok('图例行的点用同一支色（图例与 chip 同源，不是各自查表）', legHex === colorHit.want, '图例 ' + legHex + ' ← ' + colorHit.legDot.slice(0, 60));
  ok('「主题」栏分组头那枚点也是同一支色', headHex === colorHit.want, '分组头 ' + headHex + ' ← ' + colorHit.headDot.slice(0, 60));

  /* 5. 图例联动 */
  const legOn = await page.evaluate(() => [...document.querySelectorAll('#legBody .lg')].filter(l => l.classList.contains('on')).map(l => l.dataset.th || '全部'));
  ok('图例选中态同步', legOn.length === 1 && legOn[0] === picked.label, legOn.join(','));
  const chipOn = await page.evaluate(() => [...document.querySelectorAll('#dynChips .chip')].filter(c => c.classList.contains('on')).map(c => c.textContent.trim().slice(0, 10)));
  ok('顶部标签选中态同步', chipOn.length === 1 && chipOn[0] === picked.label, chipOn.join(','));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real.join(' | ').slice(0, 120));

  /* 条数守卫：腿是顺序跑的，中间抛了＝后面几条判据一条没执行，那种「全绿」是空转出来的 */
  ok('本腿条数守卫（≥18 条）', total >= 18, '实际执行 ' + total + ' 条');

  await browser.close();
  console.log(fails ? '=== NODES SMOKE FAIL: ' + fails + ' issue(s) ===' : '=== NODES SMOKE ALL PASSED ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
