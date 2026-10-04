/* A/B：album 封面提示「首帧就停在 alScroll 的 0% 关键帧（opacity .35）」到底是哪一处改动带来的。
   四个组合各跑一次 probe-album-reduced.js，只取它打印的「第一张最亮」：
     199 ≈ opacity .8（基色，减动效下应该看到的样子）；106 ≈ .35（alScroll 的 0%/100% 关键帧）。
   改文件用单行锚点 + split/join，跑完从内存快照逐字节还原。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const ALBUM_NEW = "animation:alScroll var(--motion-boot) ease-in-out infinite";
const ALBUM_OLD = "animation:alScroll 2.4s ease-in-out infinite";
const DESIGN_NEW = "  *,*::before,*::after{animation-duration:var(--motion-none)!important;animation-delay:var(--motion-none)!important;animation-iteration-count:1!important;transition-duration:var(--motion-none)!important;transition-delay:var(--motion-none)!important}";
const DESIGN_OLD = "  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}";

const files = ['album.html', 'design.css'];
const orig = {};
files.forEach(f => { orig[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
function restore() { files.forEach(f => fs.writeFileSync(path.join(ROOT, f), orig[f], 'utf8')); }
function put(f, from, to) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(f + ' 锚点出现 ' + n + ' 次：' + from.slice(0, 40));
  fs.writeFileSync(path.join(ROOT, f), s.split(from).join(to), 'utf8');
}

const CASES = [
  ['① 现状（var + 新减动效块）', null, null],
  ['② 只回退 album 的时长字面量（2.4s + 新块）', ['album.html', ALBUM_NEW, ALBUM_OLD], null],
  ['③ 只回退减动效块（var + 旧块）', null, ['design.css', DESIGN_NEW, DESIGN_OLD]],
  ['④ 两处都回退（2.4s + 旧块）', ['album.html', ALBUM_NEW, ALBUM_OLD], ['design.css', DESIGN_NEW, DESIGN_OLD]],
  /* ① 与 ③ 差在减动效块这一行本身，这里把这一行拆成三个变量单独试 */
  ['⑤ 新块去掉 animation-delay', null, ['design.css', DESIGN_NEW, DESIGN_NEW.replace('animation-delay:var(--motion-none)!important;', '')]],
  ['⑥ 新块去掉 transition-delay', null, ['design.css', DESIGN_NEW, DESIGN_NEW.replace('transition-delay:var(--motion-none)!important', '')]],
  ['⑦ 旧值字面量 + 补 animation-delay（把 var 这个变量摘掉）', null,
    ['design.css', DESIGN_NEW, "  *,*::before,*::after{animation-duration:.01ms!important;animation-delay:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;transition-delay:.01ms!important}"]]
];

try {
  CASES.forEach(([name, a, d]) => {
    restore();
    if (a) put(a[0], a[1], a[2]);
    if (d) put(d[0], d[1], d[2]);
    let out = '';
    try {
      out = execFileSync(process.execPath, [path.join(__dirname, 'probe-album-reduced.js')],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
          env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'tools', 'node_modules') }) });
    } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
    const line = (out.match(/第一张最亮 [^\n]*/) || ['(没抓到「第一张最亮」) ' + out.slice(0, 120)])[0];
    console.log(name + ' → ' + line.trim());
  });
} finally {
  restore();
  files.forEach(f => { if (fs.readFileSync(path.join(ROOT, f), 'utf8') !== orig[f]) console.log('!! 未还原 ' + f); });
  console.log('已还原 ' + files.join(' / '));
}
