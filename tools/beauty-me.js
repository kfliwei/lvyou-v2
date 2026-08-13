/* me.html：入口图标 emoji → SVG 线性图标 */
const fs = require('fs');
let s = fs.readFileSync('me.html', 'utf8');
const pairs = [
  ['<span class="ic">🏅</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 L7 21 L12 18.5 L17 21 L15.5 13.5"/></svg></span>'],
  ['<span class="ic">🗺️</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 19 C6 15 8 15 10 19 C12 15 14 15 16 19"/><path d="M4 6 C6 3 8 3 10 6 C12 3 14 3 16 6"/></svg></span>'],
  ['<span class="ic">📖</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 4 H19 V20 H5 Z"/><path d="M8 8 H16 M8 12 H16 M8 16 H13"/></svg></span>'],
  ['<span class="ic">⭐</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 L14.8 8.9 L21 9.6 L16.5 13.8 L17.6 20 L12 16.9 L6.4 20 L7.5 13.8 L3 9.6 L9.2 8.9 Z"/></svg></span>'],
  ['<span class="ic">🔍</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16 L21 21"/></svg></span>'],
  ['<span class="ic">📌</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 8 V16 M8 12 H16"/></svg></span>'],
  ['<span class="ic">⚙️</span>', '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M18.4 5.6 L17 7 M7 17 L5.6 18.4"/></svg></span>']
];
let n = 0;
pairs.forEach(function (p) {
  if (s.includes(p[0])) { s = s.split(p[0]).join(p[1]); n++; }
});
fs.writeFileSync('me.html', s, 'utf8');
console.log('replaced', n, '/ 7');
