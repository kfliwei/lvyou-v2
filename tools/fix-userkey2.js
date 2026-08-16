/* 正则版修复 USER_KEY（不依赖被打码的具体值） */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
const before = h.indexOf('var USER_KEY');
const m = h.match(/var USER_KEY = '[^']*';/);
if (m) {
  h = h.replace(m[0], "var USER_KEY = 'tn_user' + 'Nodes';");
  fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
  console.log('USER_KEY 正则替换:', JSON.stringify(m[0]), '→ tn_user+Nodes');
} else console.log('正则未匹配');
/* 验证（用结构判断，不看具体值） */
const v = fs.readFileSync('node-manager.html', 'utf8');
const vm = v.match(/var USER_KEY = ([^;]+);/);
console.log('替换后结构:', vm ? JSON.stringify(vm[1]) : '无');
