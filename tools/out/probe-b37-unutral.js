/* tools/out/probe-b37-unutral.js — 临时诊断（批次 37-C，用完即删）：
 * U01/U06/U07 三条为什么「源码腿 0 红但整跑不绿」——只跑 verify（不跑浏览器腿），把全部 FAIL §xx 行印出来。
 * 同时验一遍改写成「行数中性」的形状能否让整跑回绿。快照 + 逐字节还原。 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const L = String.fromCharCode(10), CR = String.fromCharCode(13);
const FILES = ['travel-notes.js', 'sync-webdav.js', 'settings.html', 'tools/verify.js', 'tools/smoke-irreversible.js', 'README.md'];
const ORIG = {};
FILES.forEach(f => { ORIG[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() { FILES.forEach(f => fs.writeFileSync(path.join(ROOT, f), ORIG[f])); }
function eol(s, f) { return ORIG[f].indexOf(CR + L) >= 0 ? s.split(L).join(CR + L) : s; }
function runVerify() {
  try { return { out: cp.execFileSync(process.execPath, ['tools/verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }), green: true }; }
  catch (e) { return { out: String((e && e.stdout) || '') + L + 'THROW ' + String((e && e.message) || e).slice(0, 200), green: false }; }
}

const T = 'travel-notes.js';
const probes = [];
/* ① 现在这三条的形状：U01 加一行 / U06 加一行 / U07 减一行 */
probes.push(['U01 现形(+1)', T, '    if (!ui || !state) return null;', '    if (!ui || !state) return null;' + L + '    if (1) return null;']);
probes.push(['U06 现形(+1)', T, "        if (document.querySelector('.tn-cfm')) return;" + L + "        confirmDialog('这篇的'", "        if (document.querySelector('.tn-cfm')) return;" + L + "        dropEdit();" + L + "        confirmDialog('这篇的'"]);
probes.push(['U07 现形(-1)', T, "    if (!editPopBound) { editPopBound = true; addEventListener('popstate', onEditPop); }" + L + '    pushEditEntry(editCtx);', "    if (!editPopBound) { editPopBound = true; addEventListener('popstate', onEditPop); }"]);
/* ② 行数中性的改写：同一条退化，但留在原行里 */
probes.push(['U01 中性', T, '    if (!ui || !state) return null;', '    if (!ui || !state || 1) return null;']);
probes.push(['U06 中性', T, "        if (document.querySelector('.tn-cfm')) return;" + L + "        confirmDialog('这篇的'", "        if (document.querySelector('.tn-cfm')) return; dropEdit();" + L + "        confirmDialog('这篇的'"]);
probes.push(['U07 中性', T, '    pushEditEntry(editCtx);' + L + '    $X(pg, \'#tnEditAddPhoto\')', '    if (0) pushEditEntry(editCtx);' + L + "    $X(pg, '#tnEditAddPhoto')"]);

probes.forEach(p => {
  const name = p[0], f = p[1];
  let before, after;
  try {
    const fp = path.join(ROOT, f);
    before = fs.readFileSync(fp, 'utf8');
    const s = eol(p[2], f), t = eol(p[3], f);
    const hits = before.split(s).length - 1;
    if (hits !== 1) throw new Error('命中 ' + hits + ' 次');
    after = before.split(s).join(t);
    fs.writeFileSync(fp, after);
  } catch (e) { console.log('== ' + name + ' 打靶失败：' + e.message); restore(); return; }
  const dl = after.split(L).length - before.split(L).length;
  const v = runVerify();
  const fails = String(v.out).split(L).filter(l => l.indexOf('FAIL §') === 0 || l.indexOf('THROW') === 0);
  console.log('== ' + name + '  行数 ' + (dl > 0 ? '+' : '') + dl + '  整跑' + (v.green ? '绿' : '不绿') + '  FAIL ' + fails.length + ' 条');
  fails.slice(0, 6).forEach(l => console.log('     ' + l.slice(0, 150)));
  restore();
});
const backOk = FILES.every(f => fs.readFileSync(path.join(ROOT, f), 'utf8') === ORIG[f]);
console.log('=== 诊断结束：' + (backOk ? '六文件已逐字节还原 ✓' : '没还原！用备份手工复位'));
