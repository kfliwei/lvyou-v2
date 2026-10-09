/* b31-doc-fix.js — 批次 31-F：把像素基线终账与 sw 回写审核报告；顺带登记旅程叙事那一枚「时分没了」。
   纪律同 README：每条 from 恰命中 1 次，否则不落盘。 */
const fs = require('fs');
const P = 'docs/功能与UI全面审核-2026-10-09.md';
let s = fs.readFileSync(P, 'utf8');
const before = s.length;
let bad = 0;
function rep(tag, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.log('HIT!=1 ' + tag + ' -> ' + n); bad++; return; }
  s = s.replace(from, to);
  console.log('OK ' + tag);
}

rep('§7 加像素基线终账',
  '- 未提交、未推送、未出包。APK 仍是 **51 / 2.26.12**',
  '- **像素基线已收口（批次 31-F）**：先只读复跑（改后代码 × 改前基线）拿范围——**109 张 = 108 PASS / 1 FAIL、547.5s，其中 107 张恰好 0.00%**，'
  + '漂移只落在两屏且都是本批该动的：`travel-map.seed.390x844` **0.37%**（红点全在底部时间线胶囊那一行，`09.26~10.03`／`09.26 09:24` → `09-26~10-03`／`09-26 09:24`）、'
  + '`story.seed.390x844` **0.01%**（仍 PASS，而这 0.01% 正好是「改一个字」的地板，反证像素腿对文字改动不瞎）。'
  + '差异图与改前基线副本、人审结论都在 `tools/out/b31-visual-diff-before-update/`（`b31-human-review.txt`）。'
  + '随后全量 `--update` 重拍 **109 张、0 FAIL、481.0s**（未用 `--seed --update`——数据态基线的前置态要靠全量跑的前半程），'
  + '再全量只读复跑 **109/109 PASS、109 张全 0.00%、541.2s**（`tools/out/b31-baseline-readonly2.txt`）。sw 缓存 `trace-v86` → `trace-v87`。\n'
  + '  - **重拍时人审顺带查出的一条信息损失（待点单，本批不动）**：旅程叙事 `story.html` 的日卡原来直接印 raw 存储串（`test-data.js` 的 `fmt()` 写的是「日期 空格 时分」），'
  + '改走 `dayText` 之后**时分不再上屏**。这符合本批「日卡读日」的口径，但那一格到底要不要留时刻是产品取舍：'
  + '要留就拼 `fmtDayText(n)` + `fmtClock(n.ts)` 两个出口（像单篇抽屉那一格），不许退回 raw 存储串。'
  + '  - 同一屏另有一条**既有**版式问题（不是本批造成的，那 0.01% 只动了 `09:24` 那几个字）：底部翻页浮条压住正文一行。登记不修。\n'
  + '- 未提交、未推送、未出包。APK 仍是 **51 / 2.26.12**');

rep('§8 第 3 项改口',
  '剩最后一件：**像素基线重拍 + 文档 + sw `trace-v86→v87` + commit**（本批改了十几屏的日期读数，基线必然漂移，只读复跑先看范围）。',
  '像素基线也已重拍收口（**只读 108 PASS/1 FAIL → 全量 `--update` 109 张 → 复跑 109/109 全 0.00%**，数字见 §7），文档与 sw `trace-v86→v87` 已回写。'
  + '**本批只剩一次本地 commit**（不 push、不出包——那两件事各需你逐条点头）。');

if (bad) { console.log('未落盘'); process.exit(1); }
fs.writeFileSync(P, s);
console.log('written: ' + before + ' -> ' + s.length + ' 字符');
