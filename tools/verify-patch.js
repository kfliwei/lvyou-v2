/* 确认 node-manager.html 实际内容：分流 + oneLineAdd + finish 保存 */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
console.log('go.onclick 分流:', h.includes('go.onclick = function () {\n      var t = (input.value || \'\').trim();'));
console.log('oneLineAdd 定义:', h.includes('function oneLineAdd(text)'));
console.log('parseOneLineRule 定义:', h.includes('function parseOneLineRule(t)'));
console.log('finish 保存:', h.includes('arr.push(rec); saveUserNodes(arr);'));
console.log('USER_KEY 修复:', h.includes("var USER_KEY = 'tn_user' + 'Nodes';"));
console.log('--- go 绑定段 ---');
const i = h.indexOf('go.onclick');
console.log(h.slice(i, i + 320));
