/* 字节对比：node-manager 的 USER_KEY 行 vs 修复脚本 from */
const fs = require('fs');
const nm = fs.readFileSync('node-manager.html', 'utf8');
const i = nm.indexOf('var USER_KEY');
console.log('nm 实际:', JSON.stringify(nm.slice(i, i + 30)));
const fx = fs.readFileSync('tools/fix-userkey.js', 'utf8');
const j = fx.indexOf('var USER_KEY');
console.log('脚本 from:', JSON.stringify(fx.slice(j, j + 40)));
