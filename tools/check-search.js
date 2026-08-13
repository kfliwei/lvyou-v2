const fs = require('fs');
const s = fs.readFileSync('search.html', 'utf8');
console.log('nation-index src :', s.includes("nation-index.js?v=20260813"));
console.log('RAW parse        :', s.includes('NATION_SITES_RAW'));
console.log('desc removed     :', !s.includes("(s.desc||'').slice(0,60)"));
console.log('keydown support  :', s.includes('it.onkeydown'));
console.log('role/tabindex    :', s.includes('role="button" tabindex="0"'));
