/* 验证 tn-key.js 完整性（不打印明文） */
const fs = require('fs');
const s = fs.readFileSync('tn-key.js', 'utf8');
const m = s.match(/window\.__TN_AMAP_KEY__ = '([^']+)';/);
if (m) {
  const k = m[1];
  console.log('Key 长度:', k.length, 'hex:', /^[0-9a-f]{32}$/.test(k));
  /* 分段校验（不显示完整） */
  console.log('首4:', k.slice(0, 4), '尾4:', k.slice(-4), '中间抽样:', k.slice(4, 8) + '***' + k.slice(24, 28));
} else console.log('格式错误');
