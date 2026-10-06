# 批次 23 真机复验证据（2026-10-06，包 `行迹TRACE_v2.26.11_debug_win-a.apk` / versionCode 50）

设备：一加 Ace 6T（`3B661L0015F00000`，PLR110），`wm size 1272x2800`、`wm density` = Physical 560 / **Override 620**、`settings get system font_scale` = **1.35**。
⇒ CSS 视口 `1272/(620/160) ≈ 328`，与 `smoke-usable` 新增的 328×723 真机档对齐；系统 1.35 未动，归一发生在 WebView 的 `setTextZoom(100)`。

| 文件 | 页面 | 看什么 |
| --- | --- | --- |
| `01-home.png` | 首页 `index.html` | 标题「今天，去哪里？」与副行、搜索胶囊、两枚主按钮全部按 CSS px 1:1 渲染，无 1.35 放大后的挤行；底部五 Tab 完整 |
| `02-plan.png` | 探索地图 `explore-map.html` | 大标题 + 副行 + 搜索行在 328 档不越界；专题卡两行文案换行正常 |
| `03-back.png` | 足迹 `travel-map.html` | **新撞**：顶栏标题渲染成「我的游…」，而 `uiautomator` 读到的 text 是完整的「我的游记地图」（bounds `[236,210][480,296]`＝244 设备 px ≈ 63 CSS px 装不下 6 个汉字）⇒ CSS 单行省略号截断，不是数据缺失 |
| `05-wizard-ime.png` | 行程规划向导 | 输入框聚焦 + IME 弹起时的一屏，「AI 参与 关／叙事／全量」三枚与提示行不越界 |
| `06-sheet.png` | 向导「候选景点 · 40 处」 | 行首复选框 + 名称 + `必去` 徽章 + 省·市·主题副行，全部在屏内；`随手记` 悬浮按钮不压住列表 |

**未覆盖（阻塞）**：23-B 的「正序／倒序」按钮行、23-C 的弹层右上角 X ——17:48 后设备进锁屏（`mScreenState=OFF`），`wm dismiss-keyguard` 对有 PIN 的锁屏无效，需人工解锁后补拍。

**顺带在真机确证的批次 22 成果**：`uiautomator dump` 里出现「返回首页」「收起统计」「切换图层」「随手记：语音记录此刻」这批可达名——无障碍名在真机 WebView 的可访问性树里生效。

辅助脚本（本目录）：`../adbgo.sh`（adb 掉线重连）、`../taptext.js`（按文案定位点按，带 `BELOW_NAV` 保护：底栏 y≥2400 时拒绝点，否则会误触 Tab）。
