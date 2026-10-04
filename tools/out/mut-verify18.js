/* 批次 10 · verify.js §18（日卡天气闸门）变异自测
 * 每条变异只改一个「应该让闸门变红」的点，跑 verify.js 断言：exit≠0 且输出含指定短语，
 * 并且（除标注 only:false 的几条外）只让「天气闸门」这一栏变红 1 条——多红说明锚点打偏了。
 * 跑完从内存快照逐字节还原；锚点先断出现次数，替换一律 split/join（String.replace 只换第一处）。
 * planner.js / planner.html / settings.html / smoke-planner.js / 改进实施方案与验收标准.md 是 CRLF，
 * 所以这些文件里只用单行锚点；backup.js / share.html / verify.js 是 LF。
 * only:false 的三条不是锚点打偏，是同一条口径上的多道独立对账：
 *   M5 换接口同时破「地址字面量 = forecast」与「禁字 archive-api」；
 *   M21 换键名同时破「默认开口径」「tn_weather 家族只许一个键」「开关键拼写」，还会惊动 §16 备份闸门；
 *   M22 摘登记同时破「§18 键两清」与「§16 未登记键」。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const D = '$';

const PL = 'planner.js', PLH = 'planner.html', SET = 'settings.html', BK = 'backup.js',
  SH = 'share.html', SM = 'tools/smoke-planner.js', DOC = '改进实施方案与验收标准.md';

const MUTS = [
  /* --- ① 码表与游记对账（两本账迟早漂） --- */
  { name: 'M1 码表把 WMO 61 的中文改成自造口径（与游记那份分家）', ed: [[PL, "61: ['rain', '小雨'],", "61: ['rain', '小雨转中雨'],", 1]], exp: '码 61 两处中文不一致' },
  { name: 'M2 码表用了 icons.js 里不存在的字形（日卡上是一块空白）', ed: [[PL, "61: ['rain', '小雨'],", "61: ['umbrella', '小雨'],", 1]], exp: '不在 icons.js 的 TI_NAMES 里' },

  /* --- ② 口径逐值核定（拿源码字面量求值，不认注释） --- */
  { name: 'M3 天气缓存从 6 小时改成 24 小时', ed: [[PL, 'var WX_TTL = 6 * 3600 * 1000;', 'var WX_TTL = 24 * 3600 * 1000;', 1]], exp: 'WX_TTL 应为 21600000' },
  { name: 'M4 预报窗口从 T+15 放宽到 T+30（第 16 天起接口已经没数据，实测 10-20 直接拒）', ed: [[PL, 'var WX_HORIZON = 15;', 'var WX_HORIZON = 30;', 1]], exp: 'WX_HORIZON 应为 15' },

  /* --- ③ 接口口径 --- */
  { name: 'M5 预报接口换成历史接口（过期日期也有数，等于在猜）', ed: [[PL, "var WX_HOST = 'https://api.open-meteo.com/v1/forecast';", "var WX_HOST = 'https://archive-api.open-meteo.com/v1/archive';", 1]], exp: '天气接口地址漂移', only: false },
  { name: 'M6 daily 字段被裁剪成只剩最高温（与游记那套字段分家）', ed: [[PL, "'&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date='", "'&daily=temperature_2m_max&timezone=auto&start_date='", 1]], exp: 'daily 参数与 travel-notes 不是同一套字段' },
  { name: 'M7 首尾日期不再钉成同一天（改成 days=1 就取回一整串，日卡拿的是第一天）', ed: [[PL, "+ '&end_date=' + date;", "+ '&days=1';", 1]], exp: '没把 start_date 与 end_date 钉成同一天' },

  /* --- ④ 静默降级：不占位、不吭声、不读本机密钥 --- */
  { name: 'M8 未登记的天气码改成兜底显示（日卡摆出看不懂的码）', ed: [[PL, "    if (!g) return '';", "    if (!g) return { code: 0, tmax: 1, tmin: 1 };", 1]], exp: '没登记的天气码必须不显示' },
  { name: 'M9 这天没坐标时改铺一个空槽（静默出口少一条，日卡上多个位）', ed: [[PL, "    if (!co) return '';                 /* 没坐标就不问：这天的天气压根无从问起 */", "    if (!co) return '<span class=\"wxh\"></span>';", 1]], exp: 'wxSlot 的静默出口从' },
  { name: 'M10 未取到的空槽不再 display:none（取不到天气就在日卡上留个位）', ed: [[PLH, '.day-card .dhead .wxh{display:none}', '.day-card .dhead .wxh{display:inline-block}', 1]], exp: '空槽没设 display:none' },
  { name: 'M11 天气块里顺手读了高德 Key（把本机密钥牵进第三方链路）', ed: [[PL, "var WX_HOST = 'https://api.open-meteo.com/v1/forecast';", "var WX_HOST = 'https://api.open-meteo.com/v1/forecast'; var wxK = getAmapKey();", 1]], exp: '天气模块里出现「getAmapKey」' },
  { name: 'M12 取不到天气时弹提示（静默降级变成刷话术）', ed: [[PL, '          if (!w) return;', "          if (!w) { toast('天气没取到'); return; }", 1]], exp: '天气模块里出现「toast(」' },

  /* --- ⑤ 限流与退避 --- */
  { name: 'M13 天气不再过闸门（裸调 job，并发无上界）', ed: [[PL, 'function wxRun(job) { gateRun(wxGate, job); }', 'function wxRun(job) { job(function () {}); }', 1]], exp: '天气没走与高德同族的限流闸门' },
  { name: 'M14 429 不再触发重试（被限流等于那天没天气）', ed: [[PL, 'if (r.status === 429 && (tries || 0) < 2) throw { wxRetry: 1 };', 'if (false) throw { wxRetry: 1 };', 1]], exp: '天气缺被限流后的退避重试' },
  { name: 'M15 退避改成立刻原地重发（限流期继续撞墙）', ed: [[PL, "        if (e && e.wxRetry && (tries || 0) < 2) { setTimeout(function () { wxRest(url, cb, (tries || 0) + 1); }, 700 * ((tries || 0) + 1)); return; }", '        if (e && e.wxRetry && (tries || 0) < 2) { wxRest(url, cb, (tries || 0) + 1); return; }', 1]], exp: '天气缺被限流后的退避重试' },

  /* --- ⑥ 接线：两处日卡、渲染后补槽、赶路日坐标、窄屏不挤 --- */
  { name: 'M16 赶路日的天气位被摘掉（长途那天恰恰最该看天气）', ed: [[PL, " + wxSlot(trip, di) + '</div>' +", " + '</div>' +", 1]], exp: 'wxSlot 调用应为 2 处' },
  { name: 'M17 渲染完不再补槽（缓存没命中的日子永远不出天气）', ed: [[PL, '    wxHydrate(trip);   /* 缓存没命中的日子在这一步发请求；拿不到就永远不出现 .wx */', '    /* M17 不补槽 */', 1]], exp: '渲染后没补槽' },
  { name: 'M18 赶路日不存终点坐标（那天没有可查天气的位置）', ed: [[PL, 'tla: to && to.lat != null ? to.lat : null,', 'tla: null,', 1]], exp: '赶路日没存终点坐标' },
  { name: 'M19 .wx 去掉 flex:0 0 auto（320px 窄屏把导航键挤出去）', ed: [[PLH, '.day-card .dhead .wx{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;', '.day-card .dhead .wx{display:inline-flex;align-items:center;gap:3px;', 1]], exp: '.wx 没设 flex:0 0 auto' },

  /* --- ⑦ 键两清 --- */
  { name: 'M20 天气开关从「默认开」翻成「默认关」（不写键的机器从此没天气）', ed: [[PL, "localStorage.getItem('tn_planner_weather') !== '0'", "localStorage.getItem('tn_planner_weather') === '1'", 1]], exp: '天气开关不是「默认开、写 0 才关」' },
  { name: 'M21 开关改名撞进缓存前缀（文档原方案的雷：清一次缓存连带清掉开关）', ed: [[PL, "localStorage.getItem('tn_planner_weather') !== '0'", "localStorage.getItem('tn_weather_switch') !== '0'", 1]], exp: 'tn_weather 家族只许有缓存前缀 tn_weather_d_ 一个键', only: false },
  { name: 'M22 开关没在备份策略登记（换机就丢，或被当数据同步）', ed: [[BK, "    { k: 'tn_planner_weather', g: 'prefs', m: 'whole' }, /* 日卡天气开关：纯显示偏好，关掉不影响数据 */\n", '', 1]], exp: '没注册成 prefs', only: false },
  { name: 'M23 逐日缓存键换出 tn_weather_ 家族（会跟着备份跑到别人机器上）', ed: [[PL, "return 'tn_weather_d_' + lat", "return 'weather_d_' + lat", 1]], exp: 'tn_weather 家族只许有缓存前缀 tn_weather_d_ 一个键' },
  { name: 'M24 天气缓存不走 LRU（localStorage 无界膨胀）', ed: [[PL, 'd: d })); rememberCacheKey(k); } catch (e) {} }', 'd: d })); } catch (e) {} }', 1]], exp: '天气缓存没走 rememberCacheKey' },
  { name: 'M25 设置页开关不落盘（关掉一次，刷新就回来）', ed: [[SET, "lsSave('tn_planner_weather', off() ? '1' : '0');", "toast('已切换');", 1]], exp: '设置页开关没落键' },

  /* --- ⑧ 别人的地盘不许越界 --- */
  { name: 'M26 分享页替访客查天气（链接里几个坐标变成第三方请求）', ed: [[SH, '</body>', "<script>fetch('https://api.open-meteo.com/v1/forecast?latitude=1');</script></body>", 1]], exp: '分享页里出现了天气' },

  /* --- ⑨ 冒烟里那 7 条锚点，逐条证明是活的 --- */
  { name: 'M27 冒烟的 mock 拦截条件失效（天气请求全走真网络）', ed: [[SM, "if (u.indexOf('api.open-meteo.com') >= 0) {", 'if (u.indexOf(\'api.open-meteo.com\') > 99999) {', 1]], exp: 'mock 预报接口的拦截点' },
  { name: 'M28 冒烟不再数请求次数（断网/重试都数不出来）', ed: [[SM, 'window.__wxCalls++; window.__wxUrls.push(u);', 'window.__wxUrls.push(u);', 1]], exp: '计数器自增点' },
  { name: 'M29 冒烟数的选择器写错（.wx 有多少个变成永远数不到）', ed: [[SM, "p." + D + D + "eval('#resultBody .day-card .wx', els => els.length)", "p." + D + D + "eval('#resultBody .day-card .wxq', els => els.length)", 1]], exp: '日卡天气位计数' },
  { name: 'M30 冒烟里关掉开关那一步不再落键', ed: [[SM, "localStorage.setItem('tn_planner_weather', '0');", 'localStorage.setItem(\'tn_planner_weather_x\', \'0\');', 1]], exp: '关掉开关后的无天气态' },
  { name: 'M31 冒烟里「超出预报期」那一档被改成窗口内的日期', ed: [[SM, "const w2 = await wxOpen('ok', 40);", "const w2 = await wxOpen('ok', 3);", 1]], exp: '缺超出预报期那一档' },
  { name: 'M32 冒烟里断网那一档被悄悄改成坏包档', ed: [[SM, "window.__wxMode = 'down';", "window.__wxMode = 'junk';", 1]], exp: '缺断网那一档' },
  { name: 'M33 冒烟里 429 那一档不再触发限流', ed: [[SM, "const w4 = await wxOpen('rate', 2);", "const w4 = await wxOpen('ok', 2);", 1]], exp: '缺被 429 限流那一档' },

  /* --- ⑩ 文档欠账清零 --- */
  { name: 'M34 §P1-6 又留了一个未勾选项（批次当没收工）', ed: [[DOC, '- [x] 同一行程二次排期命中缓存', '- [ ] 同一行程二次排期命中缓存', 1]], exp: '§P1-6 还有未勾选项' },
  { name: 'M35 §P1-6 的缓存时长口径被改掉（文档与代码 6 小时脱钩，本节三处一起改）', ed: [[DOC, '缓存 6 小时、窗口 T+15', '缓存 24 小时、窗口 T+15', 1],
    [DOC, '缓存 6h（key 含坐标', '缓存 24h（key 含坐标', 1],
    [DOC, 'TTL 6 小时（预报一天更新几轮', 'TTL 24 小时（预报一天更新几轮', 1]], exp: '§P1-6 没写缓存时长口径' },
  { name: 'M36 §P1-6 把开关键名写回原方案（tn_weather 撞缓存前缀这条更正被抹掉，本节三处一起抹）', ed: [[DOC, 'tn_planner_weather', 'tn_weather', 5]], exp: '§P1-6 没写开关键名' }
];

if (module.parent) { module.exports = { MUTS }; return; }

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function write(f, s) { fs.writeFileSync(path.join(ROOT, f), s, 'utf8'); }

const touched = new Set();
MUTS.forEach(m => m.ed.forEach(e => touched.add(e[0])));
const orig = {};
[...touched].forEach(f => { orig[f] = read(f); });
function restore() { [...touched].forEach(f => { if (read(f) !== orig[f]) write(f, orig[f]); }); }

function runVerify() {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const wxFails = out => out.split('\n').filter(l => l.indexOf('天气闸门 FAIL') >= 0);
const otherFails = out => out.split('\n').filter(l => /FAIL/.test(l) && l.indexOf('天气闸门 FAIL') < 0 && l.indexOf('=== FAIL') < 0);

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    let ok = true, why = '';
    m.ed.forEach(([f, from, , cnt]) => {
      const n = read(f).split(from).length - 1;
      if (n !== cnt) { ok = false; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 54)); }
    });
    if (!ok) { fail++; console.log('✗ ' + m.name + ' — ' + why); return; }
    m.ed.forEach(([f, from, to]) => write(f, read(f).split(from).join(to)));
    const r = runVerify();
    restore();
    const hits = wxFails(r.out), others = otherFails(r.out);
    const hit = r.out.includes(m.exp);
    const single = m.only === false ? true : hits.length === 1;
    if (r.code !== 0 && hit && single) {
      pass++;
      console.log('✓ ' + m.name + '\n    exit=' + r.code + ' · 天气闸门红 ' + hits.length + ' 条'
        + (others.length ? ' · 同时惊动别的闸门：' + others[0].slice(0, 60) : '') + ' · 命中：' + m.exp);
    } else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.exp + '」=' + hit
        + ' · 天气闸门红 ' + hits.length + ' 条（期望' + (m.only === false ? '不限' : '恰 1）')
        + '\n    ' + (hits.length ? hits.join('\n    ') : '(天气闸门没红) ' + others.join(' / ')).slice(0, 700));
    }
  });
} finally {
  restore();
  [...touched].forEach(f => { if (read(f) !== orig[f]) { dirty++; console.log('!! 未还原：' + f); } });
  console.log('还原对账：' + touched.size + ' 个文件，未还原 ' + dirty + ' 个');
  const after = runVerify();
  console.log('还原后 verify.js exit=' + after.code);
}
console.log('=== §18 变异自测: ' + pass + ' 条按要求变红 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' ===');
process.exit(fail || dirty ? 1 : 0);
