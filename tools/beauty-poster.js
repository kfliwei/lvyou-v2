/* poster.js：加"制图风"主题（Stamen 数据诗学方向）+ review.html 制图海报按钮 */
const fs = require('fs');

let s = fs.readFileSync('poster.js', 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP poster:' + tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK   poster:' + tag);
}

/* 1. THEMES 定义（generate 前） */
rep(
  '  function generate(landscape) {',
  `  var THEMES = {
    ink: { bg: ['#2E3B42', '#20201D', '#14130F'], deco: 'rgba(200,109,75,.07)', title: '#FAF8F3', sub: '#C8C0B2', grid: 'rgba(250,248,243,.05)', track: 'rgba(200,109,75,.85)', dotFill: 'rgba(250,248,243,.95)', dotStroke: '#C86D4B', statBg: 'rgba(250,248,243,.06)', statV: '#FAF8F3', statK: '#C8C0B2', badgeBg: 'rgba(200,109,75,.16)', badgeT: '#E8B49A', foot: '#8F8A80' },
    carto: { bg: ['#F7F2E7', '#EFE7D4', '#E7DCC4'], deco: 'rgba(169,86,59,.08)', title: '#26241F', sub: '#8C7B66', grid: 'rgba(169,86,59,.12)', track: 'rgba(169,86,59,.9)', dotFill: '#FFFDF8', dotStroke: '#A9563B', statBg: 'rgba(169,86,59,.07)', statV: '#26241F', statK: '#8C7B66', badgeBg: 'rgba(169,86,59,.12)', badgeT: '#A9563B', foot: '#8C7B66' }
  };
  function generate(landscape, themeName) {
    var th = THEMES[themeName] || THEMES.ink;`,
  '1.themes'
);

/* 2. 背景 */
rep(
  "    var g = ctx.createLinearGradient(0, 0, 0, H);\n    g.addColorStop(0, '#2E3B42'); g.addColorStop(.55, '#20201D'); g.addColorStop(1, '#14130F');",
  "    var g = ctx.createLinearGradient(0, 0, 0, H);\n    g.addColorStop(0, th.bg[0]); g.addColorStop(.55, th.bg[1]); g.addColorStop(1, th.bg[2]);",
  '2.bg'
);

/* 3. 装饰圆 + 制图等高线 */
rep(
  "    ctx.fillStyle = 'rgba(200,109,75,.07)';",
  "    ctx.fillStyle = th.deco;",
  '3.deco'
);
rep(
  "    /* 标题 */",
  "    /* 制图风等高线纹理（carto 主题） */\n    if (themeName === 'carto') {\n      ctx.strokeStyle = 'rgba(169,86,59,.10)'; ctx.lineWidth = 1.2;\n      [[260,500,120],[520,620,90],[700,400,140],[340,900,180],[820,1080,110]].forEach(function (c) {\n        ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.stroke();\n        ctx.beginPath(); ctx.arc(c[0], c[1], c[2] + 26, 0, Math.PI * 2); ctx.stroke();\n      });\n    }\n\n    /* 标题 */",
  '4.contour'
);

/* 5. 标题/副标题 */
rep(
  "    ctx.fillStyle = '#FAF8F3';\n    ctx.font = '600 64px \"Songti SC\",\"Noto Serif SC\",serif';",
  "    ctx.fillStyle = th.title;\n    ctx.font = '600 64px \"Songti SC\",\"Noto Serif SC\",serif';",
  '5.title'
);
rep(
  "    ctx.globalAlpha = .7; ctx.fillStyle = '#C8C0B2';",
  "    ctx.globalAlpha = .7; ctx.fillStyle = th.sub;",
  '6.sub'
);

/* 7. 网格 */
rep(
  "    ctx.strokeStyle = 'rgba(250,248,243,.05)';",
  "    ctx.strokeStyle = th.grid;",
  '7.grid'
);

/* 8. 轨迹 */
rep(
  "    ctx.strokeStyle = 'rgba(200,109,75,.85)';",
  "    ctx.strokeStyle = th.track;",
  '8.track'
);

/* 9. 频次点 */
rep(
  "      ctx.fillStyle = 'rgba(250,248,243,.95)';",
  "      ctx.fillStyle = th.dotFill;",
  '9.dot fill'
);
rep(
  "      ctx.lineWidth = 2.5; ctx.strokeStyle = '#C86D4B';",
  "      ctx.lineWidth = 2.5; ctx.strokeStyle = th.dotStroke;",
  '10.dot stroke'
);

/* 11. 统计 */
rep(
  "      ctx.fillStyle = 'rgba(250,248,243,.06)';",
  "      ctx.fillStyle = th.statBg;",
  '11.stat bg'
);
rep(
  "      ctx.fillStyle = '#FAF8F3';\n      ctx.font = '600 44px \"Songti SC\",serif';",
  "      ctx.fillStyle = th.statV;\n      ctx.font = '600 44px \"Songti SC\",serif';",
  '12.stat v'
);
rep(
  "      ctx.globalAlpha = .65; ctx.fillStyle = '#C8C0B2';",
  "      ctx.globalAlpha = .65; ctx.fillStyle = th.statK;",
  '13.stat k'
);

/* 14. 徽章 */
rep(
  "      ctx.fillStyle = 'rgba(200,109,75,.16)';",
  "      ctx.fillStyle = th.badgeBg;",
  '14.badge bg'
);
rep(
  "      ctx.fillStyle = '#E8B49A';",
  "      ctx.fillStyle = th.badgeT;",
  '15.badge t'
);

/* 16. 落款 */
rep(
  "    ctx.globalAlpha = .5; ctx.fillStyle = '#8F8A80';",
  "    ctx.globalAlpha = .5; ctx.fillStyle = th.foot;",
  '16.foot'
);

fs.writeFileSync('poster.js', s, 'utf8');
console.log('poster patches:', n);

/* review.html：制图海报按钮 */
let r = fs.readFileSync('review.html', 'utf8');
const btnFrom = "document.getElementById('posterBtn').onclick = function () { try { window.FootprintPoster.generate(); } catch (e) { UI.toast('生成失败：' + (e && e.message || e)); } };";
const btnTo = "document.getElementById('posterBtn').onclick = function () { try { window.FootprintPoster.generate(); } catch (e) { UI.toast('生成失败：' + (e && e.message || e)); } };\n    document.getElementById('posterCarto').onclick = function () { try { window.FootprintPoster.generate(false, 'carto'); } catch (e) { UI.toast('生成失败：' + (e && e.message || e)); } };";
if (r.includes(btnFrom)) {
  r = r.split(btnFrom).join(btnTo);
  /* 在现有海报按钮后加制图按钮（找 posterBtn 的 HTML） */
  const htmlFrom = 'id="posterBtn"';
  const htmlTo = 'id="posterBtn"';
  const btnHtml = ' <button class="is-btn" id="posterCarto" style="min-height:44px;border:1px solid var(--color-line-strong);border-radius:999px;background:var(--color-surface);color:var(--color-ink-soft);font-size:13px;cursor:pointer;padding:0 16px">制图海报</button>';
  /* 在 posterBtn 元素后插入：需要找 posterBtn 所在容器 —— 简单方式：在 posterBtnH 按钮 HTML 后追加 */
  const hFrom = 'id="posterBtnH"';
  if (r.includes(hFrom)) {
    r = r.split(hFrom).join(hFrom);
  }
  /* 直接找 review.html 里 posterBtn 的 html 行，追加按钮 */
  const ph = /id="posterBtn"[^>]*>([^<]*)<\/button>/;
  if (ph.test(r)) {
    r = r.replace(ph, function (m) { return m + btnHtml; });
    console.log('OK   review:carto button');
  } else {
    console.log('SKIP review:carto button html');
  }
  fs.writeFileSync('review.html', r, 'utf8');
  console.log('OK   review:carto handler');
} else {
  console.log('SKIP review:carto handler');
}
