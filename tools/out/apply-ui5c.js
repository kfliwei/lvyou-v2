/* UI-5 · S3e：body 的 background 简写 → background-color（保住 --grain-page）
 *
 * design.css 把纸颗粒铺在 body 上（background-image:var(--grain-page)），
 * 但每个页自己的 <style> 里都有一行 `body{background:var(--color-bg)}`，加载顺序在 design.css 之后。
 * `background` 是简写，未指定的 longhand 一律复位为初始值，于是 background-image 被抹成 none——
 * 纸颗粒在源码里写着、在预览里看不见，CSS 也不报错。
 * 修法只有把简写降成 background-color：底色的事交给页面，纹理的事交给 design.css。
 *
 * 用法：node tools/out/apply-ui5c.js         （干跑，只列不改）
 *       node tools/out/apply-ui5c.js --write  （落盘）
 */
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..', '..'));
const WRITE = process.argv.indexOf('--write') >= 0;

const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
const FILES = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !/-data\.js$/.test(f) && f !== 'sw.js');

let total = 0, touched = 0;
FILES.forEach(f => {
  const raw = fs.readFileSync(f, 'utf8');
  const src = strip(raw);
  const edits = [];
  const st = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') st.push(i);
    else if (c === '}') {
      const s = st.pop();
      if (s === undefined) break;
      if (src.indexOf('{', s + 1) < i) continue;
      const last = src.slice(Math.max(0, s - 240), s).split(',').pop().replace(/\\/g, ' ').trim();
      if (!/^body($|[.:#\[])/.test(last)) continue;
      /* 声明起点必须在块首或 ; / 空白之后，且属性名正好是 background（不误伤 background-color/image） */
      const body = src.slice(s + 1, i);
      const re = /(?:^|[;\s])background\s*:/g;
      let m;
      while ((m = re.exec(body))) {
        /* 属性名在匹配里的真实下标：m[0] 开头可能带一个定界符（; 或空白），
           用 m[0].length-1 会落到冒号上，从冒号起的 10 个字符（值的前缀）就被覆盖掉——
           实测把 18 个页面改成 `backgroundbackground-coloror-bg)` 这种非法声明。 */
        const at = s + 1 + m.index + m[0].indexOf('background');
        edits.push({ at: at, len: 'background'.length, to: 'background-color' });
      }
    }
  }
  if (!edits.length) return;
  total += edits.length;
  touched++;
  let out = raw;
  edits.reverse().forEach(e => { out = out.slice(0, e.at) + e.to + out.slice(e.at + e.len); });
  console.log('  ' + f + ' ×' + edits.length + (WRITE ? ' [已改]' : ' [干跑]'));
  if (WRITE) fs.writeFileSync(f, out);
});
console.log((WRITE ? '已落盘 ' : '干跑（加 --write 落盘）：') + total + ' 处 background: → background-color:，涉及 ' + touched + ' 个文件');
