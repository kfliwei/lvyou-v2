/* 查 go 按钮绑定实际代码 */
const fs = require('fs');
const h = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
const i = h.indexOf("aiNodeGo");
const j = h.indexOf("aiNodeGo");
/* 找 go.onclick 或 #aiNodeGo 绑定 */
const k = h.indexOf('aiNodeGo');
const seg = h.slice(k, k + 800);
console.log(seg);
