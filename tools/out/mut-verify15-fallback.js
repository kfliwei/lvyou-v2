/* §15 启动屏闸门「仓库壳源副本退回」的变异自测。
 * 背景：闸门原先只认外部交付壳目录，壳不在本机的机器（另一台开发机 / CI）永远 SKIP，
 * 于是启动屏四件套进没进 git 没人管。现在退回顺序是「外部壳 → android_app/app/src/main/res」，
 * 这份自测要证明两件事：① 退回后闸门是活的（砸仓库副本里的资源必须转红）
 * ② 优先级没写反（壳在场时读壳，砸仓库副本不该红）。
 * 手法照旧：锚点先断 count==1 → 字节快照 → 注入 → 跑 verify → 逐字节还原 → 复跑归零。
 * 用法：node tools/out/mut-verify15-fallback.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const RES = path.join(ROOT, 'android_app', 'app', 'src', 'main', 'res');
/* 指向一个必然不存在的壳目录，逼闸门走仓库副本（等价于另一台机器的现场） */
const NO_SHELL = path.join(ROOT, 'tools', 'out', '__no_such_shell_dir__');

const CASES = [
  { file: path.join(RES, 'values', 'colors.xml'), old: 'name="gold_deep">#8F5D0E<', neo: 'name="gold_deep">#8F5D0F<', exp: '品牌色两处漂移' },
  { file: path.join(RES, 'values-v31', 'themes.xml'), old: '<item name="android:windowBackground">@color/paper_bg</item>', neo: '<item name="android:windowBackground">@drawable/splash_bg</item>', exp: 'values-v31 的 windowBackground 用了 @drawable' },
  { file: path.join(RES, 'drawable', 'splash_brand.xml'), old: 'android:pathData="M27,68 L41,50 L50,60 L61,44 L81,68 Z"', neo: 'android:pathData="M27,68 L41,51 L50,60 L61,44 L81,68 Z"', exp: '几何与 art/empty-mountain.svg 漂移' },
];

function runVerify(env) {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')], {
      cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}), maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const splashLine = out => out.split('\n').filter(l => l.startsWith('启动屏闸门:')).join('|');
/* 只数行首为「启动屏 FAIL」的行：汇总行里也带「启动屏」三字，裸子串计数会假计 */
const splashFails = out => out.split('\n').filter(l => l.startsWith('启动屏 FAIL:')).length;

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK    ' : '异常  ') + msg); if (!cond) fail++; };
const GHOST = { TRACE_ANDROID_SHELL: NO_SHELL };

/* ① 基线：壳不在 → 走仓库副本，且不许是 SKIP */
const b0 = runVerify(GHOST);
ok(b0.code === 0 && /仓库壳源副本 android_app/.test(splashLine(b0.out)) && !/SKIP/.test(splashLine(b0.out)),
  '基线（无壳）→ exit=' + b0.code + ' | ' + splashLine(b0.out));

/* ② 三条变异砸在仓库副本上：闸门必须逐条转红，证明退回的那条路径真在被解析 */
for (const c of CASES) {
  const buf = fs.readFileSync(c.file);
  const s = buf.toString('utf8');
  const count = s.split(c.old).length - 1;
  if (count !== 1) { ok(false, '锚点命中 ' + count + ' 次（要求恰好 1 次），不注入：' + path.basename(c.file)); continue; }
  fs.writeFileSync(c.file, s.replace(c.old, c.neo));
  const r = runVerify(GHOST);
  const n = splashFails(r.out);
  ok(r.code !== 0 && r.out.includes(c.exp) && n === 1,
    '砸 ' + path.basename(c.file) + ' → exit=' + r.code + ' 启动屏FAIL行数=' + n + ' 命中预期短语=' + r.out.includes(c.exp));
  fs.writeFileSync(c.file, buf);
  if (!fs.readFileSync(c.file).equals(buf)) { ok(false, '还原失败！' + c.file); }
}

/* ③ 优先级反向对照：壳在本机时读壳——此时砸仓库副本不该红（红了就说明顺序写反了）。
     壳路径与 verify.js 同源（TRACE_ANDROID_SHELL 可覆盖）。本机没有外部壳的机器上这条
     不适用，必须 SKIP 而不是判异常，否则脚本换台机器就自己报假红。 */
const SHELL_RES = (process.env.TRACE_ANDROID_SHELL || 'F:/MyAi/trace/lvyou-v2-android').replace(/\\/g, '/') + '/app/src/main/res';
if (fs.existsSync(SHELL_RES)) {
  const brokenBuf = fs.readFileSync(CASES[0].file);
  fs.writeFileSync(CASES[0].file, brokenBuf.toString('utf8').replace(CASES[0].old, CASES[0].neo));
  const p = runVerify();
  ok(p.code === 0 && /外部壳 /.test(splashLine(p.out)),
    '壳在场 + 仓库副本已砸 → exit=' + p.code + ' | ' + splashLine(p.out));
  fs.writeFileSync(CASES[0].file, brokenBuf);
} else {
  console.log('SKIP  优先级对照：本机无外部壳 ' + SHELL_RES + '（TRACE_ANDROID_SHELL 可指定），闸门只会走仓库副本');
}

const last = runVerify(GHOST);
ok(last.code === 0, '还原后复跑（无壳）→ exit=' + last.code + ' | ' + splashLine(last.out));

console.log(fail ? 'MUT SELF-TEST(§15 退回): ' + fail + ' 项异常' : 'MUT SELF-TEST(§15 退回): 全部命中且还原干净');
process.exit(fail ? 1 : 0);
