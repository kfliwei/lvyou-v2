# 视觉闸门反向验证留痕（批次 1 · 2026-10-03）

**变异**：`design.css:118` `--color-primary:#C86D4B` → `#D2553A`（品牌主色整体偏红，全站 195 处 `var(--color-primary)` 引用）。
**判据**：故意改色必须让闸门 FAIL 并给出差异图；改回后必须 PASS。恢复用 Edit 逐字改回（不用 `git checkout`，避免连带清空其他未提交改动）。

| 跑次 | 命令 | 结果 | 耗时 |
|---|---|---|---|
| 变异前基线 | `node tools/visual-check.js` | 49 PASS / 0 FAIL，exit 0 | 148.9s |
| **变异态** | `node tools/visual-check.js` | **28 PASS / 21 FAIL，exit 1** | 149.2s |
| 改回后 | `node tools/visual-check.js` | 49 PASS / 0 FAIL，exit 0 | 149.0s |

原始日志：`check.clean.txt` / `check.mutant.txt` / `check.restored.txt`；变异态机器报告：`report.21FAIL.json`；差异图（高亮像素）：`index.390x844.png`、`review.390x844.png`。

## 变异态 FAIL 全清单（21）

```
FAIL index.390x844.png          diff 0.28% > 0.1%
FAIL index.768x1024.png         diff 0.12% > 0.1%
FAIL search.390x844.png         diff 0.28% > 0.1%
FAIL search.768x1024.png        diff 0.12% > 0.1%
FAIL wishlist.390x844.png       diff 0.28% > 0.1%
FAIL wishlist.768x1024.png      diff 0.12% > 0.1%
FAIL review.390x844.png         diff 0.28% > 0.1%
FAIL review.768x1024.png        diff 0.12% > 0.1%
FAIL settings.390x844.png       diff 0.28% > 0.1%
FAIL settings.768x1024.png      diff 0.12% > 0.1%
FAIL me.390x844.png             diff 0.28% > 0.1%
FAIL me.768x1024.png            diff 0.12% > 0.1%
FAIL node-manager.390x844.png   diff 0.61% > 0.1%
FAIL node-manager.768x1024.png  diff 0.26% > 0.1%
FAIL node-manager.1440x900.png  diff 0.15% > 0.1%
FAIL story.390x844.png          diff 0.28% > 0.1%
FAIL story.768x1024.png         diff 0.12% > 0.1%
FAIL planner.390x844.png        diff 0.28% > 0.1%
FAIL planner.768x1024.png       diff 0.12% > 0.1%
FAIL review.seed.390x844.png    diff 0.28% > 0.05%
FAIL story.seed.390x844.png     diff 0.28% > 0.05%
```

## 这一跑真正的收获：旧闸门是瞎的

第一轮同样的变异、同样的 49 张，结果是 **49 张全绿、exit 0**。逐态对差值才发现：旧配置（pixelmatch `threshold:0.12`、页面级 0.5%/地图 8%）下这个改色在**任何一态上都没有产生可测信号**（Δ 全为 0.000）。原因两条，都在这批修掉：

1. **pixelmatch 0.12 把同色系改色判成"无差异"**——`#C86D4B→#D2553A` 的逐通道差落在 0.12 容差内。收到 0.02 后信号出现。
2. **首页噪声掩盖一切**——只冻 `Date` 时 index 三档噪声 0.41%/0.28%/0.17%（星尘粒子走 `Math.random`，呼吸光晕走 infinite CSS 动画），比改色信号还大。补齐 `performance.now`/rAF 时间戳/`Math.random` 种子 + `screenshot({animations:'disabled'})` 后，非地图页噪声降到 ≤0.01%（仅 album.seed 0.01%）、地图页 0.04%（topic.768 瓦片），于是阈值可以从 0.5%/8% 收到 0.1%/1%，种子态 0.05%。

**结论**：阈值不是"容忍度"，是"能看见多小的东西"。它必须按实测噪声定，而噪声必须先被钉死才存在。
