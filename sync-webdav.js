/* ============================================================
 * sync-webdav.js — WebDAV 云同步（批次 8 / P1-4）
 * ------------------------------------------------------------
 * 纯 JS 实现：APK 壳 WebView 开了 setAllowUniversalAccessFromFileURLs(true)，
 * file:// 页面上的跨源 fetch 直连可用，不需要 Java 桥。浏览器侧受 CORS 约束，
 * 验证走 --disable-web-security 或同源反代。
 *
 * 配置只存本机 localStorage：
 *   tn_webdav          = { url, user, pass, dir }   ← 含口令，严禁进备份（见 backup.js NEVER）
 *   tn_webdav_autosync = '1' | '0'（默认关）
 *   tn_webdav_last     = { ts, ok, msg }           ← 上次同步结果，仅本机展示用
 *
 * 远端布局：<url>/<dir>/trace-full-backup.json （单文件全量，schema 由 backup.js 定）
 * 同步语义：
 *   push       = 本机采集 → 整包 PUT 覆盖远端
 *   pull       = GET 远端 → 与本机并集合并（本机优先，云端不会盖掉本地新记录）
 *   pull force = GET 远端 → 替换式恢复（唯一能把「别处已删除」带回来的路径）
 * 删除不跨设备传播是单文件无墓碑方案的固有边界，已在文档登记。
 * ============================================================ */
(function () {
  'use strict';

  var CFG_KEY = 'tn_webdav', AUTO_KEY = 'tn_webdav_autosync', LAST_KEY = 'tn_webdav_last';
  var FILE_NAME = 'trace-full-backup.json';
  var TIMEOUT = 30000;
  var AUTO_DEBOUNCE = 30000;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
      return v;
    } catch (e) { return null; }
  }
  function normalize(c) {
    if (!c || typeof c.url !== 'string' || !c.url.trim()) return null;
    return { url: c.url.trim(), user: c.user || '', pass: c.pass || '', dir: String(c.dir || '').trim() };
  }
  function cfg() {
    try { return normalize(JSON.parse(ls(CFG_KEY) || 'null')); } catch (e) { return null; }
  }
  /* 返回 false = 地址不合法（没保存） */
  function saveCfg(c) {
    if (!c || !String(c.url || '').trim()) { ls(CFG_KEY, null); return true; }
    var n = normalize(c);
    if (!n || !/^https?:\/\//i.test(n.url)) return false;
    ls(CFG_KEY, JSON.stringify(n));
    return true;
  }
  /* 任何回给用户的文案都要抹掉口令：URL 里可能自带 user:pass@ */
  function redact(s) {
    return String(s == null ? '' : s)
      .replace(/\/\/[^/@\s]*:[^/@\s]*@/g, '/***:***@')
      .replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1***');
  }
  function segs(dir) {
    return String(dir || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean)
      .map(function (x) { return encodeURIComponent(x); });
  }
  function fileUrl(c) {
    var base = c.url.replace(/\/+$/, '');
    return base + '/' + segs(c.dir).join('/') + '/' + FILE_NAME;
  }
  function parentUrls(c) {
    var base = c.url.replace(/\/+$/, '');
    var out = [base + '/'].concat(segs(c.dir).map(function (_, i, a) {
      return base + '/' + a.slice(0, i + 1).join('/') + '/';
    }));
    return out;
  }
  function headers(c, extra) {
    var h = extra || {};
    if (c.user || c.pass) h.Authorization = 'Basic ' + btoa(unescape(encodeURIComponent(c.user + ':' + c.pass)));
    return h;
  }
  function offline() { return navigator.onLine === false; }

  function withTimeout(promise) {
    return new Promise(function (res, rej) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; rej(new Error('请求超时（' + (TIMEOUT / 1000) + 's）')); } }, TIMEOUT);
      promise.then(function (r) { done = true; clearTimeout(t); res(r); },
        function (e) { done = true; clearTimeout(t); rej(e); });
    });
  }
  /* 实测（2026-10-04）：服务器回「401 + WWW-Authenticate: Basic」时，Chromium 会去弹认证框，
   * 没有 UI 可弹的环境下请求一直挂着（探针：不带挑战 20ms 拿到 401；带挑战 8s 不返回）。
   * 真机 WebView 没实现 onReceivedHttpAuthRequest，同样拿不到 401 状态码，只能看到网络层失败，
   * 所以网络错误/超时的文案必须把「账号或密码被拒」这个可能性说出来。 */
  function netHint(c, raw) {
    var msg = String(raw || '');
    var m = /超时/.test(msg) ? msg : '连不上 WebDAV 服务（网络不通、地址写错，或服务器不允许浏览器直连）';
    if (c && (c.user || c.pass)) m += '；也可能是账号或密码被服务器拒绝（它会要求弹窗认证，App 内弹不出来）';
    return m;
  }
  function send(c, method, url, body, extra) {
    if (offline()) return Promise.reject(new Error('当前离线，稍后再试'));
    var init = { method: method, headers: headers(c, extra || {}), cache: 'no-store' };
    if (body != null) init.body = body;
    return withTimeout(fetch(url, init)).catch(function (e) {
      throw new Error(netHint(c, /Failed to fetch|NetworkError|Load failed|CORS/i.test(String(e && e.message)) ? '' : e && e.message));
    });
  }

  /* ---------- 连通性测试：PROPFIND 列目录，405/501 时退回 OPTIONS ---------- */
  function test(cb, override) {
    var c = override || cfg();
    if (!c) { cb({ ok: false, msg: '先填服务器地址' }); return; }
    var root = c.url.replace(/\/+$/, '') + '/';
    send(c, 'PROPFIND', root, null, { Depth: '0' }).then(function (r) {
      if (r.status === 405 || r.status === 501) return send(c, 'OPTIONS', root, null, {});
      return r;
    }).then(function (r) {
      if (r.status < 400) { record(true, '连接成功（HTTP ' + r.status + '）'); cb({ ok: true, status: r.status, msg: '连接成功（HTTP ' + r.status + '）' }); return; }
      var msg = httpHint(r.status);
      record(false, msg);
      cb({ ok: false, status: r.status, msg: msg });
    }).catch(function (e) {
      record(false, redact(e.message));
      cb({ ok: false, msg: redact(e.message) });
    });
  }
  /* 401/403 单独成句，见 send() 里对 Chromium 认证框的说明 */
  function httpHint(status) {
    if (status === 401 || status === 403) return '账号或密码不对（' + status + '）';
    if (status === 404) return '目录不存在（404），先点「上传到云端」会自动创建';
    if (status === 409) return '上级目录不存在（409），先点「上传到云端」会自动创建';
    return '服务器返回 HTTP ' + status;
  }

  /* ---------- 404/409 → 逐级 MKCOL 建目录，只重试一次 ---------- */
  function ensureCollection(c) {
    var list = parentUrls(c);
    var i = 0;
    function step() {
      if (i >= list.length) return Promise.resolve();
      var url = list[i++];
      /* 已存在返回 405，无权限返回 4xx：都往下试，最终由 PUT 的结果决定成败 */
      return send(c, 'MKCOL', url, null, {}).then(function () { return step(); }, function () { return step(); });
    }
    return step();
  }

  function record(ok, msg) {
    try { ls(LAST_KEY, JSON.stringify({ ts: Date.now(), ok: !!ok, msg: String(msg || '').slice(0, 200) })); } catch (e) {}
  }
  function last() {
    try { return JSON.parse(ls(LAST_KEY) || 'null'); } catch (e) { return null; }
  }

  /* ---------- push ---------- */
  function push(cb) {
    var c = cfg();
    if (!c) { cb(new Error('还没有配置 WebDAV 服务')); return; }
    if (!window.Backup) { cb(new Error('备份模块未加载')); return; }
    Backup.collect(function (err, env) {
      if (err) { record(false, '采集失败'); cb(err); return; }
      var body;
      try { body = Backup.serialize(env); } catch (e) { record(false, e.message); cb(e); return; }
      var url = fileUrl(c);
      function put() { return send(c, 'PUT', url, body, { 'Content-Type': 'application/json; charset=utf-8' }); }
      put().then(function (r) {
        if (r.ok) return r;
        if (r.status === 404 || r.status === 409) return ensureCollection(c).then(put);
        throw new Error(httpHint(r.status));
      }).then(function (r) {
        if (!r || !r.ok) throw new Error(httpHint(r ? r.status : 0));
        record(true, '已上传 ' + Backup.describe(env));
        cb(null, { bytes: body.length, env: env, status: r.status });
      }, function (e) {
        var m = redact(e && e.message || e);
        record(false, m);
        cb(new Error(m));
      });
    });
  }

  /* ---------- pull（默认并集合并、本机优先；force=替换式恢复） ---------- */
  function pull(opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    var c = cfg();
    if (!c) { cb(new Error('还没有配置 WebDAV 服务')); return; }
    if (!window.Backup) { cb(new Error('备份模块未加载')); return; }
    send(c, 'GET', fileUrl(c), null, {}).then(function (r) {
      if (r.status === 404) throw new Error('云端还没有备份文件，先从本机上传一份');
      if (!r.ok) throw new Error(httpHint(r.status));
      return r.text();
    }).then(function (text) {
      var v = Backup.validate(text);
      if (!v.ok) throw new Error('云端文件不是可恢复的行迹备份：' + v.error);
      var env = v.env;
      if (opts.force) return askForce(env, function (go) {
        if (!go) { cb(null, { cancelled: true, env: env }); return; }
        doApply(env, { mode: 'replace' }, cb);
      });
      doApply(env, { mode: 'merge', prefer: 'local' }, cb);
    }).catch(function (e) {
      record(false, redact(e.message));
      cb(new Error(redact(e.message)));
    });
    function doApply(env, applyOpts, done) {
      Backup.apply(env, applyOpts, function (err, stats) {
        if (err) { record(false, '恢复失败：' + err.message); done(err); return; }
        stats.env = env;
        record(true, '已从云端恢复：' + Backup.describe(env));
        done(null, stats);
      });
    }
  }
  function askForce(env, next) {
    if (!window.UI || !UI.confirm) { next(true); return; }
    UI.confirm({
      title: '用云端备份覆盖本机',
      text: '云端备份：' + Backup.describe(env) + '。本机比它新的记录、以及别处没有的相册会被清掉，且无法撤销。',
      okText: '覆盖恢复', danger: true
    }, function (ok) { next(!!ok); });
  }

  /* ---------- 云端摘要（设置页展示「云端有什么」） ---------- */
  function remoteInfo(cb) {
    var c = cfg();
    if (!c) { cb(new Error('还没有配置 WebDAV 服务')); return; }
    send(c, 'GET', fileUrl(c), null, {}).then(function (r) {
      if (r.status === 404) { cb(null, { exists: false }); return; }
      if (!r.ok) throw new Error(httpHint(r.status));
      return r.text();
    }).then(function (text) {
      var v = Backup.validate(text);
      if (!v.ok) { cb(null, { exists: true, valid: false, msg: v.error }); return; }
      cb(null, { exists: true, valid: true, env: v.env, text: text, summary: Backup.describe(v.env) });
    }).catch(function (e) { cb(new Error(redact(e.message))); });
  }

  /* ---------- 自动同步：改数据后防抖 30s 上传，默认关 ---------- */
  var timer = null;
  function autosyncOn() { return ls(AUTO_KEY) === '1' && !!cfg(); }
  function setAutosync(on) { ls(AUTO_KEY, on ? '1' : '0'); }
  /* delay 只在验证脚本里传（30s 太长），产品调用一律走默认防抖 */
  function scheduleSync(delay) {
    if (!autosyncOn()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      push(function (err) { if (err) { try { UI.tileWarn && UI.tileWarn('云同步失败：' + err.message); } catch (e) {} } });
    }, delay || AUTO_DEBOUNCE);
  }
  function installAutosync() {
    if (!window.TravelNotes) return;
    var prev = window.TravelNotes._afterSave;
    window.TravelNotes._afterSave = function () {
      try { scheduleSync(); } catch (e) {}
      if (prev) return prev.apply(this, arguments);
    };
  }
  try { installAutosync(); } catch (e) {}

  window.WebDAV = {
    FILE_NAME: FILE_NAME,
    CFG_KEY: CFG_KEY,
    AUTO_KEY: AUTO_KEY,
    cfg: cfg,
    saveCfg: saveCfg,
    fileUrl: fileUrl,
    redact: redact,
    test: test,
    push: push,
    pull: pull,
    remoteInfo: remoteInfo,
    autosyncOn: autosyncOn,
    setAutosync: setAutosync,
    scheduleSync: scheduleSync,
    last: last
  };
})();
