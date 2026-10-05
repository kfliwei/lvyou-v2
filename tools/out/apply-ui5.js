/* UI-5 落地 codemod：按「文件 + 当前行号 + 该行必须包含的预期子串」精确改写，
   任一条断言不成立就整批不写盘。
   行号基准：design.css 已含 UI-5 token 块（+11）与 scrim token 块（+7）两次插入。
   用法：node tools/out/apply-ui5.js         → 只校验，打印命中统计
        node tools/out/apply-ui5.js --write → 校验全通过后写盘 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);
const WRITE = process.argv.includes('--write');

const LINES = [];
const SUBS = [];
function setLine(f, ln, neu, expect) { LINES.push({ f, ln, neu, expect }); }
function dropLine(f, ln, expect) { LINES.push({ f, ln, neu: null, expect }); }
function subs(f, lns, oldSub, newSub) { lns.forEach(ln => SUBS.push({ f, ln, oldSub, newSub })); }

/* ============ design.css ============ */
const D = 'design.css';
dropLine(D, 495, 'box-shadow:var(--sh-sm)');            /* 旧 .search-bar，后文 1535 已给 --shadow-soft */
setLine(D, 595, 'background:var(--glass-bar);', 'background:rgba(250,248,243,.90);');           /* .tabbar */
setLine(D, 598, 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar);', 'backdrop-filter:blur(20px);');
setLine(D, 748, 'background:var(--paper-bar);color:var(--color-ink);', 'background:rgba(247,245,239,.90);');  /* .map-cluster：不在玻璃名单 */
setLine(D, 750, 'box-shadow:var(--shadow-medium);', 'box-shadow:0 7px 22px rgba(30,30,28,.08);');
dropLine(D, 751, 'backdrop-filter:blur(14px);');
setLine(D, 761, 'background:var(--glass-sheet);', 'background:rgba(250,248,243,.95);');          /* .sheet */
setLine(D, 764, 'backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet);', 'backdrop-filter:blur(24px);');
setLine(D, 806, 'background:var(--glass-bar);', 'background:rgba(250,248,243,.90);');            /* .bottom-nav 基础规则 */
setLine(D, 809, 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar);', 'backdrop-filter:blur(20px);');
subs(D, [865], 'background:rgba(250,248,243,.94)', 'background:var(--glass-sheet)');             /* .location-sheet */
subs(D, [865], 'border:1px solid rgba(30,30,28,.07)', 'border:1px solid var(--edge-hair-soft)');
subs(D, [865], 'backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)', 'backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)');
subs(D, [875], 'background:rgba(250,248,243,.88)', 'background:var(--paper-bar)');               /* .map-control */
subs(D, [875], 'box-shadow:0 8px 26px rgba(30,30,28,.08)', 'box-shadow:var(--shadow-medium)');
subs(D, [875], ';backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px', '');
subs(D, [877], 'background:rgba(250,248,243,.95)', 'background:var(--glass-sheet)');             /* .map-sheet */
subs(D, [877], 'backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)', 'backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)');
setLine(D, 935, 'background:var(--paper-bar);', 'background:rgba(250,248,243,.9);');             /* body .tn-quotes .bar */
dropLine(D, 936, 'backdrop-filter:blur(18px);');
subs(D, [985], 'background:rgba(250,248,243,.9);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border-bottom:1px solid var(--edge-hair-soft)');   /* .tn-listbar */
subs(D, [1041], 'background:rgba(250,248,243,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(32,32,29,.07)', 'background:var(--glass-sheet);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet);border:1px solid var(--edge-hair-soft)');
subs(D, [1054], 'background:rgba(250,248,243,.9);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border-bottom:1px solid var(--edge-hair-soft)');
subs(D, [1058], 'background:rgba(250,248,243,.9);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border-bottom:1px solid var(--edge-hair-soft)');
subs(D, [1069], 'background:rgba(250,248,243,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(32,32,29,.07)', 'background:var(--glass-sheet);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet);border:1px solid var(--edge-hair-soft)');
setLine(D, 1386, '.legend,.laymenu{background:var(--paper-bar)!important}', 'background:rgba(250,248,243,.82)!important');
dropLine(D, 1387, '.theme-dark .legend,.theme-dark .laymenu');   /* --paper-bar 在暗档自己翻，不必二次覆盖 */
subs(D, [1417], 'background:rgba(250,248,243,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border-bottom:1px solid var(--edge-hair-soft)');   /* 公共 .topbar */
subs(D, [1257], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');   /* .ui-toast 基规则 */
subs(D, [1264], 'box-shadow:0 18px 50px rgba(30,30,28,.22)', 'box-shadow:var(--shadow-float)');   /* .ui-modal */
setLine(D, 1309, 'box-shadow:var(--shadow-soft);', 'box-shadow:0 8px 26px -12px rgba(30,30,28,.14);');  /* .ui-errorbox */
subs(D, [1538], 'background:rgba(248,244,236,.8)', 'background:var(--paper-bar)');                /* v3 皮肤 .topbar */
subs(D, [1538], 'border-bottom-color:rgba(33,26,19,.06)', 'border-bottom-color:var(--edge-hair-soft)');
setLine(D, 1539, '}', 'backdrop-filter:blur(22px) saturate(1.5);');   /* 只去 blur，行尾的 } 是规则闭合 */
subs(D, [1546], 'background:rgba(248,244,236,.82)', 'background:var(--glass-bar)');               /* v3 皮肤 .bottom-nav */
setLine(D, 1547, 'box-shadow:var(--shadow-float);', 'box-shadow:0 0 0 1px rgba(33,26,19,.04),0 24px 52px -18px rgba(33,26,19,.4);');
setLine(D, 1548, 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)}', 'backdrop-filter:blur(26px) saturate(1.6);');
subs(D, [1554], 'background:rgba(24,21,18,.82);', '');             /* --glass-bar 暗档自翻 */
subs(D, [1561], 'background:rgba(27,23,19,.7)', 'background:var(--color-night)');                  /* .region-stats */
dropLine(D, 1562, 'backdrop-filter:blur(18px) saturate(1.4);');
subs(D, [1563], 'box-shadow:0 18px 42px -12px rgba(0,0,0,.5)', 'box-shadow:var(--shadow-float)');
subs(D, [1570], 'background:rgba(27,23,19,.88)', 'background:var(--color-night)');                 /* v3 皮肤 .ui-toast */
setLine(D, 1571, '}', 'backdrop-filter:blur(14px);');

/* ============ map.css ============ */
const M = 'map.css';
subs(M, [96], ';backdrop-filter:blur(8px)', '');                    /* .ctl 旧值，后文 740 已覆盖 */
setLine(M, 97, 'border-radius:12px;overflow:hidden;z-index:520;', 'box-shadow:var(--sh-md);');
subs(M, [115], ';backdrop-filter:blur(8px)', '');                   /* .laymenu 旧值，后文 742 已覆盖 */
setLine(M, 116, 'border-radius:14px;padding:7px;z-index:525;', 'box-shadow:var(--sh-lg);');
setLine(M, 134, 'font-size:var(--fs-9);', 'box-shadow:var(--sh-md);');   /* .fab：739 已给 --shadow-medium */
setLine(M, 140, '@media (hover:hover){.fab:hover{box-shadow:var(--shadow-float)}}', 'box-shadow:var(--sh-lg)');
subs(M, [160, 171, 181], 'box-shadow:var(--sh-sm)', 'box-shadow:var(--shadow-soft)');   /* leaflet 控件：活值，转族 */
dropLine(M, 197, 'box-shadow:var(--sh-md);');                       /* popup，1043 已覆盖 */
setLine(M, 206, 'border-radius:12px;', 'box-shadow:var(--sh-sm);'); /* .legend：747 已覆盖 */
setLine(M, 229, 'padding:7px 12px;', 'box-shadow:var(--sh-sm);');   /* .legOpen：749 已覆盖 */
setLine(M, 240, 'box-shadow:var(--shadow-medium);font-size:var(--fs-3);z-index:525;', 'box-shadow:var(--sh-sm);');  /* .routeBanner：活值 */
setLine(M, 272, 'border-radius:12px;', 'box-shadow:0 4px 16px rgba(0,0,0,.15);');   /* .tripbar：751 已覆盖 */
dropLine(M, 337, 'box-shadow:var(--sh-sm);');                       /* .card：1172 已给 --shadow-soft */
setLine(M, 342, '@media (hover:hover){.card:hover{border-color:var(--ink-300);box-shadow:var(--shadow-medium)}}', 'box-shadow:var(--sh-md)');
setLine(M, 374, 'border:1px solid var(--line);box-shadow:var(--shadow-soft);', 'box-shadow:var(--sh-sm);');   /* .lv-head：活值 */
setLine(M, 440, 'overflow:hidden;', 'box-shadow:var(--sh-sm);overflow:hidden;');    /* .route：1015 已覆盖，overflow 要留 */
setLine(M, 553, 'display:flex;flex-direction:column;', 'box-shadow:var(--sh-sm);display:flex;flex-direction:column;');  /* .fcard：1000 已覆盖，flex 要留 */
setLine(M, 579, 'box-shadow:var(--shadow-medium);padding:8px 11px;', 'box-shadow:var(--sh-md);');   /* .dayLegend：活值 */
setLine(M, 591, 'box-shadow:var(--shadow-soft);padding:5px 11px;', 'box-shadow:var(--sh-sm);');      /* .dayLegendBtn：活值 */
setLine(M, 724, 'background:var(--paper-bar);', 'background:rgba(250,248,243,.88);');  /* .topbar（非 header 元素时仍是活规则） */
dropLine(M, 725, 'backdrop-filter:blur(18px);');
subs(M, [726], 'border-bottom:1px solid rgba(32,32,29,.07)', 'border-bottom:1px solid var(--edge-hair-soft)');
setLine(M, 727, 'box-shadow:var(--shadow-medium);', 'box-shadow:0 6px 24px rgba(30,30,28,.05);');
subs(M, [740], 'background:rgba(250,248,243,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border:1px solid var(--edge-hair-soft)');
subs(M, [742], 'background:rgba(250,248,243,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border:1px solid var(--edge-hair-soft)');
subs(M, [747], 'background:rgba(250,248,243,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border:1px solid var(--edge-hair-soft)');
subs(M, [749], 'background:rgba(250,248,243,.9);backdrop-filter:blur(14px);border:1px solid rgba(32,32,29,.08)', 'background:var(--paper-bar);border:1px solid var(--edge-hair)');
subs(M, [751], 'background:rgba(250,248,243,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(32,32,29,.07)', 'background:var(--paper-bar);border:1px solid var(--edge-hair-soft)');
subs(M, [758], 'background:rgba(250,248,243,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)', 'background:var(--glass-bar);backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)');
subs(M, [758], 'box-shadow:0 -10px 30px rgba(30,30,28,.06)', 'box-shadow:var(--shadow-float)');
subs(M, [780], 'background:rgba(250,248,243,.90)', 'background:var(--glass-bar)');
subs(M, [780], 'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)', 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)');
subs(M, [893], 'box-shadow:var(--sh-sm)', 'box-shadow:var(--shadow-medium)');   /* .pickHint：活值 */
subs(M, [898], 'linear-gradient(180deg,transparent 60%,rgba(32,32,29,.22))', 'linear-gradient(180deg,transparent 60%,var(--scrim-cover))');
subs(M, [941], 'background:rgba(32,32,29,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)', 'background:var(--scrim-modal);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)');
setLine(M, 951, '.lod-cl{', 'backdrop-filter:blur(16px);');   /* 选择器行不能删，只摘掉 blur（同规则 954 本来也盖了它） */
setLine(M, 954, 'background:var(--paper-bar);', 'background:rgba(247,245,239,.9);backdrop-filter:blur(8px);');
subs(M, [956], 'box-shadow:0 5px 18px rgba(30,30,28,.16),0 1px 3px rgba(30,30,28,.1)', 'box-shadow:var(--shadow-medium)');
subs(M, [964], 'box-shadow:0 7px 22px rgba(30,30,28,.22),0 2px 5px rgba(30,30,28,.12)', 'box-shadow:var(--shadow-float)');
setLine(M, 965, '.theme-dark .lod-cl{background:var(--paper-bar);border-color:var(--edge-hair)}', 'background:rgba(38,37,34,.94);');
subs(M, [1000, 1015], 'box-shadow:0 8px 24px rgba(40,38,32,.07)', 'box-shadow:var(--shadow-soft)');
subs(M, [1024, 1043], 'box-shadow:0 14px 40px rgba(40,38,32,.18)', 'box-shadow:var(--shadow-float)');
subs(M, [1065], 'box-shadow:0 2px 8px rgba(40,38,32,.08)', 'box-shadow:var(--shadow-soft)');
setLine(M, 1103, 'background:var(--paper-bar);', 'background:rgba(247,245,239,.86);');   /* header.topbar */
dropLine(M, 1104, 'backdrop-filter:saturate(1.6) blur(18px);');
setLine(M, 1162, 'background:var(--paper-bar);', 'background:rgba(247,245,239,.82);');   /* .cntbar */
dropLine(M, 1163, 'backdrop-filter:blur(14px);');
setLine(M, 1236, 'background:var(--glass-bar);', 'background:rgba(250,248,243,.82);');   /* 悬浮 .tabbar */
setLine(M, 1237, '-webkit-backdrop-filter:var(--blur-bar);backdrop-filter:var(--blur-bar);', 'backdrop-filter:saturate(1.6) blur(22px);');
subs(M, [1261], 'background:rgba(27,23,19,.82)', 'background:var(--color-night)');       /* #legOpen */
dropLine(M, 1265, 'backdrop-filter:blur(14px);');
setLine(M, 1354, 'background:var(--paper-bar);', 'background:rgba(247,245,239,.85);');   /* .tl-head */
dropLine(M, 1355, 'backdrop-filter:blur(12px);');
setLine(M, 1396, 'border-color:rgba(220,174,94,.16);', 'background:rgba(27,23,19,.8);border-color:');  /* .theme-dark .tabbar：--glass-bar 暗档自翻 */
dropLine(M, 1397, 'backdrop-filter:saturate(1.4) blur(22px);');
subs(M, [1400], 'background:rgba(29,26,22,.9);', '');                                    /* 暗档 fab/ctl/laymenu */

/* ============ travel-map.html ============ */
const T = 'travel-map.html';
setLine(T, 31, 'background:var(--paper-bar);', 'background:rgba(250,248,243,.88);');
dropLine(T, 32, 'backdrop-filter:blur(18px);');
setLine(T, 33, 'border-bottom:1px solid var(--edge-hair-soft);', 'border-bottom:1px solid rgba(32,32,29,.07);');
setLine(T, 34, 'box-shadow:var(--shadow-medium);', 'box-shadow:0 6px 24px rgba(30,30,28,.05);');
setLine(T, 48, 'background:var(--paper-bar);', 'background:rgba(255,255,255,.92);backdrop-filter:blur(8px);');
setLine(T, 49, 'border-radius:12px;box-shadow:var(--shadow-medium);overflow:hidden;z-index:1001;', 'box-shadow:var(--sh-md);');
setLine(T, 65, 'background:var(--paper-bar);', 'background:rgba(255,255,255,.97);backdrop-filter:blur(8px);');
setLine(T, 66, 'border-radius:14px;box-shadow:var(--shadow-float);padding:7px;z-index:1002;', 'box-shadow:var(--sh-lg);');
subs(T, [78, 83, 88], 'box-shadow:var(--sh-sm)', 'box-shadow:var(--shadow-soft)');
subs(T, [93], 'box-shadow:var(--sh-md)', 'box-shadow:var(--shadow-float)');
subs(T, [119], 'background:rgba(250,248,243,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)', 'background:var(--paper-bar)');   /* .stat */
subs(T, [131], 'background:rgba(250,248,243,.92);backdrop-filter:blur(20px)', 'background:var(--paper-bar)');                                     /* .statOpen */
subs(T, [138], 'background:rgba(250,248,243,.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)', 'background:var(--paper-bar)');   /* .emptyTip */
setLine(T, 160, 'box-shadow:var(--shadow-soft);', 'box-shadow:0 4px 14px rgba(30,30,28,.06);');       /* .tl-chip */
setLine(T, 161, 'transition:all var(--duration-fast);', 'backdrop-filter:blur(12px);transition:all');
setLine(T, 169, 'box-shadow:var(--shadow-soft);', 'box-shadow:0 4px 14px rgba(30,30,28,.06);backdrop-filter:blur(12px);');  /* .tl-trip */
subs(T, [208], 'background:rgba(250,248,243,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)', 'background:var(--glass-sheet);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)');   /* #memSheet */
subs(T, [252], 'background:rgba(248,244,236,.82);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'background:var(--paper-bar)');
subs(T, [371], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');        /* 页内 toast cssText */

/* ============ 其余页面 ============ */
subs('index.html', [46], 'background:rgba(255,255,255,.58);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)', 'background:var(--color-surface)');   /* 搜索入口假玻璃 → 实心 */
setLine('index.html', 47, 'box-shadow:var(--shadow-medium);', 'box-shadow:0 10px 30px rgba(30,30,28,.04);');
subs('index.html', [62], 'background:rgba(250,248,243,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)', 'background:var(--paper-bar)');        /* .search-panel */

subs('story.html', [14], 'background:rgba(250,248,243,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)', 'background:var(--paper-bar)');
subs('story.html', [33], 'background:rgba(250,248,243,.92)', 'background:var(--glass-bar)');
subs('story.html', [33], 'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)', 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)');
subs('story.html', [44], 'background:rgba(248,244,236,.82);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'background:var(--paper-bar)');
subs('story.html', [53], 'background:rgba(248,244,236,.85)', 'background:var(--glass-bar)');
subs('story.html', [53], 'backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)');
setLine('story.html', 56, '.theme-dark .story-bar{background:var(--paper-bar)}', 'background:rgba(27,23,19,.82)');

subs('node-manager.html', [14], 'background:rgba(250,248,243,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)', 'background:var(--paper-bar)');
subs('node-manager.html', [23], 'background:rgba(250,248,243,.82);backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4)', 'background:var(--glass-bar);backdrop-filter:var(--blur-bar);-webkit-backdrop-filter:var(--blur-bar)');
subs('node-manager.html', [23], 'box-shadow:0 8px 30px rgba(32,32,29,.12),0 2px 8px rgba(32,32,29,.06)', 'box-shadow:var(--shadow-float)');
subs('node-manager.html', [68], ';backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px', '');
subs('node-manager.html', [74], 'background:rgba(248,244,236,.82);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'background:var(--paper-bar)');
subs('node-manager.html', [35, 52], 'box-shadow:0 18px 50px rgba(30,30,28,.22)', 'box-shadow:var(--shadow-float)');

subs('md-manager.html', [57], 'background:rgba(250,248,243,.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)', 'background:var(--paper-bar)');
subs('md-manager.html', [122], 'background:rgba(248,244,236,.85);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'background:var(--paper-bar)');
subs('md-manager.html', [285], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');

subs('album-edit.html', [14], 'background:rgba(247,245,239,.92);backdrop-filter:blur(16px)', 'background:var(--paper-bar)');
subs('album-edit.html', [78], 'background:rgba(247,245,239,.96);backdrop-filter:blur(16px)', 'background:var(--paper-bar)');
subs('album-edit.html', [78], 'box-shadow:0 -8px 24px rgba(30,30,28,.08)', 'box-shadow:var(--shadow-float)');
subs('album-edit.html', [108], 'box-shadow:0 8px 24px rgba(30,30,28,.3)', 'box-shadow:var(--shadow-medium)');
subs('album-edit.html', [112], 'background:rgba(248,244,236,.85);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5)', 'background:var(--paper-bar)');

subs('share.html', [18], 'background:rgba(250,248,243,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)', 'background:var(--paper-bar)');
subs('share.html', [34], 'box-shadow:0 6px 18px rgba(40,38,32,.06)', 'box-shadow:var(--shadow-soft)');
subs('planner.html', [89], 'box-shadow:0 6px 18px rgba(40,38,32,.06)', 'box-shadow:var(--shadow-soft)');
subs('album.html', [35], 'rgba(0,0,0,.55),rgba(0,0,0,.05) 55%', 'var(--scrim-photo),rgba(0,0,0,.05) 55%');

/* ============ JS 里注入的样式串 ============ */
subs('topic-common.js', [177], 'background:rgba(250,248,243,.96)', 'background:var(--paper-bar)');
subs('topic-common.js', [177], 'box-shadow:0 8px 30px rgba(0,0,0,.12)', 'box-shadow:var(--shadow-medium)');
subs('topic-common.js', [177], ';backdrop-filter:blur(16px', '');
subs('travel-notes.js', [379], ';backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px', '');
subs('travel-notes.js', [397], 'background:rgba(255,255,255,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)', 'background:var(--color-surface)');
subs('travel-notes.js', [397], 'box-shadow:0 6px 24px rgba(84,66,32,.07),inset 0 1px 0 rgba(255,255,255,.7)', 'box-shadow:var(--shadow-soft),inset 0 1px 0 rgba(255,255,255,.7)');
subs('travel-notes.js', [534], 'background:rgba(32,32,29,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)', 'background:var(--scrim-modal);backdrop-filter:var(--blur-sheet);-webkit-backdrop-filter:var(--blur-sheet)');
subs('travel-notes.js', [2272], ';backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px', '');
subs('results.js', [25], 'box-shadow:0 6px 24px rgba(30,30,28,.3)', 'box-shadow:var(--shadow-medium)');
subs('results.js', [76], 'box-shadow:0 -10px 40px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-float)');
subs('results.js', [243, 381, 460], 'box-shadow:0 18px 50px rgba(30,30,28,.3)', 'box-shadow:var(--shadow-float)');
subs('review.html', [664], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');
subs('settings.html', [591], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');
subs('vault.js', [252], 'box-shadow:0 8px 24px rgba(30,30,28,.18)', 'box-shadow:var(--shadow-medium)');

/* 子串需要正则形式的两处（.ls-img 两个版本外层阴影半径不同） */
const REG_SUBS = [
  { f: 'map.css', ln: 894, re: /,0 10px 30px rgba\(40,38,32,\.10\)/, to: ',var(--shadow-medium)' },
  { f: 'map.css', ln: 1333, re: /,0 12px 32px rgba\(40,38,32,\.12\)/, to: ',var(--shadow-medium)' },
];

/* ---------------- 执行 ---------------- */
const all = LINES.concat(SUBS);
const targets = [...new Set(all.map(e => e.f))];
const orig = {}, next = {};
targets.forEach(f => { orig[f] = fs.readFileSync(f, 'utf8').split('\n'); next[f] = orig[f].slice(); });

const errs = [];
LINES.forEach(e => {
  const cur = next[e.f][e.ln - 1];
  if (cur === undefined) { errs.push('LINES 越界 ' + e.f + ':' + e.ln); return; }
  if (e.expect !== undefined) {
    if (!cur.includes(e.expect)) errs.push('LINES 原文不符 ' + e.f + ':' + e.ln + ' 期望含 «' + e.expect + '» 实际=' + cur.trim().slice(0, 110));
    return true;
  }
  if (!cur.trim()) errs.push('LINES 目标行是空行 ' + e.f + ':' + e.ln);
  else if (/^\s*[{}]\s*$/.test(cur) && e.neu !== null) errs.push('LINES 目标行只有花括号，疑似行号漂移 ' + e.f + ':' + e.ln);
  next[e.f][e.ln - 1] = e.neu === null ? null : (cur.match(/^\s*/)[0] + e.neu);
});
SUBS.forEach(e => {
  const cur = next[e.f][e.ln - 1];
  if (cur === undefined) { errs.push('SUBS 越界 ' + e.f + ':' + e.ln); return; }
  const parts = cur.split(e.oldSub);
  if (parts.length - 1 !== 1) { errs.push('SUBS 命中 ' + (parts.length - 1) + '（应 1） ' + e.f + ':' + e.ln + ' «' + e.oldSub.slice(0, 60) + '» 行=' + cur.trim().slice(0, 110)); return; }
  next[e.f][e.ln - 1] = parts.join(e.newSub);
});
REG_SUBS.forEach(e => {
  const cur = next[e.f][e.ln - 1];
  if (cur === undefined) { errs.push('REG 越界 ' + e.f + ':' + e.ln); return; }
  const hits = (cur.match(new RegExp(e.re.source, 'g')) || []).length;
  if (hits !== 1) { errs.push('REG 命中 ' + hits + ' ' + e.f + ':' + e.ln + ' ' + e.re.source); return; }
  next[e.f][e.ln - 1] = cur.replace(e.re, e.to);
});

/* LINES 的 expect 只负责证明行号没漂；真正改写要在断言之后再走一遍 */
if (!errs.length) {
  LINES.forEach(e => {
    if (e.expect === undefined) return;
    const cur = next[e.f][e.ln - 1];
    next[e.f][e.ln - 1] = e.neu === null ? null : (cur.match(/^\s*/)[0] + e.neu);
  });
}

const nByFile = {};
all.forEach(e => { nByFile[e.f] = (nByFile[e.f] || 0) + 1; });
console.log('条目 整行 ' + LINES.length + ' / 子串 ' + (SUBS.length + REG_SUBS.length) + ' / 文件 ' + targets.length);Object.entries(nByFile).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log('  ' + f + ' ' + n));
if (errs.length) { console.log('!! 校验未通过 ' + errs.length + ' 条，未写盘：'); errs.forEach(x => console.log('  ' + x)); process.exit(1); }
if (!WRITE) { console.log('校验全部通过（--write 才落盘）'); process.exit(0); }
targets.forEach(f => {
  const removed = next[f].filter(l => l === null).length;
  const kept = next[f].filter(l => l !== null).join('\n');
  fs.writeFileSync(f, kept);
  console.log('WROTE ' + f + '  删行 ' + removed + '  ' + orig[f].length + '→' + kept.split('\n').length);
});
