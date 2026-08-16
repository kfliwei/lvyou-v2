/* 探查 node-manager 添加节点逻辑 */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
console.log('=== 表单相关 ===');
['nmName', 'nmProv', 'nmCity', 'nmCat', 'addNode', 'saveNode', 'userNodes', 'btnAdd'].forEach(k => {
  const i = h.indexOf('id="' + k + '"');
  if (i >= 0) console.log(k + ': ' + h.slice(i, i + 130).replace(/\n/g, ' '));
});
console.log('=== 添加按钮/函数 ===');
const lines = h.split('\n');
lines.forEach((l, i) => { if (/addUserNode|saveUser|tn_userNodes|添加节点/.test(l) && !l.trim().startsWith('//')) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });
