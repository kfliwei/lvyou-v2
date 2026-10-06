# 批次 23 物证 · 真机视口归一与弹层右上角关闭（2026-10-06）

口径：**一加 Ace 6T / ColorOS，真机 CSS 视口 328×723**（`Override density 620` → `1272/(620/160)≈328`），
系统 `font_scale=1.35` 走 WebView textZoom、CSS 读不到。浏览器侧用注入
`html{font-size:calc(21.6px * var(--fs-bucket) * var(--fs-stage))}` 近似 textZoom135
（`--blink-settings=defaultFontSize` 会被 Chrome 忽略，实测 root 仍 15px）。

| 文件 | 是什么 | 谁拍的 |
|---|---|---|
| `b23-before-328135.png` | **改前形状**（真机现状档）：向导第 3 步，内存 DOM 里摘回裸 `.row` + 整串文案，第二枚 right=395 越出 328 视口 67px | `tools/out/probe23e-before-shape.js` |
| `b23-before-328100.png` | 改前形状 + textZoom 归一：right=324，**只剩 4px**（说明归一单独做不够） | 同上 |
| `b23-before-452135.png` | 改前形状 + 闸门主档放大：right=449，**只剩 3px** | 同上 |
| `b23-wiz-328135.png` | **改后**真机现状档：两枚按钮各 124px、段与段之间换行（「正序／从起点出发」），right=293、余量 35px | `tools/out/probe23c-wizard.js` |
| `b23-wiz-328100.png` | 改后 + textZoom 归一（修壳后的真机形状）：同上 | 同上 |
| `b23-wiz-452135.png` | 改后 + 主档放大：两枚各 186px，未换行 | 同上 |
| `b23-sheet-loc.png` | `#locSheet`（景点卡）右上角新 X：此前整张卡只有 `.sheet__handle` 一根拖拽条 | `tools/out/probe23d-sheetx.js` |
| `b23-sheet-info.png` | `#infoSheet`（地点详情）同一枚 X；底部四枚 `.is-btn` 的断字问题**本批未修**，登记在方案文档 11.7 | 同上 |

**复跑注意**：三支探针把截图写在 `tools/out/` 根（脚本里写死 `ROOT + 'tools/out/'`），
归位到这里要手动 `mv`；`tools/out/*.png` 不在 `.gitignore` 名单里，散在根目录会被 `git add` 顺手带进来。

**读数留档（文本）**：`tools/out/b23-probe23e-before.txt`、`b23-probe23c-after.txt`、`b23-probe23d-after.txt`、
`b23-overflow2.txt`（v2 普查，含「分母失守」自检行）、`b23-mut-verify37.txt`、`b23-mut-verify36-rerun.txt`、
`b23-smoke-aria.txt`。收工账见 `docs/功能完善实施方案-2026-10-05.md` 的「追加（批次 23）」。
