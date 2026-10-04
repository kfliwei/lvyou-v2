/* tools/webdav-stub.js — 最小 WebDAV 桩服务器（批次 8 行为验证用，非产品代码）
 * 实现：OPTIONS / PROPFIND / MKCOL / PUT / GET / DELETE + Basic 鉴权 + CORS 头。
 * 目录模型是「必须先 MKCOL 才能 PUT」，所以 409 → ensureCollection → 重试 这条链路
 * 能被真测出来，而不是靠 PUT 顺手建目录。 */
const http = require('http');
const url = require('node:url');

function cors(res, extra) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,PUT,DELETE,PROPFIND,MKCOL');
  res.setHeader('Access-Control-Allow-Headers',
    (extra && extra.allowHeaders) || 'authorization,content-type,depth,destination,overwrite');
  res.setHeader('Access-Control-Expose-Headers', 'content-length');
}

function start(opts, cb) {
  opts = opts || {};
  const port = opts.port || 8791;
  const dirs = new Set(['/']);
  const files = new Map();
  const hits = [];
  const authUser = opts.user || 'u';
  const authPass = opts.pass || 'p';
  const requireAuth = opts.requireAuth !== false;

  function parentOf(p) {
    const s = p.replace(/\/+$/, '');
    const i = s.lastIndexOf('/');
    return (i <= 0 ? '/' : s.slice(0, i + 1));
  }
  function authed(req) {
    if (!requireAuth) return true;
    const h = req.headers.authorization || '';
    if (!h.startsWith('Basic ')) return false;
    const raw = Buffer.from(h.slice(6), 'base64').toString('utf8');
    return raw === authUser + ':' + authPass;
  }

  const server = http.createServer(function (req, res) {
    const path = decodeURIComponent(url.parse(req.url).pathname || '/');
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      hits.push({ method: req.method, path: path, hasAuth: !!req.headers.authorization });
      if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
      if (!authed(req)) {
        cors(res);
        /* 默认不带 WWW-Authenticate：探针实测（tools/out/probe 一次性取证，2026-10-04）Chromium 遇到
         * 「401 + Basic 挑战」会去弹认证框，无 UI 环境下请求一直挂着，测试就得白等 30s。
         * 需要复现真机行为时传 requireChallenge:true（坚果云 / Nextcloud 都会带挑战头）。 */
        var h = {};
        if (opts.requireChallenge) h['WWW-Authenticate'] = 'Basic realm="stub"';
        res.writeHead(401, h);
        res.end('unauthorized');
        return;
      }
      if (req.method === 'PROPFIND') {
        cors(res);
        res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>'
          + Array.from(files.keys()).join('</d:href></d:response><d:response><d:href>')
          + '</d:href></d:response></d:multistatus>');
        return;
      }
      if (req.method === 'MKCOL') {
        cors(res);
        if (dirs.has(path)) { res.writeHead(405); res.end('exists'); return; }
        if (!dirs.has(parentOf(path))) { res.writeHead(409); res.end('conflict'); return; }
        dirs.add(path);
        res.writeHead(201); res.end('');
        return;
      }
      if (req.method === 'PUT') {
        cors(res);
        if (!dirs.has(parentOf(path))) { res.writeHead(409); res.end('conflict: create parent first'); return; }
        files.set(path, body);
        res.writeHead(201); res.end('');
        return;
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        cors(res);
        if (!files.has(path)) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(files.get(path));
        return;
      }
      if (req.method === 'DELETE') {
        cors(res);
        if (!files.delete(path)) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(204); res.end('');
        return;
      }
      cors(res);
      res.writeHead(501); res.end('unsupported');
    });
  });

  server.listen(port, '127.0.0.1', function () {
    cb({
      port: port,
      root: 'http://127.0.0.1:' + port + '/',
      user: authUser,
      pass: authPass,
      hits: hits,
      files: files,
      read: function (p) { return files.get(p); },
      mkdir: function (p) { dirs.add(p); },
      close: function (done) { server.close(done); }
    });
  });
}

module.exports = { start: start };
