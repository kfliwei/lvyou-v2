/* tools/out/probe30-datesites.js — 批次 30 第二项（S1-3「日期显示不走归一键」）的落点普查
 *
 * 为什么要这张纸：README 的 §45 段里有半句「落点 20+ 处日期显示仍走旧口径……见方案文档」，
 * 而全仓 *.md 与 docs/*.md 里 `2026-10-08` 零命中——那三条 S1 从没登进任何方案文档，
 * 这句指针指向的是个不存在的落点（同 §43 那次「注释里给了纪律一个不存在的理由」同形）。
 * 现在把它换成数出来的数：本探针逐行打印候选落点，谁都能重跑对着看。
 *
 * 口径（与 §45 的闸门不同，这条只是普查）：
 *   候选 = 同一行里既出现「取月/取日」的裸读法（getMonth / getDate / toLocaleDateString / .date 直接拼），
 *          又出现渲染信号（innerHTML / textContent / fillText( / <div / <span / bindPopup / rows.push( / ' · '）。
 *   理由：§41 的 noteDay 是「键」（分组、统计、点开共用），本项要修的是「显示」——
 *         界面上那一行字怎么写出来的。键那一族的落点 §41 已经钉死，这里不重复数。
 *   不做的事：不剥注释（普查要看的就是原始行，剥了反而看不见登记串自己）；
 *             不判「这行是不是真在屏上」——逐行打印出来由人判，误报会显示在读数里而不是藏在总数里。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const RENDER = ['innerHTML', 'textContent', 'insertAdjacentHTML', 'fillText(', '<div', '<span', '<p ', '<p>', '<li', '<td', '<b>', 'bindPopup(', 'rows.push(', "' · '"];
/* 两桶分列，别把两个问题数成一个：
     A 桶＝「某篇记录的日期」被直接拼进屏上（n.date／latest.date／(n.date||'').slice…）——这才是 S1-3，
        它的病灶是「写盘可能是 2026.10.8／2026年10月8日／2026-10-08 三种形状，界面就照着原样印」，
        修法是把显示也交给 §41 那个归一单点（noteDay 出来的是 YYYY-MM-DD，再按页面档格式化一次）。
     B 桶＝「今天/当前月」这类整机时刻（季节标题、导出文档的「生成于」、海报落款）——它没有源串可归一，
        但 toLocaleDateString 会跟系统语言走（§28 给 ICS 定过同一条口径：两台手机两个读数），要修是修成固定档。
   假阳性也要能被看见：`/toLocaleString/` 会数到 `words.toLocaleString()`（数字千分位），所以本探针不再用它匹配日期，
   只在 A/B 两桶各自点名自己要的形状。 */
const BUCKET_A = [/n\.date\b/, /latest\.date\b/, /\bnotes?\[.*\]\.date\b/, /d\.date\b/];
const BUCKET_B = [/getMonth\s*\(/, /getDate\s*\(/, /toLocaleDateString/, /getFullYear\s*\(/];

const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
let a = 0, b = 0, nd = 0;
const perA = {}, perB = {};
files.forEach(f => {
  if (/^(smoke-|verify|mut-|probe|sw\.)/.test(f)) return;      /* 闸门与探针自己不算产品落点 */
  if (/(-data|site-tickets|nation-index)\.js$/.test(f)) return; /* 数据源不算显示层 */
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (ln.indexOf('noteDay') >= 0) { nd++; return; }           /* 已经走归一键的那些行单独计数 */
    if (!RENDER.some(k => ln.indexOf(k) >= 0)) return;
    const tag = '  ' + (i + 1) + '  ' + ln.trim().slice(0, 118);
    if (BUCKET_A.some(re => re.test(ln))) { (perA[f] = perA[f] || []).push(tag); a++; }
    else if (BUCKET_B.some(re => re.test(ln))) { (perB[f] = perB[f] || []).push(tag); b++; }
  });
});
function dump(t, per, n) {
  console.log('### ' + t + '：' + n + ' 行，' + Object.keys(per).length + ' 个文件');
  Object.keys(per).forEach(f => {
    console.log('—— ' + f + '（' + per[f].length + ' 行）');
    console.log(per[f].join('\n'));
  });
}
dump('A 桶：记录的日期直接拼上屏（S1-3 的落点）', perA, a);
dump('B 桶：整机时刻（locale/档位问题，不是归一问题）', perB, b);
console.log('=== 普查读数：A ' + a + ' 行 / B ' + b + ' 行；另有 ' + nd + ' 行已经走归一键 noteDay ===');

