/* B3：润色无 Key 出口友好化 + B2：food 杂志式 UI 样式 */
const fs = require('fs');

/* B3 travel-notes：无 key 不再强制跳设置 */
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "    if (!key) { openSettings(); flash('请先在设置页配置 DeepSeek API Key（platform.deepseek.com 免费申请，粘贴 sk- 开头密钥）'); return; }";
const to = "    if (!key) { flash('未配置 AI Key：可直接保存原文；或到设置页配置 DeepSeek Key 后再润色'); return; }";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('B3 polish exit ok');
} else console.log('SKIP B3');

/* B2 map.css：food 杂志式 */
let m = fs.readFileSync('map.css', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const block = `
/* ============================================================
   food 杂志式 UI 2026-08-15（编辑精选风：渐变封头 + 衬线大标题 + 引语）
   ============================================================ */
.fcard{border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(40,38,32,.07);border:1px solid var(--color-line);background:var(--color-surface);margin-bottom:14px;transition:transform .2s var(--ease-standard)}
.fcard:active{transform:scale(.985)}
.fcard .fh{display:flex;align-items:center;gap:7px;padding:14px 14px 8px;background:linear-gradient(135deg,rgba(200,109,75,.14),rgba(200,109,75,.03))}
.fcard .fic{font-size:22px}
.fcard .ft{font-size:10px;color:#fff;border-radius:999px;padding:2px 10px;font-weight:600;letter-spacing:.05em}
.fcard .fn{font-weight:400;font-size:19px;margin:6px 14px 0;font-family:var(--font-serif);color:var(--color-ink);letter-spacing:.02em}
.fcard .floc{font-size:11px;color:var(--color-muted);margin:4px 14px 0;font-family:var(--font-sans)}
.fcard .fdesc{font-size:13px;color:var(--color-ink-soft);margin:10px 14px 0;line-height:1.75;padding-left:10px;border-left:2px solid rgba(200,109,75,.35);font-family:var(--font-serif)}
.fcard .fmore{font-size:12px;color:var(--color-primary-dark);margin:10px 14px 4px;font-weight:600}
.fcard .fdetail{font-size:12.5px;color:var(--color-muted);margin:2px 14px 10px;line-height:1.7;background:var(--color-bg-soft);border-radius:10px;padding:10px 12px;display:none}
.fcard .fgo{min-height:42px;margin:4px 14px 14px;width:calc(100% - 28px);border:0;border-radius:999px;background:var(--color-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-sans)}
`;
if (!m.includes('food 杂志式 UI 2026-08-15')) {
  fs.writeFileSync('map.css', mcrlf ? (m + block).replace(/\n/g, '\r\n') : m + block, 'utf8');
  console.log('B2 food magazine css ok');
} else console.log('SKIP B2 (exists)');
