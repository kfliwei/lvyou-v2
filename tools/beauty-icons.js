/* 美化：index 启动遮罩+季节卡 / search mic SVG / node-manager 菜单详情 SVG */
const fs = require('fs');

/* ===== index.html ===== */
let s = fs.readFileSync('index.html', 'utf8');
let n = 0;
function repIdx(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP index:' + tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK   index:' + tag);
}
/* 启动遮罩（body 后） */
repIdx(
  '<body>\n<div class="app-page"',
  '<body>\n<div id="bootSplash" aria-hidden="true"><div class="bs-seal">迹</div><div class="bs-name">行迹 TRACE</div><div class="bs-sub">My Journey Map</div></div>\n<div class="app-page"',
  'boot splash html'
);
/* 启动遮罩移除脚本（最后一个 </script> 前插入——用 </body> 前） */
repIdx(
  '</body>\n\n<script>\n/* 首启引导（3 步，一次性，可跳过） */',
  '<script>\n/* 启动遮罩淡出 */\n(function(){var bs=document.getElementById(\'bootSplash\');if(!bs)return;var t=setTimeout(function(){bs.classList.add(\'hide\');setTimeout(function(){bs.remove();},600);clearTimeout(t);},900);})();\n</script>\n</body>\n\n<script>\n/* 首启引导（3 步，一次性，可跳过） */',
  'boot splash hide script'
);
/* 季节卡片：编号圆升级为水墨渐变 + 按压反馈 */
repIdx(
  '.season-item__no{width:34px;height:34px;flex:0 0 auto;border-radius:50%;border:1px solid var(--color-line-strong);display:grid;place-items:center;font-family:var(--font-serif);font-size:15px;color:var(--color-primary-dark)}',
  '.season-item__no{width:38px;height:38px;flex:0 0 auto;border-radius:50%;background:linear-gradient(135deg,rgba(200,109,75,.16),rgba(200,109,75,.04));border:1px solid rgba(200,109,75,.28);display:grid;place-items:center;font-family:var(--font-serif);font-size:15px;color:var(--color-primary-dark);box-shadow:inset 0 1px 4px rgba(200,109,75,.1)}',
  'season no gradient'
);
fs.writeFileSync('index.html', s, 'utf8');
console.log('index patches:', n);

/* ===== search.html ===== */
let t = fs.readFileSync('search.html', 'utf8');
const micFrom = '<button class="mic" id="mic" title="语音搜索" aria-label="语音搜索">🎙</button>';
const micTo = '<button class="mic" id="mic" title="语音搜索" aria-label="语音搜索"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 v3"/></svg></button>';
if (t.includes(micFrom)) {
  t = t.split(micFrom).join(micTo);
  fs.writeFileSync('search.html', t, 'utf8');
  console.log('OK   search:mic svg');
} else {
  console.log('SKIP search:mic svg');
}

/* ===== node-manager.html 菜单/详情 SVG ===== */
let m = fs.readFileSync('node-manager.html', 'utf8');
let mn = 0;
function repNm(from, to, tag) {
  if (!m.includes(from)) { console.log('SKIP nm:' + tag); return; }
  m = m.split(from).join(to);
  mn++;
  console.log('OK   nm:' + tag);
}
repNm(
  '<button class="nm-menu-item" data-a="pick">📍 地图选点</button>',
  '<button class="nm-menu-item" data-a="pick"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="vertical-align:-3px;margin-right:8px"><path d="M12 21 C12 21 5 14.5 5 10 A7 7 0 0 1 19 10 C19 14.5 12 21 12 21 Z"/><circle cx="12" cy="10" r="2.6"/></svg>地图选点</button>',
  'menu pick'
);
repNm(
  '<button class="nm-menu-item" data-a="cur">⌖ 使用当前位置</button>',
  '<button class="nm-menu-item" data-a="cur"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="vertical-align:-3px;margin-right:8px"><circle cx="12" cy="12" r="2"/><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22"/></svg>使用当前位置</button>',
  'menu cur'
);
repNm(
  '<button class="nm-menu-item" data-a="search">🔍 搜索地点</button>',
  '<button class="nm-menu-item" data-a="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="vertical-align:-3px;margin-right:8px" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16 L21 21"/></svg>搜索地点</button>',
  'menu search'
);
repNm(
  '<button class="nm-menu-item" data-a="mine">📋 我的节点</button>',
  '<button class="nm-menu-item" data-a="mine"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="vertical-align:-3px;margin-right:8px" stroke-linejoin="round"><path d="M4 5 H20 V19 H4 Z"/><path d="M4 9 H20"/><path d="M8 3 V6 M16 3 V6" stroke-linecap="round"/></svg>我的节点</button>',
  'menu mine'
);
/* 详情按钮图标 */
repNm(
  '<button class="is-btn" onclick="window.NM.record(\\\'',
  '<button class="is-btn" style="display:inline-flex;align-items:center;gap:5px;justify-content:center" onclick="window.NM.record(\\\'',
  'detail record style'
);
repNm(
  "'🎙 语音记录</button>'",
  "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" style=\"vertical-align:-2px\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11 a7 7 0 0 0 14 0 M12 18 v3\"/></svg>语音记录</button>'",
  'detail record icon'
);
fs.writeFileSync('node-manager.html', m, 'utf8');
console.log('nm patches:', mn);
