/* 无障碍批量补齐：底导 aria / tabbar role / 图标容器 aria-hidden */
const fs = require('fs');
const files = fs.readdirSync('.').filter(f => /\.html$/.test(f) && !f.startsWith('test-'));

files.forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  let n = 0;

  /* 1. bottom-nav：导航语义 + 当前页 */
  s = s.replace(/<nav class="bottom-nav">/g, '<nav class="bottom-nav" aria-label="主导航">');
  s = s.replace(/(<a class="bottom-nav__item active"[^>]*)>/g, function (m, p) {
    n++;
    return p + ' aria-current="page">';
  });
  /* 2. tabbar（专题页 tab 组） */
  s = s.replace(/<div class="tabbar">/g, '<div class="tabbar" role="tablist" aria-label="页面视图">');
  s = s.replace(/(<button class="tabbar__btn"[^>]*)>/g, function (m, p) { n++; return p + ' role="tab">'; });
  s = s.replace(/(<div class="tabbar">[\s\S]*?)(<button)([^>]*data-tab)/g, function (m, a, b, c) {
    n++;
    return a + b + ' role="tab"' + c;
  });
  /* 3. 底导图标容器 aria-hidden（装饰图标） */
  s = s.replace(/(<span class="ic">)(<svg[\s\S]*?<\/svg>)(<\/span>)/g, function (m, a, b, c) {
    n++;
    return a + '<span aria-hidden="true">' + b + '</span>' + c;
  });

  if (n) {
    fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
    console.log(f.padEnd(22), '+', n, '处');
  }
});
console.log('=== a11y batch done ===');
