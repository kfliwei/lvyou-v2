/* tools/out/probe45-aria-blind.js — 「坐标走属性那一格」源码扫描器的盲区证据
 *
 * §45 的 ③ 动态扫描器按「这一行有没有渲染信号」分类：不含 REND45 里任何一个串的行 → 判成
 * 「去重键／缓存键／URL 参数」放行（offscreen++）。这个口径对坐标当键是对的，但它有个洞：
 *   chip.setAttribute('aria-label','这一篇：' + nm + ' · ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
 * 这一行同样不含 `<div`/innerHTML/textContent/fillText( —— 扫描器会把它放行，而它是**读屏版卡面**：
 * 屏幕上一个字都看不见，TalkBack/VoiceOver 念得清清楚楚。用户口径「卡面只留地点名」管的是「给人读的
 * 那串数」，属性这一格一模一样违规，而源码腿对此永久沉默。
 * 于是浏览器腿补了 CO12（全页 aria-label/title/alt 属性扫裸坐标）+ CO13（反证）。
 *
 * 这个探针干三件事，逐条印读数：
 *   ① 从 verify.js 现场 eval 出那把真尺（REND45/SCAN45，不手抄第二把刀），在「aria 那行」合成样本上跑，
 *      证明它被分类成 offscreen 而不是越界 —— 这就是「源码腿读不到」的实证；
 *   ② 在同一样本上跑卡面那一行（`<div class="tm">` 拼串），证明同一把尺能逮住它 —— 反证，说明 ① 不是尺坏了；
 *   ③ 全量扫根目录 .js/.html 里「同时含 aria-label|title|alt 与 lat/lng/toFixed」的行，
 *      给出当前实测条数（现状口径：这一格现在干净，干净是靠这个探针证明的，不是靠感觉）。
 *
 * 用法: node tools/out/probe45-aria-blind.js   （读数同时落 tools/out/probe45-aria-blind.txt）
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lines = [];
function say(s) { console.log(s); lines.push(s); }

/* ---- 从 verify.js 派生那把真尺 ---- */
const V = fs.readFileSync(path.join(ROOT, 'tools', 'verify.js'), 'utf8');
const head = V.indexOf('const REND45 =');
const tail = V.indexOf('let var45scan');
if (head < 0 || tail < 0 || tail < head) { say('FATAL 取不到 §45 扫描器源码（那两个标记串漂了），读数不可信'); process.exit(2); }
const BLOCK = V.slice(head, tail);
const DEFWS = (V.match(/^[ \t]*const ws45 = [^\n]*/m) || [''])[0].trim();
if (!DEFWS) { say('FATAL 取不到 ws45 定义行'); process.exit(2); }
/* eval 派生而不是复制：复制一份判据，探针验的就不再是闸门实际用的那把尺 */
const SCAN = eval('(function(){ ' + DEFWS + '; ' + BLOCK + ' return SCAN45; })()');
say('=== probe45-aria-blind · 尺来自 verify.js 现场 eval（REND45/SCAN45/ws45 各 1 份，无手抄）===');
say('取用片段长度=' + BLOCK.length + ' 字符，首行「' + BLOCK.split('\n')[0].trim().slice(0, 60) + '」');

/* ---- ① aria 那一行：同一把尺的分类 ---- */
const L_ARIA = "      chip.setAttribute('aria-label','这一篇：' + nm + ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '，点开看全文与照片');";
const r1 = SCAN(L_ARIA + '\n');
say('① aria-label 拼坐标那一行: sites=' + r1.sites + ' labeled=' + r1.labeled + ' offscreen=' + r1.offscreen + ' 越界=' + r1.out.length);
say('   分类结论=' + (r1.out.length === 0 && r1.offscreen === 1 ? '★ 被放行（当成「不在屏上的键」）——源码腿对这一格永久沉默' : '被逮住（那说明扫描器已改过，本探针的登记要更新）'));

/* ---- ② 反证：卡面那一行同一把尺能逮住 ---- */
const L_CARD = "  it.innerHTML = '<h4>' + esc(n.title) + '</h4><div class=\"tm\">' + esc(n.date) + ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) + '</div>';"
const r2 = SCAN(L_CARD + '\n');
say('② 反证 · 卡面 innerHTML 拼坐标那一行: sites=' + r2.sites + ' offscreen=' + r2.offscreen + ' 越界=' + r2.out.length);
say('   ' + (r2.out.length === 1 ? '逮住了（同一把尺、同一个样本集，所以 ① 的沉默不是尺坏，是口径的洞）' : '★ 连卡面都读不到＝尺本身瞎了，① 的结论作废'));

/* ---- ③ 全树属性那一格现状 ---- */
const ATTRS = ['aria-label', 'aria-description', 'title=', 'alt='];
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
let hits = 0, coordLines = 0;
files.forEach(function (f) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  s.split(/\r?\n/).forEach(function (ln, i) {
    if (ln.indexOf('.toFixed(') < 0 || !/lat/i.test(ln) || !/lng/i.test(ln)) return;
    coordLines++;
    if (!ATTRS.some(a => ln.indexOf(a) >= 0)) return;
    hits++;
    say('   属性行 ' + f + ':' + (i + 1) + '  ' + ln.trim().slice(0, 96));
  });
});
say('③ 根目录 ' + files.length + ' 个 .js/.html：含 lat+lng+toFixed 的行 ' + coordLines + ' 行，其中写进 aria-label/title/alt 的 ' + hits + ' 行');
say('   现状口径：这一格现在干净（' + hits + ' 命中）。这条「干净」的证据是数出来的，不是假设的；一旦有人补上带坐标的 aria-label，'
  + '源码腿这一族不会红，红的是浏览器腿 CO12。');
say('=== probe45-aria-blind 完 ===');
try { fs.writeFileSync(path.join(__dirname, 'probe45-aria-blind.txt'), lines.join('\n') + '\n'); } catch (e) { say('落盘失败：' + e.message); }
