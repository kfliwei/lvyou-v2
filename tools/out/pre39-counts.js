const fs = require('fs');
/* §39 锚点表预跑：用与 verify.js 完全相同的视图口径（.css 剥块注释+归一空白；.html 只归一空白）
   把每条串的出现次数打出来，写进 verify.js 之前先对账，避免红一阵才知道数错了。
   第二段打规则体（确认「各页只留皮肤」真能抽出零几何声明），第三段打全站 html 扫描的分母。 */
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const ws = s => s.replace(/\s+/g, ' ').trim();
const flat = s => ws(s.replace(/\/\*[\s\S]*?\*\//g, ''));
const rd = f => fs.existsSync(ROOT + f) ? fs.readFileSync(ROOT + f, 'utf8') : '(缺文件)';
const view = f => /\.html$/.test(f) ? ws(rd(f)) : flat(rd(f));
const cnt = (s, n) => s.split(n).length - 1;
const bodies = (src, sel) => {
  const out = [];
  for (let i = src.indexOf(sel); i >= 0; i = src.indexOf(sel, i + 1)) {
    const a = src.indexOf('{', i), b = src.indexOf('}', a);
    if (a < 0 || b < 0) break;
    out.push(src.slice(i, b + 1));
  }
  return out;
};
const GEO = /width\s*:|height\s*:/;

const T = [
  /* ---- design.css：顶栏一族单点持有 ---- */
  ['design.css', '.t-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'],
  ['design.css', '.t-row .back,.t-row .t-ic{width:44px;height:44px;border:1px solid var(--color-line);border-radius:50%;background:var(--color-bg-soft);color:var(--color-ink);font-size:var(--fs-6);display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;text-decoration:none}'],
  ['design.css', '.t-row .t-ic{margin-left:auto}'],
  ['design.css', '.t-row .t-ic .ti{margin-right:0}'],
  ['design.css', '.t-row .back:active,.t-row .t-ic:active{transform:scale(.92)}'],
  ['design.css', '.t-row .title{flex:1 1 7em;min-width:7em;font-family:var(--font-serif);font-weight:400;font-size:var(--fs-8);color:var(--color-ink);letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'],
  ['design.css', '.trow-acts{display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto}'],
  ['design.css', '.topbar{position:sticky;top:0;z-index:100;'],
  /* ---- design.css：触控口径族 ---- */
  ['design.css', '.story-bar .back,.nm-topbar .back{width:44px!important;height:44px!important;min-width:44px;min-height:44px;border-radius:50%}'],
  ['design.css', 'button.act,button.act.sec,button.mine,button.go{min-height:44px}'],
  ['design.css', '.sbar .mic{width:44px!important;height:44px!important}'],
  ['design.css', '.wl-btn{min-height:44px!important}'],
  ['design.css', '.wl-remove,.ck-remove,.ech-del,.tb-open{width:44px!important;height:44px!important}'],
  ['design.css', '.nm-item-btn{min-height:44px}'],
  ['design.css', '.is-btn{min-height:44px}'],
  ['design.css', '.ctl button{width:36px!important;height:36px!important;margin:0 auto}'],
  ['design.css', '.leaflet-control-zoom a,.leaflet-touch .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important}'],
  ['design.css', '.tripbar .mv,.tripbar .x{min-width:44px;min-height:44px;display:inline-grid;place-items:center}'],
  ['design.css', '@@SLICE@@.story-bar .back,.nm-topbar .back{ => .tripbar .mv,.tripbar .x{ => 40px'],
  ['design.css', '@@SLICE@@.story-bar .back,.nm-topbar .back{ => .tripbar .mv,.tripbar .x{ => 36px'],
  ['design.css', '@@SLICE@@.story-bar .back,.nm-topbar .back{ => .tripbar .mv,.tripbar .x{ => 44px'],
  ['design.css', '.nm-item-btn{min-height:36px'],
  ['design.css', '@@BODY@@.nm-item-btn{'],
  /* ---- 各页只留皮肤：规则体内零几何声明 ---- */
  ['map.css', '@@BODY@@.t-row .back{'],
  ['map.css', '@@BODY@@.t-row .title{'],
  ['map.css', '@@BODY@@.ctl button{'],
  ['travel-map.html', '@@BODY@@.ctl button{'],
  ['node-manager.html', '@@BODY@@.nm-topbar .back{'],
  ['node-manager.html', '@@BODY@@#infoSheet .is-btn{'],
  ['wishlist.html', '@@BODY@@.wl-remove{'],
  ['checklist.html', '@@BODY@@.ck-remove{'],
  ['checklist.html', '@@BODY@@.tb-open{'],
  ['album-edit.html', '@@BODY@@.ech-del{'],
  ['story.html', '@@BODY@@.story-bar .back{'],
  ['search.html', '@@BODY@@.sbar .mic{'],
  ['story.html', '@@BODY@@.story-nav .sn-btn{'],   /* 尾巴：这一枚还该有 40，扫描要能看见 */
  /* ---- 期望 0：改前形态 ---- */
  ['map.css', '.t-row{height:42px'],
  ['map.css', '.ctl button{width:'],
  ['travel-map.html', 'top:56px;width:'],
  ['travel-map.html', '.ctl button{ width:44px'],
  ['node-manager.html', '.leaflet-control-zoom a{width:'],
  ['node-manager.html', '#infoSheet .is-btn{flex:1;min-height:'],
  ['wishlist.html', '.t-row .title{'],
  ['wishlist.html', '.wl-remove{width:'],
  ['story.html', 'height:34px'],
  ['search.html', '.sbar .mic{flex:0 0 auto;width:'],
  ['checklist.html', '.ck-remove{width:'],
  ['album-edit.html', '.ech-del{width:'],
  ['node-manager.html', 'class="is-btn ic"'],
  ['node-manager.html', 'id="infoSheet"'],
  ['node-manager.html', '#infoSheet .is-acts{display:flex;gap:10px;flex-wrap:wrap}'],
  ['node-manager.html', '#infoSheet .is-btn.ic{display:inline-flex;align-items:center;justify-content:center;gap:5px}'],
  ['node-manager.html', '#infoSheet .is-btn.ic .ti{margin-right:0}'],
  ['node-manager.html', '.leaflet-top.leaflet-right{margin-top:calc(env(safe-area-inset-top,0px) + 66px);margin-right:10px}'],
  ['travel-map.html', 'body{--tb-h:calc(env(safe-area-inset-top,0px) + 63px)}'],
  ['travel-map.html', 'top:var(--tb-h)'],
  ['travel-map.html', '.ctl{ position:absolute;right:12px;top:var(--tb-h);width:44px;'],
  ['travel-map.html', '.laymenu{ position:absolute;right:60px;top:var(--tb-h);width:158px;'],
  ['travel-map.html', '@media(max-width:360px){'],
  ['travel-map.html', '.t-row .act{padding:0;width:44px;height:44px;border-radius:50%;justify-content:center}'],
  ['travel-map.html', '.t-row .act .act-label{display:none}'],
  ['travel-map.html', 'class="trow-acts"'],
  ['travel-map.html', 'aria-label="随手记"'],
  ['travel-map.html', 'aria-label="游记"'],
  ['wishlist.html', '<div class="trow-acts">'],
  ['wishlist.html', 'class="wl-remove" aria-label="移除"'],
  ['story.html', '.story-bar select{flex:0 0 auto;max-width:140px;height:44px;border:1px solid var(--color-line);border-radius:999px;background:var(--color-surface);color:var(--color-ink);font-size:var(--fs-3);padding:0 12px}'],
  ['search.html', '.sbar .mic{flex:0 0 auto;border:0;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary-dark);font-size:var(--fs-6);cursor:pointer}'],
  ['node-manager.html', '#infoSheet .is-btn{flex:1;border-radius:999px;border:1px solid var(--color-line-strong);background:var(--color-surface);color:var(--color-ink-soft);font-size:var(--fs-5);cursor:pointer;font-family:var(--font-sans);white-space:nowrap}'],
  ['wishlist.html', '.wl-remove{border:0;border-radius:50%;background:transparent;color:var(--color-muted);font-size:var(--fs-5);cursor:pointer;flex:0 0 auto}'],
  ['checklist.html', '.ck-remove{border:0;border-radius:50%;background:transparent;color:var(--color-muted);cursor:pointer;flex:0 0 auto;padding:0;display:grid;place-items:center}'],
  ['album-edit.html', '.ech-del{display:grid;place-items:center;border-radius:12px;background:var(--color-bg-soft);color:var(--color-muted);font-size:var(--fs-6);cursor:pointer;flex:0 0 auto}'],
  ['expense.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">'],
  ['trip.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">'],
  ['checklist.html', '<a class="t-ic" href="planner.html" aria-label="行程规划">'],
  ['planner.html', '<a class="t-ic" href="wishlist.html" aria-label="想去清单">'],
  /* ---- 浏览器腿在场 ---- */
  ['tools/smoke-topbar.js', "ok('K01 "],
  ['tools/smoke-topbar.js', "ok('K11 "],
  ['tools/smoke-topbar.js', "ok('K15 "],
  ['tools/smoke-topbar.js', "ok('K18 "],
  ['tools/smoke-topbar.js', "ok('K22 "],
  ['tools/smoke-topbar.js', "ok('K23 "],
  ['tools/smoke-topbar.js', "ok('K27 "],
  ['tools/smoke-topbar.js', "ok('K31 "],
  ['tools/smoke-topbar.js', "ok('K32 "],
  ['tools/smoke-topbar.js', 'ok(\'K'],
  ['tools/smoke-topbar.js', "const WRAPPED_OK = ['wishlist.html'];"],
  ['tools/smoke-topbar.js', '{ width: 328, height: 723 }'],
  ['tools/smoke-topbar.js', '{ width: 320, height: 640 }'],
  ['tools/smoke-topbar.js', 'isMobile: true, hasTouch: true'],
  ['README.md', '§39'],
];

T.forEach(([f, n]) => {
  if (n.startsWith('@@SLICE@@')) {
    const parts = n.slice(9).split(' => ');
    const src = view(f);
    const i1 = src.indexOf(parts[0]), i2 = src.indexOf(parts[1]);
    const sl = i1 >= 0 && i2 > i1 ? src.slice(i1, i2) : '(切片失败)';
    console.log(String(i1 >= 0 && i2 > i1 ? cnt(sl, parts[2]) : -1).padStart(3) + '  ' + f + '  [slice ' + parts[2] + '] len=' + sl.length);
    return;
  }
  if (n.startsWith('@@BODY@@')) {
    const sel = n.slice(8);
    const bs = bodies(view(f), sel);
    const bad = bs.filter(b => GEO.test(b));
    console.log('  ' + String(bs.length).padStart(2) + 'x ' + f + ' «' + sel + '» 含几何=' + bad.length + ' :: ' + bs.map(b => b.replace(/[{}]/g, '').slice(0, 96)).join(' || '));
    return;
  }
  console.log(String(cnt(view(f), n)).padStart(3) + '  ' + f + '  «' + n.slice(0, 74) + '»');
});

const htmls = fs.readdirSync(ROOT).filter(x => /\.html$/.test(x));
let tic = 0, inline40 = 0;
htmls.forEach(x => {
  const v = view(x);
  tic += cnt(v, 'class="t-ic"');
  inline40 += cnt(v, 'style="flex:0 0 auto;width:40px;height:40px');
});
console.log('ALLHTML ' + htmls.length + ' 份 :: class="t-ic"=' + tic + ' 内联40px圆钮=' + inline40);
