/* b31-readme-fix2.js — 补一条判据语义：重拍后指纹清单变了 4 项，而只读那一遍只有 2 项 diffPct 非零。
   根因是 pixelmatch 的 threshold:0.02 —— 「0.00%」＝「没有像素色差超过 0.02」，不是「PNG 字节一致」。
   纪律：每条 from 恰命中 1 次，否则不落盘。 */
const fs = require('fs');
let bad = 0;
function fix(P, pairs) {
  let s = fs.readFileSync(P, 'utf8');
  const before = s.length;
  pairs.forEach(([tag, from, to]) => {
    const n = s.split(from).length - 1;
    if (n !== 1) { console.log('HIT!=1 ' + tag + ' -> ' + n); bad++; return; }
    s = s.replace(from, to); console.log('OK ' + tag);
  });
  if (bad) return;
  fs.writeFileSync(P, s);
  console.log(P + ': ' + before + ' -> ' + s.length);
}

const CAVEAT = '**这里还有一条判据语义要说清（本轮重拍时实测撞到）**：只读那一遍 **107 张的 diffPct 是精确的 0**'
  + '（从报告 JSON 里读的，不是控制台两位小数舍出来的），可重拍之后 `tools/out/visual-baseline.json` 里**有 4 项指纹变了**——'
  + '除上面那两屏外还多 `topic.390x844`（+81 字节）与 `topic.768x1024`（−2 字节），而这两态在只读那一遍读的都是 0。'
  + '根因是比对走 `pixelmatch(..., { threshold: 0.02 })`：**「0.00%」的真实含义是「没有任何像素的色差超过 0.02」，不是「PNG 字节一致」**。'
  + '⇒ 范围证明只能拿 diffPct 当证据：指纹没变不等于画面没变，指纹变了也不等于画面变了（阈值以下的抖动两边都可能）。';

fix('README.md', [[
  '§46 追加判据语义',
  '**「按代码路径不该动的那 107 档必须 0」这一条成立，才允许重拍**；',
  '**「按代码路径不该动的那 107 档必须 0」这一条成立，才允许重拍**；' + CAVEAT,
]]);

fix('docs/功能与UI全面审核-2026-10-09.md', [[
  '§7 追加判据语义',
  '差异图与改前基线副本、人审结论都在 `tools/out/b31-visual-diff-before-update/`（`b31-human-review.txt`）。',
  '差异图与改前基线副本、人审结论都在 `tools/out/b31-visual-diff-before-update/`（`b31-human-review.txt`）。'
  + '\n  - **顺带量到的一条判据语义（不是本批的 bug，是闸门的读法）**：只读那一遍 107 张的 diffPct 精确为 0，'
  + '但重拍后 `visual-baseline.json` 有 **4 项**指纹变了（多出的两项是 `topic.390x844` +81 字节、`topic.768x1024` −2 字节，'
  + '这两态只读时读的都是 0）。因为比对走 `pixelmatch({threshold: 0.02})`——「0.00%」＝「没有像素色差超过 0.02」，不是「PNG 字节一致」。'
  + '所以范围证明只认 diffPct，别拿指纹的「没变」当「画面没变」。',
]]);

if (bad) { console.log('未落盘'); process.exit(1); }
