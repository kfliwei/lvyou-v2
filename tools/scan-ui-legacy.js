/* UI 一致性全面扫描：旧版 v1 令牌 + 硬编码颜色残留 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* v1 旧令牌（v2 已用 var(--color-*) 体系） */
const OLD_TOKENS = [
  '--teal-', '--cinnabar-', '--paper-', '--ink-', '--gold-', '--surface-',
  '--sh-', '--sp-', '--font-display', '--dur-', '--ease-'
];
/* 硬编码浅底（应走 var(--color-surface)） */
const HARD_BG = ['#fff', '#FFF', '#FAF8F3', '#faf8f3', 'rgba(255,255,255', 'rgba(250,248,243'];

const files = fs.readdirSync(ROOT).filter(f => /\.(html|css|js)$/.test(f) && !f.startsWith('test-'));
const report = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const counts = {};
  let hard = 0;
  for (const tk of OLD_TOKENS) {
    const c = (s.match(new RegExp(tk.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
    if (c) counts[tk] = c;
  }
  /* 硬编码背景：排除注释/var 定义处粗判 */
  for (const hb of HARD_BG) {
    const c = (s.match(new RegExp(hb.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
    if (c) hard += c;
  }
  if (Object.keys(counts).length || hard) report.push({ f, counts, hard });
}
report.sort((a, b) => (Object.values(b.counts).reduce((x, y) => x + y, 0) + b.hard) - (Object.values(a.counts).reduce((x, y) => x + y, 0) + a.hard));
for (const r of report) {
  const tok = Object.entries(r.counts).map(([k, v]) => k + '×' + v).join(' ');
  console.log(r.f.padEnd(22), '| 旧令牌:', tok || '-', '| 硬编码底:', r.hard);
}
