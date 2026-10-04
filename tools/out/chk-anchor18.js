/* 只查锚点次数，不改文件、不跑 verify.js。MUTS 直接从 mut-verify18.js 取（require 守卫会在定义完 MUTS 后立刻返回）。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { MUTS } = require('./mut-verify18.js');

let bad = 0;
MUTS.forEach((m, i) => {
  m.ed.forEach(([f, from, to, cnt]) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const n = s.split(from).length - 1;
    if (n !== cnt) {
      bad++;
      console.log('✗ M' + (i + 1) + ' [' + f + '] 次数 ' + n + ' 期望 ' + cnt + ' :: ' + JSON.stringify(from.slice(0, 70)));
    }
  });
});
console.log('MUTS 共 ' + MUTS.length + ' 条，锚点异常 ' + bad + ' 处');
process.exit(bad ? 1 : 0);
