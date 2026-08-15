/* 探查 planner.html：summbar 完整 HTML + useLocBtn 绑定 */
const fs = require('fs');
const s = fs.readFileSync('planner.html', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf('summbar"');
console.log('=== summbar HTML ===');
console.log(s.slice(i - 100, i + 600));
