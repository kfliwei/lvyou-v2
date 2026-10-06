/* tools/gen-images.js — Wikimedia Commons 批量补图（许可白名单 → 本地镜像 → 溯源）
 *
 * 用法:
 *   node tools/gen-images.js --selftest                 # 离线自测：许可判定 / 合并 / 写盘读回 / 无 http（不联网、不碰产出）
 *   node tools/gen-images.js --tier m --limit 20        # 只跑必去档前 20 条（试水配额与命中率）
 *   node tools/gen-images.js --tier h --redo            # 重查已镜像过的 h 档
 *   node tools/gen-images.js --names "西湖,断桥残雪"     # 指定名单
 *   公共开关: --dry 只查不写盘 / --select 只印筛选分布
 *
 * 网络：本机直连 zh.wikipedia.org / commons.wikimedia.org 实测 TIMEOUT（14s），必须走代理。
 * 默认 CONNECT 代理 127.0.0.1:7897，可用 IMG_PROXY_HOST / IMG_PROXY_PORT 覆盖。
 * 代理没起时脚本**立刻 ABORT 并说清是哪一步**，不会把「连不上」伪装成「查不到图」。
 *
 * 许可（法律事实，不是产品定位）：只收 WHITELIST 那四串，且**整串相等**（折大小写与多余空白）。
 * 不做包含匹配——Commons 的 LicenseShortName 里 'CC BY-NC 4.0'、'CC BY-ND 4.0' 都含 'CC BY'，
 * 包含匹配会把「禁止商用/禁止演绎」放进包，而这两类在旅行记录类产品里是不能用的。
 * 每张留三件套：src（本地路径）/ author（作者串）/ lic（许可短名，原样）+ file（Commons 的 File: 标题，**不带协议头**，可溯源又不诱导联网）。
 *
 * 三条纪律同 gen-tickets.js（都是踩过坑加的）：
 *  1. 写盘锚点 OUT_DECL 与 site-images-commons.js 的声明行**逐字对账**，按它做区间替换；命中 0 次或多次一律 exit 1。
 *  2. 这次没拿到图**不许用空值覆盖**既有镜像条目（一次 NOTHUMB 就抹掉一条好数据）。
 *  3. 零成果 → 印 WARN、exit 0、**不写盘**；疑似限流停在检查点并打印续跑命令。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = 'site-images-commons.js';
const IMG_DIR = 'images/commons';
/* 与 site-images-commons.js 的声明行逐字一致（不含左括号，括号由 JSON 体带出来）；§35 常驻对账 */
const OUT_DECL = 'window.SITE_IMAGES_COMMONS =';
const WHITELIST = ['CC0', 'Public Domain', 'CC BY 4.0', 'CC BY-SA 4.0'];
const PROXY = { host: process.env.IMG_PROXY_HOST || '127.0.0.1', port: +(process.env.IMG_PROXY_PORT || 7897) };
const UA = 'lvyou-heritage/0.1 (offline-first travel app; local image mirror)';
const MAX_W = 900;          /* 镜像宽度上限：真机档 452×995 的封面最多 2× 宽，900 够 */
const QUALITY = 78;
const MAX_BYTES = 220 * 1024;  /* 单张字节上限：包体是装机体积账，超了降档再来一次 */
const argv = process.argv.slice(2);
const argOf = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : ''; };
const hasFlag = f => argv.indexOf(f) >= 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function die(msg) { console.error('ABORT: ' + msg); process.exit(1); }

/* ---------- 许可判定：整串相等，不是包含 ---------- */
function licOk(lic) {
  const s = String(lic || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return false;
  return WHITELIST.some(w => s === w.toLowerCase());
}

/* ---------- 走 CONNECT 代理的 HTTPS（本环境唯一可用通道） ---------- */
function viaProxy(hostName, pathOrQuery, ms, binary) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done({ err: 'TIMEOUT ' + ms + 'ms（代理里这条请求没回来）' }), ms || 20000);
    const creq = http.request({ host: PROXY.host, port: PROXY.port, method: 'CONNECT', path: hostName + ':443', headers: { 'User-Agent': UA } });
    creq.on('error', e => { clearTimeout(timer); done({ err: 'PROXY ' + PROXY.host + ':' + PROXY.port + ' ' + (e.code || e.message) }); });
    creq.on('connect', (res, sock) => {
      if (res.statusCode !== 200) { clearTimeout(timer); sock.destroy(); done({ err: 'CONNECT_FAIL ' + res.statusCode }); return; }
      const req = https.request({
        host: hostName, port: 443, socket: sock, agent: false, method: 'GET',
        path: pathOrQuery, headers: { 'User-Agent': UA, Host: hostName }
      }, r => {
        const chunks = [];
        r.on('data', d => chunks.push(d));
        r.on('end', () => { clearTimeout(timer); done({ code: r.statusCode, body: binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8') }); });
      });
      req.on('error', e => { clearTimeout(timer); done({ err: 'REQ ' + (e.code || e.message) }); });
      req.setTimeout((ms || 20000) - 3000, () => { req.destroy(new Error('socket timeout')); });
      req.end();
    });
    creq.setTimeout(ms || 20000, () => { creq.destroy(); });
    creq.end();
  });
}

async function apiJson(hostName, query, ms) {
  const r = await viaProxy(hostName, query, ms, false);
  if (r.err) return { err: r.err };
  if (r.code !== 200) return { err: 'HTTP ' + r.code };
  try { return { j: JSON.parse(r.body) }; } catch (e) { return { err: 'JSON 解析失败' }; }
}

/* 第一跳：zh.wikipedia 的 pageimages 拿到主图文件名（这一跳只给名字，不给许可） */
async function pageImage(title) {
  const q = '/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=' + MAX_W +
    '&redirects=1&titles=' + encodeURIComponent(title);
  const r = await apiJson('zh.wikipedia.org', q);
  if (r.err) return { err: r.err };
  const pages = (r.j.query && r.j.query.pages) || {};
  const ids = Object.keys(pages);
  if (!ids.length) return { err: 'NOPAGE' };
  const p = pages[ids[0]];
  if (p.missing !== undefined) return { err: 'MISSING（中文维基没有这个条目）' };
  if (!p.pageimage) return { err: 'NOFILE（条目没有主图）' };
  return { name: p.pageimage.replace(/^File:/, '') };
}

/* 第二跳：Commons 的 imageinfo 拿许可与作者——白名单在这一跳判，早于下载任何一个字节 */
async function commonsInfo(fileTitle) {
  const q = '/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize%7Cmime&iiurlwidth=' + MAX_W +
    '&redirects=1&titles=' + encodeURIComponent('File:' + fileTitle);
  const r = await apiJson('commons.wikimedia.org', q);
  if (r.err) return { err: r.err };
  const pages = (r.j.query && r.j.query.pages) || {};
  const ids = Object.keys(pages);
  if (!ids.length) return { err: 'NOPAGE' };
  const p = pages[ids[0]];
  if (!p.imageinfo) return { err: 'NOIMAGEINFO' + (p.missing !== undefined ? '/本地文件不在 Commons' : '') };
  const ii = p.imageinfo[0], em = ii.extmetadata || {};
  const lic = (em.LicenseShortName && String(em.LicenseShortName.value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()) || '';
  const author = (em.Artist && String(em.Artist.value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) || '';
  if (!/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) return { err: 'MIME ' + ii.mime };
  return {
    file: String(p.title || ''), lic, author,
    url: ii.thumburl || ii.url,
    ok: licOk(lic), bytes: ii.size
  };
}

const MAGIC = [
  b => b.slice(0, 3).toString('hex') === 'ffd8ff',
  b => b.slice(0, 8).toString('hex') === '89504e470d0a1a0a',
  b => b.slice(0, 4).toString('hex') === '52494646' && b.slice(8, 12).toString() === 'WEBP'
];

async function download(url) {
  let hostName, p;
  try { const u = new URL(url); hostName = u.host; p = u.pathname + u.search; } catch (e) { return { err: 'BADURL' }; }
  const r = await viaProxy(hostName, p, 40000, true);
  if (r.err) return { err: r.err };
  if (r.code !== 200) return { err: 'HTTP ' + r.code };
  if (!r.body || r.body.length < 1024) return { err: '太小(' + (r.body ? r.body.length : 0) + 'B)' };
  if (!MAGIC.some(m => m(r.body))) return { err: '非图片体' };
  return { buf: r.body };
}

/* ---------- 站点来源：36 份 *-data.js（自带 name/label/flag/city，不绕 nation-index） ---------- */
function loadSites() {
  const out = [], seen = {};
  fs.readdirSync(ROOT).filter(f => /-data\.js$/.test(f)).sort().forEach(f => {
    const c = { window: {} };
    vm.createContext(c);
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c); } catch (e) { return; }
    if (!Array.isArray(c.window.SITES)) return;
    c.window.SITES.forEach(s => {
      if (!s || !s.name || seen[s.name]) return;
      seen[s.name] = 1;
      out.push({ name: s.name, label: s.label || s.name, flag: s.flag || '', city: s.city || '' });
    });
  });
  return out;
}

function pick(sites) {
  const names = argOf('--names').split(',').map(s => s.trim()).filter(Boolean);
  const tier = argOf('--tier'), city = argOf('--city');
  if (!names.length && !tier && !city) {
    console.log('用法: node tools/gen-images.js --tier h|m|all | --city 城市 | --names "西湖,断桥" [--redo] [--limit N] [--dry] [--select] [--selftest]');
    process.exit(1);
  }
  let sel = sites;
  if (names.length) sel = sites.filter(s => names.indexOf(s.name) >= 0 || names.indexOf(s.label) >= 0);
  if (tier) sel = tier === 'all' ? sel.filter(s => s.flag) : sel.filter(s => s.flag === tier);
  if (city) sel = sel.filter(s => s.city === city || s.city.indexOf(city) >= 0);
  const lim = +argOf('--limit');
  return lim > 0 ? sel.slice(0, lim) : sel;
}

const slug = name => IMG_DIR + '/' + crypto.createHash('md5').update(name).digest('hex').slice(0, 16) + '.jpg';

function readOut(file) {
  const c = { window: {} };
  vm.createContext(c);
  vm.runInContext(file, c);
  return c.window.SITE_IMAGES_COMMONS || {};
}

/* 合并纪律：这次没拿到图的条目原样保留；新建才写四件套；既有条目不许被空值覆盖 */
function applyMerge(prev, out) {
  const merged = {};
  Object.keys(prev).forEach(k => { merged[k] = Object.assign({}, prev[k]); });
  let added = 0, touched = 0;
  Object.keys(out).forEach(k => {
    const e = out[k];
    if (!e || !e.src) return;
    if (!merged[k]) { merged[k] = e; added++; }
    else if (merged[k].src !== e.src) { merged[k] = e; touched++; }
  });
  return { merged, added, touched };
}

/* 声明行对账（0-1 同一条治疗，第二个患者）：脚本里的 OUT_DECL 必须与产出文件的真实声明逐字一致 */
function assertDecl(before) {
  if (!before) return;                       /* 文件还不存在：第一次写盘时由 renderNext 造出声明行 */
  const i = before.indexOf(OUT_DECL);
  if (i < 0) die('写盘锚点 0 次命中：' + OUT_FILE + ' 的声明行与脚本里的 OUT_DECL 已漂移，先对齐再跑。串=「' + OUT_DECL + '」');
  if (before.indexOf(OUT_DECL, i + 1) >= 0) die('写盘锚点多次命中：OUT_DECL 不唯一，无法定位替换区间。');
}

function renderNext(before, prev, merged) {
  const EOL = before.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const END = EOL + '};';
  const order = Object.keys(prev).concat(Object.keys(merged).filter(k => !prev[k]));
  const body = JSON.stringify(order.reduce((o, k) => { o[k] = merged[k]; return o; }, {}), null, 2).replace(/\r?\n/g, EOL);
  const close = body.lastIndexOf('}');
  if (close < 0) die('JSON 体里没有闭合括号，拒绝写盘。');
  const block = OUT_DECL + ' ' + body.slice(0, close) + '};';
  if (!before) {
    const head = '/* 由 tools/gen-images.js 生成——Wikimedia Commons 实景照镜像（许可见每条 lic，溯源见每条 file）。勿手改，重跑生成器。 */' + EOL;
    return { next: head + block + EOL, order, eol: EOL };
  }
  const start = before.indexOf(OUT_DECL);
  const endAt = before.indexOf(END, start);
  if (endAt < 0) die('没找到对象的收尾（EOL + 「};」），替换区间无法确定。');
  return { next: before.slice(0, start) + block + before.slice(endAt + END.length), order, eol: EOL };
}

/* 自检：装进沙箱读回；条数对得上；每条三件套齐全；src/file 里不许有协议头；引用的文件真实存在 */
function selfCheck(next, merged, order, rootDir) {
  const chk = readOut(next);
  const ck = Object.keys(chk);
  if (ck.length !== order.length) die('自检失败：读回 ' + ck.length + ' 条，期望 ' + order.length + ' 条');
  ck.forEach(k => {
    const e = chk[k];
    if (!e || typeof e !== 'object') die('自检失败：「' + k + '」不是对象条目（旧版字符串形态会让消费点读不到许可）');
    ['src', 'author', 'lic', 'file'].forEach(f => { if (!(f in e)) die('自检失败：「' + k + '」缺字段 ' + f); });
    if (!e.src || !e.lic || !e.file) die('自检失败：「' + k + '」的 src/lic/file 有空值');
    if (/https?:/i.test(e.src) || /https?:/i.test(e.file)) die('自检失败：「' + k + '」的镜像表里出现协议头（离线壳不许指向网络）');
    if (e.file.indexOf('File:') !== 0) die('自检失败：「' + k + '」的 file 不是 File: 标题，没法回 Commons 溯源');
    if (rootDir && !fs.existsSync(path.join(rootDir, e.src))) die('自检失败：' + e.src + ' 不存在');
  });
  return chk;
}

/* ---------- 离线自测：许可判定 + 合并不覆盖 + 写盘读回 + 无协议头 ---------- */
function runSelftest() {
  const lic = [
    [licOk('CC0') === true, 'CC0 应收'],
    [licOk('Public Domain') === true, 'Public Domain 应收'],
    [licOk('CC BY 4.0') === true, 'CC BY 4.0 应收'],
    [licOk('CC BY-SA 4.0') === true, 'CC BY-SA 4.0 应收'],
    [licOk('cc by-sa 4.0') === true, '大小写要折'],
    [licOk('CC BY-NC 4.0') === false, 'NC（禁止商用）必须拒——它含 "CC BY" 子串，包含匹配会放进来'],
    [licOk('CC BY-ND 4.0') === false, 'ND（禁止演绎）必须拒'],
    [licOk('CC BY 2.0') === false, '版本不同就是不同许可，2.0 不在白名单'],
    [licOk('CC BY 4.0 DEED') === false, '尾巴多一个词也不许算命中'],
    [licOk('') === false, '空许可必须拒'],
    [WHITELIST.length === 4, '白名单四串']
  ];
  const prev = { '__既有__': { src: IMG_DIR + '/aaaaaaaaaaaaaaaa.jpg', author: 'Old', lic: 'CC0', file: 'File:Old.jpg' } };
  const out = {
    '__既有__': { src: '', author: '', lic: '', file: '' },                 /* 这次没拿到：不许抹掉既有 */
    '__新增__': { src: IMG_DIR + '/bbbbbbbbbbbbbbbb.jpg', author: 'New', lic: 'CC BY-SA 4.0', file: 'File:New.jpg' }
  };
  const m = applyMerge(prev, out);
  const r = renderNext('', prev, m.merged);
  const chk = selfCheck(r.next, m.merged, r.order, null);
  const tmp = path.join(ROOT, 'tools', 'out', '_selftest-images.js');
  fs.writeFileSync(tmp, r.next);
  const back = readOut(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);
  lic.push(
    [m.added === 1 && m.touched === 0, '新增应为 1、更新应为 0，实为 ' + m.added + '/' + m.touched],
    [chk['__既有__'].lic === 'CC0', '既有条目的许可被空值覆盖了'],
    [back['__新增__'].author === 'New', '新条目读回不一致'],
    [Object.keys(back).length === 2, '临时文件读回条数不符'],
    [r.next.split(OUT_DECL).length - 1 === 1, '产出里声明行不是恰一处（下次跑就对不上账）'],
    [/https?:\/\//.test(r.next.replace(/"[^"]*":\s*"[^"]*",?/g, '')) === false, '除字段值之外还冒出协议头'],
    [r.next.indexOf('"http://') < 0 && r.next.indexOf('"https://') < 0, '字段值里出现协议头（离线壳不许指向网络）']
  );
  const bad = lic.filter(w => !w[0]);
  if (bad.length) { bad.forEach(b => console.error('SELFTEST FAIL: ' + b[1])); process.exit(1); }
  console.log('SELFTEST PASS ' + lic.length + '/' + lic.length + '（许可整串相等 ' + WHITELIST.join(' / ') + '；空值不覆盖；写盘读回一致）');
  process.exit(0);
}

(async () => {
  if (hasFlag('--selftest')) runSelftest();
  const sites = pick(loadSites());
  if (!sites.length) die('筛选结果为空（检查 --tier/--city/--names）');
  if (hasFlag('--select')) {
    const flags = {};
    sites.forEach(s => { flags[s.flag || '(空)'] = (flags[s.flag || '(空)'] || 0) + 1; });
    console.log('SELECT: ' + sites.length + ' 条；flag 分布 ' + JSON.stringify(flags));
    console.log('前 8 条: ' + sites.slice(0, 8).map(s => s.name + '(' + (s.flag || '-') + ')').join(' '));
    process.exit(0);
  }

  /* 代理先探一次：连不上就一步结案，别让每条站点都撞一遍 20s 超时 */
  const probe = await apiJson('commons.wikimedia.org', '/w/api.php?action=query&format=json&meta=siteinfo&siprop=general');
  if (probe.err) die('代理 ' + PROXY.host + ':' + PROXY.port + ' 到 commons.wikimedia.org 不通：' + probe.err + '（起代理，或用 IMG_PROXY_HOST/IMG_PROXY_PORT 指到别处）');

  let sharp = null;
  try { sharp = require('sharp'); } catch (e) { die('缺 sharp 依赖（npm i sharp）——没有它就没法把原图缩到 ' + MAX_W + 'px 再进包'); }

  const outPath = path.join(ROOT, OUT_FILE);
  const before = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  assertDecl(before);
  const prev = before ? readOut(before) : {};
  const redo = hasFlag('--redo');
  fs.mkdirSync(path.join(ROOT, IMG_DIR), { recursive: true });

  const found = {};
  let ok = 0, noimg = 0, rej = 0, miss = 0, skipDup = 0, big = 0;
  for (const site of sites) {
    if (!redo && prev[site.name]) { skipDup++; continue; }
    const pi = await pageImage(site.label || site.name);
    if (pi.err) { noimg++; console.log('NOIMG ' + site.name + ' → ' + pi.err); await sleep(300); continue; }
    await sleep(300);
    const ci = await commonsInfo(pi.name);
    if (ci.err) { miss++; console.log('FAIL(许可查询) ' + site.name + ' → ' + ci.err); await sleep(300); continue; }
    if (!ci.ok) { rej++; console.log('REJ ' + site.name + ' 许可「' + ci.lic + '」不在白名单（' + ci.file.slice(0, 40) + '）'); await sleep(300); continue; }
    const dl = await download(ci.url);
    if (dl.err) { miss++; console.log('FAIL(下载) ' + site.name + ' → ' + dl.err); await sleep(300); continue; }
    let q = QUALITY, buf = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      buf = await sharp(dl.buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
      if (buf.length <= MAX_BYTES) break;
      q = 68;
    }
    if (buf.length > MAX_BYTES) { big++; console.log('SKIP(压不下) ' + site.name + ' ' + buf.length + 'B'); continue; }
    const file = slug(site.name);
    fs.writeFileSync(path.join(ROOT, file), buf);
    found[site.name] = { src: file, author: ci.author, lic: ci.lic, file: ci.file.indexOf('File:') === 0 ? ci.file : 'File:' + ci.file };
    ok++;
    console.log('OK  ' + site.name + ' ← ' + ci.file.slice(0, 46) + ' (' + (buf.length / 1024).toFixed(0) + 'KB, ' + ci.lic + ')');
    await sleep(300);
  }

  const m = applyMerge(prev, found);
  const gained = m.added + m.touched;
  const summary = 'OK=' + ok + ' 无主图=' + noimg + ' 许可拒=' + rej + ' 查询/下载失败=' + miss + ' 压不下=' + big + ' 已镜像跳过=' + skipDup;

  if (!gained) {
    console.log('\n' + summary + '\nWARN: 本次没有任何新图（新增 0 / 更新 0），**不写盘**（' + OUT_FILE + ' 保持原样）。');
    process.exit(0);
  }
  const r = renderNext(before, prev, m.merged);
  selfCheck(r.next, m.merged, r.order, ROOT);
  if (hasFlag('--dry')) { console.log('\n' + summary + '\nDRY: 本可写入 新增' + m.added + '/更新' + m.touched + '，--dry 已跳过写盘（图片已落在 ' + IMG_DIR + '/）。'); process.exit(0); }
  fs.writeFileSync(outPath, r.next);
  const bytes = Object.keys(m.merged).reduce((a, k) => a + (fs.existsSync(path.join(ROOT, m.merged[k].src)) ? fs.statSync(path.join(ROOT, m.merged[k].src)).size : 0), 0);
  console.log('\n' + summary + '\n写盘完成: 镜像 ' + Object.keys(prev).length + ' → ' + r.order.length + ' 条（新增 ' + m.added + ' / 更新 ' + m.touched + '），表内合计 ' + (bytes / 1048576).toFixed(1) + ' MB');
  console.log('→ ' + OUT_FILE);
})().catch(e => die('未捕获: ' + (e && e.stack ? e.stack.slice(0, 300) : e)));
