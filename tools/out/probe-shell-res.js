/* 打包前 res 预检（两条，都是「只有 aapt 才炸、而壳工程常常几天不构建」的那类雷）：
 *   ① XML 注释里出现「--」        → mergeDebugResources: 注释中不允许出现字符串 "--"
 *   ② VectorDrawable 用了不存在的属性 → processDebugResources: attribute android:xxx not found
 *      （2026-10-04 实际撞到：splash_brand.xml 写了 strokeOpacity，正确名是 strokeAlpha。
 *       批次 7 的 §15 启动屏闸门是自己解析 XML 对账几何，属性名对不对它看不见——
 *       「闸门写了不等于测过」，能编译才算测过。）
 * 用法：node tools/out/probe-shell-res.js [根目录=../lvyou-v2-android/app/src/main]
 * 退出码：0 干净，1 有违规（逐条打 file:line）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.join(__dirname, '..', '..', '..', 'lvyou-v2-android', 'app', 'src', 'main');

/* VectorDrawable 各标签的合法属性（android: 前缀省略） */
const ALLOW = {
  vector: ['name', 'width', 'height', 'viewportWidth', 'viewportHeight', 'alpha', 'tint', 'tintMode', 'autoMirrored'],
  group: ['name', 'scaleX', 'scaleY', 'rotation', 'translateX', 'translateY', 'pivotX', 'pivotY'],
  path: ['name', 'pathData', 'fillColor', 'fillAlpha', 'fillType', 'strokeColor', 'strokeWidth', 'strokeAlpha',
    'strokeLineCap', 'strokeLineJoin', 'trimPathStart', 'trimPathEnd', 'trimPathOffset'],
  'clip-path': ['name', 'pathData'],
};

let checked = 0, bad = 0;
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.xml')) { files.push(p); }
  }
})(ROOT);

for (const p of files) {
  const s = fs.readFileSync(p, 'utf8');
  checked++;
  const lineOf = (idx) => s.slice(0, idx).split(/\r?\n/).length;

  /* ① 注释 */
  let m;
  const reC = /<!--[\s\S]*?-->/g;
  while ((m = reC.exec(s)) !== null) {
    if (m[0].slice(4, -3).includes('--')) {
      console.log('违规 注释 ' + p + ':' + lineOf(m.index) + ' 注释内含「--」→ ' + m[0].replace(/\s+/g, ' ').slice(0, 90));
      bad++;
    }
  }
  const opens = (s.match(/<!--/g) || []).length, closes = (s.match(/-->/g) || []).length;
  if (opens !== closes) { console.log('违规 注释 ' + p + ' <!-- ' + opens + ' 次 / --> ' + closes + ' 次，数量不等'); bad++; }

  /* ② vector 属性名（只在含 <vector 的文件里查） */
  if (!/<vector[\s>]/.test(s)) continue;
  const reTag = /<(vector|group|path|clip-path)\b([\s\S]*?)\/?>/g;
  while ((m = reTag.exec(s)) !== null) {
    const tag = m[1], attrs = m[2];
    const allow = ALLOW[tag];
    let a;
    const reA = /([A-Za-z][\w.]*(?::[\w-]+)?)\s*=\s*"[^"]*"/g;
    while ((a = reA.exec(attrs)) !== null) {
      let name = a[1];
      /* xmlns:android="..." 是命名空间声明，不是属性；其它前缀（app: 等）在 aapt 眼里才是非法 */
      if (/^xmlns/i.test(name)) continue;
      if (name.includes(':')) {
        const parts = name.split(':');
        if (parts[0] !== 'android') {
          console.log('违规 属性 ' + p + ':' + lineOf(m.index) + ' <' + tag + '> 上出现非 android 前缀 ' + parts[0] + ':');
          bad++;
          continue;
        }
        name = parts[1];
      }
      if (!allow.includes(name)) {
        console.log('违规 属性 ' + p + ':' + lineOf(m.index) + ' <' + tag + '> 上没有 android:' + name + ' 这个属性');
        bad++;
      }
    }
  }
}

console.log('扫描 ' + checked + ' 个 xml，违规 ' + bad + ' 处');
process.exit(bad ? 1 : 0);
