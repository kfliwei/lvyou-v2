/* 统计 top10 省份（竖线分隔文本） */
const fs = require('fs');
const raw = fs.readFileSync('nation-index.js', 'utf8');
const m = raw.match(/window\.NATION_SITES_RAW="([\s\S]*?)";/);
if (!m) { console.log('未找到'); process.exit(1); }
const lines = m[1].split('\n').filter(Boolean);
console.log('节点总数:', lines.length);
const cnt = {};
lines.forEach(l => { const p = l.split('|'); if (p.length >= 4) cnt[p[2]] = (cnt[p[2]] || 0) + 1; });
const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10);
top.forEach((t, i) => console.log((i + 1) + '. ' + t[0] + ' — ' + t[1] + ' 个景点'));
