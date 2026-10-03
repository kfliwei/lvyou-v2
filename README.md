# 行迹 TRACE

一个**纯前端、移动优先的个人旅行记忆 App**：语音记录 → AI 润色 → 带坐标/天气/照片/原声的游记 → 地图落点 → 可导出的记忆与故事。

> 地图记录「我去哪里」；Memory 记录「我经历了什么」；Album 记录「这趟旅行对我意味着什么」。

## 核心能力

- 🎙 **语音游记**：说话即可记录，转写 + DeepSeek 润色，自动带坐标/天气/照片/原声，IndexedDB 本地持久化
- 🗺 **专题地图**：34 省 · 7794 个真实坐标节点，按省懒加载，主题/海拔/必去/网红筛选，实景照按需拉取
- ✍️ **对话式行程规划**（`planner.html`）：一句话「我想去川西玩 5 天」→ 真实节点召回 → 贪心排期 + 时间模型 + 季节校验 → 可拖拽调整 → 导航/导出/成册
- ⭐ **想去清单**：收藏 → 打卡 → 到达提醒，跨页面通用
- 📈 **旅程回顾**（`review.html`）：月历热力、年度报告、足迹海报、省份色块
- 📖 **成果工坊**：旅行纪念册 / 个人图鉴 / 定制路书 / 旅程故事 / GPX / HTML 长图
- 🏔 **专题预设路线**（长征 / 广西云南 / 青藏 / 山西古建）

## 架构

无构建、无框架，原生 HTML/CSS/JS，`file://` / HTTP（PWA）/ Android WebView 都能跑。

```
数据层   *-data.js（分省 window.SITES）· nation-index.js（7794 节点轻量索引）
         food*.js（美食百科）· routes-data.js（预设路线）· quotes.js（名言）
引擎     topic-common.js（专题引擎）· geo.js（GCJ-02 纠偏 + haversine）
         planner.js（行程规划）· wishlist.js（想去清单）
记忆     travel-notes.js（语音游记 + IndexedDB + window.Ai 统一调用）
成果     results.js（纪念册/路书/故事）· vault.js（Obsidian/HTML/ZIP 导出）
基础     theme.js（深色 + PWA）· ui.js（Toast/确认）· design.css（设计令牌）
```

**关键约定**：

- **AI 与引擎分离**：AI 只产出「选什么 + 为什么 + 叙事文本」，绝不产数字/坐标；召回、排期、耗时、季节校验 100% 本地规则，无 Key 也能跑通全流程。
- **`window.Ai` 是 DeepSeek 唯一入口**（`travel-notes.js`）：`Ai.chat(messages)` / `Ai.stream(messages, onDelta)` / `Ai.hasKey()`，模型别名 `deepseek-chat→deepseek-v4-flash` 在此统一。
- **`window.Geo` 是地理工具唯一入口**（`geo.js`）：`hav()` / `gcj02Of()`，纠偏与距离不重复实现。
- **主题归一**：`topic-meta.js` 的 `THEME_ALIAS` + `topic-common.js` 的 `tk()` 源头归一，同义主题（佛寺/古建寺院→寺庙）在图例/筛选/计数处合并。

## 页面清单

| 页面 | 作用 |
|---|---|
| `index.html` | 杂志式首页（语音记录入口 + 搜索） |
| `explore-map.html` | 全国/专题探索地图 |
| `topic.html` | 省级专题（数据驱动，注册表 `topic-meta.js`） |
| `planner.html` | 对话式行程规划 |
| `travel-map.html` | 个人游记轨迹地图 |
| `review.html` | 旅程回顾（统计/日历/海报/年报） |
| `story.html` | 滚动叙事时间线 |
| `wishlist.html` | 想去清单 |
| `search.html` | 全国景点全库检索 |
| `node-manager.html` | 自定义地点/节点管理 |
| `settings.html` | 设置（AI/语音/字号/存储） |
| `md-manager.html` | Obsidian MD 库 |

## 运行

```bash
# 本地预览（推荐，PWA 需 http）
python -m http.server 8125
# 打开 http://localhost:8125
```

或直接双击 `index.html`（`file://`，无 PWA/SW，其余功能正常）。

**AI 配置**：设置页填入 DeepSeek Key（存 `localStorage.tn_aiKey`），模型 `tn_model` 可选 `deepseek-v4-flash` / `deepseek-v4-pro`。不填 Key 则走纯本地规则。

**高德 Key**：节点实景照 / POI 补位 / 逆地理需 `tn_amap_key`（可选，无 Key 时相关功能静默降级）。

## 数据与存储

- 游记：IndexedDB `gujian-notes/notes`（keyPath `id`），localStorage `travelNotes` 兜底
- 想去清单 `tn_wishlist`、行程 `tn_trips`、用户节点 `tn_userNodes`、AI `tn_aiKey/tn_model`、深色 `tn_dark` 等均存 localStorage
- 数据只存本机，不上传

## 开发与验证

无构建、无测试框架，验证靠**可复跑的闸门**。四条独立命令，没有统一入口脚本（`tools/check-release.js` 不存在，别再找它）：

```bash
node tools/verify.js            # 提交前闸门（已装成 .git/hooks/pre-commit）：语法/编码/emoji 逐行登记/nation-index 覆盖/图标依赖/离线壳完整性 + §11 图片/§12 对比度/§13 状态矩阵/§14 品牌签名/§15 启动屏源真值
node tools/visual-check.js      # 视觉回归：64 态像素 diff（15 页 × 320/390/768/1440 + 4 张种子态，约 294s）
node tools/smoke-planner.js     # 行程规划真实浏览器冒烟（36 条断言，桩 fetch + 假 Key）
node tools/sync-assets.js       # 改完前端必须同步进 assets：优先交付壳 ../lvyou-v2-android/app/src/main/assets，缺壳才落 android_app/（TRACE_SRC / TRACE_ASSETS_DST 可覆盖）
```

- **视觉闸门**：`--update` 才改基线，改完必须人审 `tools/out/visual-diff/`；截图本体（`visual-baseline/`、`visual-diff/`、散点 shots）不入库，入库的是 `tools/out/visual-baseline.json`（基线指纹）与 `tools/out/visual-report.json`（每次比对的 diff 比例与耗时）。基线缺失或指纹不符 → **判 FAIL**，不会静默重建。截图前把会动的东西全钉死（`Date`/`performance.now`/rAF 时间戳/`Math.random` 种子/CSS 动画 + 跳过首启引导蒙层 + **拦掉所有 http(s) 请求**——瓦片一类外部内容进基线，同一份代码连跑两次能飘 1–5.5%，闸门就只在有缓存的机器上"确定"）+ **统一在 `prefers-reduced-motion` 下拍**——首页 hero 粒子每轮 IntersectionObserver 重启会补一个 0.05s 跳步，跳几次取决于截图前的真实窗口时间，实测 768 档在 0.00%↔0.35% 乱跳；`reduced` 是应用自己的一等渲染模式（`design.css:235`、`travel-notes.js:308`、`index.html` 的 `staticFrame()`），不是为测试造的假态。代价：动效路径不进像素基线，改由 hero 静帧墨量断言 + 真机人审覆盖）。改完 64 态连跑两遍**每态 0.00%**（批次 7-D 实测：293.6s + 282.5s，两遍各 64 PASS / 0 FAIL，性能预算 index LCP 1104–1108ms、topic 1440–1592ms、CLS 0.0000），阈值因此收成：普通页 0.1%、种子态 0.05%，**地图页 1% 的宽松特例已删**（拦网后地图各态实测全 0.00%，那个 if 只是在给网络依赖留后门）。对照：旧阈值 0.5%/8% 下把 `--color-primary`（195 处引用）整体改色，49 张全绿（当时 49 态 / 三视口）。`--seed` 跑种子数据态（`test-data.js` 灌 8 条），`--reindex` 只重登记指纹。
- **点击体检**：`node tools/audit-clicktest.js <页面>`（实点：无反应/被遮/报错）、`node tools/audit-deadclicks.js`（尺寸过小/死引用）、`node tools/audit-states.js`、`node tools/audit-icons.js`（图标真像素：遮挡/无墨/低对比 <3:1/图文基线偏移/icon-only 热区 <40px，15 页 × 亮暗两主题，附 16px 字形联络表）。已知盲区登记在 `改进实施方案与验收标准.md` 末尾「豁免登记」。
- **其他冒烟**：`tools/smoke.js`（全站页面）、`smoke-nodes` / `smoke-story` / `smoke-album` / `smoke-album-edit-obscure` / `smoke-node-mgr` / `smoke-flag-link`。注意 `smoke-album` 依赖 `python -m http.server 8125` 在跑。
- **改前端文件的收工动作**：`verify.js` → `visual-check.js` → 相关 smoke → 动过 SW `SHELL` 内文件就 bump `sw.js` 的 `CACHE` → `sync-assets.js`。
- **UI 验收标准**：必须在真实浏览器里跑通黄金路径与边界态；类型/语法过了不等于验收。

环境限制见 `docs/` 与项目记忆（模型读不了图，视觉验收交实机；无头 Chrome 深色不生效；本机 `./gradlew` 会读超时，用已解包的 gradle 加 `--offline`，详见 `android_app/BUILD.md`）。

## 里程碑（近期）

- ✅ M1 对话式行程规划（冷启动 / 召回 / 排期 / 季节校验 / AI 叙事 / 落地）
- ✅ M2 打磨（theme 归一收口 / full 档 AI 主解析 / 候选收敛）
- ✅ M3 记忆漏斗（开始旅行逐站打卡 / 一键成册 / 高德 POI 补位）
- ✅ 排期可编辑（上下移/移除/重新排期）、天数软约束、候选筛选、保存行程再编辑
- ✅ 多站点模型支持：设置页四步向导（选站点 → 填 Key → 选模型 → 测试），`window.Ai` 收口 provider 差异
- ✅ 2026-10-03 行程规划口径重构：**一把尺子**——排线、日卡里程、终到段、导出、预计天数全部走同一 `mkLeg(matrix)`（高德真实驾车里程命中时用它，否则 haversine × 1.35）；单日 >9h 的长途拆「赶路日」，日卡封顶 ≤14h 使得「一天 >24 小时」在结构上不可能；向导「按高德路线」改为真取数 + 按选点签名缓存矩阵；修 `fetchDistMatrix` 嵌套闸门锁死、2-opt 无出发地崩溃与 ≤3 站早退
- ✅ 2026-10-03 发送至高德不再丢途经地：补齐 `vianames`（高德硬性要求 `vian/vialons/vialats/vianames` 四队列数量一致，缺一整组作废）；网页兜底改用文档参数 `via`（`waypoints` 不存在）；单站日不再发送起终点同点
- ✅ 2026-10-03 视觉基建：统一 SVG 图标体系 `icons.js`（83 字形 sprite + `TI()`，描边 `currentColor` 随主题）、`icons-demo.html` 画廊、emoji 逐行 `emoji-ok:` 登记闸门、`tools/visual-check.js` 视觉回归闸门
- ✅ 2026-10-03 视觉闸门补齐（P0-0 收口）：三视口 49 态 + `test-data.js` 种子数据态；截图前钉死时钟/随机/动画并跳过首启引导蒙层（此前 index 三档基线拍的全是遮罩，等于首页无闸门）；阈值按实测噪声重定，反向验证「改品牌色 → 21 FAIL」留痕
- ✅ 2026-10-03 图标体检 `tools/audit-icons.js`：15 页 × 亮/暗 30 态真像素审计（对比度 ≥3:1 走 WCAG 1.4.11 图形底线、基线偏移 ±2.5px、icon-only 热区 ≥40px），余量读数入档；视觉闸门反向验证重做（拦掉全部 http(s) 请求 + 钉 `prefers-reduced-motion`），49 态连跑两遍每态 0.00%，据此删掉地图页 1% 特例阈值
- ✅ 2026-10-04 批次 3（P0-3 收尾）：点击探针三盲区修复（点击前滚动入视口、被遮/出屏/无反应分列计数、MutationObserver 抓属性级反应），album-edit 的「4 无反应 + 4 被遮」定性为**探针盲区、无死控件**，反向验证（处理器改空函数→立刻报无反应 4）留痕；顺带抓到并修掉**全站 16 文件 43 处 `calc(env(safe-area-inset-*,0px)+Npx)` 无空格 = 整条声明被 CSS 解析器丢弃**——首页「去备份」横幅等 fixed 悬浮件因此一直沉在文档流末尾不可见（A/B 实测 top 3945→14 归位），`sw.js` → `trace-v49`；视觉闸门重页（topic/travel-map/explore-map）等待提到 5s 消除负载下的时机飘，49 态以全量模式重拍基线后连跑两遍全绿
- ✅ 2026-10-04 批次 4（P0-2 图片）：`tools/fetch-site-images.js` 把 `SITE_IMAGES` 75 条高德直链全量镜像到 `images/sites/`（≤900px q78，3.8MB，命名走 md5 ASCII slug——首版 `encodeURIComponent(中文名)` 被 file URL 解码回中文名导致 ERR_FILE_NOT_FOUND，实测踩坑后改）；`imgSrc`/`loadSitePhoto` 升四级（本地镜像→远端映射→localStorage→高德→占位）；`UI.siteImg/imgBox/imgFail` helper + `--ar-*`/`--img-scrim` token + `.imgbox/.img-fallback` 宣纸纹占位；全站 43 处 `<img` 输出点 lazy+兜底 100%（`remove()` 删图留洞一律改原位占位）；`sw.js` 增 `images/sites` cache-first 独立桶、SHELL 134 项、`trace-v50`；verify 新增 §11 图片闸门；visual-check 增 LCP/CLS 段（index 1316ms/topic 1224ms、CLS≈0，4x CPU 节流）；新闸门 `tools/audit-imgfallback.js` 断图模拟（全图片 404）四态零破图留证 `tools/out/imgfb-*.png`；49 态视觉基线复跑全绿
- ✅ 2026-10-04 批次 5（P0-4 对比度）：`verify.js` 新增 §12 **WCAG AA 对比度审计**——运行时解析 design.css `:root`+`.theme-dark` 实时 token、解 var() 链、rgba-over-bg 复合后算比值，36 组配对（正文 4.5/图形 3/装饰须留名豁免）不达标 0；品牌 token 压深收口（primary `#C86D4B→#AE5738`、muted→`#6A675E`、gold→`#8F5D0E`、green→`#59685A`、blue→`#5F6D76`、route→`#AE5738`、grad 停点组，暗色 muted/danger）；**实底 primary 白标签全站翻 `color:var(--bg)`（diff 实测 +90 行）**——亮色米字 4.56、暗色墨字 5.59，一个 token 两主题全过；`UI.badge()` 让动态色板徽章（日程序号/美食类型章）运行时保色相压深，数据色相与圆点/轨迹不动；旧品牌字面量清扫至残留 0（product 代码 grep `C86D4B/A9563B` 仅剩 poster/results 画布艺术底与 design.css 注释，本批实换 523 处（diff 实测））；闸门变异自测两轮（muted 回旧值→3 FAIL、blue 回旧值→2 FAIL，还原回绿）；49 态基线因有意改版全量重拍，连跑两遍 0 FAIL；`sw.js` → `trace-v51`
- ✅ 2026-10-04 批次 6（P1-8 状态完备矩阵）：三标准件进 `ui.js`+`design.css`——`UI.offlineBar`（`navigator.onLine` + `online/offline` 事件驱动，**底部锚位**不盖页头，收口批次 2 缺陷 #3；ui.js 末尾自动安装，覆盖全站 8 核心页）；`UI.errorBox(host,opts)` 错误卡（标题/描述 + **重试按钮真重发起**：Promise 契约，成功自动抹掉卡片、失败按钮复位并 toast）；`UI.tileWarn` 重写为**底部单例 + 全局 15s 节流 + 离线时抑制**（离线由离线条统一提示，不再 6 层各报各的）。4 个有远程/IDB 资源的页真挂 errorBox：search 索引加载、topic 启动致命脚本、planner AI 生成、album IDB 读；本地数据页（index/wishlist/review/travel-notes 列表）无远程态按**书面豁免**登记在矩阵脚注（与 §12 装饰豁免同口径）。文档 §P1-8 落地 8 页 × 4 态矩阵表（`加载中|空数据|出错|离线`，每格具体归属）。闸门：`verify.js §13` **状态矩阵常驻校验**——UI.offlineBar/errorBox 导出+offlineBar 自动安装、design.css 三类件样式齐、8 核心页 `<script src="ui.js">`、4 远程页真调 `UI.errorBox(`、文档矩阵 5 列表头存在且离线列 8 行全指 `UI.offlineBar`、无「待设计」；§12 新增 8 组组件色对（44 组全绿 0 不达标，实测离线条 var(--bg)/danger 亮 4.85/暗 5.18、errorBox 图标 4.47/4.24 图形档）。变异自测 5 项（导出键改错/CSS 类改错/页面调用改错/矩阵"待设计"/矩阵删一行）全部命中并还原，日志 `tools/out/b6-gate-mutation-20261004.txt`。行为验证 `tools/smoke-states.js` 9/9 PASS：8 核心页 offline 事件→条出现含「离线」文字→online 事件→条消失，errorBox 渲染含 `.eb-retry` 且重试回调 counter 真 +1，planner AI 断网+拦 fetch 后点「生成」→errorBox 真落 `#aiRouteOut`；截图 `tools/out/shots/*.offline.png` 与 `planner.ai-error.png` 入库（**批次 7-D 更正：这句当时不成立**——`.gitignore` 忽略 `tools/out/shots/*.png`，9 张只活在本地；已归位 `tools/out/shots/2026-10-04-b6-states/` 入库，并把 `smoke-states.js` 的截图输出改成带日期目录）。基线中性（visual-check 拦 http 下 navigator.onLine 仍 true→离线条不显；tileWarn 4s 自动隐去→5s 截图窗口外），未重拍；`sw.js` → `trace-v52`
- ✅ 2026-10-04 批次 7（P1-7 品牌时刻，五个签名动作全落地）：**7-A 空态线稿** 6 张 2px `currentColor` 线稿（远山/足迹/帐篷/信笺/胶片/罗盘，源文件进 `art/empty-*.svg` + SW SHELL），`.empty .emoji` float 样式删除，6 处渲染点真挂载（search/topic/review/album/story + planner 候选弹层）；挂载形态两次踩坑后定稿 **inline `<svg>`**——`<img src=*.svg>` 里 `currentColor` 解析成 SVG 自己的 black（暗色看不见），CSS `mask` 被 Blink 按 CORS 取图（`file://` 下 3 条 `net::ERR_FAILED`，APK 里空态整块隐形）。**7-B 日卡蜡封章 + 地图立针**：`planner.js` 的 `DAY_COLORS` 硬编码色板删除，改 `.day-seal.ds-1..6`（`--day-c1..6` 亮暗各一档，§12 逐档核定 5.86–8.64:1），整日打卡完盖「游」暗金小印；`.map-pin` 鎏金圈 + 深陶土针身 + 纸色序号，路线改双色描边（`--color-gold` 衬底 + `--route-color` 芯），色值经新 helper `cssColor()` 从 computed token 读，切暗色自动翻深；临时节点徽标 `#fff` 内联色收进 `.bdg-t` token（旧值暗色只有 2.1:1，实为暗色 bug）。**7-C 竖排题签**：design.css 新增 `.vrow/.vtitle/.vlead`（`writing-mode:vertical-rl` + `text-orientation:upright` 让 `·` 立排不横倒），挂 topic 卷首与 story 开篇 2 处；闸门 `VIEWPORTS` 补第 4 档 `[320,640]`（最小在售安卓机 CSS 宽度，竖排不破版的下限）→ 状态 49 → **64 态**，基线重拍 234.6s。**7-D 启动屏 + 对比图**：APK 首帧在**交付用的外部壳** `F:/MyAi/trace/lvyou-v2-android`（不是仓库内 `android_app/`，那份不是构建目标）改 4 处——`colors.xml` 加 `gold_deep #8F5D0E`(= `--color-gold`)、`drawable/splash_brand.xml`（远山线稿按 0.5 缩放 + 偏移 (24,29) 进 108dp 安全区）、`values/themes.xml` 的 `windowBackground` 挂 layer-list（Android 11 及以下路径）、新建 `values-v31/themes.xml` 配 `windowSplashScreen*` 三属性**且把 `windowBackground` 退回纯色**（同名 style 是整体替换不是合并，父档每项要重抄；v31 再挂带图 drawable = logo 闪两次）。闸门：`verify.js §14 品牌签名`（组件类 3 + 空态内联挂载 6 + 画稿逐字对账 6/6 + 竖排 ≥2 + token 档 12）与 **`§15 启动屏源真值`**（线稿色 = `--color-gold`、四条几何按 0.5 缩放现算比对、v31 三属性、双 logo 抑制、父档 item 漏抄；换算器只覆盖 M/L/H/V/Z，画稿改用曲线就判红不静默跳过；**壳目录不在本机时打 SKIP 并写明覆盖缺口，不假装通过**）；§14/§15 变异自测 **14 项**（MUT-A..F + MUT-I..P）各触发且只触发 1 条对应 FAIL、还原逐字节一致（MUT-P 改的是共享画稿，同时惊动 §14 画稿对账，属两道闸互证，已在 harness 显式登记为允许连带）。物证 `tools/out/shots/2026-10-04-b7-brand/`：**7 张左改前右改后拼接图** + 18 张单态 + `EVIDENCE.md`，改前树 = `git archive HEAD`（`b1c8a43`）导出，两侧探针计数逐项相等（`.day-card` 恒 6、`.leaflet-marker-icon` 恒 9），差的只有本批组件（`.day-seal` 0→6、`.vtitle` 0→1×2、`.empty-art` 0→1）。启动屏预览当场揪出「日」线宽 bug（等比 r 5→2.5 却沿用 1.8 线宽 → 糊成实心甜甜圈，改 1.0）。全闸门复跑：verify 全绿（§12 对比度 62 组 / 0 不达标、§13、§14 6/6、§15 几何 4/4）、clicktest 无反应 3（story ‹›×2 + md-manager 导入，均属既有豁免）被遮 0 报错 0、deadclicks EXIT=0、icons ALL OK（最低图标对比 3.05:1、最小 icon-only 热区 40px）、smoke-states 9/9、visual-check 64 态两遍 0 FAIL。顺手修三件"说话不算数"：**pre-commit 闸门此前从未真的装上**（`tools/git-hooks/pre-commit` 在仓库里但 `.git/hooks/` 没有，已 `cp` 安装并 dry-run 过）、批次 6 的 9 张状态物证没入库（见上）、`audit-icons.js`/`smoke-states.js` 的证据目录日期用 `toISOString()`=UTC，本地 00:00–08:00 跑会写进昨天的目录（本轮 07:39 就把 7 张物证盖进了 `shots/2026-10-03-p01/`），改成取本地年月日。第四件：**`tools/sync-assets.js` 的路径还是仓库搬进 `lvyou-v2/` 之前的 `F:/MyAi/Trace`**，脚本因此在末尾验证段直接 ENOENT 抛错——"改完前端必须同步 assets"这条收工动作早就空转了；现改成从 `__dirname` 推路径、优先写交付壳 `../lvyou-v2-android/app/src/main/assets`，实跑 `synced files: 3034` + 8 个关键文件逐字节一致。顺带量到：**交付壳里的 `sw.js` 还是 `trace-v38`、`design.css` 无 `day-seal`**，即上一支 APK 根本不含批次 0–7 的任何东西，所以本批所有真机项必须等一次带新 assets 的构建才能勾。`sw.js` → `trace-v54`（SHELL 140 项）
- ⏳ 剩余改进项与节奏见 `改进实施方案与验收标准.md` §0.5 复核表与文末批次表（批次 0–7 已清，累计 ~15.9 人日 · 余 8–11 四批 ≈ 10.0 人日；批次 8 的前提变了——schema-2 备份模块已从本机不可达，改从零实现）
