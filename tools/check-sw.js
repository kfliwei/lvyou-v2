const fs = require('fs');
const s = fs.readFileSync('sw.js', 'utf8');
console.log('v12     :', s.includes('trace-v12'));
console.log('bj-data :', s.includes("'./bj-data.js'"));
console.log('ui.js   :', s.includes("'./ui.js'"));
console.log('tw-data :', s.includes("'./tw-data.js'"));
console.log('nation-i:', s.includes("'./nation-index.js'"));
