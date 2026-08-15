/* 补：story-bar 深色适配（历史遗漏） */
const fs = require('fs');
let d = fs.readFileSync('design.css', 'utf8');
const crlf = d.includes('\r\n');
if (crlf) d = d.replace(/\r\n/g, '\n');
const add = '\n/* story-bar 深色（2026-08-15 补漏） */\n.theme-dark .story-bar{background:rgba(29,28,25,.92);border-bottom-color:var(--color-line)}\n.theme-dark .story-bar .back{background:var(--color-bg-soft);border-color:var(--color-line);color:var(--color-ink)}\n.theme-dark .story-bar .title{color:var(--color-ink)}\n.theme-dark .story-bar select{background:var(--color-surface);border-color:var(--color-line);color:var(--color-ink)}\n';
if (!d.includes('.theme-dark .story-bar{background')) {
  fs.writeFileSync('design.css', crlf ? (d + add).replace(/\n/g, '\r\n') : d + add, 'utf8');
  console.log('story-bar dark added');
} else console.log('exists');
