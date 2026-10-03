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
node tools/verify.js            # 提交前闸门（已装成 .git/hooks/pre-commit）：语法/编码/emoji 逐行登记/nation-index 覆盖/图标依赖/离线壳完整性
node tools/visual-check.js      # 视觉回归：49 态像素 diff（15 页 × 390/768/1440 + 4 张种子态，约 149s）
node tools/smoke-planner.js     # 行程规划真实浏览器冒烟（36 条断言，桩 fetch + 假 Key）
node tools/sync-assets.js       # 改完前端必须同步进 android_app/app/src/main/assets
```

- **视觉闸门**：`--update` 才改基线，改完必须人审 `tools/out/visual-diff/`；截图本体（`visual-baseline/`、`visual-diff/`、散点 shots）不入库，入库的是 `tools/out/visual-baseline.json`（基线指纹）与 `tools/out/visual-report.json`（每次比对的 diff 比例与耗时）。基线缺失或指纹不符 → **判 FAIL**，不会静默重建。截图前把会动的东西全钉死（`Date`/`performance.now`/rAF 时间戳/`Math.random` 种子/CSS 动画 + 跳过首启引导蒙层 + **拦掉所有 http(s) 请求**——瓦片一类外部内容进基线，同一份代码连跑两次能飘 1–5.5%，闸门就只在有缓存的机器上"确定"）+ **统一在 `prefers-reduced-motion` 下拍**——首页 hero 粒子每轮 IntersectionObserver 重启会补一个 0.05s 跳步，跳几次取决于截图前的真实窗口时间，实测 768 档在 0.00%↔0.35% 乱跳；`reduced` 是应用自己的一等渲染模式（`design.css:235`、`travel-notes.js:308`、`index.html` 的 `staticFrame()`），不是为测试造的假态。代价：动效路径不进像素基线，改由 hero 静帧墨量断言 + 真机人审覆盖）。改完 49 态连跑两遍**每态 0.00%**，阈值因此收成：普通页 0.1%、种子态 0.05%，**地图页 1% 的宽松特例已删**（拦网后十个地图态实测全 0.00%，那个 if 只是在给网络依赖留后门）。对照：旧阈值 0.5%/8% 下把 `--color-primary`（195 处引用）整体改色，49 张全绿。`--seed` 跑种子数据态（`test-data.js` 灌 8 条），`--reindex` 只重登记指纹。
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
- ⏳ 剩余改进项与节奏见 `改进实施方案与验收标准.md` §0.5 复核表与文末批次表（批次 0–2 已清，约 15.5 人日）
