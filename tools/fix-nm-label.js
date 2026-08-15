/* node-manager 用户节点标记加名称标签（esc 留给页面运行时） */
const fs = require('fs');
let s = fs.readFileSync('node-manager.html', 'utf8');
const from = '<span class="node-num" style="background:#5F7A4E">我</span></div>\', iconSize: [30, 30], iconAnchor: [15, 15] })';
const to = '<span class="node-num" style="background:#5F7A4E">我</span><span class="node-label" style="opacity:.85">\' + esc(u.name) + \'</span></div>\', iconSize: [30, 30], iconAnchor: [15, 15] })';
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('node-manager.html', s, 'utf8');
  console.log('OK user marker label');
} else console.log('miss');
