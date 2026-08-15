# 行迹 TRACE

一个**纯前端、移动优先的个人旅行记忆 App**：语音记录 → AI 润色 → 带坐标/天气/照片/原声的游记 → 地图落点 → 可导出的记忆与故事。

> 地图记录「我去哪里」；Memory 记录「我经历了什么」；Album 记录「这趟旅行对我意味着什么」。

## 核心能力

- 🎙 **语音游记**：说话即可记录，转写 + DeepSeek 润色，自动带坐标/天气/照片/原声，IndexedDB 本地持久化
- 🗺 **专题地图**：34 省 · 7833 个真实坐标节点，按省懒加载，主题/海拔/必去/网红筛选，实景照按需拉取
- ✍️ **对话式行程规划**（`planner.html`）：一句话「我想去川西玩 5 天」→ 真实节点召回 → 贪心排期 + 时间模型 + 季节校验 → 可拖拽调整 → 导航/导出/成册
- ⭐ **想去清单**：收藏 → 打卡 → 到达提醒，跨页面通用
- 📈 **旅程回顾**（`review.html`）：月历热力、年度报告、足迹海报、省份色块
- 📖 **成果工坊**：旅行纪念册 / 个人图鉴 / 定制路书 / 旅程故事 / GPX / HTML 长图
- 🏔 **专题预设路线**（长征 / 广西云南 / 青藏 / 山西古建）

## 架构

无构建、无框架，原生 HTML/CSS/JS，`file://` / HTTP（PWA）/ Android WebView 都能跑。

```
数据层   *-data.js（分省 window.SITES）· nation-index.js（7833 节点轻量索引）
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

无测试框架，验证套路：

```bash
node --check planner.js            # 独立 JS 语法
node tools/smoke-planner.js        # puppeteer 真实浏览器冒烟（需本机 Chrome）
node tools/smoke.js                # 全站页面冒烟
node tools/verify.js               # 编码/语法/残留 alert 检查
```

环境限制见 `docs/` 与项目记忆（模型读不了图，视觉验收交实机；无头 Chrome 深色不生效）。

## 里程碑（近期）

- ✅ M1 对话式行程规划（冷启动 / 召回 / 排期 / 季节校验 / AI 叙事 / 落地）
- ✅ M2 打磨（theme 归一收口 / full 档 AI 主解析 / 候选收敛）
- ✅ M3 记忆漏斗（开始旅行逐站打卡 / 一键成册 / 高德 POI 补位）
- ✅ 排期可编辑（上下移/移除/重新排期）、天数软约束、候选筛选、保存行程再编辑
