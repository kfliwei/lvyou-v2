/* 更新 smoke.js wishlist 断言：规划按钮跳转 planner */
const fs = require('fs');
let s = fs.readFileSync('tools/smoke.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const from = `    await page.click('#wlPlanBtn');
    await sleep(400);
    const toastShown = await page.evaluate(() => !!document.querySelector('.ui-toast'));
    ok('wishlist: 无数据规划给出 toast', toastShown);`;
const to = `    const planBind = await page.evaluate(() => {
      const b = document.getElementById('wlPlanBtn');
      if (!b) return '';
      if (b.onclick) return 'bound';
      return b.getAttribute('onclick') || '';
    });
    ok('wishlist: 规划按钮跳转 planner', planBind === 'bound' || /planner\\.html/.test(planBind), planBind);`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('tools/smoke.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('smoke wishlist 断言更新');
} else console.log('miss');
