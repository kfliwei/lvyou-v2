/* b31-readme-fix.js — 批次 31-F：把像素基线的范围证明数字回写 README 第 88 行（超长行，只能脚本改）。
   纪律：每条 from 必须恰命中 1 次，否则直接 exit(1) 不落盘。 */
const fs = require('fs');
const P = 'README.md';
let s = fs.readFileSync(P, 'utf8');
const before = s.length;
let bad = 0;
function rep(tag, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.log('HIT!=1 ' + tag + ' -> ' + n); bad++; return; }
  s = s.replace(from, to);
  console.log('OK ' + tag);
}

const NEW = '**像素基线收口（批次 31-F）**：本批一次改了十几屏的日期读数，所以先只读复跑（**改后的代码 × 改前的基线**）'
  + '拿范围，再决定重拍。只读那一遍 **109 张 = 108 PASS / 1 FAIL、547.5s**，而 **107 张恰好 0.00%**——'
  + '漂移只落在两屏，且两屏都是本批该动的：`travel-map.seed.390x844` **0.37%**（> 0.05% 判 FAIL，'
  + '红点全在底部时间线胶囊那一行，`09.26~10.03`／`09.26 09:24` → `09-26~10-03`／`09-26 09:24`）；'
  + '`story.seed.390x844` **0.01%**（仍 PASS，而这 0.01% 正好是「改一个字」的地板——差异图上只有一枚红块：'
  + '日卡日期后面那段 `09:24`。成因是 `test-data.js` 的 `fmt()` 把存储串写成「日期 空格 时分」，'
  + '而 `story.html` 那一行原本直接印 raw 存储串，改走 `dayText` 之后时分不再上屏）。'
  + '**「按代码路径不该动的那 107 档必须 0」这一条成立，才允许重拍**；'
  + '人审看的是差异图 + 改前基线副本，都在 `tools/out/b31-visual-diff-before-update/`（读数与结论 `b31-human-review.txt`）。'
  + '随后全量 `--update` 重拍 **109 张、0 FAIL、481.0s**（**不用 `--seed --update`**：数据态基线的前置态要靠全量跑的前半程，见该脚本头注 6–7 行），'
  + '再全量只读复跑 **109/109 PASS、109 张全 0.00%、541.2s**（`tools/out/b31-baseline-readonly2.txt`）。'
  + '覆盖面账同 §45 那一句：像素腿对文字内容结构性失明（改一个字只出 0.01% 地板），所以本批 24 处接线的**内容**正确性由源码腿 + 浏览器腿守，这句是覆盖面账不是免责声明。'
  + '**顺带登记一条待点单**：旅程叙事日卡现在只剩日期、时分没了（就是上面那一枚红块），'
  + '要保留时刻应拼 `fmtDayText(n)` + `fmtClock(n.ts)` 两个出口，不许退回直接印 raw 存储串。sw 缓存 `trace-v86` → `trace-v87`。';

rep('§46 尾部追加基线收口段',
  '并把旧锚那句「只写一次」改成实话「只声明一份」。））',
  '并把旧锚那句「只写一次」改成实话「只声明一份」。' + NEW + '））');

rep('visual-check 用时区间',
  '全量一遍实测 470.6s 重拍／525–561s 只读',
  '全量一遍实测 470.6–481.0s 重拍／525–561s 只读');

if (bad) { console.log('未落盘，命中数不对'); process.exit(1); }
fs.writeFileSync(P, s);
console.log('written: ' + before + ' -> ' + s.length + ' 字符');
