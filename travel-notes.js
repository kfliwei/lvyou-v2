/* =========================================================
 * travel-notes.js —— 语音游记模块 v2（UI/UX 重构版）
 * 设计：途记 Design System v2（霞鹜文楷×思源黑体 / 深色沉浸录音 / 藤蔓时间线 / 毛玻璃）
 * 能力：语音→转写（App内 讯飞/Google / 网页降级 Web Speech）
 *      → DeepSeek V4 三风格润色 → 坐标+时间+天气自动 → 照片/录音留存
 *      → 地图📝标记 → 时间线列表/统计/编辑/导出文档/备份
 * 用法：TravelNotes.init({map, getSite})  各专题页一行接入
 * ========================================================= */
(function () {
  var KEY = 'travelNotes';      // 游记库
  var AI_KEY = 'tn_aiKey';      // DeepSeek key
  var STYLES = [
    { id: 'prose',    name: '散文游记',   icon: '📖', rec: true,
      system: '你是资深旅行作家。把用户的语音口述润色成一篇文学化、有画面感的散文游记，保留真实细节与感受，适当融入该景点背景，200-400字，分段落，不加小标题。' },
    { id: 'narrative', name: '述事方式',  icon: '🗣',
      system: '你是故事讲述者。把用户的语音口述按时间顺序讲成一个生动的旅行故事，有人物动作、场景推进和情感起伏，像亲口讲给朋友听，口语自然但不啰嗦，250-450字，分段落。' },
    { id: 'guide',    name: '攻略指南',   icon: '🧭',
      system: '你是旅行攻略编辑。把用户的语音口述整理成实用攻略，包含亮点、游玩建议、注意事项，条理清晰（可用编号），200-300字。' },
    { id: 'moments',  name: '朋友圈文案', icon: '💬',
      system: '你是社交媒体文案高手。把用户的语音口述改写成一条80-150字的朋友圈文案，语言活泼有感染力，可适当使用 emoji，结尾可加一句点睛的话。' },
    { id: 'raw',      name: '原文保留',   icon: '📝',
      system: '' }
  ];

  var MAP = null, GETSITE = null, ONOPEN = null;
  var notes = [], tnLayer = null;
  var rec = null;               // 网页降级用 SpeechRecognition
  var state = { site: null, phase: 'idle', raw: '', partial: '', photos: [], audio: '' };
  var MODEL_ALIAS = { 'deepseek-chat': 'deepseek-v4-flash', 'deepseek-reasoner': 'deepseek-v4-pro' };
  var MODEL_LIST = [['deepseek-v4-flash', '⚡ V4-Flash'], ['deepseek-v4-pro', '🚀 V4-Pro']];
  var tagFilter = '';
  var viewMode = 'trip';        // trip=旅程聚合 | timeline=年月折叠
  var tripOpen = {};            // 展开的旅程 id
  var timeOpen = {};            // 展开的年（'2026'）/ 月（'2026-08'）
  var TRIP_GAP = 3 * 24 * 3600 * 1000;   // 游记间隔超过 3 天视为新旅程
  var startGuideRef = null;   // buildUI 内赋值，供导出 explain 调用

  /* ---------- 基础 · IndexedDB 持久层 ---------- */
  /* 说明：内存数组 notes 是同步真相源（list()/count() 保持同步，现有 UI 零改动）；
     启动时从 IDB 异步加载进内存，persist() 异步写回 IDB。
     存储库：gujian-notes / notes（keyPath:id）+ 索引 by_city / by_day / by_ts */
  var DB = null, DB_READY = false;
  function openDB(cb) {
    if (DB) { cb && cb(DB); return; }
    if (!window.indexedDB) { loadLocalStorageLegacy(cb); return; }
    try {
      var req = indexedDB.open('gujian-notes', 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          var st = db.createObjectStore('notes', { keyPath: 'id' });
          st.createIndex('by_city', 'city', { unique: false });
          st.createIndex('by_day', 'day', { unique: false });
          st.createIndex('by_ts', 'ts', { unique: false });
        }
      };
      req.onsuccess = function (e) {
        DB = e.target.result;
        DB_READY = true;
        cb && cb(DB);
      };
      req.onerror = function () { loadLocalStorageLegacy(cb); };
    } catch (e) { loadLocalStorageLegacy(cb); }
  }
  /* IDB 不可用时回退 localStorage（旧数据也能被读到） */
  function loadLocalStorageLegacy(cb) {
    try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { notes = []; }
    DB_READY = false;
    cb && cb();
  }
  function loadNotes(cb) {
    openDB(function (db) {
      if (db) {
        var tx = db.transaction('notes', 'readonly');
        var req = tx.objectStore('notes').getAll();
        req.onsuccess = function () { notes = req.result || []; if (cb) cb(); };
        req.onerror = function () { notes = []; if (cb) cb(); };
      } else {
        if (cb) cb();
      }
    });
  }
  function persist() {
    // 内存已更新；异步写回 IDB（失败回退 localStorage 兼容）
    var snap = notes.slice();
    openDB(function (db) {
      if (!db) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} return; }
      try {
        var tx = db.transaction('notes', 'readwrite');
        var st = tx.objectStore('notes');
        st.clear();
        snap.forEach(function (n) { st.put(n); });
        tx.onerror = function () { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e) {} };
      } catch (e) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e2) {} }
    });
    // 容量预警（估算内存占用）
    var mb = storageMB();
    if (mb > 3 && Math.floor(mb / 0.2) > (persist._lastWarn || 0)) {
      persist._lastWarn = Math.floor(mb / 0.2);
      setTimeout(function () { flash('存储占用 ' + mb.toFixed(1) + 'MB：可在设置里导出备份'); }, 600);
    }
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function fmtTime(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function uid() { return 'tn_' + Date.now(); }
  function fmtDay(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  /* 从景点对象推导省/市/县（供保存游记归档；途终点无匹配则留空） */
  var CITY_PROV = {
    '大同市':'山西省','朔州市':'山西省','忻州市':'山西省','太原市':'山西省','阳泉市':'山西省','晋中市':'山西省','吕梁市':'山西省','长治市':'山西省','晋城市':'山西省','临汾市':'山西省','运城市':'山西省',
    '拉萨市':'西藏自治区','日喀则市':'西藏自治区','林芝市':'西藏自治区','昌都市':'西藏自治区','那曲市':'西藏自治区','山南市':'西藏自治区','阿里地区':'西藏自治区',
    '西宁市':'青海省','海东市':'青海省','海北藏族自治州':'青海省','海南藏族自治州':'青海省','果洛藏族自治州':'青海省','玉树藏族自治州':'青海省','海西蒙古族藏族自治州':'青海省','黄南藏族自治州':'青海省',
    '桂林市':'广西壮族自治区','南宁市':'广西壮族自治区','柳州市':'广西壮族自治区','崇左市':'广西壮族自治区','百色市':'广西壮族自治区','河池市':'广西壮族自治区','贺州市':'广西壮族自治区','来宾市':'广西壮族自治区','梧州市':'广西壮族自治区','玉林市':'广西壮族自治区','贵港市':'广西壮族自治区',
    '昆明市':'云南省','大理白族自治州':'云南省','丽江市':'云南省','西双版纳傣族自治州':'云南省','普洱市':'云南省','文山壮族苗族自治州':'云南省','红河哈尼族彝族自治州':'云南省','迪庆藏族自治州':'云南省','曲靖市':'云南省','昭通市':'云南省','保山市':'云南省','德宏傣族景颇族自治州':'云南省','怒江傈僳族自治州':'云南省',
    '赣州市':'江西省','瑞金市':'江西省','于都县':'江西省','湘西土家族苗族自治州':'湖南省','遵义市':'贵州省','赤水市':'贵州省','毕节市':'贵州省','黔东南苗族侗族自治州':'贵州省','六盘水市':'贵州省','金沙县':'贵州省','仁怀市':'贵州省','泸州市':'四川省','宜宾市':'四川省','雅安市':'四川省','甘孜藏族自治州':'四川省','阿坝藏族羌族自治州':'四川省','凉山彝族自治州':'四川省','绵阳市':'四川省','广元市':'四川省','巴中市':'四川省','达州市':'四川省','南充市':'四川省','阿坝州':'四川省','甘孜州':'四川省','延安市':'陕西省','吴起县':'陕西省','志丹县':'陕西省','子长县':'陕西省','绥德县':'陕西省','米脂县':'陕西省','榆林市':'陕西省','定西市':'甘肃省','天水市':'甘肃省','陇南市':'甘肃省','平凉市':'甘肃省','庆阳市':'甘肃省','白银市':'甘肃省','固原市':'宁夏回族自治区','吴忠市':'宁夏回族自治区','会宁县':'甘肃省','宕昌县':'甘肃省','腊子口':'甘肃省'
  };
  function geoOf(site) {
    var g = { province: '', city: '', county: '' };
    if (!site) return g;
    if (site.region) { g.province = site.region.indexOf('省') >= 0 || site.region.indexOf('自治区') >= 0 ? site.region : site.region + '省'; }
    if (site.city) { g.city = site.city; if (!g.province && CITY_PROV[site.city]) g.province = CITY_PROV[site.city]; }
    if (site.county) g.county = site.county;
    if (!g.province && g.city) g.province = '其他';
    return g;
  }

  /* =========================================================
   * CSS —— 途记 v2 设计系统（深色沉浸录音 / 纸感列表 / 毛玻璃）
   * ========================================================= */
  var CSS = '\:root{--fd:"LXGW WenKai","Kaiti SC",serif;--fb:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;\
--b6:var(--color-primary);--b7:#1f3634;--b8:#162725;--b9:#111c1b;--a5:#8d5b3c;--a3:#b8860b;--d3:#8b8171;\
--bg:#f6f1e5;--sf:#fbf8f1;--sf2:#efe8d8;--ln:#e4dbc6;--i9:#26241f;--i7:#3d3a33;--i5:#6b665c;\
--sm:0 1px 3px rgba(60,50,30,.07);--md:0 4px 14px rgba(60,50,30,.10);--lg:0 12px 32px rgba(60,50,30,.14);\
--tf:150ms ease;--tn:320ms cubic-bezier(.2,.9,.3,1)}\
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}\
:focus-visible{outline:2px solid var(--a3);outline-offset:2px;border-radius:2px}\
.tn-mask{position:fixed;inset:0;background:rgba(17,28,27,.6);z-index:9000;display:none}\
.tn-panel{position:fixed;left:0;right:0;top:0;bottom:0;z-index:9001;display:none;flex-direction:column;overflow:hidden;\
background:linear-gradient(170deg,#f6f1e5 0%,#efe9dc 55%,#e9e2d2 100%);color:#26241f}\
.tn-panel::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 75% 8%,rgba(184,134,11,.12),transparent 45%),radial-gradient(circle at 15% 88%,rgba(168,50,42,.07),transparent 50%);pointer-events:none}\
\
.tn-head{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px)+6px) 14px 6px;position:relative;z-index:2;background:linear-gradient(135deg,var(--b7),var(--b9));border-bottom:2px solid var(--a3)}\
.tn-head .tn-x{background:rgba(255,255,255,.14);color:#f5ede0}\
.tn-x{background:rgba(38,36,31,.07);border:0;width:32px;height:32px;border-radius:var(--r-sm,8px);font-size:14px;color:#6b665c;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:var(--tf)}\
.tn-x:active{transform:scale(.9)}\
.tn-title{flex:1;min-width:0;font-family:var(--fd);font-size:16px;font-weight:700;color:#f5ede0;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.tn-title small{display:block;font-family:var(--fb);font-size:10.5px;font-weight:400;color:rgba(239,233,220,.72);margin-top:1px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.tn-pause{margin-left:auto;flex:0 0 auto;font-size:10px;background:rgba(255,255,255,.12);border-radius:var(--r-sm,8px);padding:4px 9px;color:var(--color-muted);border:1px solid var(--color-line-strong)}\
.tn-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:10px 20px 0;overflow-y:auto;position:relative;z-index:2}\
.tn-ring{position:relative;width:172px;height:172px;flex:0 0 auto;margin-top:12px}\
.tn-ringbar{position:absolute;width:4px;height:15px;border-radius:2px;background:linear-gradient(180deg,var(--color-primary),rgba(200,109,75,.15));left:50%;top:50%;transform-origin:2px 88px;opacity:.85}\
.tn-ring.live .tn-ringbar{animation:tnbeat 1s ease-in-out infinite}\
.tn-ring.live .tn-ringbar:nth-child(2n){animation-delay:.12s}.tn-ring.live .tn-ringbar:nth-child(3n){animation-delay:.24s}.tn-ring.live .tn-ringbar:nth-child(4n){animation-delay:.36s}\
@keyframes tnbeat{0%,100%{opacity:.25;height:10px}50%{opacity:1;height:21px}}\
.tn-mic{width:88px;height:88px;border-radius:50%;border:1.5px solid var(--color-primary);background:linear-gradient(145deg,var(--color-primary),var(--color-primary-dark));box-shadow:0 10px 26px rgba(200,109,75,.3),inset 0 2px 6px rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;position:relative;z-index:3;cursor:pointer;transition:transform .15s,background .2s,box-shadow .2s}\
.tn-mic:active{transform:scale(.93)}\
.tn-mic.live{background:linear-gradient(145deg,#b8432f,#8f2d1f);border-color:rgba(245,240,228,.55);box-shadow:0 10px 26px rgba(168,50,42,.4),inset 0 2px 6px rgba(255,255,255,.12)}\
.tn-mic.ok{background:linear-gradient(145deg,#c9a227,#96700a);border-color:rgba(245,240,228,.6);box-shadow:0 10px 26px rgba(184,134,11,.4),inset 0 2px 6px rgba(255,255,255,.15)}\
.tn-miclabel{margin-top:6px;font-size:12px;color:#7d7a6e;text-align:center}\
.tn-miclabel b{color:var(--color-primary)}\
.tn-recbox{width:100%;margin-top:12px;background:#fff;border:1px solid #e4dbc6;border-radius:12px;padding:14px;font-size:16.5px;line-height:1.8;color:#26241f;font-family:var(--fd);flex:1 1 auto;min-height:240px;max-height:62vh;overflow-y:auto;box-shadow:0 2px 10px rgba(84,66,32,.08)}\
.tn-recbox b{font-family:var(--fb);display:block;font-size:9.5px;color:#9c958a;margin-bottom:7px;font-weight:400;letter-spacing:1px}\
.tn-recbox textarea{width:100%;background:transparent;border:0;color:#26241f;font-size:16.5px;line-height:1.8;resize:vertical;outline:0;min-height:260px;font-family:var(--fd)}\
.tn-tags{width:100%;margin-top:10px;padding:11px 14px;border:1px solid #e4dbc6;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff;color:#26241f;outline:0;transition:var(--tf)}\
.tn-tags:focus{border-color:rgba(184,134,11,.6);box-shadow:0 0 0 3px rgba(184,134,11,.15)}\
.tn-tags::placeholder{color:#9c958a}\
.tn-style{display:flex;gap:5px;margin-top:12px;width:100%}\
.tn-style button{flex:1;min-width:0;min-height:40px;padding:0 2px;border:1px solid #d5cdb9;background:#fff;border-radius:10px;font-size:11px;color:#6b665c;cursor:pointer;transition:var(--tf)}\
.tn-style button .si{font-size:14px;display:block;margin-bottom:1px;transition:transform var(--tf)}\
.tn-style button.on{background:var(--color-primary);border-color:var(--color-primary);color:#f5ede0;font-weight:700;box-shadow:0 4px 14px rgba(168,50,42,.35)}\
.tn-style button.on .si{transform:scale(1.25)}\
.tn-style button .rec{display:none}\
.tn-style button.on .rec{display:inline-block;margin-left:3px;font-size:8px;background:var(--a3);color:#fff;border-radius:999px;padding:0 4px;vertical-align:1px}\
.tn-photos{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;width:100%}\
.tn-photo{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid #e4dbc6}\
.tn-photo img{width:100%;height:100%;object-fit:cover;display:block}\
.tn-photo .rm{position:absolute;top:-4px;right:-4px;background:var(--color-primary);color:#fff;border-radius:2px;width:20px;height:20px;font-size:11px;line-height:20px;text-align:center;cursor:pointer}\
.tn-addphoto{width:64px;height:64px;border:1.5px dashed #d5cdb9;border-radius:10px;background:#fff;color:#7d7a6e;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer}\
.tn-loading{display:none;text-align:center;color:#7d7a6e;font-size:13px;padding:14px 0}\
.tn-loading::before{content:"";display:inline-block;width:22px;height:22px;border:3px solid rgba(184,134,11,.25);border-top-color:#b8860b;border-radius:50%;animation:tnspin .8s linear infinite;margin-right:8px;vertical-align:-5px}\
@keyframes tnspin{to{transform:rotate(360deg)}}\
.tn-ai{margin-top:12px;width:100%;background:#fff;border:1px solid #e4dbc6;border-radius:12px;padding:14px;font-size:14.5px;line-height:1.9;color:#3a3731;white-space:pre-wrap;display:none;max-height:30vh;overflow-y:auto;font-family:var(--fd)}\
.tn-foot{padding:4px 20px calc(env(safe-area-inset-bottom,0px)+18px);position:relative;z-index:2;flex:0 0 auto;background:rgba(239,233,220,.55);border-top:1px solid rgba(38,36,31,.08)}\
.tn-acts{display:flex;gap:10px;margin-top:12px}\
.tn-acts button{flex:1;min-height:46px;border:0;border-radius:12px;font-size:14.5px;font-weight:700;cursor:pointer;transition:transform var(--tf),opacity var(--tf)}\
.tn-acts button:active{transform:scale(.97)}\
.tn-save{background:var(--color-primary);color:#f5ede0;box-shadow:0 4px 14px rgba(168,50,42,.28)}\
.tn-save:disabled{opacity:.4;box-shadow:none}\
.tn-repolish{background:#efe9dc;color:#26241f;border:1px solid #d5cdb9}\
.tn-note{font-size:11.5px;color:#7d7a6e;margin-top:10px;text-align:center;line-height:1.8}\
.tn-list{position:fixed;inset:0;z-index:9000;display:none;flex-direction:column;background:var(--bg)}\
.tn-listbar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px)+6px) 16px 8px;background:var(--b7);color:#efe9dc;border-bottom:2px solid var(--a3)}\
.tn-listbar .tn-x{background:rgba(255,255,255,.1);width:40px;height:40px}\
.tn-listbar b{font-family:var(--fd);font-size:17px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.06em}\
.tn-pill{background:rgba(255,255,255,.12);color:#efe9dc;border:1px solid rgba(255,255,255,.18);border-radius:2px;font-size:11.5px;font-weight:700;padding:8px 12px;cursor:pointer;transition:var(--tf)}\
.tn-pill:active{transform:scale(.95)}\
.tn-searchrow{background:var(--bg);padding:8px 16px 0}\
.tn-listbar input{flex:1;min-height:42px;padding:0 14px;border:1px solid var(--ln);border-radius:var(--r-sm,8px);font-size:14px;background:var(--sf);box-shadow:var(--sm);outline:0;color:var(--i9)}\
.tn-listbar input:focus{border-color:var(--a3);box-shadow:0 0 0 3px rgba(184,134,11,.14)}\
.tn-tagbar{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding:10px 16px;background:var(--bg);scrollbar-width:none}\
.tn-tagbar::-webkit-scrollbar{display:none}\
.tn-tagbar button{flex:0 0 auto;border:1px solid var(--ln);background:var(--sf);border-radius:var(--r-sm,8px);font-size:12.5px;padding:8px 14px;color:var(--i7);cursor:pointer;transition:var(--tf);min-height:36px}\
.tn-tagbar button.on{background:var(--b6);border-color:var(--b6);color:#f5ede0;font-weight:700;box-shadow:0 3px 10px rgba(200,109,75,.22)}\
.tn-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 16px 4px;background:var(--bg)}\
.tn-statbox{background:var(--sf);border:1px solid var(--ln);border-radius:10px;padding:9px 2px;text-align:center;box-shadow:var(--sm)}\
.tn-statbox b{display:block;font-size:19px;font-weight:700;color:var(--b6);font-family:var(--fd)}\
.tn-statbox span{font-size:10px;color:var(--i5)}\
.tn-listbody{flex:1;overflow-y:auto;padding:4px 16px 24px;background:var(--bg)}\
.tn-timeline{position:relative;padding-left:26px}\
.tn-timeline::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:var(--a3);opacity:.35}\
.tn-tl-date{display:flex;align-items:center;gap:10px;font-family:var(--fd);font-size:15px;font-weight:700;color:var(--b7);margin:16px 0 11px;position:relative;letter-spacing:.06em}\
.tn-tl-date::before{content:"";position:absolute;left:-24px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:2px;background:var(--b6);box-shadow:0 0 0 3px rgba(200,109,75,.12);transform:translateY(-50%) rotate(45deg)}\
.tn-tl-date small{font-family:var(--fb);font-weight:400;color:var(--i5);font-size:11px;letter-spacing:0}\
.tn-item{background:var(--sf);border-radius:12px;box-shadow:var(--sm);padding:12px 14px;margin-bottom:9px;border:1px solid var(--ln);transition:var(--tn)}\
.tn-item:active{transform:scale(.985)}\
.tn-item h4{margin:0 0 3px;font-family:var(--fd);font-size:15.5px;color:var(--i9);letter-spacing:.03em}\
.tn-item .tm{font-size:11px;color:var(--i5);margin-bottom:5px;line-height:1.7}\
.tn-item .tx{font-size:14px;color:var(--i7);line-height:1.8;white-space:pre-wrap;max-height:120px;overflow:hidden;cursor:pointer;position:relative}\
.tn-item .tx.open{max-height:none;overflow:visible}\
.tn-item .tx:not(.open)::after{content:"… 点此展开全文";position:absolute;right:0;bottom:0;left:0;text-align:right;background:linear-gradient(90deg,transparent,var(--sf) 40%);color:var(--b6);font-size:11px;padding:2px 6px}\
.tn-item .tags{display:flex;gap:5px;margin:7px 0 0;flex-wrap:wrap}\
.tn-item .tags span{background:var(--color-primary-soft);color:var(--b6);border-radius:2px;font-size:11px;padding:3px 10px;font-weight:600}\
.tn-item .pics{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}\
.tn-item .pics img{width:76px;height:76px;border-radius:3px;object-fit:cover;cursor:pointer;box-shadow:var(--sm)}\
.tn-item audio{width:100%;margin-top:9px;height:36px}\
.tn-item .tg{display:flex;gap:8px;margin-top:12px}\
.tn-item .tg button{flex:1;min-height:42px;padding:0 6px;border:1px solid var(--ln);background:var(--sf2);border-radius:3px;font-size:12.5px;font-weight:700;color:var(--b7);cursor:pointer;transition:var(--tf)}\
.tn-item .tg button:active{transform:scale(.96)}\
.tn-item .tg button.danger{background:transparent;color:var(--color-primary)}\
.tn-empty{padding:70px 30px;text-align:center}\
.tn-empty .em{font-size:54px;margin-bottom:12px;animation:tnfloat 3.2s ease-in-out infinite}\
@keyframes tnfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}\
.tn-empty b{display:block;font-family:var(--fd);font-size:19px;color:var(--i9);margin-bottom:6px;letter-spacing:.06em}\
.tn-empty span{font-size:13px;color:var(--i5);line-height:1.9}\
.tn-settings{position:fixed;left:0;right:0;bottom:0;z-index:9002;display:none;padding:16px 16px calc(env(safe-area-inset-bottom,0px)+20px);background:var(--sf);border:1px solid var(--ln);border-top:1px solid var(--a3);border-radius:16px 16px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.18);max-height:90dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}\
.tn-settings h4{margin:0 0 12px;font-family:var(--fd);font-size:17px;color:var(--i9);letter-spacing:.08em;border-bottom:1px solid var(--ln);padding-bottom:8px}\
.tn-settings .setcard{background:var(--sf2);border:1px solid var(--ln);border-radius:12px;padding:12px 14px;box-shadow:var(--sm)}\
.tn-settings input{width:100%;min-height:48px;padding:0 14px;border:1px solid var(--ln);border-radius:3px;font-size:14px;box-sizing:border-box;background:#fff;outline:0;color:var(--i9)}\
.tn-settings input:focus{border-color:var(--a3);box-shadow:0 0 0 3px rgba(184,134,11,.14)}\
.tn-settings p{font-size:11px;color:var(--i5);margin:10px 0 0;line-height:1.8}\
.tn-settings .tn-style{margin-top:10px}\
.tn-settings .tn-style button{border-color:var(--ln);background:#fff;color:var(--i7)}\
.tn-settings .tn-style button.on{background:var(--color-primary);border-color:var(--color-primary);color:#f5ede0}\
.tn-settings button{margin-top:12px;width:100%;min-height:50px;border:0;border-radius:3px;background:var(--b6);color:#f5ede0;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(168,50,42,.2)}\
.tn-switchrow{display:flex;align-items:center;gap:10px;margin-top:12px}\
.tnswitch{width:48px;height:28px;border-radius:2px;background:var(--b6);position:relative;flex:0 0 auto;cursor:pointer;transition:var(--tf)}\
.tnswitch::after{content:"";position:absolute;top:3px;right:3px;width:22px;height:22px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:var(--tf)}\
.tnswitch.off{background:var(--ln)}\
.tnswitch.off::after{right:auto;left:3px}\
.tn-wall{position:fixed;inset:0;z-index:9004;background:var(--bg);display:none;flex-direction:column}\
.tn-wall .bar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px)+8px) 16px 8px;background:var(--b7);color:#efe9dc;border-bottom:2px solid var(--a3)}\
.tn-wall .bar b{font-family:var(--fd);font-size:17px;flex:1;letter-spacing:.06em}\
.tn-wall .grid{column-count:3;column-gap:6px;padding:6px}\
.tn-wall .grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:3px;cursor:pointer;box-shadow:var(--sm);transition:var(--tf)}\
.tn-wall .grid img:active{transform:scale(.97)}\.tn-editpage{position:fixed;inset:0;z-index:9010;display:none;flex-direction:column;background:var(--bg)}\.tn-editpage .bar{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px)+6px) 16px 8px;background:linear-gradient(135deg,var(--b7),var(--b9));color:#efe9dc;border-bottom:2px solid var(--a3)}\.tn-editpage .bar .tn-x{background:rgba(255,255,255,.12);color:#efe9dc}\.tn-editpage .bar b{font-family:var(--fd);font-size:16px;flex:1;letter-spacing:.06em}\.tn-editpage .body{flex:1;overflow-y:auto;padding:14px 16px}\.tn-editpage .lbl{display:block;font-size:12px;color:var(--i5);margin:12px 0 6px;font-weight:600;letter-spacing:.05em}\.tn-editpage .body input{width:100%;min-height:46px;padding:0 14px;border:1px solid var(--ln);border-radius:10px;font-size:14px;background:#fff;color:var(--i9);outline:0;box-sizing:border-box}\.tn-editpage .body input:focus{border-color:var(--a3);box-shadow:0 0 0 3px rgba(184,134,11,.14)}\.tn-editpage .body textarea{width:100%;min-height:34vh;padding:12px 14px;border:1px solid var(--ln);border-radius:10px;font-size:15px;line-height:1.8;background:#fff;color:var(--i9);outline:0;box-sizing:border-box;resize:vertical;font-family:var(--fd)}\.tn-editpage .foot{padding:12px 16px calc(env(safe-area-inset-bottom,0px)+16px);border-top:1px solid var(--ln);background:var(--sf)}\.tn-editpage .foot button{width:100%;min-height:50px;border:0;border-radius:12px;background:var(--color-primary);color:#fff;font-size:15px;font-weight:700;cursor:pointer}\
.tn-dlg{position:fixed;left:0;right:0;bottom:0;z-index:9003;display:none;padding:20px 16px calc(env(safe-area-inset-bottom,0px)+20px);background:var(--sf);border:1px solid var(--ln);border-top:2px solid var(--a3);border-radius:6px 6px 0 0;box-shadow:0 -10px 44px rgba(0,0,0,.2);max-height:82%;overflow-y:auto}\
.tn-dlg h4{display:flex;justify-content:space-between;align-items:center;margin:0 0 14px;font-family:var(--fd);font-size:18px;color:var(--i9);letter-spacing:.06em}\
.tn-dlg .tn-x{background:var(--sf2);color:var(--i5)}\
.tn-dlg textarea{width:100%;min-height:130px;border:1px solid var(--ln);border-radius:3px;padding:12px;font-size:14px;box-sizing:border-box;line-height:1.8;outline:0;color:var(--i9);background:#fff}\
.tn-dlg textarea:focus{border-color:var(--a3);box-shadow:0 0 0 3px rgba(184,134,11,.14)}\
.tn-dlg input{width:100%;min-height:46px;padding:0 13px;border:1px solid var(--ln);border-radius:3px;font-size:14px;box-sizing:border-box;margin-bottom:8px;outline:0;color:var(--i9);background:#fff}\
.tn-dlg input:focus{border-color:var(--a3)}\
.tn-dlg button{margin-top:12px;width:100%;min-height:50px;border:0;border-radius:3px;background:var(--b6);color:#f5ede0;font-size:15px;font-weight:700;cursor:pointer}\
.tn-dlg .copy{background:var(--sf2);color:var(--b7);border:1px solid var(--ln)}\
.tn-dlg .statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}\
.tn-dlg .statgrid div{background:var(--sf2);border:1px solid var(--ln);border-radius:3px;padding:12px 2px;text-align:center}\
.tn-dlg .statgrid b{display:block;font-size:22px;font-weight:700;color:var(--b6);font-family:var(--fd)}\
.tn-dlg .statgrid span{font-size:10.5px;color:var(--i5)}\
.tn-dlg .monthline{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--i7)}\
.tn-dlg .monthline b{color:var(--b6)}\
.tn-cardcanvas{position:fixed;left:-9999px;top:0}\
.tn-quotes{position:fixed;inset:0;z-index:9005;display:none;flex-direction:column;background:var(--bg)}\
.tn-quotes .bar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px)+8px) 16px 8px;background:var(--b7);color:#efe9dc;border-bottom:1px solid var(--a3)}\
.tn-quotes .bar b{font-family:var(--fd);font-size:16px;flex:1;min-width:0;letter-spacing:.06em}\
.tn-quotes .bar .tn-x{background:rgba(255,255,255,.1);width:36px;height:36px}\
.tn-quotes .sr{display:flex;gap:8px;padding:10px 16px 4px}\
.tn-quotes .sr input{flex:1;min-height:40px;padding:0 14px;border:1px solid var(--ln);border-radius:10px;font-size:14px;background:#fff;outline:0;color:var(--i9)}\
.tn-quotes .sr input:focus{border-color:var(--a3);box-shadow:0 0 0 3px rgba(184,134,11,.14)}\
.tn-quotes .hint{padding:6px 18px 2px;font-size:11.5px;color:var(--i5);font-family:var(--fb);letter-spacing:.03em}\
.tn-quotes .body{flex:1;overflow-y:auto;padding:8px 16px 24px}\
.tn-quote{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:12px 14px;margin-bottom:9px;box-shadow:var(--sm);cursor:pointer;transition:transform .12s,border-color .15s}\
.tn-quote:active{transform:scale(.985)}\
.tn-quote .qt{font-size:14.5px;color:var(--i9);line-height:1.7;font-family:var(--fd)}\
.tn-quote .qa{font-size:11.5px;color:var(--b6);margin-top:6px;font-family:var(--fb)}\
.tn-quote .qa .at{color:var(--i5)}\
.tn-quote .add{display:inline-block;margin-top:8px;font-size:11px;color:var(--b7);border:1px solid var(--ln);border-radius:999px;padding:3px 10px;font-family:var(--fb)}\
.tn-quotes .empty{padding:36px 20px;text-align:center;font-size:13px;color:var(--i5);line-height:1.9;font-family:var(--fb)}\
.tn-quotes .web{display:block;width:100%;margin-top:4px;min-height:44px;border:0;border-radius:10px;background:var(--b6);color:#f5ede0;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--fb)}\
.tn-flash{position:fixed;top:calc(env(safe-area-inset-top,0px)+14px);left:50%;transform:translateX(-50%);background:rgba(31,54,52,.97);color:#efe9dc;padding:11px 20px;border-radius:3px;font-size:13.5px;font-weight:700;z-index:9500;display:none;box-shadow:0 6px 24px rgba(0,0,0,.3)}\
@media (max-width:380px){.tn-body{padding-left:14px;padding-right:14px}.tn-head{padding-left:12px;padding-right:12px}.tn-ring{width:172px;height:172px}.tn-mic{width:92px;height:92px}.tn-recbox,.tn-ai{font-size:18px}.tn-listbar{padding-left:12px;padding-right:12px}.tn-item{padding:12px 13px}}\
.tn-guide{position:fixed;inset:0;z-index:9006;display:none;flex-direction:column;background:linear-gradient(175deg,#1f2b26 0%,#141a17 100%);color:#efe9dc}\
.tn-guide .bar{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px)+8px) 16px 10px;border-bottom:1px solid rgba(239,233,220,.08)}\
.tn-guide .bar .tn-x{background:rgba(255,255,255,.08);width:36px;height:36px}\
.tn-guide .bar b{flex:1;font-family:var(--fd);font-size:16px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.05em}\
.tn-guide .bar .spk{flex:0 0 auto;background:var(--b6);border:0;color:#f5ede0;border-radius:10px;height:36px;padding:0 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:var(--fb)}\
.tn-guide .body{flex:1;overflow-y:auto;padding:16px 18px calc(env(safe-area-inset-bottom,0px)+20px);line-height:1.9;font-size:15px;color:#e8e2d3;font-family:var(--fd);white-space:pre-wrap}\
.tn-guide .loading{display:none;padding:40px 20px;text-align:center;color:var(--d3);font-size:13.5px;font-family:var(--fb)}\
.tn-guide .loading::before{content:"";display:inline-block;width:24px;height:24px;border:3px solid rgba(184,134,11,.25);border-top-color:#b8860b;border-radius:50%;animation:tnspin .8s linear infinite;margin-right:10px;vertical-align:-6px}\
.tn-guide .hint{font-size:11.5px;color:var(--d3);margin-top:14px;line-height:1.8;font-family:var(--fb)}\
.tn-viewrow{display:flex;gap:6px;padding:10px 16px 0;background:var(--bg)}\
.tn-viewtab{flex:1;background:rgba(255,255,255,.06);color:var(--i5);border:1px solid var(--ln);border-radius:2px;font-size:12.5px;font-weight:700;padding:9px 0;cursor:pointer;font-family:var(--fb);transition:var(--tf)}\
.tn-viewtab.on{background:var(--b6);color:#f5ede0;border-color:var(--b6)}\
.tn-trip{background:var(--sf);border:1px solid var(--ln);border-radius:12px;box-shadow:var(--sm);margin:14px 0;overflow:hidden;transition:var(--tn)}\
.tn-trip-head{display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer}\
.tn-trip-cover{width:46px;height:46px;border-radius:6px;object-fit:cover;flex:0 0 auto;background:var(--sf2)}\
.tn-trip-cover.none{display:flex;align-items:center;justify-content:center;background:var(--color-primary-soft);color:var(--b6);font-size:17px;font-weight:700}\
.tn-trip-info{flex:1;min-width:0}\
.tn-trip-info b{display:block;font-family:var(--fd);font-size:15px;color:var(--i9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.tn-trip-info .tt-meta{font-size:11px;color:var(--i5);margin-top:2px}\
.tn-trip-info .tt-meta em{font-style:normal;color:var(--b6);font-weight:700}\
.tn-trip-arrow{flex:0 0 auto;color:var(--i5);font-size:12px;transition:transform .2s}\
.tn-trip.open .tn-trip-arrow{transform:rotate(180deg)}\
.tn-trip-body{display:none;border-top:1px dashed var(--ln);padding:10px 14px 14px}\
.tn-trip.open .tn-trip-body{display:block}\
.tn-tl-year,.tn-tl-month{display:flex;align-items:center;gap:8px;cursor:pointer;margin:14px 0 4px}\
.tn-tl-year{font-family:var(--fd);font-size:16px;font-weight:700;color:var(--b7);letter-spacing:.06em}\
.tn-tl-month{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--b6);margin-left:4px}\
.tn-tl-year .ar,.tn-tl-month .ar{transition:transform .2s;font-size:11px;color:var(--i5)}\
.tn-tl-year.collapsed .ar,.tn-tl-month.collapsed .ar{transform:rotate(-90deg)}\
.tn-tl-year small,.tn-tl-month small{font-family:var(--fb);font-weight:400;color:var(--i5);font-size:11px}\
.tn-timeline .tn-tl-date{margin-top:6px}\
.tn-cfm{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;background:rgba(32,32,29,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}\
.tn-cfm .tc-box{background:#faf8f3;border-radius:16px;padding:22px 20px 18px;width:82vw;max-width:320px;box-shadow:0 12px 32px rgba(0,0,0,.3);text-align:center}\
.tn-cfm .tc-txt{font-size:14px;color:#2c2c29;line-height:1.7;margin-bottom:16px;font-family:var(--fb)}\
.tn-cfm .tc-btns{display:flex;gap:10px}\
.tn-cfm .tc-btns button{flex:1;min-height:42px;border:0;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--fb)}\
.tn-cfm .tc-no{background:#efe9dc;color:#6b665c}\
.tn-cfm .tc-ok{background:#c0392b;color:#fff}\
';

  /* ---------- UI 构建 ---------- */
  var ui = null;
  function buildUI() {
    if (ui) return;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    var mask = el('div', 'tn-mask');
    mask.onclick = closePanel;
    // 录音面板（深色沉浸）
    var panel = el('div', 'tn-panel');
    panel.innerHTML = '\
<div class="tn-head"><button class="tn-x" id="tnX">←</button><div class="tn-title"><b>留下这一刻</b><small class="tn-site" id="tnSite"></small></div><span class="tn-pause">🎙 5 秒停顿</span></div>\
<div class="tn-body">\
  <div class="tn-now" id="tnNow"></div>\
  <div class="tn-prompt" id="tnPrompt">你到了这里。<br>如果愿意，说说现在看到的。</div>\
  <div class="tn-ring" id="tnRing"></div>\
  <div class="tn-miclabel" id="tnMicLabel">点按，开始 · <b>慢慢说，说完稍等</b></div>\
  <div class="tn-recbox" id="tnRaw"><b>语音转写 · 可说一段话，说完稍等即可</b></div>\
  <input class="tn-tags" id="tnTitle" placeholder="题目（可自拟，留空则用景点名）">\
  <input class="tn-tags" id="tnTags" placeholder="标签（空格分隔，如：日出 美食 徒步）">\
  <div class="tn-style" id="tnStyle"></div>\
  <div class="tn-photos" id="tnPhotos"></div>\
  <input type="file" id="tnFile" accept="image/*" multiple style="display:none">\
  <div class="tn-loading" id="tnLoading">正在整理这段旅程……</div>\
  <div class="tn-ai" id="tnAI"></div>\
</div>\
<div class="tn-foot">\
  <div class="tn-acts">\
    <button class="tn-repolish" id="tnPolish" style="display:none">整理一下</button>\
    <button class="tn-repolish" id="tnQuote" >追加名言</button>\
    <button class="tn-save" id="tnSave" disabled>保存游记</button>\
  </div>\
  <div class="tn-confirm" id="tnConfirm">\
    <div class="tc-txt">听见了。<br>要不要留下这段记忆？</div>\
    <div class="tc-btns"><button class="tn-cfm-save" id="tnCfmSave">保存</button><button class="tn-cfm-again" id="tnCfmAgain">再说一点</button></div>\
  </div>\
  <div class="tn-quotes" id="tnQuotes">\
    <div class="bar"><button class="tn-x" id="tnQuoteBack">←</button><b>名言检索</b></div>\
    <div class="sr"><input id="tnQuoteSearch" placeholder="搜索关键词（如：云冈 / 山水 / 苍山）"><button class="tn-x" id="tnQuoteClear" style="width:40px;height:40px;background:var(--sf2);color:var(--i5)">✕</button></div>\
    <div class="hint" id="tnQuoteHint">检索与当前地点相关的名言，点选一条即可追加到正文</div>\
    <div class="body" id="tnQuoteList"></div>\
  </div>\
  <div class="tn-note" id="tnNote"></div>\
</div>';
    // 生成声波环（24 根环形条）+ 中央麦克风
    var ring = $X(panel, '#tnRing'), N = 24;
    for (var i = 0; i < N; i++) {
      var rb = document.createElement('span');
      rb.className = 'tn-ringbar';
      rb.style.transform = 'rotate(' + (i * 360 / N) + 'deg) translateY(-' + 44 + 'px)';
      ring.appendChild(rb);
    }
    var mic = el('button', 'tn-mic');
    mic.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
    mic.id = 'tnRec';
    ring.appendChild(mic);
    STYLES.forEach(function (st, i) {
      var b = el('button', i === 0 ? 'on' : '', '<span class="si">' + st.icon + '</span>' + st.name + (st.rec ? '<span class="rec">推荐</span>' : ''));
      b.dataset.id = st.id;
      panel.querySelector('#tnStyle').appendChild(b);
    });
    panel.querySelectorAll('#tnStyle button').forEach(function (b) {
      b.onclick = function () {
        panel.querySelectorAll('#tnStyle button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    $X(panel, '#tnX').onclick = closePanel;
    $X(panel, '#tnRec').onclick = toggleRec;
    // 菜单项互斥高亮（bottom-nav 语义：当前激活项白底高亮）
    function setActs(activeId){
      ['tnPolish','tnQuote'].forEach(function(id){
        var b = panel.querySelector('#'+id);
        if (b) b.classList.toggle('on', id === activeId);
      });
    }
    $X(panel, '#tnPolish').onclick = doPolish;
    $X(panel, '#tnSave').onclick = saveNote;
    // 两段确认：保存 / 再说一点（保存复用 saveNote；再说一点 = 追加补充，保留已说内容）
    $X(panel, '#tnCfmSave').onclick = function () { $X(panel, '#tnSave').click(); };
    $X(panel, '#tnCfmAgain').onclick = function () {
      state.append = true;   // 追加模式：识别完成后拼接到已有内容，而不是重说
      $X(ui.panel, '#tnNote').textContent = '继续说吧，会接到刚才的内容后面';
      $X(panel, '#tnRec').click();
    };
    $X(panel, '#tnFile').onchange = onPickPhotos;
    // 名人名言检索面板
    var qq = $X(panel, '#tnQuotes');
    var qs = $X(panel, '#tnQuoteSearch');
    var qlist = $X(panel, '#tnQuoteList');
    function quoteSiteKeyword(){
      return (state.site && (state.site.label || state.site.name)) || '';
    }
    function quoteFilter(q){
      q = (q||'').trim().toLowerCase();
      var all = window.QUOTES || [];
      if(!q) return all.slice(0, 12);
      var hits = all.filter(function(it){
        // 关键词双向包含，但单字关键词（如「山」「星」）仅作独立词匹配避免误配
        var kw = it.k.some(function(k){
          if(!k) return false;
          var kk = k.toLowerCase();
          if(kk.length === 1) return q === kk;               // 单字关键词：必须完全相等
          return q.indexOf(kk) >= 0 || kk.indexOf(q) >= 0;   // 多字关键词：双向包含
        });
        return kw || (it.t||'').toLowerCase().indexOf(q) >= 0 || (it.a||'').toLowerCase().indexOf(q) >= 0;
      });
      return hits;
    }
    function renderQuotes(q){
      var hits = quoteFilter(q);
      qlist.innerHTML = '';
      if(!hits.length){
        var kw = (qs.value||'').trim() || quoteSiteKeyword() || '旅行';
        qlist.innerHTML = '<div class="empty">本地词库暂无「'+esc(kw)+'」相关名言。<br>可调整关键词，或为你查找相关名句。</div>'
          + '<button class="web" id="tnQuoteAI">查找相关名言</button>';
        var ab = qlist.querySelector('#tnQuoteAI');
        if(ab) ab.onclick = function(){ aiGenQuotes(kw); };
        return;
      }
      hits.forEach(function(it){
        var d = document.createElement('div');
        d.className = 'tn-quote';
        d.innerHTML = '<div class="qt">' + esc(it.t) + '</div>'
          + '<div class="qa">' + esc(it.a) + '<span class="at"> · ' + esc(it.s||'') + '</span></div>'
          + (it.y ? '<div class="qa" style="color:var(--i5);margin-top:2px">' + esc(it.y) + '</div>' : '')
          + '<span class="add">＋ 追加到正文</span>';
        d.onclick = function(){ appendQuote(it); };
        qlist.appendChild(d);
      });
      // 列表底部常驻「查找更多」入口，可补充本地词库
      var aiBtn = el('button', 'web', '查找更多相关名言');
      aiBtn.onclick = function(){ aiGenQuotes((qs.value||'').trim() || quoteSiteKeyword() || '旅行'); };
      qlist.appendChild(aiBtn);
    }
    // 调用 DeepSeek 生成相关名言（诗/词/文章），结果渲染为可点选卡片
    function aiGenQuotes(kw){
      var key = localStorage.getItem(AI_KEY);
      if(!key){ openSettings(); flash('请先设置 DeepSeek API key'); return; }
      qlist.innerHTML = '<div class="empty">正在为你检索「'+esc(kw)+'」检索名句…</div>';
      var rawM = localStorage.getItem('tn_model') || 'deepseek-v4-flash';
      var model = MODEL_ALIAS[rawM] || rawM;
      var body = {
        model: model,
        messages: [
          { role: 'system', content: '你是古典文学与名人名言专家。根据用户给的地点或关键词，输出 4~6 条与该地点/主题最贴切的古诗、词或名句。只输出 JSON 数组，不要任何多余文字，格式：[{"t":"诗句或名句","a":"作者","s":"出处或篇名"}]，每条 t 要完整。' },
          { role: 'user', content: kw }
        ],
        temperature: 0.8
      };
      if (model === 'deepseek-v4-pro') body.reasoning_effort = 'high';
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body)
      }).then(function(r){
        if(!r.ok) throw new Error('http');
        return r.json();
      }).then(function(data){
        var txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
        var list = [];
        try { list = JSON.parse(txt.replace(/```json|```/g,'').trim()); }
        catch(e){ list = []; }
        if(!list.length){
          qlist.innerHTML = '<div class="empty">AI 未能生成有效结果，可换个关键词重试。</div>';
          return;
        }
        qlist.innerHTML = '<div class="hint" style="padding:4px 2px 8px;color:var(--b6)">为你找到 · '+esc(kw)+'</div>';
        list.forEach(function(it){
          if(!it || !it.t) return;
          var d = document.createElement('div');
          d.className = 'tn-quote';
          d.innerHTML = '<div class="qt">' + esc(it.t) + '</div>'
            + '<div class="qa">' + esc(it.a||'佚名') + '<span class="at"> · ' + esc(it.s||'') + '</span></div>'
            + '<span class="add">＋ 追加到正文</span>';
          d.onclick = function(){ appendQuote(it); };
          qlist.appendChild(d);
        });
      }).catch(function(err){
        qlist.innerHTML = '<div class="empty">AI 检索失败：' + esc(String(err && err.message || err)) + '。<br>请检查网络或 API key 后重试。</div>';
      });
    }
    function appendQuote(it){
      // 追加到转写正文末尾（若已有 AI 结果则追加到结果末尾）
      var line = '「' + it.t + '」——' + it.a + (it.s ? '《' + it.s.replace(/[《》]/g,'') + '》' : '');
      var edit = $X(panel, '#tnRawEdit');
      if(edit){
        edit.value = (edit.value ? edit.value.trim() + '\n\n' : '') + line;
        edit.focus();
      } else if(state.raw){
        state.raw = state.raw.trim() + '\n\n' + line;
        $X(panel, '#tnRaw').innerHTML = '<b>转写完成（可编辑）</b><textarea id="tnRawEdit" placeholder="可修改转写内容…">' + esc(state.raw) + '</textarea>';
      } else {
        state.raw = line;
        $X(panel, '#tnRaw').innerHTML = '<b>正文（已加入名言）</b><textarea id="tnRawEdit" placeholder="可继续修改…">' + esc(line) + '</textarea>';
        var p = $X(panel, '#tnPolish');
        p.style.display = 'block';
        $X(panel, '#tnSave').disabled = false;
      }
      qq.style.display = 'none';
      flash('已追加名言 · 正文已有内容，可点「整理一下」生成美文');
    }
    $X(panel, '#tnQuote').onclick = function(){
      var kw = quoteSiteKeyword();
      qs.value = kw;
      renderQuotes(kw);
      $X(panel, '#tnQuoteHint').textContent = kw ? ('已按当前地点「' + kw + '」检索，可修改关键词') : '输入关键词检索相关名言';
      qq.style.display = 'flex';
    };
    $X(panel, '#tnQuoteBack').onclick = function(){ qq.style.display = 'none'; panel.style.display = 'flex'; };
    $X(panel, '#tnQuoteClear').onclick = function(){ qs.value = ''; renderQuotes(''); };
    qs.oninput = function(){ renderQuotes(qs.value); };
    // 讲解面板（AI 随行讲解）
    var guide = el('div', 'tn-guide');
    guide.innerHTML = '\
<div class="bar"><button class="tn-x" id="tnGuideX">✕</button><b id="tnGuideTitle">🎧 随行讲解</b><button class="spk" id="tnGuidePlay">▶ 播放</button></div>\
<div class="loading" id="tnGuideLoad">正在为你讲解…</div>\
<div class="body" id="tnGuideBody"></div>\
<div class="hint" id="tnGuideHint"></div>';
    var gBody = guide.querySelector('#tnGuideBody'), gLoad = guide.querySelector('#tnGuideLoad');
    var gPlay = guide.querySelector('#tnGuidePlay'), gHint = guide.querySelector('#tnGuideHint');
    var guideText = '', guideSpeech = null;
    function stopGuideSpeech(){ if (guideSpeech) { try { speechSynthesis.cancel(); } catch(e){} guideSpeech = null; gPlay.textContent = '▶ 播放'; } }
    $X(guide, '#tnGuideX').onclick = function(){ guide.style.display = 'none'; stopGuideSpeech(); };
    guide.onclick = function(e){ if(e.target===guide) { guide.style.display='none'; stopGuideSpeech(); } };
    gPlay.onclick = function(){
      if (!guideText) return;
      if (gPlay.textContent === '⏸ 暂停') { try { speechSynthesis.pause(); } catch(e){} gPlay.textContent = '▶ 继续'; return; }
      if (gPlay.textContent === '▶ 继续') { try { speechSynthesis.resume(); } catch(e){} gPlay.textContent = '⏸ 暂停'; return; }
      try {
        stopGuideSpeech();
        var u = new SpeechSynthesisUtterance(guideText);
        u.lang = 'zh-CN';
        u.rate = 1.02;
        u.onstart = function(){ gPlay.textContent = '⏸ 暂停'; };
        u.onend = function(){ gPlay.textContent = '▶ 播放'; };
        u.onerror = function(){ gPlay.textContent = '▶ 播放'; };
        guideSpeech = u;
        speechSynthesis.speak(u);
      } catch(e){ flash('当前设备不支持语音朗读'); }
    };
    function showGuide(title, text){
      guideText = text;
      gBody.textContent = text;
      gLoad.style.display = 'none';
      gBody.style.display = 'block';
      gHint.textContent = '内容由 AI 生成，可能有误差，仅供游览参考 · 点击上方「▶ 播放」可语音朗读';
      guide.querySelector('#tnGuideTitle').textContent = '🎧 随行讲解 · ' + title;
      guide.style.display = 'flex';
      // 关闭录音面板与弹层，避免遮挡
      if (ui.panel) ui.panel.style.display = 'none';
      if (ui.mask) ui.mask.style.display = 'none';
    }
    function startGuide(iOrSite){
      var site = typeof iOrSite === 'object' ? iOrSite : (GETSITE ? GETSITE(iOrSite) : null);
      if (!site) { flash('未找到该景点'); return; }
      var key = localStorage.getItem(AI_KEY);
      if (!key) { guide.style.display = 'none'; openSettings(); flash('请先设置 DeepSeek API key，即可 AI 讲解'); return; }
      stopGuideSpeech();
      gLoad.style.display = 'block';
      gBody.style.display = 'none';
      gHint.textContent = '';
      guide.querySelector('#tnGuideTitle').textContent = '🎧 随行讲解 · ' + (site.label || site.name || '');
      guide.style.display = 'flex';
      if (ui.panel) ui.panel.style.display = 'none';
      if (ui.mask) ui.mask.style.display = 'none';
      var rawM = localStorage.getItem('tn_model') || 'deepseek-v4-flash';
      var model = MODEL_ALIAS[rawM] || rawM;
      var prompt = '你是专业的景区讲解员。请用亲切口语化的中文，为游客讲解「' + (site.label||site.name||'') + '」'
        + '（地点：' + (site.city||site.county||'') + '，类型：' + (site.ty||'') + '，年代：' + (site.dy||'') + '）。'
        + '介绍它最值得看的地方、背后的历史或故事，200-350字，语气自然像现场导览，可分两三段，不要用列表编号，不要编造不确定的史实。';
      var body = { model: model, messages: [
        { role: 'system', content: '你是资深景区讲解员，讲解生动准确、口语自然、有画面感。' },
        { role: 'user', content: prompt }
      ], temperature: 0.7 };
      if (model === 'deepseek-v4-pro') body.reasoning_effort = 'high';
      body.stream = true;
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body)
      }).then(function(r){
        if(!r.ok) throw new Error('http');
        var reader = r.body.getReader(), decoder = new TextDecoder(), buf = '', text = '';
        gBody.style.display = 'block';
        function pump(){
          return reader.read().then(function(res){
            if (res.done){ gLoad.style.display='none'; showGuide(site.label||site.name||'', text); return; }
            buf += decoder.decode(res.value, { stream: true });
            var lines = buf.split('\n'); buf = lines.pop();
            lines.forEach(function(line){
              if (!line.startsWith('data: ')) return;
              var json = line.slice(6).trim(); if (json === '[DONE]') return;
              try { var c = JSON.parse(json).choices[0].delta; if (c && c.content) text += c.content; } catch(e){}
            });
            gBody.textContent = text;
            gBody.scrollTop = gBody.scrollHeight;
            return pump();
          });
        }
        return pump();
      }).catch(function(err){
        gLoad.style.display = 'none';
        gBody.style.display = 'block';
        gBody.textContent = '讲解生成失败：' + String(err && err.message || err) + '。请检查网络后重试。';
      });
    }
    startGuideRef = startGuide;
    // 讲解入口（最终在模块导出区暴露为 TravelNotes.explain）
    // 列表（纸感 + 藤蔓时间线）
    var list = el('div', 'tn-list');
    list.innerHTML = '\
<div class="tn-listbar">\
  <div class="tn-listbar__row1"><button class="tn-x" id="tnListBack" style="font-size:18px">←</button><b>我的游记</b><button class="tn-x" id="tnSetBtn" style="font-size:13px">设置</button></div>\
  <div class="tn-listbar__row2"><button class="tn-pill" id="tnWallBtn" style="display:none">照片墙</button>\
  <button class="tn-pill" id="tnDocBtn">文档</button>\
  <button class="tn-pill" id="tnStatsBtn">统计</button>\
  <button class="tn-pill" id="tnExpBtn">导出</button>\
  <button class="tn-pill" id="tnImpBtn">导入</button></div>\
</div>\
<div class="tn-listbar tn-searchrow"><input id="tnSearch" placeholder="搜景点 / 内容 / 标签…"></div>\
<div class="tn-viewrow"><button class="tn-viewtab on" id="tnViewTrip">旅程</button><button class="tn-viewtab" id="tnViewTime">时间线</button></div>\
<div class="tn-tagbar" id="tnTagBar" style="display:none"></div>\
<div class="tn-stats" id="tnStats"></div>\
<div class="tn-listbody"><div class="tn-timeline" id="tnListBody"></div></div>';
    $X(list, '#tnListBack').onclick = function () { list.style.display = 'none'; };
    $X(list, '#tnWallBtn').onclick = openPhotoWall;
    $X(list, '#tnDocBtn').onclick = exportDoc;
    $X(list, '#tnStatsBtn').onclick = showStats;
    $X(list, '#tnExpBtn').onclick = exportNotes;
    $X(list, '#tnImpBtn').onclick = importNotes;
    $X(list, '#tnSetBtn').onclick = function () { location.href = 'settings.html'; };
    $X(list, '#tnSearch').oninput = renderList;
    $X(list, '#tnViewTrip').onclick = function () { viewMode = 'trip'; setViewTabs(); renderList(); };
    $X(list, '#tnViewTime').onclick = function () { viewMode = 'timeline'; setViewTabs(); renderList(); };
    // 设置（毛玻璃分组：AI 润色 / 语音记录 / 数据备份）
    var set = el('div', 'tn-settings');
    set.innerHTML = '\
<h4>设置 <button class="tn-x" id="tnKeyClose" style="font-size:14px">✕</button></h4>\
<div class="setcard" style="margin-bottom:12px">\
  <b style="display:block;font-size:13px;color:var(--color-ink);margin-bottom:10px">AI 润色设置</b>\
  <input id="tnKeyInput" placeholder="sk-xxxxxxxx（存本机，用于 AI 润色）">\
  <div class="tn-style" id="tnModel"></div>\
  <p>key 仅保存在本机 localStorage，不经过任何服务器。可在 platform.deepseek.com 获取。</p>\
</div>\
<div class="setcard" style="margin-bottom:12px">\
  <b style="display:block;font-size:13px;color:var(--color-ink);margin-bottom:10px">🎙 语音记录</b>\
  <div style="font-size:12.5px;color:var(--i7);margin-bottom:6px">⏸ 停止说话多久自动结束（仅 App 内生效）</div>\
  <div class="tn-style" id="tnVadSeg"></div>\
  <div style="display:flex;align-items:center;gap:10px;margin-top:12px">\
    <div style="flex:1"><div style="font-size:13px;color:var(--i9);font-weight:600">🎙 保留录音</div><div style="font-size:11px;color:var(--i5)">识别同时录制音频，可回放</div></div>\
    <div class="tnswitch" id="tnKeepAudio"></div>\
  </div>\
</div>\
<div class="setcard">\
  <b style="display:block;font-size:13px;color:var(--color-ink);margin-bottom:10px">地图显示</b>\
  <div style="display:flex;align-items:center;gap:10px">\
    <div style="flex:1"><div style="font-size:13px;color:var(--i9);font-weight:600">专题地图显示游记节点</div><div style="font-size:11px;color:var(--i5)">默认关闭；开启后在长征/滇桂黔等专题地图上显示 📝 游记节点</div></div>\
    <div class="tnswitch" id="tnThemeNotes"></div>\
  </div>\
</div>\
<div class="setcard">\
  <b style="display:block;font-size:13px;color:var(--b7);margin-bottom:8px">数据与备份</b>\
  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--i5);margin-bottom:10px"><span>存储占用</span><b id="tnStorage" style="color:var(--b6)">--</b></div>\
  <div style="display:flex;gap:8px">\
    <button id="tnExpBtn2" style="flex:1;margin-top:0;min-height:42px;font-size:12.5px;background:var(--sf2);color:var(--b7);border:1px solid var(--ln);box-shadow:none">导出</button>\
    <button id="tnImpBtn2" style="flex:1;margin-top:0;min-height:42px;font-size:12.5px;background:var(--sf2);color:var(--b7);border:1px solid var(--ln);box-shadow:none">导入</button>\
    <button id="tnDocBtn2" style="flex:1;margin-top:0;min-height:42px;font-size:12.5px;background:var(--sf2);color:var(--b7);border:1px solid var(--ln);box-shadow:none">文档</button>\
  </div>\
  <button id="tnClearBtn" style="background:#e74c3c;box-shadow:none;margin-top:10px">清除全部数据</button>\
</div>\
<button id="tnKeySave">保存设置</button>';
    [['2000', '⏸ 2 秒'], ['5000', '⏸ 5 秒']].forEach(function (v) {
      var b = el('button', localStorage.getItem('tn_vad') === v[0] ? 'on' : '', v[1]);
      b.dataset.v = v[0];
      $X(set, '#tnVadSeg').appendChild(b);
    });
    $X(set, '#tnVadSeg').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        $X(set, '#tnVadSeg').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    var sw = $X(set, '#tnKeepAudio');
    sw.className = 'tnswitch' + (localStorage.getItem('tn_keepAudio') === '0' ? ' off' : '');
    var swTheme = $X(set, '#tnThemeNotes');
    swTheme.className = 'tnswitch' + (localStorage.getItem('tn_themeNotes') !== '1' ? ' off' : '');
    MODEL_LIST.forEach(function (m) {
      var b = el('button', localStorage.getItem('tn_model') === m[0] ? 'on' : '', m[1]);
      b.dataset.m = m[0];
      $X(set, '#tnModel').appendChild(b);
    });
    $X(set, '#tnModel').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        $X(set, '#tnModel').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    $X(set, '#tnKeySave').onclick = function () {
      localStorage.setItem(AI_KEY, $X(set, '#tnKeyInput').value.trim());
      var m = $X(set, '#tnModel button.on');
      localStorage.setItem('tn_model', m ? m.dataset.m : 'deepseek-v4-flash');
      var v = $X(set, '#tnVadSeg button.on');
      localStorage.setItem('tn_vad', v ? v.dataset.v : '5000');
      var keep = !$X(set, '#tnKeepAudio').classList.contains('off');
      localStorage.setItem('tn_keepAudio', keep ? '1' : '0');
      var themeNotes = !$X(set, '#tnThemeNotes').classList.contains('off');
      localStorage.setItem('tn_themeNotes', themeNotes ? '1' : '0');
      if (window.AndroidVoice) {
        try { AndroidVoice.setVad(parseInt(localStorage.getItem('tn_vad'), 10)); } catch (e) {}
        try { AndroidVoice.setKeepAudio(keep); } catch (e) {}
      }
      set.style.display = 'none';
      flash('设置已保存');
    };
    $X(set, '#tnKeyClose').onclick = function () { set.style.display = 'none'; };
    $X(set, '#tnExpBtn2').onclick = exportNotes;
    $X(set, '#tnImpBtn2').onclick = importNotes;
    $X(set, '#tnDocBtn2').onclick = exportDoc;
    $X(set, '#tnClearBtn').onclick = clearAll;
    $X(set, '#tnKeepAudio').onclick = function () { this.classList.toggle('off'); };
    $X(set, '#tnThemeNotes').onclick = function () { this.classList.toggle('off'); };
    var flashEl = el('div', 'tn-flash');
    document.body.appendChild(mask);
    document.body.appendChild(panel);
    document.body.appendChild(list);
    document.body.appendChild(set);
    document.body.appendChild(flashEl);
    document.body.appendChild(guide);
    ui = { mask: mask, panel: panel, list: list, set: set, flashEl: flashEl };
    window.__tnKeepAudio = function () { return localStorage.getItem('tn_keepAudio') !== '0'; };
    window.__tnVad = function () { return parseInt(localStorage.getItem('tn_vad'), 10) || 5000; };
  }
  function $X(root, sel) { return root.querySelector(sel); }
  function flash(msg) {
    ui.flashEl.textContent = msg;
    ui.flashEl.style.display = 'block';
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { ui.flashEl.style.display = 'none'; }, 2200);
  }
  /* 自定义确认弹层（替代原生 confirm，WebView/预览环境原生对话框不可靠） */
  function confirmDialog(msg, onOk, okLabel) {
    var m = el('div', 'tn-cfm');
    m.innerHTML = '<div class="tc-box"><div class="tc-txt">' + msg + '</div>' +
      '<div class="tc-btns"><button class="tc-no">取消</button><button class="tc-ok">' + (okLabel || '确认') + '</button></div></div>';
    document.body.appendChild(m);
    m.querySelector('.tc-ok').onclick = function () { m.remove(); onOk && onOk(); };
    m.querySelector('.tc-no').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    return m;
  }
  function setMic(mode) {  // idle / live / ok
    var m = $X(ui.panel, '#tnRec'), r = $X(ui.panel, '#tnRing');
    m.classList.toggle('live', mode === 'live');
    m.classList.toggle('ok', mode === 'ok');
    
    r.classList.toggle('live', mode === 'live');
  }

  /* ---------- 录音面板 ---------- */
  function openPanel(iOrSite) {
    buildUI();
    if (ui.panel.style.display === 'flex') return;   // 防重复弹出（GPS 回调/多入口）
    var site = typeof iOrSite === 'object' ? iOrSite : (GETSITE ? GETSITE(iOrSite) : null);
    if (!site) { flash('未找到该景点'); return; }
    state = { site: site, phase: 'idle', raw: '', partial: '', photos: [], audio: '', append: false };
    ui.mask.style.display = 'block';
    ui.panel.style.display = 'flex';
    ui.panel.classList.add('is-idle');
    ui.panel.classList.remove('is-done');
    setMic('idle');   // 重置话筒颜色（避免上次 ok/live 残留绿色）
    $X(ui.panel, '#tnSite').textContent = '' + esc(site.label) + ' · ' + fmtTime(Date.now());
    // TRACE v2：中央地点大字 + 时间（沉浸式语音页）
    var nowEl = $X(ui.panel, '#tnNow');
    if (nowEl) nowEl.innerHTML = '<div class="tn-now__place">' + esc(site.label) + '</div><div class="tn-now__time">' + fmtTime(Date.now()) + '</div>';
    $X(ui.panel, '#tnRaw').innerHTML = '<b>语音转写 · 可说一段话，说完稍等即可</b>';
    $X(ui.panel, '#tnAI').style.display = 'none';
    $X(ui.panel, '#tnAI').textContent = '';
    $X(ui.panel, '#tnLoading').style.display = 'none';
    $X(ui.panel, '#tnSave').disabled = true;
    var p = $X(ui.panel, '#tnPolish');
    p.style.display = 'none';
    p.textContent = '整理一下';
    $X(ui.panel, '#tnMicLabel').innerHTML = '点按，开始 · <b>慢慢说，说完稍等</b>';
    setMic('idle');
    $X(ui.panel, '#tnNote').textContent = '';
    var tg = $X(ui.panel, '#tnTags');
    if (tg) tg.value = '';
    var tt = $X(ui.panel, '#tnTitle');
    if (tt) tt.value = '';
    renderPhotos();
    setPhase('idle');
  }
  function closePanel() {
    if (ui) { ui.mask.style.display = 'none'; ui.panel.style.display = 'none'; ui.panel.classList.add('is-idle'); ui.panel.classList.remove('is-done'); }
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
    if (window.AndroidVoice) { try { AndroidVoice.cancelVoice(); } catch (e) {} }
    setPhase('idle');
  }
  function setPhase(p) { state.phase = p; }

  function toggleRec() {
    if (state.phase === 'recording') {
      $X(ui.panel, '#tnNote').textContent = '请停止说话，识别将在 1-2 秒后自动结束';
      return;
    }
    if (window.AndroidVoice) {
      var ok = false;
      try { ok = AndroidVoice.isVoiceSupported(); } catch (e) { ok = false; }
      if (ok) {
        // 每次录音前同步设置：停顿秒数 + 是否保留录音（用户在设置里改过就生效）
        try {
          AndroidVoice.setVad(parseInt(localStorage.getItem('tn_vad'), 10) || 5000);
          AndroidVoice.setKeepAudio(localStorage.getItem('tn_keepAudio') !== '0');
        } catch (e2) {}
        AndroidVoice.startVoice(); return;
      }
      $X(ui.panel, '#tnNote').innerHTML = '⚠️ <b>语音识别服务不可用</b><br>请检查：①设置 → 语言与输入法 → 语音识别，确认已启用语音服务<br>②或到 Play 商店安装/更新「Speech Recognition & Synthesis」';
      flash('语音识别服务不可用');
      return;
    }
    // 网页降级：Web Speech API
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $X(ui.panel, '#tnNote').textContent = '当前环境不支持语音识别（请在手机 App 内使用语音功能）';
      flash('当前环境不支持语音识别');
      return;
    }
    rec = new SR();
    rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
    rec.onstart = function () { onVoiceStart(); };
    rec.onresult = function (e) {
      var txt = '';
      for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (e.results[e.results.length - 1].isFinal) onVoiceResult(txt);
      else onVoicePartial(txt);
    };
    rec.onerror = function (e) { onVoiceError(e.error || 'err'); };
    rec.onend = function () { rec = null; };
    rec.start();
  }

  /* ---------- 原生回调（MainActivity 注入） ---------- */
  window.__tnOnVoiceStart = function () {
    state.phase = 'recording';
    setMic('live');
    ui.panel.classList.remove('is-idle');
    ui.panel.classList.remove('is-done');
    $X(ui.panel, '#tnMicLabel').innerHTML = '正在听。 <b>慢慢说</b>';
    $X(ui.panel, '#tnRaw').innerHTML = '<b>实时转写</b>';
    $X(ui.panel, '#tnNote').textContent = '';
  };
  window.__tnOnVoicePartial = function (t) {
    state.partial = t;
    var b = $X(ui.panel, '#tnRaw').querySelector('b');
    if (b) b.textContent = '实时转写';
    $X(ui.panel, '#tnRaw').innerHTML = '<b>实时转写</b>' + esc(t);
  };
  window.__tnOnVoiceResult = function (t) {
    var finalText = (state.append && state.raw) ? (state.raw + ' ' + (t || '')) : t;
    state.append = false;
    state.raw = finalText;
    state.phase = 'idle';
    setMic('ok');
    ui.panel.classList.add('is-done');
    ui.panel.classList.remove('is-idle');
    $X(ui.panel, '#tnMicLabel').innerHTML = '好的，我记住了。 <b>可编辑</b>';
    $X(ui.panel, '#tnRaw').innerHTML = '<b>转写完成（可编辑）</b><textarea id="tnRawEdit" placeholder="可修改转写内容…">' + esc(finalText) + '</textarea>';
    var p = $X(ui.panel, '#tnPolish');
    p.style.display = 'block';
    p.textContent = '整理一下';
    $X(ui.panel, '#tnSave').disabled = false;
    $X(ui.panel, '#tnNote').textContent = '可先 AI 润色成精美文字，或直接保存原文';
  };
  window.__tnOnVoiceAudio = function (b64) {
    state.audio = b64;
    // 有原生桥则存文件拿 file:// 路径（<audio> 可播放），否则保留 base64
    if (window.AndroidVoice && AndroidVoice.saveAudioFile) {
      var fname = 'tn_' + Date.now() + '_' + Math.floor(Math.random() * 9999) + '.m4a';
      window.__tnAudioSaved = function (path) {
        if (path && path !== 'err') state.audio = path;
      };
      try { AndroidVoice.saveAudioFile(fname, b64); } catch (e) {}
    }
    $X(ui.panel, '#tnNote').textContent = ($X(ui.panel, '#tnNote').textContent || '') + ' 录音已留存';
  };
  window.__tnOnVoiceError = function (code) {
    state.phase = 'idle';
    setMic('idle');
    ui.panel.classList.add('is-idle');
    ui.panel.classList.remove('is-done');
    $X(ui.panel, '#tnMicLabel').innerHTML = '点按，开始 · <b>慢慢说，说完稍等</b>';
    var map = { no_perm: '未授权麦克风', no_match: '没有听清，请重试', timeout: '超时，请重试', network: '语音服务需要网络', network_timeout: '语音服务网络超时', busy: '识别忙，稍后重试', start_fail: '启动识别失败',
      xf_10118: '没有听清，请重试', xf_10107: '说话超时，请重试', xf_10161: '网络异常，请检查网络', xf_10202: '麦克风不可用', xf_10110: '未检测到语音', xf_10800: '云端服务异常，稍后重试',
      xf_10116: '识别内容为空', xf_11200: '语音服务未授权（讯飞 appid 失效）', xf_11201: '语音服务授权过期，请在设置检查', xf_11202: '语音服务授权无效', xf_11203: '语音服务试用已到期', xf_20001: '语音引擎内部错误' };
    var msg = map[code] || (code.indexOf('xf_') === 0 ? '讯飞识别失败(' + code.replace('xf_', '') + ')' : '识别失败(' + code + ')');
    /* 留存最近错误码，供设置页诊断显示 */
    try { localStorage.setItem('tn_lastVoiceError', code + '｜' + msg); } catch (e) {}
    $X(ui.panel, '#tnNote').textContent = msg + (code.indexOf('xf_') === 0 ? '（' + code.replace('xf_', '') + '）' : '');
    flash(msg);
  };

  /* ---------- AI 润色 ---------- */
  function curStyle() {
    var sel = $X(ui.panel, '#tnStyle button.on');
    return sel ? sel.dataset.id : 'prose';
  }
  function getRaw() {
    var t = $X(ui.panel, '#tnRawEdit');
    return t ? t.value.trim() : state.raw.trim();
  }
  function doPolish() {
    var raw = getRaw();
    if (!raw) { flash('请先输入或录制内容'); return; }
    var st = STYLES.filter(function (x) { return x.id === curStyle(); })[0] || STYLES[0];
    var load = $X(ui.panel, '#tnLoading'), ai = $X(ui.panel, '#tnAI');
    // 「原文保留」不调用 AI，直接采用当前内容
    if (st.id === 'raw') {
      var r2 = getRaw();
      ai.style.display = 'block';
      ai.textContent = r2;
      load.style.display = 'none';
      $X(ui.panel, '#tnSave').disabled = false;
      var p2 = $X(ui.panel, '#tnPolish');
      p2.style.display = 'block';
      p2.textContent = '↻ 换风格重润';
      $X(ui.panel, '#tnNote').textContent = '已采用原文（未润色）';
      return;
    }
    var key = localStorage.getItem(AI_KEY);
    if (!key) { openSettings(); flash('请先设置 DeepSeek API key'); return; }
    load.style.display = 'block';
    ai.style.display = 'none';
    var rawM = localStorage.getItem('tn_model') || 'deepseek-v4-flash';
    var model = MODEL_ALIAS[rawM] || rawM;
    var body = {
      model: model,
      messages: [
        { role: 'system', content: st.system },
        { role: 'user', content: '请润色以下语音口述（地点：' + (state.site ? state.site.label : '未知') + '）：\n' + raw }
      ],
      temperature: 0.7
    };
    if (model === 'deepseek-v4-pro') body.reasoning_effort = 'high';
    body.stream = true;
    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('http');
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      ai.style.display = 'block';
      ai.textContent = '';
      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            load.style.display = 'none';
            $X(ui.panel, '#tnSave').disabled = false;
            var p = $X(ui.panel, '#tnPolish');
            p.style.display = 'block';
            p.textContent = '↻ 换风格重润';
            $X(ui.panel, '#tnNote').textContent = '润色完成：' + st.icon + st.name + '（不满意可换风格重润）';
            return;
          }
          buf += decoder.decode(result.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (line) {
            if (!line.startsWith('data: ')) return;
            var json = line.slice(6).trim();
            if (json === '[DONE]') return;
            try {
              var chunk = JSON.parse(json);
              var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
              if (delta && delta.content) {
                ai.textContent += delta.content;
                ai.scrollTop = ai.scrollHeight;
              }
            } catch (e) {}
          });
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      load.style.display = 'none';
      flash('润色失败（网络或 key 无效），可保存原文');
      $X(ui.panel, '#tnSave').disabled = false;
    });
  }

  /* ---------- 照片 ---------- */
  /* 照片压缩后落盘：有原生桥存文件返回 file:// 路径，否则回退 base64；cb(pathOrB64) */
  var photoPending = [];
  window.__tnPhotoSaved = function (path) { var cb = photoPending.shift(); if (cb) cb(path); };
  function storePhoto(b64, cb) {
    if (window.AndroidVoice && AndroidVoice.savePhotoFile) {
      var fname = 'tn_' + Date.now() + '_' + Math.floor(Math.random() * 9999) + '.jpg';
      var cbOnce = function (path) { cb(path && path !== 'err' ? path : b64); };
      photoPending.push(cbOnce);
      try { AndroidVoice.savePhotoFile(fname, b64); } catch (e) { photoPending.pop(); cb(b64); }
    } else {
      cb(b64);
    }
  }
  function onPickPhotos() {
    var input = $X(ui.panel, '#tnFile');
    var files = input.files;
    if (!files || !files.length) return;
    var done = 0;
    for (var i = 0; i < files.length; i++) (function (f) {
      var fr = new FileReader();
      fr.onload = function () {
        compressPhoto(fr.result, function (b64) {
          if (!b64) { done++; if (done >= files.length) { input.value = ''; renderPhotos(); } return; }
          storePhoto(b64, function (p) {
            state.photos.push(p);
            done++;
            if (done >= files.length) { input.value = ''; renderPhotos(); }
          });
        });
      };
      fr.readAsDataURL(f);
    })(files[i]);
  }
  function compressPhoto(dataUrl, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        var max = 800, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.72));
        cv.width = cv.height = 0;
      };
      img.onerror = function () { cb(null); };
      img.src = dataUrl;
    } catch (e) { cb(null); }
  }
  function renderPhotos() {
    var box = $X(ui.panel, '#tnPhotos');
    if (!box) return;
    box.innerHTML = '';
    if (state.photos) state.photos.forEach(function (b64, i) {
      var d = el('div', 'tn-photo');
      d.innerHTML = '<img src="' + b64 + '"><span class="rm">✕</span>';
      d.querySelector('.rm').onclick = function () { state.photos.splice(i, 1); renderPhotos(); };
      box.appendChild(d);
    });
    var add = el('div', 'tn-addphoto', '照片');
    add.onclick = function () { $X(ui.panel, '#tnFile').click(); };
    box.appendChild(add);
  }

  /* ---------- 天气自动记录（Open-Meteo 免费无 key） ---------- */
  var WMO = { 0:'☀️ 晴',1:'🌤 晴间多云',2:'⛅ 多云',3:'☁️ 阴',45:'🌫 雾',48:'🌫 雾凇',51:'🌦 毛毛雨',53:'🌦 毛毛雨',55:'🌧 毛毛雨',61:'🌧 小雨',63:'🌧 中雨',65:'🌧 大雨',71:'🌨 小雪',73:'🌨 中雪',75:'❄️ 大雪',77:'🌨 雪粒',80:'🌦 阵雨',81:'🌧 阵雨',82:'⛈ 强阵雨',85:'🌨 阵雪',86:'❄️ 强阵雪',95:'⛈ 雷暴',96:'⛈ 雷暴冰雹',99:'⛈ 强雷暴' };
  function weatherStr(code, tmax, tmin) {
    var s = WMO[code] || ('🌡 天气码' + code);
    if (tmax != null) s += ' ' + tmax + '°' + (tmin != null ? '/' + tmin + '°' : '');
    return s;
  }
  function attachWeather(note) {
    if (note.lat == null || note.lng == null) return;
    var d = new Date(note.ts);
    function p(n){return (n<10?'0':'')+n;}
    var dateStr = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
    fetch('https://archive-api.open-meteo.com/v1/archive?latitude=' + note.lat + '&longitude=' + note.lng + '&start_date=' + dateStr + '&end_date=' + dateStr + '&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto')
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.daily && j.daily.weathercode && j.daily.weathercode.length) {
          note.weather = weatherStr(j.daily.weathercode[0], j.daily.temperature_2m_max ? j.daily.temperature_2m_max[0] : null, j.daily.temperature_2m_min ? j.daily.temperature_2m_min[0] : null);
          persist(); renderTNLayer();
          if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
        }
      }).catch(function () {});
  }

  /* ---------- 保存 / 地图标记 ---------- */
  function saveNote() {
    var ai = $X(ui.panel, '#tnAI'), text = ai.style.display === 'block' ? ai.textContent.trim() : '';
    var raw = getRaw();
    if (!text && !raw) { flash('没有可保存的内容'); return; }
    var _g = geoOf(state.site), _now = Date.now();
    var note = {
      id: uid(),
      title: ($X(ui.panel, '#tnTitle').value || '').trim() || (state.site ? state.site.label : '途经点'),
      siteIndex: state.site && state.site.__i != null ? state.site.__i : -1,
      siteName: state.site ? state.site.label : '途经点',
      lat: state.site ? state.site.lat : null,
      lng: state.site ? state.site.lng : null,
      ts: _now,
      date: fmtTime(_now),
      day: fmtDay(_now),
      province: _g.province,
      city: _g.city,
      county: _g.county,
      raw: raw,
      text: text || raw,
      style: curStyle(),
      photos: (state.photos || []).slice(),
      audio: state.audio || '',
      tags: ($X(ui.panel, '#tnTags').value || '').trim().split(/\s+|#/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 6)
    };
    notes.push(note);
    persist();
    renderTNLayer();
    if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
    attachWeather(note);
    resetPanelAfterSave();
    flash('已保存 · 可继续录制下一篇');
  }
  function resetPanelAfterSave() {
    state.photos = []; state.audio = ''; state.raw = ''; state.partial = ''; state.append = false;
    /* 恢复极简录音态（is-idle），收起编辑区与确认条 —— 修复"保存后确认框不消失" */
    ui.panel.classList.add('is-idle');
    ui.panel.classList.remove('is-done');
    var t1 = $X(ui.panel, '#tnTitle'); if (t1) t1.value = '';
    var t2 = $X(ui.panel, '#tnTags'); if (t2) t2.value = '';
    $X(ui.panel, '#tnRaw').innerHTML = '<b>语音转写 · 可说一段话，说完稍等即可</b>';
    var ai = $X(ui.panel, '#tnAI'); ai.style.display = 'none'; ai.textContent = '';
    $X(ui.panel, '#tnLoading').style.display = 'none';
    $X(ui.panel, '#tnSave').disabled = true;
    var p = $X(ui.panel, '#tnPolish'); p.style.display = 'none'; p.textContent = '整理一下';
    $X(ui.panel, '#tnMicLabel').innerHTML = '点按，开始 · <b>慢慢说，说完稍等</b>';
    setMic('idle');
    $X(ui.panel, '#tnNote').textContent = '已保存 · 可继续录制下一篇（点 ✕ 退出）';
    renderPhotos();
  }

  function renderTNLayer() {
    if (localStorage.getItem('tn_themeNotes') !== '1') {
      if (tnLayer && MAP) { MAP.removeLayer(tnLayer); tnLayer = null; }
      return;
    }
    if (!MAP || !notes.length) { if (tnLayer && MAP) { MAP.removeLayer(tnLayer); tnLayer = null; } return; }
    if (!tnLayer) { tnLayer = L.layerGroup().addTo(MAP); }
    tnLayer.clearLayers();
    notes.forEach(function (n) {
      if (n.lat == null || n.lng == null) return;
      var m = L.marker([n.lat, n.lng], {
        icon: L.divIcon({
          html: '<div style="font-size:19px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">📝</div>',
          className: '', iconSize: [20, 20], iconAnchor: [10, 18]
        })
      });
      m.bindPopup('<div style="font-size:13.5px;line-height:1.7;min-width:160px;font-family:&quot;Noto Sans SC&quot;,sans-serif"><b>' + esc(n.title || n.siteName) + '</b> <span style="color:#6b665c;font-size:11px">' + esc(n.date) + '</span><br>' + (n.weather ? esc(n.weather) + '<br>' : '') + esc((n.text || n.raw).slice(0, 140)) + (n.audio ? '<audio controls preload="none" src="' + esc(n.audio) + '" style="width:100%;margin-top:6px;height:32px"></audio>' : '') + '</div>');
      m.addTo(tnLayer);
    });
  }

  /* ---------- 列表 ---------- */
  function openList() {
    buildUI();
    setViewTabs();
    renderTagBar();
    renderStats();
    renderList();
    var hasPhoto = false;
    notes.forEach(function (n) { if ((n.photos || []).length) hasPhoto = true; });
    $X(ui.list, '#tnWallBtn').style.display = hasPhoto ? 'block' : 'none';
    ui.list.style.display = 'flex';
  }
  function renderStats() {
    var box = $X(ui.list, '#tnStats');
    if (!box) return;
    var sites = {}, days = {}, photos = 0;
    notes.forEach(function (n) {
      if (n.lat != null) sites[n.lat.toFixed(4) + ',' + n.lng.toFixed(4)] = 1;
      days[n.date.slice(0, 10)] = 1;
      photos += (n.photos || []).length;
    });
    box.innerHTML = '<div class="tn-statbox"><b>' + notes.length + '</b><span>游记</span></div><div class="tn-statbox"><b>' + Object.keys(sites).length + '</b><span>地点</span></div><div class="tn-statbox"><b>' + photos + '</b><span>照片</span></div><div class="tn-statbox"><b>' + Object.keys(days).length + '</b><span>天数</span></div>';
  }
  function renderTagBar() {
    var bar = $X(ui.list, '#tnTagBar');
    if (!bar) return;
    var tags = {};
    notes.forEach(function (n) { (n.tags || []).forEach(function (t) { tags[t] = 1; }); });
    var arr = Object.keys(tags);
    if (!arr.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = '';
    var all = el('button', tagFilter ? '' : 'on', '全部');
    all.onclick = function () { tagFilter = ''; renderTagBar(); renderList(); };
    bar.appendChild(all);
    arr.forEach(function (t) {
      var b = el('button', tagFilter === t ? 'on' : '', '#' + t);
      b.onclick = function () { tagFilter = tagFilter === t ? '' : t; renderTagBar(); renderList(); };
      bar.appendChild(b);
    });
  }
  function renderList() {
    var kw = ($X(ui.list, '#tnSearch').value || '').trim();
    var body = $X(ui.list, '#tnListBody');
    var list = notes.slice().sort(function (a, b) { return b.ts - a.ts; });
    if (kw) list = list.filter(function (n) { return (n.siteName + ' ' + n.text + ' ' + n.raw + ' ' + (n.tags || []).join(' ')).toLowerCase().indexOf(kw.toLowerCase()) >= 0; });
    if (tagFilter) list = list.filter(function (n) { return (n.tags || []).indexOf(tagFilter) >= 0; });
    body.innerHTML = '';
    if (!list.length) {
      body.innerHTML = '<div class="tn-empty"><div class="em">记</div><b>还没有游记</b><span>去景点弹窗点「语音游记」，<br>或在地图上随手记录第一篇吧</span></div>';
      var wb0 = $X(ui.list, '#tnWallBtn');
      if (wb0) wb0.style.display = 'none';
      return;
    }
    if (viewMode === 'trip') renderTripView(body, list);
    else renderTimeView(body, list);
    // 照片墙入口：有照片才显示
    var hasPhoto = false;
    notes.forEach(function (n) { if ((n.photos || []).length) hasPhoto = true; });
    var wb = $X(ui.list, '#tnWallBtn');
    if (wb) wb.style.display = hasPhoto ? 'block' : 'none';
  }
  function setViewTabs() {
    var t1 = $X(ui.list, '#tnViewTrip'), t2 = $X(ui.list, '#tnViewTime');
    if (!t1 || !t2) return;
    t1.classList.toggle('on', viewMode === 'trip');
    t2.classList.toggle('on', viewMode === 'timeline');
  }
  /* 单篇卡片（两个视图共用） */
  function renderItem(body, n) {
    var it = el('div', 'tn-item');
    var pics = (n.photos && n.photos.length) ? '<div class="pics">' + n.photos.map(function (p) { return '<img src="' + esc(p) + '" onclick="TravelNotes.zoomPhoto(this.src)">'; }).join('') + '</div>' : '';
    var aud = n.audio ? '<audio controls preload="none" src="' + esc(n.audio) + '"></audio>' : '';
    var tags = (n.tags && n.tags.length) ? '<div class="tags">' + n.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '';
    it.innerHTML = '<h4>' + esc(n.title || n.siteName) + (n.siteName && n.title && n.title !== n.siteName ? ' <span class="tn-site">· ' + esc(n.siteName) + '</span>' : '') + (n.weather ? ' <span style="font-size:11.5px;color:#e67e22">' + esc(n.weather) + '</span>' : '') + '</h4><div class="tm">' + esc(n.date) + ' · ' + (n.lat != null ? '' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div><div class="tx">' + esc(n.text || n.raw) + '</div>' + tags + aud + pics + '<div class="tg">' +
      '<button data-a="edit">编辑</button><button data-a="card">卡片</button><button data-a="md">MD</button><button data-a="doc">文档</button><button data-a="del" class="danger">删除</button></div>';
    it.querySelector('[data-a=edit]').onclick = function () { openEdit(n.id); };
    it.querySelector('[data-a=card]').onclick = function () { genCard(n); };
    it.querySelector('[data-a=md]').onclick = function () { if (window.Vault) Vault.exportOne(n); };
    it.querySelector('[data-a=doc]').onclick = function () { if (window.Vault && Vault.exportOneHtml) Vault.exportOneHtml(n); };
    it.querySelector('.tx').onclick = function () { it.querySelector('.tx').classList.toggle('open'); };
    it.querySelector('[data-a=del]').onclick = function () {
      confirmDialog('删除这篇游记？此操作不可恢复。', function () {
        notes = notes.filter(function (x) { return x.id !== n.id; });
        persist(); renderTNLayer(); renderList(); renderTagBar(); renderStats();
        if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
        flash('已删除');
      }, '删除');
    };
    body.appendChild(it);
  }
  /* 按日期分组渲染单篇（旅程展开 / 时间线月内共用） */
  function renderItems(body, list) {
    var groups = {};
    list.forEach(function (n) { var d = n.date.slice(0, 10); (groups[d] = groups[d] || []).push(n); });
    Object.keys(groups).sort().reverse().forEach(function (d) {
      var dateEl = el('div', 'tn-tl-date', d + ' <small>' + groups[d].length + ' 篇</small>');
      body.appendChild(dateEl);
      groups[d].forEach(function (n) { renderItem(body, n); });
    });
  }
  /* ---------- 视图一：旅程自动聚合 ---------- */
  function groupTrips(list) {
    var sorted = list.slice().sort(function (a, b) { return a.ts - b.ts; });
    var trips = [];
    sorted.forEach(function (n) {
      var last = trips[trips.length - 1];
      if (last && n.ts - last.end <= TRIP_GAP) { last.notes.push(n); last.end = n.ts; }
      else trips.push({ id: 'trip_' + n.id, start: n.ts, end: n.ts, notes: [n] });
    });
    return trips.reverse();   // 最新旅程在前
  }
  function tripName(t) {
    var cnt = {}, best = '', bn = 0;
    t.notes.forEach(function (n) { var k = n.siteName || ''; if (!k) return; cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > bn) { bn = cnt[k]; best = k; } });
    return best || '旅行';
  }
  function renderTripView(body, list) {
    var trips = groupTrips(list);
    trips.forEach(function (t) {
      var card = el('div', 'tn-trip' + (tripOpen[t.id] ? ' open' : ''));
      var cover = null;
      for (var i = 0; i < t.notes.length && !cover; i++) { var ph = (t.notes[i].photos || []); if (ph.length) cover = ph[0]; }
      var startD = fmtDay(t.start), endD = fmtDay(t.end);
      var head = el('div', 'tn-trip-head');
      head.innerHTML = (cover ? '<img class="tn-trip-cover" src="' + esc(cover) + '">' : '<div class="tn-trip-cover none">游</div>') +
        '<div class="tn-trip-info"><b>' + esc(tripName(t)) + '</b><div class="tt-meta">' + startD + (endD !== startD ? ' ~ ' + endD : '') + ' · <em>' + t.notes.length + '</em> 篇</div></div>' +
        '<div class="tn-trip-arrow">▾</div>';
      card.appendChild(head);
      var inner = el('div', 'tn-trip-body');
      if (tripOpen[t.id]) renderItems(inner, t.notes);
      card.appendChild(inner);
      head.onclick = function () {
        tripOpen[t.id] = !tripOpen[t.id];
        card.classList.toggle('open', tripOpen[t.id]);
        if (tripOpen[t.id]) { inner.innerHTML = ''; renderItems(inner, t.notes); }
      };
      body.appendChild(card);
    });
  }
  /* ---------- 视图二：年 → 月 折叠时间线 ---------- */
  function renderTimeView(body, list) {
    var byYear = {};
    list.forEach(function (n) { var y = n.date.slice(0, 4); (byYear[y] = byYear[y] || []).push(n); });
    var years = Object.keys(byYear).sort().reverse();
    var newestY = years[0];
    years.forEach(function (y) {
      var open = (timeOpen[y] === true) || (timeOpen[y] === undefined && y === newestY);
      var yEl = el('div', 'tn-tl-year' + (open ? '' : ' collapsed'), y + ' 年 <small>' + byYear[y].length + ' 篇</small><span class="ar">▾</span>');
      yEl.onclick = function () { timeOpen[y] = !open; renderList(); };
      body.appendChild(yEl);
      if (!open) return;
      var byMonth = {};
      byYear[y].forEach(function (n) { var m = n.date.slice(0, 7); (byMonth[m] = byMonth[m] || []).push(n); });
      Object.keys(byMonth).sort().reverse().forEach(function (m) {
        var mOpen = timeOpen[m] !== false;
        var mEl = el('div', 'tn-tl-month' + (mOpen ? '' : ' collapsed'), m + ' <small>' + byMonth[m].length + ' 篇</small><span class="ar">▾</span>');
        mEl.onclick = function () { timeOpen[m] = !mOpen; renderList(); };
        body.appendChild(mEl);
        if (!mOpen) return;
        renderItems(body, byMonth[m]);
      });
    });
  }

  /* ---------- 编辑（含照片 / 标签管理） ---------- */
  function openEdit(id) {
    var n = notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var pg = el('div', 'tn-editpage');
    pg.innerHTML =
      '<div class="bar"><button class="tn-x" id="tnEditBack" style="font-size:16px">←</button><b>编辑游记</b></div>' +
      '<div class="body">' +
      '<label class="lbl">题目</label><input id="tnEditTitle" placeholder="题目" value="' + esc(n.title || n.siteName) + '">' +
      '<label class="lbl">内容</label><textarea id="tnEditTxt">' + esc(n.text || n.raw) + '</textarea>' +
      '<label class="lbl">照片</label><div style="display:flex;gap:6px;flex-wrap:wrap" id="tnEditPhotos"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
      '<input id="tnEditTags" placeholder="标签（空格分隔）" value="' + esc((n.tags || []).join(' ')) + '" style="margin:0;flex:1">' +
      '<button id="tnEditAddPhoto">加照片</button>' +
      '<input type="file" id="tnEditFile" accept="image/*" multiple style="display:none"></div>' +
      '</div>' +
      '<div class="foot"><button id="tnEditSave">保存修改</button></div>';
    document.body.appendChild(pg);
    pg.style.display = 'flex';
    var photos = (n.photos || []).slice();
    var renderEp = function () {
      var box = $X(pg, '#tnEditPhotos');
      box.innerHTML = '';
      photos.forEach(function (b64, i) {
        var ph = el('div', 'tn-photo');
        ph.innerHTML = '<img src="' + b64 + '"><span class="rm">✕</span>';
        ph.querySelector('.rm').onclick = function () { photos.splice(i, 1); renderEp(); };
        box.appendChild(ph);
      });
    };
    renderEp();
    $X(pg, '#tnEditAddPhoto').onclick = function () { $X(pg, '#tnEditFile').click(); };
    $X(pg, '#tnEditFile').onchange = function () {
      var files = $X(pg, '#tnEditFile').files;
      var done = 0;
      for (var i = 0; i < files.length; i++) (function (f) {
        var fr = new FileReader();
        fr.onload = function () {
          compressPhoto(fr.result, function (b64) {
            if (b64) photos.push(b64);
            done++;
            if (done >= files.length) { $X(pg, '#tnEditFile').value = ''; renderEp(); }
          });
        };
        fr.readAsDataURL(f);
      })(files[i]);
    };
    $X(pg, '#tnEditBack').onclick = function () { pg.remove(); };
    $X(pg, '#tnEditSave').onclick = function () {
      var v = $X(pg, '#tnEditTxt').value.trim();
      if (!v) { flash('内容不能为空'); return; }
      n.title = $X(pg, '#tnEditTitle').value.trim() || n.siteName;
      n.text = v;
      n.photos = photos;
      n.tags = $X(pg, '#tnEditTags').value.trim().split(/\s+|#/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 6);
      n.edited = fmtTime(Date.now());
      persist(); renderTNLayer(); renderList(); renderStats(); pg.remove();
      if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
      flash('已保存修改');
    };
  }

  /* ---------- 统计面板 ---------- */
  function showStats() {
    if (!notes.length) { flash('还没有游记'); return; }
    var sites = {}, days = {}, photos = 0, months = {};
    notes.forEach(function (n) {
      if (n.lat != null) sites[n.lat.toFixed(4) + ',' + n.lng.toFixed(4)] = 1;
      days[n.date.slice(0, 10)] = 1;
      photos += (n.photos || []).length;
      months[n.date.slice(0, 7)] = (months[n.date.slice(0, 7)] || 0) + 1;
    });
    var monthHtml = Object.keys(months).sort().reverse().slice(0, 6).map(function (m) { return '<div class="monthline"><span>' + m + '</span><b>' + months[m] + ' 篇</b></div>'; }).join('');
    var d = el('div', 'tn-dlg');
    d.innerHTML = '<h4>游记统计 <button class="tn-x" id="tnStX" style="font-size:14px">✕</button></h4>' +
      '<div class="statgrid">' +
      '<div><b>' + notes.length + '</b><span>游记</span></div>' +
      '<div><b>' + Object.keys(sites).length + '</b><span>地点</span></div>' +
      '<div><b>' + photos + '</b><span>照片</span></div>' +
      '<div><b>' + Object.keys(days).length + '</b><span>天数</span></div>' +
      '</div><b style="font-size:14px;font-family:var(--fd)">月份分布</b>' + (monthHtml || '<div style="color:#6b665c;font-size:12.5px;padding:8px 0">无</div>') +
      '<button id="tnStDone">完成</button>';
    document.body.appendChild(d);
    d.style.display = 'block';
    $X(d, '#tnStX').onclick = function () { d.remove(); };
    $X(d, '#tnStDone').onclick = function () { d.remove(); };
  }

  /* ---------- 导出 HTML 文档 ---------- */
  function exportDoc() {
    if (!notes.length) { flash('还没有游记'); return; }
    var sorted = notes.slice().sort(function (a, b) { return b.ts - a.ts; });
    var cards = sorted.map(function (n) {
      var pics = (n.photos && n.photos.length) ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' + n.photos.map(function (p) { return '<img src="' + p + '" style="max-width:46%;border-radius:10px">'; }).join('') + '</div>' : '';
      var tags = (n.tags && n.tags.length) ? '<div style="margin:8px 0">' + n.tags.map(function (t) { return '<span style="display:inline-block;background:#f2d5d0;color:var(--color-primary);border-radius:999px;font-size:12px;padding:3px 10px;margin-right:6px">#' + esc(t) + '</span>'; }).join('') + '</div>' : '';
      return '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px;margin-bottom:16px">' +
        '<h2 style="margin:0 0 4px;font-size:19px;color:#26241f">' + esc(n.title || n.siteName) + (n.siteName && n.title && n.title !== n.siteName ? ' <span style="font-size:13px;color:#6b665c">· ' + esc(n.siteName) + '</span>' : '') + '</h2>' +
        '<div style="color:var(--color-muted);font-size:12px;margin-bottom:8px">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) : '') + '</div>' +
        pics + tags +
        '<div style="white-space:pre-wrap;line-height:1.8;font-size:14px;color:#333">' + esc(n.text || n.raw) + '</div></div>';
    }).join('');
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>我的旅行游记</title><style>@media print{body{background:#fff!important}div{box-shadow:none!important;border:1px solid #ddd!important}h1{color:#333!important;background:none!important;padding:20px 0!important}}@media(max-width:600px){div{padding:12px!important}h2{font-size:16px!important}}</style></head><body style="margin:0;background:#f6f1e5;font-family:&quot;PingFang SC&quot;,&quot;Microsoft YaHei&quot;,sans-serif">' +
      '<div style="background:linear-gradient(135deg,#1f3634,#162725);color:#fff;padding:32px 20px;text-align:center"><h1 style="margin:0;font-size:26px">我的旅行游记</h1><p style="margin:8px 0 0;font-size:13px;opacity:.85">共 ' + sorted.length + ' 篇 · 记录于 ' + new Date().toLocaleDateString() + '</p></div>' +
      '<div style="max-width:720px;margin:0 auto;padding:16px">' + cards + '</div></body></html>';
    var d = el('div', 'tn-dlg');
    d.innerHTML = '<h4>导出游记文档 <button class="tn-x" id="tnDocX" style="font-size:14px">✕</button></h4>' +
      '<div id="tnDocPrev" style="border:1px solid var(--ln);border-radius:14px;max-height:44vh;overflow-y:auto;font-size:11px;color:#777;padding:12px;white-space:pre-wrap;background:#fff">' + esc(html.slice(0, 2600)) + '…（共 ' + html.length + ' 字符）</div>' +
      '<button id="tnDocCopy" class="copy">复制 HTML</button>' +
      (window.AndroidVoice ? '<button id="tnDocSave">保存到手机下载</button>' : '') +
      '<button id="tnDocDone">完成</button>';
    document.body.appendChild(d);
    d.style.display = 'block';
    $X(d, '#tnDocX').onclick = function () { d.remove(); };
    $X(d, '#tnDocDone').onclick = function () { d.remove(); };
    $X(d, '#tnDocCopy').onclick = function () {
      var ta = document.createElement('textarea');
      ta.value = html; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); flash('HTML 已复制'); } catch (e) { flash('复制失败'); }
      ta.remove();
    };
    var saveBtn = $X(d, '#tnDocSave');
    if (saveBtn) saveBtn.onclick = function () {
      window.__tnSaveDone = function (r) {
        if (r === 'err') flash('保存失败');
        else if (r === 'need_perm') flash('需要存储权限（请在设置中允许）');
        else flash('已保存到手机，请在下载目录或 App 文件列表查找');
      };
      try { AndroidVoice.saveTextFile('我的游记.html', html); } catch (e) { flash('保存不可用，请用复制'); }
    };
  }

  /* ---------- 导出 / 导入备份 ---------- */
  function exportNotes() {
    var d = el('div', 'tn-dlg');
    var json = JSON.stringify(notes, null, 2);
    var fname = '古建游记备份-' + fmtDay(Date.now()) + '.json';
    d.innerHTML = '<h4>导出备份 <button class="tn-x" id="tnExpX" style="font-size:14px">✕</button></h4>'
      + '<div style="font-size:12px;color:var(--i5);margin:8px 0">共 ' + notes.length + ' 篇 · 建议用「保存到手机」导出 .json 文件，日后导入更方便。</div>'
      + '<textarea id="tnExpTxt" readonly>' + esc(json) + '</textarea>'
      + '<button id="tnExpFile" class="copy">保存为文件</button>'
      + '<button id="tnExpCopy" class="copy">复制全部</button>'
      + '<button id="tnExpDone">完成</button>';
    document.body.appendChild(d);
    d.style.display = 'block';
    $X(d, '#tnExpX').onclick = function () { d.remove(); };
    $X(d, '#tnExpDone').onclick = function () { d.remove(); };
    $X(d, '#tnExpCopy').onclick = function () {
      var t = $X(d, '#tnExpTxt');
      t.select();
      try { document.execCommand('copy'); flash('已复制到剪贴板'); } catch (e) { flash('复制失败，请手动长按选择复制'); }
    };
    $X(d, '#tnExpFile').onclick = function () {
      if (window.AndroidVoice && window.AndroidVoice.saveTextFile) {
        window.__tnSaveDone = function (r) {
          if (r === 'err') flash('保存失败');
          else if (r === 'need_perm') flash('需要存储权限');
          else flash('已保存：Download/' + r);
        };
        try { AndroidVoice.saveTextFile(fname, json); } catch (e) { flash('保存不可用，请用复制'); }
      } else {
        var a = document.createElement('a');
        a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
        a.download = fname;
        a.click();
        flash('已下载');
      }
    };
  }
  function importNotes() {
    var d = el('div', 'tn-dlg');
    d.innerHTML = '<h4>导入备份 <button class="tn-x" id="tnImpX" style="font-size:14px">✕</button></h4>'
      + '<div style="font-size:12px;color:var(--i5);margin:8px 0">支持粘贴 JSON 或从文件导入（.json），按 id 去重合并。</div>'
      + '<input type="file" id="tnImpFile" accept=".json,application/json" style="display:none">'
      + '<button id="tnImpPick" class="copy">选择文件导入</button>'
      + '<textarea id="tnImpTxt" placeholder="或在此粘贴导出的 JSON 备份内容…"></textarea>'
      + '<button id="tnImpSave">合并导入（按 id 去重）</button>';
    document.body.appendChild(d);
    d.style.display = 'block';
    $X(d, '#tnImpX').onclick = function () { d.remove(); };
    var file = $X(d, '#tnImpFile');
    $X(d, '#tnImpPick').onclick = function () { file.click(); };
    file.onchange = function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        $X(d, '#tnImpTxt').value = String(rd.result || '');
        flash('已读取文件，可点「合并导入」');
      };
      rd.readAsText(f);
    };
    $X(d, '#tnImpSave').onclick = function () {
      try {
        var arr = JSON.parse($X(d, '#tnImpTxt').value.trim());
        if (!Array.isArray(arr)) throw new Error('bad');
        var ids = {};
        notes.forEach(function (x) { ids[x.id] = 1; });
        var added = 0;
        arr.forEach(function (x) { if (x && x.id && !ids[x.id]) { notes.push(x); ids[x.id] = 1; added++; } });
        persist(); renderTNLayer(); renderList(); renderStats(); d.remove();
        flash('导入完成，新增 ' + added + ' 篇');
      } catch (e) { flash('JSON 格式不正确'); }
    };
  }
  function zoomPhoto(src) {
    /* 全屏图片查看器：避开 WebView 对 backdrop-filter/底部浮层的渲染问题 */
    var d = el('div', 'tn-dlg');
    d.style.cssText = 'position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;background:rgba(6,17,16,.96);text-align:center;padding:20px';
    d.innerHTML = '<img src="' + src + '" style="max-width:92vw;max-height:86vh;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5)">'
      + '<button id="tnZoomX" style="position:fixed;top:calc(env(safe-area-inset-top,0px)+12px);right:14px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:17px;cursor:pointer;line-height:1">✕</button>';
    document.body.appendChild(d);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    $X(d, '#tnZoomX').onclick = function (e) { e.stopPropagation(); d.remove(); };
  }

  /* ---------- 数据管理：清除 / 容量 / 照片墙 ---------- */
  function storageMB() {
    try { return JSON.stringify(notes).length / 1024 / 1024; } catch (e) { return 0; }
  }
  function clearAll() {
    confirmDialog('删除本机全部游记（含照片与录音）？此操作不可恢复，建议先导出备份。', function () {
      notes = [];
      persist();
      localStorage.removeItem(KEY);
      try {
        if (ui && ui.list) { renderTagBar(); renderStats(); renderList(); }
        if (window.TravelNotes._afterSave) window.TravelNotes._afterSave();
      } catch (e) {}
      flash('已清除全部数据');
    }, '全部删除');
  }
  function openPhotoWall() {
    buildUI();
    if (!ui.wall) {
      var wall = el('div', 'tn-wall');
      wall.innerHTML = '<div class="bar"><button class="tn-x" id="tnWallX" style="font-size:18px">←</button><b>照片墙</b></div><div class="grid" id="tnWallGrid"></div>';
      document.body.appendChild(wall);
      $X(wall, '#tnWallX').onclick = function () { wall.style.display = 'none'; };
      ui.wall = wall;
    }
    var all = [];
    notes.forEach(function (n) { (n.photos || []).forEach(function (p) { all.push({ img: p, site: n.title || n.siteName }); }); });
    var grid = $X(ui.wall, '#tnWallGrid');
    grid.innerHTML = '';
    if (!all.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--i5);padding:60px 0;font-size:13px">还没有照片，录音时点「照片」添加吧</div>'; }
    all.forEach(function (p) {
      var img = el('img');
      img.src = p.img;
      img.title = p.site;
      img.onclick = function () { zoomPhoto(p.img); };
      grid.appendChild(img);
    });
    ui.wall.style.display = 'flex';
  }

  /* ---------- 图文卡片（canvas） ---------- */
  var _cardCanvas = null, _genBusy = false;
  function genCard(n) {
    if (_genBusy) return;                       // 防连点：1.5s 内只处理一次
    _genBusy = true;
    setTimeout(function () { _genBusy = false; }, 1500);
    if (!_cardCanvas) {                          // 隐藏单例 canvas：避免反复新建大画布导致 WebView 异常
      _cardCanvas = document.createElement('canvas');
      _cardCanvas.className = 'tn-cardcanvas';
      _cardCanvas.width = 1080; _cardCanvas.height = 1440;
      document.body.appendChild(_cardCanvas);
    }
    var cv = _cardCanvas;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 1440);
    g.addColorStop(0, '#1f3634'); g.addColorStop(1, '#2f4f4f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1440);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (var i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(120 + i * 170, 200 + (i % 2) * 260, 60, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('游记卡片', 70, 120);
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(n.siteName, 70, 220);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = '30px sans-serif';
    ctx.fillText(n.date + (n.lat != null ? '  ·  ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : ''), 70, 285);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(70, 330); ctx.lineTo(1010, 330); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '32px sans-serif';
    var text = n.text || n.raw, y = 390, chars = 34, line = '';
    for (var c = 0; c < text.length; c++) {
      line += text[c];
      if (line.length >= chars || c === text.length - 1) {
        ctx.fillText(line, 70, y); y += 52; line = '';
        if (y > 1320) { ctx.fillText('…', 70, y); break; }
      }
    }
    var dataUrl = cv.toDataURL('image/png');
    var done = function (r) {
      if (r === 'err') flash('卡片保存失败');
      else flash('卡片已保存：Download/' + r);
    };
    if (window.AndroidVoice && window.AndroidVoice.saveImage) {
      // App 内：走原生 MediaStore 保存（WebView 的 blob 下载不可用）
      window.__tnImgSaved = done;
      try { AndroidVoice.saveImage('游记-' + n.siteName + '.png', dataUrl); } catch (e) { flash('保存不可用'); }
    } else {
      // 浏览器降级：a[download] 下载
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = '游记-' + n.siteName + '.png';
      a.click();
      flash('卡片已保存');
    }
  }

  /* ---------- 设置 ---------- */
  function openSettings() {
    buildUI();
    $X(ui.set, '#tnKeyInput').value = localStorage.getItem(AI_KEY) || '';
    var cur = (MODEL_ALIAS && MODEL_ALIAS[localStorage.getItem('tn_model')]) || localStorage.getItem('tn_model') || 'deepseek-v4-flash';
    $X(ui.set, '#tnModel').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.m === cur);
    });
    var vad = localStorage.getItem('tn_vad') || '5000';
    $X(ui.set, '#tnVadSeg').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.v === vad);
    });
    var keep = localStorage.getItem('tn_keepAudio') !== '0';
    $X(ui.set, '#tnKeepAudio').className = 'tnswitch' + (keep ? '' : ' off');
    var themeNotes = localStorage.getItem('tn_themeNotes') === '1';
    $X(ui.set, '#tnThemeNotes').className = 'tnswitch' + (themeNotes ? '' : ' off');
    var mb = storageMB();
    var st = $X(ui.set, '#tnStorage');
    st.textContent = mb.toFixed(1) + ' MB';
    st.style.color = mb > 3 ? '#e74c3c' : 'var(--b6)';
    if (mb > 3) flash('存储快满（' + mb.toFixed(1) + 'MB）：可关闭保留录音或导出备份');
    ui.set.style.display = 'block';
  }

  /* ---------- 独立游记地图页：渲染所有游记节点 ---------- */
  function renderMap(map) {
    loadNotes(function () { drawNoteLayer(map); });
  }
  function drawNoteLayer(map) {
    var layer = L.layerGroup().addTo(map);
    var pts = [];
    notes.forEach(function (n) {
      if (n.lat == null || n.lng == null) return;
      pts.push([n.lat, n.lng]);
      var pic = (n.photos && n.photos[0]) ? '<img src="' + esc(n.photos[0]) + '" style="width:100%;max-height:130px;object-fit:cover;border-radius:10px;margin:6px 0">' : '';
      var m = L.marker([n.lat, n.lng], {
        icon: L.divIcon({
          html: '<div style="font-size:21px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">📝</div>',
          className: '', iconSize: [22, 22], iconAnchor: [11, 20]
        })
      });
      m.bindPopup('<div style="font-size:13.5px;line-height:1.7;min-width:190px;max-width:260px;font-family:&quot;Noto Sans SC&quot;,sans-serif"><b>' + esc(n.title || n.siteName) + '</b> <span style="color:#6b665c;font-size:11px">' + esc(n.date) + '</span>' + pic + '<div style="white-space:pre-wrap;max-height:200px;overflow-y:auto;margin-top:4px">' + esc(n.text || n.raw) + '</div><div style="color:#6b665c;font-size:11px;margin-top:6px">' + n.lat.toFixed(5) + ', ' + n.lng.toFixed(5) + (n.style ? ' · ' + n.style : '') + '</div></div>', { maxWidth: 280 });
      m.addTo(layer);
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25));
    return layer;
  }

  /* ---------- 初始化 ---------- */
  function init(opt) {
    MAP = opt.map;
    GETSITE = opt.getSite || function (i) { return null; };
    ONOPEN = opt.onOpenSite || null;
    loadNotes(function () {
      if (MAP) renderTNLayer();
      window.__tnVoiceCount = notes.length;
      if (window.TravelNotes._onReady) window.TravelNotes._onReady();
    });
  }

  window.TravelNotes = {
    init: init,
    openPanel: openPanel,
    openList: openList,
    openSettings: openSettings,
    renderMap: renderMap,
    zoomPhoto: zoomPhoto,
    exportNotes: exportNotes,
    importNotes: importNotes,
    clearNotes: function () { notes = []; persist(); if (window.TravelNotes._afterSave) window.TravelNotes._afterSave(); flash('已清除全部数据'); },
    explain: function (iOrSite) { buildUI(); if (startGuideRef) startGuideRef(iOrSite); else flash('讲解暂不可用'); },
    count: function () { return notes.length; },
    list: function () { return notes.slice(); },
    /* 按索引查询（city/day/ts），IDB 不可用时回退内存 filter；cb(noteArray) */
    queryIndex: function (idx, value, cb) {
      var name = idx === 'city' ? 'by_city' : (idx === 'day' ? 'by_day' : 'by_ts');
      var byKey = function (n) { return n[idx] === value; };
      if (DB_READY && DB) {
        try {
          var tx = DB.transaction('notes', 'readonly');
          var range = IDBKeyRange.only(value);
          var req = tx.objectStore('notes').index(name).getAll(range);
          req.onsuccess = function () { cb && cb(req.result || []); };
          req.onerror = function () { cb && cb(notes.filter(byKey)); };
          return;
        } catch (e) {}
      }
      cb && cb(notes.filter(byKey));
    },
    /* 全量走 IDB 范围查询（时间范围），回退内存 filter；cb(noteArray) */
    queryRange: function (fromDay, toDay, cb) {
      var byRange = function (n) {
        var day = n.day || (n.date || '').slice(0, 10);
        if (!day) return false;
        if (fromDay && day < fromDay) return false;
        if (toDay && day > toDay) return false;
        return true;
      };
      if (DB_READY && DB && (fromDay || toDay)) {
        try {
          var tx = DB.transaction('notes', 'readonly');
          var st = tx.objectStore('notes');
          var idx = st.index('by_day');
          var range = IDBKeyRange.bound(fromDay || '', toDay || '￿');
          var req = idx.getAll(range);
          req.onsuccess = function () { cb && cb(req.result || []); };
          req.onerror = function () { cb && cb(notes.filter(byRange)); };
          return;
        } catch (e) {}
      }
      cb && cb(notes.filter(byRange));
    }
  };
})();
