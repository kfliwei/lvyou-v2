/* tools/out/probe27-m21.js — 一次性诊断：把 M21（空挂载点 tn-confirm 插回）单独打在树上，
   跑一遍 verify.js，看 §42 到底是哪几条红。跑完自己还原。 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const P = path.join(ROOT, 'travel-notes.js');
const ORIG = fs.readFileSync(P, 'utf8');
const NL = ORIG.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const B = String.fromCharCode(92);
const from = '  <div class="tn-quotes" id="tnQuotes">' + B;
const to = '  <div class="tn-confirm" id="tnConfirm" style="display:none"></div>' + B + NL + from;
console.log('from 命中', ORIG.split(from).length - 1, 'EOL=', NL === '\r\n' ? 'CRLF' : 'LF');
const mutated = ORIG.replace(from, () => to);
fs.writeFileSync(P, mutated);
try {
  console.log('改后 id="tnConfirm" 次数', fs.readFileSync(P, 'utf8').split('id="tnConfirm"').length - 1);
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  console.log('--- §42 红行 ---');
  console.log(out.split('\n').filter(l => /^FAIL §42 /.test(l)).join('\n'));
  console.log('--- 终判 ---');
  console.log(out.split('\n').filter(l => /=== (FAIL|ALL)/.test(l)).join('\n'));
} finally {
  fs.writeFileSync(P, ORIG);
  console.log('已还原，与原快照一致：', fs.readFileSync(P, 'utf8') === ORIG);
}
