/* tools/out/probe27-scan-tagclose.js — 只读扫描：拼 HTML 的字符串里 <tag 没收尾 > 就直接接 '+TI('
 * 形状：<button ... aria-label="关闭"  ' + TI('close',14)  → 解析器把 <svg ...> 整串当成属性吞掉，图标不 paint。
 * 用法: node tools/out/probe27-scan-tagclose.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && !f.startsWith('smoke-'));

const BAD = /<[a-zA-Z][^<>]*?["']\s*\+\s*TI\(/g;              /* <tag … 无 > 直接接 '+TI( */
const GOOD = /<[a-zA-Z][^<>]*?>\s*['"]\s*\+\s*TI\(/g;         /* <tag … > 收尾后接 '+TI( */
const ANY = /\+\s*TI\(/g;

let bad = 0, good = 0, any = 0, other = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  src.forEach((line, i) => {
    const b = (line.match(BAD) || []), g = (line.match(GOOD) || []), a = (line.match(ANY) || []);
    bad += b.length; good += g.length; any += a.length;
    b.forEach(m => { console.log('!! ' + f + ':' + (i + 1) + '  ' + m.replace(/\s+/g, ' ').slice(0, 92)); });
    /* 既不算坏也没被 GOOD 认领的站点：逐条打出来人眼看，别让它静默落在两族之外 */
    if (a.length > Math.max(b.length, g.length)) other.push(f + ':' + (i + 1) + '  ' + line.trim().replace(/\s+/g, ' ').slice(0, 110));
  });
}
console.log('--- 全库 +TI() 站点 ' + any + ' 处；坏形状（tag 没收尾）' + bad + ' 处；好形状 ' + good + ' 处');
console.log('--- 两族都没认领的站点 ' + other.length + ' 处');
other.slice(0, 12).forEach(s => console.log('   ~ ' + s));
