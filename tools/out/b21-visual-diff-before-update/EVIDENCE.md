# 批次 21 · topic 基线重拍前人审清单（`--update` 之前归档的 diff 图）

来源：79 态只读复跑 `tools/out/b21-vc-readonly-1.txt`（2026-10-06 10:40，耗时 533.8s）。
读数：**73 PASS / 6 FAIL**，其中 5 条像素 FAIL 全在 `topic.*`，第 6 条是 `性能预算 topic.html`（另案，见下）。

| 档 | diff | 红点落在哪里 | 判定 |
| --- | --- | --- | --- |
| topic.320x640 | 0.15% | 筛选 chip 行右端（「网红」之后那格起）；另有 2 处针脚抗锯齿黄点 | 该红：新增「这一带」chip 把行内 chip 整体右移 |
| topic.390x844 | 0.28% | 同上，chip 行两格重叠 | 该红 |
| topic.452x995 | 0.29% | 同上，chip 行三格重叠（一加 Ace 6T 验收主档） | 该红 |
| topic.768x1024 | 0.56% | chip 行五格重叠 | 该红 |
| topic.1440x900 | 0.79% | chip 行整行十格重叠（越宽的档一行放得下的 chip 越多，位移累积越大） | 该红 |

**范围证明（比红榜更有力的那条）**：其余 74 态逐条 `diff 0.00%`，包括同样引 `design.css`／`map.css` 的
`index`／`search`／`wishlist`／`review`／`planner`／`md-manager`／`explore-map`／`travel-map` 与四条种子态。
批次 21 只往 `topic.html` 的 chip 族里加了一枚 chip，所以「按代码路径不该动的那 74 态一格没动」成立。
`1440` 档百分比最大不是风险最高——它只是那行里被推走的 chip 最多。

**人审结论**：五张图的红点全部在 chip 行内，顶栏、搜索框、路线横幅、图例、地图针脚与虚线、
底部「当前区域」统计条、tabbar 零红 → 有意改版，批准 `node tools/visual-check.js topic.html --update`，
随后 `--reindex` 重登记指纹（单页 --update 不改写清单，不补这一步下次只读跑会报 `baseline-drift`）。

**第 6 条 FAIL 另案**：`性能预算 topic.html — LCP 3252ms(<2500)`。空机 A/B 各 6 轮实测
（`tools/out/b21-perf-ab.txt`）：批次 20 末的 HEAD 树 888／1124／1268／1508／2268／**2652**ms（中位 1508，
max 已越线），批次 21 之后的工作树 1016／1348ms（中位 1252）。**不是本批引入的回归，是单次采样在
「软件渲染 + 4x CPU 节流 + 冷首屏」上的长尾**。修法：`tools/visual-check.js` 性能预算段改取 3 次采样的
LCP 中位 + CLS 最大值，`verify.js §25` 钉三处形状 + README 登记，变异自测
`tools/out/mut-verify25-perf.js` **4/4 按预期红、异常 0**（`tools/out/b21-mut-verify25-perf.txt`）。
