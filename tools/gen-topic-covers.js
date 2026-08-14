/* gen-topic-covers.js — 为无图专题生成统一风格封面 SVG（对齐 topic-sc.svg 模板）
 * 模板：520x360 横向 / 渐变天空 / 远山+中景+近景三层 / 主题元素 / 印章字
 * 用法：node tools/gen-topic-covers.js
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'art');

/* 山链生成：起点(x0,y0) 经控制点起伏，终点(x1,y1)，返回 path 的 Q 段 */
function ridge(x0, y0, x1, y1, segs) {
  let d = `M${x0} ${y0}`;
  const n = segs || 4;
  for (let i = 0; i < n; i++) {
    const a = x0 + (x1 - x0) * i / n;
    const b = x0 + (x1 - x0) * (i + 1) / n;
    const mid = (a + b) / 2;
    const h = y0 + (y1 - y0) * (i + 1) / n;
    const up = y0 - (y1 - y0) * 0.25 - (i % 2 ? 14 : 0);
    d += ` Q${mid} ${up} ${b} ${h}`;
  }
  return d;
}
function mountains(yBase, amp, color, stroke, segs) {
  // 远山：起伏山脊 + 闭合到底部
  const d = ridge(-20, yBase - amp, 540, yBase - amp * 0.4, segs);
  return `<path d="${d} L540 ${yBase + 90} L-20 ${yBase + 90} Z" fill="${color}" opacity=".85"/>
  <path d="${d}" stroke="${stroke || color}" stroke-width="1.6" fill="none" opacity=".5"/>`;
}
function band(y, color, q1, q2) {
  // 中景/近景色带
  return `<path d="M-20 ${y} Q${q1} ${y - 40} ${(q1 + q2) / 2} ${y} T540 ${y - 8} L540 ${y + 56} L-20 ${y + 56} Z" fill="${color}" opacity=".9"/>`;
}
function seal(ch, color) {
  return `<g transform="translate(96 214)"><rect width="64" height="64" rx="8" fill="${color}" opacity=".92"/>
<text x="32" y="47" font-size="40" text-anchor="middle" fill="#FFF7EC" font-family="'Kaiti SC','KaiTi','STKaiti',serif" font-weight="bold">${ch}</text></g>`;
}

/* 每省配置：天空渐变 / 中景色 / 主题元素片段 / 印章字 */
const PROV = {
  qh: { sky: ['#E8ECEA', '#C9D6D2'], mid: '#5F8A9B', ch: '青',
    el: `<circle cx="330" cy="168" r="46" fill="#5F8A9B" opacity=".55"/><circle cx="330" cy="168" r="30" fill="#8FB4BC" opacity=".6"/>
<circle cx="300" cy="150" r="7" fill="#E9C46A"/><circle cx="352" cy="172" r="6" fill="#E9C46A"/><circle cx="330" cy="192" r="5" fill="#E9C46A"/><circle cx="312" cy="180" r="4.5" fill="#E9C46A"/>` },
  xz: { sky: ['#E2E6E4', '#C2CCC8'], mid: '#7E8E92', ch: '藏',
    el: `<line x1="430" y1="120" x2="430" y2="240" stroke="#4A5559" stroke-width="3" stroke-linecap="round"/>
<path d="M430 120 L480 128 L430 136 Z" fill="#C86D4B"/><path d="M430 140 L480 148 L430 156 Z" fill="#7E8E92"/>
<path d="M430 160 L480 168 L430 176 Z" fill="#B8B3A3"/><path d="M430 180 L480 188 L430 196 Z" fill="#71806C"/>
<circle cx="300" cy="90" r="20" fill="#C86D4B" opacity=".7"/>` },
  nmg: { sky: ['#F0EDE2', '#DCD5C2'], mid: '#8B9E6E', ch: '蒙',
    el: `<path d="M300 176 Q300 140 332 140 Q364 140 364 176 Z" fill="#F2EDE0" stroke="#8B9E6E" stroke-width="2.5"/>
<path d="M312 168 Q314 154 326 153" stroke="#8B9E6E" stroke-width="2" fill="none"/><rect x="312" y="164" width="4" height="14" fill="#8B9E6E"/>
<path d="M250 196 Q258 186 266 196" stroke="#5F7A4E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M398 192 Q404 184 410 192" stroke="#5F7A4E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M210 120 Q220 108 230 120" stroke="#5F7A4E" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>` },
  sx2: { sky: ['#EFE7DC', '#DCCFBD'], mid: '#A9764E', ch: '秦',
    el: `<path d="M300 190 L300 118 L330 118 L330 190 M300 148 L330 148 M300 122 L330 122" stroke="#A9764E" stroke-width="4" fill="none" stroke-linejoin="round"/>
<path d="M292 190 L338 190" stroke="#A9764E" stroke-width="3" stroke-linecap="round"/>
<path d="M210 190 L210 150 L212 148 L214 150 L214 190" fill="#8A5A44"/>
<path d="M220 190 L220 138 L222 136 L224 138 L224 190" fill="#8A5A44"/>
<path d="M230 190 L230 128 L232 126 L234 128 L234 190" fill="#8A5A44"/>
<path d="M400 190 L400 146 L402 144 L404 146 L404 190" fill="#8A5A44"/>` },
  cq: { sky: ['#EDE6DD', '#D8CCC0'], mid: '#A0613F', ch: '渝',
    el: `<g fill="#8A5A44"><rect x="300" y="150" width="26" height="40"/><rect x="330" y="128" width="26" height="62"/><rect x="360" y="144" width="24" height="46"/></g>
<path d="M296 192 L388 192" stroke="#A0613F" stroke-width="3"/>
<path d="M300 150 L326 150 M330 128 L356 128" stroke="#C86D4B" stroke-width="2"/>
<path d="M256 186 Q264 178 272 186" stroke="#A0613F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M244 150 Q254 140 264 150" stroke="#A0613F" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>` },
  nx: { sky: ['#F2ECDF', '#E0D5BE'], mid: '#C9A05C', ch: '宁',
    el: `<path d="M230 200 Q300 150 380 196" stroke="#C9A05C" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M320 160 Q330 168 322 176" stroke="#C9A05C" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M400 150 Q420 142 440 150 Q460 158 470 150" fill="#D9B878" opacity=".8"/>
<path d="M390 158 Q412 148 436 156 Q452 160 462 154" stroke="#B8945A" stroke-width="2" fill="none" opacity=".7"/>` },
  bj: { sky: ['#F4EFE6', '#E0D6C4'], mid: '#B4543A', ch: '京',
    el: `<path d="M300 128 L318 128 L318 150 L306 150 L306 164 L318 164 L318 184 L300 184 Z" fill="#B4543A"/>
<path d="M300 118 L318 118 L318 128 L300 128 Z" fill="#B4543A"/>
<circle cx="309" cy="156" r="5" fill="#F2EDE0"/>
<rect x="240" y="176" width="120" height="16" fill="#B4543A" opacity=".85"/>
<rect x="248" y="184" width="104" height="8" fill="#8A3D2B" opacity=".7"/>` },
  tj: { sky: ['#E8EDF0', '#CBD6DD'], mid: '#6D7D88', ch: '津',
    el: `<circle cx="320" cy="152" r="42" fill="none" stroke="#6D7D88" stroke-width="5"/>
<circle cx="320" cy="152" r="30" fill="none" stroke="#6D7D88" stroke-width="2" opacity=".7"/>
<path d="M320 110 L320 194 M278 152 L362 152 M296 122 L344 182 M344 122 L296 182" stroke="#6D7D88" stroke-width="2" opacity=".7"/>
<path d="M240 194 Q300 168 420 192" stroke="#3E7CB1" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M310 196 L318 196 L314 204 Z" fill="#3E7CB1"/>` },
  sd: { sky: ['#EDF0EA', '#D4DCD2'], mid: '#71806C', ch: '鲁',
    el: `<path d="M270 200 L300 138 L330 200 Z" fill="#71806C"/>
<path d="M300 138 L318 168 L300 186 L284 164 Z" fill="#EDF0EA" opacity=".9"/>
<path d="M352 196 Q372 186 392 196 Q382 190 392 184" stroke="#5F7A8E" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M352 188 Q368 180 384 188" stroke="#5F7A8E" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>` },
  ln: { sky: ['#E6EDF0', '#C7D5DD'], mid: '#5F7A8E', ch: '辽',
    el: `<path d="M320 190 L320 138 L354 168 L320 168" fill="#F2EDE0" stroke="#5F7A8E" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M354 168 L354 192" stroke="#5F7A8E" stroke-width="2"/>
<path d="M300 196 Q320 184 340 194" stroke="#3E7CB1" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M410 120 Q420 112 430 120" stroke="#5F7A8E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M406 126 Q420 118 434 126" stroke="#5F7A8E" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>` },
  jl: { sky: ['#F0F2EE', '#D8DDD6'], mid: '#8C9B8F', ch: '吉',
    el: `<path d="M300 200 L300 140" stroke="#8C9B8F" stroke-width="5" stroke-linecap="round"/>
<path d="M300 140 Q286 138 282 150 M300 150 Q312 148 316 158 M300 160 Q290 158 288 168 M300 170 Q310 168 312 178" stroke="#EDF0EA" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M380 200 L380 160" stroke="#8C9B8F" stroke-width="4" stroke-linecap="round"/>
<path d="M380 160 Q370 158 367 168 M380 172 Q390 170 392 178" stroke="#EDF0EA" stroke-width="2.5" fill="none" stroke-linecap="round"/>` },
  hlj: { sky: ['#E9F0F4', '#CBDCE3'], mid: '#7FA0B0', ch: '黑',
    el: `<g stroke="#7FA0B0" stroke-width="3" stroke-linecap="round" fill="none">
<path d="M320 110 L320 190 M320 110 L350 130 M320 110 L290 130 M320 150 L350 170 M320 150 L290 170"/>
</g>
<g stroke="#EDF0F4" stroke-width="2" stroke-linecap="round" fill="none" opacity=".9">
<path d="M320 118 L336 128 M320 122 L304 128 M320 158 L336 168 M320 162 L304 168"/>
</g>
<circle cx="400" cy="140" r="5" fill="#7FA0B0" opacity=".6"/><circle cx="270" cy="180" r="4" fill="#7FA0B0" opacity=".6"/>` },
  he: { sky: ['#F1EDE4', '#DDD4C2'], mid: '#8A6D3B', ch: '冀',
    el: `<path d="M240 160 L240 196 L440 196 L440 160" fill="none" stroke="#8A6D3B" stroke-width="5"/>
<path d="M240 160 L252 148 L264 160 M280 160 L292 148 L304 160 M320 160 L332 148 L344 160 M360 160 L372 148 L384 160 M400 160 L412 148 L424 160" stroke="#8A6D3B" stroke-width="5" fill="none"/>
<path d="M300 120 Q340 100 380 120" stroke="#8A6D3B" stroke-width="2.5" fill="none" opacity=".6"/>` },
  ha: { sky: ['#F2EDE3', '#E0D6C2'], mid: '#A9764E', ch: '豫',
    el: `<path d="M290 196 L290 118 L298 118 L298 196 Z" fill="#A9764E"/>
<path d="M298 150 L306 150 L306 196 L298 196 Z" fill="#C9A05C"/>
<path d="M282 196 L306 196" stroke="#A9764E" stroke-width="3"/>
<path d="M350 196 L350 158 L358 158 L358 196 Z" fill="#8A5A44"/>
<path d="M344 196 L364 196" stroke="#8A5A44" stroke-width="3"/>
<path d="M260 200 Q320 172 400 198" stroke="#71806C" stroke-width="2.5" fill="none" opacity=".6"/>` },
  sh: { sky: ['#E9EDF1', '#CDD6DE'], mid: '#5E6B76', ch: '沪',
    el: `<g fill="#5E6B76" opacity=".9">
<rect x="260" y="150" width="18" height="46"/><rect x="286" y="128" width="20" height="68"/>
<rect x="314" y="142" width="16" height="54"/><rect x="338" y="118" width="22" height="78"/>
<rect x="368" y="148" width="16" height="48"/></g>
<path d="M338 118 L348 128 L338 138 L328 128 Z" fill="#C86D4B" opacity=".9"/>
<rect x="256" y="196" width="134" height="6" fill="#5E6B76" opacity=".6"/>
<path d="M404 192 Q416 186 428 192" stroke="#3E7CB1" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>` },
  js: { sky: ['#EDF1EA', '#D6DED0'], mid: '#7E8C6E', ch: '苏',
    el: `<circle cx="320" cy="158" r="40" fill="none" stroke="#7E8C6E" stroke-width="4"/>
<path d="M320 118 L320 198 M280 158 L360 158" stroke="#7E8C6E" stroke-width="1.5" opacity=".6"/>
<path d="M336 158 Q350 148 358 138 M340 158 Q348 168 352 178" stroke="#B4543A" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<circle cx="358" cy="138" r="4" fill="#C86D4B"/>` },
  zj: { sky: ['#E8EFEA', '#C9D8CE'], mid: '#5F8A6B', ch: '浙',
    el: `<g fill="#5F8A6B" opacity=".9">
<path d="M280 196 L280 152 L288 152 L288 196 Z"/><path d="M310 196 L310 144 L318 144 L318 196 Z"/><path d="M340 196 L340 152 L348 152 L348 196 Z"/></g>
<path d="M276 152 L292 152 M306 144 L322 144 M336 152 L352 152" stroke="#C86D4B" stroke-width="2.5"/>
<path d="M240 196 Q300 172 400 194" stroke="#3E7CB1" stroke-width="2.5" fill="none" opacity=".7"/>
<path d="M398 140 Q406 132 414 140" stroke="#5F8A6B" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/>` },
  ah: { sky: ['#EFEDE4', '#DAD5C4'], mid: '#8A8F6C', ch: '皖',
    el: `<path d="M270 200 L300 130 L330 200 Z" fill="#8A8F6C"/>
<path d="M300 130 Q300 96 320 84 Q318 110 330 130" fill="#5F7A4E"/>
<path d="M310 118 Q330 100 348 108" stroke="#4C4A45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M348 108 Q358 116 356 128" stroke="#4C4A45" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M320 84 L316 70 M316 70 Q320 66 324 70 M316 70 L314 62" stroke="#4C4A45" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  fj: { sky: ['#F2ECE4', '#E0D5C4'], mid: '#A9714B', ch: '闽',
    el: `<circle cx="320" cy="158" r="42" fill="none" stroke="#A9714B" stroke-width="5"/>
<circle cx="320" cy="158" r="30" fill="#D9C3A8" opacity=".55"/>
<rect x="306" y="144" width="10" height="16" rx="5" fill="#8A5A44"/><rect x="326" y="146" width="10" height="16" rx="5" fill="#8A5A44"/>
<path d="M310 172 L314 180 L318 172" fill="none" stroke="#A9714B" stroke-width="2.5" stroke-linecap="round"/>
<path d="M324 174 L328 182 L332 174" fill="none" stroke="#A9714B" stroke-width="2.5" stroke-linecap="round"/>
<path d="M392 170 Q404 162 416 170" stroke="#3E7CB1" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>` },
  jx: { sky: ['#F0EDE4', '#DDD6C4'], mid: '#B4543A', ch: '赣',
    el: `<path d="M310 196 L310 130 Q340 120 354 138 Q332 150 310 146" fill="#B4543A" opacity=".9"/>
<path d="M310 130 L310 196" stroke="#8A3D2B" stroke-width="2.5" opacity=".6"/>
<path d="M270 200 Q300 178 330 198" stroke="#7E8C9E" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
<path d="M382 170 L382 150 M378 156 L386 156" stroke="#7E8C9E" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>` },
  gd: { sky: ['#E9EEF0', '#CDD8DC'], mid: '#5E7A8A', ch: '粤',
    el: `<path d="M318 118 Q334 148 318 196 L322 196 Q342 148 326 118 Z" fill="#5E7A8A"/>
<path d="M322 120 L326 120 L324 124 Z" fill="#C86D4B"/>
<path d="M300 196 Q320 184 340 194" stroke="#3E7CB1" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M292 186 Q302 178 312 186" stroke="#3E7CB1" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>
<path d="M386 150 Q394 142 402 150" stroke="#5E7A8A" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/>` },
  hi: { sky: ['#EAF3EE', '#CCE0D4'], mid: '#3E8E6E', ch: '琼',
    el: `<path d="M310 200 L310 130" stroke="#8A5A44" stroke-width="6" stroke-linecap="round"/>
<path d="M310 130 Q282 118 270 138 M310 150 Q340 138 350 156 M310 172 Q288 162 280 178" stroke="#3E8E6E" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="270" cy="138" r="5" fill="#C86D4B"/><circle cx="350" cy="156" r="5" fill="#C86D4B"/><circle cx="280" cy="178" r="5" fill="#C86D4B"/>
<path d="M380 196 Q400 184 420 194" stroke="#3E8E6E" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/>` },
  hk: { sky: ['#E7ECEF', '#C9D4DA'], mid: '#5A6E7E', ch: '港',
    el: `<g fill="#5A6E7E" opacity=".92">
<rect x="252" y="150" width="16" height="48"/><rect x="276" y="130" width="18" height="68"/>
<rect x="302" y="144" width="14" height="54"/><rect x="324" y="122" width="20" height="76"/>
<rect x="352" y="140" width="15" height="58"/></g>
<path d="M324 122 L332 132 L324 142 L316 132 Z" fill="#C86D4B" opacity=".9"/>
<path d="M240 196 Q300 168 380 194" stroke="#3E7CB1" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M262 192 L262 168 L282 188 L266 188" fill="#F2EDE0" stroke="#3E7CB1" stroke-width="2" stroke-linejoin="round"/>` },
  mo: { sky: ['#F2EDE6', '#E0D6C8'], mid: '#C9A05C', ch: '澳',
    el: `<path d="M300 196 L300 138 Q304 128 316 128 Q328 128 332 138 L332 196" fill="none" stroke="#C9A05C" stroke-width="5"/>
<path d="M308 196 L308 150 Q312 142 316 142 Q320 142 324 150 L324 196" fill="#F2EDE0" stroke="#C9A05C" stroke-width="2.5"/>
<path d="M292 168 L340 168" stroke="#C9A05C" stroke-width="3"/>
<path d="M292 182 L340 182" stroke="#C9A05C" stroke-width="3"/>
<path d="M258 196 Q278 184 290 196" stroke="#C9A05C" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>` },
  tw: { sky: ['#EDF0EA', '#D2DAD0'], mid: '#6D8E6E', ch: '台',
    el: `<path d="M250 200 L290 150 L330 200 Z" fill="#6D8E6E"/>
<circle cx="370" cy="158" r="26" fill="#D9B878" opacity=".85"/>
<path d="M370 132 Q396 152 370 184 Q344 152 370 132 Z" fill="#C9A05C" opacity=".9"/>
<path d="M370 132 L370 184 M344 152 L396 152" stroke="#B8945A" stroke-width="1.5" opacity=".6"/>` }
};

const files = [];
Object.keys(PROV).forEach(k => {
  const p = PROV[k];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360" fill="none">
  <!-- 专题封面：${p.ch}（生成：tools/gen-topic-covers.js） -->
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.sky[0]}"/>
      <stop offset="1" stop-color="${p.sky[1]}"/>
    </linearGradient>
  </defs>
  <rect width="520" height="360" fill="url(#sky)"/>
  <!-- 远山 -->
  ${mountains(210, 78, p.mid, '', 4)}
  <!-- 主题元素 -->
  ${p.el}
  <!-- 中景 -->
  ${band(262, p.mid, 120, 420)}
  <!-- 近景 -->
  ${band(318, '#20201D', 160, 380)}
  <!-- 印章 -->
  ${seal(p.ch, '#C86D4B')}
</svg>
`;
  const fp = path.join(OUT, 'topic-' + k + '.svg');
  fs.writeFileSync(fp, svg, 'utf8');
  files.push(fp);
});
console.log('生成', files.length, '张封面：');
files.forEach(f => console.log(' ', path.basename(f)));
