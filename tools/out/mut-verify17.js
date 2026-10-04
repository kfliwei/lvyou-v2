/* 批次 9 · verify.js §17（只读分享闸门）变异自测
 * 每条变异只改一个「应该让闸门变红」的点，跑 verify.js 断言：exit≠0 且输出含指定短语。
 * 跑完从内存快照逐字节还原；锚点先断出现次数，替换一律 split/join（String.replace 只换第一处）。
 * planner.js / planner.html / settings.html 是 CRLF，所以这些文件里只用单行锚点。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const F = {
  SH: 'share.js', SA: 'share.html', PLJ: 'planner.js', PLH: 'planner.html',
  SET: 'settings.html', SW: 'sw.js'
};

const MUTS = [
  {
    name: 'M1 载荷改成透传整个 stop（隐私白名单失效）',
    edits: [[F.SH, 'var st = { n: nameOf(s) };', 'var st = { n: nameOf(s), photo: s.photo, note: s.note };', 1]],
    expect: '载荷里混进了「photo」'
  },
  {
    name: 'M2 base64url 解码漏还原一个字符（链接解不开自己编的包）',
    edits: [[F.SH, "var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');",
      "var b64 = String(str).replace(/_/g, '/');", 1]],
    expect: '往返失败'
  },
  {
    name: 'M3 URL 上限抬到 20000（发出会被聊天软件截断的链接）',
    edits: [[F.SH, 'var URL_LIMIT = 7000;', 'var URL_LIMIT = 20000;', 1]],
    expect: '超过聊天软件 7000 字符的实测上限'
  },
  {
    name: 'M4 基址协议放宽到任意 scheme（javascript:// 也能当基址）',
    edits: [[F.SH, "if (!/^https?:\\/\\//i.test(s)) return '';", "if (!/^[a-z][a-z0-9+.-]*:\\/\\//i.test(s)) return '';", 1]],
    expect: 'normBase(javascript://evil.com/%0aalert(1))'
  },
  {
    name: 'M5 超长不再拒绝（直接产出 16k 字符的链接）',
    edits: [[F.SH, 'if (url && url.length > URL_LIMIT) {', 'if (false && url && url.length > URL_LIMIT) {', 1]],
    expect: '超长行程应判 too-long'
  },
  {
    name: 'M6 分享页不引压缩库',
    edits: [[F.SA, '<script src="vendor/pako.min.js"></script>', '<!-- 变异：没引 pako -->', 1]],
    expect: 'share.html 没引 vendor/pako.min.js'
  },
  {
    name: 'M7 分享页加一个「用行迹打开」（壳侧没有 intent-filter，是死控件）',
    edits: [[F.SA, "' 复制行程文字</button></div>' +",
      "' 复制行程文字</button><a class=\"btn\" href=\"traceapp://open\">用行迹打开</a></div>' +", 1]],
    expect: '出现了唤起按钮'
  },
  {
    name: 'M8 空载荷态文案改成「出错了」（没说清怎么办）',
    edits: [[F.SA, "host.innerHTML = badState('这条链接没有带上行程',", "host.innerHTML = badState('出错了',", 1]],
    expect: '缺一条失败态文案'
  },
  {
    name: 'M9 结果区没挂「分享行程」按钮',
    edits: [[F.PLJ, "      '<button class=\"btn\" onclick=\"window.plannerShare()\">'+TI('share')+'分享行程</button>' +",
      "      '' +", 1]],
    expect: 'planner 结果区没挂「分享行程」按钮'
  },
  {
    name: 'M10 确认卡不再声明不会分享什么',
    edits: [[F.PLJ, '不会分享：游记正文、照片、录音、任何 API Key。', '确认无误后继续。', 1]],
    expect: '确认卡没向用户写明不会分享什么'
  },
  {
    name: 'M11 系统分享优先被砍掉（只留复制链接）',
    edits: [[F.PLJ, "if (typeof navigator.share === 'function') {", 'if (false) {', 1]],
    expect: 'plannerShare 没优先走系统分享'
  },
  {
    name: 'M12 设置页分享网址不落盘',
    edits: [[F.SET, 'Share.setBase(', '/*M12*/(', 2]],
    expect: 'settings 没有分享网址输入或没落盘'
  },
  {
    name: 'M13 sw SHELL 漏掉压缩库（离线打开分享页解不开）',
    edits: [[F.SW, "  './vendor/pako.min.js',", '  /* M13 */', 1]],
    expect: 'sw.js SHELL 缺 ./vendor/pako.min.js'
  },
  {
    name: 'M14 分享页日卡内边距自己改了（与 planner 版式漂移）',
    edits: [[F.SA, 'padding:16px 17px;margin-bottom:14px', 'padding:14px 15px;margin-bottom:14px', 1]],
    expect: '版式漂移 .day-card'
  },
  {
    name: 'M15 基址键改名没在备份策略登记（换机就丢分享设置）',
    edits: [[F.SH, "var BASE_KEY = 'tn_share_base';", "var BASE_KEY = 'tn_shareUrl';", 1]],
    expect: '在备份策略里是「unregistered」'
  }
];

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function write(f, s) { fs.writeFileSync(path.join(ROOT, f), s, 'utf8'); }

const orig = {};
const touched = new Set();
MUTS.forEach(m => m.edits.forEach(e => touched.add(e[0])));
touched.forEach(f => { orig[f] = read(f); });

function restore() { touched.forEach(f => { if (read(f) !== orig[f]) write(f, orig[f]); }); }

function runVerify() {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'verify.js')],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    let ok = true, why = '';
    m.edits.forEach(([f, from, , cnt]) => {
      const n = read(f).split(from).length - 1;
      if (n !== cnt) { ok = false; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 46)); }
    });
    if (!ok) { fail++; console.log('✗ ' + m.name + ' — ' + why); return; }
    m.edits.forEach(([f, from, to]) => write(f, read(f).split(from).join(to)));
    const r = runVerify();
    restore();
    const hit = r.out.includes(m.expect);
    if (r.code !== 0 && hit) { pass++; console.log('✓ ' + m.name + '\n    exit=' + r.code + ' · 红在：' + m.expect); }
    else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.expect + '」=' + hit
        + '\n    ' + r.out.split('\n').filter(l => l.indexOf('分享闸门') >= 0 || l.indexOf('=== ') === 0).join('\n    ').slice(0, 900));
    }
  });
} finally {
  restore();
  touched.forEach(f => { if (read(f) !== orig[f]) { dirty++; console.log('!! 未还原：' + f); } });
  console.log('还原对账：' + touched.size + ' 个文件，未还原 ' + dirty + ' 个');
  const after = runVerify();
  console.log('还原后 verify.js exit=' + after.code);
}
console.log('=== §17 变异自测: ' + pass + ' 条按要求变红 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' ===');
process.exit(fail || dirty ? 1 : 0);
