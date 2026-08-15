/* 修复：线路介绍 + 途经点弹窗 UI 统一到 v2 设计语言 */
const fs = require('fs');

/* 1. topic-common.js：线路头去掉大面积渐变，改主题色左边条 */
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "el.innerHTML = '<div class=\"rh\" style=\"background:linear-gradient(135deg,' + rt.color + ',' + rt.color + '99)\"><h3>' + rt.name + '</h3><p>⏱ ' + rt.days.length + ' 天 ｜ ' + total + ' 站 ｜ ' + rt.desc + '</p><div class=\"dkey\">🎨 每日轨迹色：' + keyHtml + '</div></div><div class=\"stops\">' + daysHtml + '</div>' +";
const to = "el.innerHTML = '<div class=\"rh\" style=\"border-left-color:' + rt.color + '\"><span class=\"rh-dot\" style=\"background:' + rt.color + '\"></span><h3>' + rt.name + '</h3><p>⏱ ' + rt.days.length + ' 天 ｜ ' + total + ' 站 ｜ ' + rt.desc + '</p><div class=\"dkey\"><span class=\"dkey-label\">每日轨迹色</span>' + keyHtml + '</div></div><div class=\"stops\">' + daysHtml + '</div>' +";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('OK   route header restyle');
} else console.log('SKIP route header');

/* 2. map.css：线路 + 途经点弹窗 v2 样式 */
let m = fs.readFileSync('map.css', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const block = `
/* ============================================================
   UI 一致性修复 2026-08-15：线路介绍 + 途经点随手记（统一到 v2 宣纸/朱砂体系）
   ============================================================ */
.route{background:var(--color-surface,#fffdf8);border:1px solid var(--color-line);border-radius:16px;box-shadow:0 8px 24px rgba(40,38,32,.07);margin-bottom:14px}
.route .rh{position:relative;padding:14px 15px;background:var(--color-surface,#fffdf8);color:var(--color-ink);border-bottom:1px solid var(--color-line);border-left:4px solid var(--color-primary,#c86d4b)}
.route .rh h3{margin:0;font-size:17px;font-family:var(--font-serif);color:var(--color-ink);letter-spacing:.03em;font-weight:600;display:flex;align-items:center;gap:8px}
.route .rh .rh-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.route .rh p{margin:6px 0 0;font-size:12px;color:var(--color-muted);font-family:var(--font-serif);line-height:1.7;opacity:1}
.route .rh .dkey{margin-top:9px;font-size:10.5px;color:var(--color-muted);display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-family:var(--font-sans)}
.route .rh .dkey .dkey-label{color:var(--color-faint);letter-spacing:.1em;margin-right:2px}
.route .daytip{font-size:12px;color:var(--color-ink-soft);margin:6px 2px 5px;line-height:1.7;background:var(--color-bg-soft,#efe9da);border-radius:10px;padding:7px 10px}
/* 途经点随手记弹窗（Leaflet popup） */
.trippop .leaflet-popup-content-wrapper{background:var(--color-surface,#fffdf8);border-radius:16px;border:1px solid var(--color-line);box-shadow:0 14px 40px rgba(40,38,32,.18);color:var(--color-ink)}
.trippop .leaflet-popup-tip{background:var(--color-surface,#fffdf8);border:1px solid var(--color-line)}
.trippop .leaflet-popup-content{margin:0;font-family:var(--font-sans)}
.trippop .pop{max-width:240px}
.trippop .pop b{display:block;font-family:var(--font-serif);font-size:15px;font-weight:600;color:var(--color-ink);padding:12px 14px 2px;letter-spacing:.04em}
.trippop .pm{font-size:11px;color:var(--color-muted);padding:2px 14px;line-height:1.6;font-family:ui-monospace,Consolas,monospace}
.trippop .pm.pa{font-size:12px;font-family:var(--font-sans);color:var(--color-ink-soft);padding-top:4px}
.trippop .pfoot{padding:10px 14px 14px;border-top:1px solid var(--color-line);margin-top:8px}
.trippop .addtrip.tnvo{background:var(--color-primary,#c86d4b);color:#fff;border:0;border-radius:999px;min-height:42px;padding:0 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-sans);width:100%}
.theme-dark .route{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .route .rh{background:var(--color-surface);border-bottom-color:var(--color-line)}
.theme-dark .route .rh h3{color:var(--color-ink)}
.theme-dark .route .rh p{color:var(--color-ink-soft)}
.theme-dark .trippop .leaflet-popup-content-wrapper{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .trippop .leaflet-popup-tip{background:var(--color-surface)}
`;
if (!m.includes('UI 一致性修复 2026-08-15')) {
  fs.writeFileSync('map.css', mcrlf ? (m + block).replace(/\n/g, '\r\n') : m + block, 'utf8');
  console.log('OK   map.css v2 styles');
} else console.log('SKIP map.css (exists)');
