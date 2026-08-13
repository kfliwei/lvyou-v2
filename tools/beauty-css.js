/* 追加美化基础块到 design.css */
const fs = require('fs');
const p = 'design.css';
let s = fs.readFileSync(p, 'utf8');
const block = `
/* ============================================================
   美化推进 2026-08-13：设计令牌 / 动效节奏 / 玻璃拟态 / 启动遮罩
   ============================================================ */
:root{
  --radius-sm:10px;--radius-md:14px;--radius-lg:18px;--radius-xl:24px;
  --dur-fast:.18s;--dur-norm:.3s;--dur-slow:.6s;
  --ease-spring:cubic-bezier(.34,1.56,.64,1);
  --fs-xs:.6875rem;--fs-sm:.8125rem;--fs-md:.9375rem;--fs-lg:1.125rem;--fs-xl:1.5rem;--fs-2xl:2rem
}
/* 列表 stagger 入场 */
@keyframes fadeStagger{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade-stagger>*{opacity:0;animation:fadeStagger .5s var(--ease-standard) forwards}
.fade-stagger>*:nth-child(1){animation-delay:.03s}
.fade-stagger>*:nth-child(2){animation-delay:.07s}
.fade-stagger>*:nth-child(3){animation-delay:.11s}
.fade-stagger>*:nth-child(4){animation-delay:.15s}
.fade-stagger>*:nth-child(5){animation-delay:.19s}
.fade-stagger>*:nth-child(6){animation-delay:.23s}
.fade-stagger>*:nth-child(7){animation-delay:.27s}
.fade-stagger>*:nth-child(8){animation-delay:.31s}
/* 底部 Sheet 弹性弹出 */
#locSheet.show,#infoSheet.show,#rsSheet.show{transition:transform .55s var(--ease-spring)}
/* 地图浮层玻璃拟态（图例/图层菜单/聚合胶囊） */
.legend,.laymenu{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:rgba(250,248,243,.82)!important}
.theme-dark .legend,.theme-dark .laymenu{background:rgba(29,28,25,.82)!important}
/* 启动遮罩（品牌首印象：印章 + 品牌字） */
#bootSplash{position:fixed;inset:0;z-index:9999;background:var(--color-bg,#f6f3ec);display:grid;place-items:center;transition:opacity .5s ease}
#bootSplash.hide{opacity:0;pointer-events:none}
#bootSplash .bs-seal{width:78px;height:78px;border-radius:22px;background:var(--color-primary,#c86d4b);color:#fff;display:grid;place-items:center;font-family:var(--font-serif,serif);font-size:40px;box-shadow:0 16px 44px rgba(200,109,75,.38);animation:bsBreath 2.2s ease-in-out infinite}
#bootSplash .bs-name{margin-top:20px;font-family:var(--font-serif,serif);font-size:20px;letter-spacing:.34em;color:var(--color-ink,#26241f);padding-left:.34em}
#bootSplash .bs-sub{margin-top:8px;font-size:11px;letter-spacing:.22em;color:var(--color-muted,#8c877d);text-transform:uppercase}
@keyframes bsBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
/* 主题分类 emoji 图标承载样式 */
.theme-ic{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;background:var(--color-bg-soft,#efe9da);font-size:13px;line-height:1}
`;
if (!s.includes('美化推进 2026-08-13')) {
  fs.writeFileSync(p, s + block, 'utf8');
  console.log('beauty block added');
} else {
  console.log('exists');
}
