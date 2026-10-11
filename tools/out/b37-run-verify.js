const { execFileSync } = require('child_process');
const fs = require('fs');
let out, code = 0;
try {
  out = execFileSync(process.execPath, ['tools/verify.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  out = String(e.stdout || '') + String(e.stderr || '');
  code = e.status === undefined ? -1 : e.status;
}
const L = out.split(/\r?\n/);
const fails = L.filter(l => l.indexOf('FAIL') === 0);
const rep = out + '\n--- wrapper ---\nexit=' + code + ' · lines=' + L.length + ' · FAIL行=' + fails.length +
  '\n§47行=' + (L.filter(l => l.indexOf('不可逆动作闸门:') >= 0).join(' | ').slice(0, 300) || '(无)') +
  '\n末行=' + L.filter(l => l.trim()).slice(-1)[0] + '\n';
fs.writeFileSync('tools/out/b37-verify-docfix.txt', rep);
console.log('exit=' + code + ' lines=' + L.length + ' FAIL=' + fails.length);
if (fails.length) console.log(fails.join('\n').slice(0, 2000));
console.log('末行: ' + L.filter(l => l.trim()).slice(-1)[0]);
