/* tools/smoke-review.js — 旅程回顾页真实浏览器冒烟（P0-1 图标体系的回归位）
 * 为什么单独一个文件：review.html 此前不在任何 smoke 覆盖里，导致「renderDay 用 TI() 却没引 icons.js」
 * 这种整块功能直接 ReferenceError 的缺陷一路发到发布分支——日历点有记录的日期，日详情永远空白。
 * 用法: node tools/smoke-review.js
 * 判据用"种子数据 + 真实点击"，不用 DOM 存在性糊弄：moodrow 必须真的渲染出 6 个 sprite 图标。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }
const wait = ms => new Promise(r => setTimeout(r, ms));
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); } catch (e) {} });

  /* 先灌种子数据（走项目自己的 loadTestData，不手抄存储键），再进 review——
     游记列表要重载后才从 IndexedDB 读得到，所以 seed 与观察分两次导航。 */
  await p.goto(url('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.addScriptTag({ path: path.join(ROOT, 'test-data.js') });
  const seeded = await p.evaluate(async () => {
    const r = window.loadTestData && window.loadTestData();
    if (r && r.idb) { try { await r.idb; } catch (e) {} }
    return r && r.added;
  });
  ok('种子数据已写入', seeded > 0, 'added=' + seeded);

  await p.goto(url('review.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(2500);
  ok('TI 图标入口可用', await p.evaluate(() => typeof window.TI === 'function'));
  const has = await p.evaluate(() => document.querySelectorAll('#calGrid .cal-cell.has').length);
  ok('日历渲染出有记录的日期', has > 0, 'has=' + has);

  const before = await p.evaluate(() => (document.getElementById('dayBox').textContent || '').trim().length);
  await p.evaluate(() => document.querySelector('#calGrid .cal-cell.has').click());
  await wait(400);
  const day = await p.evaluate(() => {
    var box = document.getElementById('dayBox');
    var row = box.querySelector('.moodrow');
    var keys = row ? Array.prototype.slice.call(row.querySelectorAll('.mk')) : [];
    return {
      eyebrow: (box.querySelector('.eyebrow') || {}).textContent || '',
      items: box.querySelectorAll('.md-item').length,
      moodRow: !!row,
      keyCount: keys.length,
      svgCount: row ? row.querySelectorAll('.mk:not(.clear) svg').length : 0,
      useRefs: row ? Array.prototype.slice.call(row.querySelectorAll('.mk:not(.clear) svg use')).map(function (u) { return u.getAttribute('xlink:href') || u.getAttribute('href'); }) : [],
      keyEmoji: keys.filter(function (k) { return EMOJI_TEST(k.textContent); }).length,
      emptyBox: !box.innerHTML.trim()
    };
    function EMOJI_TEST(t) { return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t || ''); }
  });
  ok('点日期后日详情有内容（旧缺陷：TI 未定义 → 整块空白）', day.moodRow && day.items > 0,
    'items=' + day.items + ' boxLenBefore=' + before + ' emptyBox=' + day.emptyBox);
  ok('心情条渲染 6 个图标 + 1 个清除', day.keyCount === 7, 'mk=' + day.keyCount);
  ok('心情位走 sprite 图标而非 emoji 字形', day.svgCount === 6 && day.keyEmoji === 0,
    'svg=' + day.svgCount + ' emojiKeys=' + day.keyEmoji);
  ok('图标确有 sprite 引用（smile/meh/sad/mountain/food/compass）',
    day.useRefs.length === 6 && day.useRefs.join(',') === '#ti-smile,#ti-meh,#ti-sad,#ti-mountain,#ti-food,#ti-compass',
    day.useRefs.join(','));
  const calMood = await p.evaluate(() => {
    var m = document.querySelector('#calGrid .cal-cell .mood');
    return m ? { text: m.textContent, svg: !!m.querySelector('svg') } : null;
  });
  ok('日历格的心情位同样走图标（选完心情后才有节点，允许尚未出现）', !calMood || calMood.svg,
    calMood ? 'text=' + JSON.stringify(calMood.text) : 'none');

  /* 点一个心情，验证写回 data-m 仍是 emoji（老数据兼容），且日历格回显不再是彩色 emoji */
  await p.evaluate(() => { var k = document.querySelector('#dayBox .moodrow .mk[data-m="😀"]'); if (k) k.click(); });
  await wait(400);
  const after = await p.evaluate(() => {
    var m = document.querySelector('#calGrid .cal-cell .mood');
    return { stored: (localStorage.getItem('tn_dayMoods') || ''), calText: m ? m.textContent : '', calSvg: m ? !!m.querySelector('svg') : false };
  });
  ok('心情已持久化', /😀/.test(after.stored), after.stored.slice(0, 60));
  ok('持久化后日历格回显走图标', after.calSvg && !/[\u{1F000}-\u{1FAFF}]/u.test(after.calText), 'cal=' + JSON.stringify(after.calText));

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|tile/i.test(e));
  ok('全程无 JS 报错', real.length === 0, real.slice(0, 3).join(' | '));

  await b.close();
  console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
