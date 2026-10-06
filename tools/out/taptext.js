/* 真机盲点辅助：按文案定位并点按（uiautomator dump -> 找 text/content-desc -> input tap 中心） */
const { execFileSync } = require('child_process');
const fs = require('fs');
const ADB = 'D:/Android/Sdk/platform-tools/adb.exe';
const pat = new RegExp(process.argv[2]);
const pick = parseInt(process.argv[3] || '1', 10);
execFileSync(ADB, ['shell', 'uiautomator', 'dump', '//sdcard/ui.xml'], { stdio: 'ignore' });
const xml = execFileSync(ADB, ['exec-out', 'cat', '//sdcard/ui.xml'], { maxBuffer: 1 << 26 }).toString('utf8');
fs.writeFileSync(__dirname + '/ui-dump.xml', xml);
let hit = 0;
for (const m of xml.matchAll(/<node[^>]*>/g)) {
  const t = m[0];
  const txt = (t.match(/text="([^"]*)"/) || [])[1] || '';
  const desc = (t.match(/content-desc="([^"]*)"/) || [])[1] || '';
  const b = (t.match(/bounds="(-?[\d,]+)\]\[(-?[\d,]+)"/) || []);
  if (!b[1] || b[1] === '0,0') continue;
  if (!pat.test(txt || desc)) continue;
  hit++;
  const x1 = +b[1].split(',')[0], y1 = +b[1].split(',')[1], x2 = +b[2].split(',')[0], y2 = +b[2].split(',')[1];
  console.log(JSON.stringify(txt || desc), b[1] + '][' + b[2]);
  if (hit === pick) {
    const cx = Math.round((x1 + x2) / 2), cy = Math.round((y1 + y2) / 2);
    if (cy >= 2400) { console.log('BELOW_NAV 先上滑再点'); break; }
    if (process.argv[4] !== '--dry') {
      execFileSync(ADB, ['shell', 'input', 'tap', String(cx), String(cy)]);
      console.log('TAP', cx, cy);
    }
    break;
  }
}
if (!hit) console.log('NOT_FOUND', xml.length);
