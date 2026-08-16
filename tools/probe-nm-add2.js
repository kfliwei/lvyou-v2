/* 查看 node-manager 添加保存逻辑（780-830）与表单渲染（addForm） */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
const L = h.split('\n');
/* 找保存添加的函数 */
L.forEach((l, i) => { if (/function .*[Aa]dd.*[Nn]ode|function saveNode|nmName.*value/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });
console.log('--- 800-830 ---');
console.log(L.slice(795, 830).join('\n').slice(0, 2000));
