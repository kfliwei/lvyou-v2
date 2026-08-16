/* 一句话加节点：AI/规则解析 → 自动添加（含坐标本地匹配） */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!h.includes(from)) { console.log('SKIP', tag); return; }
  h = h.split(from).join(to); n++;
  console.log('OK  ', tag);
}

/* 1. 弹层标题与提示文案 */
rep(
  `'<div class="ui-modal-title">✨ 关键词加节点</div>'`,
  `'<div class="ui-modal-title">✨ 加节点</div>'`,
  '1 标题'
);
rep(
  `'<input id="aiNodeInput" class="nm-in" style="flex:1;min-width:0;margin-bottom:0" placeholder="输入地点关键词，如「故宫」" autocomplete="off">'`,
  `'<input id="aiNodeInput" class="nm-in" style="flex:1;min-width:0;margin-bottom:0" placeholder="输入地点或一句话，如：我想加成都武侯祠，三国文化" autocomplete="off">'`,
  '2 placeholder'
);
rep(
  `'<div style="font-size:11.5px;color:var(--color-muted);margin-top:6px;line-height:1.6">输入关键词后列出相近地点，点选一个，再由 AI 补全分类与介绍</div>'`,
  `'<div style="font-size:11.5px;color:var(--color-muted);margin-top:6px;line-height:1.6">一句话（我想加/我要加…）自动识别省市与分类直接添加；或输入关键词列出相近地点点选</div>'`,
  '3 提示'
);

/* 2. 一句话解析 + 添加（插在 aiAddNode 函数前） */
rep(
  `  function aiAddNode() {`,
  `  /* ---------- 一句话加节点 ---------- */
  function parseOneLineRule(t) {
    var NOISE = ['我想', '我要', '帮我', '麻烦', '请', '添加', '加个', '加上', '新建', '记录', '收藏', '一个', '一处', '去', '在', '位于', '的', '景点', '地方', '打卡', '好去处', '吧', '啊', '呢', '。', '，', ',', '.', '！', '!', '？', '?', '推荐', '想去'];
    var s = t;
    NOISE.forEach(function (w) { s = s.split(w).join(' '); });
    s = s.replace(/\\s+/g, ' ').trim();
    var city = '', prov = '';
    var citySet = {}, provOf = {};
    (SITES || []).forEach(function (x) { if (x.city) { citySet[x.city] = 1; provOf[x.city] = x.region; } });
    var cities = Object.keys(citySet).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < cities.length; i++) { if (s.indexOf(cities[i]) >= 0) { city = cities[i]; prov = provOf[city] || ''; s = s.split(cities[i]).join(' '); break; } }
    s = s.replace(/\\s+/g, ' ').trim();
    if (!prov) {
      var regs = {};
      (SITES || []).forEach(function (x) { if (x.region) regs[x.region] = 1; });
      var rs = Object.keys(regs).sort(function (a, b) { return b.length - a.length; });
      for (var j = 0; j < rs.length; j++) { if (s.indexOf(rs[j]) >= 0) { prov = rs[j]; s = s.split(rs[j]).join(' '); break; } }
      s = s.replace(/\\s+/g, ' ').trim();
    }
    var THEMES = ['古城', '古镇', '寺庙', '寺院', '道观', '教堂', '博物馆', '纪念馆', '故居', '遗址', '石窟', '古建筑', '园林', '公园', '自然保护区', '国家公园', '雪山', '冰川', '湖泊', '草原', '沙漠', '峡谷', '瀑布', '温泉', '海滨', '海岛', '湿地', '溶洞', '梯田', '茶园', '花海', '森林', '村落', '山寨', '老街', '码头', '桥梁', '文化', '历史', '自然', '民俗', '美食', '街区', '陵墓', '长城', '口岸', '灯塔'];
    var theme = '';
    for (var k = 0; k < THEMES.length; k++) { if (s.indexOf(THEMES[k]) >= 0) { theme = THEMES[k]; break; } }
    var parts = s.split(' ').filter(Boolean);
    if (theme) {
      var ti = -1;
      for (var q = 0; q < parts.length; q++) if (parts[q].indexOf(theme) >= 0) { ti = q; break; }
      if (ti >= 0) parts.splice(ti, 1);
    }
    var name = parts.join('');
    if (!name || name.length < 2) name = t.replace(/[，。,!！?？\\s]/g, ' ').replace(/(我想|我要|帮我|添加|加个|一个|去|在|位于|的|景点|地方|吧)/g, ' ').replace(/\\s+/g, ' ').trim();
    return { name: name, province: prov, city: city, category: theme || '其他', desc: '' };
  }
  function findNodeCoord(name, city) {
    var hits = (SITES || []).filter(function (x) { return x.name === name; });
    if (!hits.length) hits = (SITES || []).filter(function (x) { return x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0; });
    if (!hits.length && city) hits = (SITES || []).filter(function (x) { return x.city === city && (x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0); });
    return hits[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null;
  }
  function oneLineAdd(text) {
    var finish = function (parsed) {
      var name = (parsed.name || '').trim();
      if (!name || name.length < 2) { tip('没能识别出景点名，试试：我想加成都武侯祠，三国文化'); return; }
      var arr = loadUserNodes();
      if (arr.some(function (x) { return x.name === name; })) { tip('已有同名节点「' + name + '」'); return; }
      var coord = findNodeCoord(name, parsed.city);
      var rec = {
        id: Date.now().toString(36),
        name: name,
        lat: coord ? coord.lat : null, lng: coord ? coord.lng : null, gcj: false,
        province: parsed.province || '', city: parsed.city || '',
        category: parsed.category || '其他', tags: [],
        elev: '', address: '', coverImage: '',
        desc: parsed.desc || '', createdAt: Date.now(), updatedAt: Date.now()
      };
      arr.push(rec); saveUserNodes(arr);
      try { placeUserMarker(rec); } catch (e) {}
      var m2 = document.querySelector('.nm-mask');
      if (m2 && m2.querySelector('#aiNodeInput')) m2.remove();
      tip('已添加「' + name + '」' + (rec.lat != null ? '' : '（未匹配坐标，可地图点选补位）'));
      try { refreshMine(); } catch (e) {}
    };
    /* AI 优先（配置了 Key），失败降级规则 */
    var key = ''; try { key = localStorage.getItem('tn_aiKey') || ''; } catch (e) {}
    if (key && window.Ai && Ai.chat) {
      Ai.chat([
        { role: 'system', content: '你是旅行地点编辑助手。从用户一句话中提取地点信息，只输出 JSON：{"name":"景点名","province":"省","city":"市","category":"分类","desc":"30字内简介"}。分类从：古城/古镇/寺庙/博物馆/纪念馆/故居/遗址/园林/公园/自然风光/湖泊/雪山/草原/峡谷/瀑布/温泉/民俗/美食/街区/其他 中选。无法识别景点名时输出 {"name":""}。' },
        { role: 'user', content: text }
      ]).then(function (t) {
        var j = null;
        try { j = JSON.parse(t.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
        if (j && j.name) finish(j); else finish(parseOneLineRule(text));
      }).catch(function () { finish(parseOneLineRule(text)); });
    } else finish(parseOneLineRule(text));
  }

  function aiAddNode() {`,
  '4 一句话解析'
);

/* 3. go 按钮分流：意图词走一句话 */
rep(
  `    go.onclick = function () { run(); };`,
  `    go.onclick = function () {
      var t = (input.value || '').trim();
      if (/(我想|我要|帮我|加个|加上|添加|新建|记录一下|想去)/.test(t)) oneLineAdd(t); else run();
    };`,
  '5 go 分流'
);

fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
console.log('patches:', n);
