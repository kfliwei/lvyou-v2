/* 查所有 NATION_SITES_RAW 消费者与列解析 */
const fs = require('fs');
const files = ['planner.js', 'topic-common.js', 'explore-map.html', 'search.html', 'node-manager.html', 'wishlist.html', 'travel-map.html', 'ui.js', 'travel-notes.js', 'nation-lod.js', 'story.html', 'review.html'];
files.forEach(f => {
  try {
    const s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const lines = s.split('\n');
    lines.forEach((l, i) => {
      if (/NATION_SITES_RAW|split\('\|'\)/.test(l) && !l.trim().startsWith('//')) {
        console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 120));
      }
    });
  } catch (e) {}
});
/* parseIndex 列映射（planner.js） */
const p = fs.readFileSync('planner.js', 'utf8').replace(/\r\n/g, '\n');
const i = p.indexOf('function parseIndex');
if (i >= 0) console.log('--- planner parseIndex ---\n' + p.slice(i, i + 600));
