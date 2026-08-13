/* map.css 增强：详情封面大图 + 聚合胶囊玻璃拟态 + 深色 */
const fs = require('fs');
let s = fs.readFileSync('map.css', 'utf8');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP map:' + tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK   map:' + tag);
}
/* 封面大图：更高 + 渐变遮罩 + 阴影 */
rep(
  '.ls-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;display:block;margin:6px 0 10px;position:relative}',
  '.ls-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:16px;display:block;margin:8px 0 12px;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(40,38,32,.10)}',
  '1.ls-img size'
);
rep(
  '.ls-img img{width:100%;height:100%;object-fit:cover;border-radius:14px}',
  '.ls-img img{width:100%;height:100%;object-fit:cover;border-radius:16px}\n.ls-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(32,32,29,.22));pointer-events:none}',
  '2.ls-img mask'
);
/* 聚合胶囊玻璃拟态 */
rep(
  '.lod-cl{',
  '.lod-cl{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
  '3.lod-cl glass'
);
fs.writeFileSync('map.css', s, 'utf8');
console.log('map patches:', n);
