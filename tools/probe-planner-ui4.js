/* 探查 planner.js：orderStops（排序算法）+ renderMap 全貌 + useLocBtn onclick */
const fs = require('fs');
const s = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
console.log('=== orderStops ===');
const j = s.indexOf('function orderStops');
console.log(s.slice(j, j + 700));
console.log('=== renderMap 全貌 ===');
const k = s.indexOf('function renderMap');
console.log(s.slice(k, k + 1500));
