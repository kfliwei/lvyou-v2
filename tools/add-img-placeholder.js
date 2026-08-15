/* 详情图片框统一：无图时占位（首字+提示），实景拉取成功后原位替换 */
const fs = require('fs');

/* 1. buildSheet：图片区改为始终渲染 */
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = "var img = imgSrc(s) ? '<div class=\"ls-img\"><img src=\"' + imgSrc(s) + '\" alt=\"' + esc(s.label) + '\" onerror=\"";
if (!t.includes(from)) { console.log('SKIP buildSheet (pattern)'); process.exit(0); }
/* 找到该语句的整行（到行尾 ;）替换 */
const lineEnd = t.indexOf(';\n', t.indexOf(from));
const line = t.slice(t.indexOf(from), lineEnd + 1);
console.log('原行:', line.slice(0, 100));
const newLine = "var img = '<div class=\"ls-img\" id=\"lsImgBox\">' + (imgSrc(s)\n    ? '<img src=\"' + imgSrc(s) + '\" alt=\"' + esc(s.label) + '\" onerror=\"this.style.display=\\'none\\'\">'\n    : '<div class=\"ls-img-ph\"><span class=\"ls-img-ph-ch\">' + esc((s.label || '景').charAt(0)) + '</span><i>实景照加载中…</i></div>') + '</div>' +";
t = t.slice(0, t.indexOf(from)) + newLine + t.slice(lineEnd + 1);
fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('buildSheet img box unified');

/* 2. openSheet 实景照回调：兼容占位替换 */
let t2 = fs.readFileSync('topic-common.js', 'utf8');
const c2 = t2.includes('\r\n');
if (c2) t2 = t2.replace(/\r\n/g, '\n');
const cbFrom = `      loadSitePhoto(_s0, function (u) {
        var img = document.querySelector('#locSheet .ls-img img');
        if (!img || !u) return;
        if (img.getAttribute('src') !== u) {
          img.src = u;
          img.onerror = function () { img.style.display = 'none'; };
        }
      });`;
const cbTo = `      loadSitePhoto(_s0, function (u) {
        var box = document.getElementById('lsImgBox');
        if (!box || !u) return;
        var img = box.querySelector('img');
        if (!img) {
          box.innerHTML = '<img src="' + u + '" alt="' + esc(_s0.label) + '" style="width:100%;height:100%;object-fit:cover">';
        } else if (img.getAttribute('src') !== u) {
          img.src = u;
          img.onerror = function () { img.style.display = 'none'; };
        }
      });`;
if (t2.includes(cbFrom)) {
  t2 = t2.split(cbFrom).join(cbTo);
  fs.writeFileSync('topic-common.js', c2 ? t2.replace(/\n/g, '\r\n') : t2, 'utf8');
  console.log('photo callback placeholder-compatible');
} else console.log('SKIP callback');

/* 3. map.css 占位样式 */
let m = fs.readFileSync('map.css', 'utf8');
const mc = m.includes('\r\n');
if (mc) m = m.replace(/\r\n/g, '\n');
const css = `
/* 详情图占位（2026-08-15：无实景照时统一图片框） */
.ls-img-ph{display:grid;place-items:center;position:absolute;inset:0;background:linear-gradient(135deg,var(--color-bg-soft),var(--color-surface));text-align:center}
.ls-img-ph .ls-img-ph-ch{font-family:var(--font-serif);font-size:60px;color:rgba(38,36,31,.1);line-height:1}
.ls-img-ph i{position:absolute;bottom:10px;font-style:normal;font-size:11px;color:var(--color-muted);background:var(--color-surface);border-radius:999px;padding:3px 12px;box-shadow:0 2px 8px rgba(40,38,32,.08)}
.theme-dark .ls-img-ph{background:linear-gradient(135deg,var(--color-bg-soft),var(--color-surface))}
.theme-dark .ls-img-ph .ls-img-ph-ch{color:rgba(239,233,220,.08)}
`;
if (!m.includes('.ls-img-ph{')) {
  fs.writeFileSync('map.css', mc ? (m + css).replace(/\n/g, '\r\n') : m + css, 'utf8');
  console.log('placeholder css added');
} else console.log('css exists');
