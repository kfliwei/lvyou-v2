/* go 按钮分流（实际绑定点 go.onclick = run） */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
const from = `    go.onclick = run;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });`;
const to = `    go.onclick = function () {
      var t = (input.value || '').trim();
      if (/(我想|我要|帮我|加个|加上|添加|新建|记录一下|想去)/.test(t)) oneLineAdd(t); else run();
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var t = (input.value || '').trim(); if (/(我想|我要|帮我|加个|加上|添加|新建|记录一下|想去)/.test(t)) oneLineAdd(t); else run(); } });`;
if (h.includes(from)) {
  h = h.split(from).join(to);
  fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
  console.log('go 分流完成');
} else console.log('miss');
