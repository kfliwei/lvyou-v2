/* tools/batch-enrich.js — AI 批量扩写短介绍（DeepSeek）
 * 用法: DEEPSEEK_KEY=sk-xxx node tools/batch-enrich.js [--limit N] [--all]
 *   默认只处理带「必去/网红」标识(flag m/h)的短介绍景点；
 *   加 --all 处理全部 desc<20 字的景点。
 * 每批 20 个，逐个写回，断点续跑（已补全的会跳过）。
 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var KEY = process.env.DEEPSEEK_KEY || '';
if (!KEY) { console.error('请设置环境变量 DEEPSEEK_KEY=sk-xxx'); process.exit(1); }

var LIMIT = 0; // 0 = 不限
process.argv.forEach(function (a, i) { if (a === '--limit') LIMIT = parseInt(process.argv[i + 1], 10) || 0; });
var ALL = process.argv.indexOf('--all') >= 0;

var FILES = ['data.js','ah-data.js','bj-data.js','changzheng-data.js','cq-data.js','fj-data.js','gd-data.js','gs-data.js','gxyn-data.js','gz-data.js','ha-data.js','hb-data.js','he-data.js','hi-data.js','hk-data.js','hlj-data.js','hn-data.js','jl-data.js','js-data.js','jx-data.js','ln-data.js','mo-data.js','nmg-data.js','nx-data.js','qh-data.js','qingzang-data.js','sc-data.js','sd-data.js','sh-data.js','sx-data.js','tj-data.js','tw-data.js','xj-data.js','xz-data.js','zj-data.js'];

// 收集待补全景点
var todo = [];
FILES.forEach(function (f) {
  var p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch (e) { return; }
  (ctx.window.SITES || []).forEach(function (s) {
    if (!s || !s.name) return;
    var d = (s.desc || '').trim();
    if (d.length >= 20) return;
    if (!ALL && !/[mh]/.test(s.flag || '')) return;
    todo.push({ file: f, name: s.name, region: s.region, city: s.city || '', theme: s.theme || s.ty || '', old: d });
  });
});
console.log('待补全:', todo.length, '个' + (ALL ? '（全部短介绍）' : '（仅必去/网红）'));
if (LIMIT) { todo = todo.slice(0, LIMIT); console.log('本轮限制 --limit', LIMIT); }

var BATCH = 20;
var done = 0, fail = 0;
function run(i) {
  if (i >= todo.length) { console.log('\n完成：成功 ' + done + ' 个，失败 ' + fail + ' 个'); return; }
  var batch = todo.slice(i, i + BATCH);
  var prompt = '你是旅行景点编辑。下面是若干景点的基本信息（名称/地区/类型/现有极短介绍），请把每个景点的介绍扩写为 40~80 字的简洁介绍，' +
    '涵盖：它是什么、核心看点、游览价值。只能基于景点名称和常识扩写，不要编造具体年代、尺寸、数字等未经证实的信息；' +
    '语气平实，像旅游攻略，不要营销腔。严格按 JSON 数组输出，格式 [{"name":"景点名","desc":"介绍"}...]，name 必须与输入完全一致。\n\n' +
    batch.map(function (x) { return x.name + '（' + x.region + ' ' + x.city + '，类型：' + x.theme + '）现有：' + x.old; }).join('\n');

  fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.6 })
  }).then(function (r) { return r.json(); }).then(function (j) {
    var txt = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
    var arr = [];
    try { arr = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) { arr = []; }
    if (!arr.length) { console.log('批次', i / BATCH + 1, '解析失败，重试跳过'); fail += batch.length; run(i + BATCH); return; }
    applyBatch(arr);
    console.log('批次', i / BATCH + 1, '完成，', arr.length, '个');
    run(i + BATCH);
  }).catch(function (e) {
    console.log('批次', i / BATCH + 1, '请求失败:', e.message);
    fail += batch.length;
    run(i + BATCH);
  });
}

function applyBatch(arr) {
  // 按文件分组写回
  var byFile = {};
  arr.forEach(function (x) {
    var item = todo.find(function (t) { return t.name === x.name && !t._done; });
    if (!item || !x.desc || String(x.desc).length < 15) return;
    item._done = true;
    (byFile[item.file] = byFile[item.file] || []).push({ old: item.old, new: x.desc });
  });
  Object.keys(byFile).forEach(function (f) {
    var p = path.join(__dirname, '..', f);
    var src = fs.readFileSync(p, 'utf8');
    byFile[f].forEach(function (pch) {
      var from = '"desc":"' + pch.old + '"';
      var to = '"desc":"' + pch.new.replace(/"/g, '') + '"';
      if (src.indexOf(from) >= 0) { src = src.split(from).join(to); done++; }
      else console.log('  ✗ 未匹配:', f, pch.old);
    });
    fs.writeFileSync(p, src, 'utf8');
  });
}

run(0);
