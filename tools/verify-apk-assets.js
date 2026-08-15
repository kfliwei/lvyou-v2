/* 用 node（UTF-8）验证 APK 内资产 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const apk = 'F:/MyAi/Trace/android_app/app/build/outputs/apk/release/app-release.apk';
const tmp = path.join(os.tmpdir(), 'apkcheck6');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
fs.copyFileSync(apk, path.join(tmp, 'app.zip'));
execSync(`powershell -Command "Expand-Archive -Path '${path.join(tmp, 'app.zip')}' -DestinationPath '${path.join(tmp, 'out')}' -Force"`);

const out = path.join(tmp, 'out', 'assets');
const checks = [
  ['explore-map.html', '7833 处'],
  ['index.html', '搜索全部景点（7833 处）'],
  ['topic-common.js', "statEl.style.display = (tab === 'map')"],
  ['travel-notes.js', "color:var(--color-ink);letter-spacing:.04em"],
  ['travel-notes.js', "location.href = 'settings.html'"],
  ['node-manager.html', "Ai.chat("]
];
checks.forEach(([f, mark]) => {
  const s = fs.readFileSync(path.join(out, f), 'utf8');
  console.log((s.includes(mark) ? 'OK  ' : 'STALE ') + f + ' :: ' + mark.slice(0, 30));
});
fs.rmSync(tmp, { recursive: true, force: true });
