/* mut-avoid-e.js — 入场动画 × 标签避让（批次 12 · V5 附）的变异自测
 *
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/mut-avoid-e.js
 * 每条变异必须打死「它对应的那条断言」，否则那条断言是装饰。跑完无条件还原
 * （写回原始字节，不用 git checkout）。
 *
 *   M1 摘 animationend 补测      → 闸门 = 浏览器 smoke-motion E3（E4 同因连带红）
 *   M2 摘 moveend/zoomend 补测   → 闸门 = 源码 verify.js §19 ⑨b
 *   M3 整段退回改动前            → 闸门 = 浏览器 smoke-motion E3（E4 同因连带红）
 *
 * M2 为什么从浏览器侧改判给源码侧（E4 重写后实测的结论，不是省事）：
 * E4 现在等的是「动画收敛后的终态」。而点 zoomOut 之后 node-lod 会重渲染，重渲染又重放
 * node-fade-in 入场动画，于是 animationend 那条补测路照样跑、labelAvoid 调用计数照样 ≥1、
 * 终态重叠照样归零 —— 摘掉 moveend/zoomend 在浏览器里被兜住了（本脚本实测：E4 仍绿）。
 * 「视野变了要重测占位」这件事的可判定面是接线本身，只有源码锚点判得死，
 * 所以归属改成 verify.js §19 ⑨b（mut-verify19.js M38 钉的就是这一条）。
 * 反过来说，若把 E4 改回「固定等 900ms 再量」，M2 会被打死 —— 但那是撞运气：
 * 固定等待量到的是动画中间态，正是本次修复声明为无效的那个态。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const F = path.join(ROOT, 'topic-common.js');
const RAW = fs.readFileSync(F, 'utf8');
/* 本仓库源码是 CRLF，锚点一律按 LF 写；比对与写回时换算，还原用原始字节 */
const CRLF = RAW.indexOf('\r\n') >= 0;
const ORIG = CRLF ? RAW.replace(/\r\n/g, '\n') : RAW;
const put = src => fs.writeFileSync(F, CRLF ? src.replace(/\n/g, '\r\n') : src);

const ANIM_HOOK = [
  '    /* 节点入场动画收尾再补测一次：减动效档（.01ms）与正常档（--motion-enter）都走这条路 */',
  "    document.addEventListener('animationend', function (e) {",
  "      if (!e.animationName || e.animationName.indexOf('node-fade-in') !== 0) return;",
  '      clearTimeout(refitAvoid._t); refitAvoid._t = setTimeout(refitAvoid, 120);',
  '    });'
].join('\n');

const SYNC_BODY = [
  '  function refitAvoid() {',
  '    requestAnimationFrame(function () { requestAnimationFrame(function () {',
  "      if (window.capsuleAvoid) capsuleAvoid('#mapEl');",
  "      if (window.labelAvoid) labelAvoid('#mapEl');",
  '    }); });',
  '  }'
].join('\n');

const SYNC_MUT = [
  '  function refitAvoid() {',
  "    if (window.capsuleAvoid) capsuleAvoid('#mapEl');",
  "    if (window.labelAvoid) labelAvoid('#mapEl');",
  '  }'
].join('\n');

const MOVEEND = "map.on('moveend zoomend', function () { clearTimeout(capsuleAvoid._t); capsuleAvoid._t = setTimeout(refitAvoid, 170); });";
const MOVEEND_OLD = "map.on('moveend zoomend', function () { clearTimeout(capsuleAvoid._t); capsuleAvoid._t = setTimeout(function () { if (window.capsuleAvoid) capsuleAvoid('#mapEl'); }, 170); });";

/* gate:'smoke' → want 那条 E 断言必须红；also 是同因连带红（允许），此外再红算噪声。
   gate:'verify' → verify.js 的 FAIL 行里必须出现 wantMsg，且 exit 非 0；其它 FAIL 算噪声。
   observe 的 E 断言只记录不断言（用来把「浏览器侧兜得住」这件事写死在日志里）。 */
const MUTS = [
  {
    id: 'M1 摘 animationend 补测', gate: 'smoke', want: 'E3', also: ['E4'],
    edits: [[ANIM_HOOK, '    /*（变异：摘掉动画收尾补测）*/']]
  },
  {
    id: 'M2 摘 moveend/zoomend 补测', gate: 'verify', wantMsg: 'moveend zoomend 没走 refitAvoid',
    observe: ['E3', 'E4'],
    edits: [[MOVEEND, '/*（变异：摘掉视野变化补测）*/']]
  },
  {
    id: 'M3 整段退回改动前', gate: 'smoke', want: 'E3', also: ['E4'],
    edits: [[ANIM_HOOK, '    /*（变异）*/'], [SYNC_BODY, SYNC_MUT], [MOVEEND, MOVEEND_OLD]]
  }
];

const PORTS = { smoke: '8161', verify: null };

function runSmoke() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'smoke-motion.js')], {
    cwd: ROOT, encoding: 'utf8',
    env: Object.assign({}, process.env, { PORT: PORTS.smoke, NODE_PATH: path.join(ROOT, 'tools', 'node_modules') })
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = {};
  for (const m of out.matchAll(/^(PASS|FAIL) (E\d)[^\r\n]*/gm)) lines[m[2]] = { status: m[1], line: m[0] };
  return lines;
}

function runVerify() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')], {
    cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env)
  });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, fails: out.split(/\r?\n/).filter(l => l.indexOf('闸门 FAIL:') >= 0) };
}

let bad = 0;
try {
  for (const mu of MUTS) {
    let src = ORIG;
    let anchored = true;
    for (const [from, to] of mu.edits) {
      const n = src.split(from).length - 1;
      if (n !== 1) { console.log('ABORT ' + mu.id + '：变异锚点命中 ' + n + ' 次（要 1 次）'); anchored = false; break; }
      src = src.replace(from, to);
    }
    if (!anchored) { bad++; continue; }
    put(src);

    if (mu.gate === 'smoke') {
      const res = runSmoke();
      const want = res[mu.want];
      const also = (mu.also || []).filter(k => res[k] && res[k].status === 'FAIL');
      const others = Object.keys(res).filter(k => k !== mu.want && !also.includes(k) && res[k] && res[k].status === 'FAIL');
      const ok = !!(want && want.status === 'FAIL') && !others.length;
      if (!ok) bad++;
      console.log((ok ? 'OK   ' : 'NOISE ') + mu.id + ' → [smoke] ' + mu.want + ' ' + (want ? want.status : '没跑到') +
        (also.length ? '（同因连带红 ' + also.join(',') + '）' : '') + (others.length ? '（噪声 ' + others.join(',') + '）' : ''));
      console.log('     ' + (want ? want.line : '（无 E 段输出）'));
    } else {
      const res = runVerify();
      const hit = res.fails.filter(l => l.indexOf(mu.wantMsg) >= 0);
      const others = res.fails.filter(l => l.indexOf(mu.wantMsg) < 0);
      const ok = res.code !== 0 && hit.length === 1 && !others.length;
      if (!ok) bad++;
      console.log((ok ? 'OK   ' : 'NOISE ') + mu.id + ' → [verify §19 ⑨b] exit=' + res.code +
        ' 命中 ' + hit.length + ' 行' + (others.length ? '（噪声 ' + others.length + ' 行：' + others.join(' | ') + '）' : ''));
      hit.forEach(l => console.log('     ' + l));
      if (mu.observe) {
        const sres = runSmoke();
        console.log('     旁证（只记录不断言）：' + mu.observe.map(k => k + '=' + (sres[k] ? sres[k].status : '无')).join(' / ') +
          ' —— 浏览器侧被 animationend 补测兜住，故本条归属源码锚点');
      }
    }
  }
} finally {
  fs.writeFileSync(F, RAW);
  console.log('已还原 ' + path.relative(ROOT, F) + '（与原文逐字节相等：' + (fs.readFileSync(F, 'utf8') === RAW) + '）');
}
console.log(bad ? '\n结论：' + bad + ' 处变异没打死对应断言 —— 对应闸门别当活闸用' : '\n结论：三条变异各打死自己那条（M1/M3 走浏览器 E3，M2 走源码 §19 ⑨b），避让回归是活闸');
process.exit(bad ? 1 : 0);
