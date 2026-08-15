/* 全局 Leaflet popup 统一 + index hero 搜索深色覆盖 */
const fs = require('fs');

/* 1. map.css：全局 popup v2 化（覆盖 7 处 bindPopup，trippop 特异规则仍生效） */
let m = fs.readFileSync('map.css', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const block = `
/* ============================================================
   Leaflet 弹窗全局统一 2026-08-15（覆盖全部 bindPopup：宣纸卡 + 16px 圆角）
   ============================================================ */
.leaflet-popup-content-wrapper{background:var(--color-surface,#fffdf8);border-radius:16px;border:1px solid var(--color-line);box-shadow:0 14px 40px rgba(40,38,32,.18);color:var(--color-ink)}
.leaflet-popup-tip{background:var(--color-surface,#fffdf8);border:1px solid var(--color-line)}
.leaflet-popup-content{margin:12px 14px;font-family:var(--font-sans);font-size:13px;line-height:1.7;color:var(--color-ink)}
.leaflet-popup-content b{color:var(--color-ink)}
.leaflet-popup-close-button{color:var(--color-muted)!important;font-size:16px!important}
.theme-dark .leaflet-popup-content-wrapper{background:var(--color-surface);border-color:var(--color-line)}
.theme-dark .leaflet-popup-tip{background:var(--color-surface)}
`;
if (!m.includes('Leaflet 弹窗全局统一 2026-08-15')) {
  fs.writeFileSync('map.css', mcrlf ? (m + block).replace(/\n/g, '\r\n') : m + block, 'utf8');
  console.log('OK   popup global v2');
} else console.log('SKIP popup (exists)');

/* 2. index hero 搜索深色覆盖（design.css） */
let d = fs.readFileSync('design.css', 'utf8');
const dcrlf = d.includes('\r\n');
if (dcrlf) d = d.replace(/\r\n/g, '\n');
if (!d.includes('.theme-dark .hero__search')) {
  const add = '\n.theme-dark .hero__search{background:rgba(32,32,29,.55);border-color:rgba(255,255,255,.1)}\n.theme-dark .hero__search input{color:var(--color-ink)}\n.theme-dark .hero__search input::placeholder{color:var(--color-muted)}\n';
  fs.writeFileSync('design.css', dcrlf ? (d + add).replace(/\n/g, '\r\n') : d + add, 'utf8');
  console.log('OK   hero search dark');
} else console.log('SKIP hero search dark (exists)');
