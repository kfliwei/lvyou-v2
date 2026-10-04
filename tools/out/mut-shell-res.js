/* 预检的变异自测：证明 probe-shell-res.js 两条线是活的，不是装饰。
 * 手法与产品侧一致：先断锚点 count==1 → 快照字节 → 注入 → 跑预检 → 逐字节还原 → 复跑归零。
 * 用法：node tools/out/mut-shell-res.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RES = path.join(__dirname, '..', '..', '..', 'lvyou-v2-android', 'app', 'src', 'main', 'res');
const PROBE = path.join(__dirname, 'probe-shell-res.js');

const CASES = [
  { file: path.join(RES, 'drawable', 'splash_brand.xml'), old: 'android:strokeAlpha="0.35"', neo: 'android:strokeOpacity="0.35"', exp: '没有 android:strokeOpacity' },
  { file: path.join(RES, 'values', 'colors.xml'), old: '宣纸底上 3.9:1', neo: '与 --color-gold 同值', exp: '注释内含「--」' },
];

function runProbe() {
  try {
    const out = execFileSync(process.execPath, [PROBE], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

let fail = 0;
const snaps = CASES.map(c => ({ c, buf: fs.readFileSync(c.file) }));

for (const { c, buf } of snaps) {
  const s = buf.toString('utf8');
  const count = s.split(c.old).length - 1;
  if (count !== 1) {
    console.log('跳过 ' + path.basename(c.file) + '：锚点命中 ' + count + ' 次（要求恰好 1 次），不注入');
    fail++;
    continue;
  }
  fs.writeFileSync(c.file, s.replace(c.old, c.neo));
  const r = runProbe();
  const hit = r.out.includes(c.exp);
  /* 只数「行首是违规」的行——汇总行「扫描 20 个 xml，违规 0 处」里也含「违规」二字，
     裸子串计数会把 1 条真违规数成 2 条（这条坑在守卫记忆里已经记过一次，今天在自己新脚本里复发） */
  const onlyOne = r.out.split('\n').filter(l => l.startsWith('违规')).length;
  console.log((r.code === 1 && hit && onlyOne === 1 ? '命中  ' : '异常  ')
    + path.basename(c.file) + ' → exit=' + r.code + ' 违规行数=' + onlyOne + ' 命中预期短语=' + hit);
  if (!(r.code === 1 && hit && onlyOne === 1)) fail++;
  fs.writeFileSync(c.file, buf);
  if (!fs.readFileSync(c.file).equals(buf)) { console.log('还原失败！' + c.file); fail++; }
}

const after = runProbe();
console.log('还原后复跑：exit=' + after.code + ' | ' + after.out.trim().split('\n').pop());
if (after.code !== 0) fail++;
console.log(fail ? 'MUT SELF-TEST: ' + fail + ' 项异常' : 'MUT SELF-TEST: 全部命中且还原干净');
process.exit(fail ? 1 : 0);
