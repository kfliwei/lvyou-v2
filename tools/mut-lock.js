/* tools/mut-lock.js — 变异网的独占锁单点（遗留 #216）
 *
 * 为什么必须有一处而不是各写各的：每张网在动树期间把自己的快照文件回写成「还原值」，两张网并发时
 * 后还原的那张会把前一张刚还原的内容一并抹掉——树停在中间态，而两边都报「全过」。这是假绿里最坏的一种，
 * 因为没有任何判据会红（批次 20 实测过争用；批次 33-E 又发现「只有一侧带锁的锁不是锁」）。
 * 第二件事更阴：锁名过去各网自写（`.mut39.lock`／`.mut25b.lock`／`.mut-smoke33.lock`），
 * 而别人的筛子写的是 /^\.mut\d+\.lock$/ —— 带字母的名字直接从视野里穿过去，
 * 等于「我看得见所有人，所有人看不见我」。实测这种穿筛 49 组（`tools/out/b33h-probe-lock.txt`）。
 *
 * 所以这里只留三件事，而且只留一份：
 *   ① 取锁用 flag 'wx'（存在即失败，把「同时启动」那一格也堵掉——existsSync 再写有 race）；
 *   ② 筛子认所有 .mut*.lock（只认自己那一个名字不算筛）；
 *   ③ 退出时释放（崩在中间留下的锁会让下一张网永远拒跑）。
 *
 * 用法（网的文件里 ROOT 已定义之后插一行）：
 *   require(path.join(ROOT, 'tools', 'mut-lock.js'))('.mut-verify27.lock');
 *
 * 自测：node tools/mut-lock.js --selftest —— 三条都要成立才印「三条都成立」：
 *   甲 本模块的筛子能看见带字母的锁名（正向对照）；
 *   乙 老写法那把 \d+ 筛子看不见它（退化对照——这条不成立就说明两把尺子其实是同一把，测了个空）；
 *   丙 已有别人的锁时 acquire() 真的退出 2，而且没有把别人那枚锁删掉（子进程实测，不读代码猜）。
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const OUT = path.join(__dirname, 'out');

/* 唯一的锁名筛子：.mut 开头、.lock 结尾，中间允许数字/字母/连字符/点 */
const ANY = /^\.mut[\w.-]+\.lock$/;

function others(me) {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT).filter(f => ANY.test(f) && f !== me);
}

function acquire(name) {
  const busy = others(name);
  if (busy.length) {
    console.log('中止：' + OUT + ' 里已有变异网的锁 ' + busy.join('、') + '（快照与本网重叠，并发跑两边读数全废）');
    process.exit(2);
  }
  try { fs.writeFileSync(path.join(OUT, name), String(process.pid), { flag: 'wx' }); }
  catch (e) {
    console.log('中止：' + path.join(OUT, name) + ' 已存在（另一张变异网正在动树，读数会全废）');
    process.exit(2);
  }
  const unlock = () => { try { fs.unlinkSync(path.join(OUT, name)); } catch (e) {} };
  process.on('exit', unlock);
  return unlock;
}

module.exports = acquire;
module.exports.acquire = acquire;
module.exports.ANY = ANY;
module.exports.others = others;

if (process.argv.indexOf('--selftest') >= 0) {
  let bad = 0;
  const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) bad++; };
  const held = '.mut-selftest.lock';
  const mine = '.mut-selftest-child.lock';
  const hp = path.join(OUT, held);
  const mp = path.join(OUT, mine);
  try {
    chk(ANY.test(held), '甲 本模块的筛子能看见带字母的锁名 ' + held);
    chk(!/^\.mut\d+\.lock$/.test(held), '乙 老写法 /^\\.mut\\d+\\.lock$/ 看不见它（49 组穿筛的来源）');
    fs.writeFileSync(hp, 'holder');
    const r = cp.spawnSync(process.execPath,
      ['-e', 'require(' + JSON.stringify(path.join(__dirname, 'mut-lock.js')) + ')(' + JSON.stringify(mine) + ');console.log("不该走到这里");'],
      { cwd: __dirname, encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    chk(r.status === 2 && /中止/.test(out) && !/不该走到这里/.test(out),
      '丙 别人持锁时 acquire() 退出 2（实际 exit=' + r.status + '，输出首行 ' + JSON.stringify(out.split(/\r?\n/)[0] || '') + '）');
    chk(fs.existsSync(hp), '丙之二 拒跑那一张没有顺手删掉别人的锁');
    chk(!fs.existsSync(mp), '丙之三 拒跑那一张没有留下自己的锁');
    /* 丁 单独测 flag 'wx' 那一格（existsSync 与写之间的那道 race）。
       现场只要有别的网持锁就没法把它与「筛子拦下」分开，所以那种情况明确跳过，不许静默算过。 */
    const foreign = others(held).filter(f => f !== held && f !== mine);
    if (foreign.length) {
      console.log('SKIP 丁 现场另有 ' + foreign.join('、') + ' 在持锁，wx 那一格与筛子分不开——等树空下来再测');
    } else {
      fs.unlinkSync(hp);
      fs.writeFileSync(mp, 'occupant');
      const r2 = cp.spawnSync(process.execPath,
        ['-e', 'require(' + JSON.stringify(path.join(__dirname, 'mut-lock.js')) + ')(' + JSON.stringify(mine) + ');console.log("不该走到这里");'],
        { cwd: __dirname, encoding: 'utf8' });
      const out2 = (r2.stdout || '') + (r2.stderr || '');
      chk(r2.status === 2 && /已存在/.test(out2) && !/不该走到这里/.test(out2) && fs.existsSync(mp),
        '丁 锁名已被占（非自己那枚）时 flag wx 直接失败退出 2，且原占位文件还在（实际 exit=' + r2.status + '）');
    }
  } finally {
    [hp, mp].forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });
  }
  console.log('=== mut-lock 自测：' + (bad ? bad + ' 条不成立' : '四条都成立') + ' ===');
  process.exit(bad ? 1 : 0);
}
