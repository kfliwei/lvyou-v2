# 批次 6 物证 · 状态三标准件（离线条 / 错误卡）

拍摄：`node tools/smoke-states.js`（2026-10-04 复跑，本目录文件即该轮产出）。脚本起本地 http 服务载真实页面，
`DispatchEvent` 派 `offline`/`online`，断言 DOM 可见性后截图；判定不靠肉眼，看 `tools/out/smoke-states-report.json`。

| 文件 | 证明的事 |
|---|---|
| `index/search/topic/wishlist/travel-map/planner/review/album.offline.png` | 8 核心页离线时底部单例离线条出现，文案含「离线」，位置在底部不遮页头 |
| `planner.ai-error.png` | planner AI 生成断网 + 拦 fetch 后，`UI.errorBox` 真落在 `#aiRouteOut`，含「重试」按钮 |

配套闸门：`verify.js §13`（状态矩阵常驻校验）+ §12 组件色对 8 组；行为断言 9/9 PASS。

## 为什么这批图之前不在仓库里

`.gitignore:48` 忽略 `tools/out/shots/*.png`——仓库惯例是**带日期目录**（`tools/out/shots/<日期>/`）才逐个 `git add`。
批次 6 把截图直接落在 `shots/` 根，于是"入库"这句自述当时是假的（批次 7-D 记同一口径的洞时才发现这边也中了）。
现已归位本目录并入库，同时把 `tools/smoke-states.js` 的 `OUT` 改成 `shots/<日期>-b6-states/`，让复跑自然落在可入库的位置。

## 免责

- 这些是浏览器态截图，不是真机 APK；真机离线/错误态仍待授权构建后抽查。
- 暗色主题在无头 Chrome 下不生效（本机环境限制），本目录只有亮色档。
