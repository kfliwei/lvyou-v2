/* 修复 node-manager genDesc 重复 .then 行 */
const fs = require('fs');
let m = fs.readFileSync('node-manager.html', 'utf8');
const dup = "      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });\r\n      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });";
const single = "      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });";
if (m.includes(dup)) {
  m = m.split(dup).join(single);
  fs.writeFileSync('node-manager.html', m, 'utf8');
  console.log('dup .then removed');
} else {
  /* LF 变体 */
  const dupLf = dup.replace(/\r\n/g, '\n');
  if (m.includes(dupLf)) {
    m = m.split(dupLf).join(single.replace(/\r\n/g, '\n'));
    fs.writeFileSync('node-manager.html', m, 'utf8');
    console.log('dup .then removed (LF)');
  } else console.log('not found');
}
/* 语法复检 */
const vm = require('vm');
const s = fs.readFileSync('node-manager.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let mm, i = 0, err = 0;
while ((mm = re.exec(s))) { i++; try { new vm.Script(mm[1], { filename: 'nm#' + i }); } catch (e) { console.log('STILL ERR inline#' + i, e.message.slice(0, 60)); err++; } }
console.log(err ? 'FAIL' : 'node-manager SYNTAX OK');
