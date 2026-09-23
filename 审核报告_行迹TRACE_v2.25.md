# 行迹 TRACE v2.25 · 功能与 UI 架构测评报告

> 审查维度：**产品功能 + UI 设计系统 + 前端架构**（综合走查）
> 审查对象：14 个页面 + 6 个核心 JS 引擎 + design.css/map.css + sw.js + Android 壳配置
> 审查日期：2026-08-23
> 方法：全量代码走读 + 交叉验证（未做真机动态测试，视觉结论以代码为准）

---

## 一、总评

**这是一个完成度远超典型个人项目的产品。**「语音记录 → 规划 → 打卡 → 回顾 → 成册 → 导出」的闭环是完整的，且历史建议（底部导航、真实驾车路径、备份闭环、旅行画像、空状态、骨架屏）**全部已落地**。核心约定（`Geo.hav` 唯一距离源、`window.Ai` 唯一 AI 入口、主题归一 `tk()`）在代码里确实守住了，没有发现绕过入口的重复实现。

主要短板集中在**工程侧的"沉积层"**：CSS 靠补丁层叠加、页面手写重复 HTML、tools/ 里 500+ 个一次性脚本、SW 预缓存清单漂移。产品在往前跑，但地基的维护成本在悄悄上升。

| 维度 | 评分 | 一句话 |
|---|---|---|
| 产品功能完整度 | **8.5** | 闭环完整，主动式体验（到达提醒/附近打卡/备份提醒）超出预期 |
| 架构健康度 | **6.0** | 核心约定优秀；单体 JS、手写重复 HTML、工具脚本沉积拖后腿 |
| 设计系统成熟度 | **7.0** | 令牌体系真实可用；但三代令牌并存、emoji/SVG 混用、页面私有组件类分叉 |
| 深色模式 | **6.5** | 覆盖广（229 条补丁规则）但架构是"覆盖式"而非"令牌式"，脆弱 |
| 数据安全 | **7.5** | IDB 迁移框架 + 降级回退 + 备份闭环，是同类应用的良心水准 |
| 性能 | **6.5** | 分省懒加载好；规划页同步加载 1.4MB 索引、照片 base64 内嵌是隐患 |

---

## 二、P1 发现（建议尽快修）

### 1. design.css:150 注释未闭合，四个动效令牌定义被吞 ⭐

`--tn` 行（design.css:150）的注释少写 `*/`，导致 `--ease-soft`、`--duration-fast/normal/slow`（design.css:151-154）全部变成死代码——注释一直延伸到 design.css:156 的下一个 `*/` 才闭合。

全站 **24 处**引用这些令牌（design.css / map.css / index.html / travel-map.html / explore-map.html / settings.html / md-manager.html），相关 transition 全部静默失效。

这大概率是上次 "esc 事故"（commit f63b1ae 提到的 git checkout 误伤）的遗留伤。**修复只需补一个 `*/`。**

### 2. sw.js 预缓存清单与实际依赖漂移

- `nav.js` **不在** SHELL 里（sw.js:6-98）——全局导航组件，离线首开可能缺失
- `topic-meta-lite.js` 不在——search.html 已预缓存但其依赖没缓存，离线打开搜索页会挂
- `site-images.js`、`tn-key.js` 同样缺失
- 反而把测试页 `test-data.html`（sw.js:17）预缓存进了生产包
- `CACHE='trace-v22'` 与应用版本 2.25 脱钩

tools/ 里已有 `gen-sw-shell.cjs`，说明清单本可生成——建议把「发版必跑 gen-sw-shell + bump CACHE」固化进 `bump-version.js` 流程。

### 3. me.html:103 省份清单硬编码 31 个，与全站「34 省」矛盾 ⭐

港澳台不在清单里：用户去了香港/澳门/台湾，「省份足迹」永远不点亮，统计上限写死 `X / 31`。而 explore-map.html 明明有港/澳/台入口。数据口径不一致是信任性问题。

### 4. explore-map.html 34 个手写 `<a class="story-item">` 块，与 index.html 是两份手工维护副本

~150 行重复 HTML；`TOPIC_REGISTRY`（topic-meta.js）里数据都在，却没用来渲染列表。已出现漂移迹象：

- 每条的「四百余处 / 九条路线」文案写死，节点库增长后会过期
- index.html 用 topic-counts.js 动态算数量、explore-map.html 写死——同一数据两种口径
- index 展示 8 个精选、explore 列全部，文案各维护一份

**建议：两页列表都改为由注册表数据驱动生成，一处维护。**

### 5. planner.html:214 同步加载 nation-index.js（1.4MB）

`<script src="nation-index.js">` 在 planner.js 之前同步执行，7833 节点解析压在首屏关键路径上。建议改为 `defer` 或在进入「候选召回」阶段前异步加载（topic.html:144-153 已有懒加载先例可复用）。

---

## 三、P2 发现（择机处理）

| # | 位置 | 问题 |
|---|---|---|
| 6 | index.html:205-214 | 两套重复空状态（`tripEmpty` 与 `tripbarEmpty`），前者生效后者是死标记；index.html:533 与 :567 **出现两个 `</body>`**（脚本被拼在了 body 外） |
| 7 | index.html:517-531 / topic.html:164-178 | 「附近想去打卡」横幅代码逐字重复两份（含写死的 `#C86D4B`），应收敛到 wishlist.js 或 ui.js 共享函数 |
| 8 | 全站 | **emoji 与线性 SVG 图标混用**：🔍📍🧭✍️⭐✨👁▶（planner/topic/explore-map）+ 引导页 🗺️🎙️⭐。SVG 图标语言很精致，emoji 一出现气质就断。统一替换为现有 SVG 描边风格 |
| 9 | planner.html:64 / design.css:1082 | 引用了不存在的令牌：`--color-gold`（永远走 fallback `#BA7517`）、`--color-danger`（同）。另 design.css:55 `--danger-500` 与主色**同值**（#C86D4B）——删除等破坏性操作与主 CTA 无视觉区分，danger 应独立成色 |
| 10 | design.css:930-1054 / map.css | 深色模式 = 149+80 条「补丁规则」逐个覆盖页面内联样式。现在能用（`.search-panel` 等都有补丁），但**每新增一处内联浅色样式就要补一条规则**，漏一条破一条。建议高流量页面（index/travel-map）内联样式逐步迁令牌，补丁层只做兜底 |
| 11 | travel-notes.js:1147-1168 | 照片/原声以 base64 内嵌游记记录：IDB 里可行，但 localStorage 兜底库（`travelNotes`）会瞬间爆 5MB 配额，JSON 备份文件也异常巨大。建议媒体拆独立 blob store，记录里存引用 |
| 12 | tools/ | **~500 个一次性脚本**（add-\*/fix-\*/diag-\*/probe-\*/check-\*/desc-patches-\*）全部在仓库里，是「AI 逐个打补丁」开发模式的地层堆积。保留活水（smoke.js、smoke-planner.js、verify.js、bump-version.js、gen-sw-shell.cjs、scan-dark-residue.js 等 ~10 个），其余移入 `tools/archive/` |
| 13 | 仓库根目录 | 两个 39MB APK、6 张调试截图（\_color\_\*.png / \_edit\_\*.png）、`=` 空文件都**被 git 追踪**。APK 入库让仓库膨胀 80MB+，建议 `.gitignore` + `git rm --cached`，发布物放 releases/ |
| 14 | topic.html:130 | 未知专题错误分支 `innerHTML = '未知专题：' + p` 直接拼 URL 参数（自注入型 XSS，个人自用风险低，顺手改 textContent） |
| 15 | travel-notes.js:189 | `uid() = 'tn_' + Date.now()`，同毫秒保存两条会撞 id，加随机后缀即可 |
| 16 | 全部页面 | `user-scalable=no` + 首页 CTA 是 `role="button"` 的 span 但无键盘事件。自用可接受，日后分发建议放开缩放 |
| 17 | topic.html:112-123 | 版本参数混乱：大部分脚本带 `?v=20260822`，`geo.js`、`design.css` 不带；其他页面全不带。SW 已做 SWR，建议统一去掉手写 `?v=`（Android file:// 场景靠版本号清缓存） |

---

## 四、亮点（值得保持的设计决策）

1. **AI 与规则分离的架构纪律**（README 承诺，代码兑现）：无 Key 全流程可跑，AI 只做叙事/意图增强，`Ai.chat` 统一模型别名——整个产品最正确的决定
2. **travel-notes.js:86-144 数据层**：IDB 版本迁移框架（「勿改历史函数」注释）+ 增量写回 + localStorage 降级，成熟度高于多数商业 PWA
3. **planner.js:700-740 真实路径**：高德驾车路径 + localStorage 距离缓存 + 无 Key 优雅回退 haversine×1.35
4. **album.js**：独立 IDB（trace-albums）零侵入主库，还处理了「store 缺失自动重建」脏状态（album.js:38-40）
5. **vault.js**：手写 ZIP writer + MD/HTML 导出 + Android 桥落盘，零依赖完成导出矩阵
6. **sw.js 缓存策略**：瓦片缓存带 800 条上限裁剪、页面 network-first、静态 SWR——选型全部正确
7. **无障碍基础在**：`prefers-reduced-motion`（design.css:203）、`:focus-visible`、rem 根字号三档缩放、新模块 esc() 转义纪律

---

## 五、建议行动顺序

1. **本周可做（<1h）**
   - [ ] 修 design.css:150 注释闭合
   - [ ] 补 sw.js SHELL（nav.js / topic-meta-lite.js / site-images.js，去掉 test-data.html）
   - [ ] me.html 省份清单补港澳台
   - [ ] 清理 index.html 双 `</body>` 和死空状态块
2. **短期（半天）**
   - [ ] explore-map / index 列表改注册表数据驱动
   - [ ] planner 的 nation-index 异步化
   - [ ] 附近打卡横幅收敛为共享函数
   - [ ] emoji 换 SVG 图标
3. **中期（择机）**
   - [ ] 照片迁移出 base64
   - [ ] tools/ 归档清理
   - [ ] APK/截图移出 git
   - [ ] 深色补丁层逐步令牌化
4. **发版流程固化**
   - [ ] bump-version 时同步跑 `gen-sw-shell.cjs` + SW CACHE 版本号，消除三处版本号手工同步（build.gradle / sw.js / topic.html ?v=）

---

*审核人：ox-alpha（架构审查）*
*说明：本报告基于静态代码审查，未执行真机动态测试；深色模式残留以代码推断为主，最终视觉验收建议实机过一遍 index/travel-map/planner 三页。*

---

## 六、修复记录（2026-08-23）

### ✅ 已修复（14/17 项）

| # | 项 | 状态 |
|---|---|---|
| P1-1 | design.css:150 注释闭合 + 补回 `--sm` 定义 | ✅ 已修 |
| P1-2 | sw.js SHELL 补 nav.js / topic-meta-lite.js / site-images.js / tn-key.js / topic-catalog.js，移除 test-data.html，CACHE bump v23 | ✅ 已修 |
| P1-3 | me.html 省份清单补港澳台，统计上限改 `/34` | ✅ 已修 |
| P1-4 | 新建 `topic-catalog.js` 唯一目录数据源；explore-map（全量 36 条）与 index（精选 8 条）列表均改为数据驱动渲染，删除 ~150 行手写重复 HTML | ✅ 已修 |
| P1-5 | planner 的 nation-index.js(1.4MB) 改 `defer` 加载（与 planner.js 保序 defer，不阻塞解析；planner 初始化挂在 DOMContentLoaded，已验证安全） | ✅ 已修 |
| P2-6 | index.html 删除死空状态 `tripbarEmpty` 及其 JS 引用；消除双 `</body>`（尾脚本归位 body 内） | ✅ 已修 |
| P2-7 | 「附近打卡横幅」收敛为 `Wish.nearbyNudge()` 共享函数（wishlist.js），index/topic 两处调用点替换；顺带修复 label 拼 HTML 的注入隐患（textContent） | ✅ 已修 |
| P2-8 | emoji → 线性 SVG：topic 搜索框/路线选择/选点提示、planner 种子卡/浏览/排期按钮、explore 搜索条、index 引导页三步图标 | ✅ 已修 |
| P2-9 | 补定义缺失令牌 `--color-gold` / `--color-danger`（含深色变体）；danger 采用独立砖红 #B34A3F，不再与主色同值 | ✅ 已修 |
| P2-12 | tools/ 归档 459 个一次性脚本至 `tools/archive/`（已 gitignore），保留 17 个活水脚本（smoke-*/verify/bump/gen-sw-shell/gen-counts/scan-dark-residue/touch-targets/sync-assets/check-topic-catalog） | ✅ 已修 |
| P2-13 | 6 张调试截图 `git rm --cached` 解除跟踪（文件保留磁盘）；.gitignore 补 `_*.png`、`/=`、`tools/archive/`。注：APK 实际未被 git 跟踪，无需处理 | ✅ 已修 |
| P2-14 | topic.html 未知专题错误分支 innerHTML → textContent（消除 URL 参数注入面） | ✅ 已修 |
| P2-15 | travel-notes.js uid() 加随机后缀防同毫秒碰撞 | ✅ 已修 |
| P2-16 | 全站 15 个页面移除 `user-scalable=no`（放开捏合缩放）；index 增加 role=button 元素的 Enter/Space 键盘激活支持 | ✅ 已修 |
| P2-17 | topic.html 全部 `?v=20260822` 手写版本参数清除（SW SWR 已覆盖更新场景） | ✅ 已修 |

### ⏸ 暂缓（3/17 项，附原因）

| # | 项 | 原因与建议 |
|---|---|---|
| P2-10 | 深色模式补丁层令牌化 | 属架构演进而非单点修复：现有 229 条补丁规则实际工作正常，盲目迁移内联样式反而有视觉回归风险（无真机验收条件）。建议按「新增样式一律走令牌、高流量页面逐页迁移」推进，每迁一页过一次实机深色验收 |
| P2-11 | 照片 base64 迁独立 blob store | 触碰 travel-notes.js 持久化核心 + vault 导出 + album 读取 + 备份兼容四条链路，需专门的迁移会话 + 真机验证（旧数据升级路径），不适合盲改 |
| P2-16 部分 | 首页 bootSplash 固定 900ms | 属产品节奏取舍（品牌闪屏），未动 |

### 验证结果

```
node --check sw.js / wishlist.js / travel-notes.js / topic-catalog.js   → 全部通过
node tools/verify.js                                                    → ALL CHECKS PASSED
node tools/smoke.js（真实浏览器全站冒烟）                                → SMOKE ALL PASSED
```

### 追加修复（2026-08-23 同日晚）

| # | 问题 | 修复 |
|---|---|---|
| 补1 | `file://` 双击打开时 manifest 被 CORS 拦截报 3 条控制台错误 | 16 个页面删除静态 `<link rel="manifest">`，改为 theme.js 仅在 http(s) 下动态注入（PWA 行为不变） |
| 补2 | travel-map 页面内容超宽需左右划；且其「随手记/游记」面板比 topic 页同款面板宽 | 实测根因：页面某元素把布局视口从 390 撑到 418px（放开 user-scalable=no 后 Chrome 改为扩张视口适配超宽内容），fixed 面板跟随变宽。修复：`html,body{overflow-x:clip}` 硬保险 + `.emptyTip` 空状态卡（唯一默认渲染的 nowrap 悬浮块）改为左右定位内换行。用户实机确认恢复正常 |

### 最终验证

```
node tools/smoke.js → SMOKE ALL PASSED（含 theme.js/travel-notes.js/travel-map.html 全部改动后）
```

### 遗留提示

- explore-map 与 index 的专题文案已统一为 explore 版（更详细），index 卡片标题因此略长于原版（如「红军长征」→「红军长征路线地图」），如介意可在 topic-catalog.js 为 feat 项加短标题字段
- nation-index 实测 7851 节点，README/页面写死的「7833 处」文案已过期，后续可改为构建期生成
- 本轮改动未提交 git，建议先真机过一遍 index / explore-map / planner / topic 四页后再 commit
- 其他页面若再出现「面板比别页宽」，用同一招排查：控制台列超宽元素（布局视口被撑宽 → fixed 面板跟着变宽）
