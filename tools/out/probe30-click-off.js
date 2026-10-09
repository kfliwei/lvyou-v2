/* 一次性反向自证：摘掉 review.html 日卡缩略图的 onclick，smoke-review 必须红在「接了放大出口／点开看图器」那两条。
   用法: node tools/out/probe30-click-off.js off|on */
const fs = require('fs');
const P = 'review.html';
const ON = `UI.imgFail(this)" src="'+esc(p)+'" onclick="TravelNotes.zoomPhotoIdx(\\x27'+n.id+'\\x27,'+pi+')"`;
const OFF = `UI.imgFail(this)" src="'+esc(p)+'"`;
const BAK = 'tools/out/.rev-s11.bak';
const mode = process.argv[2];
let s = fs.readFileSync(P, 'utf8');
if (mode === 'off') {
  fs.writeFileSync(BAK, s);
  if (s.split(ON).length - 1 !== 1) { console.log('FAIL from 命中数不是 1'); process.exit(2); }
  fs.writeFileSync(P, s.split(ON).join(OFF));
  console.log('已摘掉 onclick（备份在 ' + BAK + '）');
} else {
  s = fs.readFileSync(BAK, 'utf8');
  fs.writeFileSync(P, s);
  console.log('还原后与备份逐字节一致：' + (fs.readFileSync(P, 'utf8') === fs.readFileSync(BAK, 'utf8')));
}
