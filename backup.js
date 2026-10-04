/* ============================================================
 * backup.js — 全量数据备份 / 恢复（BACKUP_SCHEMA 2）
 * ------------------------------------------------------------
 * 覆盖：IDB 游记（gujian-notes/notes）+ IDB 图册（trace-albums/albums）
 *       + localStorage 业务数据 + 非敏感偏好
 * 严禁入包：tn_aiKey / tn_key_<站点> / tn_amap_key / tn_webdav（含口令）
 *
 * 键策略是**白名单**：只有下表登记的键才会被采集；未登记键（含一切未来新增键）
 * 一律不落进备份。新增键必须显式登记，宁可漏采也不要把没审计过的东西同步出去。
 *
 * 三种合并语义（merge='id'|'dict'|'whole'）：
 *   id    —— 值是 JSON 数组，条目按字符串 id 求并集；同 id 冲突按 prefer 一方为准
 *   dict  —— 值是 JSON 对象，按顶层属性求并集；同名属性按 prefer 一方为准
 *   whole —— 整键原样择优（地图位、纯文本类小数据）
 * 无墓碑：删除不跨设备传播（A 机删掉的游记，从 B 机 pull 会回来）。这是本模块
 * 已登记的已知边界，替换式恢复（mode='replace'）是唯一能把删除带过来的路径。
 *
 * 依赖：游记写入必须走 TravelNotes.replaceNotes()（内存是同步真相源，直接写 IDB
 * 会被下一次 persist() 的 diff 覆盖）；相册没有内存缓存层，本模块自己开 IDB。
 * ============================================================ */
(function () {
  'use strict';

  var SCHEMA = 2;
  var KIND = 'trace-backup-full';

  /* ---------- 键策略表 ---------- */
  var KEYS = [
    { k: 'tn_wishlist', g: 'data', m: 'id' },
    { k: 'tn_trips', g: 'data', m: 'id' },
    { k: 'tn_userNodes', g: 'data', m: 'id' },
    { k: 'travelNotes', g: 'data', m: 'id' },      /* IDB 不可用时的游记回退，与 notes 同构 */
    { k: 'tn_dayMoods', g: 'data', m: 'dict' },
    { k: 'tn_lod', g: 'prefs', m: 'dict' },         /* 地图节点分级参数（speed/cap/major 三档） */
    { k: 'tn_recent', g: 'data', m: 'whole' },
    { k: 'tn_search_hist', g: 'data', m: 'whole' },
    { k: 'tn_planner_state', g: 'data', m: 'whole' },/* 排线中途状态：换机接着排 */
    { k: 'tn_themeNotes', g: 'prefs', m: 'whole' },
    { k: 'tn_plan_ai', g: 'prefs', m: 'whole' },     /* 规划 AI 档位 off/narrate/full */
    { k: 'tn_dark', g: 'prefs', m: 'whole' },
    { k: 'tn_font', g: 'prefs', m: 'whole' },
    { k: 'tn_layer', g: 'prefs', m: 'whole' },
    { k: 'tn_vad', g: 'prefs', m: 'whole' },
    { k: 'tn_keepAudio', g: 'prefs', m: 'whole' },
    { k: 'tn_onboarded', g: 'prefs', m: 'whole' },
    { k: 'tn_loc_hint_done', g: 'prefs', m: 'whole' },
    { k: 'tn_aiSite', g: 'prefs', m: 'whole' },
    { k: 'tn_aiBase', g: 'prefs', m: 'whole' },    /* 自定义站点的接口地址：非密钥，但会决定 Key 发往哪里 */
    { k: 'tn_share_base', g: 'prefs', m: 'whole' }, /* 只读分享链接的落点地址：自己的域名，非密钥 */
    { k: 'tn_planner_weather', g: 'prefs', m: 'whole' }, /* 日卡天气开关：纯显示偏好，关掉不影响数据 */
    { p: 'tn_model_', g: 'prefs', m: 'whole' },    /* tn_model_<站点> = 模型名，不含 Key */
    { p: 'tn_mappos_', g: 'prefs', m: 'whole' }    /* 各页地图回到上次视角 */
  ];
  /* 显式黑名单：只用于「哨兵扫描」和闸门对照，白名单本身已经把它挡在外面 */
  var NEVER = {
    exact: [
      'tn_aiKey',            /* 旧版单站点 AI Key */
      'tn_model',            /* 旧版单站点模型名：migrate() 归位成 tn_model_deepseek 后才进备份 */
      'tn_amap_key',
      'tn_webdav',           /* WebDAV 账号口令 */
      'tn_webdav_autosync',  /* 自动上传开关绑「这台机器的凭据」，换机由用户重开 */
      'tn_webdav_last',      /* 上次同步结果（含失败原因）只对本机展示 */
      'tn_lastBackup', 'tn_storefail_warned', 'tn_b64_warned', 'tn_lastVoiceError', 'tn_rc_idx', 'tn_emptyClosed'
    ],
    prefix: [
      'tn_key_',             /* 各站点 AI Key，全部禁入 */
      'tn_photo_',           /* 图片镜像缓存，可再生 */
      'tn_rt_',              /* 车程耗时缓存 */
      'tn_d_',               /* 距离缓存 */
      'tn_tk_',              /* 门票信息缓存 */
      'tn_weather_'          /* 天气缓存 */
    ]
  };
  var GROUPS = { data: 1, prefs: 1 };

  function policyOf(key) {
    for (var i = 0; i < NEVER.exact.length; i++) if (key === NEVER.exact[i]) return null;
    for (var j = 0; j < NEVER.prefix.length; j++) if (key.indexOf(NEVER.prefix[j]) === 0) return null;
    for (var n = 0; n < KEYS.length; n++) {
      var e = KEYS[n];
      if ((e.k && e.k === key) || (e.p && key.indexOf(e.p) === 0)) return e;
    }
    return null;                      /* 未登记 → 不采集 */
  }
  /* 闸门用的四态分类：policyOf 把「禁入」和「没登记」都压成 null，审计要能分开它们 */
  function classOf(key) {
    var pol = policyOf(key);
    if (pol) return pol.g;
    for (var i = 0; i < NEVER.exact.length; i++) if (NEVER.exact[i] === key) return 'never';
    for (var j = 0; j < NEVER.prefix.length; j++) if (key.indexOf(NEVER.prefix[j]) === 0) return 'never';
    return 'unregistered';
  }
  function allLocalStorageKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k) out.push(k); } }
    catch (e) {}
    return out;
  }

  /* ---------- localStorage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function collectStorage() {
    var bag = { data: {}, prefs: {} };
    allLocalStorageKeys().forEach(function (k) {
      var pol = policyOf(k);
      if (!pol || !GROUPS[pol.g]) return;
      var raw = lsGet(k);
      if (raw == null) return;
      bag[pol.g][k] = raw;
    });
    return bag;
  }

  /* 合并语义按策略表走；恢复时对回灌的包**重新过一遍白名单**，
     防止别人手改/伪造的备份把 tn_aiBase 换成钓鱼地址再让 Ai 把 Key 发过去 */
  function mergeValue(pol, a, b, prefer) {
    var take = function (x, y) { return x == null ? y : x; };
    if (pol.m === 'whole') return prefer === 'remote' ? take(b, a) : take(a, b);
    var parse = function (s) { if (s == null) return null; try { return JSON.parse(s); } catch (e) { return null; } };
    var pa = parse(a), pb = parse(b);
    if (pa == null || pb == null) return prefer === 'remote' ? take(b, a) : take(a, b);
    if (pol.m === 'id') return JSON.stringify(mergeById(pa, pb, prefer));
    return JSON.stringify(mergeDict(pa, pb, prefer));
  }
  function writeStorage(env, prefer, replace, stats) {
    var src = env.storage || {};
    ['data', 'prefs'].forEach(function (g) {
      var remote = src[g] || {};
      var local = g === 'data' ? stats.localBags.data : stats.localBags.prefs;
      Object.keys(remote).forEach(function (k) {
        var pol = policyOf(k);
        if (!pol || pol.g !== g) { stats.skipped++; return; }
        var v = replace ? remote[k] : mergeValue(pol, lsGet(k), remote[k], prefer);
        if (lsSet(k, v)) stats.written++; else stats.failed++;
      });
      if (!replace) return;
      Object.keys(local).forEach(function (k) {   /* 替换式：本地有、备份里没有的登记键要清掉 */
        var pol = policyOf(k);
        if (!pol || pol.g !== g) return;
        if (remote[k] == null && lsSet(k, null)) stats.cleared++;
      });
    });
  }

  /* ---------- 合并原语 ---------- */
  function mergeById(local, remote, prefer) {
    var out = [], seen = {};
    var la = Array.isArray(local) ? local : [];
    var ra = Array.isArray(remote) ? remote : [];
    var first = prefer === 'remote' ? ra : la;
    var second = prefer === 'remote' ? la : ra;
    first.concat(second).forEach(function (x) {
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id) return;
      if (seen[x.id] != null) return;
      seen[x.id] = out.length;
      out.push(x);
    });
    return out;
  }
  function mergeDict(local, remote, prefer) {
    var out = {};
    var a = (local && typeof local === 'object') ? local : {};
    var b = (remote && typeof remote === 'object') ? remote : {};
    var first = prefer === 'remote' ? b : a;
    var second = prefer === 'remote' ? a : b;
    Object.keys(second).forEach(function (k) { out[k] = second[k]; });
    Object.keys(first).forEach(function (k) { out[k] = first[k]; });
    return out;
  }

  /* ---------- IndexedDB 读（不带版本号；库不存在时立刻回滚，不造空库） ---------- */
  function idbGetAll(dbName, storeName, cb) {
    if (!window.indexedDB) { cb(null, new Error('no-idb')); return; }
    var req;
    try { req = indexedDB.open(dbName); } catch (e) { cb(null, e); return; }
    req.onupgradeneeded = function (e) {
      try { e.target.transaction.abort(); } catch (x) {}
    };
    req.onerror = function () { cb(null, req.error || new Error('idb-error')); };
    req.onblocked = function () { cb(null, new Error('idb-blocked')); };
    req.onsuccess = function () {
      var db = req.result;
      var has = false;
      try { has = db.objectStoreNames.contains(storeName); } catch (e) {}
      if (!has) { try { db.close(); } catch (e) {} cb(null, new Error('no-store')); return; }
      try {
        var rq = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        rq.onsuccess = function () { var r = rq.result || []; try { db.close(); } catch (e) {} cb(r, null); };
        rq.onerror = function () { try { db.close(); } catch (e) {} cb(null, rq.error || new Error('idb-read')); };
      } catch (e) { try { db.close(); } catch (x) {} cb(null, e); }
    };
  }
  /* 相册没有内存缓存层（各页启动现读 IDB），所以由本模块直接写 */
  function idbWriteAlbums(albums, replace, cb) {
    if (!window.indexedDB) { cb(new Error('no-idb')); return; }
    var req;
    try { req = indexedDB.open('trace-albums', 2); } catch (e) { cb(e); return; }
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
    };
    req.onerror = function () { cb(req.error || new Error('idb-open')); };
    req.onsuccess = function () {
      var db = req.result;
      try {
        var tx = db.transaction('albums', 'readwrite');
        var st = tx.objectStore('albums');
        if (replace) st.clear();
        albums.forEach(function (a) { if (a && typeof a.id === 'string' && a.id) st.put(a); });
        tx.oncomplete = function () { try { db.close(); } catch (e) {} cb(null); };
        tx.onerror = function () { try { db.close(); } catch (e) {} cb(tx.error || new Error('idb-write')); };
        tx.onabort = function () { try { db.close(); } catch (e) {} cb(tx.error || new Error('idb-abort')); };
      } catch (e) { try { db.close(); } catch (x) {} cb(e); }
    };
  }

  /* ---------- 采集 ---------- */
  function collect(cb) {
    var env = {
      kind: KIND, schema: SCHEMA, createdAt: Date.now(), app: 'trace',
      notes: [], albums: [], storage: { data: {}, prefs: {} }
    };
    idbGetAll('gujian-notes', 'notes', function (idbNotes, err) {
      /* 内存是同步真相源（刚记的一撇可能还没 flush 进 IDB），两者按 id 求并集、内存优先 */
      var mem = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list() : [];
      env.notes = err ? mem.slice() : mergeById(mem, idbNotes || [], 'local');
      idbGetAll('trace-albums', 'albums', function (albums) {
        env.albums = albums || [];
        env.storage = collectStorage();
        cb(null, env);
      });
    });
  }

  /* 哨兵扫描：白名单之外再加一道硬闸，密钥类键名一旦出现直接拒绝出包 */
  function secretHits(env) {
    var hits = [];
    var s = (env && env.storage) || {};
    ['data', 'prefs'].forEach(function (g) {
      Object.keys(s[g] || {}).forEach(function (k) {
        if (NEVER.exact.indexOf(k) >= 0) hits.push(k);
        else if (NEVER.prefix.some(function (p) { return k.indexOf(p) === 0; })) hits.push(k);
      });
    });
    return hits;
  }

  function serialize(env) {
    var hits = secretHits(env);
    if (hits.length) throw new Error('备份内容含禁入键：' + hits.join(', '));
    return JSON.stringify(env);
  }

  /* ---------- 校验 ---------- */
  function validate(text) {
    var obj;
    try { obj = typeof text === 'string' ? JSON.parse(text) : text; }
    catch (e) { return { ok: false, error: '不是合法的 JSON' }; }
    if (!obj || typeof obj !== 'object') return { ok: false, error: '备份内容不是对象' };
    if (obj.schema !== SCHEMA) {
      return { ok: false, error: obj.schema == null ? '缺少 schema 字段（旧版单游记备份请用「导入备份」）' : '备份 schema=' + obj.schema + '，本版本只认 ' + SCHEMA };
    }
    if (obj.kind !== KIND) return { ok: false, error: '不是行迹全量备份（kind=' + obj.kind + '）' };
    if (!Array.isArray(obj.notes)) return { ok: false, error: 'notes 字段缺失或不是数组' };
    if (obj.albums != null && !Array.isArray(obj.albums)) return { ok: false, error: 'albums 字段不是数组' };
    var hits = secretHits(obj);
    if (hits.length) return { ok: false, error: '备份含禁入键：' + hits.join(', ') };
    return { ok: true, env: obj };
  }

  /* ---------- 人读摘要 ---------- */
  function describe(env) {
    var s = env.storage || {};
    var d = s.data || {}, p = s.prefs || {};
    var bytes = 0;
    try { bytes = JSON.stringify(env).length; } catch (e) {}
    var dt = new Date(env.createdAt || 0);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return (env.notes || []).length + ' 篇游记 · ' + (env.albums || []).length + ' 本图册 · '
      + Object.keys(d).length + ' 项数据键 / ' + Object.keys(p).length + ' 项偏好 · '
      + (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB')
      + (env.createdAt ? ' · 备份于 ' + dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate())
        + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) : '');
  }

  /* ---------- 恢复 ---------- */
  /* opts: { mode:'merge'|'replace', prefer:'local'|'remote' } */
  function apply(env, opts, cb) {
    opts = opts || {};
    var prefer = opts.prefer === 'remote' ? 'remote' : 'local';
    var replace = opts.mode === 'replace';
    if (!env || env.schema !== SCHEMA) { cb(new Error('备份格式不符（需要 schema ' + SCHEMA + '）')); return; }
    if (!window.TravelNotes || !TravelNotes.replaceNotes) { cb(new Error('游记模块未加载，无法恢复游记')); return; }

    var localNotes = (TravelNotes.list && TravelNotes.list()) || [];
    var stats = { written: 0, cleared: 0, skipped: 0, failed: 0, localBags: { data: {}, prefs: {} } };
    allLocalStorageKeys().forEach(function (k) {
      var pol = policyOf(k);
      if (pol && GROUPS[pol.g]) stats.localBags[pol.g][k] = 1;
    });
    writeStorage(env, prefer, replace, stats);

    var notes = replace ? (env.notes || []).slice() : mergeById(localNotes, env.notes || [], prefer);
    TravelNotes.replaceNotes(notes);
    stats.notes = notes.length;
    stats.notesAdded = replace ? notes.length : notes.length - localNotes.length;

    idbGetAll('trace-albums', 'albums', function (cur, err0) {
      if (err0) cur = [];
      cur = cur || [];
      var albums = replace ? (env.albums || []).slice() : mergeById(cur, env.albums || [], prefer);
      stats.albums = albums.length;
      stats.albumsAdded = replace ? albums.length : albums.length - cur.length;
      idbWriteAlbums(albums, replace, function (err) {
        if (err) { cb(err, stats); return; }
        cb(null, stats);
      });
    });
  }

  window.Backup = {
    SCHEMA: SCHEMA,
    KIND: KIND,
    KEYS: KEYS,
    NEVER: NEVER,
    policyOf: policyOf,
    classOf: classOf,
    collect: collect,
    serialize: serialize,
    validate: validate,
    describe: describe,
    apply: apply,
    mergeById: mergeById,
    mergeDict: mergeDict,
    secretHits: secretHits
  };
})();
