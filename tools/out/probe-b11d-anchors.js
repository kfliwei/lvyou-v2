const fs = require('fs');
const doc = fs.readFileSync('改进实施方案与验收标准.md', 'utf8');
const line = doc.split(/\r?\n/).filter(l => l.indexOf('grep -oE') >= 0);
line.forEach(l => console.log('DOC:', JSON.stringify(l.slice(0, 260))));
const pl = fs.readFileSync('planner.js', 'utf8');
['var wl = (window.Wish && Wish.list) ? Wish.list() : [];',
  'var notes = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list() : [];'].forEach(a => console.log('planner count', pl.split(a).length - 1, JSON.stringify(a.slice(0, 40))));
['只送聚合关键词', '不出门'].forEach(w => console.log('doc count', doc.split(w).length - 1, w));
const a = doc.indexOf('## P2-8'), b = doc.indexOf('## 豁免登记');
const sec = doc.slice(a, b);
console.log('doc 正文…不出门 match:', /正文.{0,14}不出门/s.test(sec), '只送聚合关键词:', /只送聚合关键词/.test(sec));
sec.split(/\r?\n/).forEach((l, i) => { if (l.indexOf('不出门') >= 0) console.log('  不出门@', i, JSON.stringify(l.slice(0, 110))); });
const sm = fs.readFileSync('tools/smoke-planner.js', 'utf8');
console.log('smoke N23 anchor count', sm.split("'画像是聚合出来的：省 / 市 / 心愿单主题 / 近期关键词逐个在体里'").length - 1);
console.log('smoke 画像是聚合出来的 count', sm.split('画像是聚合出来的').length - 1);
const st = fs.readFileSync('story.html', 'utf8');
console.log('story ui.js count', st.split('<script src="ui.js"></script>').length - 1);
