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
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
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
  function prefHit(p, t) { var n = normTheme(t); return PREF[p].themes.indexOf(n) >= 0; }

  /* ---------- 主题 → 颜色 / 时长 ---------- */
  var THEME_COLOR = { '高原湖泊': '#5F6D76', '雪山冰川': '#9C9A92', '名山大川': '#71806C', '峡谷天堑': '#8A5A44', '江河瀑布': '#5F6D76', '古建寺院': '#A9563B', '古城古镇': '#8A5A44', '古城遗址': '#7E7663', '红色遗迹': '#C86D4B', '民族风情': '#C86D4B', '城市地标': '#6D7D88', '溶洞奇观': '#8C7B66', '森林草原': '#71806C', '森林山川': '#71806C', '宗教圣地': '#A9563B', '遗址陵墓': '#7E7663', '温泉康养': '#C86D4B', '石窟艺术': '#A9563B', '丹霞地貌': '#BA7517', '雅丹地貌': '#BA7517', '沙漠戈壁': '#BA7517', '草原湿地': '#639922', '寺庙': '#A9563B', '古塔': '#7E7663', '草原': '#639922', '冰川': '#9C9A92' };
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
    if (l === 'narrate' || l === 'full') { if (!window.Ai.hasKey()) { toast('请先在「设置」里配置 AI Key'); return; } }
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
      hint.style.cssText = 'font-size:11px;color:var(--color-muted);margin:-4px 0 12px;line-height:1.6';
      el.parentNode.insertBefore(hint, el.nextSibling);
    }
    if (hint) hint.textContent = noKey ? '未配置 AI Key，仅规则模式（去「设置」填入后可启用叙事/全量）' : '';
  }

  /* ---------- 状态 ---------- */
  var state = { regions: [], days: 0, prefs: [], start: null, startDate: '', candidates: [], selected: [], trip: null, fromWish: false, candFilter: '' };
  function nodeUid(s) { return (window.Wish ? Wish.uid(s) : String((s.name || s.label || '') + '|' + s.lat + '|' + s.lng)); }
  function isSelected(s) { var u = nodeUid(s); return state.selected.some(function (x) { return nodeUid(x) === u; }); }

  /* ---------- 意图解析（规则先行） ---------- */
  function parseIntent(text) {
    var t = (text || '').trim();
    var intent = { regions: matchRegions(t), days: 0, prefs: [], raw: t };
    var m = t.match(/(\d+)\s*[天日]/); if (m) intent.days = parseInt(m[1], 10);
    PREF_KEYS.forEach(function (p) { var kw = PREF[p].kw; for (var i = 0; i < kw.length; i++) if (t.indexOf(kw[i]) >= 0) { intent.prefs.push(p); break; } });
    return intent;
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
        var isHit = !prefs || !prefs.length || prefs.some(function (p) { return prefHit(p, s.theme); });
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
        added.push({ name: p.name, label: p.name, region: state.regions[0], city: '', county: '', theme: intent.prefs[0] || '其他', flag: '', lat: p.lat, lng: p.lng, __poi: true });
      });
      if (added.length) { state.candidates = state.candidates.concat(added); renderCandidates(); toast('已补充 ' + added.length + ' 处高德临时点'); }
    });
  }

  /* ---------- 排期（贪心最近邻 + 时间模型） ---------- */
  function legEst(a, b) { var km = window.Geo.hav(a.lat, a.lng, b.lat, b.lng) * 1.35; return { km: km, h: km / 48 }; }
  /* 最近邻排序（保留起点的近似顺序） */
  function orderStops(sel, start) {
    var pts = sel.slice(), ordered = [];
    var cur = (start && start.lat != null) ? start : null;
    while (pts.length) {
      var idx = 0, bestD = Infinity;
      for (var k = 0; k < pts.length; k++) { var d = cur ? window.Geo.hav(cur.lat, cur.lng, pts[k].lat, pts[k].lng) : 0; if (d < bestD) { bestD = d; idx = k; } }
      var nx = pts.splice(idx, 1)[0]; ordered.push(nx); cur = nx;
    }
    return ordered;
  }
  /* 把已排序的站按预算切分到天（targetDays 为软目标，站数/天数摊开） */
  function splitIntoDays(ordered, start, targetDays) {
    var MAX_KM = 260, MAX_H = 12;
    var maxStops = 6;
    if (targetDays && targetDays > 0) maxStops = Math.max(1, Math.min(6, Math.ceil(ordered.length / targetDays)));
    var days = [], day = null, prev = start && start.lat != null ? start : null;
    function newDay() { day = { stops: [], driveKm: 0, driveH: 0, playH: 0 }; days.push(day); }
    ordered.forEach(function (s) {
      var leg = prev ? legEst(prev, s) : { km: 0, h: 0 };
      var ph = playH(s);
      if (!day) newDay();
      var tStops = day.stops.length + 1, tKm = day.driveKm + leg.km, tH = day.driveH + day.playH + leg.h + ph + (tStops - 1) * 0.5 + 2.5;
      if (day.stops.length && (tStops > maxStops || tKm > MAX_KM || tH > MAX_H)) { newDay(); leg = prev ? legEst(prev, s) : { km: 0, h: 0 }; ph = playH(s); }
      day.stops.push(s); day.driveKm += leg.km; day.driveH += leg.h; day.playH += ph;
      prev = s;
    });
    days.forEach(function (dd) { dd.totalH = dd.driveH + dd.playH + (dd.stops.length - 1) * 0.5 + 2.5; });
    return days;
  }
  function schedule(sel, start, targetDays) { return splitIntoDays(orderStops(sel, start), start, targetDays); }

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
    var first = days[0].stops[0].name;
    var lastD = days[days.length - 1], last = lastD.stops[lastD.stops.length - 1].name;
    return { story: '从' + first + '出发，一路走到' + last + '，' + days.length + '天的旅程。', dayThemes: days.map(function (d, i) { return '第' + (i + 1) + '天'; }) };
  }
  function narrate(days, cb) {
    if (getAILevel() === 'off' || !window.Ai.hasKey()) { cb(templateNarrative(days)); return; }
    var lines = days.map(function (d, i) { return 'Day' + (i + 1) + ': ' + d.stops.map(function (s) { return s.name; }).join(' → '); });
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

  /* ========================================================= */
  /*  渲染                                                       */
  /* ========================================================= */
  function showStage(name) {
    ['stageInput', 'stagePick', 'stageResult'].forEach(function (n) { $id(n).style.display = n === name ? 'block' : 'none'; });
    window.scrollTo(0, 0);
  }

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
    state.regions = r ? [r] : []; state.prefs = []; state.days = state.days || 0; state.fromWish = false;
    renderIntent(); doRecall();
  };

  /* 阶段二：意图卡 + 候选 */
  function renderIntent() {
    buildDicts();
    var h = '';
    h += '<div class="fld"><label>目的地（可增删，留空=不限）</label><div class="chips" id="intentRegions"></div></div>';
    h += '<div class="fld"><label>天数</label><div class="row"><input type="number" id="intentDays" min="1" max="30" value="' + (state.days || 5) + '"> <button class="btn ghost" onclick="window.plannerPickRegion(\'\')">不限目的地</button></div></div>';
    h += '<div class="fld"><label>偏好</label><div class="chips" id="intentPrefs"></div></div>';
    h += '<div class="fld"><label>出发地（缺省当前位置）</label><div class="row"><input type="text" id="intentStart" placeholder="如：成都"><button class="btn ghost" id="useLocBtn">📍 当前位置</button></div></div>';
    h += '<div class="fld"><label>出发日期（用于季节提醒，可空）</label><input type="date" id="intentDate" value="' + esc(state.startDate || '') + '"></div>';
    h += '<div id="aiEnhBar"></div>';
    $id('intentCard').innerHTML = '<div class="sec-title">这趟怎么玩</div>' + h;
    /* 目的地 chips */
    var all = Object.keys(regionSet || {});
    var rc = all.map(function (r) { return '<span class="chip' + (state.regions.indexOf(r) >= 0 ? ' on' : '') + '" onclick="window.plannerToggleRegion(\'' + esc(r) + '\')">' + esc(r) + '</span>'; }).join('');
    $id('intentRegions').innerHTML = rc;
    /* 偏好 chips */
    var pc = PREF_KEYS.map(function (p) { return '<span class="chip' + (state.prefs.indexOf(p) >= 0 ? ' on' : '') + '" onclick="window.plannerTogglePref(\'' + esc(p) + '\')">' + p + '</span>'; }).join('');
    $id('intentPrefs').innerHTML = pc;
    /* 绑定 */
    $id('intentDays').onchange = function () { state.days = parseInt(this.value, 10) || 0; };
    $id('intentDate').onchange = function () { state.startDate = this.value; };
    $id('intentStart').onchange = function () { state.start = matchStart(this.value); };
    $id('useLocBtn').onclick = function () {
      if (!navigator.geolocation) { toast('当前环境不支持定位'); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        state.start = { name: '我的位置', lat: p.coords.latitude, lng: p.coords.longitude };
        $id('intentStart').value = '我的位置';
        toast('已设为当前位置');
      }, function () { toast('定位失败，可手动输入出发地'); }, { timeout: 8000 });
    };
    /* 目的地/偏好变化后重召回 */
    state.__bound = true;
  }
  window.plannerToggleRegion = function (r) {
    var i = state.regions.indexOf(r);
    if (i >= 0) state.regions.splice(i, 1); else state.regions.push(r);
    renderIntent(); doRecall();
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
    return null;
  }
  function resolveRegionName(name) {
    if (!name) return null;
    buildDicts();
    if (regionSet[name]) return name;
    var b = String(name).replace(/省$/, '').replace(/市$/, '').replace(/壮族自治区$/, '').replace(/回族自治区$/, '').replace(/维吾尔自治区$/, '').replace(/自治区$/, '').replace(/特别行政区$/, '');
    return regionSet[b] ? b : null;
  }
  function doRecall() {
    var intent = { regions: state.regions, days: state.days, prefs: state.prefs };
    state.widenMsg = null;
    state.candidates = state.fromWish ? state.candidates : recall(intent);
    state.selected = state.selected.filter(function (s) { return state.candidates.some(function (c) { return nodeUid(c) === nodeUid(s); }); });
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
    var card = $id('candCard'), bar = $id('summbar');
    if (!c.length) { card.style.display = 'none'; bar.style.display = 'none'; return; }
    card.style.display = 'block';
    var q = (state.candFilter || '').trim().toLowerCase();
    var list = q ? c.filter(function (s) { return (s.name + ' ' + s.theme + ' ' + s.city + ' ' + s.region + ' ' + (s.county || '')).toLowerCase().indexOf(q) >= 0; }) : c;
    $id('candTitle').textContent = '候选景点 · ' + (q ? list.length + ' / ' + c.length : c.length) + ' 处';
    var hint = $id('candHint');
    if (hint) { if (state.widenMsg) { hint.style.display = 'block'; hint.textContent = 'ℹ️ ' + state.widenMsg; } else hint.style.display = 'none'; }
    $id('candList').innerHTML = list.map(function (s) {
      var on = isSelected(s);
      return '<div class="cand' + (on ? ' on' : '') + '" onclick="window.plannerToggleCand(\'' + esc(nodeUid(s)) + '\')">' +
        '<span class="ck">' + (on ? '✓' : '') + '</span>' +
        '<span class="dot" style="background:' + themeColor(s.theme) + '"></span>' +
        '<span class="main"><b>' + esc(s.name) + (s.flag && s.flag.indexOf('m') >= 0 ? '<span class="bdg bdg-m">必去</span>' : '') + (s.flag && s.flag.indexOf('h') >= 0 ? '<span class="bdg bdg-h">网红</span>' : '') + (s.__novelty ? '<span class="bdg bdg-n">✨换个不一样的</span>' : '') + (s.__poi ? '<span class="bdg" style="background:var(--color-muted);color:#fff">临时</span>' : '') + '</b>' +
        '<small>' + esc([s.region, s.city].filter(Boolean).join(' · ')) + (s.theme ? ' · ' + esc(s.theme) : '') + '</small></span></div>';
    }).join('');
    renderSumm();
  }
  window.plannerToggleCand = function (uid) {
    var hit = state.selected.filter(function (x) { return nodeUid(x) === uid; });
    if (hit.length) state.selected = state.selected.filter(function (x) { return nodeUid(x) !== uid; });
    else { var s = state.candidates.filter(function (x) { return nodeUid(x) === uid; })[0]; if (s) state.selected.push(s); }
    renderCandidates();
  };
  function estimateDays() { return Math.max(1, Math.ceil(state.selected.length / 6)); }
  function renderSumm() {
    var bar = $id('summbar');
    if (!state.selected.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    $id('summInfo').innerHTML = '已选 <b>' + state.selected.length + '</b> 站 · 预计 <b>' + estimateDays() + '</b> 天';
  }

  /* 阶段三：结果 */
  function renderDaysBody() {
    var trip = state.trip; if (!trip) return;
    var days = trip.days;
    var DAY_COLORS = ['#C86D4B', '#71806C', '#6D7D88', '#8A6D3B', '#7E7663', '#5F6D76'];
    var h = '<div style="font-size:12px;color:var(--color-muted);margin-bottom:4px">' +
      '按地理邻近自动分日，耗时含路程+游玩+休息+用餐（±2h 误差）；' + (trip.start && trip.start.name ? '出发地 ' + esc(trip.start.name) : '') + (trip.startDate ? ' · ' + esc(trip.startDate) : '') + '</div>';
    days.forEach(function (d, di) {
      var over = d.totalH > 12;
      h += '<div class="day-card"><div class="dhead"><b style="color:' + DAY_COLORS[di % DAY_COLORS.length] + '">D' + (di + 1) + '</b>' +
        '<span>' + d.stops.length + ' 站 · 约 ' + Math.round(d.driveKm) + ' km · 游玩 ' + d.playH.toFixed(1) + 'h · 全程 ' + d.totalH.toFixed(1) + 'h</span>' +
        '<button class="btn" style="min-height:30px;padding:0 12px;font-size:12px" onclick="window.plannerNavDay(' + di + ')">🚗 导航</button></div>';
      if (over) h += '<div class="warnline">⚠️ 该日预计 ' + d.totalH.toFixed(0) + ' 小时，偏赶，建议减 1~2 站</div>';
      d.stops.forEach(function (s, si) {
        var det = detailCache[s.name];
        var warn = seasonWarn(det && det.best, trip.startDate);
        h += '<div class="stop' + (warn ? ' warn' : '') + (s.done ? ' done' : '') + '"><span class="n">' + (si + 1) + '</span>' +
          '<span class="lbl">' + (s.done ? '✓ ' : '') + esc(s.name) + '</span>' +
          (det && det.best ? '<span class="meta">' + esc(det.best) + '</span>' : '') +
          (warn ? '<span class="warn-ic" title="' + esc(warn) + '">⚠️</span>' : '') +
          (state.travelMode ? '<button class="btn" style="min-height:26px;padding:0 10px;font-size:11px;flex:0 0 auto" onclick="window.plannerCheckinStop(' + di + ',' + si + ')">' + (s.done ? '已打卡' : '记一笔') + '</button>' : '') +
          '<span class="meta" style="margin-left:6px">' + playH(s) + 'h</span>' +
          '<button class="mv" aria-label="上移" onclick="window.plannerMoveStop(' + di + ',' + si + ',-1)">↑</button>' +
          '<button class="mv" aria-label="下移" onclick="window.plannerMoveStop(' + di + ',' + si + ',1)">↓</button>' +
          '<button class="mv" aria-label="移除" onclick="window.plannerRemoveStop(' + di + ',' + si + ')">✕</button></div>';
      });
    });
    $id('resultBody').innerHTML = h;
  }
  function renderNarrative(n) {
    $id('narrBox').innerHTML = '<div style="font-size:11px;color:var(--color-muted);margin-bottom:6px">AI 行程故事</div>' +
      '<div class="story">' + esc(n.story) + '</div>' +
      (n.dayThemes && n.dayThemes.length ? '<div class="themes">' + n.dayThemes.map(function (t, i) { return 'D' + (i + 1) + ' · ' + esc(t); }).join('　') + '</div>' : '');
  }
  function renderResult() {
    var trip = state.trip; if (!trip) return;
    var days = trip.days;
    $id('resultTitle').textContent = trip.name + ' · ' + days.length + ' 天 · ' + days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站';
    var totalKm = days.reduce(function (s, d) { return s + d.driveKm; }, 0);
    $id('resultTitle').textContent += ' · 约 ' + Math.round(totalKm) + ' km';
    renderDaysBody();
    $id('actRow').innerHTML =
      '<button class="btn" onclick="window.plannerStartTrip()">▶ 开始旅行</button>' +
      '<button class="btn" onclick="window.plannerSaveTrip()">💾 保存行程</button>' +
      '<button class="btn" onclick="window.plannerAddAllWish()">⭐ 加入想去清单</button>' +
      '<button class="btn" onclick="window.plannerCopyPlan()">📋 复制计划</button>' +
      '<button class="btn" onclick="window.plannerExportGPX()">导出 GPX</button>' +
      '<button class="btn" onclick="window.plannerBuildBook()">📖 导出路书</button>' +
      '<button class="btn" onclick="window.plannerBuildAlbum()">📔 生成纪念册</button>' +
      '<button class="btn" onclick="window.plannerReschedule()">↻ 重新排期</button>' +
      '<button class="btn ghost" onclick="window.plannerEditPick()">✏️ 编辑选点</button>' +
      '<button class="btn ghost" onclick="window.plannerOpenFootprint()">🗺 足迹地图</button>';
    renderMap();
    var nb = $id('narrBox');
    nb.style.display = 'block';
    if (trip.narrative && trip.narrative.story) {
      renderNarrative(trip.narrative);
    } else {
      nb.innerHTML = '<div style="font-size:11px;color:var(--color-muted);margin-bottom:6px">' + (getAILevel() === 'off' ? 'AI 叙事（关）' : 'AI 叙事中…') + '</div>';
      narrate(days, function (n) { if (!n) return; trip.narrative = n; renderNarrative(n); });
    }
    /* 季节校验：懒加载分省详情后重渲染 stop 区（不打断叙事/地图） */
    var need = {};
    days.forEach(function (d) { d.stops.forEach(function (s) { need[s.region] = 1; }); });
    Object.keys(need).forEach(function (r) { loadProvinceDetail(r, renderDaysBody); });
    renderTrips();
  }

  /* 地图 */
  var map = null, mapLayer = null;
  function renderMap() {
    var trip = state.trip; if (!trip) return;
    var pts = [];
    trip.days.forEach(function (d) { d.stops.forEach(function (s) { pts.push(s); }); });
    if (!pts.length) return;
    if (!map) { map = L.map('mapBox', { zoomControl: false }).setView([34.5, 105], 5); L.control.zoom({ position: 'bottomright' }).addTo(map); var tl = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德' }).addTo(map); if (window.UI) UI.tileWarn(tl, '地图'); mapLayer = L.layerGroup().addTo(map); }
    map.invalidateSize();
    mapLayer.clearLayers();
    var bnd = [], seq = [];
    if (trip.start && trip.start.lat != null) seq.push(trip.start);
    seq = seq.concat(pts);
    for (var i = 1; i < seq.length; i++) {
      var a = [seq[i - 1].lat, seq[i - 1].lng], b = [seq[i].lat, seq[i].lng];
      if (a[0] == null || b[0] == null) continue;
      bnd.push(a, b);
      L.polyline([a, b], { color: '#C86D4B', weight: 3, opacity: .8, dashArray: '7 7' }).addTo(mapLayer);
    }
    pts.forEach(function (s, i) {
      if (s.lat == null) return;
      var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: '<div style="position:relative;width:26px;height:26px"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;background:#C86D4B;color:#fff;font-size:10.5px;font-weight:700;border:2px solid #fff">' + (i + 1) + '</span></div>', iconSize: [26, 26], iconAnchor: [13, 13] }) });
      m.bindPopup('<b>' + esc(s.name) + '</b><br>' + esc(s.region || '') + (s.city ? ' · ' + esc(s.city) : ''));
      mapLayer.addLayer(m);
    });
    if (bnd.length > 1) map.fitBounds(bnd, { padding: [40, 40] });
    else if (bnd.length === 1) map.setView(bnd[0], 9);
  }

  /* ---------- 落地动作 ---------- */
  function flatStops() { var r = []; (state.trip && state.trip.days || []).forEach(function (d) { d.stops.forEach(function (s) { r.push(s); }); }); return r; }
  window.plannerCopyPlan = function () {
    var t = state.trip; if (!t) return;
    var txt = '🚗 行程计划（行迹 TRACE）· ' + t.name + '\n';
    t.days.forEach(function (d, i) { txt += 'Day' + (i + 1) + '：' + d.stops.map(function (s) { return s.name; }).join(' → ') + '\n'; });
    copyText(txt);
  };
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
  window.plannerSaveTrip = function () {
    var t = state.trip; if (!t) return;
    t.id = t.id || ('p' + Date.now());
    var list = loadTrips();
    list.unshift(t);
    try { localStorage.setItem('tn_trips', JSON.stringify(list)); } catch (e) {}
    toast('已保存行程「' + t.name + '」');
    renderTrips();
  };
  window.plannerAddAllWish = function () {
    var pts = flatStops();
    if (!window.Wish) return;
    var added = 0;
    pts.forEach(function (s) { if (Wish.toggle({ name: s.name, label: s.name, theme: s.theme, region: s.region, city: s.city, lat: s.lat, lng: s.lng })) added++; });
    toast('已加入想去清单 ' + added + ' 处');
  };
  /* ---------- 一键成册（路书 + 纪念册，行程维度，就地生成） ---------- */
  function docShell(name, body) {
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(name) + '</title><style>' +
      'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:640px;margin:0 auto;padding:24px 20px;color:#26241F;line-height:1.85;background:#F6F3EC}' +
      'h1{font-family:"Songti SC",serif;font-weight:400;font-size:26px}h2{font-family:"Songti SC",serif;font-weight:400;font-size:18px;border-left:3px solid #C86D4B;padding-left:10px;margin:26px 0 8px}' +
      '.muted{color:#8C877D;font-size:12px}.story{background:#FFFDF8;border:1px solid #E3DED2;padding:14px;border-radius:12px;font-family:"Songti SC",serif;margin:12px 0}' +
      '.note{border-bottom:1px solid #E3DED2;padding:12px 0}.note:last-child{border-bottom:0}' +
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
      h += '<h2>Day ' + (di + 1) + (trip.narrative && trip.narrative.dayThemes && trip.narrative.dayThemes[di] ? ' · ' + esc(trip.narrative.dayThemes[di]) : '') + '</h2><div class="muted">约 ' + Math.round(d.driveKm) + ' km · 全程约 ' + d.totalH.toFixed(1) + 'h</div>';
      d.stops.forEach(function (s, si) { h += '<div>' + (si + 1) + '. ' + esc(s.name) + (s.city ? ' <span class="muted">' + esc(s.city) + '</span>' : '') + (s.done ? ' ✓' : '') + '</div>'; });
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
  window.plannerNavDay = function (di) {
    var t = state.trip; if (!t || !t.days[di]) return;
    var d = t.days[di];
    var gcj = function (p) { if (!p) return null; try { var g = window.Geo.gcj02Of(p.lat, p.lng); return [g[1], g[0]]; } catch (e) { return [p.lng, p.lat]; } };
    var start = gcj(d.stops[0]), dest = gcj(d.stops[d.stops.length - 1]);
    if (!start || !dest) { toast('站点缺少坐标'); return; }
    var ways = d.stops.slice(1, -1).map(gcj).filter(Boolean);
    var deep = 'amapuri://route/plan/?sourceApplication=' + encodeURIComponent('行迹') + '&slat=' + start[1] + '&slon=' + start[0] + '&sname=' + encodeURIComponent(d.stops[0].name) + '&dlat=' + dest[1] + '&dlon=' + dest[0] + '&dname=' + encodeURIComponent(d.stops[d.stops.length - 1].name) + '&dev=0&t=0';
    if (ways.length) deep += '&vian=' + ways.length + '&vialons=' + ways.map(function (w) { return w[0]; }).join('|') + '&vialats=' + ways.map(function (w) { return w[1]; }).join('|');
    var web = 'https://uri.amap.com/navigation?from=' + start[0] + ',' + start[1] + ',' + encodeURIComponent(d.stops[0].name) + '&to=' + dest[0] + ',' + dest[1] + ',' + encodeURIComponent(d.stops[d.stops.length - 1].name) + '&mode=car&policy=1&src=' + encodeURIComponent('行迹') + '&coordinate=gaode&callnative=1';
    if (ways.length) web += '&waypoints=' + ways.map(function (w) { return w[0] + ',' + w[1]; }).join(';');
    if (/GuJianApp/.test(navigator.userAgent)) { window.location.href = deep; return; }
    var t0 = Date.now(); window.location.href = deep;
    setTimeout(function () { if (Date.now() - t0 < 2200) window.location.href = web; }, 1900);
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
    try { localStorage.setItem('tn_trips', JSON.stringify(list)); } catch (e) {}
  }
  /* ---------- 排期编辑：移除 / 上下移 / 重新排期（保留手工顺序，仅重新切分） ---------- */
  function resplitTrip() {
    var flat = flatStops();
    if (!flat.length) { state.trip = null; showStage('stagePick'); return; }
    state.trip.days = splitIntoDays(flat, state.trip.start, state.days);
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
    state.trip.days = splitIntoDays(flat, state.trip.start, state.days);
    persistTrip(); renderDaysBody(); renderMap();
  };
  window.plannerReschedule = function () {
    var flat = flatStops();
    if (flat.length < 2) { toast('站点太少，无法重新排期'); return; }
    state.trip.days = schedule(flat, state.trip.start, state.days);
    state.trip.narrative = null;
    renderResult();
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
  function renderTrips() {
    var list = loadTrips(); if (!list.length) { $id('tripsCard').style.display = 'none'; return; }
    $id('tripsCard').style.display = 'block';
    $id('tripsList').innerHTML = list.map(function (t, i) {
      return '<div class="cand"><span class="dot" style="background:var(--color-primary)"></span><span class="main"><b>' + esc(t.name) + '</b><small>' + esc(t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '') + ' · ' + t.days.length + ' 天 · ' + t.days.reduce(function (s, d) { return s + d.stops.length; }, 0) + ' 站</small></span>' +
        '<button class="btn" style="min-height:30px;padding:0 12px;font-size:12px" onclick="window.plannerOpenTrip(' + i + ')">打开</button>' +
        '<button class="btn ghost" style="min-height:30px;padding:0 10px;font-size:12px;color:var(--color-faint)" onclick="window.plannerDelTrip(' + i + ')">✕</button></div>';
    }).join('');
  }
  window.plannerOpenTrip = function (i) {
    var list = loadTrips(); if (!list[i]) return;
    state.trip = list[i]; showStage('stageResult'); renderResult();
  };
  window.plannerDelTrip = function (i) {
    var list = loadTrips(); list.splice(i, 1);
    try { localStorage.setItem('tn_trips', JSON.stringify(list)); } catch (e) {}
    renderTrips();
  };

  /* ---------- 主流程 ---------- */
  function doGenerate() {
    var text = $id('promptInput').value.trim();
    if (!text) { toast('先告诉我你想去哪、玩几天'); return; }
    var intent = parseIntent(text);
    state.regions = intent.regions; state.days = intent.days; state.prefs = intent.prefs; state.fromWish = false; state.selected = [];
    state.startDate = '';
    var proceed = function () {
      renderIntent(); doRecall(); showStage('stagePick');
      if (getAILevel() === 'full') {
        aiEnhance(text, function (j) {
          var bar = $id('aiEnhBar');
          var parts = [j.pace && ('节奏·' + j.pace), j.companions && ('同伴·' + j.companions), j.vibe].filter(Boolean);
          if (parts.length) bar.innerHTML = '<div style="margin:10px 0;padding:9px 12px;border-radius:10px;font-size:12.5px;background:var(--color-primary-soft);color:var(--color-primary-dark)">✨ AI 补充：' + esc(parts.join('；')) + '</div>';
        });
      }
    };
    if (!state.regions.length && getAILevel() === 'full' && window.Ai.hasKey()) {
      aiParseIntent(text, function (j) {
        if (j && j.regions.length) { state.regions = j.regions; if (j.days) state.days = j.days; toast('AI 已识别目的地：' + j.regions.join('、')); }
        else toast('没识别到目的地，试试「川西」「云南」或「长沙」');
        proceed();
      });
    } else {
      if (!state.regions.length) toast('没识别到目的地，试试「川西」「云南」或「长沙」');
      proceed();
    }
  }
  window.plannerGenerate = doGenerate;
  function doSchedule() {
    if (state.selected.length < 2) { toast('至少选 2 个景点才能排期'); return; }
    state.days = parseInt(($id('intentDays') && $id('intentDays').value) || state.days || 0, 10) || 0;
    state.startDate = $id('intentDate') ? $id('intentDate').value : '';
    state.start = $id('intentStart') && $id('intentStart').value ? (matchStart($id('intentStart').value) || state.start) : state.start;
    var days = schedule(state.selected, state.start, state.days);
    var name = (state.regions.join('/') || '旅行') + ' ' + days.length + ' 日' + (state.prefs.length ? state.prefs.join('·') : '') + '之旅';
    state.trip = { name: name, createdAt: Date.now(), start: state.start, startDate: state.startDate, aiLevel: getAILevel(), days: days, narrative: null };
    showStage('stageResult'); renderResult();
  }
  window.plannerSchedule = doSchedule;

  /* 种子：从想去清单 */
  function seedFromWish() {
    var wl = window.Wish.list().filter(function (x) { return !x.visited && x.lat != null; });
    if (wl.length < 2) { toast('先去地图收藏至少 2 处想去的地方'); return; }
    state.candidates = wl.map(function (w) { return { name: w.label, label: w.label, region: w.region, city: w.city, theme: w.theme, flag: '', lat: w.lat, lng: w.lng }; });
    state.selected = state.candidates.slice();
    state.fromWish = true; state.regions = []; state.prefs = []; state.days = 0;
    renderIntent(); doRecall(); showStage('stagePick');
  }
  window.plannerSeedWish = seedFromWish;

  /* ---------- 初始化 ---------- */
  function init() {
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
    $id('scheduleBtn').onclick = doSchedule;
    var cf = $id('candFilter');
    if (cf) cf.oninput = function () { state.candFilter = this.value; renderCandidates(); };
    try { if (window.TravelNotes && TravelNotes.init) TravelNotes.init({}); } catch (e) {}
    renderTrips();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
