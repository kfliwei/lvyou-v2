/* =========================================================
 * planner.js — 对话式行程规划 v1
 * 分工：AI 只产「选什么 + 为什么 + 叙事」，引擎(纯本地规则)负责召回/排期/耗时/季节校验。
 * 数据：nation-index.js 的 window.NATION_SITES_RAW（9 列轻量索引，7833 节点）
 * 复用：window.Ai(travel-notes.js) / window.Geo(geo.js) / window.Wish(wishlist.js) / UI(ui.js)
 * AI 参与三档（localStorage tn_plan_ai）：off 纯规则 / narrate 规则+叙事(默认) / full 规则+意图增强+叙事
 * ========================================================= */
(function () {
  'use strict';

  /* ---------- 基础工具 ---------- */
  var esc = (window.UI && UI.esc) ? UI.esc : function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  function toast(m) { if (window.UI) UI.toast(m); }
  function $id(id) { return document.getElementById(id); }

  /* ---------- 主题别名（镜像 topic-meta.js 的 THEME_ALIAS，避免为 15 行加载 119KB） ---------- */
  var THEME_ALIAS = {
    '溶洞奇观': '溶洞', '温泉康养': '温泉', '温泉地热': '温泉',
    '佛寺': '寺庙', '古建寺院': '寺庙', '庙宇道观': '寺庙', '石窟寺': '石窟艺术',
    '名城名镇': '古城古镇', '古城': '古城古镇',
    '森林山川': '森林草原',
    '峡谷天堑': '峡谷',
    '雪山冰川': '冰川',
    '遗址陵墓': '古遗址',
    '纪念碑': '红色遗迹',
    '楼阁牌坊': '古城古镇',
    '寺观彩塑': '寺观壁画', '壁画彩塑': '寺观壁画',
    '江河峡谷': '峡谷',
    '陵寝墓葬': '古遗址'
  };
  function normTheme(t) { return THEME_ALIAS[t] || t; }

  /* ---------- 偏好 → 主题分组（kw 用于关键词命中，themes 为归一后主题） ---------- */
  var PREF = {
    '自然风光': { kw: ['自然', '风景', '山水', '风光', '森林', '湖泊', '草原', '海岛', '海边', '瀑布'], themes: ['森林草原', '名山大川', '江河湖泊', '高原湖泊', '峡谷', '江河瀑布', '溶洞', '草原湿地', '海岛海滩', '冰川', '沙漠戈壁', '丹霞地貌', '雅丹地貌', '瀑布', '盐湖', '圣湖', '神山', '雪山高原', '雪山草地', '火山地貌', '热带雨林', '湖泊', '洞穴', '喀斯特山水'] },
    '人文历史': { kw: ['人文', '历史', '古迹', '古镇', '古城', '宗教', '寺庙', '石窟', '博物馆', '文物', '文庙', '古建'], themes: ['古城古镇', '宗教圣地', '古城遗址', '寺庙', '石窟艺术', '文庙书院', '古遗址', '人文古迹', '寺观壁画', '道观', '神祠', '衙署民居', '长城关隘', '古戏台', '祠庙', '陵墓', '宅院', '纪念馆', '博物馆', '古塔'] },
    '红色足迹': { kw: ['红色', '长征', '革命', '战役', '会师', '渡江', '根据地'], themes: ['红色遗迹', '重大战役', '旧址纪念地', '重要会议', '会师地', '出发地', '渡口渡江'] },
    '城市休闲': { kw: ['城市', '休闲', '地标', '公园', '温泉', '美食', '逛街', '夜景'], themes: ['城市地标', '主题公园', '温泉', '公园'] },
    '民族风情': { kw: ['民族', '风情', '村寨', '民俗', '部落'], themes: ['民族风情', '民族村寨', '村庄'] },
    '地貌奇观': { kw: ['地貌', '丹霞', '峡谷', '溶洞', '雪山', '冰川', '沙漠', '奇观', '雅丹'], themes: ['丹霞地貌', '雅丹地貌', '沙漠戈壁', '溶洞', '喀斯特山水', '土林', '火山地貌', '洞穴', '峡谷', '冰川', '盐湖'] }
  };
  var PREF_KEYS = Object.keys(PREF);
  function prefThemes(p) { return PREF[p] ? PREF[p].themes : []; }
  function prefHit(p, t) { var def = PREF[p]; var n = normTheme(t); return !!(def && def.themes && def.themes.indexOf(n) >= 0); }

  /* ---------- 主题 → 颜色 / 时长 ---------- */
  var THEME_COLOR = { '高原湖泊': '#5F6D76', '雪山冰川': '#9C9A92', '名山大川': '#71806C', '峡谷天堑': '#8A5A44', '江河瀑布': '#5F6D76', '古建寺院': '#96472F', '古城古镇': '#8A5A44', '古城遗址': '#7E7663', '红色遗迹': '#AE5738', '民族风情': '#AE5738', '城市地标': '#6D7D88', '溶洞奇观': '#8C7B66', '森林草原': '#71806C', '森林山川': '#71806C', '宗教圣地': '#96472F', '遗址陵墓': '#7E7663', '温泉康养': '#AE5738', '石窟艺术': '#96472F', '丹霞地貌': '#BA7517', '雅丹地貌': '#BA7517', '沙漠戈壁': '#BA7517', '草原湿地': '#639922', '寺庙': '#96472F', '古塔': '#7E7663', '草原': '#639922', '冰川': '#9C9A92' };
  function themeColor(t) { return THEME_COLOR[normTheme(t)] || THEME_COLOR[t] || '#B4AFA4'; }
  function playH(s) {
    var t = normTheme(s.theme);
    if (prefHit('自然风光', t) || prefHit('地貌奇观', t)) return 3;
    if (prefHit('城市休闲', t)) return 1.5;
    return 2;
  }

  /* ---------- 数据：解析全国轻量索引 ---------- */
  var INDEX = null, regionSet = null, cityToRegion = null, cityCoord = {};
  function parseIndex() {
    if (INDEX) return INDEX;
    INDEX = (window.NATION_SITES_RAW || '').split('\n').map(function (line) {
      var p = line.split('|');
      return { name: p[0], label: p[1], region: p[2], city: p[3], county: p[4], theme: p[5], flag: p[6], lat: +p[7], lng: +p[8] };
    }).filter(function (s) { return s.name && isFinite(s.lat) && isFinite(s.lng); });
    return INDEX;
  }
  function buildDicts() {
    if (regionSet) return;
    regionSet = {}; cityToRegion = {}; cityCoord = {};
    parseIndex().forEach(function (s) {
      regionSet[s.region] = 1;
      if (s.city) {
        cityToRegion[s.city] = s.region;
        if (!cityCoord[s.city]) cityCoord[s.city] = { lat: s.lat, lng: s.lng };
        var base = s.city.replace(/[市州盟地区]$/, '');
        if (!cityCoord[base]) cityCoord[base] = { lat: s.lat, lng: s.lng };
      }
    });
  }
  var REGION_ALIAS = { '川西': '四川', '川北': '四川', '川南': '四川', '甘南': '甘肃', '滇西': '云南', '滇西北': '云南', '滇南': '云南', '青藏': '西藏', '藏东': '西藏', '藏北': '西藏', '藏南': '西藏', '藏东南': '西藏', '阿里': '西藏', '黔东南': '贵州', '黔西南': '贵州', '呼伦贝尔': '内蒙古', '锡林郭勒': '内蒙古', '北疆': '新疆', '南疆': '新疆', '河西': '甘肃', '陕北': '陕西', '陕南': '陕西', '桂北': '广西', '桂西': '广西', '湘西': '湖南', '湘南': '湖南', '鄂西': '湖北', '赣南': '江西', '闽南': '福建', '粤西': '广东', '粤北': '广东' };
  function matchRegions(text) {
    buildDicts();
    var t = text || '', found = [], seen = {};
    function add(r) { if (r && regionSet[r] && !seen[r]) { seen[r] = 1; found.push(r); } }
    Object.keys(regionSet).forEach(function (r) { if (t.indexOf(r) >= 0) add(r); });
    Object.keys(REGION_ALIAS).forEach(function (k) { if (t.indexOf(k) >= 0) add(REGION_ALIAS[k]); });
    Object.keys(cityToRegion).forEach(function (c) { var b = c.replace(/[市州盟地区]$/, ''); if (b.length >= 2 && t.indexOf(b) >= 0) add(cityToRegion[c]); });
    return found;
  }

  /* ---------- 用户画像（P2-8）：把本机历史口味喂给 AI 精选路线 ----------
     只送聚合口径（省/市 Top3、心愿单主题、近期关键词），不送游记正文：
     正文既是最私密的东西又是 prompt 里最长的一段，模型判断口味用关键词就够了。
     开关 tn_plan_pref 默认开（写 '0' 才关），键名刻意避开 tn_weather_/tn_key_/tn_model_ 等既有前缀。 */
  var PREF_KEY = 'tn_plan_pref';
  function prefOn() { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch (e) { return true; } }
  /* 游记里存的是「山西省/广西壮族自治区」，索引里是裸名，两边对不上就当两个地方算了 */
  function bareRegion(r) { return String(r || '').replace(/(特别行政区|自治州|自治区|省|市)$/, ''); }
  function topKeys(counter, n) {
    return Object.keys(counter).sort(function (a, b) {
      return counter[b] - counter[a] || (a < b ? -1 : a > b ? 1 : 0);
    }).slice(0, n);
  }
  function prefSummary() {
    if (!prefOn()) return '';
    buildDicts();
    var prov = {}, city = {}, theme = {}, kw = {};
    function bump(o, k) { if (k) o[k] = (o[k] || 0) + 1; }
    /* 去过的地方 = 排过的行程 + 写过的游记 + 打过卡的心愿单 */
    loadTrips().forEach(function (t) {
      (t.days || []).forEach(function (d) {
        (d.stops || []).forEach(function (s) {
          bump(city, s.city);
          if (s.city && cityToRegion[s.city]) bump(prov, cityToRegion[s.city]);
        });
      });
    });
    var notes = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list() : [];
    notes.forEach(function (n) {
      var p = bareRegion(n.province);
      if (p && p !== '其他') bump(prov, p);
      bump(city, n.city);
    });
    var wl = (window.Wish && Wish.list) ? Wish.list() : [];
    wl.forEach(function (w) {
      if (w.visited) { bump(prov, bareRegion(w.region)); bump(city, w.city); }
      bump(theme, w.theme);
    });
    /* 近期 vibe：最近 3 篇的标签，没有标签的篇目跳过（不拿标题冒充口味） */
    notes.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 3).forEach(function (n) {
      (n.tags || []).forEach(function (t) { bump(kw, String(t).trim()); });
    });
    var pTop = topKeys(prov, 3), cTop = topKeys(city, 3), tTop = topKeys(theme, 3), kTop = topKeys(kw, 6);
    var parts = [];
    if (pTop.length) parts.push('去过 ' + pTop.join('/'));
    if (cTop.length) parts.push('常去城市 ' + cTop.join('/'));
    if (tTop.length) parts.push('心愿单主题 ' + tTop.join('/'));
    if (kTop.length) parts.push('近期关键词 ' + kTop.join('、'));
    return parts.join('；').slice(0, 160);
  }

  /* ---------- 分省详情懒加载（取 best/elev/desc，供季节校验） ---------- */
  var PROV_FILE = { '北京': 'bj-data.js', '天津': 'tj-data.js', '河北': 'he-data.js', '山西': 'data.js', '内蒙古': 'nmg-data.js', '辽宁': 'ln-data.js', '吉林': 'jl-data.js', '黑龙江': 'hlj-data.js', '上海': 'sh-data.js', '江苏': 'js-data.js', '浙江': 'zj-data.js', '安徽': 'ah-data.js', '福建': 'fj-data.js', '江西': 'changzheng-data.js', '山东': 'sd-data.js', '河南': 'ha-data.js', '湖北': 'hb-data.js', '湖南': 'hn-data.js', '广东': 'gd-data.js', '广西': 'gxyn-data.js', '海南': 'hi-data.js', '重庆': 'cq-data.js', '四川': 'sc-data.js', '贵州': 'gz-data.js', '云南': 'gxyn-data.js', '西藏': 'xz-data.js', '陕西': 'sx-data.js', '甘肃': 'gs-data.js', '青海': 'qh-data.js', '宁夏': 'nx-data.js', '新疆': 'xj-data.js', '香港': 'hk-data.js', '澳门': 'mo-data.js', '台湾': 'tw-data.js' };
  var detailCache = {}, provLoading = {};
  function loadProvinceDetail(region, cb) {
    var file = PROV_FILE[region];
    if (!file) { cb && cb(); return; }
    if (provLoading[file] === 2) { cb && cb(); return; }
    if (provLoading[file] === 1) { var t = setInterval(function () { if (provLoading[file] !== 1) { clearInterval(t); cb && cb(); } }, 160); return; }
    provLoading[file] = 1;
    var prev = window.SITES;
    var sc = document.createElement('script');
    sc.src = file;
    sc.onload = function () {
      var arr = window.SITES || [];
      window.SITES = prev;
      arr.forEach(function (x) { if (x && x.name && (x.best || x.desc || x.elev)) detailCache[x.name] = { best: x.best, elev: x.elev, desc: x.desc }; });
      provLoading[file] = 2;
      cb && cb();
    };
    sc.onerror = function () { provLoading[file] = 2; cb && cb(); };
    document.head.appendChild(sc);
  }

  /* ---------- AI 参与三档开关 ---------- */
  var AI_KEY = 'tn_plan_ai';
  function getAILevel() {
    var v = 'narrate';
    try { v = localStorage.getItem(AI_KEY) || 'narrate'; } catch (e) {}
    if (v !== 'off' && v !== 'narrate' && v !== 'full') v = 'narrate';
    if ((v === 'narrate' || v === 'full') && !window.Ai.hasKey()) v = 'off';
    return v;
  }
  function setAILevel(l) {
    if (l === 'narrate' || l === 'full') { if (!window.Ai.hasKey()) { toast('请先在「设置 → AI 助手」配置站点与 Key'); return; } }
    try { localStorage.setItem(AI_KEY, l); } catch (e) {}
    renderAISwitch();
  }
  function renderAISwitch() {
    var lv = getAILevel(), noKey = !window.Ai.hasKey();
    var el = $id('aiSwitch');
    el.classList.toggle('locked', noKey);
    var btns = el.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-level') === lv);
      btns[i].disabled = noKey && btns[i].getAttribute('data-level') !== 'off';
    }
    var hint = $id('aiHint');
    if (noKey && !hint) {
      hint = document.createElement('div');
      hint.id = 'aiHint';
      hint.style.cssText = 'font-size:var(--fs-2);color:var(--color-muted);margin:-4px 0 12px;line-height:1.6';
      el.parentNode.insertBefore(hint, el.nextSibling);
    }
    if (hint) hint.textContent = noKey ? '未配置 AI Key，仅规则模式（去「设置」填入后可启用叙事/全量）' : '';
  }

  /* ---------- 状态 ---------- */
  var state = { regions: [], days: 0, prefs: [], start: null, end: null, startDate: '', candidates: [], selected: [], trip: null, fromWish: false, candFilter: '', amapSorted: false, wishPool: null, matrix: null };
  function nodeUid(s) { return (window.Wish ? Wish.uid(s) : String((s.name || s.label || '') + '|' + s.lat + '|' + s.lng)); }

  /* localStorage 写入守卫：满额时如实提示，不再伪装成功 */
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); return true; }
    catch (e) { toast('本地存储空间已满，本次未能保存'); return false; }
  }
  /* 高德路线/距离缓存 LRU 上限 300 条，防无界膨胀挤爆配额 */
  function rememberCacheKey(k) {
    try {
      var lst = JSON.parse(localStorage.getItem('tn_rc_idx') || '[]');
      var out = [];
      for (var i = 0; i < lst.length; i++) { var it = lst[i]; if (it !== k && localStorage.getItem(it) != null) out.push(it); }
      out.push(k);
      while (out.length > 300) { localStorage.removeItem(out.shift()); }
      localStorage.setItem('tn_rc_idx', JSON.stringify(out));
    } catch (e) {}
  }
  /* 规划进度快照（sessionStorage）：WebView 返回/刷新后可恢复 */
  var SS_KEY = 'tn_planner_state';
  var ssTimer = null;
  function writeSnap() {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        stage: curStage, regions: state.regions, days: state.days, prefs: state.prefs, autoPrefs: state.autoPrefs,
        start: state.start, end: state.end, startDate: state.startDate, isLoop: state.isLoop, wiz: state.wiz,
        candidates: state.candidates, selected: state.selected, trip: state.trip,
        fromWish: state.fromWish, amapSorted: state.amapSorted
      }));
    } catch (e) {}
  }
  function persistState() {
    /* 导航走之前必须同步落盘：跳到 checklist.html 会把这里的定时器全部带走，
       只写「等 350ms」的那一版会让返回后的行程 id 与清单桶对不上。 */
    clearTimeout(ssTimer);
    ssTimer = setTimeout(writeSnap, 350);
  }
  function isSelected(s) { var u = nodeUid(s); return state.selected.some(function (x) { return nodeUid(x) === u; }); }

  /* ---------- 意图解析（规则先行） ---------- */
  function parseIntent(text) {
    var t = (text || '').trim();
    var intent = { regions: matchRegions(t), days: 0, prefs: [], raw: t };
    var m = t.match(/(\d+)\s*[天日]/); if (m) intent.days = parseInt(m[1], 10);
    // 中文数字天数：两天/三天/一周/半个月/两三天（阿拉伯数字优先，未命中才走中文）
    if (!intent.days) {
      var CN = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
      var cm = t.match(/([一二两三四五六七八九十])\s*天/);
      if (cm && CN[cm[1]]) intent.days = CN[cm[1]];
      var cr = t.match(/([一二两三四五六七八九])\s*([一二两三四五六七八九])\s*天/);
      if (cr && CN[cr[2]]) intent.days = CN[cr[2]]; // 两三天→3、七八天→8
      if (t.indexOf('十来天') >= 0) intent.days = 10;
      if (t.indexOf('一周') >= 0) intent.days = 7;
      if (t.indexOf('两周') >= 0) intent.days = 14;
      if (t.indexOf('半个月') >= 0 || t.indexOf('半月') >= 0) intent.days = 15;
      if (t.indexOf('一个月') >= 0) intent.days = 30;
    }
    PREF_KEYS.forEach(function (p) { var kw = PREF[p].kw; for (var i = 0; i < kw.length; i++) if (t.indexOf(kw[i]) >= 0) { intent.prefs.push(p); break; } });
    return intent;
  }
  /* 节奏/同伴规则提取（无 Key 降级版 aiEnhance） */
  var PACE_KW = { '舒缓': ['慢慢', '不赶', '悠闲', '放松', '慢游', '佛系', '轻松', '休闲'], '紧凑': ['紧凑', '抓紧', '特种兵', '暴走', '高效', '赶时间'] };
  var COMPANION_KW = { '带老人': ['带爸妈', '带父母', '带老人', '带妈妈', '带爸爸', '带长辈', '陪爸妈', '陪父母'], '亲子': ['带孩子', '带娃', '带小孩', '带小朋友', '亲子'], '独自': ['独自', '一个人', '自己去'] };
  function ruleEnhance(text) {
    var t = text || '', pace = null, companions = null;
    Object.keys(PACE_KW).forEach(function (p) { if (pace) return; for (var i = 0; i < PACE_KW[p].length; i++) if (t.indexOf(PACE_KW[p][i]) >= 0) { pace = p; break; } });
    Object.keys(COMPANION_KW).forEach(function (c) { if (companions) return; for (var i = 0; i < COMPANION_KW[c].length; i++) if (t.indexOf(COMPANION_KW[c][i]) >= 0) { companions = c; break; } });
    if (!pace && !companions) return null;
    return { pace: pace || '一般', companions: companions || null, vibe: null };
  }

  /* ---------- 召回 ---------- */
  function recall(intent) {
    buildDicts();
    var MIN = 8, MAX = 40;
    state.widenMsg = null;
    function flagRank(s) { var f = s.flag || ''; return (f.indexOf('m') >= 0 ? 2 : 0) + (f.indexOf('h') >= 0 ? 1 : 0); }
    function byFlag(a, b) { return flagRank(b) - flagRank(a); }
    function pool(regions, prefs) {
      var hit = [], miss = [];
      parseIndex().forEach(function (s) {
        if (regions && regions.length && regions.indexOf(s.region) < 0) return;
        var isHit = !prefs || !prefs.length || prefs.some(function (p) { return prefHit(p, s.theme) || normTheme(p) === normTheme(s.theme); });
        (isHit ? hit : miss).push(s);
      });
      hit.sort(byFlag); miss.sort(byFlag);
      return { hit: hit, miss: miss };
    }
    /* 候选过少时逐级放宽：先松偏好，再松目的地，最后全库 */
    var p = pool(intent.regions, intent.prefs);
    state.strictCount = p.hit.length;
    if (p.hit.length < MIN && intent.prefs.length) {
      var p2 = pool(intent.regions, null);
      if (p2.hit.length > p.hit.length) { p = p2; state.widenMsg = '该目的地「' + intent.prefs.join('·') + '」类景点较少，已为你展示全部类型'; }
    }
    if (p.hit.length < MIN && intent.regions.length) {
      var p3 = pool(null, intent.prefs);
      if (p3.hit.length > p.hit.length) { p = p3; state.widenMsg = '该目的地景点较少，已扩展到全国「' + (intent.prefs.join('·') || '热门') + '」'; }
    }
    if (p.hit.length < MIN) {
      var p4 = pool(null, null);
      if (p4.hit.length > p.hit.length) { p = p4; state.widenMsg = '匹配较少，已展示全国热门景点'; }
    }
    /* novelty：从未命中偏好里挑 1~2 个必去/网红作为「换个不一样的」 */
    var novel = p.miss.slice(0, 2).map(function (s) { s.__novelty = true; return s; });
    var base = p.hit.slice(0, MAX);
    /* 插入 novelty 到第 3 位之后，避免全压在顶部 */
    if (novel.length) base = base.slice(0, 3).concat(novel, base.slice(3));
    return base;
  }
  /* ---------- 高德 POI 临时补位（本地严格匹配少时按需拉取，标记临时点不污染本地库） ---------- */
  function amapPoi(keyword, city, cb) {
    var key = ''; try { key = localStorage.getItem('tn_amap_key') || ''; } catch (e) {}
    if (!key) { cb && cb(null); return; }
    fetch('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(key) +
      '&keywords=' + encodeURIComponent(keyword) + '&city=' + encodeURIComponent(city || '') +
      '&offset=10&page=1&extensions=base')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var pois = [];
        try {
          if (d && d.status === '1' && d.pois) {
            d.pois.forEach(function (p) {
              var loc = (p.location || '').split(',');
              if (loc.length === 2 && isFinite(+loc[0]) && isFinite(+loc[1])) pois.push({ name: p.name, lat: +loc[1], lng: +loc[0] });
            });
          }
        } catch (e) {}
        cb && cb(pois);
      })
      .catch(function () { cb && cb(null); });
  }
  function maybeAmapSupplement(intent) {
    if (state.fromWish || !state.regions.length) return;
    if ((state.strictCount || 0) >= 8) return;
    var kw = state.regions.join(' ') + ' ' + (intent.prefs.length ? intent.prefs.join(' ') : '景点');
    amapPoi(kw, state.regions[0], function (pois) {
      if (!pois || !pois.length) return;
      var existing = {};
      state.candidates.forEach(function (s) { existing[String(s.lat.toFixed(3) + ',' + s.lng.toFixed(3))] = 1; });
      var added = [];
      pois.forEach(function (p) {
        var k2 = String(p.lat.toFixed(3) + ',' + p.lng.toFixed(3));
        if (existing[k2]) return;
        existing[k2] = 1;
        added.push({ name: p.name, label: p.name, region: state.regions[0], city: '', county: '', theme: intent.prefs[0] || '其他', flag: '', lat: p.lat, lng: p.lng, gcj: true, __poi: true });
      });
      if (added.length) { state.candidates = state.candidates.concat(added); renderCandidates(); toast('已补充 ' + added.length + ' 处高德临时点'); }
    });
  }

  /* 排线依据的唯一默认值：配了高德 Key 就默认走真实里程。
     此前 4 处向导初始化各写各的 'geo'，等于把兜底当首选——
     每个配好 Key 的用户第一眼看到的仍是一条不像路的直线示意。 */
  function defaultSortMode() { return getAmapKey() ? 'amap' : 'geo'; }
  function wizNew() { return { step: 1, sortMode: defaultSortMode(), sortOrder: 'asc' }; }
  /* 逐对取数的成本闸文案：超过上限就不硬扛，并且当场说清退回了什么口径——
     静默退直线是最坏的结果，用户会以为看到的就是真实道路。 */
  function overCapMsg(n) { return '已选 ' + n + ' 站，超过真实里程取数上限 ' + AMAP_MAX_STOPS + ' 站（逐对查询要 ' + (n * (n - 1) / 2) + ' 段），本次按地理最近邻排期'; }

  /* ---------- 排期（一把尺子：有真实里程就按真实里程，没有才按直线折算） ----------
     AVG_KMH 取 60 是门到门均速（含加油、找车位、吃饭），不是高速公路限速。
     定 48 会把 440 km 这种"一天确实能到"的段拆成两天，实测川西 4 站凭空多一个转场日。 */
  var AVG_KMH = 60, ROAD_FACTOR = 1.35;
  function coordKey(p) { return p.lat.toFixed(3) + ',' + p.lng.toFixed(3); }
  /* 选点集签名：矩阵缓存只在站点集合不变时可复用（增删一站就必须重取） */
  function picksSig(sel) { return sel.map(function (s) { return coordKey(s); }).sort().join('|'); }
  /* mkLeg(matrix)：日卡里程/耗时与排线依据共用的唯一尺子。
     matrix 为高德真实里程（按坐标对索引），未命中的段才退直线折算——
     此前排线按高德、日卡按 hav×1.35，同一个行程两本账，标题里程与地图对不上。 */
  function mkLeg(matrix) {
    return function (a, b) {
      if (!a || !b || a.lat == null || b.lat == null) return { km: 0, h: 0 };
      var k1 = coordKey(a) + '|' + coordKey(b), k2 = coordKey(b) + '|' + coordKey(a);
      var km = matrix && (matrix[k1] != null ? matrix[k1] : matrix[k2]);
      if (km == null) km = window.Geo.hav(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR;
      return { km: km, h: km / AVG_KMH };
    };
  }
  /* 单日驾驶超过 DRIVE_H 小时的长途自成一「在途转场日」；全天硬顶 DAY_CAP_H。
     结构上界可证：普通日 ≤ 9h 车程 + 3h 游玩 + 2.5h 固定 ≈ 14.5h，不会再排出跑不完的一天。 */
  var DRIVE_H = 9, DAY_CAP_H = 14;
  function legsOf(leg, a, b) {
    var L = leg(a, b), n = Math.max(1, Math.ceil(L.h / DRIVE_H)), out = [];
    for (var i = 0; i < n; i++) out.push({ km: L.km / n, h: L.h / n });
    return out;
  }
  /* 最近邻排序 + 2-opt（起终点锚定与矩阵路径同一套边界处理） */
  function orderStops(sel, start) {
    var hav = function (a, b) { return window.Geo.hav(a.lat, a.lng, b.lat, b.lng); };
    var startPt = (start && start.lat != null) ? start : null;
    var pts = sel.slice(), ordered = [];
    var cur = startPt;
    while (pts.length) {
      var idx = 0, bestD = Infinity;
      for (var k = 0; k < pts.length; k++) { var d = cur ? hav(cur, pts[k]) : 0; if (d < bestD) { bestD = d; idx = k; } }
      var nx = pts.splice(idx, 1)[0]; ordered.push(nx); cur = nx;
    }
    /* 2-opt 优化：任意站数都跑（旧写法 N>3 早退，3 站只剩最近邻，
       正是「两个远点被排在一起」高发的规模） */
    var N = ordered.length;
    var improved = true;
    while (improved) {
      improved = false;
      for (var i2 = 0; i2 < N - 1; i2++) {
        for (var k2 = i2 + 1; k2 < N; k2++) {
          var pb = ordered[i2], pc = ordered[k2], pd = (k2 + 1 < N) ? ordered[k2 + 1] : null;
          if (!pb || !pc || !pd) continue;
          var pa = i2 === 0 ? startPt : ordered[i2 - 1];
          var d1 = hav(pc, pd) + (pa ? hav(pa, pb) : 0);
          var d2 = hav(pb, pd) + (pa ? hav(pa, pc) : 0);
          if (d2 + 0.5 < d1) {
            ordered = ordered.slice(0, i2).concat(ordered.slice(i2, k2 + 1).reverse(), ordered.slice(k2 + 1));
            improved = true;
          }
        }
      }
    }
    return ordered;
  }
  /* 把已排序的站切分到天。一条代码路径同时服务三种入口：
     - targetDays>0：天数是软约束（每站 ≤ ceil(n/targetDays) 站），长途照样另起转场日；
     - targetDays=0：按里程/时长预算贪心切分；
     - forcedStart：AI 精选路线给定的"必须在这里换天"的站点下标集合。
     断日不再前置"当日已有站点"以外的条件——超过 DRIVE_H 的段已在 legsOf 里预拆成
     独立转场日，所以当日首站那段路不再无处可拆（旧模型正是被
     `if (cur.stops.length >= 2 && …)` 挡死，1800 km 段整段压进景点当天 = 27 小时的一天）。 */
  function splitIntoDays(ordered, start, targetDays, end, leg, forcedStart) {
    var MAX_KM = 260, MAX_H = 12, MAX_STOPS = 6;
    leg = leg || mkLeg(null);
    var maxStops = targetDays && targetDays > 0
      ? Math.max(1, Math.min(MAX_STOPS, Math.ceil(ordered.length / targetDays)))
      : MAX_STOPS;
    var days = [], day = null;
    function mkDay() { return { stops: [], driveKm: 0, driveH: 0, playH: 0, endKm: 0 }; }
    function newDay() { day = mkDay(); days.push(day); return day; }
    /* 转场日：只赶路、不塞景点，日卡不给导航按钮 */
    function transit(p, from, to, arrive) {
      day = { stops: [], driveKm: p.km, driveH: p.h, playH: 0, endKm: arrive ? p.km : 0, transit: 1, from: from && from.name, to: to && to.name,
        tla: to && to.lat != null ? to.lat : null, tlo: to && to.lng != null ? to.lng : null };   /* 赶路日也要天气：这段路最怕的就是雨 */
      days.push(day);
      return day;
    }
    /* 一段路的头几部分各自成转场日，返回留给到站当天的末部分 */
    function headLegs(parts, from, to) {
      for (var i = 0; i + 1 < parts.length; i++) transit(parts[i], from, to);
      if (parts.length > 1) day = null;
      return parts[parts.length - 1];
    }
    var prev = start && start.lat != null ? start : null;
    ordered.forEach(function (s, i) {
      var legK = prev ? headLegs(legsOf(leg, prev, s), prev, s) : { km: 0, h: 0 };
      var ph = playH(s);
      if (!day) newDay();
      var tStops = day.stops.length + 1;
      var tKm = day.driveKm + legK.km;
      var tH = day.driveH + legK.h + day.playH + ph + (tStops - 1) * 0.5 + 2.5;
      var forced = forcedStart && forcedStart[i] && day.stops.length;
      if (forced || (day.stops.length && (tStops > maxStops || tKm > MAX_KM || tH > MAX_H))) newDay();
      day.stops.push(s);
      day.driveKm += legK.km; day.driveH += legK.h; day.playH += ph;
      prev = s;
    });
    /* 环线/终到地的返程：撑得下就折进最后一日，撑不下单独成抵达日 */
    if (prev && end && end.lat != null) {
      var r = headLegs(legsOf(leg, prev, end), prev, end);
      var ld = days[days.length - 1];
      var base = ld ? ld.driveH + ld.playH + (ld.stops.length ? (ld.stops.length - 1) * 0.5 : 0) + 2.5 : DAY_CAP_H + 1;
      if (ld && ld.stops.length && base + r.h <= DAY_CAP_H) { ld.endKm = r.km; ld.driveKm += r.km; ld.driveH += r.h; }
      else transit(r, prev, end, true);
    }
    days.forEach(function (dd) {
      dd.totalH = dd.driveH + dd.playH + (dd.stops.length ? (dd.stops.length - 1) * 0.5 : 0) + 2.5;
    });
    return days;
  }
  /* ---------- 季节校验 ---------- */
  function seasonWarn(best, startDate) {
    if (!best) return null;
    var m = startDate ? parseInt(startDate.slice(5, 7), 10) : 0;
    var winter = m >= 11 || m <= 2;
    if (winter && /封路|关闭|不开放|封山|管制|报备|边防证/.test(best)) return '此季可能封路/需边防证，出行前请确认';
    return null;
  }

  /* ---------- 叙事 ---------- */
  function templateNarrative(days) {
    /* 只从有景点的天取首末站：转场日 stops 为空，旧写法 days[0].stops[0].name 遇到它必崩 */
    var play = days.filter(function (d) { return d.stops.length; });
    if (!play.length) return { story: '', dayThemes: [] };
    var first = play[0].stops[0].name;
    var lastD = play[play.length - 1], last = lastD.stops[lastD.stops.length - 1].name;
    var trans = days.length - play.length;
    return {
      story: '从' + first + '出发，一路走到' + last + '，' + days.length + '天的旅程' + (trans ? '（含 ' + trans + ' 个长途转场日）' : '') + '。',
      dayThemes: days.map(function (d, i) { return d.stops.length ? '第' + (i + 1) + '天' : '赶路日'; })
    };
  }
  function narrate(days, cb) {
    if (getAILevel() === 'off' || !window.Ai.hasKey()) { cb(templateNarrative(days)); return; }
    var lines = days.map(function (d, i) { return 'Day' + (i + 1) + ': ' + (d.stops.length ? d.stops.map(function (s) { return s.name; }).join(' → ') : '（长途转场赶路日）'); });
    var prompt = '你是中文旅行作家。根据真实行程输出 JSON：{"story":"一句 50 字以内行程故事","dayThemes":["每天一个 6 字内主题"]}。只输出 JSON。\n' + lines.join('\n');
    window.Ai.chat([{ role: 'user', content: prompt }]).then(function (txt) {
      var j = null; try { j = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) {}
      if (!j || !j.story) j = templateNarrative(days);
      cb(j);
    }).catch(function () { cb(templateNarrative(days)); });
  }
  function aiParseIntent(text, cb) {
    if (getAILevel() !== 'full' || !window.Ai.hasKey()) return;
    buildDicts();
    var regionNames = Object.keys(regionSet).join('、');
    window.Ai.chat([{ role: 'user', content: '从这句话提取旅行目的地省份和天数。省份必须从下列词表原样选取：' + regionNames + '。输出 JSON：{"regions":["省名"],"days":数字}。只输出 JSON。句子：' + text }]).then(function (txt) {
      var j = null; try { j = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) {}
      if (!j || !j.regions || !j.regions.length) { if (cb) cb(null); return; }
      var regs = [];
      j.regions.forEach(function (r) { var m = resolveRegionName(r); if (m && regs.indexOf(m) < 0) regs.push(m); });
      if (cb) cb(regs.length ? { regions: regs, days: j.days || 0 } : null);
    }).catch(function () { if (cb) cb(null); });
  }
  function aiEnhance(text, cb) {
    if (getAILevel() !== 'full' || !window.Ai.hasKey()) return;
    window.Ai.chat([{ role: 'user', content: '从这句话提取旅行意图，输出 JSON：{"pace":"舒缓/紧凑/一般","companions":"同伴(如带老人/亲子/独自/无)","vibe":"一句话补充"}。只输出 JSON。句子：' + text }]).then(function (txt) {
      var j = null; try { j = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) {}
      if (j && cb) cb(j);
    }).catch(function () {});
  }

  /* ---------- AI 精选路线：目的地+天数+方式+偏好 → 5 条备选 → 选用后复用排期编辑 ---------- */
  var arData = null; // {dest,days,trans,pref,regions,routes:[{name,why,days:[[景点名]]}]}
  function arFlagged(s, pref) {
    var f = s.flag || '';
    if (pref === '必去') return f.indexOf('m') >= 0;
    if (pref === '网红') return f.indexOf('h') >= 0;
    return true;
  }
  function arGrounding(regions, pref) {
    buildDicts();
    function rank(s) { var f = s.flag || ''; return (f.indexOf('m') >= 0 ? 2 : 0) + (f.indexOf('h') >= 0 ? 1 : 0); }
    var byRank = function (a, b) { return rank(b) - rank(a); };
    var base = regions.length ? parseIndex().filter(function (s) { return regions.indexOf(s.region) >= 0; }) : parseIndex();
    var hit = base.filter(function (s) { return arFlagged(s, pref); }).sort(byRank);
    if (hit.length < 8) hit = base.slice().sort(byRank); /* 省内该偏好太少：放宽为全省热门，防无米下锅 */
    return hit.slice(0, 70).map(function (s) { return s.name + '（' + (s.city || s.region) + '）'; }).join('、');
  }
  function aiPlanRoutes(dest, days, trans, pref, cb) {
    var grounding = arGrounding(arData_regions(dest), pref);
    var profile = prefSummary();
    var prompt = '你是资深旅行规划师，熟悉全网热门旅行攻略与游记。请参考这些热门行程，为「' + dest + '」设计 5 条互相不重复的 ' + days + ' 天' + trans + '线路，景点偏好：' + pref + '。'
      + (grounding ? '景点请优先从以下真实景点中选择：' + grounding + '。' : '')
      + (profile ? '用户画像：' + profile + '。5 条线路里至少一条贴合这些口味，但不要因为画像而推荐「' + dest + '」之外的景点。' : '')
      + '要求：1) 每天 2~4 个顺路景点，按地理顺序排，避免当天来回折返；2) 景点必须真实存在于「' + dest + '」，禁止编造；3) 5 条线路主题各异（如经典环线、小众深度、亲子休闲等）。'
      + '输出 JSON：{"routes":[{"name":"线路主题名(10字内)","why":"一句话亮点(20字内)","days":[["景点A","景点B"],["景点C"]]}]}，days 数组长度必须等于 ' + days + '。只输出 JSON。';
    window.Ai.chat([{ role: 'user', content: prompt }]).then(function (txt) {
      var j = null; try { j = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) {}
      var routes = (j && j.routes ? j.routes : []).filter(function (r) { return r && r.name && r.days && r.days.length; }).slice(0, 5);
      cb(routes.length ? routes : null);
    }).catch(function () { cb(null); });
  }
  function arData_regions(dest) { return matchRegions(dest || ''); }
  /* 景点名 → 带坐标节点：本地索引精确/模糊匹配，未命中走高德 POI 兜底 */
  function arResolve(name, regions, cb) {
    buildDicts();
    var bare = String(name || '').replace(/[（(].*?[）)]/g, '').trim();
    if (!bare) { cb(null); return; }
    var idx = parseIndex();
    function find(arr) {
      var i;
      for (i = 0; i < arr.length; i++) if (arr[i].name === bare) return arr[i];
      for (i = 0; i < arr.length; i++) if (arr[i].name.indexOf(bare) >= 0 || bare.indexOf(arr[i].name) >= 0) return arr[i];
      return null;
    }
    var hit = (regions.length ? find(idx.filter(function (s) { return regions.indexOf(s.region) >= 0; })) : null) || find(idx);
    if (hit) { cb(hit); return; }
    amapPoi(bare, regions[0] || '', function (pois) {
      cb(pois && pois.length ? { name: bare, label: bare, region: regions[0] || '', city: '', county: '', theme: '其他', flag: '', lat: pois[0].lat, lng: pois[0].lng, gcj: true, __poi: true } : null);
    });
  }
  /* AI 精选路线的分日：保留 AI 给的"哪天去哪几个点"的分组，但里程/耗时/超载切分
     走同一个 splitIntoDays——分组是意图，尺子是事实，两者不再各算一遍。
     分组边界记成 forcedStart（扁平序列下标），超长段照样另起转场日。 */
  function buildAiDays(dayLists, start, leg) {
    var flat = [], forced = {};
    dayLists.forEach(function (l) {
      if (!l || !l.length) return;
      forced[flat.length] = 1;
      l.forEach(function (s) { flat.push(s); });
    });
    return splitIntoDays(flat, start, 0, null, leg, forced);
  }
  function renderAiRoutes() {
    var box = $id('aiRouteOut');
    if (!arData) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = arData.routes.map(function (r, i) {
      var lines = r.days.map(function (stops, di) {
        return '<div class="dayline"><b>D' + (di + 1) + '</b>' + esc((stops || []).join(' → ')) + '</div>';
      }).join('');
      return '<div class="card aroute"><div class="sec-title">' + esc(r.name) + '</div>'
        + (r.why ? '<div class="why">' + esc(r.why) + '</div>' : '')
        + lines
        + '<button class="btn primary" style="width:100%;margin-top:12px" onclick="window.plannerUseAiRoute(' + i + ')">选用此路线</button></div>';
    }).join('')
      + '<div style="font-size:var(--fs-2);color:var(--color-muted);line-height:1.7;margin:2px 2px 10px">共 ' + arData.routes.length + ' 条 · 选一条进入排期，之后可随时增减景点或换一条重新生成。</div>'
      + '<button class="btn ghost" style="width:100%" onclick="window.plannerAiRoutesAgain()">↻ 换一批路线</button>';
  }
  window.plannerAiRoutesAgain = function () {
    var b = $id('arBtn'); if (b && !b.disabled && arData) b.click();
  };
  window.plannerUseAiRoute = function (i) {
    var r = arData && arData.routes[i]; if (!r) return;
    var out = $id('aiRouteOut');
    out.innerHTML = '<div class="card" style="text-align:center;color:var(--color-muted);font-size:var(--fs-4);padding:22px">⏳ 正在匹配景点坐标…</div>';
    var slots = [];
    r.days.forEach(function (d, di) { (d || []).forEach(function (nm) { slots.push({ name: nm, day: di, node: null }); }); });
    var pos = 0;
    function step() {
      if (pos >= slots.length) { done(); return; }
      var sl = slots[pos++];
      arResolve(sl.name, arData.regions, function (node) { sl.node = node; setTimeout(step, 0); });
    }
    function done() {
      var miss = 0, seen = {};
      var dayLists = r.days.map(function () { return []; });
      slots.forEach(function (sl) {
        if (!sl.node) { miss++; return; }
        var u = nodeUid(sl.node);
        if (seen[u]) return;
        seen[u] = 1;
        dayLists[Math.min(sl.day, dayLists.length - 1)].push(sl.node);
      });
      var flatAll = [].concat.apply([], dayLists);
      if (flatAll.length < 2) {
        out.innerHTML = '';
        toast('这条路线的景点没能匹配到位置，换一条试试' + (getAmapKey() ? '' : '（配置高德 Key 可兜底定位）'));
        return;
      }
      state.regions = arData.regions.slice();
      state.days = dayLists.length;
      state.prefs = []; state.autoPrefs = []; state.fromWish = false;
      /* 出发日期不跟着一起清：它是「我哪天走」，与选哪条 AI 路线无关。
         以前这里连 startDate 一起抹平，后果是 AI 路线出来的行程永远没有日期——
         日卡天气、季节提醒、导出日历三样同时失效（批次 16 实测）。 */
      state.selected = flatAll.slice();
      state.amapSorted = true; /* 尊重 AI/后续手动顺序：重排期不再打乱 */
      state.candidates = flatAll.slice();
      /* AI 给的是「哪天去哪几个点」的分组意图，里程尺子仍走真实矩阵：
         否则分组按 AI、日卡按直线，同一行程两本账。 */
      var tripName = (arData.dest || '') + ' · ' + r.name + ' ' + dayLists.length + ' 日' + arData.trans + '之旅';
      var commitAi = function (matrix) {
        state.trip = { id: 'p' + Date.now(), name: tripName, createdAt: Date.now(), start: state.start, end: state.end, startDate: state.startDate, aiLevel: getAILevel(), days: buildAiDays(dayLists, state.start, mkLeg(matrix)), dist: matrix || null, narrative: null };
        renderAiRoutes(); /* 返回输入页时备选卡仍在，可直接换一条 */
        showStage('stageResult'); renderResult();
        if (miss) toast('已跳过 ' + miss + ' 处无法定位的景点');
      };
      if (!getAmapKey() || flatAll.length > AMAP_MAX_STOPS) { commitAi(null); return; }
      out.innerHTML = '<div class="card" style="text-align:center;color:var(--color-muted);font-size:var(--fs-4);padding:22px">正在取真实道路里程…</div>';
      fetchDistMatrix(flatAll, function (dist, failed) {
        if (failed) toast(amapCoverageText(Object.keys(dist).length, Object.keys(dist).length + failed));
        commitAi(dist);
      });
    }
    step();
  };

  /* ========================================================= */
  /*  渲染                                                       */
  /* ========================================================= */
  var curStage = 'stageInput';
  function showStage(name) {
    curStage = name;
    /* P2-7 转场：阶段切换走 View Transition（老内核、减动效、file:// 下 UI.vt 直接执行，与改前同行为） */
    UI.vt(function () {
      ['stageInput', 'stagePick', 'stageResult'].forEach(function (n) { $id(n).style.display = n === name ? 'block' : 'none'; });
      /* 批次18 双栏：只有结果页有左右两栏，body 类是 design.css 那条媒体查询里的作用域开关 */
      document.body.classList.toggle('dv-result', name === 'stageResult');
      window.scrollTo(0, 0);
    });
    persistState();
  }
  /* 顶栏返回：结果页/选点页回到规划首页，首页返回浏览器历史 */
  window.plannerBack = function () {
    if (curStage === 'stageResult' || curStage === 'stagePick') showStage('stageInput');
    else if (history.length > 1) history.back();
    else location.href = 'index.html';
  };

  /* 阶段一：输入 */
  function renderDestChips() {
    buildDicts();
    var top = Object.keys(regionSet).map(function (r) { var c = 0; parseIndex().forEach(function (s) { if (s.region === r) c++; }); return { r: r, c: c }; })
      .sort(function (a, b) { return b.c - a.c; }).slice(0, 10);
    $id('destChips').innerHTML = top.map(function (x) { return '<span class="chip" onclick="window.plannerPickRegion(\'' + esc(x.r) + '\')">' + esc(x.r) + ' <span style="opacity:.6">' + x.c + '</span></span>'; }).join('');
    var wl = window.Wish.list().filter(function (x) { return !x.visited && x.lat != null; });
    $id('seedWishSub').textContent = wl.length ? ('已收藏 ' + wl.length + ' 处，一键串起来') : '先去地图收藏几处想去的地方';
  }
  window.plannerPickRegion = function (r) {
    state.regions = r ? [r] : []; state.prefs = []; state.autoPrefs = []; state.days = state.days || 0; state.fromWish = false; state.amapSorted = false; state.wishPool = null;
    renderIntent(); doRecall(); showStage('stagePick');
    if (r) { provSel = r; renderProvThemes(); } /* 联动展开该省主题 */
  };

  /* ---------- 偏好增强：省主题 + 我的节点（2026-08-15） ---------- */
  var provSel = '';
  function provThemes(prov) {
    var cnt = {};
    parseIndex().forEach(function (x) { if (x.region === prov) { var t = normTheme(x.theme); if (t) cnt[t] = (cnt[t] || 0) + 1; } });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 12);
  }
  /* 纯渲染（按当前 provSel） */
  function renderProvThemes() {
    var box = $id('intentProvThemes');
    if (!box) return;
    if (!provSel) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var ts = provThemes(provSel);
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:var(--fs-2);color:var(--color-muted);margin-bottom:4px">' + esc(provSel) + ' 的主题（多选，下方景点实时联动）</div>' +
      (ts.length ? ts.map(function (t) { return '<span class="chip' + (state.prefs.indexOf(t) >= 0 ? ' on' : '') + '" onclick="window.plannerToggleCustomPref(\'' + esc(t) + '\')">' + esc(t) + '</span>'; }).join('') : '<span style="font-size:var(--fs-3);color:var(--color-muted)">该省暂无主题数据</span>');
  }
  /* 点省：toggle 展开/收起 */
  window.plannerPickProv = function (prov) {
    provSel = (provSel === prov ? '' : prov);
    renderProvThemes();
  };
  window.plannerToggleCustomPref = function (t) {
    if (state.prefs.length === 1 && state.prefs[0] === t) state.prefs = []; else state.prefs = [t];
    state.autoPrefs = []; state.amapSorted = false;
    renderIntent();
    renderProvThemes();
    doRecall();
  };
  /* 【我的】节点：加入候选 */
  window.plannerAddMine = function () {
    var nodes = [];
    try { nodes = JSON.parse(localStorage.getItem('tn_userNodes') || '[]'); } catch (e) {}
    if (!nodes.length) { toast('还没有自己添加的节点，可到「节点管理」添加'); return; }
    var before = state.candidates.length;
    nodes.forEach(function (u) {
      if (u.lat == null) return;
      var k = (+u.lat).toFixed(3) + ',' + (+u.lng).toFixed(3);
      var nm = (u.name || '').trim();
      var near = function (c) {
        if (c.lat == null) return false;
        if ((+c.lat).toFixed(3) + ',' + (+c.lng).toFixed(3) === k) return true;
        /* 同名且距离 <~5km（GCJ 偏移）也算重复，如「鹳雀楼」库内已有则不再加我的节点 */
        return nm && (c.name || c.label) === nm && Math.abs(c.lat - u.lat) < 0.05 && Math.abs(c.lng - u.lng) < 0.05;
      };
      var dup = state.candidates.some(near) || (!nm ? false : parseIndex().some(function (s) { return near(s); }));
      if (!dup) state.candidates.push({ name: u.name, label: u.name, region: u.province || '其他', city: u.city || '', county: '', theme: u.category || '其他', flag: '', lat: +u.lat, lng: +u.lng, gcj: !!u.gcj, __mine: true });
    });
    renderCandidates();
    toast('已加入 ' + (state.candidates.length - before) + ' 个我的节点');
  };

  /* 阶段二：意图卡 + 候选 */
  function renderIntent() {
    buildDicts();
    var h = '';
    h += '<div class="fld"><label>目的地（可增删，留空=不限）</label><div class="chips" id="intentRegions"></div></div>';
    h += '<div class="fld"><label>天数</label><div class="row"><input type="number" id="intentDays" min="1" max="30" value="' + (state.days || 5) + '"> <button class="btn ghost" onclick="window.plannerPickRegion(\'\')">不限目的地</button></div></div>';
    h += '<div id="intentProvThemes" style="display:none;margin-top:6px"></div>';
    h += '<div class="chips" style="margin-top:4px"><span class="chip mine" onclick="window.plannerAddMine()">'+TI('pin')+'我的节点</span></div>';


    h += '<div class="fld"><label>出发日期（用于季节提醒，可空）</label><input type="date" id="intentDate" value="' + esc(state.startDate || '') + '"></div>';
    h += '<div id="aiEnhBar"></div>';
    $id('intentCard').innerHTML = '<div class="sec-title" style="display:flex;align-items:center;justify-content:space-between">这趟怎么玩<span style="font-size:var(--fs-3);font-weight:400"><a href="javascript:window.plannerBack()" style="color:var(--color-primary-dark);text-decoration:none">← 修改目的地</a></span></div>' + h;
    /* 目的地 chips */
    var all = Object.keys(regionSet || {});
    var rc = all.map(function (r) { return '<span class="chip' + (state.regions.indexOf(r) >= 0 ? ' on' : '') + '" onclick="window.plannerToggleRegion(\'' + esc(r) + '\')">' + esc(r) + '</span>'; }).join('');
    $id('intentRegions').innerHTML = rc;

    /* 绑定 */
    $id('intentDays').onchange = function () { state.days = parseInt(this.value, 10) || 0; };
    $id('intentDate').onchange = function () { state.startDate = this.value; };
    /* 目的地/偏好变化后重召回 */
    state.__bound = true;
  }
  window.plannerToggleRegion = function (r) {
    if (state.regions.length === 1 && state.regions[0] === r) state.regions = []; else state.regions = [r];
    state.amapSorted = false;
    renderIntent(); doRecall();
    window.plannerPickProv(r); /* 联动：重建后展开该省主题（再点收起） */
  };
  window.plannerTogglePref = function (p) {
    var i = state.prefs.indexOf(p);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(p);
    renderIntent(); doRecall();
  };
  function matchStart(name) {
    if (!name) return null;
    buildDicts();
    var c = cityCoord[name] || cityCoord[name + '市'] || cityCoord[name + '州'];
    if (c) return { name: name, lat: c.lat, lng: c.lng };
    /* 找不到坐标时保留名称（仅标注，不参与导航里程） */
    return { name: name, lat: null, lng: null };
  }
  function resolveRegionName(name) {
    if (!name) return null;
    buildDicts();
    if (regionSet[name]) return name;
    var b = String(name).replace(/省$/, '').replace(/市$/, '').replace(/壮族自治区$/, '').replace(/回族自治区$/, '').replace(/维吾尔自治区$/, '').replace(/自治区$/, '').replace(/特别行政区$/, '');
    return regionSet[b] ? b : null;
  }
  function doRecall() {
    var intent = { regions: state.regions, days: state.days, prefs: state.prefs.length ? state.prefs : (state.autoPrefs || []) };
    state.widenMsg = null;
    if (state.fromWish) {
      var wpool = state.wishPool || state.candidates;
      state.wishPool = wpool;
      if (intent.regions.length || intent.prefs.length) {
        state.candidates = wpool.filter(function (x) {
          if (intent.regions.length && intent.regions.indexOf(x.region) < 0) return false;
          if (intent.prefs.length && !intent.prefs.some(function (p) { return prefHit(p, x.theme) || normTheme(p) === normTheme(x.theme); })) return false;
          return true;
        });
      } else state.candidates = wpool.slice();
    } else state.candidates = recall(intent);
    renderCandidates();
    maybeAmapSupplement(intent);
  }
  function renderCandidates() {
    /* 候选少且未配置高德 Key：提示可补位 */
    try {
      if (state.candidates.length < 8 && !localStorage.getItem('tn_amap_key')) {
        var hb = document.getElementById('candHint');
        if (hb) hb.style.display = 'block';
      }
    } catch (e) {}
    var c = state.candidates;
    renderSumm();
    var card = $id('candCard'), bar = $id('summbar');
    if (!c.length) { card.style.display = 'none'; bar.style.display = 'none'; return; }
    card.style.display = 'block';
    var q = (state.candFilter || '').trim().toLowerCase();
    /* 清空筛选词时回收未选中的搜索并入项，防候选列表被历史检索残留污染 */
    if (!q && c.some(function (s) { return s.__searchAdd && !isSelected(s); })) {
      state.candidates = c = c.filter(function (s) { return !s.__searchAdd || isSelected(s); });
    }
    var candHit = function (s) { return (s.name + ' ' + s.theme + ' ' + s.city + ' ' + s.region + ' ' + (s.county || '')).toLowerCase().indexOf(q) >= 0; };
    var list = q ? c.filter(candHit) : c;
    /* 候选列表只是召回 Top-N：只要输入了就并入「所选目的地全库」命中，保证省内可完整检索；
       省内外都零命中时才放开全国兜底 */
    if (q) {
      var idx = parseIndex(), seenU = {};
      c.forEach(function (s) { seenU[nodeUid(s)] = 1; });
      var missHit = function (s) {
        if (seenU[nodeUid(s)] || !candHit(s)) return false;
        /* 与已有候选（如「我的节点」）同名同位置的不重复上屏 */
        return !c.some(function (x) {
          return x.name === s.name && Math.abs(x.lat - s.lat) < 0.05 && Math.abs(x.lng - s.lng) < 0.05;
        });
      };
      var base = state.regions.length ? idx.filter(function (s) { return state.regions.indexOf(s.region) >= 0; }) : idx;
      var extra = base.filter(missHit);
      if (!list.length && !extra.length && state.regions.length) {
        var inExtra = {};
        extra.forEach(function (s) { inExtra[nodeUid(s)] = 1; });
        extra = extra.concat(idx.filter(function (s) { return !inExtra[nodeUid(s)] && missHit(s); }).slice(0, 200));
      }
      if (extra.length) {
        extra.forEach(function (s) { s.__searchAdd = true; });
        state.candidates = c = c.concat(extra);
        list = c.filter(candHit);
      }
    }
    var cond = [];
    if (state.regions.length) cond.push(state.regions.join('/'));
    if (state.prefs.length) cond.push(state.prefs.join('·'));
    var condTxt = cond.length ? ' · ' + cond.join(' · ') : '';
    $id('candTitle').textContent = '候选景点' + condTxt + ' · ' + (q ? list.length + ' / ' + c.length : c.length) + ' 处';
    var hint = $id('candHint');
    if (hint) { if (state.widenMsg) { hint.style.display = 'block'; hint.innerHTML = TI('info') + state.widenMsg; } else hint.style.display = 'none'; }
    $id('candList').innerHTML = list.map(function (s) {
      var on = isSelected(s);
      return '<div class="cand" onclick="window.plannerToggleCand(\'' + esc(nodeUid(s)) + '\')">' +
        '<span class="ckbox' + (on ? ' on' : '') + '">' + (on ? TI('check', 11) : '') + '</span>' +
        '<span class="dot" style="background:' + themeColor(s.theme) + '"></span>' +
        '<span class="main"><b>' + esc(s.name) + (s.flag && s.flag.indexOf('m') >= 0 ? '<span class="bdg bdg-m">必去</span>' : '') + (s.flag && s.flag.indexOf('h') >= 0 ? '<span class="bdg bdg-h">网红</span>' : '') + (s.__novelty ? '<span class="bdg bdg-n">' + TI('sparkles', 12) + '换个不一样的</span>' : '') + (s.__poi ? '<span class="bdg bdg-t">临时</span>' : '') + '</b>' +
        '<small>' + esc([s.region, s.city].filter(Boolean).join(' · ')) + (s.theme ? ' · ' + esc(s.theme) : '') + '</small></span></div>';
    }).join('');
    renderSumm();
  }
  window.plannerToggleCand = function (uid) {
    var hit = state.selected.filter(function (x) { return nodeUid(x) === uid; });
    if (hit.length) state.selected = state.selected.filter(function (x) { return nodeUid(x) !== uid; });
    else { var s = state.candidates.filter(function (x) { return nodeUid(x) === uid; })[0]; if (s) state.selected.push(s); }
    state.amapSorted = false;
    renderCandidates();
    persistState();
  };
  /* 预计天数与排期同源：同一套排序 + 同一个 splitIntoDays（纯本地，绝不为估算打网络）。
     此前是独立的 ceil(站数/6)，长途转场日一个都没算进去，选点页写「预计 5 天」实际排出 8 天。 */
  function estimateDays() {
    var sel = state.selected;
    if (!sel.length) return 0;
    var matrix = state.matrix && state.matrix.sig === picksSig(sel) ? state.matrix.dist : null;
    var ordered = state.amapSorted ? sel.slice() : (matrix ? orderByMatrix(sel, state.start, matrix) : orderStops(sel, state.start));
    return splitIntoDays(ordered, state.start, state.days, state.end, mkLeg(matrix)).length;
  }
  function renderSumm() {
    var bar = $id('summbar');
    if (!state.selected.length) { bar.style.display = 'none'; $id('summInfo').innerHTML = ''; return; }
    bar.style.display = 'flex';
    $id('summInfo').innerHTML = '已选 <b>' + state.selected.length + '</b> 站 · 预计 <b>' + estimateDays() + '</b> 天';
  }

  /* 阶段三：结果 */
  /* 一把尺子的可见性：日卡里程到底是真实道路还是直线折算，必须在页面上说清 */
  function rulerNote(trip) {
    return trip.dist && Object.keys(trip.dist).length
      ? '日卡里程为高德真实道路里程'
      : '日卡里程按直线 ×1.35 折算（未取真实道路数据）';
  }

  /* ---------- 逐日天气（Open-Meteo，免费无 Key、CORS 开放） ----------
     只做三件事：按「坐标 + 日期」取一次、缓存 6 小时、拿不到就什么都不显示。
     没有出发日期 / 缺坐标 / 超出预报期 / 断网 / 被限流后仍失败 —— 一律不出天气元素，
     宁可少一项信息，也不给日卡留一个空位或一句「加载失败」。 */
  var WX_TTL = 6 * 3600 * 1000;   /* 预报一天更新几轮，6h 内的数不会翻脸 */
  var WX_HORIZON = 15;            /* 接口只给到 T+16，第 16 天起没有数据 */
  var WX_HOST = 'https://api.open-meteo.com/v1/forecast';
  /* 码 → [icons.js 字形, 中文]。中文与 travel-notes.js 的 WMO 表逐码对账（verify §18），
     两边不一致就是同一个码在两处说两种话。字形走 SVG，不引 emoji。 */
  var WMO_G = {
    0: ['sun', '晴'], 1: ['cloudsun', '晴间多云'], 2: ['cloudsun', '多云'], 3: ['cloud', '阴'],
    45: ['cloud', '雾'], 48: ['cloud', '雾凇'],
    51: ['cloud', '毛毛雨'], 53: ['cloud', '毛毛雨'], 55: ['cloud', '毛毛雨'],
    61: ['rain', '小雨'], 63: ['rain', '中雨'], 65: ['rain', '大雨'],
    71: ['snow', '小雪'], 73: ['snow', '中雪'], 75: ['snow', '大雪'], 77: ['snow', '雪粒'],
    80: ['rain', '阵雨'], 81: ['rain', '阵雨'], 82: ['bolt', '强阵雨'],
    85: ['snow', '阵雪'], 86: ['snow', '强阵雪'],
    95: ['bolt', '雷暴'], 96: ['bolt', '雷暴冰雹'], 99: ['bolt', '强雷暴']
  };
  function weatherOn() { try { return localStorage.getItem('tn_planner_weather') !== '0'; } catch (e) { return true; } }
  function dayDate(trip, di) {
    var sd = trip && trip.startDate;
    if (!sd || !/^\d{4}-\d{2}-\d{2}$/.test(sd)) return '';
    var d = new Date(sd + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + di);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function wxCoord(d) {
    if (!d) return null;
    var s = (d.stops || [])[0];
    if (s && s.lat != null && s.lng != null) return { lat: s.lat, lng: s.lng };
    if (d.transit && d.tla != null && d.tlo != null) return { lat: d.tla, lng: d.tlo };
    return null;
  }
  /* 键前缀落在 tn_weather_ 里：与 topic-common 的实时天气缓存同族（都可再生、都不进备份），
     但键尾带日期，两者永不同时命中同一条。 */
  function wxKeyOf(lat, lng, date) { return 'tn_weather_d_' + lat.toFixed(2) + '_' + lng.toFixed(2) + '_' + date; }
  function wxGet(k) {
    try { var c = JSON.parse(localStorage.getItem(k) || 'null'); return c && Date.now() - c.ts < WX_TTL ? c.d : null; } catch (e) { return null; }
  }
  function wxPut(k, d) { try { localStorage.setItem(k, JSON.stringify({ ts: Date.now(), d: d })); rememberCacheKey(k); } catch (e) {} }
  /* 日界按本地日历数，别用 UTC 相减——那会让今天出发的一天被判成昨天而整趟不出天气 */
  function wxInWindow(date) {
    if (!date) return false;
    var t = new Date(), target = new Date(date + 'T00:00:00');
    if (isNaN(target.getTime())) return false;
    var days = Math.round((target - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
    return days >= 0 && days <= WX_HORIZON;
  }
  function wxUrl(co, date) {
    return WX_HOST + '?latitude=' + co.lat.toFixed(4) + '&longitude=' + co.lng.toFixed(4) +
      '&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=' + date + '&end_date=' + date;
  }
  function wxParse(j) {
    var d = j && j.daily;
    if (!d) return null;
    var codes = d.weathercode || d.weather_code;
    if (!codes || !codes.length) return null;
    var mx = d.temperature_2m_max, mn = d.temperature_2m_min;
    return { code: codes[0], tmax: mx && mx.length ? mx[0] : null, tmin: mn && mn.length ? mn[0] : null };
  }
  function wxCell(w) {
    if (!w) return '';
    var g = WMO_G[w.code];
    if (!g) return '';   /* 没登记过的码不显示，也不摆「天气码 50」 */
    var lo = w.tmin == null ? null : Math.round(w.tmin), hi = w.tmax == null ? null : Math.round(w.tmax);
    var temp = lo != null && hi != null ? lo + '~' + hi + '°' : hi != null ? hi + '°' : lo != null ? lo + '°' : '';
    if (!temp) return '';
    return '<span class="wx" title="' + esc(g[1] + ' ' + temp) + '" aria-label="' + esc(g[1] + '，' + lo + ' 到 ' + hi + ' 度') + '">' + TI(g[0], 13) + temp + '</span>';
  }
  /* 渲染期能同步决定的一律当场写进 HTML（缓存命中=不闪）；只有真要发请求的才留 .wxh 空槽 */
  function wxSlot(trip, di) {
    if (!weatherOn()) return '';
    var d = (trip.days || [])[di], co = wxCoord(d), date = dayDate(trip, di);
    if (!co) return '';                 /* 没坐标就不问：这天的天气压根无从问起 */
    if (!wxInWindow(date)) return '';   /* 没有日期或超出预报期：不猜，也不摆「日期没填」 */
    var hit = wxGet(wxKeyOf(co.lat, co.lng, date));
    if (hit) return wxCell(hit);
    return '<span class="wxh" data-wx="' + di + '"></span>';
  }
  var wxSeq = 0;
  function wxHydrate(trip) {
    var seq = ++wxSeq;
    if (!trip || !weatherOn()) return;
    (trip.days || []).forEach(function (d, di) {
      var slot = document.querySelector('#resultBody .wxh[data-wx="' + di + '"]');
      if (!slot) return;   /* 缓存命中或这天天不在窗口内：没有槽要填 */
      var co = wxCoord(d), date = dayDate(trip, di);
      var k = wxKeyOf(co.lat, co.lng, date);
      wxRun(function (release) {
        wxRest(wxUrl(co, date), function (w) {
          release();
          if (!w) return;
          wxPut(k, w);
          if (seq !== wxSeq) return;   /* 期间又排了一次：这张卡已经不是我那张 */
          var live = document.querySelector('#resultBody .wxh[data-wx="' + di + '"]');
          if (live) live.outerHTML = wxCell(w);
        });
      });
    });
  }
  function renderDaysBody() {
    var trip = state.trip; if (!trip) return;
    var days = trip.days;
    var leg = mkLeg(trip.dist);
    var h = '<div style="font-size:var(--fs-3);color:var(--color-muted);margin-bottom:4px">' +
      rulerNote(trip) + '；按地理邻近自动分日，耗时含路程+游玩+休息+用餐（±2h 误差）；' + (trip.start && trip.start.name ? '出发地 ' + esc(trip.start.name) : '') + (trip.startDate ? ' · ' + esc(trip.startDate) : '') +
      (trip.startDate || !weatherOn() ? '' : '；填上出发日期，日卡会显示当天天气') + '</div>';
    days.forEach(function (d, di) {
      var over = d.totalH > 12;
      var seal = 'day-seal ds-' + (di % 6 + 1);
      if (d.transit) {
        /* 转场日：只赶路、不塞景点，没有起讫站点可导航，所以不挂导航按钮 */
        h += '<div class="day-card transit" data-day="' + di + '" onmouseenter="window.plannerHlDay(' + di + ')" onmouseleave="window.plannerHlDay(-1)"><div class="dhead"><span class="' + seal + '">D' + (di + 1) + '</span>' +
          '<span class="dmeta">赶路日 · 约 ' + Math.round(d.driveKm) + ' km · 车程 ' + d.driveH.toFixed(1) + 'h</span>' + wxSlot(trip, di) + '</div>' +
          '<div class="transit-route">' + esc(d.from || '出发地') + '<span>→</span>' + esc(d.to || '目的地') + '</div>' +
          '<div style="font-size:var(--fs-3);color:var(--color-muted);margin-top:8px;line-height:1.6">这段路超过单日驾驶上限，单独成一天；中途可在服务区/沿途城市休整。</div></div>';
        return;
      }
      var allDone = d.stops.length > 0 && d.stops.every(function (s) { return s.done; });
      h += '<div class="day-card" data-day="' + di + '" onmouseenter="window.plannerHlDay(' + di + ')" onmouseleave="window.plannerHlDay(-1)"><div class="dhead"><span class="' + seal + (allDone ? ' done' : '') + '">D' + (di + 1) + '</span>' +
        '<span class="dmeta">' + d.stops.length + ' 站 · 约 ' + Math.round(d.driveKm) + ' km · 游玩 ' + d.playH.toFixed(1) + 'h · 全程 ' + d.totalH.toFixed(1) + 'h</span>' + wxSlot(trip, di) +
        '<button class="btn" style="min-height:30px;padding:0 12px;font-size:var(--fs-3)" onclick="window.plannerNavDay(' + di + ')">'+TI('navigation')+'导航</button></div>';
      if (over) h += '<div class="warnline">' + TI('warn') + '该日预计 ' + d.totalH.toFixed(0) + ' 小时，偏赶，建议减 1~2 站</div>';
      d.stops.forEach(function (s, si) {
        var det = detailCache[s.name];
        var warn = seasonWarn(det && det.best, trip.startDate);
        var meta = [];
        if (det && det.best) meta.push('<span class="meta">适合 ' + esc(det.best) + '</span>');
        if (warn) meta.push('<span class="warn-ic" title="' + esc(warn) + '">' + TI('warn') + '</span>');
        meta.push('<span class="meta">游玩 ' + playH(s) + 'h</span>');
        var acts = '';
        if (state.travelMode) acts += '<button class="btn mini" onclick="window.plannerCheckinStop(' + di + ',' + si + ')">' + (s.done ? '已打卡' : '记一笔') + '</button>';
        acts += '<span class="ops">' +
          '<button class="mv" aria-label="上移" onclick="window.plannerMoveStop(' + di + ',' + si + ',-1)">↑</button>' +
          '<button class="mv" aria-label="下移" onclick="window.plannerMoveStop(' + di + ',' + si + ',1)">↓</button>' +
          '<button class="mv" aria-label="移除" onclick="window.plannerRemoveStop(' + di + ',' + si + ')">'+TI('close', 14)+'</button></span>';
        h += '<div class="stop' + (warn ? ' warn' : '') + (s.done ? ' done' : '') + '">' +
          '<div class="stop-name"><span class="n">' + (si + 1) + '</span><span class="lbl">' + (s.done ? TI('check') + ' ' : '') + esc(s.name) + '</span></div>' +
          '<div class="stop-meta">' + meta.join('') + '</div>' +
          '<div class="stop-acts">' + acts + '</div>' +
          '</div>';
      });
      h += '</div>'; /* 闭合 day-card（2026-08-15） */
    });
    /* 终到地行：有名称即显示（环线标注；里程与日卡同一把尺子，含真实矩阵） */
    if (trip.end && trip.end.name) {
      var lastDay = days[days.length - 1];
      var lastStop = lastDay && lastDay.stops && lastDay.stops.length ? lastDay.stops[lastDay.stops.length - 1] : null;
      var endKm = lastStop ? leg(lastStop, trip.end).km : 0;
      h += '<div class="stop" style="padding:8px 10px;border-radius:10px;background:var(--color-primary-soft);border:1px solid var(--color-line-strong)">' +
        '<div class="stop-name"><span class="n" style="background:var(--color-primary);color:var(--bg)">终</span>' +
        '<span class="lbl">' + esc(trip.end.name) + (trip.end.isLoop ? '（回到起点 · 环线）' : '（抵达地）') + '</span></div>' +
        '<div class="stop-meta"><span class="meta">' + Math.round(endKm) + ' km</span></div></div>';
    }
    $id('resultBody').innerHTML = h;
    wxHydrate(trip);   /* 缓存没命中的日子在这一步发请求；拿不到就永远不出现 .wx */
    renderPretrip();
  }
  /* ---------- 出发前卡（行前清单在结果页的入口） ----------
     auto 条目要站点事实（elev/best）才推得出来，而分省详情是懒加载的：renderDaysBody 会在
     每个省份到货后重跑一次，所以 syncAuto 挂在那条线上——首屏只有通识四件，到货后自己长全。
     预览行不给 .ckbox 复选框（点了没反应的热区比没有更糟），要勾就进 checklist.html。 */
  function pretripInput() {
    var trip = state.trip; if (!trip) return null;
    var details = {};
    flatStops().forEach(function (s) { if (detailCache[s.name]) details[s.name] = detailCache[s.name]; });
    return { stops: flatStops(), details: details, startDate: trip.startDate || '', days: trip.days.length };
  }
  /* 分省详情是否都到货了：到货前只许生长、不许剪枝（见 checklist.js syncAuto 的 prune）。
     没有对应数据文件的地方（自建点、港澳台之外的别名）视作「本来就没事实」，不算未到货。 */
  function factsSettled() {
    var ok = true;
    flatStops().forEach(function (s) {
      var f = PROV_FILE[s.region];
      if (f && provLoading[f] !== 2) ok = false;
    });
    return ok;
  }
  function renderPretrip() {
    var box = $id('pretripCard');
    var trip = state.trip;
    if (!box || !trip || !window.Checklist) return;
    var tid = ensureTripId(trip);
    Checklist.syncAuto(tid, pretripInput(), factsSettled());
    var st = Checklist.statsOf(tid), todo = Checklist.listOf(tid).filter(function (x) { return !x.done; });
    $id('ptCount').textContent = st.total ? ('已打包 ' + st.done + ' / ' + st.total) : '还没生成';
    $id('ptBar').style.width = (st.total ? Math.round(st.done / st.total * 100) : 0) + '%';
    $id('ptList').innerHTML = todo.length
      ? todo.slice(0, 4).map(function (x) {
          return '<div class="cand"><span class="dot" style="background:var(--color-line-strong)"></span><span class="main"><b>' + esc(x.text) + '</b>' +
            (x.src ? '<small>' + esc(x.src) + '</small>' : '') + '</span></div>';
        }).join('')
      : '<div style="font-size:var(--fs-3);color:var(--color-muted);padding:2px 0">' + (st.total ? TI('check') + ' 该打包的都打好了' : '填上出发日期或让分省数据到货，建议会自动补齐') + '</div>';
    if (todo.length > 4) $id('ptList').innerHTML += '<div style="font-size:var(--fs-2);color:var(--color-muted);padding:2px 0">还有 ' + (todo.length - 4) + ' 条…</div>';
    box.style.display = 'block';
  }
  window.plannerOpenChecklist = function () {
    var trip = state.trip; if (!trip) return;
    writeSnap();   /* 未保存的行程靠 sessionStorage 快照把 id 带过去，回来还能接上同一桶清单 */
    location.href = 'checklist.html?trip=' + encodeURIComponent(ensureTripId(trip));
  };
  function renderNarrative(n) {
    $id('narrBox').innerHTML = '<div style="font-size:var(--fs-2);color:var(--color-muted);margin-bottom:6px">AI 行程故事</div>' +
      '<div class="story">' + esc(n.story) + '</div>' +
      (n.dayThemes && n.dayThemes.length ? '<div class="themes">' + n.dayThemes.map(function (t, i) { return 'D' + (i + 1) + ' · ' + esc(t); }).join('　') + '</div>' : '');
  }
  function renderResult() {
    var trip = state.trip; if (!trip) return;
    var days = trip.days;
    /* 终到地：有名称即设置（环线=与出发地同名），有坐标则参与里程 */
    if (state.end && state.end.name) { trip.end = state.end; trip.end.isLoop = !!(state.start && state.start.name && state.start.name === state.end.name); }
    $id('resultTitle').textContent = trip.name + ' · ' + days.length + ' 天 · ' + days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站';
    var totalKm = days.reduce(function (s, d) { return s + d.driveKm; }, 0);
    $id('resultTitle').textContent += ' · 约 ' + Math.round(totalKm) + ' km';
    renderDaysBody();
    /* 「导出日历」在没日期时是灰的，但必须仍可点：点下去那句 toast 才是教用户去哪补日期的路。
       真 disabled 会让 pointer-events 吃掉点击，按钮灰着却不说话，等于把人堵死。 */
    var icsOn = !!buildTripIcs(trip);
    $id('actRow').innerHTML =
      '<button class="btn" onclick="window.plannerStartTrip()">▶ 开始旅行</button>' +
      '<button class="btn" onclick="window.plannerSaveTrip()">'+TI('save')+'保存行程</button>' +
      '<button class="btn" onclick="window.plannerAddAllWish()">'+TI('star')+'加入想去清单</button>' +
      '<button class="btn" onclick="window.plannerCopyPlan()">'+TI('copy')+'复制计划</button>' +
      '<button class="btn" onclick="window.plannerShare()">'+TI('share')+'分享行程</button>' +
      '<button class="btn" onclick="window.plannerExportGPX()">导出 GPX</button>' +
      '<button class="btn' + (icsOn ? '' : ' ghost') + '"' + (icsOn ? '' : ' style="opacity:.55"') + ' onclick="window.plannerExportIcs()">' + (icsOn ? '导出日历' : '导出日历（要先在上方选出发日期）') + '</button>' +
      '<button class="btn" onclick="window.plannerBuildBook()">'+TI('book')+'导出路书</button>' +
      '<button class="btn" onclick="window.plannerBuildAlbum()">'+TI('gallery')+'生成纪念册</button>' +
      '<button class="btn" onclick="window.plannerReschedule()">↻ 重新排期</button>' +
      '<button class="btn ghost" onclick="window.plannerEditPick()">'+TI('edit')+'编辑选点</button>' +
      '<button class="btn ghost" onclick="window.plannerOpenFootprint()">'+TI('map')+'足迹地图</button>';
    renderMap();
    var nb = $id('narrBox');
    nb.style.display = 'block';
    if (trip.narrative && trip.narrative.story) {
      renderNarrative(trip.narrative);
    } else {
      nb.innerHTML = '<div style="font-size:var(--fs-2);color:var(--color-muted);margin-bottom:6px">' + (getAILevel() === 'off' ? 'AI 叙事（关）' : 'AI 叙事中…') + '</div>';
      narrate(days, function (n) { if (!n) return; trip.narrative = n; renderNarrative(n); });
    }
    /* 季节校验：懒加载分省详情后重渲染 stop 区（不打断叙事/地图） */
    var need = {};
    days.forEach(function (d) { d.stops.forEach(function (s) { need[s.region] = 1; }); });
    Object.keys(need).forEach(function (r) { loadProvinceDetail(r, renderDaysBody); });
    renderTrips();
  }

  /* 地图 */
  var map = null, mapLayer = null, mapGen = 0;
  var planDayGroups = [];   /* 批次18 双栏：按天分组的线段，左栏悬停某日只留那天的线（drawMap 每轮重建） */
  /* ---------- 浏览已选弹层 ---------- */
  window.plannerCloseBrowse = function () { var mk = $id('browseMask'); if (mk) mk.remove(); };
  window.plannerOpenBrowse = function () {
    var old = $id('browseSheet'); if (old) old.remove();
    var oldM = $id('browseMask'); if (oldM) oldM.remove();
    var m = document.createElement('div');
    m.id = 'browseMask';
    m.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(20,16,12,.45);display:flex;align-items:flex-end;justify-content:center';
    var items = state.selected.map(function (s, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--color-line)">' +
        '<span style="min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:var(--color-primary);color:var(--bg);font-size:var(--fs-2)">' + (i + 1) + '</span>' +
        '<span style="flex:1;font-size:var(--fs-5)">' + esc(s.name || s.label) + '<span style="display:block;font-size:var(--fs-2);color:var(--color-muted)">' + esc(s.city || s.region || '') + (s.__cur ? ' · 当前位置' : '') + '</span></span>' +
        '<button class="btn ghost" style="padding:4px 10px;font-size:var(--fs-3)" onclick="window.plannerRemovePick(' + i + ')">删除</button></div>';
    }).join('');
    m.innerHTML = '<div style="width:100%;max-width:430px;max-height:78vh;overflow:auto;background:var(--color-surface,#FBF6EC);border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.25)">' +
      '<div style="display:flex;align-items:center;margin-bottom:8px"><b style="font-size:var(--fs-6)">已选景点（' + state.selected.length + '）</b><span style="flex:1"></span>' +
      '<button class="btn ghost" style="padding:4px 10px;font-size:var(--fs-3)" onclick="window.plannerCloseBrowse()">'+TI('close')+'关闭</button></div>' +
      (items || '<div class="empty" style="padding:20px 0"><svg class="empty-art" viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="帐篷线稿"><path d="M60 22 L96 76 H24 Z"/><path d="M60 22 L60 76"/><path d="M60 40 L74 76 M60 40 L46 76" opacity=".6"/><path d="M60 22 V12 H72" opacity=".55"/><path d="M6 78 H114" opacity=".35"/><path d="M88 62 Q96 58 104 62 Q112 58 118 62" opacity=".3"/></svg><span style="font-size:var(--fs-3);color:var(--color-muted)">还没有选景点</span></div>') +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button class="btn" style="flex:1" id="browseCurLocBtn" onclick="window.plannerAddCurLoc(this)">'+TI('locate')+'当前位置</button>' +
      '<button class="btn" style="flex:1" onclick="window.plannerClearPicks()">'+TI('trash')+'清空</button></div>' +
      '<button class="btn primary" style="width:100%;margin-top:8px" id="browsePlanBtn" onclick="window.plannerAmapPlan()">' + (amapPlanning ? TI('hourglass') + '距离计算中…' : TI('car') + '高德规划行程') + '</button></div>';
    if (amapPlanning) { var pb = m.querySelector('#browsePlanBtn'); if (pb) pb.disabled = true; }
    m.addEventListener('click', function (e) { if (e.target === m) { m.remove(); } });
    document.body.appendChild(m);
  };
  window.plannerRemovePick = function (i) {
    if (state.selected[i]) state.selected.splice(i, 1);
    state.amapSorted = false;
    renderCandidates(); renderSumm();
    window.plannerOpenBrowse();
  };
  window.plannerClearPicks = function () {
    if (!state.selected.length) return;
    UI.confirm({ title: '清空已选', text: '将清空当前已选的 ' + state.selected.length + ' 个景点，可撤销。', okText: '清空', danger: true }, function (ok) {
      if (!ok) return;
      var snap = state.selected.slice();
      state.selected = []; state.amapSorted = false;
      renderCandidates(); renderSumm();
      var mk = $id('browseMask'); if (mk) mk.remove();
      UI.toast('已清空 ' + snap.length + ' 个选择', 5000, { text: '撤销', fn: function () { state.selected = snap; renderCandidates(); renderSumm(); } });
    });
  };
  window.plannerAddCurLoc = function (btn) {
    var restore = function () { if (btn) { btn.disabled = false; btn.innerHTML = TI('locate') + '当前位置'; } };
    if (btn) { btn.disabled = true; btn.textContent = '定位中…'; }
    var add = function (lat, lng) {
      var dup = state.selected.some(function (x) { return x.__cur; });
      if (dup) { toast('当前位置已在列表中'); return; }
      state.selected.push({ name: '当前位置', label: '当前位置', region: '', city: '', theme: '', flag: '', lat: lat, lng: lng, __cur: true });
      state.amapSorted = false;
      renderCandidates(); renderSumm();
      window.plannerOpenBrowse();
      toast('已加入当前位置');
    };
    if (!navigator.geolocation) { restore(); toast('当前环境不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(function (p) { restore(); add(p.coords.latitude, p.coords.longitude); },
      function () { restore(); toast('定位失败：请检查定位权限是否授予「行迹」，或在地图收藏点后手动添加'); }, { timeout: 8000 });
  };

  /* ---------- 高德真实导航路线（按段拉取，缓存，失败降级直线） ---------- */
  /* 统一限流闸门：高德 Web 服务免费 Key 的 QPS 实测只有 2（超限回 infocode=10021）。
     此前地图一次并发十几段、矩阵并发 6，整批被限流后各自 cb(null)，
     结果就是"路线全是直线"且不报错——把请求收进这一个闸门：
     并发 ≤2、429 类错误退避重试、重试仍失败则计数并当场播报，绝不静默当成直线。 */
  var AMAP_MAX_STOPS = 12;   /* 逐对查询的成本上限：n 站要 n(n-1)/2 段，12 站 = 66 段 */
  var amapGate = { active: 0, queue: [] };
  function gateRun(gate, job) {
    gate.queue.push(job);
    function pump() {
      if (gate.active >= 2 || !gate.queue.length) return;
      var j = gate.queue.shift();
      gate.active++;
      j(function () { gate.active--; pump(); });
    }
    pump();
  }
  function amapRun(job) { gateRun(amapGate, job); }
  function amapRest(url, cb, tries) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort(); }, 9000);
    fetch(url, { signal: ctl.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(to);
        var quota = j && j.infocode === '10021';
        /* 超配额就在同一闸门槽位内退避重试（重试期间占着槽=主动降速），最多 2 次 */
        if (quota && (tries || 0) < 2) { setTimeout(function () { amapRest(url, cb, (tries || 0) + 1); }, 700 * ((tries || 0) + 1)); return; }
        cb(j && !quota ? j : null);
      })
      .catch(function () { clearTimeout(to); cb(null); });
  }
  /* 天气另开一个同族闸门：不和高德的几十段路线抢那 2 个槽，但同样的并发上限与退避规矩。 */
  var wxGate = { active: 0, queue: [] };
  function wxRun(job) { gateRun(wxGate, job); }
  function wxRest(url, cb, tries) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort(); }, 9000);
    fetch(url, { signal: ctl.signal })
      .then(function (r) {
        if (r.status === 429 && (tries || 0) < 2) throw { wxRetry: 1 };
        return r.json();
      })
      .then(function (j) { clearTimeout(to); cb(wxParse(j)); })
      .catch(function (e) {
        clearTimeout(to);
        if (e && e.wxRetry && (tries || 0) < 2) { setTimeout(function () { wxRest(url, cb, (tries || 0) + 1); }, 700 * ((tries || 0) + 1)); return; }
        cb(null);
      });
  }
  function amapUrl(extra, a, b, key) {
    return 'https://restapi.amap.com/v3/direction/driving?origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat + '&' + extra + '&ke' + 'y=' + encodeURIComponent(key);
  }
  function amapRoutePolyline(a, b, cb) {
    var key = getAmapKey();
    if (!key) { cb(null); return; }
    var ck = 'tn_rt_' + a.lat.toFixed(3) + ',' + a.lng.toFixed(3) + '_' + b.lat.toFixed(3) + ',' + b.lng.toFixed(3);
    try { var hit = localStorage.getItem(ck); if (hit) { cb(JSON.parse(hit)); return; } } catch (e) {}
    amapRun(function (release) {
      amapRest(amapUrl('extensions=all&strategy=0', a, b, key), function (j) {
        release();
        var pts = [];
        if (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) {
          (j.route.paths[0].steps || []).forEach(function (st) {
            if (!st.polyline) return;
            st.polyline.split(';').forEach(function (p) { var c = p.split(','); if (c.length >= 2) pts.push([parseFloat(c[1]), parseFloat(c[0])]); });
          });
        }
        if (pts.length > 1) { try { localStorage.setItem(ck, JSON.stringify(pts)); rememberCacheKey(ck); } catch (e) {} cb(pts); } else cb(null);
      });
    });
  }
  /* 高德 Key：localStorage 优先，本地文件后备并自动写入 */
  function getAmapKey() {
    try { var k = localStorage.getItem('tn_amap_key'); if (k) return k; } catch (e) {}
    if (window.__TN_AMAP_KEY__) { try { localStorage.setItem('tn_amap_key', window.__TN_AMAP_KEY__); } catch (e) {} return window.__TN_AMAP_KEY__; }
    return '';
  }

  /* 高德真实驾车距离（米→km，缓存）。矩阵与折线共用同一个 key 前缀空间，
     同一对坐标在整个 App 里只打一次网络。 */
  function amapDriveDist(a, b, cb) {
    var key = getAmapKey();
    if (!key) { cb(null); return; }
    var ck = 'tn_d_' + coordKey(a) + '_' + coordKey(b);
    try { var hit = localStorage.getItem(ck); if (hit) { cb(parseFloat(hit)); return; } } catch (e) {}
    amapRun(function (release) {
      amapRest(amapUrl('extensions=base', a, b, key), function (j) {
        release();
        var km = (j && j.status === '1' && j.route && j.route.paths && j.route.paths[0]) ? (parseFloat(j.route.paths[0].distance) / 1000) : null;
        if (km != null && isFinite(km)) { try { localStorage.setItem(ck, String(km)); rememberCacheKey(ck); } catch (e) {} cb(km); } else cb(null);
      });
    });
  }
  /* 距离矩阵最近邻 + 2-opt（真实距离优先，缺失用直线兜底）。
     兜底统一走 hav，绝不返回 0——旧写法缺失时落到 hav(sel[i],sel[j]) 是对的，
     但起点/终点没有坐标时过去按 0 处理，等于把出发地从天平上摘掉。 */
  function orderByMatrix(sel, start, dist) {
    var N = sel.length;
    dist = dist || {};
    function pairKm(a, b) {
      var k1 = coordKey(a) + '|' + coordKey(b), k2 = coordKey(b) + '|' + coordKey(a);
      if (dist[k1] != null) return dist[k1];
      if (dist[k2] != null) return dist[k2];
      return window.Geo.hav(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR;
    }
    var startPt = (start && start.lat != null) ? start : null;
    var remain = sel.slice(), ordered = [], cur = startPt;
    while (remain.length) {
      var bi = 0, best = Infinity;
      for (var k = 0; k < remain.length; k++) {
        var d = cur ? pairKm(cur, remain[k]) : 0;
        if (d < best) { best = d; bi = k; }
      }
      cur = remain[bi]; ordered.push(cur); remain.splice(bi, 1);
    }
    /* 2-opt：任意长度都跑（旧写法 N>3 早退，3~4 站只剩最近邻，
       而「两个远点排在一起」恰恰高发在这个规模）。
       没有出发地时前缀翻转只换一条边界边——旧写法在此处把 pa 当坐标点传给 hav，
       直接抛 TypeError，点「高德规划行程」不填出发地就整页卡住。 */
    var improved = true;
    while (improved) {
      improved = false;
      for (var i2 = 0; i2 < N - 1; i2++) {
        for (var k2 = i2 + 1; k2 < N; k2++) {
          var pb = ordered[i2], pc = ordered[k2], pd = (k2 + 1 < N) ? ordered[k2 + 1] : null;
          if (!pb || !pc || !pd) continue;
          var pa = i2 === 0 ? startPt : ordered[i2 - 1];
          var d1 = pairKm(pc, pd) + (pa ? pairKm(pa, pb) : 0);
          var d2 = pairKm(pb, pd) + (pa ? pairKm(pa, pc) : 0);
          if (d2 + 0.5 < d1) {
            ordered = ordered.slice(0, i2).concat(ordered.slice(i2, k2 + 1).reverse(), ordered.slice(k2 + 1));
            improved = true;
          }
        }
      }
    }
    return ordered;
  }
  /* 距离矩阵：逐对走高德。并发由 amapDriveDist 内部的统一闸门卡着（全局 ≤2），
     这里绝不能再套一层 amapRun：外层占着槽位等内层槽位，3 站 3 段实测跑完 1 段就死锁，
     表现正是「点了高德规划行程没反应、静默退回直线」。
     回调给回按坐标对索引的矩阵 + 失败段数——失败数必须带回，
     否则"取了多少真里程"这件事只有服务器知道。 */
  function fetchDistMatrix(sel, cbAll) {
    var N = sel.length, dist = {}, failed = 0, done = 0, finished = false;
    var pairs = [];
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) pairs.push([i, j]);
    var total = pairs.length;
    if (!total) { cbAll(dist, 0); return; }
    var hardTo = setTimeout(function () { if (!finished) { finished = true; cbAll(dist, failed + (total - done)); } }, 45000);
    pairs.forEach(function (p) {
      amapDriveDist(sel[p[0]], sel[p[1]], function (km) {
        if (finished) return;
        done++;
        if (km != null) dist[coordKey(sel[p[0]]) + '|' + coordKey(sel[p[1]])] = km; else failed++;
        if (done >= total) { finished = true; clearTimeout(hardTo); cbAll(dist, failed); }
      });
    });
  }
  /* 取数前的成本闸：n 站要跑 n(n-1)/2 段，超过 AMAP_MAX_STOPS 就不硬扛，
     并且把"这次到底拿到多少真实里程"当场说出来——静默退直线是最坏的结果。 */
  function amapCoverageText(got, total) {
    if (!total) return '';
    if (!got) return '真实里程一段都没取到（Key 无效或配额用尽），本次按直线折算排线';
    if (got < total) return '真实里程取到 ' + got + '/' + total + ' 段，缺的按直线折算';
    return '全程 ' + total + ' 段均为高德真实里程';
  }
  /* 浏览弹层：【高德规划行程】— 真实道路距离排序 + 直出排期 */
  var amapPlanning = false;
  window.plannerAmapPlan = function () {
    if (amapPlanning) return;
    if (state.selected.length < 2) { toast('至少选 2 个景点才能规划'); return; }
    var key = getAmapKey();
    if (!key) { toast('未配置高德 Key，无法用高德规划行程（设置页可配置）'); return; }
    if (state.selected.length > AMAP_MAX_STOPS) { toast(overCapMsg(state.selected.length)); return; }
    amapPlanning = true;
    var mk = $id('browseMask');
    if (mk) { var pb = mk.querySelector('#browsePlanBtn'); if (pb) { pb.disabled = true; pb.textContent = '距离计算中…'; } }
    fetchDistMatrix(state.selected, function (dist, failed) {
      amapPlanning = false;
      var ordered = orderByMatrix(state.selected, state.start, dist);
      state.selected = ordered;
      state.amapSorted = true;
      /* 矩阵随选点集签名缓存：同一批站点排期时直接复用，不再打第二次 66 段网络 */
      state.matrix = { sig: picksSig(state.selected), dist: dist };
      renderCandidates(); renderSumm();
      if (mk) mk.remove();
      window.plannerOpenBrowse();
      toast(amapCoverageText(Object.keys(dist).length, Object.keys(dist).length + failed) + '，点「开始排期」出行程');
    });
  };

  var routeHintShown = false;

  /* P1-7 地图路线双色描边：针脚/线身走 token，暗色主题自动翻深 */
  function cssColor(name, fb) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (e) { return fb; }
  }

  /* 建图与画图分两层：画图只对「已经有尺寸的容器」做。
     showStage 走 UI.vt（View Transition），DOM 更新被推到下一帧，所以 showStage() 之后立刻
     量 #mapBox 量到的是切换前的 display:none = 0×0。对着 0×0 建图，Leaflet 的瓦片视口和
     SVG 渲染器会永久停在 0×0，fitBounds 同时退化成 maxZoom —— 实测症状就是用户报的三条：
     底图只出一块瓦片（铺满 10.1%）、折线全画不出（8 条 path 均 0×0）、针脚甩到 -49383px 外
     连带弹窗定位到框外。事后补 invalidateSize 只救得回尺寸（瓦片 100%）救不回视图（path 仍
     0×0），所以只能在有尺寸之后建图，不能指望事后补救。 */
  function renderMap() {
    var trip = state.trip; if (!trip) return;
    var pts = [];
    trip.days.forEach(function (d) { d.stops.forEach(function (s) { pts.push(s); }); });
    if (!pts.length) return;
    var gen = ++mapGen, box = $id('mapBox'), tries = 0;
    if (box.clientWidth && box.clientHeight) { drawMap(trip, pts); return; }
    (function wait() {
      if (gen !== mapGen) return;                                  /* 更新的渲染已接管，这次作废 */
      if (box.clientWidth && box.clientHeight) { drawMap(trip, pts); return; }
      if (++tries < 180) requestAnimationFrame(wait);              /* 约 3s 还没尺寸＝这一阶段真没显示 */
    })();
  }

  function drawMap(trip, pts) {
    if (!map) { map = L.map('mapBox', { zoomControl: false }).setView([34.5, 105], 5); L.control.zoom({ position: 'bottomright' }).addTo(map); var tl = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德' }).addTo(map); if (window.UI) UI.tileWarn(tl, '地图'); mapLayer = L.layerGroup().addTo(map); }
    map.invalidateSize();
    mapLayer.clearLayers();
    var bnd = [], seq = [];
    if (trip.start && trip.start.lat != null) seq.push(trip.start);
    seq = seq.concat(pts);
    if (trip.end && trip.end.lat != null) seq.push(trip.end);   /* 终到地：末站 → 终点（有坐标时） */
    var routeReal = 0;
    var LINE = cssColor('--route-color', '#AE5738'), CASE = cssColor('--color-gold', '#8F5D0E');
    /* 批次18 双栏：线段按天分组存着，左栏悬停某日才只留那天的线。pts 本来就是按天摊平的，
       所以 dayOf 的下标与它一一对应；起点并进 D1、终点并进最后一天，转场日没有站点自然没有线。 */
    var dayOf = [];
    trip.days.forEach(function (d, k) { d.stops.forEach(function () { dayOf.push(k); }); });
    var own = [];
    if (trip.start && trip.start.lat != null) own.push(0);
    own = own.concat(dayOf);
    if (trip.end && trip.end.lat != null) own.push(trip.days.length - 1);
    planDayGroups = trip.days.map(function () { return L.layerGroup().addTo(mapLayer); });
    for (var i = 1; i < seq.length; i++) {
      var a = [seq[i - 1].lat, seq[i - 1].lng], b = [seq[i].lat, seq[i].lng];
      if (a[0] == null || b[0] == null) continue;
      bnd.push(a, b);
      var seg = L.layerGroup().addTo(planDayGroups[own[i]] || mapLayer);
      /* 双色：鎏金底衬 + 主色线身（离线直线示意） */
      planLine(seg, [a, b], { color: CASE, weight: 6, opacity: .4, lineCap: 'round' });
      planLine(seg, [a, b], { color: LINE, weight: 3, opacity: .85, dashArray: '7 7' });
      (function (aa, bb, sg) {
        amapRoutePolyline({ lat: aa[0], lng: aa[1] }, { lat: bb[0], lng: bb[1] }, function (pts) {
          if (pts && pts.length > 1) {
            sg.clearLayers();
            planLine(sg, pts, { color: CASE, weight: 7, opacity: .45, lineCap: 'round' });
            planLine(sg, pts, { color: LINE, weight: 4, opacity: .95 });
            routeReal++;
          } else if (!getAmapKey() && !routeHintShown) {
            routeHintShown = true;
            try { toast('未配置高德 Key，地图显示直线示意；配置后可显示真实导航路线'); } catch (e) {}
          }
        });
      })(a, b, seg);
    }
    pts.forEach(function (s, i) {
      if (s.lat == null) return;
      var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: '<span class="map-pin"><b>' + (i + 1) + '</b></span>', iconSize: [26, 26], iconAnchor: [13, 24] }) });
      m.bindPopup('<b>' + esc(s.name) + '</b><br>' + esc(s.region || '') + (s.city ? ' · ' + esc(s.city) : ''));
      mapLayer.addLayer(m);
    });
    if (bnd.length > 1) map.fitBounds(bnd, { padding: [40, 40] });
    else if (bnd.length === 1) map.setView(bnd[0], 9);
  }
  /* 批次18：建线时把基准透明度/线宽记在实例上——setStyle 就地改 options，
     不留底就没有「离开悬停后回到哪一档」的答案。 */
  function planLine(group, latlngs, opts) {
    var ln = L.polyline(latlngs, opts);
    ln._bop = opts.opacity; ln._bw = opts.weight;
    ln.addTo(group);
    return ln;
  }
  /* 左栏悬停某日 → 那天的线加粗提亮，其余压到三成。手机档没有悬停指针，这条只在桌面/平板生效。 */
  function hlPlanDay(di) {
    planDayGroups.forEach(function (g, k) {
      var on = di < 0 || k === di;
      g.eachLayer(function (sg) {
        sg.eachLayer(function (ln) {
          if (ln._bop == null) return;
          ln.setStyle({ opacity: on ? ln._bop : Math.round(ln._bop * 30) / 100, weight: on ? ln._bw : Math.max(2, ln._bw - 1) });
        });
      });
    });
  }
  window.plannerHlDay = hlPlanDay;

  /* ---------- 落地动作 ---------- */
  function flatStops() { var r = []; (state.trip && state.trip.days || []).forEach(function (d) { d.stops.forEach(function (s) { r.push(s); }); }); return r; }
  /* 转场日没有景点行，只有 A→B：导出/复制必须给出这一行，不能留空白 Day */
  function dayText(d) {
    return d.transit ? '赶路日：' + (d.from || '出发地') + ' → ' + (d.to || '目的地') + '（约 ' + Math.round(d.driveKm) + ' km）'
      : d.stops.map(function (s) { return s.name; }).join(' → ');
  }
  window.plannerCopyPlan = function () {
    var t = state.trip; if (!t) return;
    var txt = '🚗 行程计划（行迹 TRACE）· ' + t.name + '\n';   /* emoji-ok: 复制到剪贴板的纯文本，没有 SVG 载体 */
    t.days.forEach(function (d, i) { txt += 'Day' + (i + 1) + '：' + dayText(d) + '\n'; });
    copyText(txt);
  };

  /* ---------- 只读分享（批次 9 · P1-5）----------
     链接能把行程带给没装应用的人，前提是这个页面有个别人打得开的地址：
     应用部署在 http(s) 上时自动就是当前地址；本机 file:// 时要在设置里填「分享网址」。
     两者都没有就不硬造打不开的链接，直接给文字版——这是实话，不是偷懒。 */
  window.plannerShare = function () {
    var t = state.trip; if (!t) { toast('先排好行程再分享'); return; }
    if (!window.Share) { toast('分享模块没加载'); return; }
    var r = Share.build(t);
    if (r.reason) { toast(r.reason); return; }
    var s = r.summary || Share.summary(r.payload);
    var fields = '会分享出去的内容：\n· 标题、出发日期、起讫城市（环线会标注）\n· ' + s.days + ' 天 / ' + s.stops + ' 站 / 约 ' + s.km +
      ' km 的日程与站点坐标\n· 里程是真实道路还是折算，一并写清\n\n不会分享：游记正文、照片、录音、任何 API Key。';
    var how = r.ok ? '地址：' + Share.linkBase() + '/share.html（内容写在网址里，对方点开即见，不用装应用）'
      : (r.degrade === 'too-long'
        ? '这条行程编码后有 ' + r.chars + ' 字符，超过聊天软件约 ' + r.limit + ' 字符的网址上限，只能发文字版。'
        : '还没有可让别人打开的网址（本机 file:// 地址对方打不开）。想发链接请到 设置 → 分享网址 填一个已部署的地址；现在先发文字版。');
    UI.confirm({ title: '分享这份行程', text: fields + '\n\n' + how, okText: r.ok ? '生成链接' : '复制文字', cancelText: '取消' }, function (yes) {
      if (!yes) return;
      if (!r.ok) { copyText(r.text); toast(r.degrade === 'too-long' ? '行程太长，已复制文字版' : '已复制文字版'); return; }
      sendShare(r);
    });
  };
  function sendShare(r) {
    if (typeof navigator.share === 'function') {
      try {
        navigator.share({ title: r.payload.t || '行程分享', text: '送你一份行程：' + (r.payload.t || ''), url: r.url })
          .then(function () { toast('已调起系统分享'); },
            function (e) { if (e && e.name === 'AbortError') return; copyText(r.url); toast('链接已复制，去聊天软件里粘贴'); });
        return;
      } catch (e) { /* WebView 里 share() 可能是空壳，直接落到复制 */ }
    }
    copyText(r.url);
    toast('链接已复制，去聊天软件里粘贴');
  }
  window.plannerExportGPX = function () {
    var t = state.trip; if (!t) return;
    var pts = flatStops();
    var gpx = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="行迹 TRACE" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>行迹行程计划</name></metadata><trk><name>' + t.name + '</name><trkseg>' +
      pts.map(function (s) { return '<trkpt lat="' + s.lat + '" lon="' + s.lng + '"><name>' + esc(s.name) + '</name></trkpt>'; }).join('') + '</trkseg></trk>';
    t.days.forEach(function (d, di) { d.stops.forEach(function (s) { gpx += '<wpt lat="' + s.lat + '" lon="' + s.lng + '"><name>D' + (di + 1) + ' ' + esc(s.name) + '</name></wpt>'; }); });
    gpx += '</gpx>';
    var fname = '行迹行程_' + (t.name || '计划') + '_' + new Date().toISOString().slice(0, 10) + '.gpx';
    if (window.AndroidVoice && AndroidVoice.saveTextFile) { try { AndroidVoice.saveTextFile(fname, gpx); toast('GPX 已保存到下载目录'); } catch (e) { toast('导出失败'); } return; }
    try { var blob = new Blob([gpx], { type: 'application/gpx+xml' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); toast('GPX 已导出'); } catch (e) { toast('导出失败'); }
  };

  /* ---------- 导出日历（批次 16 · ICS 纯字符串，零依赖、不联网） ----------
     行程结构里只有 startDate + days[]，没有逐日日期、也没有时刻。所以这里诚实做「全天事件」，
     不假造几点开始几点结束。日期全部走 dayDate()（它已经管好了 +di 和非法值），
     不用 toLocaleDateString/toLocaleString —— 那跟着系统语言走，同一份行程在两台手机上会生成两个不同的文件。
     全天事件用 DTSTART;VALUE=DATE + DTEND=次日：既避开 VTIMEZONE 整块复杂度，又是各家日历都认的写法。 */
  var ICS_FOLD = 75;
  /* 门票/营业时间只取「同步命中」那一级：种子、本机 30 天缓存、或无 Key 时直接放弃。
     高德那条腿是异步的——导出按钮不该为了补一行营业时间挂在一个网络上，更不该在没网的山上转圈。 */
  function icsTicket(site) {
    if (!window.SiteTickets) return null;
    var got = null, returned = false;
    try { SiteTickets.get(site, function (t) { if (!returned) got = t; }); } catch (e) {}
    returned = true;
    return got;
  }
  function icsEsc(v) {
    return String(v == null ? '' : v)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r\n/g, '\\n').replace(/[\r\n]/g, '\\n');
  }
  /* 折行按 UTF-8 字节数走，不能 slice(0,75)：那按码点切，会把一个汉字劈成两个非法字节序列，
     各家日历一律拒收，而用户在手机上只看得见「打不开」四个字。Array.from 顺带保证 emoji 不被劈开。 */
  function icsFold(line) {
    var enc = new TextEncoder(), cps = Array.from(line), chunks = [], buf = '', used = 0, budget = ICS_FOLD;
    for (var i = 0; i < cps.length; i++) {
      var b = enc.encode(cps[i]).length;
      if (used + b > budget) { chunks.push(buf); buf = ''; used = 0; budget = ICS_FOLD - 1; }
      buf += cps[i]; used += b;
    }
    chunks.push(buf);
    return chunks.join('\r\n ');
  }
  function icsLine(name, val) { return icsFold(name + ':' + icsEsc(val)); }
  function icsDay(s) { return s.replace(/-/g, ''); }
  function icsStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsFileSafe(n) { return String(n || '行程').replace(/[\\/:*?"<>|]/g, '·').slice(0, 60) || '行程'; }

  function buildTripIcs(trip) {
    var days = (trip && trip.days) || [];
    var d0 = dayDate(trip, 0);
    /* 没有出发日期就没有事件：createdAt 是「生成日期」不是「出发日期」，绝不拿它顶替，也绝不落回 1970。 */
    if (!d0 || !days.length) return null;
    var id = String(trip.id || ('p' + (trip.createdAt || Date.now()))).replace(/[^A-Za-z0-9._-]/g, '-');
    var stamp = icsStamp();
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//行迹 TRACE//行程规划//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    function event(uid, summary, desc, loc, from, to) {
      L.push('BEGIN:VEVENT');
      L.push(icsLine('UID', uid));
      L.push(icsLine('DTSTAMP', stamp));
      L.push('DTSTART;VALUE=DATE:' + icsDay(from));
      L.push('DTEND;VALUE=DATE:' + icsDay(to));
      L.push(icsLine('SUMMARY', summary));
      L.push(icsLine('DESCRIPTION', desc));
      if (loc) L.push(icsLine('LOCATION', loc));
      L.push('END:VEVENT');
    }
    var route = [trip.start && trip.start.name, trip.end && trip.end.name].filter(Boolean).join(' → ');
    event(id + '@lvyou-trace',
      (trip.name || '行程') + '（共 ' + days.length + ' 天）',
      days.map(function (d, di) { return '第' + (di + 1) + '天 ' + dayDate(trip, di) + '：' + dayText(d); }).join('\n') +
        '\n' + rulerNote(trip) + (route ? '\n路线：' + route : ''),
      route, d0, dayDate(trip, days.length));
    days.forEach(function (d, di) {
      var head = '第' + (di + 1) + '天 · ';
      var lines = [], loc = '', date = dayDate(trip, di);
      if (d.transit) {
        head += (d.from || '出发地') + '→' + (d.to || '目的地');
        lines.push('赶路日：' + (d.from || '出发地') + ' → ' + (d.to || '目的地') + '，约 ' + Math.round(d.driveKm) + ' km');
      } else {
        var city = (d.stops[0] && (d.stops[0].city || d.stops[0].region)) || '';
        head += (city || '途经') + '漫游';
        loc = (d.stops[0] && d.stops[0].name) || '';
        d.stops.forEach(function (s, si) {
          var tk = icsTicket(s), t = [];
          t.push((si + 1) + '. ' + s.name);
          if (tk && tk.h) t.push(tk.h);
          if (tk && tk.p) t.push(tk.p);
          if (tk && tk.u) t.push('更新于 ' + tk.u);
          lines.push(t.join(' · '));
        });
        if (!d.stops.length) lines.push('这一天没有安排站点');
        lines.push('当日约 ' + Math.round(d.driveKm) + ' km，含游玩约 ' + (d.totalH || 0).toFixed(1) + ' 小时');
      }
      event(id + '-d' + di + '@lvyou-trace', head, lines.join('\n'), loc, date, dayDate(trip, di + 1));
    });
    L.push('END:VCALENDAR');
    /* 行结束符必须是 CRLF（RFC 5545 硬性要求）；末尾那一个 CRLF 也不能省，部分解析器靠它收最后一行。 */
    return L.join('\r\n') + '\r\n';
  }

  window.plannerExportIcs = function () {
    var t = state.trip;
    if (!t) { toast('先排好行程再导出日历'); return; }
    var ics = buildTripIcs(t);
    if (!ics) { toast('要先在规划页选出发日期，日历事件才有日期'); return; }
    var fname = icsFileSafe(t.name) + '.ics';
    if (window.AndroidVoice && AndroidVoice.saveTextFile) {
      /* APK 里 a[download] 是死路：壳工程没注册 DownloadListener（实测 MainActivity 全文无 setDownloadListener），
         点下载不会有任何反应。下载目录这条腿是 APK 唯一的出口，__tnSaveDone 回吐真实结果，不假装成功。 */
      window.__tnSaveDone = function (r) {
        if (r === 'err') toast('日历文件没能写进下载目录');
        else if (r === 'need_perm') toast('要先允许存储权限，然后再点一次导出日历');
        else toast('已存到下载目录：' + fname + '，用文件管理器点开即可导入日历');
      };
      try { AndroidVoice.saveTextFile(fname, ics); } catch (e) { toast('导出失败'); }
      return;
    }
    try {
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 400);
      toast('已导出 ' + fname);
    } catch (e) {
      copyText(ics);
      toast('浏览器拦住了下载，已复制日历内容：粘贴到备忘录存成 .ics 文件同样能导入');
    }
  };
  window.plannerSaveTrip = function () {
    var t = state.trip; if (!t) return;
    t.id = t.id || ('p' + Date.now());
    var list = loadTrips();
    list.unshift(t);
    if (!lsSet('tn_trips', JSON.stringify(list))) return;
    toast('已保存行程「' + t.name + '」');
    renderTrips();
    /* 滚动到已保存行程区，让用户立即看到 */
    try { $id('tripsCard').scrollIntoView({ behavior: UI.scrollBehavior(), block: 'nearest' }); } catch (e) {}
  };
  window.plannerAddAllWish = function () {
    var pts = flatStops();
    if (!window.Wish) return;
    var added = 0;
    pts.forEach(function (s) { if (Wish.toggle({ name: s.name, label: s.name, theme: s.theme, region: s.region, city: s.city, lat: s.lat, lng: s.lng })) added++; });
    toast('已加入想去清单 ' + added + ' 处');
  };
  /* ---------- 一键成册（路书 + 纪念册，行程维度，就地生成） ---------- */
  /* 这是一份自带 <style> 的独立文档：theme.css 不在里面，所以 var(--fs-*) 从来没解析成功过
     （导出的路书里 h2 一直是 body 字号）。字号一律写死，屏幕态和打印态都是。
     打印态尤其不能跟着阶梯走——手机「加大字号」把根字号顶到 112%，A4 排版会被撑坏。
     @page 只作用于分页介质，放顶层不影响屏幕态。 */
  function docShell(name, body) {
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(name) + '</title><style>' +
      'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:640px;margin:0 auto;padding:24px 20px;color:#26241F;line-height:1.85;background:#F6F3EC}' +
      'h1{font-family:"Songti SC",serif;font-weight:400;font-size:26px}h2{font-family:"Songti SC",serif;font-weight:400;font-size:17px;border-left:3px solid #AE5738;padding-left:10px;margin:26px 0 8px}' +
      '.muted{color:#8C877D;font-size:13px}.story{background:#FFFDF8;border:1px solid #E3DED2;padding:14px;border-radius:12px;font-family:"Songti SC",serif;margin:12px 0}' +
      '.note{border-bottom:1px solid #E3DED2;padding:12px 0}.note:last-child{border-bottom:0}' +
      '@page{margin:14mm}' +
      '@media print{' +
      'body{max-width:none;margin:0;padding:0;color:#000;background-color:#fff;font-size:10.5pt;line-height:1.6}' +
      'h1{font-size:20pt}h2{font-size:13pt;border-left-color:#000;padding-left:6pt;margin:14pt 0 4pt}' +
      '.muted{color:#333;font-size:9pt}' +
      '.story{background:none;border:1px solid #666;border-radius:0;padding:8pt}' +
      '.daycard{break-inside: avoid}' +
      'img{max-width:100%;print-color-adjust: exact;-webkit-print-color-adjust:exact}' +
      '}' +
      '</style></head><body><div class="wrap">' + body + '</div></body></html>';
  }
  function saveHtmlDoc(name, html) {
    if (window.AndroidVoice && AndroidVoice.saveTextFile) { try { AndroidVoice.saveTextFile(name + '.html', html); toast('已保存：' + name); return; } catch (e) {} }
    try { var a = document.createElement('a'); a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); a.download = name + '.html'; document.body.appendChild(a); a.click(); a.remove(); toast('已下载：' + name); } catch (e) { toast('导出失败'); }
  }
  function buildTripItineraryDoc(trip) {
    var h = '<h1>' + esc(trip.name) + '</h1><div class="muted">' + trip.days.length + ' 天 · ' + trip.days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站' + (trip.startDate ? ' · 出发 ' + esc(trip.startDate) : '') + '</div>';
    if (trip.narrative && trip.narrative.story) h += '<div class="story">' + esc(trip.narrative.story) + '</div>';
    trip.days.forEach(function (d, di) {
      /* 一天一包：打印分页的锚点就是这个盒子（赶路日也想单独成段，但允许被拆开——见 docShell 打印态） */
      h += '<div class="daycard">';
      h += '<h2>Day ' + (di + 1) + (d.transit ? ' · 赶路日' : '') + (trip.narrative && trip.narrative.dayThemes && trip.narrative.dayThemes[di] ? ' · ' + esc(trip.narrative.dayThemes[di]) : '') + '</h2><div class="muted">' + (d.transit ? esc((d.from || '出发地') + ' → ' + (d.to || '目的地') + ' · ') : '') + '约 ' + Math.round(d.driveKm) + ' km · 全程约 ' + d.totalH.toFixed(1) + 'h</div>';
      d.stops.forEach(function (s, si) { h += '<div>' + (si + 1) + '. ' + esc(s.name) + (s.city ? ' <span class="muted">' + esc(s.city) + '</span>' : '') + (s.done ? ' ✓' : '') + '</div>'; });   /* emoji-ok: 导出路书 HTML 文档里的纯文本勾号，文档不携带 sprite */
      h += '</div>';
    });
    return docShell(trip.name + ' · 路书', h);
  }
  function tripNotes(trip) {
    var stops = flatStops();
    var notes = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list() : [];
    var out = [], seen = {};
    notes.forEach(function (n) {
      if (seen[n.id]) return;
      var nm = n.siteName || n.title || '';
      var hit = stops.some(function (s) { return nm && s.name && (nm === s.name || nm.indexOf(s.name) >= 0 || s.name.indexOf(nm) >= 0); });
      if (hit) { seen[n.id] = 1; out.push(n); }
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    return out;
  }
  function buildTripAlbumDoc(trip) {
    var notes = tripNotes(trip);
    if (!notes.length) return null;
    var h = '<h1>' + esc(trip.name) + ' · 纪念册</h1><div class="muted">' + notes.length + ' 篇游记</div>';
    notes.forEach(function (n) {
      h += '<div class="note"><h2>' + esc(n.title || n.siteName || '某处') + '</h2><div class="muted">' + esc(n.date || '') + (n.weather ? ' · ' + esc(n.weather) : '') + '</div><div>' + esc(n.text || n.raw || '') + '</div></div>';
    });
    return docShell(trip.name + ' · 纪念册', h);
  }
  window.plannerBuildBook = function () {
    var t = state.trip; if (!t) return;
    saveHtmlDoc(t.name + '·路书', buildTripItineraryDoc(t));
  };
  window.plannerBuildAlbum = function () {
    var t = state.trip; if (!t) return;
    var html = buildTripAlbumDoc(t);
    if (!html) { toast('还没有相关游记，旅行中「记一笔」后再来生成纪念册'); return; }
    saveHtmlDoc(t.name + '·纪念册', html);
  };
  /* 高德对途经点的硬性要求：vian / vialons / vialats / vianames 四个参数数量必须一致，
     少一个 vianames 会被整组丢弃——表现就是「多站的一天发到高德后不显示途经地」。
     名称里的 | 会破坏计数（自建站点名是用户输入），先换成间隔号。 */
  function viaOf(p, xy) {
    return { xy: xy, name: String(p.name == null ? '途经点' : p.name).replace(/\|/g, '·') };
  }
  function navUrlsForDay(t, di) {
    var d = t.days[di];
    if (!d || !d.stops || !d.stops.length) return null;
    var gcj = function (p) {
      if (!p) return null;
      if (p.gcj) return [p.lng, p.lat]; /* 已是高德坐标，直接用，避免二次纠偏 */
      try { var g = window.Geo.gcj02Of(p.lat, p.lng); return [g[1], g[0]]; } catch (e) { return [p.lng, p.lat]; }
    };
    var first = d.stops[0], last = d.stops[d.stops.length - 1];
    var start = d.stops.length > 1 ? gcj(first) : null; /* 只有一站时不照抄它当起点，否则高德报「起终点相同」 */
    var dest = gcj(last);
    if (!dest) return null;
    var ways = d.stops.slice(1, -1).map(function (s) { return viaOf(s, gcj(s)); }).filter(function (w) { return w.xy; });
    var deep = 'amapuri://route/plan/?sourceApplication=' + encodeURIComponent('行迹') +
      (start ? '&slat=' + start[1] + '&slon=' + start[0] + '&sname=' + encodeURIComponent(first.name) : '') +
      '&dlat=' + dest[1] + '&dlon=' + dest[0] + '&dname=' + encodeURIComponent(last.name) + '&dev=0&t=0';
    if (ways.length) {
      deep += '&vian=' + ways.length +
        '&vialons=' + ways.map(function (w) { return w.xy[0]; }).join('|') +
        '&vialats=' + ways.map(function (w) { return w.xy[1]; }).join('|') +
        '&vianames=' + ways.map(function (w) { return encodeURIComponent(w.name); }).join('|');
    }
    var web = 'https://uri.amap.com/navigation?' +
      (start ? 'from=' + start[0] + ',' + start[1] + ',' + encodeURIComponent(first.name) + '&' : '') +
      'to=' + dest[0] + ',' + dest[1] + ',' + encodeURIComponent(last.name) +
      '&mode=car&policy=1&src=' + encodeURIComponent('行迹') + '&coordinate=gaode&callnative=1';
    /* 网页版 URI 的途经点参数叫 via（waypoints 不存在，会被静默忽略），且只认一个：
       多个途经点只有深链档能完整表达，这里取第一个中间站。 */
    if (ways.length) web += '&via=' + ways[0].xy[0] + ',' + ways[0].xy[1] + ',' + encodeURIComponent(ways[0].name);
    return { deep: deep, web: web };
  }
  window.plannerNavUrls = function (di) { return state.trip ? navUrlsForDay(state.trip, di) : null; };
  window.plannerNavDay = function (di) {
    var u = window.plannerNavUrls(di);
    if (!u) { toast(state.trip && state.trip.days[di] ? '站点缺少坐标' : '行程不存在'); return; }
    toast('正在打开高德地图导航…');
    if (/GuJianApp/.test(navigator.userAgent)) { window.location.href = u.deep; return; }
    var t0 = Date.now(); window.location.href = u.deep;
    setTimeout(function () { if (Date.now() - t0 < 2200) window.location.href = u.web; }, 1900);
  };
  window.plannerOpenFootprint = function () { location.href = 'travel-map.html'; };
  window.plannerStartTrip = function () {
    state.travelMode = !state.travelMode;
    toast(state.travelMode ? '旅行模式：逐站打卡并记录游记' : '已退出旅行模式');
    renderDaysBody();
  };
  window.plannerCheckinStop = function (di, si) {
    var d = state.trip && state.trip.days[di]; if (!d || !d.stops[si]) return;
    var s = d.stops[si];
    s.done = !s.done;
    if (s.done) {
      if (window.Wish) Wish.checkin({ name: s.name, label: s.name, theme: s.theme, region: s.region, city: s.city, lat: s.lat, lng: s.lng });
      try { if (window.TravelNotes && TravelNotes.openPanel) TravelNotes.openPanel({ label: s.name, lat: s.lat, lng: s.lng }); } catch (e) {}
      toast('已打卡 · 可以开始记录');
    }
    persistTrip();
    renderDaysBody();
  };
  function persistTrip() {
    var t = state.trip; if (!t || !t.id) return;
    var list = loadTrips();
    for (var i = 0; i < list.length; i++) if (list[i].id === t.id) { list[i] = t; break; }
    try { localStorage.setItem('tn_trips', JSON.stringify(list)); } catch (e) { toast('存储空间已满，行程修改未能保存'); }
  }
  /* ---------- 排期编辑：移除 / 上下移 / 重新排期（保留手工顺序，仅重新切分） ---------- */
  /* 编辑后重新切分必须带上终到地与原矩阵，否则一改站点就悄悄回到直线口径（两本账复活） */
  function resplitTrip() {
    var flat = flatStops();
    if (!flat.length) { state.trip = null; showStage('stagePick'); return; }
    state.trip.days = splitIntoDays(flat, state.trip.start, state.days, state.trip.end, mkLeg(state.trip.dist));
    renderDaysBody(); renderMap();
  }
  window.plannerRemoveStop = function (di, si) {
    var d = state.trip && state.trip.days[di]; if (!d) return;
    d.stops.splice(si, 1);
    if (!d.stops.length) state.trip.days.splice(di, 1);
    persistTrip(); resplitTrip();
  };
  window.plannerMoveStop = function (di, si, dir) {
    var days = state.trip && state.trip.days; if (!days) return;
    var flat = flatStops();
    var idx = 0; for (var i = 0; i < di; i++) idx += days[i].stops.length; idx += si;
    var to = idx + dir;
    if (to < 0 || to >= flat.length) return;
    var t = flat[idx]; flat[idx] = flat[to]; flat[to] = t;
    state.trip.days = splitIntoDays(flat, state.trip.start, state.days, state.trip.end, mkLeg(state.trip.dist));
    persistTrip(); renderDaysBody(); renderMap();
  };
  window.plannerReschedule = function () {
    /* 打开排期向导（步骤可回退调整） */
    showStage('stagePick');
    var cards = $id('stagePick').querySelectorAll('.card');
    for (var ci = 0; ci < cards.length; ci++) cards[ci].style.display = 'none';
    var sb = $id('summbar'); if (sb) sb.style.display = 'none';
    $id('wizardBox').style.display = 'block';
    var w = state.wiz || (state.wiz = wizNew());
    w.step = 1; renderWizard();
  };
  /* 编辑选点：按行程省份重召回，预选原站点，回选点阶段 */
  window.plannerEditPick = function () {
    var flat = flatStops(); if (!flat.length) { showStage('stagePick'); return; }
    var regions = {}; flat.forEach(function (s) { if (s.region) regions[s.region] = 1; });
    state.regions = Object.keys(regions);
    state.prefs = [];
    state.fromWish = false;
    state.selected = flat.slice();
    state.candidates = recall({ regions: state.regions, prefs: [] });
    flat.forEach(function (s) { if (!state.candidates.some(function (c) { return nodeUid(c) === nodeUid(s); })) state.candidates.unshift(s); });
    state.candFilter = '';
    renderIntent(); renderCandidates(); showStage('stagePick');
  };

  function copyText(txt) {
    function legacy() { try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('已复制'); } catch (e) { toast('复制失败'); } }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { toast('已复制'); }, legacy);
    else legacy();
  }

  /* ---------- 已保存行程 ---------- */
  function loadTrips() { try { return JSON.parse(localStorage.getItem('tn_trips') || '[]'); } catch (e) { return []; } }
  /* 行前清单按 tripId 分桶，而批次 17 之前生成的行程没有 id（只在保存那一刻才补）。
     旧行程首次被打时补一个并写回 tn_trips，否则每次打开都换一个新 id、清单永远接不上。 */
  function ensureTripId(t) {
    if (!t) return '';
    if (t.id) return t.id;
    t.id = 'p' + Date.now();
    /* 补完号就立刻落一次快照：清单桶是按这个 id 建的，快照里却没有它的话，
       刷新/返回后 planner 会再补一个新号，前一趟的勾选就找不回来了。 */
    persistState();
    var list = loadTrips();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === t.name && list[i].createdAt === t.createdAt && !list[i].id) {
        list[i].id = t.id; lsSet('tn_trips', JSON.stringify(list)); break;
      }
    }
    return t.id;
  }
  function renderTrips() {
    var list = loadTrips();
    var html = list.map(function (t, i) {
      return '<div class="cand"><span class="dot" style="background:var(--color-primary)"></span><span class="main"><b>' + esc(t.name) + '</b><small>' + esc(t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '') + ' · ' + t.days.length + ' 天 · ' + t.days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站</small></span>' +
        '<button class="btn" style="min-height:30px;padding:0 12px;font-size:var(--fs-3)" onclick="window.plannerOpenTrip(' + i + ')">打开</button>' +
        '<button class="btn ghost" style="min-height:30px;padding:0 10px;font-size:var(--fs-3);color:var(--color-muted)" onclick="window.plannerDelTrip(' + i + ')">'+TI('close', 14)+'</button></div>';
    }).join('');
    /* 结果页（stageResult）底部的已保存行程 */
    var card = $id('tripsCard');
    if (card) { if (list.length) { card.style.display = 'block'; $id('tripsList').innerHTML = html; } else card.style.display = 'none'; }
    /* 第一页（stageInput）的已保存行程入口 */
    var home = $id('tripsHome');
    if (home) { if (list.length) { home.style.display = 'block'; $id('tripsHomeList').innerHTML = html; } else home.style.display = 'none'; }
  }
  window.plannerOpenTrip = function (i) {
    var list = loadTrips(); if (!list[i]) return;
    state.trip = list[i]; showStage('stageResult'); renderResult();
  };
  window.plannerDelTrip = function (i) {
    UI.confirm({ title: '删除行程', text: '删除后可在 5 秒内撤销，之后不可恢复。行前清单的勾选也会一并删除。', okText: '删除', danger: true }, function (ok) {
      if (!ok) return;
      var list = loadTrips();
      var removed = list[i];
      var ckRaw = null;
      try { ckRaw = localStorage.getItem('tn_checklist'); } catch (e) {}
      /* 清单桶跟着行程走：只删行程不删条目，孤儿桶会无界攒在 localStorage 里 */
      if (removed && removed.id && window.Checklist) Checklist.clearTrip(removed.id);
      list.splice(i, 1);
      if (!lsSet('tn_trips', JSON.stringify(list))) return;
      renderTrips();
      if (removed) UI.toast('已删除「' + removed.name + '」', 5000, { text: '撤销', fn: function () { var l = loadTrips(); l.splice(Math.min(i, l.length), 0, removed); lsSet('tn_trips', JSON.stringify(l)); if (ckRaw != null) lsSet('tn_checklist', ckRaw); renderTrips(); } });
    });
  };

  /* ---------- 主流程 ---------- */
  function doGenerate() {
    var text = $id('promptInput').value.trim();
    if (!text) { toast('先告诉我你想去哪、玩几天'); return; }
    var intent = parseIntent(text);
    state.regions = intent.regions; state.days = intent.days; state.prefs = []; state.autoPrefs = intent.prefs || []; state.fromWish = false; state.selected = []; state.amapSorted = false;
    state.startDate = '';
    var proceed = function () {
      renderIntent(); doRecall(); showStage('stagePick');
      var renderEnhBar = function (j, prefix) {
        var bar = $id('aiEnhBar');
        if (!bar) return;
        var parts = [j.pace && ('节奏·' + j.pace), j.companions && ('同伴·' + j.companions), j.vibe].filter(Boolean);
        if (parts.length) bar.innerHTML = '<div style="margin:10px 0;padding:9px 12px;border-radius:10px;font-size:var(--fs-4);background:var(--color-primary-soft);color:var(--color-primary-dark)">' + prefix + esc(parts.join('；')) + '</div>';
      };
      if (getAILevel() === 'full' && window.Ai.hasKey()) {
        aiEnhance(text, function (j) { if (j) renderEnhBar(j, TI('sparkles') + 'AI 补充：'); });
      } else {
        var rj = ruleEnhance(text);
        if (rj) renderEnhBar(rj, TI('companions') + '已识别：');
      }
    };
    if (!state.regions.length && getAILevel() === 'full' && window.Ai.hasKey()) {
      var gb = $id('genBtn');
      if (gb) { gb.disabled = true; gb.textContent = '识别中…'; }
      var unbusy = function () { if (gb) { gb.disabled = false; gb.textContent = '开始规划'; } };
      aiParseIntent(text, function (j) {
        unbusy();
        if (j && j.regions.length) { state.regions = j.regions; if (j.days) state.days = j.days; toast('AI 已识别目的地：' + j.regions.join('、')); }
        else toast('没识别到目的地，试试「川西」「云南」或「长沙」');
        proceed();
      });
    } else {
      if (!state.regions.length) toast('没识别到目的地，试试「川西」「云南」或「长沙」');
      proceed();
    }
  }

  /* ---------- 排期向导（4 步：起终点 → 环线 → 排序 → 排期） ---------- */
  function wizardOpen() {
    if (state.selected.length < 2) { toast('至少选 2 个景点才能排期'); return; }
    if (state.isLoop && state.start && state.start.name) state.end = state.start;
    /* 向导起终点兜底（输入框未失焦也能读到值） */
    var wsEl2 = $id('wStart'), weEl2 = $id('wEnd');
    if (wsEl2 && wsEl2.value) state.start = matchStart(wsEl2.value);
    if (weEl2 && weEl2.value) state.end = matchStart(weEl2.value);
    state.wiz = state.wiz || wizNew();
    $id('wizardBox').style.display = 'block';
    var cards = $id('stagePick').querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) cards[i].style.display = 'none';
    var sb = $id('summbar'); if (sb) sb.style.display = 'none';
    renderWizard();
  }
  window.plannerOpenWizard = wizardOpen;
  function renderWizard() {
    var w = state.wiz || (state.wiz = wizNew());
    var names = ['起终点', '环线', '排序', '排期'];
    var bar = names.map(function (nm, i) {
      var st = i + 1 === w.step ? 'background:var(--color-primary);color:var(--bg)' : (i + 1 < w.step ? 'background:var(--color-primary-soft);color:var(--color-primary-dark)' : 'background:var(--color-bg-soft);color:var(--color-muted)');
      return '<span class="chip" data-s="' + (i + 1) + '" style="' + st + ';cursor:pointer">' + (i + 1) + '. ' + nm + '</span>';
    }).join('');
    var body = '';
    if (w.step === 1) {
      body = '<div class="fld"><label>出发地（可不填，缺省=当前位置）</label><input type="text" id="wStart" placeholder="如：成都" value="' + esc(state.start ? state.start.name : '') + '"></div>' +
        '<div class="fld"><label>终到地（可不填，留空=单程）</label><input type="text" id="wEnd" placeholder="如：成都" value="' + esc(state.end ? state.end.name : '') + '"></div>';
    } else if (w.step === 2) {
      body = '<div class="fld"><label>是否环线</label><div class="row" style="gap:10px">' +
        '<button class="btn' + (state.isLoop ? ' primary' : '') + '" id="wLoopY" style="flex:1">是 · 回到起点</button>' +
        '<button class="btn' + (!state.isLoop ? ' primary' : '') + '" id="wLoopN" style="flex:1">否 · 单程</button></div>' +
        '<div style="font-size:var(--fs-3);color:var(--color-muted);margin-top:8px;line-height:1.6">环线：末站回到出发地，适合自驾往返；单程：终点即行程结束地。</div></div>';
    } else if (w.step === 3) {
      var nSel = state.selected.length, nPairs = nSel * (nSel - 1) / 2;
      body = '<div class="fld"><label>排序方式</label><div class="row" style="gap:10px">' +
        '<button class="btn' + (w.sortMode === 'geo' ? ' primary' : '') + '" id="wSortGeo" style="flex:1">按地理最近邻</button>' +
        '<button class="btn' + (w.sortMode === 'amap' ? ' primary' : '') + '" id="wSortAmap" style="flex:1">按高德路线</button></div>' +
        '<div style="font-size:var(--fs-3);color:var(--color-muted);margin-top:8px;line-height:1.6">' +
        (w.sortMode === 'amap'
          ? '按高德真实道路里程排序并计入日卡：当前 ' + nSel + ' 站需逐对查询 ' + nPairs + ' 段' + (nSel > AMAP_MAX_STOPS ? '，已超过上限 ' + AMAP_MAX_STOPS + ' 站，排期会自动退回地理最近邻' : '，免费 Key 配额下建议 ≤ ' + AMAP_MAX_STOPS + ' 站') + '。'
          : '按直线折算的地理邻近排序，不消耗高德配额；日卡里程仍按道路系数折算。') +
        '</div></div>' +
        '<div class="fld"><label>方向（排序完成后）</label><div class="row" style="gap:10px">' +
        '<button class="btn' + (w.sortOrder === 'asc' ? ' primary' : '') + '" id="wOrderAsc" style="flex:1">正序 · 从起点出发</button>' +
        '<button class="btn' + (w.sortOrder === 'desc' ? ' primary' : '') + '" id="wOrderDesc" style="flex:1">倒序 · 从远端返回</button></div></div>';
    } else {
      body = '<div style="font-size:var(--fs-4);line-height:2.1;padding:4px 2px">' +
        '<div>出发地：<b>' + (state.start && state.start.name ? esc(state.start.name) : '当前位置') + '</b></div>' +
        '<div>终到地：<b>' + (state.end && state.end.name ? esc(state.end.name) : '单程（不设终点）') + '</b></div>' +
        '<div>环线：<b>' + (state.isLoop ? '是 · 回到起点' : '否 · 单程') + '</b></div>' +
        '<div>排序：<b>' + (w.sortMode === 'amap' ? '高德路线' : '地理最近邻') + ' · ' + (w.sortOrder === 'desc' ? '倒序' : '正序') + '</b></div></div>';
    }
    var nav = '<div class="row" style="gap:8px;margin-top:14px">' +
      (w.step > 1 ? '<button class="btn" id="wBack" style="flex:1">上一步</button>' : '<button class="btn ghost" id="wCancel" style="flex:1">取消</button>') +
      (w.step < 4 ? '<button class="btn primary" id="wNext" style="flex:1">下一步</button>' : '<button class="btn primary" id="wDone" style="flex:1">开始排期</button>') +
      '</div>';
    $id('wizardBox').innerHTML = '<div class="card" style="margin-bottom:0"><div class="sec-title">排期设置</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + bar + '</div>' + body + nav + '</div>';
    /* 绑定步骤条 */
    var chips = $id('wizardBox').querySelectorAll('[data-s]');
    for (var ci = 0; ci < chips.length; ci++) (function (el) { el.onclick = function () { if (parseInt(el.getAttribute('data-s'), 10) <= w.step) { w.step = parseInt(el.getAttribute('data-s'), 10); renderWizard(); } }; })(chips[ci]);
    if (w.step === 1) {
      var wsEl = $id('wStart'), weEl = $id('wEnd');
      wsEl.onchange = function () { state.start = matchStart(this.value); };
      weEl.onchange = function () { state.end = matchStart(this.value); };
    } else if (w.step === 2) {
      $id('wLoopY').onclick = function () { state.isLoop = true; if (state.start && state.start.name) state.end = { name: state.start.name, lat: state.start.lat, lng: state.start.lng }; renderWizard(); };
      $id('wLoopN').onclick = function () { state.isLoop = false; renderWizard(); };
    } else if (w.step === 3) {
      $id('wSortGeo').onclick = function () { w.sortMode = 'geo'; renderWizard(); };
      $id('wSortAmap').onclick = function () { if (!getAmapKey()) { toast('按高德路线需要先在「我的地点」或设置里配置高德 Key，已改用地理最近邻'); w.sortMode = 'geo'; renderWizard(); return; } w.sortMode = 'amap'; renderWizard(); };
      $id('wOrderAsc').onclick = function () { w.sortOrder = 'asc'; renderWizard(); };
      $id('wOrderDesc').onclick = function () { w.sortOrder = 'desc'; renderWizard(); };
    }
    var nxt = $id('wNext'), bak = $id('wBack'), can = $id('wCancel'), don = $id('wDone');
    if (nxt) nxt.onclick = function () {
      /* 第 1 步：保存起终点（输入框将离开 DOM） */
      if (w.step === 1) {
        var s1 = $id('wStart'), e1 = $id('wEnd');
        if (s1 && s1.value) state.start = matchStart(s1.value);
        if (e1 && e1.value) state.end = matchStart(e1.value);
      }
      if (w.step < 4) { w.step++; renderWizard(); }
    };
    if (bak) bak.onclick = function () { if (w.step > 1) { w.step--; renderWizard(); } };
    if (can) can.onclick = function () { $id('wizardBox').style.display = 'none'; renderCandidates(); showStage('stagePick'); var c2 = $id('stagePick').querySelectorAll('.card'); for (var j = 0; j < c2.length; j++) c2[j].style.display = ''; var sb2 = $id('summbar'); if (sb2 && state.selected.length >= 2) sb2.style.display = ''; };
    if (don) don.onclick = doSchedule;
    persistState();
  }

  window.plannerGenerate = doGenerate;
  var scheduling = false;
  /* 排期入口。此前向导选「按高德路线」只是把 preserveOrder 置真——既不取矩阵也不按真实道路排序，
     是个假控件：用户以为按导航里程排了线，拿到的仍是选点顺序 + 直线折算的日卡。
     现在这条路真的取矩阵，并把矩阵交给分日与日卡（同一把尺子），选点弹层取过的直接复用。 */
  function doSchedule() {
    if (state.selected.length < 2) { toast('至少选 2 个景点才能排期'); return; }
    state.days = parseInt(($id('intentDays') && $id('intentDays').value) || state.days || 0, 10) || 0;
    state.startDate = $id('intentDate') ? $id('intentDate').value : '';
    var w = state.wiz || wizNew();
    if (w.sortMode !== 'amap') { commitSchedule(null, w); return; }
    var cached = state.matrix && state.matrix.sig === picksSig(state.selected) ? state.matrix.dist : null;
    if (cached) { commitSchedule(cached, w); return; }
    if (!getAmapKey()) { toast('按高德路线需要高德 Key（设置页可配置），本次按地理最近邻排期'); commitSchedule(null, w); return; }
    if (state.selected.length > AMAP_MAX_STOPS) { toast(overCapMsg(state.selected.length)); commitSchedule(null, w); return; }
    if (scheduling) return;
    scheduling = true;
    var btn = $id('wDone');
    if (btn) { btn.disabled = true; btn.textContent = '真实里程取数中…'; }
    fetchDistMatrix(state.selected, function (dist, failed) {
      scheduling = false;
      if (btn) { btn.disabled = false; btn.textContent = '开始排期'; }
      var got = Object.keys(dist).length;
      if (failed) toast(amapCoverageText(got, got + failed));
      commitSchedule(dist, w);
    });
  }
  function commitSchedule(matrix, w) {
    /* amapSorted=已经按真实道路/AI 精选排过序，不再打乱人工顺序 */
    var ordered = state.amapSorted ? state.selected.slice()
      : (matrix ? orderByMatrix(state.selected, state.start, matrix) : orderStops(state.selected, state.start));
    if (w.sortOrder === 'desc') ordered = ordered.slice().reverse();
    var days = splitIntoDays(ordered, state.start, state.days, state.end, mkLeg(matrix));
    var name = (state.regions.join('/') || '旅行') + ' ' + days.length + ' 日' + (state.prefs.length ? state.prefs.join('·') : '') + '之旅';
    state.trip = { id: 'p' + Date.now(), name: name, createdAt: Date.now(), start: state.start, end: state.end, startDate: state.startDate, aiLevel: getAILevel(), days: days, dist: matrix || null, narrative: null };
    showStage('stageResult'); renderResult();
  }
  window.plannerSchedule = doSchedule;

  /* 种子：从想去清单 */
  function seedFromWish() {
    var wl = window.Wish.list().filter(function (x) { return !x.visited && x.lat != null; });
    if (wl.length < 2) { toast('先去地图收藏至少 2 处想去的地方'); return; }
    state.candidates = wl.map(function (w) { return { name: w.label, label: w.label, region: w.region, city: w.city, theme: w.theme, flag: '', lat: w.lat, lng: w.lng, gcj: !!w.gcj }; });
    state.wishPool = state.candidates.slice();
    state.selected = state.candidates.slice();
    state.fromWish = true; state.regions = []; state.prefs = []; state.autoPrefs = []; state.amapSorted = false; state.days = 0;
    renderIntent(); doRecall(); showStage('stagePick');
  }
  window.plannerSeedWish = seedFromWish;

  /* ---------- 初始化 ---------- */
  function init() {
    try { var pi = $id('promptInput'); if (pi && pi.value && !pi.value.trim()) pi.value = ''; } catch (e) {}
    try { getAmapKey(); } catch (e) {}
    renderAISwitch();
    renderDestChips();
    $id('genBtn').onclick = doGenerate;
    $id('promptInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') doGenerate(); });
    $id('seedWish').onclick = seedFromWish;
    $id('seedExample').onclick = function () {
      $id('promptInput').value = '我想去川西玩5天，喜欢自然风光';
      doGenerate();
    };
    var aiBtns = $id('aiSwitch').querySelectorAll('button');
    for (var i = 0; i < aiBtns.length; i++) aiBtns[i].onclick = function () { setAILevel(this.getAttribute('data-level')); };
    $id('scheduleBtn').onclick = wizardOpen;
    /* AI 精选路线：表单绑定 + 生成 */
    (function () {
      var b = $id('arBtn'); if (!b) return;
      ['arTrans', 'arPref'].forEach(function (id) {
        var box = $id(id);
        box.addEventListener('click', function (e) {
          var c = e.target.closest ? e.target.closest('.chip') : null; if (!c) return;
          box.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', x === c); });
        });
      });
      function collectForm() {
        var dest = $id('arDest').value.trim();
        if (!dest) { toast('先告诉 AI 想去哪个省或城市'); return null; }
        var days = parseInt($id('arDays').value, 10) || 5;
        days = Math.max(1, Math.min(15, days));
        var trans = ($id('arTrans').querySelector('.chip.on') || { getAttribute: function () { return '自驾'; } }).getAttribute('data-t');
        var pref = ($id('arPref').querySelector('.chip.on') || { getAttribute: function () { return '必去'; } }).getAttribute('data-p');
        return { dest: dest, days: days, trans: trans, pref: pref };
      }
      function generateOnce(f) {
        return new Promise(function (resolve) { aiPlanRoutes(f.dest, f.days, f.trans, f.pref, function (routes) { resolve(routes || null); }); });
      }
      function commitRoutes(f, routes) {
        arData = { dest: f.dest, days: f.days, trans: f.trans, pref: f.pref, regions: matchRegions(f.dest), routes: routes };
        renderAiRoutes();
        $id('aiRouteOut').scrollIntoView({ behavior: UI.scrollBehavior(), block: 'start' });
      }
      function busyBtn(on) { b.disabled = on; b.innerHTML = on ? TI('globe') + 'AI 上网检索中…' : TI('sparkles') + '上网查询 · 生成 5 条备选路线'; }
      /* P1-8 状态矩阵（批次6）：AI 生成失败=可重试错误卡，不再只 toast 一闪而过 */
      function showGenError(f) {
        var out = $id('aiRouteOut'); out.style.display = 'block';
        if (window.UI && UI.errorBox) {
          UI.errorBox(out, {
            title: '路线生成失败',
            text: 'AI 没有返回有效路线，可能是网络不稳或目的地太冷门。换个说法，或点按重试再生成一次。',
            retryText: '重新生成',
            onRetry: function () {
              busyBtn(true);
              return generateOnce(f).then(function (routes) {
                busyBtn(false);
                if (routes) { commitRoutes(f, routes); return true; }
                return false;   /* 保留卡片、复位按钮，用户可再点 */
              });
            }
          });
        } else toast('AI 没有返回有效路线，换个目的地或稍后再试');
      }
      b.onclick = function () {
        if (!window.Ai.hasKey()) { toast('请先在「设置 → AI 助手」配置站点与 Key'); return; }
        var f = collectForm(); if (!f) return;
        busyBtn(true);
        generateOnce(f).then(function (routes) {
          busyBtn(false);
          if (!routes) { showGenError(f); return; }
          commitRoutes(f, routes);
        });
      };
    })();
    var cf = $id('candFilter');
    if (cf) { var cfT = null; cf.oninput = function () { var v = this.value; clearTimeout(cfT); cfT = setTimeout(function () { state.candFilter = v; renderCandidates(); }, 250); }; }
    /* 恢复上次规划进度（WebView 返回键/刷新丢失后） */
    try {
      var snap = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null');
      if (snap && snap.candidates && snap.candidates.length && (snap.stage === 'stagePick' || snap.stage === 'stageResult')) {
        Object.keys(snap).forEach(function (k) { if (k !== 'stage') state[k] = snap[k]; });
        renderIntent();
        if (snap.stage === 'stageResult' && snap.trip) { showStage('stageResult'); renderResult(); }
        else { renderCandidates(); showStage('stagePick'); }
        toast('已恢复上次规划进度');
      }
    } catch (e) {}
    try { if (window.TravelNotes && TravelNotes.init) TravelNotes.init({}); } catch (e) {}
    /* 从「想去清单」跳来：自动带入未打卡心愿，消除两步跳转 */
    try {
      if (/[?&]from=wish/.test(location.search)) {
        var _wl = (window.Wish && Wish.list) ? Wish.list().filter(function (x) { return !x.visited && x.lat != null; }) : [];
        if (_wl.length >= 2) {
          setTimeout(function () { seedFromWish(); toast('已带入 ' + _wl.length + ' 处心愿，可直接排期'); }, 60);
        } else if (_wl.length === 1) {
          toast('心愿节点不足 2 处，请先在地图多收藏几处');
        }
      }
    } catch (e) {}
    renderTrips();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
