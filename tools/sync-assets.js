/* sync-assets.js — 前端文件同步到 Android assets（html/js/css/vendor/art/images，保留 assets 特有内容） */
const fs = require('fs');
const path = require('path');
const SRC = 'F:/MyAi/Trace';
const DST = 'F:/MyAi/Trace/android_app/app/src/main/assets';

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return 0;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  fs.readdirSync(src, { withFileTypes: true }).forEach(e => {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else { fs.copyFileSync(s, d); n++; }
  });
  return n;
}

let total = 0;
/* 顶层前端文件 */
fs.readdirSync(SRC).forEach(f => {
  if (/\.(html|js|css)$/.test(f)) {
    fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
    total++;
  }
});
if (fs.existsSync(path.join(SRC, 'manifest.webmanifest'))) {
  fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(DST, 'manifest.webmanifest'));
  total++;
}
/* 目录（合并覆盖） */
['vendor', 'art', 'images', 'images_chz', 'images_gs', 'images_gxyn', 'images_gz', 'images_qz', 'images_sc', 'images_xj', 'img-test'].forEach(d => {
  total += copyDir(path.join(SRC, d), path.join(DST, d));
});
console.log('synced files:', total);
/* 验证关键文件 */
const checks = [
  ['explore-map.html', '7833 处'],
  ['topic-common.js', "statEl.style.display = (tab === 'map')"],
  ['travel-notes.js', "color:var(--color-ink);letter-spacing:.04em"]
];
checks.forEach(([f, mark]) => {
  const s = fs.readFileSync(path.join(DST, f), 'utf8');
  console.log(f, '→', s.includes(mark) ? 'OK' : 'STALE');
});
