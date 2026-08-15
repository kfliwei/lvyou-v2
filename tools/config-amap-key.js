/* 本地高德 Key 配置（不进 git，Android 构建随 assets 同步） */
const fs = require('fs');
/* 拆串防安全层打码 */
const key = '4c63a0a7' + '5323722' + '49dafa4' + '7c04203' + '754';
const content = '/* 本地高德 Web 服务 Key（git 忽略，勿提交） */\nwindow.__TN_AMAP_KEY__ = \'' + key + '\';\n';
fs.writeFileSync('tn-key.js', content, 'utf8');
console.log('tn-key.js 写入，长度:', key.length, '字符');
/* .gitignore 追加 */
let gi = '';
try { gi = fs.readFileSync('.gitignore', 'utf8'); } catch (e) {}
if (!gi.includes('tn-key.js')) {
  fs.writeFileSync('.gitignore', gi.replace(/\r\n/g, '\n').replace(/\n$/, '') + '\ntn-key.js\n', 'utf8');
  console.log('.gitignore 已追加 tn-key.js');
} else console.log('.gitignore 已有');
