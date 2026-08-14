/* 验证：随手记面板 v3 精修渲染（样式生效 + 功能正常） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fails = 0;
function ok(name, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // 打开随手记面板（直接调 openPanel）
  await page.evaluate(() => {
    window.TravelNotes.openPanel({ label: '故宫博物院', lat: 39.916, lng: 116.397 });
  });
  await new Promise(r => setTimeout(r, 1000));
  const d = await page.evaluate(() => {
    const panel = document.querySelector('.tn-panel');
    if (!panel) return { panel: false };
    const cs = getComputedStyle(panel);
    const head = document.querySelector('.tn-head');
    const headCs = head ? getComputedStyle(head) : null;
    const mic = document.querySelector('.tn-mic');
    const micCs = mic ? getComputedStyle(mic) : null;
    const rec = document.querySelector('.tn-recbox');
    const recCs = rec ? getComputedStyle(rec) : null;
    const nowPlace = document.querySelector('.tn-now__place');
    return {
      panel: true,
      display: panel.style.display,
      bg: cs.backgroundImage.slice(0, 60),
      animation: cs.animationName,
      headBg: headCs ? headCs.backgroundImage.slice(0, 40) : null,
      headBorder: headCs ? headCs.borderBottomColor : null,
      micBg: micCs ? micCs.backgroundImage.slice(0, 40) : null,
      micRadius: micCs ? micCs.borderRadius : null,
      recRadius: recCs ? recCs.borderRadius : null,
      recBlur: recCs ? recCs.backdropFilter : null,
      seal: nowPlace ? getComputedStyle(nowPlace, '::before').content : null,
      saveBtn: (() => { const b = document.querySelector('#tnSave'); return b ? getComputedStyle(b).borderRadius : null; })()
    };
  });
  ok('面板正常打开', d.panel && d.display === 'flex', '');
  const rules = await page.evaluate(() => {
    let has175 = false, hasHeadV3 = false;
    for (const sheet of document.styleSheets) {
      let rs; try { rs = sheet.cssRules; } catch (e) { continue; }
      for (const r of rs) {
        const t = r.cssText || '';
        if (t.includes('175deg')) has175 = true;
        if (r.selectorText === '.tn-head' && t.includes('rgba(250, 246, 236')) hasHeadV3 = true;
      }
    }
    return { has175, hasHeadV3 };
  });
  ok('面板米白渐变背景（v3 规则生效）', rules.has175, JSON.stringify(rules));
  ok('面板滑入动画', d.animation === 'tnPanelIn', d.animation);
  ok('头部浅色规则生效', rules.hasHeadV3, '');
  ok('麦克风渐变+圆形', /linear-gradient/.test(d.micBg || '') && d.micRadius === '50%', d.micBg);
  ok('转写区毛玻璃圆角', d.recRadius === '16px' && d.recBlur !== 'none', d.recBlur);
  ok('地点印章（记）', d.seal && d.seal.includes('记'), d.seal);
  ok('保存按钮胶囊', d.saveBtn === '999px', d.saveBtn);

  // 功能：关闭按钮
  await page.evaluate(() => { const x = document.getElementById('tnX'); if (x) x.click(); });
  await new Promise(r => setTimeout(r, 500));
  const closed = await page.evaluate(() => document.querySelector('.tn-panel').style.display);
  ok('关闭功能正常', closed === 'none', closed);

  const real = errs.filter(e => !/Failed to load resource|net::|ERR_|manifest/.test(e));
  ok('无脚本错误', real.length === 0, real[0] || '');
  console.log(fails ? '=== UI-V3 CHECK FAIL ===' : '=== UI-V3 CHECK ALL PASSED ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
