/* tools/smoke-story.js — 叙事页真实浏览器冒烟（加载无 JS 报错 + 分镜控件存在） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await p.goto('file:///' + path.join(ROOT, 'story.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  ok('页面加载', true);
  ok('分镜导航条存在', !!(await p.$('#storyNav')));
  ok('上一站/下一站按钮存在', !!(await p.$('#snPrev')) && !!(await p.$('#snNext')));
  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest|tile/.test(e));
  ok('无 JS 报错', real.length === 0, real.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
