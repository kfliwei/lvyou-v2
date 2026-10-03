# 批次 7 · P1-7 品牌时刻 物证（2026-10-04）

五个签名动作的**改前 / 改后**对比 + 各阶段人审截图。拼接图一律 **左=改前、右=改后**。

## 改前基线怎么来的

`git archive HEAD`（批次 6 收工点 `b1c8a43`）导出到仓库外的干净树 `F:/MyAi/trace/.b7-before`，
不是手工"关掉样式"模拟。核对过：该树 `design.css` 里 `day-seal|map-pin|empty-art|vtitle` 命中 **0**、
`.empty .emoji{` 仍在、`planner.js` 仍有 `DAY_COLORS`、`art/` 只有 4 张旧渐变插画。

## 拍摄口径（与像素闸门同源，避免"对比图比的是噪声"）

同一个浏览器实例、同一份种子（`tn_trips` 灌同一条 6 天川西线 + `test-data.js` 走 `loadTestData().idb`）、
**拦掉所有 http(s) 请求**（瓦片不进画面）、冻 `Date`/`performance.now`/rAF 时间戳/`Math.random` 种子、
`prefers-reduced-motion: reduce`、`animations:'disabled'`、`deviceScaleFactor:2`。
两侧探针计数记录在 `../../b7d-before-after.log.txt`：`.vtitle` 0→1（topic/story 各一处）、
`.empty-art` 0→1、`.day-seal` 0→6 而 `.day-card` 恒 6、`.leaflet-marker-icon` 恒 9 —— 证明差的是组件，不是数据。

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `01-map-pin__pair.jpg` | 时刻① 地图立针 + 描金双色路线（390 档，`#mapBox` 裁切） |
| `02-dayseal__pair.jpg` | 时刻② 日卡蜡封章（前 3 张 `.day-card` 并集框；D1 全打卡 → 带「游」印） |
| `03-vtitle-topic__pair.jpg` | 时刻③ 专题列表卷首竖排题签（320 窄屏，`?p=nation`） |
| `04-vtitle-story__pair.jpg` | 时刻③ 旅程开篇竖排（320 窄屏，种子态） |
| `05-empty-light__pair.jpg` / `05-empty-dark__pair.jpg` | 时刻④ 空态远山线稿，亮/暗各一组——**暗色那张是批次 7-A 的缺陷位**（`<img>`/CSS mask 两种挂载在暗色或 `file://` 下等于看不见） |
| `06-splash__pair.jpg` | 时刻⑤ APK 启动屏**资源预览**（见下方免责） |
| `b7-dayseal-*.png` `b7-mappin-*.png` `b7-empty-search-*.png` | 批次 7-B 单态人审图（亮/暗） |
| `b7-brand-light-full-390.png` | 批次 7-A/7-B 全页亮色通览（390 档，五时刻同框初检） |
| `b7c-*.png` | 批次 7-C 竖排题签 320/390 × 亮/暗 取证 |

合计 **7 张拼接图 + 18 张单态截图**（`b7-*` 8 张 / `b7c-*` 10 张）+ 本说明。这 18 张原先散在
`tools/out/shots/` 根，被 `.gitignore:48`（`tools/out/shots/*.png`）挡着没进库，批次 7-D 归位到本带日期目录。

## 两条免责，别把预览当验收

1. **`06-splash__pair.jpg` 不是真机截图。** Android 12 首帧要真机/模拟器才能拍，而打包需逐条授权。
   这张是把壳资源本身解析后重绘的预览：线宽、透明度、描边色、底色全部从
   `splash_brand.xml` + `colors.xml` + `values-v31/themes.xml` 现读，脚本里不手抄第二份。
   圆形 = 自适应图标蒙版的近似。**改前那侧是纯色首帧**（旧壳只有 `android:colorBackground`，
   没有 `windowBackground` 覆写）；Android 12+ 旧行为是系统默认用桌面图标当启动图标，不是这张纸。
   真机物证待授权构建后补（`verify.js §15` 已把资源契约钉成常驻闸门）。
   —— 这张预览的实际价值：它当场揪出「日」的线宽 bug（画稿 r=5/stroke=2 等比缩到 r=2.5 却沿用 1.8 线宽，
   糊成实心甜甜圈），已改为 1.0。
2. **`02-dayseal__pair.jpg` 中间横着一条底部导航**，是 puppeteer 裁切文档坐标区域时 fixed 元素按视口位置绘制的
   采集伪影，两侧同位置同 appearance，不影响对比结论（页面里导航恒在屏底）。

## 复现

一次性取证脚本 `tools/.b7dbefore.cjs`（本批收工后删除，与批次 3–6 的散点探针同口径）：
`node tools/.b7dbefore.cjs`，或 `ONLY=02,06 node tools/.b7dbefore.cjs` 只补拍指定时刻。
闸门侧的常驻校验是 `tools/verify.js` §14（品牌签名）与 §15（启动屏源真值对账），
变异自测留痕 `../../b7-gate-mutation-inline.txt`（MUT-A..F）与 `../../b7d-gate-mutation-splash.txt`（MUT-I..P）。
