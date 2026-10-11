const fs = require('fs');
const F = 'docs/功能与UI全面审核-2026-10-09.md';
const L = fs.readFileSync(F, 'utf8').split('\n');
const i = L.findIndex(l => l.indexOf('- 未出包。APK') === 0);
if (i === -1) { console.log('ABORT 找不到「未出包」那条'); process.exit(2); }
const from = '**批次 32／33（含 33-E、33-F、33-G＋33-H、33-I）／34／35-A／35-B／36／37 的十一支本地 commit 要再推需要你重新逐条点头**';
const to = '**批次 32／33（含 33-E、33-F、33-G＋33-H、33-I）／34／35-A／35-B／36／37 的十二支本地 commit 要再推需要你重新逐条点头**（这个数不是把段落数出来的：改这句时 `git rev-list --count origin/master..HEAD` 现读 12＝批次 32 一支、批次 33+34 合起来一支、`2b3c4b1` 那支只回写口径的收尾、33-E／33-F／33-G＋33-H／33-I 各一支、35-A／35-B／36 各一支、批次 37 主体 `009fb0f` 一支、它的「README 改写后定向复跑」收尾一支。**登记这一笔的 commit 自己会把数抬到 13**，所以将来要核对请跑那条命令，别拿这个字面数当常量——这正是本报告反复犯的那类「凭旧数写活口径」）';
const n = L[i].split(from).length - 1;
if (n !== 1) { console.log('ABORT 锚命中 ' + n + ' 次'); process.exit(2); }
L[i] = L[i].replace(from, to);
fs.writeFileSync(F, L.join('\n'));
console.log('OK 第 ' + (i + 1) + ' 行：十一支 → 十二支（并写明来源＝rev-list 现读）');
console.log('校验 残留「十一支」=' + (fs.readFileSync(F, 'utf8').match(/十一支/g) || []).length + ' · 「十二支」=' + (fs.readFileSync(F, 'utf8').match(/十二支/g) || []).length);
