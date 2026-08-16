/* 查 planner.js USER_KEY 用途 + node-manager tn_userNodes 上下文 */
const fs = require('fs');
const p = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const lines = p.split('\n');
lines.forEach((l, i) => { if (l.includes('USER_KEY')) console.log('planner L' + (i + 1) + ': ' + l.trim().slice(0, 110)); });
lines.forEach((l, i) => { if (l.includes('tn_userNodes')) console.log('planner L' + (i + 1) + ': ' + l.trim().slice(0, 110)); });
const n = fs.readFileSync('node-manager.html', 'utf8').replace(/\r\n/g, '\n');
const nl = n.split('\n');
nl.forEach((l, i) => { if (l.includes('tn_userNodes')) console.log('nm L' + (i + 1) + ': ' + l.trim().slice(0, 110)); });
