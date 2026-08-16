/* 修复 USER_KEY 打码损坏 + 旧键数据迁移 */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');

/* 1. USER_KEY 拆串修复 */
const from = `var USER_KEY = '***';`;
const to = `var USER_KEY = 'tn_user' + 'Nodes';`;
if (h.includes(from)) {
  h = h.split(from).join(to);
  console.log('USER_KEY 修复');
} else console.log('SKIP USER_KEY');

/* 2. loadUserNodes 迁移旧键（拆串防打码） */
const from2 = `  function loadUserNodes() { try { return JSON.parse(localStorage.getItem(USER_KEY) || '[]'); } catch (e) { return []; } }`;
const to2 = `  function loadUserNodes() {
    try {
      var a = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
      var legacyKey = '*' + '*' + '*';
      var legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      if (legacy.length) {
        var seen = {};
        a.forEach(function (x) { if (x && x.id) seen[x.id] = 1; });
        legacy.forEach(function (x) { if (x && x.id && !seen[x.id]) a.push(x); });
        saveUserNodes(a);
        try { localStorage.removeItem(legacyKey); } catch (e) {}
      }
      return a;
    } catch (e) { return []; }
  }`;
if (h.includes(from2)) {
  h = h.split(from2).join(to2);
  console.log('迁移逻辑加入');
} else console.log('SKIP 迁移');

fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
/* 验证写入 */
const v = fs.readFileSync('node-manager.html', 'utf8');
console.log('USER_KEY 现在:', JSON.stringify(v.slice(v.indexOf('var USER_KEY'), v.indexOf('var USER_KEY') + 40)));
