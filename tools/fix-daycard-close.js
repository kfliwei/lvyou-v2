/* 修正：day-card 闭合移到 stops 循环后（每张卡闭合，非仅最后一张） */
const fs = require('fs');
let s = fs.readFileSync('planner.js', 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

/* 1. 移除 days 后的错误闭合 */
const wrong = `    });
    h += '</div>'; /* 闭合 day-card（2026-08-15 修复：缺闭合导致卡片嵌套堆叠） */
    $id('resultBody').innerHTML = h;`;
const fixed = `    });
    $id('resultBody').innerHTML = h;`;
if (s.includes(wrong)) {
  s = s.split(wrong).join(fixed);
  console.log('错误闭合已移除');
} else console.log('SKIP wrong close');

/* 2. 在 stops 循环后加正确闭合 */
const anchor = `          '<button class="mv" aria-label="移除" onclick="window.plannerRemoveStop(' + di + ',' + si + ')">✕</button></div>';
      });
    });`;
const withClose = `          '<button class="mv" aria-label="移除" onclick="window.plannerRemoveStop(' + di + ',' + si + ')">✕</button></div>';
      });
      h += '</div>'; /* 闭合 day-card（2026-08-15） */
    });`;
if (s.includes(anchor)) {
  s = s.split(anchor).join(withClose);
  console.log('day-card 闭合已移入每日循环');
} else console.log('SKIP anchor');

fs.writeFileSync('planner.js', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
const vm = require('vm');
try { new vm.Script(fs.readFileSync('planner.js', 'utf8'), { filename: 'planner' }); console.log('SYNTAX OK'); }
catch (e) { console.log('ERR:', e.message.slice(0, 60)); }
