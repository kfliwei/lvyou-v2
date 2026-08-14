/* 审核修复批次 1：P0 五项 + 令牌冲突 + sw 清单 + 设置即时保存 + 底部安全区 */
const fs = require('fs');
function patch(file, subs) {
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  let n = 0;
  subs.forEach(function (it) {
    if (s.includes(it[0])) { s = s.split(it[0]).join(it[1]); n++; console.log('OK  ', file, '|', it[2]); }
    else console.log('SKIP', file, '|', it[2]);
  });
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  return n;
}

/* 1. P0-1 语音降级回调 → window.__tnOnVoice* */
patch('travel-notes.js', [
  [
    "    rec.onstart = function () { onVoiceStart(); };",
    "    rec.onstart = function () { if (window.__tnOnVoiceStart) window.__tnOnVoiceStart(); };",
    '1a voice start'
  ],
  [
    "      if (e.results[e.results.length - 1].isFinal) onVoiceResult(txt);\n      else onVoicePartial(txt);",
    "      if (e.results[e.results.length - 1].isFinal) { if (window.__tnOnVoiceResult) window.__tnOnVoiceResult(txt); }\n      else if (window.__tnOnVoicePartial) window.__tnOnVoicePartial(txt);",
    '1b voice result/partial'
  ],
  [
    "    rec.onerror = function (e) { onVoiceError(e.error || 'err'); };",
    "    rec.onerror = function (e) { if (window.__tnOnVoiceError) window.__tnOnVoiceError(e.error || 'err'); };",
    '1c voice error'
  ]
]);

/* 2. P0-2 深色缩放按钮 */
patch('node-manager.html', [
  [
    "background:rgba(250,248,243,.92) !important;color:var(--color-ink-soft) !important;",
    "background:var(--color-surface) !important;color:var(--color-ink) !important;",
    '2a nm zoom surface'
  ],
  [
    ".theme-dark #rsSheet,.theme-dark #infoSheet{background:var(--color-surface);border-color:var(--color-line)}",
    ".theme-dark #rsSheet,.theme-dark #infoSheet{background:var(--color-surface);border-color:var(--color-line)}\n  .theme-dark .leaflet-control-zoom a{background:var(--color-surface) !important;color:var(--color-ink) !important}",
    '2b nm zoom dark'
  ]
]);
patch('map.css', [
  [
    ".leaflet-control-zoom a{\n  width:36px;height:36px;line-height:36px;\n  background:#fff;color:var(--ink-900);\n  border-bottom:1px solid var(--paper-300);font-size:17px;\n}",
    ".leaflet-control-zoom a{\n  width:36px;height:36px;line-height:36px;\n  background:var(--color-surface,#fff);color:var(--color-ink);\n  border-bottom:1px solid var(--paper-300);font-size:17px;\n}\n.theme-dark .leaflet-control-zoom a{background:var(--color-surface,#23211d);color:var(--color-ink,#e9e4d8)}",
    '2c map zoom dark'
  ]
]);

/* 3. P0-3 断网搜索：loaded 置位 + 游记可搜 */
patch('search.html', [
  [
    "s.onerror=function(){ $r.innerHTML='<div class=\"empty\"><div class=\"em\">⚠️</div><b>景点数据加载失败</b><span>请检查网络后重试</span></div>'; };",
    "s.onerror=function(){ loaded=true; REGS=[]; $r.innerHTML=''; render(); };",
    '3 search offline'
  ]
]);

/* 4. P0-4 双引导合并：tn_guide 相关判断统一到 tn_onboarded（引导块删除在单独脚本） */
patch('index.html', [
  [
    "if(localStorage.getItem('tn_guide')!=='1') return;",
    "if(localStorage.getItem('tn_onboarded')!=='1') return;",
    '4a backup hint key'
  ],
  [
    "Wish.checkNearby && localStorage.getItem('tn_guide')==='1'",
    "Wish.checkNearby && localStorage.getItem('tn_onboarded')==='1'",
    '4b nearby key'
  ]
]);

/* 5. P0-5 node-manager 模型名对齐 */
patch('node-manager.html', [
  [
    "model: localStorage.getItem('tn_model') || 'deepseek-chat',",
    "model: (function (r) { var A = { 'deepseek-chat': 'deepseek-v4-flash', 'deepseek-reasoner': 'deepseek-v4-pro' }; return A[r] || r; })(localStorage.getItem('tn_model') || 'deepseek-v4-flash'),",
    '5 model alias'
  ]
]);

/* 6. 令牌冲突：删除与现有重复的 --radius-* */
patch('design.css', [
  [
    "  --radius-sm:10px;--radius-md:14px;--radius-lg:18px;--radius-xl:24px;\n  --dur-fast:.18s;",
    "  --dur-fast:.18s;",
    '6 token conflict'
  ]
]);

/* 7. sw.js v14 + node-lod 预缓存 */
patch('sw.js', [
  [
    "var CACHE = 'trace-v13';",
    "var CACHE = 'trace-v14';",
    '7a sw v14'
  ],
  [
    "  './tiles.js',",
    "  './tiles.js',\n  './node-lod.js',",
    '7b node-lod shell'
  ]
]);

/* 8. 设置页：Key/模型/VAD 即时保存 */
patch('settings.html', [
  [
    "  function saveSettings(){",
    "  (function () {\n    /* 即时保存（审核修复）：Key 输入即存、模型/VAD 点击即存，避免返回丢配置 */\n    var ik = document.getElementById('inKey');\n    if (ik) ik.oninput = function () { var k = this.value.trim(); if (k) localStorage.setItem('tn_aiKey', k); else localStorage.removeItem('tn_aiKey'); };\n    ['#chModel button', '#chVad button'].forEach(function (sel) {\n      document.querySelectorAll(sel).forEach(function (b) {\n        b.onclick = function () {\n          document.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('on', x === b); });\n          if (b.dataset.m) localStorage.setItem('tn_model', b.dataset.m);\n          if (b.dataset.v) localStorage.setItem('tn_vad', b.dataset.v);\n        };\n      });\n    });\n  })();\n  function saveSettings(){",
    '8 settings instant save'
  ]
]);

/* 9. 底部悬浮件安全区（design.css 全局补丁） */
patch('design.css', [
  [
    "/* 底部 Sheet 弹性弹出 */",
    "/* 底部悬浮件安全区（iPhone Home 指示条避让） */\n.bottom-nav,.tabbar,.savebar,.tripbar,#locSheet,#infoSheet,#rsSheet,.region-stats{padding-bottom:max(env(safe-area-inset-bottom,0px),8px) !important}\n/* 底部 Sheet 弹性弹出 */",
    '9 safe area'
  ]
]);

console.log('=== batch1 done ===');
