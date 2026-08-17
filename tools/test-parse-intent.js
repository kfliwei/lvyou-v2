/* 规则意图解析回归测试：中文数字天数 + 节奏/同伴规则提取
 * 运行：node tools/test-parse-intent.js（需在仓库根目录） */
const fs = require('fs');
const vm = require('vm');

const nation = fs.readFileSync('nation-index.js', 'utf8');
const src = fs.readFileSync('planner.js', 'utf8');

function cut(from, toExclusive) {
  const i = src.indexOf(from);
  const j = src.indexOf(toExclusive, i);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + from + ' / ' + toExclusive);
  return src.slice(i, j);
}

const parseIndexFn = cut('function parseIndex()', '  function buildDicts()');
const buildDictsFn = cut('function buildDicts()', '  var REGION_ALIAS =');
const regionAlias = cut('var REGION_ALIAS =', '  function matchRegions');
const matchRegionsFn = cut('function matchRegions(text)', '  /* ---------- 分省详情懒加载');
const prefBlock = cut('var PREF = {', '  var PREF_KEYS');
const parseIntentBlock = cut('function parseIntent(text)', '  /* ---------- 召回');

const sandbox = { window: {}, isFinite };
vm.createContext(sandbox);
vm.runInContext(nation, sandbox);
vm.runInContext('var INDEX = null, regionSet = null, cityToRegion = null, cityCoord = {};' + parseIndexFn + buildDictsFn + regionAlias + matchRegionsFn + prefBlock + 'var PREF_KEYS = Object.keys(PREF);' + parseIntentBlock, sandbox);

const parseIntent = vm.runInContext('parseIntent', sandbox);
const ruleEnhance = vm.runInContext('ruleEnhance', sandbox);

// 用例：[句子, 期望regions, 期望days, 期望pace(可null), 期望companions(可null)]
const CASES = [
  ['我想去川西玩5天', ['四川'], 5, null, null],
  ['国庆想从成都出发自驾川西，玩7天，顺便去云南', ['云南', '四川'], 7, null, null],
  ['想去山西看看古建筑', ['山西'], 0, null, null],
  ['带孩子去广州长隆，紧凑点，两天逛完', ['广东'], 2, '紧凑', '亲子'],
  ['想带爸妈去云南玩两周', ['云南'], 14, null, '带老人'],
  ['准备去呼伦贝尔大草原骑骑马', ['内蒙古'], 0, null, null],
  ['想自驾环北疆，看雪山冰川和沙漠', ['新疆'], 0, null, null],
  ['去苏州杭州上海转一圈，5天', ['上海', '江苏', '浙江'], 5, null, null],
  ['一个人去青海湖慢慢逛，不赶时间', ['青海'], 0, '舒缓', '独自'],
  ['和朋友去长沙特种兵式玩三天', ['湖南'], 3, '紧凑', null],
  ['陪父母去北京玩半个月', ['北京'], 15, null, '带老人'],
];

let fail = 0;
for (const [s, expRegions, expDays, expPace, expComp] of CASES) {
  const r = parseIntent(s);
  const regOK = JSON.stringify(r.regions.sort()) === JSON.stringify([...expRegions].sort());
  const dayOK = r.days === expDays;
  const e = ruleEnhance(s) || { pace: null, companions: null };
  const paceOK = (e.pace || null) === (expPace || null) || (expPace === null && e.pace === '一般');
  const compOK = (e.companions || null) === (expComp || null);
  const ok = regOK && dayOK && paceOK && compOK;
  if (!ok) {
    fail++;
    console.log('FAIL: ' + s);
    console.log('  got regions=[' + r.regions.join(',') + '] days=' + r.days + ' pace=' + (e.pace || null) + ' comp=' + (e.companions || null));
    console.log('  exp regions=[' + expRegions.join(',') + '] days=' + expDays + ' pace=' + (expPace || null) + ' comp=' + (expComp || null));
  } else {
    console.log('PASS: ' + s);
  }
}
console.log(fail === 0 ? '=== ALL ' + CASES.length + ' PASSED ===' : '=== ' + fail + ' FAILED ===');
process.exit(fail === 0 ? 0 : 1);
