/* 4b 精确插入：ls-loc 整行后加天气行 */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "      '<div class=\"ls-loc\">' + (M.themeIcons[tk(s)] || '') + ' ' + esc(tk(s)) + ' · ' + esc(s.region) + esc(s.city) + (s.county ? (' · ' + esc(s.county)) : '') + '</div>' +";
const to = from + "\n      '<div class=\"ls-weather\" id=\"lsWeather\" style=\"display:none;font-size:12px;color:var(--color-muted);margin-bottom:8px\"></div>' +";
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('4b ok');
} else console.log('miss');
