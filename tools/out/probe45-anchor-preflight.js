/* 批次 30-B 现场标定五：§45 的锚点 preflight（改前原串 / 现状串 / 期望次数 三对数）。
 * 规矩：期望 0 那一族每条都要 ①在当前树 0 命中 ②在 HEAD 那一版 1 命中 ③正向对照能读出来；
 *      正向锚 A45 每条要在当前树恰好 1 命中、在 HEAD 里 0 命中（新形状本来就不该在旧版里存在）。
 * 不 preflight 直接写进表里＝把「数错了」伪装成「守着呢」。
 * 用法: node tools/out/probe45-anchor-preflight.js */
const { execSync } = require('child_process');
const fs = require('fs');
/* 剥刀从 verify.js 现场取（不手抄第二份）：抄一份出来两边会漂，那时 preflight 数的命中与闸门数的不是同一件事。 */
const VSRC = fs.readFileSync(__dirname + '/../verify.js', 'utf8');
const DEF = VSRC.match(/function stripBlockComments\(s\) \{[\s\S]*?\n\}/);
if (!DEF) { console.log('BAD 读不到 verify.js 里的 stripBlockComments 定义，preflight 不走（别用另一把刀数命中）'); process.exit(1); }
const strip = eval('(' + DEF[0] + ')');

const ws = s => s.replace(/\s+/g, ' ').trim();
const flat = s => ws(strip(s));

const Z = [
  ['results.js', "+ '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>'"],
  ['review.html', "'<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+(n.lat!=null?' · '+n.lat.toFixed(4)+', '+n.lng.toFixed(4):'')+'</div>'"],
  ['travel-notes.js', "'</h4><div class=\"tm\">' + esc(n.date) + ' · ' + (n.lat != null ? '' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div><div class=\"tx\">'"],
  ['travel-notes.js', "'<div style=\"color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) : '') + '</div>'"],
  ['travel-notes.js', "ctx.fillText(n.date + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : ''), 70, 285);"],
  ['travel-notes.js', "'</div><div style=\"color:#6b665c;font-size:var(--fs-2);margin-top:6px\">' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) + (n.style ? ' · ' + n.style : '') + '</div></div>'"],
  ['travel-map.html', "const locHtml=n.lat!=null?'<div class=\"ms-loc\">'+n.lat.toFixed(4)+', '+n.lng.toFixed(4)+'</div>':'';"],
  ['travel-map.html', '+locHtml'],
  ['travel-map.html', '.ms-loc{'],
  ['topic-common.js', '<div class="pm">\' + lat.toFixed(5) + \', \' + lng.toFixed(5) + \'</div><div class="pm pa">'],
];
/* [文件, 锚串, 当前树期望命中, HEAD 期望命中（null＝只印数不立判据）] */
const A = [
  ['results.js', "+ '<div class=\"m\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'", 1, 0],
  ['review.html', "'<div class=\"meta\">'+esc(n.date)+(n.weather?' · '+esc(n.weather):'')+'</div>'", 1, 0],
  ['travel-notes.js', "'</h4><div class=\"tm\">' + esc(n.date) + '</div><div class=\"tx\">'", 1, 0],
  ['travel-notes.js', "'<div style=\"color:var(--color-muted);font-size:var(--fs-3);margin-bottom:8px\">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'", 1, 0],
  ['travel-notes.js', 'ctx.fillText(n.date, 70, 285);', 1, 0],
  ['travel-notes.js', "(n.style ? '<div style=\"color:#6b665c;font-size:var(--fs-2);margin-top:6px\">' + esc(n.style) + '</div>' : '')", 1, 0],
  ['travel-notes.js', "var txt = (n.title || n.siteName || '游记') + '\\n' + (n.date || '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '')", 1, 1],
  ['travel-map.html', "fillSheet('<div class=\"ms-place\">'+place+'</div>'", 2, 2],
  ['travel-map.html', "if(map) map.flyTo(gxy(n.lat,n.lng)", 2, 2],
  ['topic-common.js', '<b>途经点随手记</b><div class="pm pa">', 1, 0],
  ['node-manager.html', "'<div class=\"is-coord\">坐标 · ' + (+s.lat).toFixed(5)", 1, 0],
  ['node-manager.html', "'<div class=\"is-coord\">坐标 · ' + (+u.lat).toFixed(5)", 1, 0],
  ['node-manager.html', "'<div class=\"nm-coord\" style=\"margin-bottom:6px\">'+TI('pin', 12)", 1, 1],
  ['md-manager.html', "rows.push(['坐标', n.lat.toFixed(4) + ', ' + n.lng.toFixed(4)]);", 1, 1],
  ['vault.js', "'<p class=\"meta\">坐标 · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</p>'", 1, 1],
];
const SENT = [
  ['travel-notes.js', "it.querySelector('[data-a=copy]').onclick"],
  ['travel-map.html', "fillSheet('<div class=\"ms-place\">'+place+'</div>'"],
];

const cur = f => require('fs').readFileSync(f, 'utf8');
const head = f => execSync('git show HEAD:' + f, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const cnt = (s, n) => s.split(n).length - 1;
let bad = 0;
const say = (tag, f, n, a, b, ea, eb) => {
  const p = a === ea && (eb === null || b === eb);
  if (!p) bad++;
  console.log((p ? 'OK   ' : 'BAD  ') + tag + ' ' + f + '  现=' + a + '(期望 ' + ea + ') HEAD=' + b + '(期望 ' + eb + ')  «' + n.slice(0, 74) + '»');
};
Z.forEach(([f, n]) => say('ZERO', f, n, cnt(flat(cur(f)), n), cnt(flat(head(f)), n), 0, 1));
/* A 表的 HEAD 那一栏：新形状期望 0，保留点期望 1，其余（null）只把数印出来给人看，不立判据 */
A.forEach(([f, n, ec, eh]) => say('A45 ', f, n, cnt(flat(cur(f)), n), cnt(flat(head(f)), n), ec, eh));
SENT.forEach(([f, n]) => { const a = cnt(flat(cur(f)), n); console.log((a >= 1 ? 'OK   ' : 'BAD  ') + 'SENT ' + f + ' 现=' + a + ' «' + n + '»'); if (a < 1) bad++; });
console.log('=== preflight 失配 ' + bad + ' 条 ===');
process.exit(bad ? 1 : 0);
