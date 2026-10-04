/* share.js — 只读行程分享（批次 9 · P1-5）
 *
 * 链接形态： <分享网址>/share.html#v1.<base64url(deflate(JSON.stringify(payload)))>
 *   - 载荷写在 hash 里，不进任何服务器；share.html 在 file:// 与 http(s) 下都能渲染。
 *   - 网址从哪来：应用若已部署在 http(s)，自动取当前地址；否则用设置里填的「分享网址」。
 *     两者都没有就没有可点开的链接——纯前端没有服务器，这是实话，所以永远同时给一条文本降级。
 *
 * 隐私是硬边界：payload 由下面 payloadOf() 逐字段白名单构造，不是把 trip 序列化后删字段。
 * 因此游记正文、照片、录音、AI Key、高德 Key、自建节点的备注，物理上不可能进包。
 */
(function (window) {
  'use strict';

  var VER = 'v1';
  var BASE_KEY = 'tn_share_base';
  var URL_LIMIT = 7000;        /* 微信对 URL 长度的实际上限附近，超了宁可降级 */
  var FILE_NAME = 'share.html';

  /* ---------- 压缩 / base64url ---------- */
  function b64url(bytes) {
    var s = '', CH = 0x2000;
    for (var i = 0; i < bytes.length; i += CH) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function hasPako() { return !!(window.pako && window.pako.deflate && window.pako.inflate); }

  function encodePayload(payload) {
    if (!hasPako()) throw new Error('压缩库未就位');
    return VER + '.' + b64url(window.pako.deflate(JSON.stringify(payload)));
  }
  function decodePayload(str) {
    if (!str || str.indexOf(VER + '.') !== 0) return null;
    if (!hasPako()) return null;
    try {
      /* pako 3.x 起 inflate 不再认 {to:'string'}（传了照样返回 Uint8Array，
         静默把二进制当字符串 parse 会在 position 3 撞 SyntaxError），自己解 UTF-8 */
      var out = window.pako.inflate(unb64url(str.slice(VER.length + 1)));
      var json = typeof out === 'string' ? out : new TextDecoder('utf-8').decode(out);
      var obj = JSON.parse(json);
      return obj && obj.v === 1 ? obj : null;
    } catch (e) { return null; }
  }

  /* ---------- 载荷：逐字段白名单 ---------- */
  function num(v, dp) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    var m = Math.pow(10, dp === undefined ? 1 : dp);
    return Math.round(n * m) / m;
  }
  function nameOf(x) { return x && typeof x.name === 'string' ? x.name.slice(0, 60) : ''; }
  function payloadOf(trip) {
    var days = (trip && trip.days) || [];
    var out = {
      v: 1,
      t: nameOf({ name: trip && trip.name }) || '我的行程',
      sd: (trip && trip.startDate) ? String(trip.startDate).slice(0, 10) : '',
      from: nameOf(trip && trip.start),
      to: nameOf(trip && trip.end),
      loop: !!(trip && trip.end && trip.end.isLoop),
      /* 1=高德真实道路里程，0=直线折算。不说清就是拿估算值冒充实测值 */
      r: (trip && trip.dist && Object.keys(trip.dist).length) ? 1 : 0,
      days: []
    };
    days.forEach(function (d) {
      var day = { km: num(d.driveKm, 0), h: num(d.totalH, 1), stops: [] };
      if (d.transit) { day.tr = 1; day.f = nameOf({ name: d.from }); day.o = nameOf({ name: d.to }); }
      (d.stops || []).forEach(function (s) {
        var st = { n: nameOf(s) };
        if (s && s.lat != null && s.lng != null) { st.la = num(s.lat, 4); st.lo = num(s.lng, 4); }
        day.stops.push(st);
      });
      out.days.push(day);
    });
    return out;
  }
  /* 白名单之外的键一律不许出现（闸门与冒烟都靠这句话） */
  var ALLOWED = { v: 1, t: 1, sd: 1, from: 1, to: 1, loop: 1, r: 1, days: 1, km: 1, h: 1, stops: 1, tr: 1, f: 1, o: 1, n: 1, la: 1, lo: 1 };
  function strayKeys(payload) {
    var bad = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      /* 数组只有下标，不是字段：逐元素走进去看，别把 '0','1' 当成白名单外的键 */
      if (Object.prototype.toString.call(o) === '[object Array]') {
        for (var i = 0; i < o.length; i++) walk(o[i]);
        return;
      }
      Object.keys(o).forEach(function (k) {
        if (!ALLOWED[k]) bad.push(k);
        walk(o[k]);
      });
    })(payload);
    return bad;
  }

  /* ---------- 汇总（分享页与冒烟共用一把尺子） ---------- */
  function summary(p) {
    var stops = 0, km = 0, h = 0;
    (p && p.days || []).forEach(function (d) {
      stops += (d.stops || []).length;
      km += Number(d.km) || 0;
      h += Number(d.h) || 0;
    });
    return { days: (p && p.days || []).length, stops: stops, km: Math.round(km), h: num(h, 1) };
  }

  /* ---------- 文本降级（没有可点开的链接时，这段就是要发出去的全部内容） ---------- */
  function textOf(p) {
    var s = summary(p), L = [];
    L.push('【' + (p.t || '我的行程') + '】');
    if (p.sd) L.push(p.sd + ' 出发');
    var route = [p.from, p.to].filter(Boolean).join(p.loop ? ' → （环线回起点）' : ' → ');
    if (route) L.push('路线：' + route);
    L.push('共 ' + s.days + ' 天 · ' + s.stops + ' 站 · 约 ' + s.km + ' 公里' + (s.h ? ' · 全程约 ' + s.h + ' 小时' : ''));
    L.push('');
    (p.days || []).forEach(function (d, i) {
      if (d.tr) { L.push('D' + (i + 1) + ' 赶路日：' + (d.f || '出发地') + ' → ' + (d.o || '目的地') + '（约 ' + d.km + ' km）'); return; }
      L.push('D' + (i + 1) + ' · ' + (d.stops || []).length + ' 站 · 约 ' + d.km + ' km');
      (d.stops || []).forEach(function (st, j) { L.push('  ' + (j + 1) + '. ' + st.n); });
    });
    L.push('');
    L.push(p.r ? '里程为真实道路数据' : '里程按直线 ×1.35 折算（估算）');
    L.push('—— 由 行迹 TRACE 生成');
    return L.join('\n');
  }

  /* ---------- 链接基址 ---------- */
  function normBase(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) return '';
    s = s.replace(/\/+$/, '');
    s = s.replace(new RegExp('/' + FILE_NAME + '$'), '');
    return s;
  }
  function savedBase() { try { return normBase(localStorage.getItem(BASE_KEY)); } catch (e) { return ''; } }
  function setBase(u) {
    var n = normBase(u);
    try { if (n) localStorage.setItem(BASE_KEY, n); else localStorage.removeItem(BASE_KEY); } catch (e) {}
    return n;
  }
  /* 应用自己在 http(s) 上跑时，同目录的 share.html 就是最顺的落点 */
  function selfBase() {
    var p = location.protocol;
    if (p !== 'http:' && p !== 'https:') return '';
    var i = location.pathname.lastIndexOf('/');
    return location.origin + location.pathname.slice(0, i + 1).replace(/\/+$/, '');
  }
  function linkBase() { return savedBase() || selfBase(); }

  /* ---------- 出链接 ---------- */
  function build(trip) {
    if (!trip || !trip.days || !trip.days.length) return { ok: false, reason: '还没有排出行程' };
    if (!hasPako()) return { ok: false, reason: '压缩库没就位，只能用文本' };
    var p = payloadOf(trip);
    var stray = strayKeys(p);
    if (stray.length) return { ok: false, reason: '载荷含白名单外字段：' + stray.join(',') };
    var text = textOf(p);
    var hash = encodePayload(p);
    var base = linkBase();
    var url = base ? base + '/' + FILE_NAME + '#' + hash : '';
    if (url && url.length > URL_LIMIT) {
      return { ok: false, degrade: 'too-long', chars: url.length, limit: URL_LIMIT, text: text, payload: p };
    }
    if (!url) return { ok: false, degrade: 'no-base', text: text, payload: p, chars: hash.length };
    return { ok: true, url: url, text: text, payload: p, hash: hash, chars: url.length, summary: summary(p), base: base };
  }

  window.Share = {
    VER: VER, FILE_NAME: FILE_NAME, BASE_KEY: BASE_KEY, URL_LIMIT: URL_LIMIT,
    payloadOf: payloadOf, strayKeys: strayKeys, ALLOWED: ALLOWED,
    encodePayload: encodePayload, decodePayload: decodePayload,
    summary: summary, textOf: textOf, build: build,
    normBase: normBase, savedBase: savedBase, setBase: setBase, selfBase: selfBase, linkBase: linkBase,
    hasPako: hasPako
  };
})(window);
