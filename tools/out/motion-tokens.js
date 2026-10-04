/* 批次 11-A：design.css 动效时序 token 收口（一次性变换脚本，带前后对账）
 * 口径：
 *  1) 新增唯一来源 --motion-*（值就近归档，不改视觉节奏的量级）；
 *  2) 旧三族 --t-* / --duration-* 改成从 --motion-* 派生的别名（album.html 等外部引用不断链）；
 *  3) 零引用的 --dur-fast/--dur-norm/--dur-slow/--t-slow/--duration-slow 直接删（不留兼容壳）；
 *  4) 其余每一处裸时序字面量换成 var(--motion-*)；.fade-stagger 的 8 档延迟改 calc(--motion-step * n)；
 *  5) 变换后除 --motion-* 定义行外，全文件裸时序字面量必须为 0，否则不落盘。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const p = path.join(ROOT, 'design.css');
const src = fs.readFileSync(p, 'utf8');
const L = src.split('\n');

const MAP = {
  '.01ms': 'var(--motion-none)', '160ms': 'var(--motion-fast)', '180ms': 'var(--motion-fast)',
  '.12s': 'var(--motion-tap)', '.15s': 'var(--motion-fast)',
  '240ms': 'var(--motion-mid)', '.22s': 'var(--motion-mid)',
  '280ms': 'var(--motion-normal)', '.28s': 'var(--motion-normal)', '.3s': 'var(--motion-normal)',
  '360ms': 'var(--motion-page)', '.32s': 'var(--motion-page)', '.35s': 'var(--motion-page)',
  '480ms': 'var(--motion-enter)', '.5s': 'var(--motion-enter)', '.55s': 'var(--motion-enter)',
  '520ms': 'var(--motion-slow)', '.6s': 'var(--motion-long)', '.7s': 'var(--motion-long)',
  '1.2s': 'var(--motion-flash)', '1.3s': 'var(--motion-shimmer)',
  '2.2s': 'var(--motion-boot)', '2.8s': 'var(--motion-breath)', '3s': 'var(--motion-breath)'
};
const STAG = { '.03s': 1, '.07s': 2, '.11s': 3, '.15s': 4, '.19s': 5, '.23s': 6, '.27s': 7, '.31s': 8 };

/* 定义行/待删行按行号处理（0-based）：96-100 是旧「动效」块，189-191 是旧 --duration-* 族 */
const DEF_OLD = [95, 96, 97, 98, 99];      /* 旧「动效」块：--t-fast / --t-norm / --t-slow / --dur 三兄弟 / --ease-spring */
const DUR_OLD = [188, 189, 190];           /* --duration-fast/normal/slow */
if (!/--t-fast:160ms/.test(L[95]) || !/--ease-spring:cubic-bezier/.test(L[99])) throw new Error('动效块锚点不符：' + L[95] + ' / ' + L[99]);
if (!/--duration-fast:160ms/.test(L[188]) || !/--duration-slow:520ms/.test(L[190])) throw new Error('--duration-* 块锚点不符');

const MOTION = [
  '  /* 动效：唯一时序来源（--motion-*），其余族一律从这里派生；见 verify.js §19 */',
  '  --motion-none:.01ms;            /* 减动效档的归零值 */',
  '  --motion-tap:120ms;             /* 按压缩放、图标微动：跟手 */',
  '  --motion-fast:160ms;            /* 悬停/小位移 */',
  '  --motion-mid:240ms;             /* 卡片抬升、模态淡入 */',
  '  --motion-normal:280ms;          /* 主过渡 */',
  '  --motion-page:360ms;            /* 页面入场 */',
  '  --motion-enter:480ms;           /* 面板升起/节点浮现 */',
  '  --motion-slow:520ms;            /* 长内容渐显 */',
  '  --motion-long:700ms;            /* 图片呼吸式推移 */',
  '  --motion-flash:1200ms;          /* 图例闪烁一次 */',
  '  --motion-shimmer:1300ms;        /* 骨架扫光 */',
  '  --motion-boot:2200ms;           /* 启动印章呼吸 */',
  '  --motion-breath:2800ms;         /* 常驻循环（麦浪/节点呼吸） */',
  '  --motion-step:40ms;             /* 逐条入场步长 */',
  '  --ease-spring:cubic-bezier(.34,1.56,.64,1);',
  '  /* 旧族别名：album.html 等页面仍在用，一律从 --motion-* 派生，不再自带字面量 */',
  '  --t-fast:var(--motion-fast) var(--ease-standard);',
  '  --t-norm:var(--motion-normal) var(--ease-standard);'
];
const DUR_ALIAS = [
  '  --duration-fast:var(--motion-fast);',
  '  --duration-normal:var(--motion-normal);'
];

const out = [];
L.forEach((line, i) => {
  if (DEF_OLD.includes(i)) { if (i === DEF_OLD[0]) out.push(...MOTION); return; }
  if (DUR_OLD.includes(i)) { if (i === DUR_OLD[0]) out.push(...DUR_ALIAS); return; }
  let l = line;
  Object.keys(STAG).forEach(k => {
    if (l.includes('animation-delay:' + k)) l = l.split('animation-delay:' + k).join('animation-delay:calc(var(--motion-step)*' + STAG[k] + ')');
  });
  /* 其余裸时序一律换成 token；按串长降序替换，避免 "3s" 抢先吃掉 "1.3s" 的尾巴 */
  Object.keys(MAP).sort((a, b) => b.length - a.length).forEach(k => {
    l = l.replace(new RegExp('(^|[^A-Za-z0-9_.-])' + k.replace(/[.]/g, '\\.') + '\\b', 'g'), (m, pre) => pre + MAP[k]);
  });
  out.push(l);
});
let s2 = out.join('\n');
/* 别名与 --motion-* 定义行是白名单；对账：其余行不得再有裸时序 */
const bad = s2.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) =>
  /(^|[^A-Za-z0-9_.-])\d*\.?\d+(ms|s)\b/.test(l) && !/^\s*--(motion|duration|t)-[a-z]+:/.test(l));
if (bad.length) { console.error('!! 仍有裸时序字面量 ' + bad.length + ' 处，不落盘：\n' + bad.slice(0, 12).map(([n, l]) => n + '|' + l.trim().slice(0, 100)).join('\n')); process.exit(1); }
const before = (src.match(/(^|[^A-Za-z0-9_.-])\d*\.?\d+(ms|s)\b/g) || []).length;
const tokDefs = (s2.match(/^\s*--motion-[a-z]+:/gm) || []).length;
fs.writeFileSync(p, s2, 'utf8');
console.log('design.css 时序收口：原裸字面量 ' + before + ' 处 → 现仅剩 token 定义 ' + tokDefs + ' 行；行数 ' + L.length + ' → ' + s2.split('\n').length);
console.log('var(--motion-*) 引用 ' + (s2.match(/var\(--motion-/g) || []).length + ' 处');
