/* 修复 parseOneLineRule：城市去后缀匹配 + 清理"加"字 */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!h.includes(from)) { console.log('SKIP', tag); return; }
  h = h.split(from).join(to); n++;
  console.log('OK  ', tag);
}
/* 1. NOISE 加 '加' */
rep(
  `var NOISE = ['我想', '我要', '帮我', '麻烦', '请', '添加', '加个', '加上', '新建', '记录', '收藏', '一个', '一处', '去', '在', '位于', '的', '景点', '地方', '打卡', '好去处', '吧', '啊', '呢', '。', '，', ',', '.', '！', '!', '？', '?', '推荐', '想去'];`,
  `var NOISE = ['我想', '我要', '帮我', '麻烦', '请', '添加', '加个', '加上', '新建', '记录', '收藏', '一个', '一处', '去', '在', '位于', '的', '景点', '地方', '打卡', '好去处', '吧', '啊', '呢', '。', '，', ',', '.', '！', '!', '？', '?', '推荐', '想去', '加'];`,
  '1 NOISE 加字'
);
/* 2. 城市匹配去后缀 */
rep(
  `    for (var i = 0; i < cities.length; i++) { if (s.indexOf(cities[i]) >= 0) { city = cities[i]; prov = provOf[city] || ''; s = s.split(cities[i]).join(' '); break; } }`,
  `    for (var i = 0; i < cities.length; i++) {
      var ci = s.indexOf(cities[i]);
      var cNorm = cities[i].replace(/[市州盟地区]$/, '');
      if (ci < 0 && cNorm !== cities[i]) ci = s.indexOf(cNorm);
      if (ci >= 0) {
        city = cities[i]; prov = provOf[city] || '';
        s = s.split(cities[i]).join(' ');
        if (cNorm !== cities[i]) s = s.split(cNorm).join(' ');
        break;
      }
    }`,
  '2 城市去后缀'
);
fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
console.log('patches:', n);
