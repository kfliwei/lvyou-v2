/* 查 planner.js 的 tn_userNodes 键值（字节级） */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8');
['tn_userNodes', "USER_KEY", "getItem('tn_user"].forEach(k => {});
const i = s.indexOf('tn_userNodes');
console.log('planner tn_userNodes 出现次数:', s.split('tn_userNodes').length - 1);
const j = s.indexOf('USER_KEY');
console.log('planner USER_KEY:', j >= 0 ? JSON.stringify(s.slice(j, j + 50)) : '无');
/* 其他文件 */
['wishlist.html', 'node-manager.html', 'settings.html', 'me.html'].forEach(f => {
  try {
    const t = fs.readFileSync(f, 'utf8');
    const c = t.split('tn_userNodes').length - 1;
    const k = t.indexOf('USER_KEY');
    console.log(f + ': tn_userNodes x' + c + (k >= 0 ? ' | USER_KEY=' + JSON.stringify(t.slice(k, k + 40)) : ''));
  } catch (e) {}
});
