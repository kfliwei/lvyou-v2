/* gen-tickets.js — 票价种子生成器（营业时间来自高德 v5；票价字段一律人工维护，脚本绝不写 p）
 *
 * 用法:
 *   node tools/gen-tickets.js --tier h              # 36 份 *-data.js 里 flag==='h' 的那一档（最像"必去级"）
 *   node tools/gen-tickets.js --tier m --redo        # 重查已收录的 m 档
 *   node tools/gen-tickets.js --city 西安市          # 按城市分批
 *   node tools/gen-tickets.js --names "晋祠,故宫"     # 指定名单
 *   公共开关: --limit N 只跑前 N 条（试水配额用） / --dry 只查不写盘
 *
 * 三条纪律（都是踩过坑加的，别再改回去）：
 *  1. 写盘锚点 SEED_DECL 是**单一命名常量**，脚本按它做区间替换而不是正则猜；命中 0 次或多次一律 exit 1。
 *     旧版在这里写死了 'var SEED = window.SITE_TICKETS_SEED || {};'，而 site-tickets.js 早已改成 '= {'，
 *     于是替换永不命中 → 自检拿到旧条数 → 有新增时反而 exit 1、一条都没查到时却"绿灯"写回原文件（行为恰好反了）。
 *     verify.js §27 会把这一串与 site-tickets.js 的实际声明行做常驻对账，漂移当场红。
 *  2. 高德没返回营业时间时**不许用空串覆盖**既有人工 h（旧版无条件覆盖，一次 EMPTY 就抹掉一条好数据）。
 *  3. 本次零成果（没有任何一条拿到新 h）→ 印 WARN、exit 0、**不写盘**；撞配额则停在检查点并打印续跑命令。
 *
 * p（票价文案）与 u（核验年月）：既有条目原样保留，只有新建条目才把 u 落成当月。*/
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : ''; };
const hasFlag = (flag) => argv.indexOf(flag) >= 0;
/* 与 site-tickets.js 的声明行逐字一致（**不含左括号**：括号由 JSON 体带出来，写两遍会产出语法错误的文件，
 * --selftest 第一跑就是这么炸的）；改那边必须同时改这里，§27 会做常驻对账 */
const SEED_DECL = 'var SEED = window.SITE_TICKETS_SEED =';
const SEED_END = '\n};';            /* 只用来定位旧块的结尾，不参与拼接 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg) { console.error('ABORT: ' + msg); process.exit(1); }

function loadKey() {
  const kf = path.join(ROOT, 'tn-key.js');
  if (!fs.existsSync(kf)) die('本机没有 tn-key.js（gitignored 的未跟踪密钥文件）。补齐它，或在有 Key 的机器上跑本脚本。');
  const c = { window: {} };
  vm.createContext(c);
  try { vm.runInContext(fs.readFileSync(kf, 'utf8'), c); } catch (e) { die('tn-key.js 解析失败: ' + e.message); }
  const k = c.window.__TN_AMAP_KEY__;
  if (!k) die('tn-key.js 里没有 window.__TN_AMAP_KEY__');
  return k;
}

/* 从 36 份 *-data.js 读站点（记录自带 name/flag/label/region/city/lat/lng，不绕 nation-index） */
function loadSites() {
  const out = [];
  fs.readdirSync(ROOT).filter((f) => /-data\.js$/.test(f)).sort().forEach((f) => {
    const c = { window: {} };
    vm.createContext(c);
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c); } catch (e) { return; }
    if (!Array.isArray(c.window.SITES)) return;
    c.window.SITES.forEach((s) => { if (s && s.name) out.push({ file: f, name: s.name, label: s.label || s.name, flag: s.flag || '', region: s.region || '', city: s.city || '', lat: +s.lat, lng: +s.lng }); });
  });
  return out;
}

function pick(sites) {
  const names = argOf('--names').split(',').map((s) => s.trim()).filter(Boolean);
  const tier = argOf('--tier'), city = argOf('--city');
  if (!names.length && !tier && !city) {
    console.log('用法: node tools/gen-tickets.js --tier h|m|all | --city 城市 | --names "晋祠,故宫" [--redo] [--limit N] [--dry] [--select]');
    process.exit(1);
  }
  let sel = sites;
  if (names.length) sel = sites.filter((s) => names.indexOf(s.name) >= 0 || names.indexOf(s.label) >= 0);
  if (tier) sel = tier === 'all' ? sel.filter((s) => s.flag) : sel.filter((s) => s.flag === tier);
  if (city) sel = sel.filter((s) => s.city === city || s.region === city || s.city.indexOf(city) >= 0);
  const seen = {}, uniq = [];
  sel.forEach((s) => { if (!seen[s.name]) { seen[s.name] = 1; uniq.push(s); } });
  const lim = +argOf('--limit');
  return lim > 0 ? uniq.slice(0, lim) : uniq;
}

function readSeed(file) {
  const c = { window: {} };
  vm.createContext(c);
  vm.runInContext(file, c);
  return c.window.SITE_TICKETS_SEED || {};
}

const QUOTA_HINT = /CUQPS|USER_DAILY|DAILY|QUOTA|INSUFFICIENT/i;

/* 合并纪律：h 只在新值非空时覆盖；p 绝不写；新建条目才落 u */
function applyMerge(seed, out, now) {
  const merged = {};
  Object.keys(seed).forEach((k) => { merged[k] = Object.assign({}, seed[k]); });
  let added = 0, touched = 0;
  Object.keys(out).forEach((k) => {
    const h = out[k].h;
    if (!h) return;                                   /* EMPTY 不建空壳、也不抹既有 h */
    if (!merged[k]) { merged[k] = { h: h, p: '', u: now }; added++; }
    else if (merged[k].h !== h) { merged[k].h = h; touched++; }
  });
  return { merged: merged, added: added, touched: touched };
}

/* 区间替换：按 SEED_DECL 定位、EOL+'};' 收尾；命中数不对就绝不动文件。
 * 两个坑都在案：① SEED_DECL 不含左括号，闭合括号由 JSON 体自己带（重复补一个就是语法错误）；
 * ② 仓库文件是 CRLF，而 JSON.stringify 只出 LF —— 不统一行尾会写出混合行尾的文件。 */
function renderNext(before, seed, merged) {
  const EOL = before.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const END = EOL + '};';
  const start = before.indexOf(SEED_DECL);
  if (start < 0) die('写盘锚点 0 次命中：site-tickets.js 的 SEED 声明行与脚本里的 SEED_DECL 已漂移，先对齐再跑。串=「' + SEED_DECL + '」');
  if (before.indexOf(SEED_DECL, start + 1) >= 0) die('写盘锚点多次命中：SEED_DECL 不唯一，无法定位替换区间。');
  const endAt = before.indexOf(END, start);
  if (endAt < 0) die('没找到 SEED 对象的收尾（EOL + 「};」），替换区间无法确定。');
  const order = Object.keys(seed).concat(Object.keys(merged).filter((k) => !seed[k]));
  const body = JSON.stringify(order.reduce((o, k) => { o[k] = merged[k]; return o; }, {}), null, 2).replace(/\r?\n/g, EOL);
  const close = body.lastIndexOf('}');
  if (close < 0) die('JSON 体里没有闭合括号，拒绝写盘。');
  const block = SEED_DECL + ' ' + body.slice(0, close) + '};';
  return { next: before.slice(0, start) + block + before.slice(endAt + END.length), order: order, eol: EOL };
}

/* 自检：装进沙箱读回来，条数对得上，且人工 p/u 一条没丢、既有 h 没被抹空 */
function selfCheck(next, seed, out, order) {
  const chk = readSeed(next);
  const ck = Object.keys(chk);
  if (ck.length !== order.length) die('自检失败：读回 ' + ck.length + ' 条，期望 ' + order.length + ' 条');
  Object.keys(seed).forEach((k) => {
    if (seed[k].p && chk[k].p !== seed[k].p) die('自检失败：「' + k + '」的人工票价 p 被改写了');
    if (seed[k].u && chk[k].u !== seed[k].u) die('自检失败：「' + k + '」的核验年月 u 被改写了');
    if (seed[k].h && !chk[k].h) die('自检失败：「' + k + '」原有的营业时间被抹空了');
  });
  const withH = Object.keys(out).filter((k) => out[k].h);
  if (withH.length && chk[withH[0]] === undefined) die('自检失败：这次拿到的 h 一条都没进结果');
  return chk;
}

/* 离线自测：不要 Key、不联网，专测合并/写盘/读回三段——这次事故的三个环节都在这里过一遍。
 * 真写一个临时文件再读回，好让 fs 通道也在被测范围内；测完删掉，site-tickets.js 一根手指都不碰。 */
function runSelftest() {
  const ticketsPath = path.join(ROOT, 'site-tickets.js');
  const before = fs.readFileSync(ticketsPath, 'utf8');
  const seed = readSeed(before);
  const firstKey = Object.keys(seed)[0];
  if (!firstKey) die('自测失败：现有种子为空，无法测「更新既有」这条分支');
  const out = {};
  out[firstKey] = { h: '08:00-18:00（自测改写）', src: 'A' };
  out['__自测新条目__'] = { h: '09:00-17:00（自测新增）', src: 'B' };
  out['__自测空返回__'] = { h: '', src: 'C' };
  const m = applyMerge(seed, out, '2099-01');
  const r = renderNext(before, seed, m.merged);
  const chk = selfCheck(r.next, seed, out, r.order);
  const tmp = path.join(ROOT, 'tools', 'out', '_selftest-site-tickets.js');
  fs.writeFileSync(tmp, r.next);
  const back = readSeed(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);
  const want = [[m.added === 1, '新增应为 1，实为 ' + m.added],
    [m.touched === 1, '更新应为 1，实为 ' + m.touched],
    [chk[firstKey].h === '08:00-18:00（自测改写）', '既有条目的 h 没被改写'],
    [chk[firstKey].p === seed[firstKey].p, '既有条目的人工 p 被改了'],
    [chk[firstKey].u === seed[firstKey].u, '既有条目的核验年月 u 被改了'],
    [chk['__自测新条目__'].u === '2099-01', '新建条目没落当月 u'],
    [back['__自测空返回__'] === undefined, 'EMPTY 那条被建成空壳行（不该建）'],
    [Object.keys(back).length === r.order.length, '临时文件读回条数不符'],
    [before.indexOf('__自测') < 0, '自测数据污染了 site-tickets.js']];
  const bad = want.filter((w) => !w[0]);
  if (bad.length) { bad.forEach((b) => console.error('SELFTEST FAIL: ' + b[1])); process.exit(1); }
  if (fs.readFileSync(ticketsPath, 'utf8') !== before) die('SELFTEST FAIL: site-tickets.js 被改动了');
  console.log('SELFTEST PASS 9/9（合并 ' + Object.keys(seed).length + '→' + r.order.length + ' 条；写盘读回一致；site-tickets.js 未动）');
  process.exit(0);
}

(async () => {
  if (hasFlag('--selftest')) runSelftest();
  /* 筛选在加载 Key 之前：筛选写错了不该先撞「本机没有密钥」这条无关的红 */
  const sites = pick(loadSites());
  if (!sites.length) die('筛选结果为空（检查 --tier/--city/--names）');
  if (hasFlag('--select')) {
    const flags = {}, files = {};
    sites.forEach((s) => { flags[s.flag || '(空)'] = (flags[s.flag || '(空)'] || 0) + 1; files[s.file] = 1; });
    console.log('SELECT: ' + sites.length + ' 条 / ' + Object.keys(files).length + ' 份 *-data.js；flag 分布 ' + JSON.stringify(flags));
    console.log('前 8 条: ' + sites.slice(0, 8).map((s) => s.name + '(' + (s.flag || '-') + ')').join(' '));
    process.exit(0);
  }
  const KEY = loadKey();
  const now = new Date().toISOString().slice(0, 7);
  const ticketsPath = path.join(ROOT, 'site-tickets.js');
  const before = fs.readFileSync(ticketsPath, 'utf8');
  const seed = readSeed(before);
  const redo = hasFlag('--redo');

  const q = (p) => fetch('https://restapi.amap.com/v5/' + p + '&key=' + KEY).then((r) => r.json());
  const out = {};
  let ok = 0, empty = 0, skipDup = 0, miss = 0, quota = 0;

  for (const site of sites) {
    if (!redo && seed[site.name] && seed[site.name].h) { skipDup++; continue; }
    if (!isFinite(site.lat) || !isFinite(site.lng)) { console.log('SKIP(缺坐标): ' + site.name); miss++; continue; }
    const cityQ = site.city ? '&city=' + encodeURIComponent(site.city) + '&citylimit=true'
      : (site.region ? '&city=' + encodeURIComponent(site.region) + '&citylimit=true' : '');
    try {
      const s = await q('place/text?keywords=' + encodeURIComponent(site.label) + cityQ);
      if (s.status !== '1') {
        const info = (s.info || '') + ' ' + (s.infocode || '');
        console.log('FAIL(搜索): ' + site.name + ' → ' + info.slice(0, 60));
        if (QUOTA_HINT.test(info)) { quota++; console.log('!! 疑似配额/限流，停在检查点。续跑: 同一条命令去掉 --redo 即可跳过已完成的 ' + ok + ' 条'); break; }
        miss++; await sleep(350); continue;
      }
      const pois = s.pois || [];
      /* 同名异地保护：POI 坐标必须落在该景点 ±0.2° 内，否则放弃（宁缺毋假） */
      const poi = pois.find((p) => {
        const l = (p.location || '').split(',').map(Number);
        return l.length === 2 && isFinite(l[0]) && Math.abs(l[0] - site.lng) < 0.2 && Math.abs(l[1] - site.lat) < 0.2;
      });
      if (!poi) { console.log('SKIP(异地同名): ' + site.name + ' → ' + (pois[0] ? pois[0].name : '无 POI')); miss++; await sleep(350); continue; }
      await sleep(350);
      const d = await q('place/detail?id=' + poi.id + '&show_fields=business');
      const b = d.status === '1' && d.pois && d.pois[0] ? (d.pois[0].business || {}) : {};
      const h = b.opentime_week || b.opentime_today || '';
      out[site.name] = { h: h, src: poi.name };
      if (h) { ok++; console.log('OK  ' + site.name + ' → ' + h.slice(0, 64)); }
      else { empty++; console.log('EMPTY ' + site.name + '（高德未收录营业时间，保留原 h）'); }
    } catch (e) { console.log('ERR ' + site.name + ': ' + (e.message || '').slice(0, 60)); miss++; }
    await sleep(350);
  }

  const m = applyMerge(seed, out, now);
  const gained = m.added + m.touched;
  const summary = 'OK=' + ok + ' EMPTY=' + empty + ' 已收录跳过=' + skipDup + ' 未命中=' + miss + ' 配额=' + quota;

  if (!gained) {
    console.log('\n' + summary + '\nWARN: 本次没有任何新数据（新增 0 / 更新 0），**不写盘**（site-tickets.js 保持原样）。');
    process.exit(0);
  }
  const r = renderNext(before, seed, m.merged);
  selfCheck(r.next, seed, out, r.order);
  if (hasFlag('--dry')) { console.log('\n' + summary + '\nDRY: 本可写入 新增' + m.added + '/更新' + m.touched + '，--dry 已跳过写盘。'); process.exit(0); }

  fs.writeFileSync(ticketsPath, r.next);
  console.log('\n' + summary + '\n写盘完成: 种子 ' + Object.keys(seed).length + ' → ' + r.order.length + ' 条（新增 ' + m.added + ' / 更新 ' + m.touched + '）');
  console.log('提醒: 本脚本只写营业时间(h)；票价(p) 与核验年月(u) 归人工。');
})().catch((e) => die('未捕获: ' + (e && e.stack ? e.stack.slice(0, 300) : e)));
