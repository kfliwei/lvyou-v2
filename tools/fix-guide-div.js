/* 清理 tnGuide div（按 id 定位整块删除，含注释标记） */
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
s = s.replace(/\r\n/g, '\n');
const start = '<!-- 首启引导 -->\n<div id="tnGuide"';
const i = s.indexOf(start);
if (i < 0) { console.log('guide div start not found'); process.exit(0); }
/* 结构：<div id="tnGuide" ...>\n  <div 卡片>\n    <div id="gStep"...>...</div>\n    ...\n  </div>\n</div> */
/* 找 gActs 按钮区结束后的连续两个 </div> */
const gActs = s.indexOf('id="gNext"', i);
if (gActs < 0) { console.log('gNext not found'); process.exit(0); }
/* 从 gNext 按钮行末尾开始找 3 个连续的 </div>（按钮 div、acts div、卡片 div、tnGuide div = 4 层但按钮行本身含 </button></div>） */
const seg = s.slice(i);
/* 简化：找到 gNext 按钮行的结束 </button>\n    </div>\n  </div>\n</div> */
const btnEnd = seg.indexOf('</button>', seg.indexOf('id="gNext"'));
if (btnEnd < 0) { console.log('btnEnd not found'); process.exit(0); }
const closeSeq = '\n    </div>\n  </div>\n</div>\n';
const after = seg.slice(btnEnd + '</button>'.length);
const closeIdx = after.indexOf(closeSeq);
if (closeIdx < 0) { console.log('close seq not found'); process.exit(0); }
const block = seg.slice(0, btnEnd + '</button>'.length + closeIdx + closeSeq.length);
/* 安全校验 */
if (!block.includes('tnGuide') || !block.includes('gSkip')) { console.log('block mismatch, abort'); process.exit(1); }
s = s.slice(0, i) + s.slice(i + block.length);
/* 清理多余空行 */
s = s.replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('index.html', s, 'utf8');
console.log('tnGuide div removed, len:', block.length);
