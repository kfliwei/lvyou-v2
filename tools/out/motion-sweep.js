/* 批次 11-A 第二遍：把 design.css 的 --motion-* 阶梯推到各页内联样式与 map.css
 * 规则：
 *  1) 只改 CSS 声明内部（transition / animation / *-delay 的值段），JS 的 setTimeout 数字一律不碰；
 *  2) 值就近归档进阶梯（平局取较小档），归档结果全部落在 var(--motion-*) 上；
 *  3) 逐文件对账：变换后该文件里「CSS 声明内的裸时序」必须为 0，否则不落盘；
 *  4) 豁免：vendor/**（第三方）、docs/**（独立预览页，不载 design.css）。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const LADDER = [
  [120, 'tap'], [160, 'fast'], [240, 'mid'], [280, 'normal'], [360, 'page'],
  [480, 'enter'], [520, 'slow'], [700, 'long'], [1200, 'flash'], [1300, 'shimmer'],
  [2200, 'boot'], [2800, 'breath'], [1, 'none']
];
const FILES = ['index.html', 'album.html', 'node-manager.html', 'search.html', 'travel-map.html',
  'md-manager.html', 'settings.html', 'review.html', 'planner.html', 'story.html', 'wishlist.html',
  'me.html', 'share.html', 'explore-map.html', 'topic.html', 'travel-notes.js', 'topic-common.js',
  'nav.js', 'map.css', 'ui.js', 'ai.js', 'planner.js', 'backup.js', 'share.js', 'sync-webdav.js'];

const toMs = (num, unit) => unit === 'ms' ? +num : Math.round(parseFloat(num) * 1000);
const snap = ms => {
  let best = null, bd = Infinity;
  LADDER.forEach(([v, n]) => { const d = Math.abs(v - ms); if (d < bd || (d === bd && v < best[0])) { bd = d; best = [v, n]; } });
  return best[1];
};
const DECL = /(?:^|[\s;{"])(transition|animation)(-duration|-delay)?:[^;}]*/g;

let total = 0, rows = [];
FILES.forEach(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return;
  const src = fs.readFileSync(p, 'utf8');
  const crlf = src.includes('\r\n');
  const lines = (crlf ? src.replace(/\r\n/g, '\n') : src).split('\n');
  let hits = 0;
  const out = lines.map(line => {
    if (!/(transition|animation)/.test(line)) return line;
    return line.replace(DECL, seg => {
      const nw = seg.replace(/(^|[^A-Za-z0-9_.-])(\d*\.?\d+)(ms|s)\b/g, (m, pre, num, unit) => {
        const ms = toMs(num, unit);
        if (/^0$|^0\.0/.test(num) && ms <= 1) return pre + 'var(--motion-none)';
        hits++;
        return pre + 'var(--motion-' + snap(ms) + ')';
      });
      return nw;
    });
  });
  const s2 = out.join(crlf ? '\r\n' : '\n');
  /* 对账：该文件里 CSS 声明内不得再有裸时序 */
  const left = s2.split(/\r?\n/).filter(l => {
    const m = l.match(DECL);
    return m && m.some(seg => /(^|[^A-Za-z0-9_.-])\d*\.?\d+(ms|s)\b/.test(seg));
  });
  if (left.length) { console.error('!! ' + f + ' 仍有声明内裸时序 ' + left.length + ' 行，该文件不落盘：\n' + left.slice(0, 5).map(l => l.trim().slice(0, 110)).join('\n')); return; }
  if (hits) fs.writeFileSync(p, s2, 'utf8');
  total += hits;
  rows.push(f + ' → ' + hits);
});
console.log('各页时序 token 化：共替换 ' + total + ' 处\n' + rows.join('\n'));
