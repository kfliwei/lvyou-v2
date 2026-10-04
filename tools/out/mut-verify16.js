/* 批次 8 · verify.js §16 闸门变异自测
 * 每条变异只改一个「应该让闸门变红」的点，跑 verify.js 断言：exit=1 且输出含指定短语。
 * 全部变异跑完后从内存快照还原，并逐字节对账；锚点要求先断出现次数，防止改到别处。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

const F = {
  BK: 'backup.js', WD: 'sync-webdav.js', TN: 'travel-notes.js',
  SET: 'settings.html', SW: 'sw.js', VM: 'tools/verify.js', DOC: '改进实施方案与验收标准.md'
};

const MUTS = [
  {
    name: 'M1 文档字段表漏一行（tn_wishlist）',
    edits: [[F.DOC, '| `tn_wishlist` | data | id | 想去清单条目带 id，跨设备要并集不能整键覆盖 |',
      '（M1：这一行不再是表格行）', 1]],
    expect: '文档字段表漏键 tn_wishlist'
  },
  {
    name: 'M2 文档字段表合并语义写错（tn_lod dict→whole）',
    edits: [[F.DOC, '| `tn_lod` | prefs | dict | 地图节点分级三档参数 |',
      '| `tn_lod` | prefs | whole | 地图节点分级三档参数 |', 1]],
    expect: '键 tn_lod 两说不一致'
  },
  {
    name: 'M3 产品代码新增未登记存储键字面量',
    edits: [[F.TN, '\n  window.TravelNotes = {',
      "\n  /* 变异探针：新键没在备份策略里登记过 */ var mutProbe = 'tn_mut_newkey';\n  window.TravelNotes = {", 1]],
    expect: '未登记的存储键字面量'
  },
  {
    name: 'M4 密钥键被搬进白名单（tn_aiKey 从 NEVER 进 KEYS）',
    edits: [
      [F.BK, "      'tn_aiKey',            /* 旧版单站点 AI Key */", '', 1],
      [F.BK, "    { k: 'travelNotes', g: 'data', m: 'id' },",
        "    { k: 'tn_aiKey', g: 'prefs', m: 'whole' },\n    { k: 'travelNotes', g: 'data', m: 'id' },", 1]
    ],
    expect: '哨兵扫描失效：塞进 tn_aiKey'
  },
  {
    name: 'M5 NEVER 里悄悄加禁入键且闸门不给理由',
    edits: [
      [F.BK, "'tn_rc_idx', 'tn_emptyClosed'", "'tn_rc_idx', 'tn_emptyClosed', 'tn_mut_never'", 1],
      [F.TN, '\n  window.TravelNotes = {',
        "\n  var mutNeverProbe = 'tn_mut_never';\n  window.TravelNotes = {", 1]
    ],
    expect: '禁入键没在闸门登记理由：tn_mut_never'
  },
  {
    name: 'M6 闸门白名单里的禁入条目已失效（代码再也扫不到）',
    edits: [[F.VM, "    const EXPECT_NEVER = {",
      "    const EXPECT_NEVER = {\n      'tn_mut_gone': '这条已经扫不到了',", 1]],
    expect: '闸门里的禁入条目已失效，代码里再也扫不到：tn_mut_gone'
  },
  {
    name: 'M7 去掉恢复写入口 replaceNotes',
    edits: [[F.TN, '    replaceNotes: function (list) {', '    repalceNotes: function (list) {', 1]],
    expect: 'travel-notes.js 没导出 replaceNotes'
  },
  {
    name: 'M8 sw.js SHELL 漏掉 backup.js',
    edits: [[F.SW, "  './backup.js',\n", '', 1]],
    expect: 'sw.js SHELL 缺 ./backup.js'
  },
  {
    name: 'M9 sync-webdav.js 丢掉 MKCOL 建目录链路',
    edits: [[F.WD, 'MKCOL', 'PUT', 2]],
    expect: '没有 MKCOL 建目录链路'
  },
  {
    name: 'M10 恢复后不刷新页面',
    edits: [[F.SET, 'setTimeout(function () { location.reload(); }, 1800);',
      'setTimeout(function () { /* 不刷新 */ }, 1800);', 1]],
    expect: '恢复后没刷新页面'
  },
  {
    name: 'M11 口令输入框退回明文',
    edits: [[F.SET, 'id="wdPass" type="password"', 'id="wdPass" type="text"', 1]],
    expect: '口令输入框不是 type=password'
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
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

let pass = 0, fail = 0, dirty = 0;
const base = runVerify();
console.log('基线：verify.js exit=' + base.code + (base.code === 0 ? '（绿，闸门当前全通过）' : '（红，先修基线再自测）'));
if (base.code !== 0) { console.log(base.out.split('\n').filter(l => /✗|FAIL|问题/.test(l)).join('\n')); process.exit(2); }

try {
  MUTS.forEach(m => {
    /* 先断锚点出现次数，再落变异 */
    let ok = true, why = '';
    m.edits.forEach(([f, from, to, cnt]) => {
      const cur = read(f);
      const n = cur.split(from).length - 1;
      if (n !== cnt) { ok = false; why = '锚点在 ' + f + ' 出现 ' + n + ' 次（期望 ' + cnt + '）：' + JSON.stringify(from.slice(0, 40)); }
    });
    if (!ok) { fail++; console.log('✗ ' + m.name + ' — ' + why); return; }
    /* 全量替换：String.replace(串) 只换第一处，M9 那种「两处都算命中」的锚点会假通过 */
    m.edits.forEach(([f, from, to]) => write(f, read(f).split(from).join(to)));
    const r = runVerify();
    restore();
    const hit = r.out.includes(m.expect);
    if (r.code !== 0 && hit) { pass++; console.log('✓ ' + m.name + '\n    exit=' + r.code + ' · 红在：' + m.expect); }
    else {
      fail++;
      console.log('✗ ' + m.name + '\n    exit=' + r.code + '（期望非 0）· 含「' + m.expect + '」=' + hit
        + '\n    ' + r.out.split('\n').filter(l => l.indexOf('备份闸门') >= 0 || l.indexOf('=== ') === 0).join('\n    '));
    }
  });
} finally {
  restore();
  touched.forEach(f => { if (read(f) !== orig[f]) { dirty++; console.log('!! 未还原：' + f); } });
  console.log('还原对账：' + touched.size + ' 个文件，未还原 ' + dirty + ' 个');
  const after = runVerify();
  console.log('还原后 verify.js exit=' + after.code);
}
console.log('=== §16 变异自测: ' + pass + ' 条按要求变红 / ' + fail + ' 条异常 / 共 ' + MUTS.length + ' ===');
process.exit(fail || dirty ? 1 : 0);
