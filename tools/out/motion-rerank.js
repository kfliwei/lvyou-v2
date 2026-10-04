/* 批次 11-A 第三遍：补了装饰档之后重算归档
 * 做法：先证明「工作区 = sweep(HEAD, 旧阶梯)」这个不变式成立（逐文件逐字节比），
 * 成立就直接输出 sweep(HEAD, 新阶梯)——不需要行对齐，也不会碰 sweep 之外的任何改动。
 * 不变式不成立的一个文件都不写。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const OLD = [[120, 'tap'], [160, 'fast'], [240, 'mid'], [280, 'normal'], [360, 'page'],
  [480, 'enter'], [520, 'slow'], [700, 'long'], [1200, 'flash'], [1300, 'shimmer'],
  [2200, 'boot'], [2800, 'breath'], [1, 'none']];
const NEW = [[120, 'tap'], [160, 'fast'], [240, 'mid'], [280, 'normal'], [360, 'page'],
  [480, 'enter'], [520, 'slow'], [700, 'long'], [800, 'spin'], [1000, 'tick'],
  [1200, 'flash'], [1300, 'shimmer'], [1800, 'pulse'], [2200, 'boot'], [2800, 'breath'],
  [3200, 'drift'], [1, 'none']];

const FILES = ['index.html', 'album.html', 'node-manager.html', 'search.html', 'travel-map.html',
  'md-manager.html', 'settings.html', 'review.html', 'planner.html', 'story.html', 'wishlist.html',
  'me.html', 'share.html', 'explore-map.html', 'topic.html', 'travel-notes.js', 'topic-common.js',
  'nav.js', 'map.css', 'ui.js', 'ai.js', 'planner.js', 'backup.js', 'share.js', 'sync-webdav.js'];

const toMs = (num, unit) => unit === 'ms' ? +num : Math.round(parseFloat(num) * 1000);
const snap = (ms, L) => {
  let best = null, bd = Infinity;
  L.forEach(([v, n]) => { const d = Math.abs(v - ms); if (d < bd || (d === bd && v < best[0])) { bd = d; best = [v, n]; } });
  return best[1];
};
const DECL = /(?:^|[\s;{"])(transition|animation)(-duration|-delay)?:[^;}]*/g;

function sweep(src, L) {
  const crlf = src.includes('\r\n');
  const lines = (crlf ? src.replace(/\r\n/g, '\n') : src).split('\n');
  let hits = 0;
  const out = lines.map(line => {
    if (!/(transition|animation)/.test(line)) return line;
    return line.replace(DECL, seg => seg.replace(/(^|[^A-Za-z0-9_.-])(\d*\.?\d+)(ms|s)\b/g, (m, pre, num, unit) => {
      const ms = toMs(num, unit);
      if (/^0$|^0\.0/.test(num) && ms <= 1) return pre + 'var(--motion-none)';
      hits++;
      return pre + 'var(--motion-' + snap(ms, L) + ')';
    }));
  });
  return { text: out.join(crlf ? '\r\n' : '\n'), hits };
}

let moved = 0, files = 0;
FILES.forEach(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return;
  let head;
  try { head = execSync('git show HEAD:' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }); }
  catch (e) { console.log('-- ' + f + '：HEAD 里没有，跳过'); return; }
  const cur = fs.readFileSync(p, 'utf8');
  /* 仓库里存 LF，工作区 CRLF（core.autocrlf）：一律先降到 LF 比对，写出时按工作区的换行风格还原 */
  const crlf = cur.includes('\r\n');
  const headLF = head.replace(/\r\n/g, '\n');
  const curLF = cur.replace(/\r\n/g, '\n');
  const old = sweep(headLF, OLD);
  if (old.text !== curLF) { console.log('!! ' + f + ' 不满足「工作区 = sweep(HEAD, 旧阶梯)」，一个字节都不写'); return; }
  const nw = sweep(headLF, NEW);
  const left = nw.text.split('\n').filter(l => {
    const m = l.match(DECL);
    return m && m.some(seg => /(^|[^A-Za-z0-9_.-])\d*\.?\d+(ms|s)\b/.test(seg));
  });
  if (left.length) { console.log('!! ' + f + ' 新阶梯下仍有声明内裸时序 ' + left.length + ' 行，不写'); return; }
  /* 新阶梯只会让归档更准，不会改到旧阶梯已经正确的地方；把变化的行打出来核对 */
  const hl = headLF.split('\n'), cl = curLF.split('\n'), nl = nw.text.split('\n');
  hl.forEach((l, i) => {
    if (cl[i] === nl[i]) return;
    moved++;
    console.log('  ' + f + ':' + (i + 1) + '\n    旧档 ' + (cl[i] || '').trim().slice(-96) + '\n    新档 ' + (nl[i] || '').trim().slice(-96));
  });
  fs.writeFileSync(p, crlf ? nw.text.replace(/\n/g, '\r\n') : nw.text, 'utf8');
  files++;
});
console.log('=== 重算归档：' + files + ' 个文件写出，改档 ' + moved + ' 行 ===');
