/* ============================================================
   TRACE v2 示例测试数据
   - window.loadTestData()  载入 8 条示例游记（含照片，id 前缀 demo-，与真实数据按 id 去重合并）
   - window.clearTestData() 移除全部 demo- 示例数据（保留真实数据）
   照片位于 img-test/（SVG 占位风景）
   ============================================================ */
(function () {
  var DAY = 86400000;
  var now = Date.now();
  function d(offsetDays, h, m) {
    var t = new Date(now - offsetDays * DAY);
    t.setHours(h, m, 0, 0);
    return t.getTime();
  }
  function fmt(ts) {
    var x = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes());
  }
  function dayOf(ts) { return fmt(ts).slice(0, 10); }
  function photo(name) { return 'img-test/' + name; }

  var notes = [
    {
      id: 'demo-1',
      title: '瑞金 · 长征的起点',
      siteName: '叶坪革命旧址群',
      siteIndex: -1,
      lat: 25.8822, lng: 116.0343,
      ts: d(7, 9, 24), date: fmt(d(7, 9, 24)), day: dayOf(d(7, 9, 24)),
      province: '江西', city: '赣州市', county: '瑞金市',
      raw: '刚到瑞金，雨刚停，叶坪的樟树很老。',
      text: '雨停后的叶坪，樟树的气味很重。广场上人不多，站在出发地，想起这段路从这里开始，心里很安静。',
      style: 'prose',
      photos: [photo('photo-ruijin.svg')],
      audio: '', tags: ['出发地', '红色', '雨天'],
      weather: '多云 24°C'
    },
    {
      id: 'demo-2',
      title: '凤凰古城 · 初见沱江',
      siteName: '凤凰古城',
      siteIndex: -1,
      lat: 27.9483, lng: 109.5991,
      ts: d(6, 14, 32), date: fmt(d(6, 14, 32)), day: dayOf(d(6, 14, 32)),
      province: '湖南', city: '湘西州', county: '凤凰县',
      raw: '沱江上雾还没散，船夫慢慢划。',
      text: '第一眼看到沱江的时候，雾还没有散。船夫在江上慢慢划，吊脚楼倒在水里，时间好像慢下来了。',
      style: 'prose',
      photos: [], audio: '', tags: ['古城', '沱江', '晨雾'],
      weather: '阴 22°C'
    },
    {
      id: 'demo-3',
      title: '桂林 · 漓江竹筏',
      siteName: '漓江',
      siteIndex: -1,
      lat: 25.0025, lng: 110.4812,
      ts: d(5, 10, 5), date: fmt(d(5, 10, 5)), day: dayOf(d(5, 10, 5)),
      province: '广西', city: '桂林市', county: '阳朔县',
      raw: '竹筏在江上走，九马画山的石头像马。',
      text: '竹筏顺流而下，两边的山一层一层退开。船夫说前面的石头叫九马画山，数来数去只认出两三匹。二十元的背景就是这里。',
      style: 'narrative',
      photos: [photo('photo-guilin.svg')], audio: '', tags: ['漓江', '竹筏', '山水'],
      weather: '晴 28°C'
    },
    {
      id: 'demo-4',
      title: '阳朔 · 西街的夜',
      siteName: '阳朔西街',
      siteIndex: -1,
      lat: 24.7785, lng: 110.4965,
      ts: d(4, 20, 14), date: fmt(d(4, 20, 14)), day: dayOf(d(4, 20, 14)),
      province: '广西', city: '桂林市', county: '阳朔县',
      raw: '晚上西街人多，啤酒鱼很香。',
      text: '晚上西街人挤人，吃了顿啤酒鱼。路边有人唱民谣，声音盖过人群，突然觉得旅行的晚上就该是这样。',
      style: 'moments',
      photos: [photo('photo-yangshuo.svg')], audio: '', tags: ['西街', '美食', '夜'],
      weather: '晴 27°C'
    },
    {
      id: 'demo-5',
      title: '大理 · 洱海边的下午',
      siteName: '洱海',
      siteIndex: -1,
      lat: 25.7183, lng: 100.2163,
      ts: d(3, 15, 40), date: fmt(d(3, 15, 40)), day: dayOf(d(3, 15, 40)),
      province: '云南', city: '大理州', county: '大理市',
      raw: '洱海很蓝，风大，云走得快。',
      text: '洱海的水是蓝绿色的，风很大，云走得特别快。骑了一段路，停下来看苍山，山上有雪。',
      style: 'guide',
      photos: [photo('photo-dali.svg')], audio: '', tags: ['洱海', '骑行', '苍山'],
      weather: '晴 25°C'
    },
    {
      id: 'demo-6',
      title: '拉萨 · 布达拉宫',
      siteName: '布达拉宫',
      siteIndex: -1,
      lat: 29.6548, lng: 91.1175,
      ts: d(2, 11, 20), date: fmt(d(2, 11, 20)), day: dayOf(d(2, 11, 20)),
      province: '西藏', city: '拉萨市', county: '城关区',
      raw: '到拉萨第一天，布达拉宫在太阳下很亮。',
      text: '到拉萨的第一天有点喘，布达拉宫在太阳下白得发亮。转经的人很多，风里有酥油茶的味道。',
      style: 'raw',
      photos: [photo('photo-lhasa.svg')], audio: '', tags: ['拉萨', '布达拉宫', '高原'],
      weather: '晴 18°C'
    },
    {
      id: 'demo-7',
      title: '平遥 · 明清街',
      siteName: '平遥古城',
      siteIndex: -1,
      lat: 37.2055, lng: 112.1766,
      ts: d(1, 16, 8), date: fmt(d(1, 16, 8)), day: dayOf(d(1, 16, 8)),
      province: '山西', city: '晋中市', county: '平遥县',
      raw: '平遥的城墙很完整，街上都是老铺子。',
      text: '平遥的城墙保存得真好，围着走了一圈要一个多小时。街上的老铺子卖醋和漆器，闻到醋香就走不动。',
      style: 'narrative',
      photos: [photo('photo-pingyao.svg')], audio: '', tags: ['古城', '城墙', '晋商'],
      weather: '多云 21°C'
    },
    {
      id: 'demo-8',
      title: '归途 · 高速上的落日',
      siteName: '回程路上',
      siteIndex: -1,
      lat: 32.0603, lng: 118.7969,
      ts: d(0, 18, 45), date: fmt(d(0, 18, 45)), day: dayOf(d(0, 18, 45)),
      province: '江苏', city: '南京市', county: '',
      raw: '回家路上看到落日，橘红色的。',
      text: '回程的高速上，落日把天烧成橘红色。这一路走下来，才发现最想念的是路上每一顿简单的饭。',
      style: 'prose',
      photos: [], audio: '', tags: ['回程', '落日'],
      weather: '晴 26°C'
    }
  ];

  /* ---------- IndexedDB 持久层（与 travel-notes.js 同库 gujian-notes/notes）----------
     关键：travel-notes.js 优先从 IndexedDB 读数据，localStorage 只是 IDB 不可用时的兜底。
     所以示例数据必须「IDB + localStorage 双写」，否则提示载入成功但页面读不到。 */
  function openDB(cb) {
    if (!window.indexedDB) { cb(null); return; }
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
      req.onsuccess = function (e) { cb(e.target.result); };
      req.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbGetAll(db, cb) {
    try {
      var tx = db.transaction('notes', 'readonly');
      var rq = tx.objectStore('notes').getAll();
      rq.onsuccess = function () { cb(rq.result || []); };
      rq.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbWriteAll(db, list, cb) {
    try {
      var tx = db.transaction('notes', 'readwrite');
      var st = tx.objectStore('notes');
      st.clear();
      list.forEach(function (n) { st.put(n); });
      tx.oncomplete = function () { cb && cb(true); };
      tx.onerror = function () { cb && cb(false); };
    } catch (e) { cb && cb(false); }
  }
  /* 合并 demo- 数据（按 id 去重） */
  function mergeDemo(base) {
    var ids = {}; base.forEach(function (n) { ids[n.id] = 1; });
    var added = 0;
    notes.forEach(function (n) { if (!ids[n.id]) { base.push(n); added++; ids[n.id] = 1; } });
    return { added: added, total: base.length };
  }

  window.loadTestData = function () {
    var res = { added: 0, total: 0 };
    try {
      var old = [];
      try { old = JSON.parse(localStorage.getItem('travelNotes') || '[]'); } catch (e) {}
      var m = mergeDemo(old);
      res = m;
      localStorage.setItem('travelNotes', JSON.stringify(old));
    } catch (e) { return { err: String(e) }; }
    /* IDB 双写（异步）：读现有 → 合并 → 整库重写 */
    var idbPromise = new Promise(function (resolve) {
      openDB(function (db) {
        if (!db) { resolve(); return; }
        idbGetAll(db, function (existing) {
          if (existing === null) { resolve(); return; }
          mergeDemo(existing);
          idbWriteAll(db, existing, function () { resolve(); });
        });
      });
    });
    res.idb = idbPromise;
    return res;
  };

  window.clearTestData = function () {
    var res = { removed: 0, total: 0 };
    try {
      var old = [];
      try { old = JSON.parse(localStorage.getItem('travelNotes') || '[]'); } catch (e) {}
      var keep = old.filter(function (n) { return (n.id || '').indexOf('demo-') !== 0; });
      res = { removed: old.length - keep.length, total: keep.length };
      localStorage.setItem('travelNotes', JSON.stringify(keep));
    } catch (e) { return { err: String(e) }; }
    var idbPromise = new Promise(function (resolve) {
      openDB(function (db) {
        if (!db) { resolve(); return; }
        idbGetAll(db, function (existing) {
          if (existing === null) { resolve(); return; }
          var kept = existing.filter(function (n) { return (n.id || '').indexOf('demo-') !== 0; });
          idbWriteAll(db, kept, function () { resolve(); });
        });
      });
    });
    res.idb = idbPromise;
    return res;
  };
})();
